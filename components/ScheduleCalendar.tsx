import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, MapPin, Trophy, Loader2, ChevronDown, Zap } from 'lucide-react';
import { Card, Badge, Button } from './ui/Common';
import { ScheduleEvent } from '../types';
import { useUserSchedule } from '../lib/hooks';

// Vietnamese day names
const DAYS_VI = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const MONTHS_VI = [
    'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
    'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
];

interface CalendarDay {
    date: Date;
    isCurrentMonth: boolean;
    isToday: boolean;
    events: ScheduleEvent[];
}

interface ScheduleCalendarProps {
    onEventClick?: (event: ScheduleEvent) => void;
    className?: string;
}

function safeParseMs(value: unknown): number | null {
    if (!value) return null;
    if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
    if (typeof value !== 'string') return null;
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
}

function safeIsoDay(value: unknown): string | null {
    if (!value) return null;
    const iso = value instanceof Date ? value.toISOString() : typeof value === 'string' ? value : null;
    if (!iso) return null;
    const day = iso.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

const ScheduleCalendar: React.FC<ScheduleCalendarProps> = ({ onEventClick, className = '' }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [showEventJump, setShowEventJump] = useState(false);
    const eventJumpRef = useRef<HTMLDivElement>(null);

    // Fetch ALL events for jump menu (wider range)
    const allEventsRange = useMemo(() => {
        const start = new Date();
        start.setMonth(start.getMonth() - 6); // 6 months ago
        const end = new Date();
        end.setMonth(end.getMonth() + 12); // 12 months ahead
        return { start, end };
    }, []);

    // Lazy-fetch jump menu events only when the dropdown opens (prevents UI freezes on large datasets)
    const jumpFetchStatusRef = useRef<'idle' | 'loading' | 'done'>('idle');
    const {
        schedule: jumpEvents,
        isLoading: isJumpLoading,
        error: jumpError,
        refetch: refetchJumpEvents,
    } = useUserSchedule({ autoFetch: false });

    const triggerJumpFetch = useCallback(() => {
        jumpFetchStatusRef.current = 'loading';
        return refetchJumpEvents(allEventsRange.start, allEventsRange.end)
            .then(() => {
                jumpFetchStatusRef.current = 'done';
            })
            .catch((err) => {
                jumpFetchStatusRef.current = 'idle';
                throw err;
            });
    }, [allEventsRange.end, allEventsRange.start, refetchJumpEvents]);

    useEffect(() => {
        if (!showEventJump) return;
        if (jumpFetchStatusRef.current !== 'idle') return;
        triggerJumpFetch().catch(() => { });
    }, [showEventJump, triggerJumpFetch]);

    useEffect(() => {
        if (!showEventJump) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (eventJumpRef.current && !eventJumpRef.current.contains(event.target as Node)) {
                setShowEventJump(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showEventJump]);

    // Calculate date range for fetching (current month ± 1 week buffer)
    const dateRange = useMemo(() => {
        const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), -7);
        const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 7);
        return { start, end };
    }, [currentDate]);

    const { schedule, isLoading, error, refetch } = useUserSchedule({
        startDate: dateRange.start,
        endDate: dateRange.end,
    });

    // Generate calendar days
    const calendarDays = useMemo((): CalendarDay[] => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        const startDay = firstDayOfMonth.getDay();
        const daysInMonth = lastDayOfMonth.getDate();

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const days: CalendarDay[] = [];

        // Previous month days
        const prevMonth = new Date(year, month, 0);
        const prevMonthDays = prevMonth.getDate();
        for (let i = startDay - 1; i >= 0; i--) {
            const date = new Date(year, month - 1, prevMonthDays - i);
            days.push({
                date,
                isCurrentMonth: false,
                isToday: date.getTime() === today.getTime(),
                events: getEventsForDate(date, schedule),
            });
        }

        // Current month days
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            days.push({
                date,
                isCurrentMonth: true,
                isToday: date.getTime() === today.getTime(),
                events: getEventsForDate(date, schedule),
            });
        }

        // Next month days (fill to 42 cells = 6 weeks)
        const remainingDays = 42 - days.length;
        for (let i = 1; i <= remainingDays; i++) {
            const date = new Date(year, month + 1, i);
            days.push({
                date,
                isCurrentMonth: false,
                isToday: date.getTime() === today.getTime(),
                events: getEventsForDate(date, schedule),
            });
        }

        return days;
    }, [currentDate, schedule]);

    // Get events for specific date
    function getEventsForDate(date: Date, events: ScheduleEvent[]): ScheduleEvent[] {
        const dateStr = date.toISOString().slice(0, 10);
        return events.filter(event => {
            const startDate = safeIsoDay(event.dateStart);
            const endDate = safeIsoDay(event.deadline) || startDate;
            if (!startDate || !endDate) return false;
            return dateStr >= startDate && dateStr <= endDate;
        });
    }

    // Navigation handlers
    const goToPreviousMonth = useCallback(() => {
        setCurrentDate((prev: Date) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    }, []);

    const goToNextMonth = useCallback(() => {
        setCurrentDate((prev: Date) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    }, []);

    const goToToday = useCallback(() => {
        setCurrentDate(new Date());
        setSelectedDate(new Date());
    }, []);

    // Jump to event date
    const jumpToEvent = useCallback((event: ScheduleEvent) => {
        const eventDate = new Date(event.dateStart);
        setCurrentDate(new Date(eventDate.getFullYear(), eventDate.getMonth(), 1));
        setSelectedDate(eventDate);
        setShowEventJump(false);
    }, []);

    // Sorted events for jump menu
    const sortedUpcomingEvents = useMemo(() => {
        if (!showEventJump) return [];
        const nowMs = Date.now();
        return [...jumpEvents]
            .filter(e => (safeParseMs(e.deadline) ?? safeParseMs(e.dateStart) ?? 0) >= nowMs) // upcoming/ongoing
            .sort((a, b) => (safeParseMs(a.dateStart) ?? 0) - (safeParseMs(b.dateStart) ?? 0))
            .slice(0, 50);
    }, [jumpEvents, showEventJump]);

    const pastEvents = useMemo(() => {
        if (!showEventJump) return [];
        const nowMs = Date.now();
        return [...jumpEvents]
            .filter(e => (safeParseMs(e.deadline) ?? safeParseMs(e.dateStart) ?? 0) < nowMs)
            .sort((a, b) => (safeParseMs(b.dateStart) ?? 0) - (safeParseMs(a.dateStart) ?? 0))
            .slice(0, 5);
    }, [jumpEvents, showEventJump]);

    // Get selected date events
    const selectedDateEvents = useMemo(() => {
        if (!selectedDate) return [];
        return getEventsForDate(selectedDate, schedule);
    }, [selectedDate, schedule]);

    // Format date for display
    const formatEventDate = (dateStr: string) => {
        const ms = safeParseMs(dateStr);
        if (!ms) return '—';
        const date = new Date(ms);
        return date.toLocaleDateString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit'
        });
    };

    // Get status color
    const getStatusColor = (status: string, type?: string) => {
        // Different colors for courses
        if (type === 'course') {
            return 'bg-blue-500';
        }
        switch (status) {
            case 'OPEN': return 'bg-emerald-500';
            case 'FULL': return 'bg-amber-500';
            case 'CLOSED': return 'bg-slate-400';
            default: return 'bg-primary-500';
        }
    };

    if (error) {
        return (
            <Card className={`p-6 ${className}`}>
                <div className="text-center py-8">
                    <p className="text-red-500 mb-4">{error}</p>
                    <Button onClick={() => refetch()}>Thử lại</Button>
                </div>
            </Card>
        );
    }

    return (
        <Card className={`overflow-hidden ${className}`}>
            {/* Header */}
            <div className="p-4 border-b border-slate-100 bg-linear-to-r from-primary-50 to-white">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <CalendarIcon className="w-5 h-5 text-primary-600" />
                        <h3 className="font-bold text-slate-900">Lịch thi đấu</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Jump to Event Button */}
                        <div className="relative" ref={eventJumpRef}>
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setShowEventJump(!showEventJump)}
                                className="flex items-center gap-1"
                            >
                                <Zap className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Chuyển nhanh</span>
                                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showEventJump ? 'rotate-180' : ''}`} />
                            </Button>

                            {/* Event Jump Dropdown */}
                            {showEventJump && (
                                <>
                                    <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 z-20 max-h-80 overflow-hidden">
                                        <div className="p-3 border-b border-slate-100 bg-slate-50">
                                            <h4 className="font-semibold text-sm text-slate-700 flex items-center gap-2">
                                                <Zap className="w-4 h-4 text-primary-500" />
                                                Chuyển nhanh đến sự kiện
                                            </h4>
                                        </div>

                                        <div className="overflow-y-auto max-h-60">
                                            {jumpError ? (
                                                <div className="p-4 text-center">
                                                    <p className="text-sm text-red-600 mb-3">{jumpError}</p>
                                                    <Button size="sm" variant="secondary" onClick={() => triggerJumpFetch()}>
                                                        Th? l?i
                                                    </Button>
                                                </div>
                                            ) : isJumpLoading ? (
                                                <div className="flex items-center justify-center py-10">
                                                    <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                                                </div>
                                            ) : (
                                                <>
                                                    {/* Upcoming Events */}
                                            {sortedUpcomingEvents.length > 0 && (
                                                <div className="p-2">
                                                    <p className="text-xs font-medium text-emerald-600 px-2 py-1">
                                                        📅 Sắp diễn ra ({sortedUpcomingEvents.length})
                                                    </p>
                                                    {sortedUpcomingEvents.map(event => (
                                                        <button
                                                            key={event.id}
                                                            onClick={() => jumpToEvent(event)}
                                                            className="w-full text-left p-2 hover:bg-primary-50 rounded-lg transition-colors group"
                                                        >
                                                            <div className="flex items-start gap-2">
                                                                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${getStatusColor(event.status, event.type)}`} />
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-sm font-medium text-slate-800 truncate group-hover:text-primary-700">
                                                                        {event.title}
                                                                    </p>
                                                                    <p className="text-xs text-slate-500">
                                                                        {new Date(event.dateStart).toLocaleDateString('vi-VN', {
                                                                            day: '2-digit',
                                                                            month: '2-digit',
                                                                            year: 'numeric'
                                                                        })}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Past Events */}
                                            {pastEvents.length > 0 && (
                                                <div className="p-2 border-t border-slate-100">
                                                    <p className="text-xs font-medium text-slate-400 px-2 py-1">
                                                        📋 Đã qua
                                                    </p>
                                                    {pastEvents.map(event => (
                                                        <button
                                                            key={event.id}
                                                            onClick={() => jumpToEvent(event)}
                                                            className="w-full text-left p-2 hover:bg-slate-50 rounded-lg transition-colors group opacity-70"
                                                        >
                                                            <div className="flex items-start gap-2">
                                                                <div className="w-2 h-2 rounded-full mt-1.5 shrink-0 bg-slate-300" />
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-sm text-slate-600 truncate">
                                                                        {event.title}
                                                                    </p>
                                                                    <p className="text-xs text-slate-400">
                                                                        {new Date(event.dateStart).toLocaleDateString('vi-VN', {
                                                                            day: '2-digit',
                                                                            month: '2-digit',
                                                                            year: 'numeric'
                                                                        })}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}

                                            {sortedUpcomingEvents.length === 0 && pastEvents.length === 0 && (
                                                <div className="p-4 text-center text-sm text-slate-500">
                                                    Chưa có sự kiện nào được đăng ký
                                                </div>
                                            )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <Button size="sm" variant="secondary" onClick={goToToday}>
                            Hôm nay
                        </Button>
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <button
                        onClick={goToPreviousMonth}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        aria-label="Tháng trước"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <h4 className="text-lg font-semibold text-slate-900">
                        {MONTHS_VI[currentDate.getMonth()]} {currentDate.getFullYear()}
                    </h4>
                    <button
                        onClick={goToNextMonth}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        aria-label="Tháng sau"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="p-4">
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
                    </div>
                ) : (
                    <>
                        {/* Day Headers */}
                        <div className="grid grid-cols-7 mb-2">
                            {DAYS_VI.map(day => (
                                <div key={day} className="text-center text-xs font-semibold text-slate-500 py-2">
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* Calendar Days */}
                        <div className="grid grid-cols-7 gap-1">
                            {calendarDays.map((day, index) => {
                                const isSelected = selectedDate &&
                                    day.date.toDateString() === selectedDate.toDateString();
                                const hasEvents = day.events.length > 0;

                                return (
                                    <button
                                        key={index}
                                        onClick={() => setSelectedDate(day.date)}
                                        className={`
                      relative p-2 min-h-12 rounded-lg text-sm transition-all
                      ${day.isCurrentMonth ? 'text-slate-900' : 'text-slate-400'}
                      ${day.isToday ? 'bg-primary-100 font-bold' : ''}
                      ${isSelected ? 'ring-2 ring-primary-500 bg-primary-50' : 'hover:bg-slate-50'}
                    `}
                                    >
                                        <span className={day.isToday ? 'text-primary-600' : ''}>
                                            {day.date.getDate()}
                                        </span>

                                        {/* Event indicators */}
                                        {hasEvents && (
                                            <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 flex gap-0.5">
                                                {day.events.slice(0, 3).map((event, i) => (
                                                    <div
                                                        key={i}
                                                        className={`w-1.5 h-1.5 rounded-full ${getStatusColor(event.status, event.type)}`}
                                                        title={event.title}
                                                    />
                                                ))}
                                                {day.events.length > 3 && (
                                                    <span className="text-[8px] text-slate-500">+{day.events.length - 3}</span>
                                                )}
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>

            {/* Selected Date Events */}
            {selectedDate && (
                <div className="border-t border-slate-100 p-4 bg-slate-50">
                    <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-primary-600" />
                        Sự kiện ngày {selectedDate.toLocaleDateString('vi-VN')}
                    </h4>

                    {selectedDateEvents.length === 0 ? (
                        <p className="text-sm text-slate-500 text-center py-4">
                            Không có sự kiện nào trong ngày này
                        </p>
                    ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                            {selectedDateEvents.map(event => (
                                <div
                                    key={event.id}
                                    onClick={() => onEventClick?.(event)}
                                    className="p-3 bg-white rounded-lg border border-slate-100 hover:border-primary-200 hover:shadow-sm transition-all cursor-pointer"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <h5 className="font-medium text-slate-900 text-sm truncate">
                                                {event.title}
                                            </h5>
                                            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {formatEventDate(event.dateStart)} - {formatEventDate(event.deadline)}
                                            </p>
                                            <p className="text-xs text-slate-500 flex items-center gap-1">
                                                <MapPin className="w-3 h-3" />
                                                {event.organizer}
                                            </p>
                                        </div>
                                        <Badge
                                            status={event.status as 'OPEN' | 'FULL' | 'CLOSED'}
                                            className="text-xs shrink-0"
                                        >
                                            {event.status}
                                        </Badge>
                                    </div>
                                    {event.tags.length > 0 && (
                                        <div className="flex gap-1 mt-2 flex-wrap">
                                            {event.tags.slice(0, 2).map(tag => (
                                                <span
                                                    key={tag}
                                                    className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded"
                                                >
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Legend */}
            <div className="px-4 py-3 border-t border-slate-100 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" /> Cuộc thi đang mở
                </span>
                <span className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-amber-500" /> Sắp diễn ra
                </span>
                <span className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-blue-500" /> Khóa học
                </span>
                <span className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-slate-400" /> Đã kết thúc
                </span>
            </div>
        </Card>
    );
};

export default ScheduleCalendar;

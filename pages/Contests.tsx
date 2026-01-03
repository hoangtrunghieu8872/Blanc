import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Filter, Calendar, MapPin, Tag, Share2, Award, Users, CheckCircle, Loader2, X, Clock, CalendarPlus, Copy, Check, Star } from 'lucide-react';
import { Button, Input, Card, Badge, Tabs, Dropdown } from '../components/ui/Common';
import { useContests, useDebounce, useUserRegistrations } from '../lib/hooks';
import { API_BASE_URL } from '../lib/api';
import { Contest } from '../types';
import OptimizedImage from '../components/OptimizedImage';
import Pagination from '../components/Pagination';
import Reviews from '../components/Reviews';
import toast from 'react-hot-toast';
import { CONTEST_CATEGORIES, ContestCategoryValue } from '../constants/contestCategories';

// Helper functions
const formatPrice = (price: number) => {
  if (price === 0) return 'Miễn phí';
  return price.toLocaleString('vi-VN') + 'đ';
};

const getRemainingDays = (deadline: string) => {
  const diff = new Date(deadline).getTime() - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return 'Đã kết thúc';
  if (days === 0) return 'Hôm nay';
  return `Còn ${days} ngày`;
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('vi-VN');
};

const STATUS_MAP: Record<string, string> = {
  'OPEN': 'Đang mở đăng ký',
  'FULL': 'Sắp diễn ra',
  'CLOSED': 'Đã kết thúc',
};

const CATEGORY_LABELS: Record<string, string> = {
  'it': 'IT & Tech',
  'it & tech': 'IT & Tech',
  'it & tech (hackathon, coding, ai/ml)': 'IT & Tech',
  'hackathon': 'IT & Tech',
  'coding': 'IT & Tech',
  'coding contest': 'IT & Tech',
  'ai/ml': 'IT & Tech',
  'ai': 'IT & Tech',
  'ml': 'IT & Tech',
  'programming': 'IT & Tech',
  'data': 'Data & Analytics',
  'data & analytics': 'Data & Analytics',
  'analytics': 'Data & Analytics',
  'data science': 'Data & Analytics',
  'cyber': 'Cybersecurity',
  'cybersecurity': 'Cybersecurity',
  'security': 'Cybersecurity',
  'infosec': 'Cybersecurity',
  'robotics': 'Robotics & IoT',
  'robot': 'Robotics & IoT',
  'iot': 'Robotics & IoT',
  'embedded': 'Robotics & IoT',
  'hardware': 'Robotics & IoT',
  'design': 'Design / UI-UX',
  'ui': 'Design / UI-UX',
  'ux': 'Design / UI-UX',
  'ui/ux': 'Design / UI-UX',
  'product design': 'Design / UI-UX',
  'business': 'Business & Strategy',
  'strategy': 'Business & Strategy',
  'case study': 'Business & Strategy',
  'management': 'Business & Strategy',
  'startup': 'Startup & Innovation',
  'innovation': 'Startup & Innovation',
  'pitch': 'Startup & Innovation',
  'entrepreneurship': 'Startup & Innovation',
  'marketing': 'Marketing & Growth',
  'growth': 'Marketing & Growth',
  'branding': 'Marketing & Growth',
  'brand': 'Marketing & Growth',
  'seo': 'Marketing & Growth',
  'ads': 'Marketing & Growth',
  'finance': 'Finance & Fintech',
  'fintech': 'Finance & Fintech',
  'investment': 'Finance & Fintech',
  'trading': 'Finance & Fintech',
  'health': 'Health & Biotech',
  'biotech': 'Health & Biotech',
  'medical': 'Health & Biotech',
  'med': 'Health & Biotech',
  'education': 'Education & EdTech',
  'edtech': 'Education & EdTech',
  'learning': 'Education & EdTech',
  'training': 'Education & EdTech',
  'sustainability': 'Sustainability & Environment',
  'environment': 'Sustainability & Environment',
  'green': 'Sustainability & Environment',
  'climate': 'Sustainability & Environment',
  'gaming': 'Gaming & Esports',
  'esports': 'Gaming & Esports',
  'game': 'Gaming & Esports',
  'research': 'Research & Science',
  'science': 'Research & Science',
  'other': 'Other',
};

const getCategoryLabel = (category?: string) => {
  if (!category) return '';
  const normalized = category.toLowerCase().trim();
  if (CATEGORY_LABELS[normalized]) return CATEGORY_LABELS[normalized];
  const hit = Object.entries(CATEGORY_LABELS).find(([key]) => normalized.includes(key));
  return hit ? hit[1] : category;
};


// --- CONTEST LIST COMPONENT ---
// Constants
const ITEMS_PER_PAGE = 6;

const ContestList: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // State
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [selectedCategories, setSelectedCategories] = useState<ContestCategoryValue[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Debounced search
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Fetch contests
  const { contests, isLoading, error, refetch } = useContests({ limit: 50 });

  // Filter contests locally
  const filteredContests = contests.filter(contest => {
    // Search filter
    if (debouncedSearch) {
      const query = debouncedSearch.toLowerCase();
      const matchesSearch =
        contest.title.toLowerCase().includes(query) ||
        contest.organizer.toLowerCase().includes(query) ||
        contest.category?.toLowerCase().includes(query) ||
        contest.description?.toLowerCase().includes(query) ||
        contest.tags?.some(tag => tag.toLowerCase().includes(query));
      if (!matchesSearch) return false;
    }

    // Category filter
    if (selectedCategories.length > 0) {
      const selectedLabels = new Set(selectedCategories.map((value) => getCategoryLabel(value)));
      const matchesCategory =
        (contest.category ? selectedLabels.has(getCategoryLabel(contest.category)) : false) ||
        (contest.tags ? contest.tags.some((tag) => selectedLabels.has(getCategoryLabel(tag))) : false);
      if (!matchesCategory) return false;
    }

    // Status filter
    if (selectedStatuses.length > 0 && !selectedStatuses.includes(contest.status)) {
      return false;
    }

    return true;
  });

  const statusCounts = useMemo(() => {
    return contests.reduce((acc, contest) => {
      if (!contest.status) return acc;
      acc[contest.status] = (acc[contest.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [contests]);

  // Pagination logic
  const totalPages = Math.ceil(filteredContests.length / ITEMS_PER_PAGE);

  // Get paginated contests
  const paginatedContests = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredContests.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredContests, currentPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedCategories, selectedStatuses]);

  // Reset to page 1 if current page exceeds total pages
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  const toggleCategory = (category: ContestCategoryValue) => {
    setSelectedCategories((prev) => (prev.length === 1 && prev[0] === category ? [] : [category]));
  };

  const toggleStatus = (status: string) => {
    setSelectedStatuses(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategories([]);
    setSelectedStatuses([]);
    setCurrentPage(1);
  };

  const hasActiveFilters = searchQuery || selectedCategories.length > 0 || selectedStatuses.length > 0;
  const openCount = statusCounts.OPEN ?? 0;
  const upcomingCount = statusCounts.FULL ?? 0;
  const closedCount = statusCounts.CLOSED ?? 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <section className="relative mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-primary-100/60">
        <div className="absolute inset-0 bg-linear-to-br from-primary-50 via-white to-amber-50 opacity-90" aria-hidden="true" />
        <div className="absolute -top-24 -right-16 h-48 w-48 rounded-full bg-primary-200/40 blur-3xl" aria-hidden="true" />
        <div className="absolute -bottom-28 -left-16 h-56 w-56 rounded-full bg-amber-200/50 blur-3xl" aria-hidden="true" />
        <div className="relative p-6 md:p-8 lg:p-10">
          <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-8 items-center">
            <div className="space-y-4 animate-fade-in-up">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/80 border border-white/70 text-xs font-semibold text-primary-700 shadow-sm">
                <Star className="w-3.5 h-3.5" />
                Sân chơi nổi bật
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight">
                Khám phá cuộc thi truyền cảm hứng cho mọi lĩnh vực
              </h2>
              <p className="text-sm md:text-base text-slate-600 leading-relaxed max-w-xl md:max-w-none md:whitespace-nowrap">
                Chọn cuộc thi phù hợp, theo dõi deadline và kết nối cùng mentor để bứt phá kỹ năng.
              </p>
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2 rounded-xl bg-white/90 border border-slate-100 px-3 py-2 text-xs text-slate-600 shadow-sm">
                  <Tag className="w-4 h-4 text-primary-500" />
                  Lọc theo lĩnh vực
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-white/90 border border-slate-100 px-3 py-2 text-xs text-slate-600 shadow-sm">
                  <Clock className="w-4 h-4 text-amber-500" />
                  Nhắc hạn đăng ký
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-white/90 border border-slate-100 px-3 py-2 text-xs text-slate-600 shadow-sm">
                  <Award className="w-4 h-4 text-emerald-500" />
                  Giải thưởng hấp dẫn
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-white/90 border border-slate-100 px-3 py-2 text-xs text-slate-600 shadow-sm">
                  <Users className="w-4 h-4 text-slate-600" />
                  Cộng đồng hỗ trợ
                </div>
              </div>
            </div>

            <div className="space-y-4 animate-fade-in-up">
              <div className="rounded-2xl border border-white/80 bg-white/80 p-5 shadow-md">
                <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">Tổng quan</div>
                <div className="mt-3 flex items-end gap-2">
                  <span className="text-3xl font-bold text-slate-900">{isLoading ? '--' : contests.length}</span>
                  <span className="text-sm text-slate-500">cuộc thi</span>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Cập nhật liên tục, luôn có sân chơi mới mỗi tuần.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-3">
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/80 px-4 py-3">
                  <div className="text-xs font-semibold text-emerald-700">Đang mở</div>
                  <div className="mt-1 text-2xl font-bold text-emerald-800">
                    {isLoading ? '--' : openCount}
                  </div>
                </div>
                <div className="rounded-xl border border-amber-100 bg-amber-50/80 px-4 py-3">
                  <div className="text-xs font-semibold text-amber-700">Sắp diễn ra</div>
                  <div className="mt-1 text-2xl font-bold text-amber-800">
                    {isLoading ? '--' : upcomingCount}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white/80 px-4 py-3">
                  <div className="text-xs font-semibold text-slate-600">Đã kết thúc</div>
                  <div className="mt-1 text-2xl font-bold text-slate-800">
                    {isLoading ? '--' : closedCount}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tất cả cuộc thi</h1>
          <p className="text-slate-500">
            {isLoading ? 'Đang tải...' : `${filteredContests.length} cuộc thi phù hợp`}
          </p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative grow md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Tìm kiếm..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-9 pr-9 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                title="Xóa tìm kiếm"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <Button
            variant={showFilters ? 'primary' : 'secondary'}
            className="px-3 lg:hidden"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4" />
          </Button>
          {hasActiveFilters && (
            <Button variant="ghost" className="text-red-500 hover:text-red-600" onClick={clearFilters}>
              Xóa bộ lọc
            </Button>
          )}
        </div>
      </div>

      {/* Category sort (synced from Admin) */}
      <div className="hidden flex flex-wrap justify-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => setSelectedCategories([])}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
            selectedCategories.length === 0
              ? 'bg-primary-600 text-white shadow-md'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Tất cả
        </button>
        {CONTEST_CATEGORIES.map((category) => {
          const isActive = selectedCategories.includes(category.value);
          return (
            <button
              key={category.value}
              type="button"
              title={category.label}
              aria-pressed={isActive}
              onClick={() => toggleCategory(category.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                isActive
                  ? 'bg-primary-600 text-white shadow-md'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {getCategoryLabel(category.value)}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Filters */}
        <aside className={`${showFilters ? 'block' : 'hidden'} lg:block space-y-6`}>
          <div>
            <h3 className="font-semibold text-slate-900 mb-3">Lĩnh vực</h3>
            <Dropdown
              value={selectedCategories[0] ?? ''}
              onChange={(value) => setSelectedCategories(value ? [value as ContestCategoryValue] : [])}
              placeholder="Tất cả"
              headerText="Chọn lĩnh vực"
              options={[
                { value: '', label: 'Tất cả' },
                ...CONTEST_CATEGORIES.map((category) => ({
                  value: category.value,
                  label: getCategoryLabel(category.value),
                })),
              ]}
            />
          </div>

          <div>
            <h3 className="font-semibold text-slate-900 mb-3">Trạng thái</h3>
            <div className="space-y-2">
              {Object.entries(STATUS_MAP).map(([status, label]) => (
                <label key={status} className="flex items-center space-x-2 text-sm text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedStatuses.includes(status)}
                    onChange={() => toggleStatus(status)}
                    className="rounded text-primary-600 focus:ring-primary-500"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>
        </aside>

        {/* List */}
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
          {isLoading ? (
            // Loading skeleton
            [...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <div className="h-48 bg-slate-200" />
                <div className="p-5">
                  <div className="flex justify-between mb-2">
                    <div className="h-5 w-16 bg-slate-200 rounded" />
                    <div className="h-4 w-20 bg-slate-100 rounded" />
                  </div>
                  <div className="h-6 w-full bg-slate-200 rounded mb-2" />
                  <div className="h-4 w-3/4 bg-slate-100 rounded mb-4" />
                  <div className="pt-4 border-t border-slate-100 flex gap-4">
                    <div className="h-4 w-24 bg-slate-100 rounded" />
                    <div className="h-4 w-20 bg-slate-100 rounded" />
                  </div>
                </div>
              </Card>
            ))
          ) : error ? (
            <div className="md:col-span-2 text-center py-12">
              <p className="text-red-500 mb-4">{error}</p>
              <Button onClick={refetch}>Thử lại</Button>
            </div>
          ) : filteredContests.length > 0 ? (
            <>
              {paginatedContests.map((contest) => (
                <Card
                  key={contest.id}
                  className="flex flex-col h-full cursor-pointer hover:border-primary-200"
                  onClick={() => navigate(`/contests/${contest.id}`)}
                >
                  <div className="relative h-48 w-full bg-slate-200">
                    <OptimizedImage
                      src={contest.image || `https://picsum.photos/seed/${contest.id}/600/400`}
                      alt={contest.title}
                      className="w-full h-full"
                      lazy={true}
                    />
                    <Badge className="absolute top-3 left-3" status={contest.status}>{contest.status}</Badge>
                  </div>
                  <div className="p-5 flex flex-col grow">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-primary-600 bg-primary-50 px-2 py-0.5 rounded">
                        {getCategoryLabel(contest.category || contest.tags?.[0] || 'General')}
                      </span>
                      <span className="text-xs text-slate-400">{getRemainingDays(contest.deadline)}</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2 line-clamp-2">{contest.title}</h3>
                    <p className="text-sm text-slate-500 mb-4 line-clamp-2 grow">
                      {contest.description || 'Tham gia để trải nghiệm và phát triển kỹ năng của bạn.'}
                    </p>

                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center"><Calendar className="w-3 h-3 mr-1" /> {formatDate(contest.dateStart)}</div>
                        <div className="flex items-center"><Users className="w-3 h-3 mr-1" /> {contest.organizer}</div>
                      </div>
                      <span className="font-medium text-slate-900">{formatPrice(contest.fee)}</span>
                    </div>
                  </div>
                </Card>
              ))}

              {/* Pagination */}
              <div className="md:col-span-2">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              </div>
            </>
          ) : (
            <div className="md:col-span-2 text-center py-12">
              <Search className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p className="text-slate-500 mb-2">Không tìm thấy cuộc thi nào</p>
              <p className="text-sm text-slate-400 mb-4">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
              {hasActiveFilters && (
                <Button variant="secondary" onClick={clearFilters}>Xóa bộ lọc</Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- CONTEST DETAIL COMPONENT ---
const ContestDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Tổng quan');
  const [contest, setContest] = useState<Contest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Registration state
  const [isRegistering, setIsRegistering] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // User registrations hook
  const { registrations, registerForContest, cancelRegistration, refetch: refetchRegistrations } = useUserRegistrations({ autoFetch: true });

  // Check if user is already registered
  useEffect(() => {
    if (id && registrations.length > 0) {
      const registered = registrations.some(reg => reg.contestId === id);
      setIsRegistered(registered);
    }
  }, [id, registrations]);

  // Fetch contest details
  useEffect(() => {
    const fetchContest = async () => {
      if (!id) return;
      setIsLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/contests/${id}`);
        if (!response.ok) throw new Error('Contest not found');
        const data = await response.json();
        setContest(data.contest);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không thể tải cuộc thi');
      } finally {
        setIsLoading(false);
      }
    };
    fetchContest();
  }, [id]);

  // Generate iCal/ICS file for calendar
  const generateICSFile = useCallback((contest: Contest) => {
    const formatICSDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const escapeICS = (str: string) => {
      return str.replace(/[,;\\]/g, '\\$&').replace(/\n/g, '\\n');
    };

    const startDate = formatICSDate(contest.dateStart);
    const endDate = contest.deadline ? formatICSDate(contest.deadline) : formatICSDate(contest.dateStart);
    const now = formatICSDate(new Date().toISOString());

    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//ContestHub//Contest Calendar//VI
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
DTSTART:${startDate}
DTEND:${endDate}
DTSTAMP:${now}
UID:contest-${contest.id}@contesthub.vn
SUMMARY:${escapeICS(contest.title)}
DESCRIPTION:${escapeICS(contest.description || 'Tham gia cuộc thi trên ContestHub')}\\n\\nBan tổ chức: ${escapeICS(contest.organizer)}\\nPhí tham gia: ${contest.fee === 0 ? 'Miễn phí' : contest.fee.toLocaleString('vi-VN') + 'đ'}
LOCATION:${escapeICS(contest.location || 'Online')}
STATUS:CONFIRMED
ORGANIZER:CN=${escapeICS(contest.organizer)}
URL:${window.location.href}
BEGIN:VALARM
TRIGGER:-P1D
ACTION:DISPLAY
DESCRIPTION:Nhắc nhở: ${escapeICS(contest.title)} sẽ bắt đầu vào ngày mai!
END:VALARM
BEGIN:VALARM
TRIGGER:-PT1H
ACTION:DISPLAY
DESCRIPTION:Nhắc nhở: ${escapeICS(contest.title)} sẽ bắt đầu trong 1 giờ nữa!
END:VALARM
END:VEVENT
END:VCALENDAR`;

    return icsContent;
  }, []);

  // Download calendar file
  const downloadCalendarFile = useCallback((contest: Contest) => {
    const icsContent = generateICSFile(contest);
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${contest.title.replace(/[^a-zA-Z0-9]/g, '_')}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [generateICSFile]);

  // Handle registration
  const handleRegister = async () => {
    if (!id || !contest) return;

    // Check if user is logged in
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      toast.error('Vui lòng đăng nhập để đăng ký cuộc thi');
      navigate('/auth?redirect=' + encodeURIComponent(window.location.pathname));
      return;
    }

    setIsRegistering(true);
    try {
      const result = await registerForContest(id);
      setIsRegistered(true);

      // Show success message
      toast.success(result.message || 'Đăng ký thành công!');

      // Show warning if any
      if (result.warning) {
        toast(result.warning, { icon: '⚠️', duration: 5000 });
      }

      // Download calendar file automatically
      downloadCalendarFile(contest);
      toast.success('Đã thêm vào lịch của bạn!', { icon: '📅' });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Đăng ký thất bại';
      toast.error(errorMessage);
    } finally {
      setIsRegistering(false);
    }
  };

  // Handle cancel registration
  const handleCancelRegistration = async () => {
    if (!id) return;

    setIsRegistering(true);
    try {
      await cancelRegistration(id);
      setIsRegistered(false);
      toast.success('Đã hủy đăng ký');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Hủy đăng ký thất bại';
      toast.error(errorMessage);
    } finally {
      setIsRegistering(false);
    }
  };

  // Handle share
  const handleShare = async () => {
    if (!contest) return;

    const shareUrl = window.location.href;
    const shareData = {
      title: contest.title,
      text: `Tham gia cuộc thi "${contest.title}" - Ban tổ chức: ${contest.organizer}`,
      url: shareUrl,
    };

    // Try native Web Share API first
    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        toast.success('Đã chia sẻ thành công!');
      } catch (err) {
        // User cancelled or share failed - fallback to copy
        if ((err as Error).name !== 'AbortError') {
          copyToClipboard(shareUrl);
        }
      }
    } else {
      // Fallback to clipboard copy
      copyToClipboard(shareUrl);
    }
  };

  // Copy URL to clipboard
  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setIsCopied(true);
      toast.success('Đã sao chép liên kết!');
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = url;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setIsCopied(true);
        toast.success('Đã sao chép liên kết!');
        setTimeout(() => setIsCopied(false), 2000);
      } catch (e) {
        toast.error('Không thể sao chép liên kết');
      }
      document.body.removeChild(textArea);
    }
  };

  const getLocationTypeLabel = (type?: string) => {
    switch (type) {
      case 'online': return 'Online';
      case 'offline': return 'Offline';
      case 'hybrid': return 'Hybrid';
      default: return 'Online';
    }
  };

  const getPrizeColor = (rank: number) => {
    switch (rank) {
      case 1: return 'bg-amber-50 border-amber-100';
      case 2: return 'bg-slate-50 border-slate-200';
      case 3: return 'bg-orange-50 border-orange-100';
      default: return 'bg-slate-50 border-slate-200';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error || !contest) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <p className="text-red-500 mb-4">{error || 'Không tìm thấy cuộc thi'}</p>
        <Button onClick={() => navigate('/contests')}>Quay lại</Button>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen pb-16">
      {/* Banner */}
      <div className="h-64 md:h-80 w-full relative bg-slate-900">
        <OptimizedImage
          src={contest.image || `https://picsum.photos/seed/c${id}/1200/600`}
          alt={contest.title}
          className="w-full h-full opacity-60"
          lazy={false}
        />
        <div className="absolute inset-0 bg-linear-to-t from-slate-900/80 to-transparent" />
        <div className="absolute bottom-0 left-0 w-full p-6 md:p-10">
          <div className="max-w-7xl mx-auto">
            {contest.category && (
              <Badge className="mb-3 bg-white/20 text-white backdrop-blur-sm border-0 capitalize">
                {getCategoryLabel(contest.category)}
              </Badge>
            )}
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">{contest.title}</h1>
            <div className="flex flex-wrap items-center gap-6 text-slate-200 text-sm">
              <span className="flex items-center">
                <Calendar className="w-4 h-4 mr-2" />
                {formatDate(contest.dateStart)} - {formatDate(contest.deadline)}
              </span>
              <span className="flex items-center">
                <MapPin className="w-4 h-4 mr-2" />
                {contest.location || getLocationTypeLabel(contest.locationType)}
              </span>
              <span className="flex items-center">
                <Users className="w-4 h-4 mr-2" />
                Ban tổ chức: {contest.organizer}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Main Content */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 min-h-[500px]">
            <Tabs
              tabs={['Tổng quan', 'Giải thưởng', 'Thể lệ', 'Lịch trình', 'Đánh giá']}
              activeTab={activeTab}
              onChange={setActiveTab}
            />

            <div className="prose prose-slate max-w-none">
              {activeTab === 'Tổng quan' && (
                <div>
                  {contest.description && (
                    <div className="mb-6">
                      <p className="lead text-lg text-slate-600 whitespace-pre-wrap">{contest.description}</p>
                    </div>
                  )}

                  {contest.objectives && (
                    <>
                      <h3 className="text-xl font-bold text-slate-900 mb-2">Mục tiêu</h3>
                      <p className="text-slate-600 mb-4 whitespace-pre-wrap">{contest.objectives}</p>
                    </>
                  )}

                  {contest.eligibility && (
                    <>
                      <h3 className="text-xl font-bold text-slate-900 mb-2">Đối tượng tham gia</h3>
                      <p className="text-slate-600 mb-4 whitespace-pre-wrap">{contest.eligibility}</p>
                    </>
                  )}

                  {!contest.description && !contest.objectives && !contest.eligibility && (
                    <p className="text-slate-500 italic">Chưa có thông tin chi tiết về cuộc thi này.</p>
                  )}
                </div>
              )}

              {activeTab === 'Giải thưởng' && (
                <div className="grid gap-4">
                  {contest.prizes && contest.prizes.length > 0 ? (
                    contest.prizes.map((prize, index) => (
                      <div key={index} className={`${getPrizeColor(prize.rank)} border p-4 rounded-lg flex items-center`}>
                        <div className={`${prize.rank === 1 ? 'bg-amber-100' : 'bg-slate-200'} p-3 rounded-full mr-4`}>
                          <Award className={`w-6 h-6 ${prize.rank === 1 ? 'text-amber-600' : 'text-slate-600'}`} />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{prize.title}</div>
                          <div className="text-slate-600">{prize.value}</div>
                          {prize.description && (
                            <div className="text-sm text-slate-500 mt-1">{prize.description}</div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-500 italic">Chưa có thông tin về giải thưởng.</p>
                  )}
                </div>
              )}

              {activeTab === 'Thể lệ' && (
                <div>
                  {contest.rules ? (
                    <div className="whitespace-pre-wrap text-slate-600">{contest.rules}</div>
                  ) : (
                    <p className="text-slate-500 italic">Chưa có thông tin về thể lệ cuộc thi.</p>
                  )}
                </div>
              )}

              {activeTab === 'Lịch trình' && (
                <div>
                  {contest.schedule && contest.schedule.length > 0 ? (
                    <div className="space-y-4">
                      {contest.schedule.map((item, index) => (
                        <div key={index} className="flex gap-4 p-4 bg-slate-50 rounded-lg">
                          <div className="shrink-0">
                            <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                              <Calendar className="w-6 h-6 text-primary-600" />
                            </div>
                          </div>
                          <div>
                            <div className="text-sm text-slate-500">{formatDate(item.date)}</div>
                            <div className="font-semibold text-slate-900">{item.title}</div>
                            {item.description && (
                              <div className="text-sm text-slate-600 mt-1">{item.description}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 italic">Chưa có lịch trình chi tiết.</p>
                  )}
                </div>
              )}

              {activeTab === 'Đánh giá' && (
                <Reviews
                  targetType="contest"
                  targetId={id!}
                  targetTitle={contest.title}
                  canReview={isRegistered}
                  showTitle={true}
                />
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Actions */}
        <div className="space-y-6">
          <Card className="p-6 sticky top-24">
            <div className="flex justify-between items-center mb-6">
              <span className="text-slate-500">Phí tham gia</span>
              <span className="text-2xl font-bold text-primary-600">{formatPrice(contest.fee)}</span>
            </div>

            {/* Register Button */}
            {isRegistered ? (
              <div className="space-y-3 mb-3">
                <div className="flex items-center justify-center gap-2 py-3 px-4 bg-green-50 text-green-700 rounded-lg border border-green-200">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">Đã đăng ký</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    className="flex-1 flex items-center justify-center"
                    onClick={() => downloadCalendarFile(contest)}
                  >
                    <CalendarPlus className="w-4 h-4 mr-2" /> Thêm vào lịch
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={handleCancelRegistration}
                    disabled={isRegistering}
                  >
                    {isRegistering ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Hủy'}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                className="w-full mb-3"
                size="lg"
                onClick={handleRegister}
                disabled={isRegistering || contest.status === 'CLOSED'}
              >
                {isRegistering ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Đang đăng ký...
                  </>
                ) : contest.status === 'CLOSED' ? (
                  'Đã kết thúc'
                ) : (
                  <>
                    <CalendarPlus className="w-4 h-4 mr-2" />
                    Đăng ký ngay
                  </>
                )}
              </Button>
            )}

            {/* Share Button */}
            <Button
              variant="secondary"
              className="w-full flex items-center justify-center"
              onClick={handleShare}
            >
              {isCopied ? (
                <>
                  <Check className="w-4 h-4 mr-2 text-green-600" />
                  Đã sao chép!
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4 mr-2" />
                  Chia sẻ
                </>
              )}
            </Button>

            {contest.tags && contest.tags.length > 0 && (
              <div className="mt-6 pt-6 border-t border-slate-100 space-y-4">
                <h4 className="font-semibold text-slate-900 text-sm">Tags</h4>
                <div className="flex flex-wrap gap-2">
                  {contest.tags.map((tag, index) => (
                    <span key={index} className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs">#{tag}</span>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {(contest.organizerDetails?.name || contest.organizer) && (
            <Card className="p-6">
              <h4 className="font-semibold text-slate-900 mb-4">Đơn vị tổ chức</h4>
              <div className="flex items-center space-x-3">
                {contest.organizerDetails?.logo ? (
                  <img
                    src={contest.organizerDetails.logo}
                    alt={contest.organizerDetails.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center">
                    <Users className="w-6 h-6 text-slate-400" />
                  </div>
                )}
                <div>
                  <div className="font-medium text-slate-900">
                    {contest.organizerDetails?.name || contest.organizer}
                  </div>
                  {contest.organizerDetails?.school && (
                    <div className="text-xs text-slate-500">{contest.organizerDetails.school}</div>
                  )}
                </div>
              </div>
              {contest.organizerDetails?.description && (
                <p className="text-sm text-slate-600 mt-3">{contest.organizerDetails.description}</p>
              )}
              {contest.organizerDetails?.website && (
                <a
                  href={contest.organizerDetails.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary-600 hover:underline mt-2 inline-block"
                >
                  Xem trang web →
                </a>
              )}
            </Card>
          )}
        </div>

      </div>
    </div>
  );
};

export { ContestList, ContestDetail };

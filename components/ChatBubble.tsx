import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, Sparkles, User, Bot, ChevronDown, Loader2, AlertCircle, Trash2, Users, Trophy, ExternalLink, MapPin, Clock } from 'lucide-react';
import { api } from '../lib/api';

// ============ TYPES ============
interface TeamPost {
    id: string;
    title: string;
    rolesNeeded: string[];
    maxMembers: number;
    currentMembers: number;
    description?: string;
    isExpired?: boolean;
}

interface Teammate {
    id: string;
    name: string;
    role: string;
    skills: string[];
    experience?: string;
    location?: string;
    matchScore?: number;
}

interface Contest {
    id: string;
    title: string;
    organizer: string;
    deadline: string;
    tags: string[];
    fee?: number;
}

interface ChatData {
    teamPosts?: TeamPost[];
    teammates?: Teammate[];
    contests?: Contest[];
}

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    data?: ChatData;
}

interface Suggestion {
    id: string;
    text: string;
    icon: string;
}

interface ChatResponse {
    response: string;
    intent: string;
    suggestions: string[];
    data?: ChatData;
}

// ============ CONSTANTS ============

const DEFAULT_SUGGESTIONS: Suggestion[] = [
    { id: 'find_contest', text: 'Cuộc thi nào phù hợp với tôi?', icon: '🏆' },
    { id: 'find_teammate', text: 'Tìm đồng đội ăn ý', icon: '👥' },
    { id: 'getting_started', text: 'Tôi muốn tham gia cuộc thi nhưng chưa biết bắt đầu từ đâu', icon: '🚀' }
];

const MAX_MESSAGE_LENGTH = 500;
const MAX_HISTORY_LENGTH = 20;

// ============ HELPERS ============
function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function formatTime(date: Date): string {
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function sanitizeInput(input: string): string {
    return input.trim().slice(0, MAX_MESSAGE_LENGTH);
}

// ============ COMPONENTS ============

// Team Post Card Component
const TeamPostCard: React.FC<{ post: TeamPost }> = ({ post }) => {
    const handleViewMore = () => {
        window.open(`/community?post=${post.id}`, '_blank');
    };

    return (
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-slate-800 text-sm line-clamp-1">{post.title}</h4>
                    {post.description && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{post.description}</p>
                    )}
                </div>
                {post.isExpired && (
                    <span className="shrink-0 px-2 py-0.5 bg-orange-100 text-orange-600 text-xs rounded-full">
                        Hết hạn
                    </span>
                )}
            </div>

            <div className="mt-2 flex flex-wrap gap-1">
                {post.rolesNeeded.slice(0, 3).map((role, i) => (
                    <span key={i} className="px-2 py-0.5 bg-primary-50 text-primary-700 text-xs rounded-full">
                        {role}
                    </span>
                ))}
                {post.rolesNeeded.length > 3 && (
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full">
                        +{post.rolesNeeded.length - 3}
                    </span>
                )}
            </div>

            <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Users className="w-3 h-3" />
                    <span>{post.currentMembers}/{post.maxMembers}</span>
                </div>
                <button
                    onClick={handleViewMore}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
                >
                    Xem thêm
                    <ExternalLink className="w-3 h-3" />
                </button>
            </div>
        </div>
    );
};

// Teammate Card Component
const TeammateCard: React.FC<{ teammate: Teammate }> = ({ teammate }) => {
    const handleViewProfile = () => {
        window.open(`/profile/${teammate.id}`, '_blank');
    };

    return (
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-linear-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-white text-xs font-medium">
                    {teammate.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-slate-800 text-sm truncate">{teammate.name}</h4>
                    <p className="text-xs text-slate-500">{teammate.role}</p>
                </div>
                {teammate.matchScore && (
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                        {teammate.matchScore}%
                    </span>
                )}
            </div>

            <div className="mt-2 flex flex-wrap gap-1">
                {teammate.skills.slice(0, 3).map((skill, i) => (
                    <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full">
                        {skill}
                    </span>
                ))}
            </div>

            {(teammate.location || teammate.experience) && (
                <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                    {teammate.location && (
                        <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {teammate.location}
                        </span>
                    )}
                    {teammate.experience && (
                        <span>{teammate.experience}</span>
                    )}
                </div>
            )}

            <button
                onClick={handleViewProfile}
                className="mt-2 w-full flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
            >
                Xem hồ sơ
                <ExternalLink className="w-3 h-3" />
            </button>
        </div>
    );
};

// Contest Card Component  
const ContestCard: React.FC<{ contest: Contest }> = ({ contest }) => {
    const handleViewContest = () => {
        window.open(`/contests?id=${contest.id}`, '_blank');
    };

    return (
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start gap-2">
                <div className="w-8 h-8 bg-linear-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center">
                    <Trophy className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-slate-800 text-sm line-clamp-1">{contest.title}</h4>
                    <p className="text-xs text-slate-500">{contest.organizer}</p>
                </div>
            </div>

            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                <Clock className="w-3 h-3" />
                <span>Hạn: {new Date(contest.deadline).toLocaleDateString('vi-VN')}</span>
                {contest.fee !== undefined && (
                    <span className={`ml-auto px-2 py-0.5 rounded-full ${contest.fee > 0 ? 'bg-slate-100 text-slate-600' : 'bg-green-100 text-green-600'}`}>
                        {contest.fee > 0 ? `${contest.fee.toLocaleString()}đ` : 'Miễn phí'}
                    </span>
                )}
            </div>

            <div className="mt-2 flex flex-wrap gap-1">
                {contest.tags.slice(0, 3).map((tag, i) => (
                    <span key={i} className="px-2 py-0.5 bg-amber-50 text-amber-700 text-xs rounded-full">
                        {tag}
                    </span>
                ))}
            </div>

            <button
                onClick={handleViewContest}
                className="mt-2 w-full flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
            >
                Xem cuộc thi
                <ExternalLink className="w-3 h-3" />
            </button>
        </div>
    );
};

// Data Cards Container
const DataCards: React.FC<{ data?: ChatData }> = ({ data }) => {
    if (!data) return null;

    const hasTeamPosts = data.teamPosts && data.teamPosts.length > 0;
    const hasTeammates = data.teammates && data.teammates.length > 0;
    const hasContests = data.contests && data.contests.length > 0;

    if (!hasTeamPosts && !hasTeammates && !hasContests) return null;

    return (
        <div className="mt-3 space-y-3">
            {/* Team Posts */}
            {hasTeamPosts && (
                <div>
                    <p className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        Bài đăng tìm đội ({data.teamPosts!.length})
                    </p>
                    <div className="space-y-2">
                        {data.teamPosts!.slice(0, 3).map(post => (
                            <TeamPostCard key={post.id} post={post} />
                        ))}
                    </div>
                    {data.teamPosts!.length > 3 && (
                        <button
                            onClick={() => window.open('/community', '_blank')}
                            className="mt-2 w-full py-2 text-xs text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
                        >
                            Xem tất cả {data.teamPosts!.length} bài đăng →
                        </button>
                    )}
                </div>
            )}

            {/* Teammates */}
            {hasTeammates && (
                <div>
                    <p className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1">
                        <User className="w-3 h-3" />
                        Đồng đội gợi ý ({data.teammates!.length})
                    </p>
                    <div className="space-y-2">
                        {data.teammates!.slice(0, 3).map(teammate => (
                            <TeammateCard key={teammate.id} teammate={teammate} />
                        ))}
                    </div>
                    {data.teammates!.length > 3 && (
                        <button
                            onClick={() => window.open('/community', '_blank')}
                            className="mt-2 w-full py-2 text-xs text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
                        >
                            Xem tất cả gợi ý →
                        </button>
                    )}
                </div>
            )}

            {/* Contests */}
            {hasContests && (
                <div>
                    <p className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1">
                        <Trophy className="w-3 h-3" />
                        Cuộc thi phù hợp ({data.contests!.length})
                    </p>
                    <div className="space-y-2">
                        {data.contests!.slice(0, 3).map(contest => (
                            <ContestCard key={contest.id} contest={contest} />
                        ))}
                    </div>
                    {data.contests!.length > 3 && (
                        <button
                            onClick={() => window.open('/contests', '_blank')}
                            className="mt-2 w-full py-2 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                        >
                            Xem tất cả cuộc thi →
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

interface MessageBubbleProps {
    message: Message;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
    const isUser = message.role === 'user';

    return (
        <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
            {/* Avatar */}
            <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isUser
                ? 'bg-primary-100 text-primary-600'
                : 'bg-linear-to-br from-violet-500 to-purple-600 text-white'
                }`}>
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            {/* Message content */}
            <div className={`max-w-[85%] ${isUser ? 'text-right' : 'text-left'}`}>
                <div className={`inline-block px-4 py-2 rounded-2xl ${isUser
                    ? 'bg-primary-500 text-white rounded-br-md'
                    : 'bg-slate-100 text-slate-800 rounded-bl-md'
                    }`}>
                    <p className="text-sm whitespace-pre-wrap break-all">{message.content}</p>
                </div>

                {/* Data Cards for assistant messages */}
                {!isUser && message.data && (
                    <DataCards data={message.data} />
                )}

                <p className={`text-xs text-slate-400 mt-1 ${isUser ? 'pr-1' : 'pl-1'}`}>
                    {formatTime(message.timestamp)}
                </p>
            </div>
        </div>
    );
};

interface SuggestionChipProps {
    suggestion: Suggestion | string;
    onClick: (text: string) => void;
}

const SuggestionChip: React.FC<SuggestionChipProps> = ({ suggestion, onClick }) => {
    const text = typeof suggestion === 'string' ? suggestion : suggestion.text;
    const icon = typeof suggestion === 'string' ? '💡' : suggestion.icon;

    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onClick(text);
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-full text-sm text-slate-700 hover:bg-slate-50 hover:border-primary-300 transition-all duration-200 shadow-sm"
        >
            <span>{icon}</span>
            <span className="line-clamp-1">{text}</span>
        </button>
    );
};

// ============ MAIN COMPONENT ============
export const ChatBubble: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [suggestions, setSuggestions] = useState<(Suggestion | string)[]>(DEFAULT_SUGGESTIONS);
    const [showScrollButton, setShowScrollButton] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Auto-scroll to bottom
    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        if (messages.length > 0) {
            scrollToBottom();
        }
    }, [messages, scrollToBottom]);

    // Focus input when chat opens
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    // Handle scroll position for "scroll to bottom" button
    const handleScroll = useCallback(() => {
        if (!messagesContainerRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
        setShowScrollButton(scrollHeight - scrollTop - clientHeight > 100);
    }, []);

    // Send message to API
    const sendMessage = async (content: string) => {
        const sanitizedContent = sanitizeInput(content);
        if (!sanitizedContent || isLoading) return;

        setError(null);
        setInputValue('');

        // Add user message
        const userMessage: Message = {
            id: generateId(),
            role: 'user',
            content: sanitizedContent,
            timestamp: new Date()
        };

        setMessages(prev => [...prev.slice(-MAX_HISTORY_LENGTH + 1), userMessage]);
        setIsLoading(true);

        try {
            const userStr = localStorage.getItem('user');
            if (!userStr) {
                throw new Error('Vui lòng đăng nhập để sử dụng chat');
            }

            // Build history for API (only last 10 messages)
            const history = messages.slice(-10).map(m => ({
                role: m.role,
                content: m.content
            }));

            const data = await api.post<ChatResponse>('/chat', {
                message: sanitizedContent,
                history
            });

            // Add assistant message with data for rich cards
            const assistantMessage: Message = {
                id: generateId(),
                role: 'assistant',
                content: data.response,
                timestamp: new Date(),
                data: data.data // Include structured data for card rendering
            };

            setMessages(prev => [...prev.slice(-MAX_HISTORY_LENGTH + 1), assistantMessage]);

            // Update suggestions based on response
            if (data.suggestions && data.suggestions.length > 0) {
                setSuggestions(data.suggestions);
            }

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Đã có lỗi xảy ra';
            setError(errorMessage);
            // Keep the user message so they can see what they sent
            // Don't remove it - user can retry or see the error
        } finally {
            setIsLoading(false);
        }
    };

    // Handle form submit
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        sendMessage(inputValue);
    };

    // Handle suggestion click
    const handleSuggestionClick = (text: string) => {
        sendMessage(text);
    };

    // Handle textarea keydown
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(inputValue);
        }
    };

    // Auto-resize textarea
    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        if (value.length <= MAX_MESSAGE_LENGTH) {
            setInputValue(value);
        }

        // Auto-resize
        e.target.style.height = 'auto';
        e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
    };

    // Clear chat
    const clearChat = () => {
        setMessages([]);
        setSuggestions(DEFAULT_SUGGESTIONS);
        setError(null);
    };

    return (
        <>
            {/* Chat Bubble Button */}
            <button
                onClick={() => setIsOpen(true)}
                className={`fixed bottom-6 right-6 z-50 w-14 h-14 bg-linear-to-br from-primary-500 to-primary-600 text-white rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 flex items-center justify-center group ${isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`}
                aria-label="Mở chat với AI Assistant"
            >
                <MessageCircle className="w-6 h-6" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse" />

                {/* Tooltip */}
                <span className="absolute right-full mr-3 px-3 py-2 bg-slate-800 text-white text-sm rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    Chat với AI Assistant
                </span>
            </button>

            {/* Chat Window */}
            <div className={`fixed bottom-6 right-6 z-50 w-[380px] h-[600px] max-h-[80vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none'}`}>
                {/* Header */}
                <div className="bg-linear-to-r from-primary-500 to-primary-600 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-white">Blanc AI</h3>
                            <p className="text-xs text-white/80">Trợ lý thông minh của bạn</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {messages.length > 0 && (
                            <button
                                onClick={clearChat}
                                className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                title="Xóa cuộc trò chuyện"
                                aria-label="Xóa cuộc trò chuyện"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                            title="Đóng chat"
                            aria-label="Đóng chat"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Messages Area */}
                <div
                    ref={messagesContainerRef}
                    onScroll={handleScroll}
                    className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50"
                >
                    {messages.length === 0 ? (
                        // Welcome state
                        <div className="h-full flex flex-col items-center justify-center text-center px-4">
                            <div className="w-16 h-16 bg-linear-to-br from-primary-100 to-violet-100 rounded-2xl flex items-center justify-center mb-4">
                                <Sparkles className="w-8 h-8 text-primary-500" />
                            </div>
                            <h4 className="text-lg font-semibold text-slate-800 mb-2">
                                Xin chào! 👋
                            </h4>
                            <p className="text-sm text-slate-600 mb-6">
                                Tôi là trợ lý AI của Blanc. Tôi có thể giúp bạn tìm cuộc thi phù hợp, gợi ý đồng đội, và hướng dẫn sử dụng nền tảng.
                            </p>

                            {/* Suggestions */}
                            <div className="w-full space-y-2">
                                <p className="text-xs text-slate-500 mb-2">Thử hỏi tôi:</p>
                                <div className="flex flex-wrap gap-2 justify-center">
                                    {DEFAULT_SUGGESTIONS.map((suggestion) => (
                                        <SuggestionChip
                                            key={suggestion.id}
                                            suggestion={suggestion}
                                            onClick={handleSuggestionClick}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            {messages.map((message) => (
                                <MessageBubble key={message.id} message={message} />
                            ))}

                            {/* Loading indicator */}
                            {isLoading && (
                                <div className="flex gap-2">
                                    <div className="w-8 h-8 rounded-full bg-linear-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                                        <Bot className="w-4 h-4 text-white" />
                                    </div>
                                    <div className="bg-slate-100 rounded-2xl rounded-bl-md px-4 py-3">
                                        <div className="flex gap-1">
                                            <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                                            <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce animation-delay-150" />
                                            <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce animation-delay-300" />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Error message */}
                            {error && (
                                <div className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}

                            {/* Follow-up suggestions */}
                            {!isLoading && messages.length > 0 && (
                                <div className="pt-2">
                                    <div className="flex flex-wrap gap-2">
                                        {suggestions.slice(0, 3).map((suggestion, index) => (
                                            <SuggestionChip
                                                key={typeof suggestion === 'string' ? index : suggestion.id}
                                                suggestion={suggestion}
                                                onClick={handleSuggestionClick}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div ref={messagesEndRef} />
                        </>
                    )}
                </div>

                {/* Scroll to bottom button */}
                {showScrollButton && (
                    <button
                        onClick={scrollToBottom}
                        className="absolute bottom-24 right-4 w-8 h-8 bg-white shadow-lg rounded-full flex items-center justify-center hover:bg-slate-50 transition-colors"
                        title="Cuộn xuống dưới"
                        aria-label="Cuộn xuống dưới"
                    >
                        <ChevronDown className="w-4 h-4 text-slate-600" />
                    </button>
                )}

                {/* Input Area */}
                <form onSubmit={handleSubmit} className="p-3 border-t border-slate-100 bg-white">
                    <div className="flex gap-2 items-end">
                        <div className="flex-1 relative">
                            <textarea
                                ref={inputRef}
                                value={inputValue}
                                onChange={handleInputChange}
                                onKeyDown={handleKeyDown}
                                placeholder="Nhập tin nhắn..."
                                rows={1}
                                disabled={isLoading}
                                className="w-full px-4 py-2.5 bg-slate-100 border-0 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 pr-12 max-h-[120px]"
                            />
                            <span className={`absolute right-3 bottom-2.5 text-xs ${inputValue.length > MAX_MESSAGE_LENGTH * 0.8 ? 'text-orange-500' : 'text-slate-400'}`}>
                                {inputValue.length}/{MAX_MESSAGE_LENGTH}
                            </span>
                        </div>
                        <button
                            type="submit"
                            disabled={!inputValue.trim() || isLoading}
                            className="w-10 h-10 bg-primary-500 text-white rounded-xl flex items-center justify-center hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
                            title="Gửi tin nhắn"
                            aria-label="Gửi tin nhắn"
                        >
                            {isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <Send className="w-5 h-5" />
                            )}
                        </button>
                    </div>
                    <p className="text-xs text-slate-400 mt-2 text-center">
                        AI có thể mắc lỗi. Hãy kiểm tra thông tin quan trọng.
                    </p>
                </form>
            </div>
        </>
    );
};

export default ChatBubble;

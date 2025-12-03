import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
    Users, Sparkles, RefreshCw, Loader2, ChevronRight,
    MapPin, Clock, Star, Zap, AlertCircle, CheckCircle2,
    MessageCircle, UserPlus, Target, TrendingUp
} from 'lucide-react';
import { Button, Card, Badge } from './ui/Common';
import { api } from '../lib/api';
import { ROLE_COLORS } from '../constants/profileOptions';

// ============================================================================
// TYPES
// ============================================================================

interface TeammateProfile {
    primaryRole: string;
    secondaryRoles: string[];
    experienceLevel: string;
    location: string;
    timeZone: string;
    skills: string[];
    techStack: string[];
    availability: string;
    collaborationStyle: string;
    languages: string[];
    openToMentor: boolean;
}

interface TeammateRecommendation {
    id: string;
    name: string;
    avatar: string | null;
    matchScore: number;
    scoreBreakdown: {
        roleDiversity: number;
        skillComplementarity: number;
        availability: number;
        experienceLevel: number;
        locationTimezone: number;
        communicationTools: number;
        contestPreferences: number;
        collaborationStyle: number;
    };
    matchDetails: {
        userToCandidate: number;
        candidateToUser: number;
    } | null;
    profile: TeammateProfile;
    contestPreferences: {
        contestInterests: string[];
        preferredTeamRole: string;
        preferredTeamSize: string;
    };
}

interface RecommendationResponse {
    success: boolean;
    count: number;
    matchingMode: string;
    recommendations: TeammateRecommendation[];
    meta: {
        cached: boolean;
        cacheTTL: string;
        maxScore: number;
        teamSize: number;
    };
}

interface ProfileCompletionResponse {
    success: boolean;
    completionPercent: number;
    status: 'excellent' | 'good' | 'fair' | 'incomplete';
    missing: Array<{ field: string; label: string; weight: number }>;
    tips: string[];
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const ScoreRing: React.FC<{ score: number; size?: 'sm' | 'md' | 'lg' }> = ({ score, size = 'md' }) => {
    const sizeClasses = {
        sm: 'w-10 h-10 text-xs',
        md: 'w-14 h-14 text-sm',
        lg: 'w-20 h-20 text-lg'
    };

    const getScoreColor = (s: number) => {
        if (s >= 80) return 'text-green-600 bg-green-50 border-green-200';
        if (s >= 65) return 'text-blue-600 bg-blue-50 border-blue-200';
        if (s >= 50) return 'text-amber-600 bg-amber-50 border-amber-200';
        return 'text-slate-600 bg-slate-50 border-slate-200';
    };

    const getScoreLabel = (s: number) => {
        if (s >= 80) return 'Xuất sắc';
        if (s >= 65) return 'Rất phù hợp';
        if (s >= 50) return 'Khá phù hợp';
        return 'Tiềm năng';
    };

    return (
        <div className="flex flex-col items-center gap-1">
            <div
                className={`${sizeClasses[size]} rounded-full border-2 flex items-center justify-center font-bold ${getScoreColor(score)}`}
            >
                {score}%
            </div>
            {size !== 'sm' && (
                <span className={`text-xs ${getScoreColor(score).split(' ')[0]}`}>
                    {getScoreLabel(score)}
                </span>
            )}
        </div>
    );
};

const SkillTag: React.FC<{ skill: string; isNew?: boolean }> = ({ skill, isNew }) => (
    <span
        className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${isNew
            ? 'bg-green-50 text-green-700 border-green-200'
            : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}
    >
        {skill}
        {isNew && <Sparkles className="w-3 h-3 ml-1 text-green-500" />}
    </span>
);

const ExperienceBadge: React.FC<{ level: string }> = ({ level }) => {
    const config: Record<string, { label: string; color: string }> = {
        beginner: { label: 'Mới bắt đầu', color: 'bg-blue-100 text-blue-700' },
        intermediate: { label: 'Có kinh nghiệm', color: 'bg-amber-100 text-amber-700' },
        advanced: { label: 'Thành thạo', color: 'bg-green-100 text-green-700' },
        expert: { label: 'Chuyên gia', color: 'bg-purple-100 text-purple-700' }
    };

    const c = config[level] || config.beginner;

    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.color}`}>
            <Star className="w-3 h-3 mr-1" />
            {c.label}
        </span>
    );
};

// ============================================================================
// TEAMMATE CARD COMPONENT
// ============================================================================

const TeammateCard: React.FC<{
    teammate: TeammateRecommendation;
    index: number;
    onViewProfile?: (id: string) => void;
    onInvite?: (id: string) => void;
}> = ({ teammate, index, onViewProfile, onInvite }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const roleColor = ROLE_COLORS[teammate.profile.primaryRole] || 'bg-gray-50 text-gray-700 border-gray-200';

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    return (
        <Card className="p-4 hover:shadow-lg transition-all duration-200 border-l-4 border-l-primary-500">
            {/* Header */}
            <div className="flex items-start gap-3 mb-3">
                {/* Rank Badge */}
                <div className="shrink-0 w-6 h-6 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold">
                    {index + 1}
                </div>

                {/* Avatar - Clickable to profile */}
                <Link
                    to={`/user/${teammate.id}`}
                    className="shrink-0 w-12 h-12 rounded-full overflow-hidden bg-linear-to-br from-primary-500 to-primary-700 hover:ring-2 hover:ring-primary-300 transition-all"
                    title={`Xem hồ sơ của ${teammate.name}`}
                >
                    {teammate.avatar ? (
                        <img src={teammate.avatar} alt={teammate.name} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-white font-bold">
                            {getInitials(teammate.name)}
                        </div>
                    )}
                </Link>

                {/* Info */}
                <div className="grow min-w-0">
                    <Link
                        to={`/user/${teammate.id}`}
                        className="font-semibold text-slate-900 truncate hover:text-primary-600 transition-colors block"
                    >
                        {teammate.name}
                    </Link>
                    <div className="flex items-center gap-2 mt-1">
                        <Badge className={`text-xs ${roleColor}`}>
                            {teammate.profile.primaryRole || 'Chưa xác định'}
                        </Badge>
                        {teammate.profile.openToMentor && (
                            <Badge className="bg-purple-50 text-purple-700 text-xs">
                                🎓 Mentor
                            </Badge>
                        )}
                    </div>
                </div>

                {/* Score */}
                <ScoreRing score={teammate.matchScore} size="sm" />
            </div>

            {/* Quick Info */}
            <div className="grid grid-cols-2 gap-2 mb-3 text-xs text-slate-600">
                {teammate.profile.location && (
                    <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span className="truncate">{teammate.profile.location}</span>
                    </div>
                )}
                {teammate.profile.experienceLevel && (
                    <div className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-slate-400" />
                        <ExperienceBadge level={teammate.profile.experienceLevel} />
                    </div>
                )}
                {teammate.profile.availability && (
                    <div className="flex items-center gap-1 col-span-2">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span className="truncate">{teammate.profile.availability.split(',')[0]}</span>
                    </div>
                )}
            </div>

            {/* Skills Preview */}
            <div className="mb-3">
                <p className="text-xs font-medium text-slate-500 mb-1.5">Kỹ năng nổi bật:</p>
                <div className="flex flex-wrap gap-1">
                    {teammate.profile.skills.slice(0, 4).map(skill => (
                        <SkillTag key={skill} skill={skill} />
                    ))}
                    {teammate.profile.skills.length > 4 && (
                        <span className="text-xs text-slate-400">
                            +{teammate.profile.skills.length - 4}
                        </span>
                    )}
                </div>
            </div>

            {/* Expandable Details */}
            {isExpanded && (
                <div className="pt-3 border-t border-slate-100 space-y-3 animate-in slide-in-from-top-2">
                    {/* Score Breakdown */}
                    <div>
                        <p className="text-xs font-medium text-slate-500 mb-2">Điểm phù hợp chi tiết:</p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="flex justify-between">
                                <span className="text-slate-600">Vai trò đa dạng</span>
                                <span className="font-medium">{teammate.scoreBreakdown.roleDiversity}/25</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-600">Kỹ năng bổ sung</span>
                                <span className="font-medium">{teammate.scoreBreakdown.skillComplementarity}/20</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-600">Lịch phù hợp</span>
                                <span className="font-medium">{teammate.scoreBreakdown.availability}/15</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-600">Kinh nghiệm</span>
                                <span className="font-medium">{teammate.scoreBreakdown.experienceLevel}/10</span>
                            </div>
                        </div>
                    </div>

                    {/* Two-way Match Info */}
                    {teammate.matchDetails && (
                        <div className="bg-blue-50 rounded-lg p-2">
                            <p className="text-xs font-medium text-blue-700 mb-1">Ghép đội hai chiều:</p>
                            <div className="flex items-center gap-4 text-xs text-blue-600">
                                <span>Bạn → Họ: {Math.round(teammate.matchDetails.userToCandidate)}%</span>
                                <span>Họ → Bạn: {Math.round(teammate.matchDetails.candidateToUser)}%</span>
                            </div>
                        </div>
                    )}

                    {/* Tech Stack */}
                    {teammate.profile.techStack.length > 0 && (
                        <div>
                            <p className="text-xs font-medium text-slate-500 mb-1.5">Tech Stack:</p>
                            <div className="flex flex-wrap gap-1">
                                {teammate.profile.techStack.slice(0, 6).map(tech => (
                                    <SkillTag key={tech} skill={tech} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Languages */}
                    {teammate.profile.languages.length > 0 && (
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                            <span className="font-medium">Ngôn ngữ:</span>
                            <span>{teammate.profile.languages.join(', ')}</span>
                        </div>
                    )}
                </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                <button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
                >
                    {isExpanded ? 'Thu gọn' : 'Xem chi tiết'}
                    <ChevronRight className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </button>

                <div className="flex gap-2">
                    {onViewProfile && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onViewProfile(teammate.id)}
                            className="text-xs"
                        >
                            <Users className="w-3 h-3 mr-1" />
                            Hồ sơ
                        </Button>
                    )}
                    {onInvite && (
                        <Button
                            size="sm"
                            onClick={() => onInvite(teammate.id)}
                            className="text-xs"
                        >
                            <UserPlus className="w-3 h-3 mr-1" />
                            Mời
                        </Button>
                    )}
                </div>
            </div>
        </Card>
    );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface TeammateRecommendationsProps {
    contestId?: string;
    className?: string;
    onViewProfile?: (userId: string) => void;
    onInvite?: (userId: string) => void;
}

const TeammateRecommendations: React.FC<TeammateRecommendationsProps> = ({
    contestId,
    className = '',
    onViewProfile,
    onInvite
}) => {
    const navigate = useNavigate();
    const [recommendations, setRecommendations] = useState<TeammateRecommendation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [profileCompletion, setProfileCompletion] = useState<ProfileCompletionResponse | null>(null);

    const isLoggedIn = !!localStorage.getItem('auth_token');

    // Fetch recommendations
    const fetchRecommendations = useCallback(async (refresh = false) => {
        if (!isLoggedIn) return;

        try {
            if (refresh) {
                setIsRefreshing(true);
            } else {
                setIsLoading(true);
            }
            setError(null);

            const params = new URLSearchParams({ limit: '5', twoWay: 'true' });
            if (contestId) {
                params.set('contestId', contestId);
            }

            let data: RecommendationResponse;
            if (refresh) {
                data = await api.post<RecommendationResponse>(`/matching/refresh?${params}`, {});
            } else {
                data = await api.get<RecommendationResponse>(`/matching/recommendations?${params}`);
            }

            setRecommendations(data.recommendations);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Không thể tải gợi ý';

            // Check specific error codes
            if (message.includes('MATCHING_DISABLED')) {
                setError('Bạn cần bật tính năng "Ghép đội thông minh" trong cài đặt hồ sơ để nhận gợi ý.');
            } else {
                setError(message);
            }
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [isLoggedIn, contestId]);

    // Fetch profile completion
    const fetchProfileCompletion = useCallback(async () => {
        if (!isLoggedIn) return;

        try {
            const data = await api.get<ProfileCompletionResponse>('/matching/profile-completion');
            setProfileCompletion(data);
        } catch (err) {
            console.error('Failed to fetch profile completion:', err);
        }
    }, [isLoggedIn]);

    useEffect(() => {
        fetchRecommendations();
        fetchProfileCompletion();
    }, [fetchRecommendations, fetchProfileCompletion]);

    // Not logged in
    if (!isLoggedIn) {
        return (
            <Card className={`p-6 ${className}`}>
                <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 bg-primary-100 rounded-full flex items-center justify-center">
                        <Users className="w-8 h-8 text-primary-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">Gợi ý đồng đội thông minh</h3>
                    <p className="text-slate-500 text-sm mb-4">
                        Đăng nhập để nhận gợi ý 5 đồng đội đa dạng, phù hợp với kỹ năng và phong cách làm việc của bạn.
                    </p>
                    <Button
                        onClick={() => window.dispatchEvent(new CustomEvent('show-auth-modal', { detail: { mode: 'login' } }))}
                    >
                        Đăng nhập ngay
                    </Button>
                </div>
            </Card>
        );
    }

    return (
        <Card className={`p-6 ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary-100 rounded-xl">
                        <Sparkles className="w-5 h-5 text-primary-600" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-slate-900">Gợi ý đồng đội cho bạn</h3>
                        <p className="text-xs text-slate-500">5 người tạo thành team 6 người đa dạng</p>
                    </div>
                </div>

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fetchRecommendations(true)}
                    disabled={isRefreshing}
                    className="text-primary-600"
                >
                    <RefreshCw className={`w-4 h-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
                    {isRefreshing ? 'Đang làm mới...' : 'Làm mới'}
                </Button>
            </div>

            {/* Profile Completion Warning */}
            {profileCompletion && profileCompletion.completionPercent < 60 && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-start gap-2">
                        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-medium text-amber-800 text-sm">
                                Hồ sơ hoàn thiện {profileCompletion.completionPercent}%
                            </p>
                            <p className="text-amber-700 text-xs mt-1">
                                {profileCompletion.tips[0] || 'Hoàn thiện hồ sơ để nhận gợi ý chính xác hơn'}
                            </p>
                            <button
                                onClick={() => window.location.hash = '#/settings'}
                                className="text-amber-800 text-xs underline mt-1 hover:no-underline"
                            >
                                Cập nhật hồ sơ →
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Loading State */}
            {isLoading && (
                <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-primary-600 animate-spin mb-4" />
                    <p className="text-slate-500 text-sm">Đang phân tích và tìm đồng đội phù hợp...</p>
                </div>
            )}

            {/* Error State */}
            {error && !isLoading && (
                <div className="text-center py-8">
                    <div className="w-14 h-14 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                        <AlertCircle className="w-7 h-7 text-red-500" />
                    </div>
                    <p className="text-slate-600 text-sm mb-4">{error}</p>
                    {error.includes('cài đặt') ? (
                        <Button
                            variant="secondary"
                            onClick={() => navigate('/profile?tab=settings')}
                        >
                            Đi đến cài đặt
                        </Button>
                    ) : (
                        <Button variant="secondary" onClick={() => fetchRecommendations()}>
                            Thử lại
                        </Button>
                    )}
                </div>
            )}

            {/* Empty State */}
            {!isLoading && !error && recommendations.length === 0 && (
                <div className="text-center py-8">
                    <div className="w-14 h-14 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center">
                        <Users className="w-7 h-7 text-slate-400" />
                    </div>
                    <h4 className="font-medium text-slate-900 mb-2">Chưa có gợi ý</h4>
                    <p className="text-slate-500 text-sm mb-4">
                        Hiện tại chưa tìm được đồng đội phù hợp. Hãy thử làm mới hoặc hoàn thiện hồ sơ.
                    </p>
                    <div className="flex gap-2 justify-center">
                        <Button variant="secondary" onClick={() => fetchRecommendations(true)}>
                            <RefreshCw className="w-4 h-4 mr-1" />
                            Làm mới
                        </Button>
                        <Button onClick={() => window.location.hash = '#/settings'}>
                            Cập nhật hồ sơ
                        </Button>
                    </div>
                </div>
            )}

            {/* Recommendations List */}
            {!isLoading && !error && recommendations.length > 0 && (
                <>
                    {/* Summary */}
                    <div className="flex items-center gap-2 mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                        <p className="text-green-700 text-sm">
                            Tìm được {recommendations.length} đồng đội với vai trò & kỹ năng đa dạng cho team của bạn
                        </p>
                    </div>

                    {/* Cards Grid */}
                    <div className="space-y-4">
                        {recommendations.map((teammate, index) => (
                            <TeammateCard
                                key={teammate.id}
                                teammate={teammate}
                                index={index}
                                onViewProfile={onViewProfile}
                                onInvite={onInvite}
                            />
                        ))}
                    </div>

                    {/* Info Footer */}
                    <div className="mt-4 pt-4 border-t border-slate-100">
                        <div className="flex items-start gap-2 text-xs text-slate-500">
                            <Target className="w-4 h-4 shrink-0 mt-0.5" />
                            <p>
                                Gợi ý dựa trên ghép đội hai chiều - cả bạn và họ đều được đánh giá phù hợp với nhau.
                                Kết quả được cập nhật mỗi 6 giờ.
                            </p>
                        </div>
                    </div>
                </>
            )}
        </Card>
    );
};

export default TeammateRecommendations;

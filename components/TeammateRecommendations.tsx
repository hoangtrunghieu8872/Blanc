import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
    Users, Sparkles, RefreshCw, Loader2, ChevronRight,
    MapPin, Clock, Star, Zap, AlertCircle, CheckCircle2,
    MessageCircle, UserPlus, Target, TrendingUp, X, Eye,
    Award, Globe, Code2, Calendar
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
// TEAMMATE CARD COMPONENT (Compact Version for Horizontal Layout)
// ============================================================================

const TeammateCard: React.FC<{
    teammate: TeammateRecommendation;
    index: number;
    onViewProfile?: (id: string) => void;
    onInvite?: (id: string) => void;
    onViewDetails?: (teammate: TeammateRecommendation) => void;
}> = ({ teammate, index, onViewProfile, onInvite, onViewDetails }) => {
    const roleColor = ROLE_COLORS[teammate.profile.primaryRole] || 'bg-gray-50 text-gray-700 border-gray-200';

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    const getScoreColor = (s: number) => {
        if (s >= 80) return 'text-green-600 bg-green-50 border-green-300';
        if (s >= 65) return 'text-blue-600 bg-blue-50 border-blue-300';
        if (s >= 50) return 'text-amber-600 bg-amber-50 border-amber-300';
        return 'text-slate-600 bg-slate-50 border-slate-300';
    };

    return (
        <div className="shrink-0 w-56 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden group">
            {/* Rank Badge - Top corner */}
            <div className="relative">
                <div className="absolute top-2 left-2 z-10 w-6 h-6 rounded-full bg-primary-500 text-white flex items-center justify-center text-xs font-bold shadow-sm">
                    {index + 1}
                </div>

                {/* Score Badge - Top right */}
                <div className={`absolute top-2 right-2 z-10 px-2 py-0.5 rounded-full text-xs font-bold border ${getScoreColor(teammate.matchScore)}`}>
                    {teammate.matchScore}%
                </div>

                {/* Avatar Section */}
                <div className="pt-10 pb-3 px-4 bg-linear-to-b from-primary-50 to-white">
                    <Link
                        to={`/user/${teammate.id}`}
                        className="block w-16 h-16 mx-auto rounded-full overflow-hidden bg-linear-to-br from-primary-500 to-primary-700 ring-3 ring-white shadow-lg hover:scale-105 transition-transform"
                    >
                        {teammate.avatar ? (
                            <img src={teammate.avatar} alt={teammate.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-white font-bold text-lg">
                                {getInitials(teammate.name)}
                            </div>
                        )}
                    </Link>
                </div>
            </div>

            {/* Info Section */}
            <div className="px-4 pb-4">
                {/* Name */}
                <Link
                    to={`/user/${teammate.id}`}
                    className="block text-center font-semibold text-slate-900 truncate hover:text-primary-600 transition-colors text-sm"
                    title={teammate.name}
                >
                    {teammate.name}
                </Link>

                {/* Role Badge */}
                <div className="flex justify-center mt-2">
                    <Badge className={`text-xs ${roleColor}`}>
                        {teammate.profile.primaryRole || 'Chưa xác định'}
                    </Badge>
                </div>

                {/* Quick Stats */}
                <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                    {teammate.profile.location && (
                        <div className="flex items-center gap-1.5">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{teammate.profile.location}</span>
                        </div>
                    )}
                    {teammate.profile.experienceLevel && (
                        <div className="flex items-center gap-1.5">
                            <Star className="w-3 h-3 text-amber-500 shrink-0" />
                            <span className="truncate capitalize">
                                {teammate.profile.experienceLevel === 'beginner' ? 'Mới bắt đầu' :
                                    teammate.profile.experienceLevel === 'intermediate' ? 'Có kinh nghiệm' :
                                        teammate.profile.experienceLevel === 'advanced' ? 'Thành thạo' : 'Chuyên gia'}
                            </span>
                        </div>
                    )}
                </div>

                {/* Top Skills - Show only 2 */}
                <div className="mt-3 flex flex-wrap gap-1 justify-center">
                    {teammate.profile.skills.slice(0, 2).map(skill => (
                        <span
                            key={skill}
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600 border border-slate-200"
                        >
                            {skill}
                        </span>
                    ))}
                    {teammate.profile.skills.length > 2 && (
                        <span className="text-xs text-slate-400">
                            +{teammate.profile.skills.length - 2}
                        </span>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="mt-4 flex gap-2">
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onViewDetails?.(teammate)}
                        className="flex-1 text-xs py-1.5"
                    >
                        <Eye className="w-3 h-3 mr-1" />
                        Chi tiết
                    </Button>
                    <Button
                        size="sm"
                        onClick={() => onInvite?.(teammate.id)}
                        className="flex-1 text-xs py-1.5"
                    >
                        <UserPlus className="w-3 h-3 mr-1" />
                        Mời
                    </Button>
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// DETAIL MODAL COMPONENT
// ============================================================================

const TeammateDetailModal: React.FC<{
    teammate: TeammateRecommendation | null;
    onClose: () => void;
    onViewProfile?: (id: string) => void;
    onInvite?: (id: string) => void;
}> = ({ teammate, onClose, onViewProfile, onInvite }) => {
    if (!teammate) return null;

    const roleColor = ROLE_COLORS[teammate.profile.primaryRole] || 'bg-gray-50 text-gray-700 border-gray-200';

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="relative bg-linear-to-br from-primary-500 to-primary-700 px-6 pt-6 pb-16">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
                        title="Đóng"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    {/* Score Badge */}
                    <div className="absolute top-4 left-4">
                        <div className={`px-3 py-1 rounded-full text-sm font-bold border-2 ${getScoreColor(teammate.matchScore)}`}>
                            {teammate.matchScore}% - {getScoreLabel(teammate.matchScore)}
                        </div>
                    </div>
                </div>

                {/* Avatar - overlapping header */}
                <div className="relative -mt-12 flex justify-center">
                    <Link
                        to={`/user/${teammate.id}`}
                        onClick={onClose}
                        className="w-24 h-24 rounded-full overflow-hidden bg-linear-to-br from-primary-400 to-primary-600 ring-4 ring-white shadow-xl hover:scale-105 transition-transform"
                    >
                        {teammate.avatar ? (
                            <img src={teammate.avatar} alt={teammate.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-white font-bold text-2xl">
                                {getInitials(teammate.name)}
                            </div>
                        )}
                    </Link>
                </div>

                {/* Content */}
                <div className="px-6 pt-4 pb-6 overflow-y-auto max-h-[calc(90vh-280px)]">
                    {/* Name & Role */}
                    <div className="text-center mb-6">
                        <Link
                            to={`/user/${teammate.id}`}
                            onClick={onClose}
                            className="text-xl font-bold text-slate-900 hover:text-primary-600 transition-colors"
                        >
                            {teammate.name}
                        </Link>
                        <div className="flex justify-center gap-2 mt-2">
                            <Badge className={`${roleColor}`}>
                                {teammate.profile.primaryRole || 'Chưa xác định'}
                            </Badge>
                            {teammate.profile.openToMentor && (
                                <Badge className="bg-purple-50 text-purple-700 border-purple-200">
                                    🎓 Mentor
                                </Badge>
                            )}
                        </div>
                    </div>

                    {/* Info Grid */}
                    <div className="grid grid-cols-2 gap-3 mb-6">
                        {teammate.profile.location && (
                            <div className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg">
                                <MapPin className="w-4 h-4 text-primary-500" />
                                <div>
                                    <p className="text-xs text-slate-500">Địa điểm</p>
                                    <p className="text-sm font-medium text-slate-700 truncate">{teammate.profile.location}</p>
                                </div>
                            </div>
                        )}
                        {teammate.profile.experienceLevel && (
                            <div className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg">
                                <Award className="w-4 h-4 text-amber-500" />
                                <div>
                                    <p className="text-xs text-slate-500">Kinh nghiệm</p>
                                    <p className="text-sm font-medium text-slate-700 capitalize">
                                        {teammate.profile.experienceLevel === 'beginner' ? 'Mới bắt đầu' :
                                            teammate.profile.experienceLevel === 'intermediate' ? 'Có kinh nghiệm' :
                                                teammate.profile.experienceLevel === 'advanced' ? 'Thành thạo' : 'Chuyên gia'}
                                    </p>
                                </div>
                            </div>
                        )}
                        {teammate.profile.availability && (
                            <div className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg">
                                <Calendar className="w-4 h-4 text-green-500" />
                                <div>
                                    <p className="text-xs text-slate-500">Thời gian rảnh</p>
                                    <p className="text-sm font-medium text-slate-700 truncate">{teammate.profile.availability.split(',')[0]}</p>
                                </div>
                            </div>
                        )}
                        {teammate.profile.timeZone && (
                            <div className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg">
                                <Globe className="w-4 h-4 text-blue-500" />
                                <div>
                                    <p className="text-xs text-slate-500">Múi giờ</p>
                                    <p className="text-sm font-medium text-slate-700 truncate">{teammate.profile.timeZone}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Score Breakdown */}
                    <div className="mb-6">
                        <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                            <Zap className="w-4 h-4 text-primary-500" />
                            Điểm phù hợp chi tiết
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { label: 'Vai trò đa dạng', value: teammate.scoreBreakdown.roleDiversity, max: 25 },
                                { label: 'Kỹ năng bổ sung', value: teammate.scoreBreakdown.skillComplementarity, max: 20 },
                                { label: 'Lịch phù hợp', value: teammate.scoreBreakdown.availability, max: 15 },
                                { label: 'Kinh nghiệm', value: teammate.scoreBreakdown.experienceLevel, max: 10 },
                                { label: 'Vị trí/Múi giờ', value: teammate.scoreBreakdown.locationTimezone, max: 10 },
                                { label: 'Phong cách', value: teammate.scoreBreakdown.collaborationStyle, max: 10 },
                            ].map(item => (
                                <div key={item.label} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                                    <span className="text-xs text-slate-600">{item.label}</span>
                                    <span className="text-xs font-bold text-primary-600">{item.value}/{item.max}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Two-way Match */}
                    {teammate.matchDetails && (
                        <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                            <h4 className="text-sm font-semibold text-blue-700 mb-2 flex items-center gap-2">
                                <Users className="w-4 h-4" />
                                Ghép đội hai chiều
                            </h4>
                            <div className="flex items-center justify-around text-sm">
                                <div className="text-center">
                                    <p className="text-blue-600 font-bold">{Math.round(teammate.matchDetails.userToCandidate)}%</p>
                                    <p className="text-xs text-blue-500">Bạn → Họ</p>
                                </div>
                                <ChevronRight className="w-4 h-4 text-blue-400" />
                                <div className="text-center">
                                    <p className="text-blue-600 font-bold">{Math.round(teammate.matchDetails.candidateToUser)}%</p>
                                    <p className="text-xs text-blue-500">Họ → Bạn</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Skills */}
                    <div className="mb-6">
                        <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                            <Code2 className="w-4 h-4 text-primary-500" />
                            Kỹ năng
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                            {teammate.profile.skills.map(skill => (
                                <span
                                    key={skill}
                                    className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-primary-50 text-primary-700 border border-primary-200"
                                >
                                    {skill}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Tech Stack */}
                    {teammate.profile.techStack.length > 0 && (
                        <div className="mb-6">
                            <h4 className="text-sm font-semibold text-slate-900 mb-3">Tech Stack</h4>
                            <div className="flex flex-wrap gap-1.5">
                                {teammate.profile.techStack.map(tech => (
                                    <span
                                        key={tech}
                                        className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200"
                                    >
                                        {tech}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Languages */}
                    {teammate.profile.languages.length > 0 && (
                        <div className="mb-6">
                            <h4 className="text-sm font-semibold text-slate-900 mb-2">Ngôn ngữ giao tiếp</h4>
                            <p className="text-sm text-slate-600">{teammate.profile.languages.join(', ')}</p>
                        </div>
                    )}

                    {/* Secondary Roles */}
                    {teammate.profile.secondaryRoles.length > 0 && (
                        <div className="mb-6">
                            <h4 className="text-sm font-semibold text-slate-900 mb-2">Vai trò phụ</h4>
                            <div className="flex flex-wrap gap-1.5">
                                {teammate.profile.secondaryRoles.map(role => (
                                    <Badge key={role} className="bg-slate-100 text-slate-600 border-slate-200">
                                        {role}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex gap-3">
                    <Button
                        variant="secondary"
                        onClick={() => {
                            onViewProfile?.(teammate.id);
                            onClose();
                        }}
                        className="flex-1"
                    >
                        <Users className="w-4 h-4 mr-2" />
                        Xem hồ sơ
                    </Button>
                    <Button
                        onClick={() => {
                            onInvite?.(teammate.id);
                            onClose();
                        }}
                        className="flex-1"
                    >
                        <UserPlus className="w-4 h-4 mr-2" />
                        Mời vào team
                    </Button>
                </div>
            </div>
        </div>
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
    const [selectedTeammate, setSelectedTeammate] = useState<TeammateRecommendation | null>(null);

    const isLoggedIn = !!localStorage.getItem('auth_token');

    const handleViewDetails = (teammate: TeammateRecommendation) => {
        setSelectedTeammate(teammate);
    };

    const handleCloseModal = () => {
        setSelectedTeammate(null);
    };

    const handleViewProfile = (id: string) => {
        if (onViewProfile) {
            onViewProfile(id);
        } else {
            navigate(`/user/${id}`);
        }
    };

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

                    {/* Horizontal Cards Layout */}
                    <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
                        {recommendations.map((teammate, index) => (
                            <TeammateCard
                                key={teammate.id}
                                teammate={teammate}
                                index={index}
                                onViewProfile={handleViewProfile}
                                onInvite={onInvite}
                                onViewDetails={handleViewDetails}
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

            {/* Detail Modal */}
            <TeammateDetailModal
                teammate={selectedTeammate}
                onClose={handleCloseModal}
                onViewProfile={handleViewProfile}
                onInvite={onInvite}
            />
        </Card>
    );
};

export default TeammateRecommendations;

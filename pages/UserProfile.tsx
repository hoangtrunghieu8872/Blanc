import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
    User, MapPin, Briefcase, Code, Award, BookOpen, Trophy,
    Calendar, Lock, ArrowLeft, Loader2, ExternalLink,
    Users, MessageCircle, Globe, Star, CheckCircle, Clock
} from 'lucide-react';
import { Card, Button, Badge } from '../components/ui/Common';
import { api } from '../lib/api';

interface PublicProfile {
    id: string;
    name: string;
    email?: string;
    avatar: string | null;
    bio: string;
    isOwnProfile: boolean;
    isPrivate?: boolean;
    message?: string;
    createdAt: string;
    privacy?: {
        showProfile: boolean;
        showActivity: boolean;
        showAchievements: boolean;
    };
    matchingProfile: {
        primaryRole: string;
        secondaryRoles: string[];
        experienceLevel: string;
        location: string;
        skills: string[];
        techStack: string[];
        languages: string[];
        openToNewTeams: boolean;
        openToMentor: boolean;
    } | null;
    contestPreferences: {
        contestInterests: string[];
        preferredTeamRole: string;
        preferredTeamSize: string;
    } | null;
    streak: {
        currentStreak: number;
        longestStreak: number;
    } | null;
    activities: Array<{
        type: string;
        title: string;
        date: string;
        status: string;
    }> | null;
    enrollments: Array<{
        title: string;
        progress: number;
        status: string;
        enrolledAt: string;
    }> | null;
    achievements: {
        totalContests: number;
        completedCourses: number;
        contestAchievements: string;
        portfolioLinks: string[];
    } | null;
}

const UserProfile: React.FC = () => {
    const { id: userId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [profile, setProfile] = useState<PublicProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchProfile = async () => {
            if (!userId) {
                setError('User ID không hợp lệ');
                setIsLoading(false);
                return;
            }

            // Validate MongoDB ObjectId format (24 hex characters)
            const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(userId);
            if (!isValidObjectId) {
                setError('User ID không hợp lệ');
                setIsLoading(false);
                return;
            }

            try {
                setIsLoading(true);
                setError(null);
                const data = await api.get<PublicProfile>(`/users/${userId}/profile`);
                setProfile(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Không thể tải hồ sơ');
            } finally {
                setIsLoading(false);
            }
        };

        fetchProfile();
    }, [userId]);

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    const getExperienceLevelLabel = (level: string) => {
        const labels: Record<string, string> = {
            beginner: 'Mới bắt đầu',
            intermediate: 'Trung cấp',
            advanced: 'Nâng cao',
            expert: 'Chuyên gia'
        };
        return labels[level] || level;
    };

    if (isLoading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <Loader2 className="w-10 h-10 animate-spin text-primary-600" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
                <p className="text-red-500">{error}</p>
                <Button onClick={() => navigate(-1)}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Quay lại
                </Button>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
                <p className="text-slate-500">Không tìm thấy hồ sơ người dùng</p>
                <Button onClick={() => navigate(-1)}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Quay lại
                </Button>
            </div>
        );
    }

    // Private profile view
    if (profile.isPrivate) {
        return (
            <div className="max-w-2xl mx-auto px-4 py-8">
                <Button variant="secondary" onClick={() => navigate(-1)} className="mb-6">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Quay lại
                </Button>

                <Card className="p-8 text-center">
                    <div className="w-24 h-24 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center">
                        <Lock className="w-10 h-10 text-slate-400" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 mb-2">{profile.name}</h2>
                    <p className="text-slate-500">{profile.message}</p>
                </Card>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            {/* Back button */}
            <Button variant="secondary" onClick={() => navigate(-1)} className="mb-6">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Quay lại
            </Button>

            {/* Profile Header */}
            <Card className="p-6 mb-6">
                <div className="flex flex-col sm:flex-row gap-6">
                    {/* Avatar */}
                    <div className="shrink-0">
                        {profile.avatar ? (
                            <img
                                src={profile.avatar}
                                alt={profile.name}
                                className="w-28 h-28 rounded-full object-cover border-4 border-white shadow-lg"
                            />
                        ) : (
                            <div className="w-28 h-28 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                                {profile.name.charAt(0).toUpperCase()}
                            </div>
                        )}
                    </div>

                    {/* Info */}
                    <div className="flex-1">
                        <div className="flex items-start justify-between">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900">{profile.name}</h1>
                                {profile.matchingProfile?.primaryRole && (
                                    <p className="text-primary-600 font-medium mt-1">
                                        {profile.matchingProfile.primaryRole}
                                    </p>
                                )}
                            </div>

                            {/* Streak Badge */}
                            {profile.streak && profile.streak.currentStreak > 0 && (
                                <div className="group relative inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold tabular-nums bg-linear-to-r from-orange-400 to-red-500 text-white shadow-sm ring-1 ring-white/25 overflow-hidden">
                                    {profile.streak.currentStreak >= 3 && (
                                        <span
                                            className="pointer-events-none absolute inset-y-0 left-0 w-[42%] bg-linear-to-r from-white/0 via-white/45 to-white/0 opacity-30 animate-streak-shine"
                                            aria-hidden="true"
                                        />
                                    )}

                                    <span className="relative grid place-items-center w-7 h-7 overflow-visible" aria-hidden="true">
                                        <img src="/streak/flame-tight.gif" className="streak-motion w-[150%] h-[150%] -translate-y-[18%] object-contain mix-blend-screen brightness-110 saturate-150 contrast-125" alt="" aria-hidden="true" />
                                        <img src="/streak/flame-tight.png" className="streak-reduce-motion w-[150%] h-[150%] -translate-y-[18%] object-contain mix-blend-screen brightness-110 saturate-150 contrast-125" alt="" aria-hidden="true" />
                                    </span>

                                    <span className="relative font-extrabold leading-none">{profile.streak.currentStreak}</span>
                                    <span className="text-sm font-medium opacity-90">ngày</span>

                                    {/* star removed */}
                                </div>
                            )}
                        </div>

                        {/* Bio */}
                        {profile.bio && (
                            <p className="text-slate-600 mt-3">{profile.bio}</p>
                        )}

                        {/* Tags */}
                        <div className="flex flex-wrap gap-2 mt-4">
                            {profile.matchingProfile?.location && (
                                <span className="inline-flex items-center gap-1 text-sm text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
                                    <MapPin className="w-3.5 h-3.5" />
                                    {profile.matchingProfile.location}
                                </span>
                            )}
                            {profile.matchingProfile?.experienceLevel && (
                                <span className="inline-flex items-center gap-1 text-sm text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
                                    <Briefcase className="w-3.5 h-3.5" />
                                    {getExperienceLevelLabel(profile.matchingProfile.experienceLevel)}
                                </span>
                            )}
                            {profile.matchingProfile?.openToNewTeams && (
                                <span className="inline-flex items-center gap-1 text-sm text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                                    <Users className="w-3.5 h-3.5" />
                                    Sẵn sàng tìm đội
                                </span>
                            )}
                            {profile.matchingProfile?.openToMentor && (
                                <span className="inline-flex items-center gap-1 text-sm text-purple-600 bg-purple-50 px-3 py-1 rounded-full">
                                    <Star className="w-3.5 h-3.5" />
                                    Có thể mentor
                                </span>
                            )}
                        </div>

                        {/* Member since */}
                        <p className="text-sm text-slate-400 mt-4">
                            <Calendar className="w-4 h-4 inline mr-1" />
                            Thành viên từ {formatDate(profile.createdAt)}
                        </p>
                    </div>
                </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Skills & Tech Stack */}
                    {profile.matchingProfile && (profile.matchingProfile.skills.length > 0 || profile.matchingProfile.techStack.length > 0) && (
                        <Card className="p-6">
                            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                                <Code className="w-5 h-5 text-primary-600" />
                                Kỹ năng & Công nghệ
                            </h3>

                            {profile.matchingProfile.skills.length > 0 && (
                                <div className="mb-4">
                                    <p className="text-sm font-medium text-slate-500 mb-2">Kỹ năng</p>
                                    <div className="flex flex-wrap gap-2">
                                        {profile.matchingProfile.skills.map((skill, i) => (
                                            <span key={i} className="px-3 py-1 bg-primary-50 text-primary-700 rounded-full text-sm">
                                                {skill}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {profile.matchingProfile.techStack.length > 0 && (
                                <div>
                                    <p className="text-sm font-medium text-slate-500 mb-2">Tech Stack</p>
                                    <div className="flex flex-wrap gap-2">
                                        {profile.matchingProfile.techStack.map((tech, i) => (
                                            <span key={i} className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm">
                                                {tech}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {profile.matchingProfile.languages.length > 0 && (
                                <div className="mt-4">
                                    <p className="text-sm font-medium text-slate-500 mb-2">Ngôn ngữ</p>
                                    <div className="flex flex-wrap gap-2">
                                        {profile.matchingProfile.languages.map((lang, i) => (
                                            <span key={i} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
                                                <Globe className="w-3.5 h-3.5" />
                                                {lang}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </Card>
                    )}

                    {/* Activities */}
                    {profile.activities && profile.activities.length > 0 && (
                        <Card className="p-6">
                            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                                <Trophy className="w-5 h-5 text-primary-600" />
                                Hoạt động gần đây
                            </h3>
                            <div className="space-y-3">
                                {profile.activities.map((activity, i) => (
                                    <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                                        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                                            <Trophy className="w-5 h-5 text-primary-600" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-medium text-slate-900">{activity.title}</p>
                                            <p className="text-sm text-slate-500">
                                                <Clock className="w-3 h-3 inline mr-1" />
                                                {formatDate(activity.date)}
                                            </p>
                                        </div>
                                        <Badge status={activity.status === 'registered' ? 'OPEN' : 'CLOSED'}>
                                            {activity.status === 'registered' ? 'Đã đăng ký' : activity.status}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}

                    {/* Course Enrollments */}
                    {profile.enrollments && profile.enrollments.length > 0 && (
                        <Card className="p-6">
                            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                                <BookOpen className="w-5 h-5 text-primary-600" />
                                Khóa học
                            </h3>
                            <div className="space-y-3">
                                {profile.enrollments.map((enrollment, i) => (
                                    <div key={i} className="p-3 bg-slate-50 rounded-lg">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="font-medium text-slate-900">{enrollment.title}</p>
                                            {enrollment.status === 'completed' ? (
                                                <span className="inline-flex items-center gap-1 text-sm text-emerald-600">
                                                    <CheckCircle className="w-4 h-4" />
                                                    Hoàn thành
                                                </span>
                                            ) : null}
                                         </div>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                    {/* Achievements */}
                    {profile.achievements && (
                        <Card className="p-6">
                            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                                <Award className="w-5 h-5 text-primary-600" />
                                Thành tích
                            </h3>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="text-center p-3 bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg">
                                    <Trophy className="w-6 h-6 mx-auto text-amber-500 mb-1" />
                                    <p className="text-2xl font-bold text-slate-900">{profile.achievements.totalContests}</p>
                                    <p className="text-xs text-slate-500">Cuộc thi</p>
                                </div>
                                <div className="text-center p-3 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-lg">
                                    <BookOpen className="w-6 h-6 mx-auto text-emerald-500 mb-1" />
                                    <p className="text-2xl font-bold text-slate-900">{profile.achievements.completedCourses}</p>
                                    <p className="text-xs text-slate-500">Khóa học hoàn thành</p>
                                </div>
                            </div>

                            {profile.streak && (
                                <div className="p-3 bg-gradient-to-br from-orange-50 to-red-50 rounded-lg mb-4">
                                    <div className="flex items-center gap-3">
                                        <img src="/streak/flame-tight.gif" className="streak-motion w-8 h-8 object-contain mix-blend-screen" alt="" aria-hidden="true" />
                                        <img src="/streak/flame-tight.png" className="streak-reduce-motion w-8 h-8 object-contain mix-blend-screen" alt="" aria-hidden="true" />
                                        <div>
                                            <p className="font-bold text-slate-900">{profile.streak.longestStreak} ngày</p>
                                            <p className="text-xs text-slate-500">Chuỗi dài nhất</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {profile.achievements.contestAchievements && (
                                <div className="mt-4">
                                    <p className="text-sm font-medium text-slate-500 mb-2">Thành tích nổi bật</p>
                                    <p className="text-sm text-slate-700">{profile.achievements.contestAchievements}</p>
                                </div>
                            )}

                            {profile.achievements.portfolioLinks.length > 0 && (
                                <div className="mt-4">
                                    <p className="text-sm font-medium text-slate-500 mb-2">Portfolio</p>
                                    <div className="space-y-2">
                                        {profile.achievements.portfolioLinks.map((link, i) => (
                                            <a
                                                key={i}
                                                href={link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 hover:underline"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                                {new URL(link).hostname}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </Card>
                    )}

                    {/* Contest Interests */}
                    {profile.contestPreferences && profile.contestPreferences.contestInterests.length > 0 && (
                        <Card className="p-6">
                            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                                <Trophy className="w-5 h-5 text-primary-600" />
                                Quan tâm
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {profile.contestPreferences.contestInterests.map((interest, i) => (
                                    <span key={i} className="px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-sm">
                                        {interest}
                                    </span>
                                ))}
                            </div>

                            {profile.contestPreferences.preferredTeamRole && (
                                <div className="mt-4 pt-4 border-t border-slate-100">
                                    <p className="text-sm text-slate-500">
                                        <Users className="w-4 h-4 inline mr-1" />
                                        Vai trò ưa thích: <span className="text-slate-900">{profile.contestPreferences.preferredTeamRole}</span>
                                    </p>
                                    {profile.contestPreferences.preferredTeamSize && (
                                        <p className="text-sm text-slate-500 mt-1">
                                            Team size: <span className="text-slate-900">{profile.contestPreferences.preferredTeamSize} người</span>
                                        </p>
                                    )}
                                </div>
                            )}
                        </Card>
                    )}

                    {/* Secondary Roles */}
                    {profile.matchingProfile && profile.matchingProfile.secondaryRoles.length > 0 && (
                        <Card className="p-6">
                            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                                <Briefcase className="w-5 h-5 text-primary-600" />
                                Vai trò phụ
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {profile.matchingProfile.secondaryRoles.map((role, i) => (
                                    <span key={i} className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm">
                                        {role}
                                    </span>
                                ))}
                            </div>
                        </Card>
                    )}
                </div>
            </div>

            {/* Own profile link */}
            {profile.isOwnProfile && (
                <div className="mt-6 text-center">
                    <Link to="/profile" className="text-primary-600 hover:text-primary-700 hover:underline">
                        Chỉnh sửa hồ sơ của bạn →
                    </Link>
                </div>
            )}
        </div>
    );
};

export default UserProfile;

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { X, Users, Calendar, MapPin, Clock, MessageCircle, UserPlus, ExternalLink, Mail, Award, Briefcase, Tag, ChevronDown, ChevronUp, Settings, Crown } from 'lucide-react';
import { Button, Badge } from './ui/Common';
import UserAvatar from './UserAvatar';
import { TeamPost, RoleSlot } from '../types';
import { api } from '../lib/api';

interface TeamPostDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    post: TeamPost | null;
    onJoinRequest?: (postId: string) => void;
    onManageMembers?: () => void;
    currentUserId?: string;
}

const ROLE_COLORS: Record<string, string> = {
    'Frontend Dev': 'bg-blue-50 text-blue-700 border-blue-200',
    'Backend Dev': 'bg-green-50 text-green-700 border-green-200',
    'Fullstack Dev': 'bg-indigo-50 text-indigo-700 border-indigo-200',
    'Mobile Dev': 'bg-cyan-50 text-cyan-700 border-cyan-200',
    'UI/UX Designer': 'bg-purple-50 text-purple-700 border-purple-200',
    'Graphic Designer': 'bg-pink-50 text-pink-700 border-pink-200',
    'Business Analyst': 'bg-amber-50 text-amber-700 border-amber-200',
    'Product Manager': 'bg-orange-50 text-orange-700 border-orange-200',
    'Data Analyst': 'bg-teal-50 text-teal-700 border-teal-200',
    'DevOps': 'bg-slate-100 text-slate-700 border-slate-200',
    'QA/Tester': 'bg-lime-50 text-lime-700 border-lime-200',
    'Pitching': 'bg-rose-50 text-rose-700 border-rose-200',
    'Content Writer': 'bg-violet-50 text-violet-700 border-violet-200',
    'Marketing': 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
    'Other': 'bg-gray-50 text-gray-700 border-gray-200'
};

const TeamPostDetailModal: React.FC<TeamPostDetailModalProps> = ({
    isOpen,
    onClose,
    post,
    onJoinRequest,
    onManageMembers,
    currentUserId
}) => {
    const [isRequesting, setIsRequesting] = useState(false);
    const [requestSent, setRequestSent] = useState(false);
    const [message, setMessage] = useState('');
    const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set());

    if (!isOpen || !post) return null;

    const isOwner = currentUserId === post.createdBy.id;

    const toggleRoleExpanded = (role: string) => {
        setExpandedRoles(prev => {
            const newSet = new Set(prev);
            if (newSet.has(role)) {
                newSet.delete(role);
            } else {
                newSet.add(role);
            }
            return newSet;
        });
    };

    const getInitials = (name?: string) => {
        if (!name) return '??';
        return name
            .split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    const formatRelativeDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Hôm nay';
        if (diffDays === 1) return 'Hôm qua';
        if (diffDays < 7) return `${diffDays} ngày trước`;
        return formatDate(dateStr);
    };

    const handleJoinRequest = async () => {
        if (!localStorage.getItem('user')) {
            window.dispatchEvent(new CustomEvent('show-auth-modal', { detail: { mode: 'login' } }));
            return;
        }

        setIsRequesting(true);
        try {
            await api.post(`/teams/${post.id}/join`, { message });
            setRequestSent(true);
            onJoinRequest?.(post.id);
        } catch (err: any) {
            console.error('Failed to send join request:', err);
            const errorMessage = err.response?.data?.error || 'Không thể gửi yêu cầu. Vui lòng thử lại sau.';
            alert(errorMessage);
        } finally {
            setIsRequesting(false);
        }
    };

    const isFull = post.currentMembers >= post.maxMembers;
    const spotsLeft = post.maxMembers - post.currentMembers;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="flex min-h-full items-center justify-center p-4">
                <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                    {/* Header */}
                    <div className="relative bg-linear-to-r from-primary-500 to-primary-600 px-6 py-8 text-white">
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                            title="Đóng"
                            aria-label="Đóng"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="flex items-start gap-4">
                            <UserAvatar
                                userId={post.createdBy.id}
                                name={post.createdBy.name}
                                avatar={post.createdBy.avatar}
                                size="lg"
                                className="[&_img]:rounded-xl [&_div]:rounded-xl"
                            />
                            <div className="flex-1 min-w-0">
                                <h2 className="text-xl font-bold mb-1 line-clamp-2">{post.title}</h2>
                                {post.contestTitle && (
                                    <div className="flex items-center gap-2 text-white/80 text-sm">
                                        <Award className="w-4 h-4" />
                                        <span>{post.contestTitle}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-4 mt-2 text-white/70 text-sm">
                                    <span className="flex items-center gap-1">
                                        <Users className="w-4 h-4" />
                                        {post.currentMembers}/{post.maxMembers} thành viên
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Clock className="w-4 h-4" />
                                        {formatRelativeDate(post.createdAt)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
                        {/* Status Banner */}
                        {isFull ? (
                            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                                    <Users className="w-5 h-5 text-orange-600" />
                                </div>
                                <div>
                                    <p className="font-medium text-orange-800">Đội đã đủ thành viên</p>
                                    <p className="text-sm text-orange-600">Bạn vẫn có thể gửi yêu cầu để được xem xét khi có slot trống</p>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                                    <UserPlus className="w-5 h-5 text-green-600" />
                                </div>
                                <div>
                                    <p className="font-medium text-green-800">Đang tuyển thành viên</p>
                                    <p className="text-sm text-green-600">Còn {spotsLeft} vị trí trống trong đội</p>
                                </div>
                            </div>
                        )}

                        {/* Description */}
                        <div>
                            <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                                <Briefcase className="w-4 h-4 text-slate-400" />
                                Mô tả
                            </h3>
                            <p className="text-slate-600 whitespace-pre-wrap leading-relaxed">
                                {post.description}
                            </p>
                        </div>

                        {/* Roles Needed */}
                        <div>
                            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                <Users className="w-4 h-4 text-slate-400" />
                                Vị trí cần tuyển
                            </h3>

                            {/* Role details with slots */}
                            {post.roleSlots && post.roleSlots.length > 0 ? (
                                <div className="space-y-2">
                                    {post.roleSlots.map((slot: RoleSlot) => {
                                        const isExpanded = expandedRoles.has(slot.role);
                                        const hasDetails = slot.description || (slot.skills && slot.skills.length > 0);

                                        return (
                                            <div key={slot.role} className="border border-slate-200 rounded-xl overflow-hidden">
                                                <button
                                                    type="button"
                                                    onClick={() => hasDetails && toggleRoleExpanded(slot.role)}
                                                    className={`w-full flex items-center justify-between p-3 ${hasDetails ? 'hover:bg-slate-50 cursor-pointer' : 'cursor-default'} transition-colors`}
                                                    disabled={!hasDetails}
                                                    aria-label={hasDetails ? `${isExpanded ? 'Thu gọn' : 'Mở rộng'} chi tiết ${slot.role}` : slot.role}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <Badge className={`${ROLE_COLORS[slot.role] || ROLE_COLORS['Other']} px-3 py-1 text-sm border`}>
                                                            {slot.role}
                                                        </Badge>
                                                        <span className="text-sm text-slate-500">
                                                            Cần {slot.count} người
                                                        </span>
                                                    </div>
                                                    {hasDetails && (
                                                        isExpanded ? (
                                                            <ChevronUp className="w-4 h-4 text-slate-400" />
                                                        ) : (
                                                            <ChevronDown className="w-4 h-4 text-slate-400" />
                                                        )
                                                    )}
                                                </button>

                                                {isExpanded && hasDetails && (
                                                    <div className="px-4 pb-4 pt-2 bg-slate-50 border-t border-slate-100 space-y-3">
                                                        {slot.description && (
                                                            <div>
                                                                <p className="text-xs font-medium text-slate-500 mb-1">Nhiệm vụ:</p>
                                                                <p className="text-sm text-slate-700">{slot.description}</p>
                                                            </div>
                                                        )}
                                                        {slot.skills && slot.skills.length > 0 && (
                                                            <div>
                                                                <p className="text-xs font-medium text-slate-500 mb-1">Kỹ năng yêu cầu:</p>
                                                                <div className="flex flex-wrap gap-1.5">
                                                                    {slot.skills.map(skill => (
                                                                        <span key={skill} className="inline-flex items-center px-2 py-0.5 bg-primary-50 text-primary-700 rounded-md text-xs">
                                                                            {skill}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {post.rolesNeeded.map(role => (
                                        <Badge
                                            key={role}
                                            className={`${ROLE_COLORS[role] || ROLE_COLORS['Other']} px-3 py-1.5 text-sm border`}
                                        >
                                            {role}
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* General Skills */}
                        {post.skills && post.skills.length > 0 && (
                            <div>
                                <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                    <Tag className="w-4 h-4 text-slate-400" />
                                    Kỹ năng chung cần thiết
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {post.skills.map(skill => (
                                        <span
                                            key={skill}
                                            className="inline-flex items-center px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg text-sm font-medium"
                                        >
                                            {skill}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Deadline */}
                        {post.deadline && (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                                    <Calendar className="w-5 h-5 text-amber-600" />
                                </div>
                                <div>
                                    <p className="font-medium text-amber-800">Hạn chót đăng ký</p>
                                    <p className="text-sm text-amber-600">{formatDate(post.deadline)}</p>
                                </div>
                            </div>
                        )}

                        {/* Current Members */}
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                                    <Users className="w-4 h-4 text-slate-400" />
                                    Thành viên hiện tại ({post.members.length})
                                </h3>
                                {isOwner && onManageMembers && (
                                    <button
                                        onClick={onManageMembers}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
                                        title="Quản lý thành viên"
                                    >
                                        <Settings className="w-4 h-4" />
                                        Quản lý
                                    </button>
                                )}
                            </div>
                            <div className="space-y-2">
                                {post.members.map((member, index) => (
                                    <div key={member.id} className="p-3 bg-slate-50 rounded-xl">
                                        <div className="flex items-center gap-3">
                                            <Link
                                                to={`/user/${member.id}`}
                                                className="w-10 h-10 rounded-full bg-linear-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-semibold text-sm overflow-hidden shrink-0 hover:ring-2 hover:ring-primary-300 transition-all"
                                                title={`Xem hồ sơ của ${member.name}`}
                                            >
                                                {member.avatar ? (
                                                    <img src={member.avatar} alt={member.name} className="w-full h-full object-cover rounded-full" />
                                                ) : (
                                                    <span>{getInitials(member.name)}</span>
                                                )}
                                            </Link>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <Link
                                                        to={`/user/${member.id}`}
                                                        className="font-medium text-slate-900 truncate hover:text-primary-600 transition-colors"
                                                    >
                                                        {member.name}
                                                    </Link>
                                                    {index === 0 && (
                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">
                                                            <Crown className="w-3 h-3" />
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-slate-500">
                                                    {index === 0 ? 'Trưởng nhóm' : 'Thành viên'}
                                                </p>
                                            </div>
                                            {member.role && (
                                                <Badge className={ROLE_COLORS[member.role] || ROLE_COLORS['Other']}>
                                                    {member.role}
                                                </Badge>
                                            )}
                                        </div>
                                        {/* Show task if available */}
                                        {member.task && (
                                            <div className="mt-2 ml-13 pl-[52px]">
                                                <p className="text-xs font-medium text-slate-500">Nhiệm vụ:</p>
                                                <p className="text-sm text-slate-600 mt-0.5">{member.task}</p>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Invited Members */}
                        {post.invitedMembers && post.invitedMembers.length > 0 && (
                            <div>
                                <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                    <UserPlus className="w-4 h-4 text-slate-400" />
                                    Đã mời ({post.invitedMembers.length})
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {post.invitedMembers.map((member) => (
                                        <div
                                            key={member.id}
                                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full"
                                            title={member.email || member.name}
                                        >
                                            {member.avatar ? (
                                                <img
                                                    src={member.avatar}
                                                    alt={member.name}
                                                    className="w-5 h-5 rounded-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-5 h-5 rounded-full bg-amber-200 flex items-center justify-center">
                                                    <span className="text-xs font-medium text-amber-700">
                                                        {member.name.charAt(0).toUpperCase()}
                                                    </span>
                                                </div>
                                            )}
                                            <span className="text-sm font-medium text-amber-800">{member.name}</span>
                                            <span className="text-xs text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">Đang chờ</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Contact / Join Section */}
                        {!requestSent ? (
                            <div className="bg-slate-50 rounded-xl p-4 space-y-4">
                                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                                    <MessageCircle className="w-4 h-4 text-slate-400" />
                                    Gửi yêu cầu tham gia
                                </h3>
                                <textarea
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder="Giới thiệu bản thân và lý do muốn tham gia đội..."
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
                                    rows={3}
                                />
                                <div className="flex gap-3">
                                    <Button
                                        onClick={handleJoinRequest}
                                        disabled={isRequesting}
                                        className="flex-1"
                                    >
                                        {isRequesting ? (
                                            <>Đang gửi...</>
                                        ) : (
                                            <>
                                                <UserPlus className="w-4 h-4 mr-2" />
                                                Gửi yêu cầu tham gia
                                            </>
                                        )}
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        onClick={() => {
                                            // Open email client to contact post creator
                                            const email = post.createdBy.email;
                                            if (email) {
                                                const subject = encodeURIComponent(`[Blanc] Về bài đăng: ${post.title}`);
                                                const body = encodeURIComponent(`Xin chào ${post.createdBy.name},\n\nTôi quan tâm đến bài đăng tuyển thành viên "${post.title}" của bạn.\n\n`);
                                                window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
                                            } else {
                                                alert('Người đăng chưa cung cấp email liên hệ. Vui lòng gửi yêu cầu tham gia để liên lạc.');
                                            }
                                        }}
                                    >
                                        <Mail className="w-4 h-4 mr-2" />
                                        Liên hệ
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                                <div className="w-12 h-12 mx-auto mb-3 bg-green-100 rounded-full flex items-center justify-center">
                                    <UserPlus className="w-6 h-6 text-green-600" />
                                </div>
                                <h4 className="font-semibold text-green-800 mb-1">Đã gửi yêu cầu!</h4>
                                <p className="text-sm text-green-600">
                                    Trưởng nhóm sẽ xem xét và phản hồi yêu cầu của bạn sớm nhất.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                        <div className="text-sm text-slate-500 flex items-center gap-2">
                            Đăng bởi{' '}
                            <UserAvatar
                                userId={post.createdBy.id}
                                name={post.createdBy.name}
                                avatar={post.createdBy.avatar}
                                size="xs"
                                showName
                            />
                        </div>
                        <Button variant="secondary" onClick={onClose}>
                            Đóng
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TeamPostDetailModal;

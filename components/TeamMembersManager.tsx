import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { X, Users, Edit2, Save, Trash2, AlertCircle, Check, Loader2, UserMinus, Crown } from 'lucide-react';
import { Button, Badge, Dropdown } from './ui/Common';
import { TeamPost } from '../types';
import { api } from '../lib/api';

interface TeamMembersManagerProps {
    isOpen: boolean;
    onClose: () => void;
    post: TeamPost | null;
    onUpdate?: () => void;
}

const ROLES = [
    'Frontend Dev',
    'Backend Dev',
    'Fullstack Dev',
    'Mobile Dev',
    'UI/UX Designer',
    'Graphic Designer',
    'Business Analyst',
    'Product Manager',
    'Data Analyst',
    'DevOps',
    'QA/Tester',
    'Pitching',
    'Content Writer',
    'Marketing',
    'Other'
];

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

interface MemberEdit {
    id: string;
    role: string;
    task: string;
}

const TeamMembersManager: React.FC<TeamMembersManagerProps> = ({
    isOpen,
    onClose,
    post,
    onUpdate
}) => {
    const [members, setMembers] = useState<MemberEdit[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Initialize members from post
    useEffect(() => {
        if (post?.members) {
            setMembers(post.members.map(m => ({
                id: m.id,
                role: m.role || '',
                task: m.task || ''
            })));
        }
    }, [post]);

    const handleSave = async (memberId: string) => {
        if (!post) return;

        const member = members.find(m => m.id === memberId);
        if (!member) return;

        setIsSaving(true);
        setError(null);

        try {
            await api.patch(`/teams/${post.id}/members/${memberId}`, {
                role: member.role,
                task: member.task
            });

            setSuccess('Đã cập nhật thành công!');
            setEditingId(null);
            onUpdate?.();

            setTimeout(() => setSuccess(null), 2000);
        } catch (err: any) {
            setError(err.message || 'Không thể cập nhật. Vui lòng thử lại.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleRemoveMember = async (memberId: string) => {
        if (!post) return;

        const memberName = post.members.find(m => m.id === memberId)?.name || 'thành viên này';
        if (!confirm(`Bạn có chắc muốn xóa ${memberName} khỏi nhóm?`)) return;

        setIsSaving(true);
        setError(null);

        try {
            await api.delete(`/teams/${post.id}/members/${memberId}`);
            setSuccess('Đã xóa thành viên!');
            onUpdate?.();

            setTimeout(() => setSuccess(null), 2000);
        } catch (err: any) {
            setError(err.message || 'Không thể xóa thành viên. Vui lòng thử lại.');
        } finally {
            setIsSaving(false);
        }
    };

    const updateMember = (memberId: string, field: 'role' | 'task', value: string) => {
        setMembers(prev => prev.map(m =>
            m.id === memberId ? { ...m, [field]: value } : m
        ));
    };

    const getInitials = (name?: string) => {
        if (!name) return '??';
        return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    };

    if (!isOpen || !post) return null;

    const isOwner = (memberId: string) => memberId === post.createdBy.id;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="flex min-h-full items-center justify-center p-4">
                <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary-100 rounded-xl">
                                <Users className="w-5 h-5 text-primary-600" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-900">Quản lý thành viên</h2>
                                <p className="text-sm text-slate-500">Gán vai trò và nhiệm vụ cho từng thành viên</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            aria-label="Đóng"
                            title="Đóng"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                        {/* Alerts */}
                        {error && (
                            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                                <AlertCircle className="w-5 h-5 text-red-500" />
                                <p className="text-sm text-red-700">{error}</p>
                            </div>
                        )}

                        {success && (
                            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
                                <Check className="w-5 h-5 text-green-500" />
                                <p className="text-sm text-green-700">{success}</p>
                            </div>
                        )}

                        {/* Members List */}
                        <div className="space-y-3">
                            {post.members.map((member, index) => {
                                const memberEdit = members.find(m => m.id === member.id);
                                const isEditing = editingId === member.id;
                                const isLeader = isOwner(member.id);

                                return (
                                    <div
                                        key={member.id}
                                        className={`border rounded-xl overflow-hidden transition-all ${isEditing ? 'border-primary-300 shadow-md' : 'border-slate-200'
                                            }`}
                                    >
                                        {/* Member Header */}
                                        <div className="flex items-center gap-3 p-4 bg-slate-50">
                                            <Link
                                                to={`/user/${member.id}`}
                                                className="w-12 h-12 rounded-full bg-linear-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-semibold overflow-hidden shrink-0 hover:ring-2 hover:ring-primary-300 transition-all"
                                                title={`Xem hồ sơ của ${member.name}`}
                                            >
                                                {member.avatar ? (
                                                    <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    getInitials(member.name)
                                                )}
                                            </Link>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <Link
                                                        to={`/user/${member.id}`}
                                                        className="font-semibold text-slate-900 truncate hover:text-primary-600 transition-colors"
                                                    >
                                                        {member.name}
                                                    </Link>
                                                    {isLeader && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                                                            <Crown className="w-3 h-3" />
                                                            Trưởng nhóm
                                                        </span>
                                                    )}
                                                </div>
                                                {memberEdit?.role && !isEditing && (
                                                    <Badge className={`mt-1 ${ROLE_COLORS[memberEdit.role] || ROLE_COLORS['Other']}`}>
                                                        {memberEdit.role}
                                                    </Badge>
                                                )}
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-2">
                                                {isEditing ? (
                                                    <>
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleSave(member.id)}
                                                            disabled={isSaving}
                                                        >
                                                            {isSaving ? (
                                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                            ) : (
                                                                <>
                                                                    <Save className="w-4 h-4 mr-1" />
                                                                    Lưu
                                                                </>
                                                            )}
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => setEditingId(null)}
                                                        >
                                                            Hủy
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button
                                                            onClick={() => setEditingId(member.id)}
                                                            className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                                                            title="Chỉnh sửa"
                                                            aria-label={`Chỉnh sửa ${member.name}`}
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                        {!isLeader && (
                                                            <button
                                                                onClick={() => handleRemoveMember(member.id)}
                                                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                title="Xóa khỏi nhóm"
                                                                aria-label={`Xóa ${member.name} khỏi nhóm`}
                                                            >
                                                                <UserMinus className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Edit Form */}
                                        {isEditing && memberEdit && (
                                            <div className="p-4 space-y-4 bg-white border-t border-slate-100">
                                                {/* Role Selection */}
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                                        Vai trò trong nhóm
                                                    </label>
                                                    <div className="flex flex-wrap gap-2">
                                                        {ROLES.map(role => (
                                                            <button
                                                                key={role}
                                                                type="button"
                                                                onClick={() => updateMember(member.id, 'role', role)}
                                                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${memberEdit.role === role
                                                                    ? 'bg-primary-100 text-primary-700 border-2 border-primary-300'
                                                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-2 border-transparent'
                                                                    }`}
                                                            >
                                                                {role}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Task Assignment */}
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                                        Nhiệm vụ cụ thể
                                                    </label>
                                                    <textarea
                                                        value={memberEdit.task}
                                                        onChange={e => updateMember(member.id, 'task', e.target.value)}
                                                        placeholder="VD: Phát triển trang Dashboard, tích hợp API thanh toán..."
                                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all outline-none resize-none"
                                                        rows={3}
                                                        maxLength={500}
                                                    />
                                                    <p className="mt-1 text-xs text-slate-400">{memberEdit.task.length}/500 ký tự</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Show task when not editing */}
                                        {!isEditing && memberEdit?.task && (
                                            <div className="px-4 pb-4 bg-slate-50">
                                                <p className="text-xs font-medium text-slate-500 mb-1">Nhiệm vụ:</p>
                                                <p className="text-sm text-slate-700">{memberEdit.task}</p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                        <Button variant="secondary" onClick={onClose}>
                            Đóng
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TeamMembersManager;

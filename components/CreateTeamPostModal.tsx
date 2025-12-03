import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Users, Calendar, MessageSquare, AlertCircle, Loader2, Check, Plus, Minus, ChevronDown, ChevronUp, UserPlus, Search } from 'lucide-react';
import { Button, Card, Badge, Input, Dropdown, DropdownOption } from './ui/Common';
import { api } from '../lib/api';
import { TeamPostCreate, Contest, RoleSlot, TeamPost } from '../types';

interface InvitedMember {
    id: string;
    name: string;
    email?: string;
    avatar?: string;
    role?: string;
}

interface UserSearchResult {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    role?: string;
}

interface CreateTeamPostModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    editingPost?: TeamPost | null;
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

const CONTACT_METHODS = [
    { value: 'message', label: 'Nhắn tin trong app' },
    { value: 'email', label: 'Gửi email' },
    { value: 'both', label: 'Cả hai' }
];

const SKILL_SUGGESTIONS = [
    'React', 'Vue', 'Angular', 'Node.js', 'Python', 'Java', 'C++',
    'TypeScript', 'JavaScript', 'HTML/CSS', 'Tailwind', 'Bootstrap',
    'MongoDB', 'PostgreSQL', 'MySQL', 'Firebase', 'AWS', 'Docker',
    'Git', 'Figma', 'Adobe XD', 'Photoshop', 'Illustrator',
    'Machine Learning', 'Data Science', 'AI/ML', 'TensorFlow', 'PyTorch',
    'Flutter', 'React Native', 'Swift', 'Kotlin', 'Unity',
    'Agile/Scrum', 'Leadership', 'Communication', 'Problem Solving'
];

const CreateTeamPostModal: React.FC<CreateTeamPostModalProps> = ({ isOpen, onClose, onSuccess, editingPost = null }) => {
    const isEditMode = !!editingPost;
    
    const [formData, setFormData] = useState<TeamPostCreate>({
        title: '',
        description: '',
        contestId: '',
        rolesNeeded: [],
        roleSlots: [],
        maxMembers: 4,
        requirements: '',
        skills: [],
        contactMethod: 'both',
        deadline: '',
        invitedMembers: []
    });
    const [contests, setContests] = useState<Contest[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [skillInput, setSkillInput] = useState('');
    const [showSkillSuggestions, setShowSkillSuggestions] = useState(false);
    const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set());

    // User tagging states
    const [memberSearchQuery, setMemberSearchQuery] = useState('');
    const [memberSearchResults, setMemberSearchResults] = useState<UserSearchResult[]>([]);
    const [isSearchingMembers, setIsSearchingMembers] = useState(false);
    const [showMemberSuggestions, setShowMemberSuggestions] = useState(false);
    const memberSearchRef = useRef<HTMLDivElement>(null);
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Close member suggestions when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (memberSearchRef.current && !memberSearchRef.current.contains(event.target as Node)) {
                setShowMemberSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Fetch contests for dropdown
    useEffect(() => {
        if (isOpen) {
            setIsLoading(true);
            api.get<{ contests: Contest[] }>('/contests?status=OPEN&limit=50')
                .then(data => {
                    setContests(data.contests || []);
                })
                .catch(() => {
                    // Silent fail - contests are optional
                })
                .finally(() => {
                    setIsLoading(false);
                });
        }
    }, [isOpen]);

    // Reset form when modal closes OR populate with editing data
    useEffect(() => {
        if (!isOpen) {
            setFormData({
                title: '',
                description: '',
                contestId: '',
                rolesNeeded: [],
                roleSlots: [],
                maxMembers: 4,
                requirements: '',
                skills: [],
                contactMethod: 'both',
                deadline: '',
                invitedMembers: []
            });
            setError(null);
            setSuccess(false);
            setSkillInput('');
            setExpandedRoles(new Set());
            setMemberSearchQuery('');
            setMemberSearchResults([]);
            setShowMemberSuggestions(false);
        } else if (editingPost) {
            // Populate form with editing post data
            let deadlineValue = '';
            try {
                if (editingPost.deadline) {
                    const date = new Date(editingPost.deadline);
                    if (!isNaN(date.getTime())) {
                        deadlineValue = date.toISOString().split('T')[0];
                    }
                }
            } catch (e) {
                console.error('Error parsing deadline:', e);
            }
            
            setFormData({
                title: editingPost.title || '',
                description: editingPost.description || '',
                contestId: editingPost.contestId || '',
                rolesNeeded: Array.isArray(editingPost.rolesNeeded) ? editingPost.rolesNeeded : [],
                roleSlots: Array.isArray(editingPost.roleSlots) ? editingPost.roleSlots : [],
                maxMembers: editingPost.maxMembers || 4,
                requirements: editingPost.requirements || '',
                skills: Array.isArray(editingPost.skills) ? editingPost.skills : [],
                contactMethod: (['message', 'email', 'both'].includes(editingPost.contactMethod) 
                    ? editingPost.contactMethod 
                    : 'both') as 'message' | 'email' | 'both',
                deadline: deadlineValue,
                invitedMembers: []
            });
            setError(null);
            setSuccess(false);
        }
    }, [isOpen, editingPost]);

    // Search users for tagging
    const searchUsers = useCallback(async (query: string) => {
        console.log('[CreateTeamPostModal] searchUsers called with:', query);
        if (query.length < 2) {
            setMemberSearchResults([]);
            return;
        }

        setIsSearchingMembers(true);
        try {
            console.log('[CreateTeamPostModal] Calling API:', `/users/search?q=${encodeURIComponent(query)}&limit=8`);
            const data = await api.get<{ users: UserSearchResult[] }>(`/users/search?q=${encodeURIComponent(query)}&limit=8`);
            console.log('[CreateTeamPostModal] API response:', data);
            // Filter out already invited members
            const invitedIds = (formData.invitedMembers || []).map(m => m.id);
            setMemberSearchResults((data.users || []).filter(u => !invitedIds.includes(u.id)));
        } catch (err) {
            console.error('Failed to search users:', err);
            setMemberSearchResults([]);
        } finally {
            setIsSearchingMembers(false);
        }
    }, [formData.invitedMembers]);

    // Debounced search
    const handleMemberSearchChange = useCallback((value: string) => {
        console.log('[CreateTeamPostModal] handleMemberSearchChange:', value);
        setMemberSearchQuery(value);
        setShowMemberSuggestions(true);

        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        searchTimeoutRef.current = setTimeout(() => {
            console.log('[CreateTeamPostModal] Debounce timeout fired, calling searchUsers');
            searchUsers(value);
        }, 300);
    }, [searchUsers]);

    // Add invited member
    const addInvitedMember = useCallback((user: UserSearchResult) => {
        setFormData(prev => ({
            ...prev,
            invitedMembers: [...(prev.invitedMembers || []), {
                id: user.id,
                name: user.name,
                email: user.email,
                avatar: user.avatar
            }]
        }));
        setMemberSearchQuery('');
        setMemberSearchResults([]);
        setShowMemberSuggestions(false);
    }, []);

    // Remove invited member
    const removeInvitedMember = useCallback((userId: string) => {
        setFormData(prev => ({
            ...prev,
            invitedMembers: (prev.invitedMembers || []).filter(m => m.id !== userId)
        }));
    }, []);

    const handleRoleToggle = useCallback((role: string) => {
        setFormData(prev => {
            const isSelected = prev.rolesNeeded.includes(role);
            let newRolesNeeded: string[];
            let newRoleSlots: RoleSlot[];

            if (isSelected) {
                // Remove role
                newRolesNeeded = prev.rolesNeeded.filter(r => r !== role);
                newRoleSlots = (prev.roleSlots || []).filter(slot => slot.role !== role);
            } else if (prev.rolesNeeded.length < 5) {
                // Add role
                newRolesNeeded = [...prev.rolesNeeded, role];
                newRoleSlots = [...(prev.roleSlots || []), { role, count: 1, description: '', skills: [] }];
            } else {
                return prev;
            }

            return { ...prev, rolesNeeded: newRolesNeeded, roleSlots: newRoleSlots };
        });
    }, []);

    const updateRoleSlot = useCallback((role: string, updates: Partial<RoleSlot>) => {
        setFormData(prev => ({
            ...prev,
            roleSlots: (prev.roleSlots || []).map(slot =>
                slot.role === role ? { ...slot, ...updates } : slot
            )
        }));
    }, []);

    const toggleRoleExpanded = useCallback((role: string) => {
        setExpandedRoles(prev => {
            const newSet = new Set(prev);
            if (newSet.has(role)) {
                newSet.delete(role);
            } else {
                newSet.add(role);
            }
            return newSet;
        });
    }, []);

    const addSkill = useCallback((skill: string) => {
        const trimmedSkill = skill.trim();
        if (trimmedSkill && !(formData.skills || []).includes(trimmedSkill) && (formData.skills || []).length < 10) {
            setFormData(prev => ({
                ...prev,
                skills: [...(prev.skills || []), trimmedSkill]
            }));
        }
        setSkillInput('');
        setShowSkillSuggestions(false);
    }, [formData.skills]);

    const removeSkill = useCallback((skill: string) => {
        setFormData(prev => ({
            ...prev,
            skills: (prev.skills || []).filter(s => s !== skill)
        }));
    }, []);

    const filteredSuggestions = SKILL_SUGGESTIONS.filter(
        skill => skill.toLowerCase().includes(skillInput.toLowerCase()) &&
            !(formData.skills || []).includes(skill)
    ).slice(0, 8);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Client-side validation
        if (formData.title.trim().length < 10) {
            setError('Tiêu đề phải có ít nhất 10 ký tự');
            return;
        }
        if (formData.description.trim().length < 30) {
            setError('Mô tả phải có ít nhất 30 ký tự');
            return;
        }
        if (formData.rolesNeeded.length === 0) {
            setError('Vui lòng chọn ít nhất một vai trò cần tìm');
            return;
        }

        setIsSubmitting(true);

        try {
            const payload: TeamPostCreate = {
                ...formData,
                contestId: formData.contestId || undefined,
                deadline: formData.deadline || undefined,
                skills: formData.skills?.length ? formData.skills : undefined,
                roleSlots: formData.roleSlots?.length ? formData.roleSlots : undefined,
                invitedMembers: formData.invitedMembers?.length ? formData.invitedMembers : undefined
            };

            if (isEditMode && editingPost) {
                // Update existing post using PUT for full update
                await api.put(`/teams/${editingPost.id}`, payload);
            } else {
                // Create new post
                await api.post('/teams', payload);
            }
            setSuccess(true);

            setTimeout(() => {
                onSuccess?.();
                onClose();
            }, 1500);
        } catch (err) {
            setError(err instanceof Error ? err.message : isEditMode ? 'Có lỗi xảy ra khi cập nhật' : 'Có lỗi xảy ra khi đăng tin');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    // Calculate min date for deadline (tomorrow)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const minDate = tomorrow.toISOString().split('T')[0];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl">
                {/* Header */}
                <div className="sticky top-0 z-10 flex items-center justify-between p-6 bg-white border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary-100 rounded-xl">
                            <Users className="w-5 h-5 text-primary-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">
                                {isEditMode ? 'Chỉnh sửa bài đăng' : 'Đăng tin tìm đội'}
                            </h2>
                            <p className="text-sm text-slate-500">
                                {isEditMode ? 'Cập nhật thông tin bài đăng của bạn' : 'Tìm đồng đội cho cuộc thi của bạn'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Đóng"
                        title="Đóng"
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Success State */}
                {success ? (
                    <div className="p-12 text-center">
                        <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                            <Check className="w-8 h-8 text-green-600" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">
                            {isEditMode ? 'Cập nhật thành công!' : 'Đăng tin thành công!'}
                        </h3>
                        <p className="text-slate-500">
                            {isEditMode 
                                ? 'Bài đăng của bạn đã được cập nhật thành công.' 
                                : 'Bài đăng của bạn đã được tạo và đang chờ đồng đội tham gia.'}
                        </p>
                    </div>
                ) : (
                    /* Form */
                    <form onSubmit={handleSubmit} className="p-6 space-y-6">
                        {/* Error Alert */}
                        {error && (
                            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-xl">
                                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-medium text-red-800">Có lỗi xảy ra</p>
                                    <p className="text-sm text-red-600 mt-1">{error}</p>
                                </div>
                            </div>
                        )}

                        {/* Title */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Tiêu đề bài đăng <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.title}
                                onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                                placeholder="VD: Tìm Frontend Dev cho Hackathon 2024"
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all outline-none"
                                maxLength={100}
                                required
                            />
                            <p className="mt-1 text-xs text-slate-400">{formData.title.length}/100 ký tự</p>
                        </div>

                        {/* Contest Selection & Deadline */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Dropdown
                                label="Cuộc thi (không bắt buộc)"
                                placeholder="-- Chọn cuộc thi --"
                                headerText="Chọn cuộc thi"
                                value={formData.contestId || ''}
                                onChange={(value) => setFormData(prev => ({ ...prev, contestId: value }))}
                                disabled={isLoading}
                                options={[
                                    { value: '', label: '-- Không chọn cuộc thi --' },
                                    ...contests.map(contest => ({
                                        value: contest.id,
                                        label: `${contest.title} - ${contest.organizer}`
                                    }))
                                ]}
                            />

                            <div>
                                <label htmlFor="deadline-input" className="block text-sm font-medium text-slate-700 mb-2">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4" />
                                        Hạn chót tham gia
                                    </div>
                                </label>
                                <input
                                    id="deadline-input"
                                    type="date"
                                    value={formData.deadline || ''}
                                    onChange={e => setFormData(prev => ({ ...prev, deadline: e.target.value }))}
                                    min={minDate}
                                    title="Chọn hạn chót để đăng ký tham gia"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all outline-none"
                                />
                            </div>
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Mô tả chi tiết <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                value={formData.description}
                                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Mô tả về nhóm, mục tiêu, dự án, và những gì bạn đang tìm kiếm ở đồng đội..."
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all outline-none resize-none"
                                rows={4}
                                maxLength={1000}
                                required
                            />
                            <p className="mt-1 text-xs text-slate-400">{formData.description.length}/1000 ký tự</p>
                        </div>

                        {/* Roles Needed */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Vai trò cần tìm <span className="text-red-500">*</span>
                                <span className="text-slate-400 font-normal ml-2">(Chọn tối đa 5)</span>
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {ROLES.map(role => {
                                    const isSelected = formData.rolesNeeded.includes(role);
                                    const isDisabled = !isSelected && formData.rolesNeeded.length >= 5;
                                    return (
                                        <button
                                            key={role}
                                            type="button"
                                            onClick={() => handleRoleToggle(role)}
                                            disabled={isDisabled}
                                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${isSelected
                                                ? 'bg-primary-100 text-primary-700 border-2 border-primary-300'
                                                : isDisabled
                                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-2 border-transparent'
                                                }`}
                                        >
                                            {role}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Role Details - Expandable section for each selected role */}
                        {formData.rolesNeeded.length > 0 && (
                            <div className="space-y-3">
                                <label className="block text-sm font-medium text-slate-700">
                                    Chi tiết từng vị trí
                                    <span className="text-slate-400 font-normal ml-2">(Nhấn để mở rộng)</span>
                                </label>
                                <div className="space-y-2">
                                    {formData.rolesNeeded.map(role => {
                                        const slot = formData.roleSlots?.find(s => s.role === role) || { role, count: 1, description: '', skills: [] };
                                        const isExpanded = expandedRoles.has(role);

                                        return (
                                            <div key={role} className="border border-slate-200 rounded-xl overflow-hidden">
                                                {/* Role Header */}
                                                <button
                                                    type="button"
                                                    onClick={() => toggleRoleExpanded(role)}
                                                    className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                                                    aria-label={`${isExpanded ? 'Thu gọn' : 'Mở rộng'} chi tiết ${role}`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <span className="font-medium text-slate-700">{role}</span>
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-50 text-primary-700">
                                                            {slot.count} người
                                                        </span>
                                                    </div>
                                                    {isExpanded ? (
                                                        <ChevronUp className="w-4 h-4 text-slate-400" />
                                                    ) : (
                                                        <ChevronDown className="w-4 h-4 text-slate-400" />
                                                    )}
                                                </button>

                                                {/* Expanded Content */}
                                                {isExpanded && (
                                                    <div className="p-4 space-y-4 bg-white border-t border-slate-200">
                                                        {/* Number of people needed */}
                                                        <div>
                                                            <label className="block text-xs font-medium text-slate-600 mb-2">
                                                                Số lượng cần tuyển
                                                            </label>
                                                            <div className="flex items-center gap-3">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => updateRoleSlot(role, { count: Math.max(1, slot.count - 1) })}
                                                                    className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                                                                    disabled={slot.count <= 1}
                                                                    aria-label="Giảm số lượng"
                                                                >
                                                                    <Minus className="w-4 h-4" />
                                                                </button>
                                                                <span className="w-12 text-center font-medium text-slate-800">
                                                                    {slot.count}
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => updateRoleSlot(role, { count: Math.min(5, slot.count + 1) })}
                                                                    className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                                                                    disabled={slot.count >= 5}
                                                                    aria-label="Tăng số lượng"
                                                                >
                                                                    <Plus className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Task Description */}
                                                        <div>
                                                            <label className="block text-xs font-medium text-slate-600 mb-2">
                                                                Nhiệm vụ cụ thể
                                                            </label>
                                                            <textarea
                                                                value={slot.description || ''}
                                                                onChange={e => updateRoleSlot(role, { description: e.target.value })}
                                                                placeholder={`VD: Phát triển giao diện người dùng với React, tích hợp API...`}
                                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all outline-none resize-none"
                                                                rows={2}
                                                                maxLength={300}
                                                            />
                                                            <p className="mt-1 text-xs text-slate-400">{(slot.description || '').length}/300 ký tự</p>
                                                        </div>

                                                        {/* Role-specific skills */}
                                                        <div>
                                                            <label className="block text-xs font-medium text-slate-600 mb-2">
                                                                Kỹ năng yêu cầu cho vị trí này
                                                            </label>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {(slot.skills || []).map(skill => (
                                                                    <span
                                                                        key={skill}
                                                                        className="inline-flex items-center gap-1 px-2 py-1 bg-primary-50 text-primary-700 rounded-md text-xs"
                                                                    >
                                                                        {skill}
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => updateRoleSlot(role, {
                                                                                skills: (slot.skills || []).filter(s => s !== skill)
                                                                            })}
                                                                            className="hover:text-primary-900"
                                                                            aria-label={`Xóa kỹ năng ${skill}`}
                                                                        >
                                                                            <X className="w-3 h-3" />
                                                                        </button>
                                                                    </span>
                                                                ))}
                                                                {(slot.skills || []).length < 5 && (
                                                                    <select
                                                                        value=""
                                                                        onChange={e => {
                                                                            if (e.target.value) {
                                                                                updateRoleSlot(role, {
                                                                                    skills: [...(slot.skills || []), e.target.value]
                                                                                });
                                                                            }
                                                                        }}
                                                                        className="px-2 py-1 bg-slate-100 border border-slate-200 rounded-md text-xs text-slate-600 outline-none"
                                                                        title="Thêm kỹ năng cho vị trí này"
                                                                    >
                                                                        <option value="">+ Thêm kỹ năng</option>
                                                                        {SKILL_SUGGESTIONS.filter(s => !(slot.skills || []).includes(s)).slice(0, 15).map(skill => (
                                                                            <option key={skill} value={skill}>{skill}</option>
                                                                        ))}
                                                                    </select>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* General Skills */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Kỹ năng chung cần thiết
                                <span className="text-slate-400 font-normal ml-2">(Tối đa 10)</span>
                            </label>
                            <div className="space-y-2">
                                {/* Selected Skills */}
                                {(formData.skills || []).length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {(formData.skills || []).map(skill => (
                                            <span
                                                key={skill}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-100 text-primary-700 rounded-lg text-sm font-medium"
                                            >
                                                {skill}
                                                <button
                                                    type="button"
                                                    onClick={() => removeSkill(skill)}
                                                    className="hover:text-primary-900"
                                                    aria-label={`Xóa kỹ năng ${skill}`}
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Skill Input */}
                                {(formData.skills || []).length < 10 && (
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={skillInput}
                                            onChange={e => {
                                                setSkillInput(e.target.value);
                                                setShowSkillSuggestions(true);
                                            }}
                                            onFocus={() => setShowSkillSuggestions(true)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    addSkill(skillInput);
                                                }
                                            }}
                                            placeholder="Nhập kỹ năng và nhấn Enter..."
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all outline-none"
                                        />

                                        {/* Suggestions Dropdown */}
                                        {showSkillSuggestions && skillInput && filteredSuggestions.length > 0 && (
                                            <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                                {filteredSuggestions.map(skill => (
                                                    <button
                                                        key={skill}
                                                        type="button"
                                                        onClick={() => addSkill(skill)}
                                                        className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 transition-colors"
                                                    >
                                                        {skill}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Quick Suggestions */}
                                {(formData.skills || []).length < 10 && !skillInput && (
                                    <div className="flex flex-wrap gap-1.5">
                                        {SKILL_SUGGESTIONS.filter(s => !(formData.skills || []).includes(s)).slice(0, 8).map(skill => (
                                            <button
                                                key={skill}
                                                type="button"
                                                onClick={() => addSkill(skill)}
                                                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs transition-colors"
                                            >
                                                + {skill}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Invite Members (Gmail-style tagging) */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                <div className="flex items-center gap-2">
                                    <UserPlus className="w-4 h-4" />
                                    Mời thành viên tham gia
                                </div>
                                <span className="text-slate-400 font-normal ml-6 text-xs">Gõ tên hoặc email để tìm kiếm</span>
                            </label>

                            {/* Tagged/Invited Members Display */}
                            {(formData.invitedMembers || []).length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {(formData.invitedMembers || []).map(member => (
                                        <div
                                            key={member.id}
                                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary-50 border border-primary-200 rounded-full"
                                        >
                                            {member.avatar ? (
                                                <img
                                                    src={member.avatar}
                                                    alt={member.name}
                                                    className="w-5 h-5 rounded-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-5 h-5 rounded-full bg-primary-200 flex items-center justify-center">
                                                    <span className="text-xs font-medium text-primary-700">
                                                        {member.name.charAt(0).toUpperCase()}
                                                    </span>
                                                </div>
                                            )}
                                            <span className="text-sm font-medium text-primary-700">{member.name}</span>
                                            {member.email && (
                                                <span className="text-xs text-primary-500 hidden sm:inline">({member.email})</span>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => removeInvitedMember(member.id)}
                                                className="ml-1 p-0.5 hover:bg-primary-200 rounded-full transition-colors"
                                                aria-label={`Xóa ${member.name} khỏi danh sách mời`}
                                            >
                                                <X className="w-3.5 h-3.5 text-primary-600" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Search Input */}
                            <div className="relative" ref={memberSearchRef}>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        value={memberSearchQuery}
                                        onChange={e => handleMemberSearchChange(e.target.value)}
                                        onFocus={() => memberSearchQuery.length >= 2 && setShowMemberSuggestions(true)}
                                        placeholder="Nhập tên hoặc email để tìm kiếm..."
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all outline-none"
                                    />
                                    {isSearchingMembers && (
                                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
                                    )}
                                </div>

                                {/* Search Results Dropdown */}
                                {showMemberSuggestions && memberSearchQuery.length >= 2 && (
                                    <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                                        {isSearchingMembers ? (
                                            <div className="px-4 py-3 text-sm text-slate-500 text-center">
                                                <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                                                Đang tìm kiếm...
                                            </div>
                                        ) : memberSearchResults.length > 0 ? (
                                            memberSearchResults.map(user => (
                                                <button
                                                    key={user.id}
                                                    type="button"
                                                    onClick={() => addInvitedMember(user)}
                                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-100 last:border-b-0"
                                                >
                                                    {user.avatar && user.avatar.trim() ? (
                                                        <img
                                                            src={user.avatar}
                                                            alt={user.name}
                                                            className="w-9 h-9 rounded-full object-cover shrink-0"
                                                        />
                                                    ) : (
                                                        <div className="w-9 h-9 rounded-full bg-linear-to-br from-primary-400 to-primary-600 flex items-center justify-center shrink-0">
                                                            <span className="text-sm font-medium text-white">
                                                                {user.name?.charAt(0)?.toUpperCase() || '?'}
                                                            </span>
                                                        </div>
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium text-slate-800 truncate">{user.name}</p>
                                                        <p className="text-xs text-slate-500 truncate">{user.email}</p>
                                                    </div>
                                                    <Plus className="w-4 h-4 text-primary-500 shrink-0" />
                                                </button>
                                            ))
                                        ) : (
                                            <div className="px-4 py-3 text-sm text-slate-500 text-center">
                                                Không tìm thấy người dùng nào
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Max Members & Contact Method */}
                        <div className="grid grid-cols-2 gap-4">
                            <Dropdown
                                label="Số thành viên tối đa"
                                value={formData.maxMembers.toString()}
                                onChange={(value) => setFormData(prev => ({ ...prev, maxMembers: parseInt(value, 10) }))}
                                options={[2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => ({
                                    value: n.toString(),
                                    label: `${n} thành viên`
                                }))}
                            />

                            <Dropdown
                                label="Phương thức liên hệ"
                                value={formData.contactMethod}
                                onChange={(value) => setFormData(prev => ({ ...prev, contactMethod: value as 'message' | 'email' | 'both' }))}
                                options={CONTACT_METHODS.map(method => ({
                                    value: method.value,
                                    label: method.label
                                }))}
                            />
                        </div>

                        {/* Requirements */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Yêu cầu đặc biệt khác (không bắt buộc)
                            </label>
                            <textarea
                                value={formData.requirements}
                                onChange={e => setFormData(prev => ({ ...prev, requirements: e.target.value }))}
                                placeholder="VD: Có thể làm việc fulltime trong 2 tuần, đã từng tham gia hackathon..."
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all outline-none resize-none"
                                rows={3}
                                maxLength={500}
                            />
                            <p className="mt-1 text-xs text-slate-400">{formData.requirements?.length || 0}/500 ký tự</p>
                        </div>

                        {/* Submit */}
                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={onClose}
                                disabled={isSubmitting}
                            >
                                Hủy
                            </Button>
                            <Button
                                type="submit"
                                disabled={isSubmitting || formData.rolesNeeded.length === 0}
                                className="min-w-[140px]"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        {isEditMode ? 'Đang cập nhật...' : 'Đang đăng...'}
                                    </>
                                ) : (
                                    isEditMode ? 'Cập nhật bài đăng' : 'Đăng tin tìm đội'
                                )}
                            </Button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default CreateTeamPostModal;

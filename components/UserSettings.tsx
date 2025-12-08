import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Input, Card } from './ui/Common';
import { api, API_BASE_URL } from '../lib/api';
import {
    User, Mail, Lock, Bell, Shield, Eye, EyeOff,
    Camera, Loader2, CheckCircle, AlertCircle, Save,
    ChevronDown, Check, X, Search
} from 'lucide-react';
import {
    ROLES, ROLE_COLORS, EXPERIENCE_LEVELS, YEARS_EXPERIENCE,
    TIMEZONES, LANGUAGES, SKILLS, TECH_STACK, COMMUNICATION_TOOLS,
    REMOTE_PREFERENCES, AVAILABILITY_OPTIONS, COLLABORATION_STYLES,
    CONTEST_INTERESTS, CONTEST_FORMATS, TEAM_SIZES,
    STRENGTHS, LEARNING_GOALS, LOCATIONS_VN
} from '../constants/profileOptions';

// ============ CUSTOM DROPDOWN COMPONENT ============
interface DropdownOption {
    value: string;
    label: string;
}

interface CustomDropdownProps {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    options: DropdownOption[];
    placeholder?: string;
}

const CustomDropdown: React.FC<CustomDropdownProps> = ({
    label,
    value,
    onChange,
    options,
    placeholder = 'Chọn'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedOption = options.find(opt => opt.value === value);

    return (
        <div className="w-full">
            {label && <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>}
            <div className="relative" ref={dropdownRef}>
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className={`w-full px-3 py-2.5 bg-white rounded-lg text-sm border outline-none cursor-pointer transition-all flex items-center justify-between gap-2 hover:bg-slate-50 ${isOpen
                        ? 'ring-2 ring-primary-500 border-primary-500'
                        : 'border-slate-300'
                        } ${value ? 'text-slate-900' : 'text-slate-500'}`}
                >
                    <span className="truncate">{selectedOption?.label || placeholder}</span>
                    <div className="flex items-center gap-1">
                        {value && (
                            <span
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onChange('');
                                }}
                                className="p-0.5 hover:bg-slate-200 rounded-full transition-colors"
                            >
                                <X className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
                            </span>
                        )}
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </div>
                </button>

                {/* Dropdown Menu */}
                {isOpen && (
                    <div className="absolute top-full left-0 mt-2 w-full bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="max-h-[280px] overflow-y-auto p-2">
                            {/* Placeholder option */}
                            <button
                                type="button"
                                onClick={() => {
                                    onChange('');
                                    setIsOpen(false);
                                }}
                                className={`w-full px-3 py-2.5 rounded-lg text-sm text-left transition-all flex items-center justify-between ${!value
                                    ? 'bg-primary-50 text-primary-700 font-medium'
                                    : 'text-slate-600 hover:bg-slate-50'
                                    }`}
                            >
                                <span>{placeholder}</span>
                                {!value && <Check className="w-4 h-4 text-primary-600" />}
                            </button>
                            {/* Options */}
                            {options.filter(opt => opt.value).map(option => {
                                const isSelected = value === option.value;
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => {
                                            onChange(option.value);
                                            setIsOpen(false);
                                        }}
                                        className={`w-full px-3 py-2.5 rounded-lg text-sm text-left transition-all flex items-center justify-between ${isSelected
                                            ? 'bg-primary-50 text-primary-700 font-medium'
                                            : 'text-slate-600 hover:bg-slate-50'
                                            }`}
                                    >
                                        <span>{option.label}</span>
                                        {isSelected && <Check className="w-4 h-4 text-primary-600" />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ============ MULTI-SELECT TAG COMPONENT ============
interface MultiSelectTagsProps {
    label?: string;
    values: string[];
    onChange: (values: string[]) => void;
    options: readonly string[];
    placeholder?: string;
    maxItems?: number;
    colorMap?: Record<string, string>;
}

const MultiSelectTags: React.FC<MultiSelectTagsProps> = ({
    label,
    values,
    onChange,
    options,
    placeholder = 'Tìm và chọn...',
    maxItems = 10,
    colorMap
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredOptions = options.filter(opt =>
        opt.toLowerCase().includes(searchQuery.toLowerCase()) && !values.includes(opt)
    );

    const toggleValue = (val: string) => {
        if (values.includes(val)) {
            onChange(values.filter(v => v !== val));
        } else if (values.length < maxItems) {
            onChange([...values, val]);
        }
    };

    const removeValue = (val: string) => {
        onChange(values.filter(v => v !== val));
    };

    const getTagColor = (val: string) => {
        if (colorMap && colorMap[val]) {
            return colorMap[val];
        }
        return 'bg-slate-100 text-slate-700 border-slate-200';
    };

    return (
        <div className="w-full">
            {label && <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>}
            <div className="relative" ref={dropdownRef}>
                {/* Selected Tags */}
                <div
                    onClick={() => {
                        setIsOpen(true);
                        inputRef.current?.focus();
                    }}
                    className={`min-h-[42px] px-3 py-2 bg-white rounded-lg text-sm border cursor-text transition-all flex flex-wrap gap-1.5 items-center ${isOpen
                        ? 'ring-2 ring-primary-500 border-primary-500'
                        : 'border-slate-300'
                        }`}
                >
                    {values.map(val => (
                        <span
                            key={val}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${getTagColor(val)}`}
                        >
                            {val}
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    removeValue(val);
                                }}
                                className="hover:bg-black/10 rounded-full p-0.5 transition-colors"
                                title={`Xóa ${val}`}
                                aria-label={`Xóa ${val}`}
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </span>
                    ))}
                    {values.length < maxItems && (
                        <input
                            ref={inputRef}
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onFocus={() => setIsOpen(true)}
                            placeholder={values.length === 0 ? placeholder : ''}
                            className="flex-1 min-w-[100px] outline-none bg-transparent text-sm placeholder:text-slate-400"
                        />
                    )}
                </div>

                {/* Dropdown */}
                {isOpen && (
                    <div className="absolute top-full left-0 mt-2 w-full bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="p-2 border-b border-slate-100 flex items-center gap-2 text-slate-400">
                            <Search className="w-4 h-4" />
                            <span className="text-xs">Đã chọn {values.length}/{maxItems}</span>
                        </div>
                        <div className="max-h-60 overflow-y-auto p-2">
                            {filteredOptions.length === 0 ? (
                                <p className="text-sm text-slate-400 text-center py-3">
                                    {searchQuery ? 'Không tìm thấy' : 'Đã chọn hết'}
                                </p>
                            ) : (
                                filteredOptions.map(opt => (
                                    <button
                                        key={opt}
                                        type="button"
                                        onClick={() => {
                                            toggleValue(opt);
                                            setSearchQuery('');
                                        }}
                                        disabled={values.length >= maxItems}
                                        className="w-full px-3 py-2 rounded-lg text-sm text-left transition-all flex items-center justify-between text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <span className={`px-2 py-0.5 rounded-md text-xs font-medium border ${getTagColor(opt)}`}>
                                            {opt}
                                        </span>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
            {values.length >= maxItems && (
                <p className="mt-1 text-xs text-amber-600">Đã đạt giới hạn {maxItems} lựa chọn</p>
            )}
        </div>
    );
};

// ============ TYPES ============
interface MatchingProfile {
    primaryRole: string;
    secondaryRoles: string[];
    experienceLevel: string;
    yearsExperience: number | null;
    location: string;
    timeZone: string;
    languages: string[];
    skills: string[];
    techStack: string[];
    remotePreference: string;
    availability: string;
    collaborationStyle: string;
    communicationTools: string[];
    openToNewTeams: boolean;
    openToMentor: boolean;
}

interface ContestPreferences {
    contestInterests: string[];
    preferredContestFormats: string[];
    preferredTeamRole: string;
    preferredTeamSize: string;
    learningGoals: string;
    strengths: string;
    achievements: string;
    portfolioLinks: string[];
}

interface ProfileConsents {
    allowMatching: boolean;
    allowRecommendations: boolean;
    shareExtendedProfile: boolean;
}

interface UserProfile {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    phone?: string;
    bio?: string;
    matchingProfile: MatchingProfile;
    contestPreferences: ContestPreferences;
    consents: ProfileConsents;
    notifications: {
        email: boolean;
        push: boolean;
        contestReminders: boolean;
        courseUpdates: boolean;
        marketing: boolean;
    };
    privacy: {
        showProfile: boolean;
        showActivity: boolean;
        showAchievements: boolean;
    };
    createdAt: string;
    updatedAt: string;
}

interface PasswordChangeData {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
}

type SettingsTab = 'profile' | 'security' | 'notifications' | 'privacy';
type MatchingListKeys = 'secondaryRoles' | 'languages' | 'skills' | 'techStack' | 'communicationTools';
type ContestListKeys = 'contestInterests' | 'preferredContestFormats' | 'portfolioLinks';

// Default creators to avoid shared references
const createDefaultMatchingProfile = (): MatchingProfile => ({
    primaryRole: '',
    secondaryRoles: [],
    experienceLevel: '',
    yearsExperience: null,
    location: '',
    timeZone: '',
    languages: [],
    skills: [],
    techStack: [],
    remotePreference: '',
    availability: '',
    collaborationStyle: '',
    communicationTools: [],
    openToNewTeams: true,
    openToMentor: false,
});

const createDefaultContestPreferences = (): ContestPreferences => ({
    contestInterests: [],
    preferredContestFormats: [],
    preferredTeamRole: '',
    preferredTeamSize: '',
    learningGoals: '',
    strengths: '',
    achievements: '',
    portfolioLinks: [],
});

const createDefaultConsents = (): ProfileConsents => ({
    allowMatching: true,
    allowRecommendations: true,
    shareExtendedProfile: false,
});

const parseListInput = (value: string, maxItems = 20) =>
    value.split(',').map(item => item.trim()).filter(Boolean).slice(0, maxItems);

const joinList = (list?: string[]) => list && list.length ? list.join(', ') : '';

// ============ TOAST COMPONENT ============
const Toast: React.FC<{
    message: string;
    type: 'success' | 'error';
    onClose: () => void;
}> = ({ message, type, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 4000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg ${type === 'success'
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
            {type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
                <AlertCircle className="w-5 h-5 text-red-600" />
            )}
            <span className="text-sm font-medium">{message}</span>
            <button onClick={onClose} className="ml-2 text-current opacity-70 hover:opacity-100">
                ×
            </button>
        </div>
    );
};

// ============ MAIN SETTINGS COMPONENT ============
const UserSettings: React.FC = () => {
    const [searchParams] = useSearchParams();
    const settingsTabFromUrl = searchParams.get('settingsTab') as SettingsTab | null;

    const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
        if (settingsTabFromUrl && ['profile', 'security', 'notifications', 'privacy'].includes(settingsTabFromUrl)) {
            return settingsTabFromUrl;
        }
        return 'profile';
    });
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const [isTestingNotification, setIsTestingNotification] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const avatarInputRef = useRef<HTMLInputElement>(null);

    // Update tab when URL changes
    useEffect(() => {
        if (settingsTabFromUrl && ['profile', 'security', 'notifications', 'privacy'].includes(settingsTabFromUrl)) {
            setActiveTab(settingsTabFromUrl);
        }
    }, [settingsTabFromUrl]);

    // Form states
    const [profileForm, setProfileForm] = useState<{
        name: string;
        phone: string;
        bio: string;
        matchingProfile: MatchingProfile;
        contestPreferences: ContestPreferences;
        consents: ProfileConsents;
    }>(() => ({
        name: '',
        phone: '',
        bio: '',
        matchingProfile: createDefaultMatchingProfile(),
        contestPreferences: createDefaultContestPreferences(),
        consents: createDefaultConsents(),
    }));

    const [passwordForm, setPasswordForm] = useState<PasswordChangeData>({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });
    const [showPasswords, setShowPasswords] = useState({
        current: false,
        new: false,
        confirm: false,
    });

    const [notificationSettings, setNotificationSettings] = useState({
        email: true,
        push: true,
        contestReminders: true,
        courseUpdates: true,
        marketing: false,
    });

    const [privacySettings, setPrivacySettings] = useState({
        showProfile: true,
        showActivity: true,
        showAchievements: true,
    });

    // Fetch user profile
    const fetchProfile = useCallback(async () => {
        try {
            setIsLoading(true);
            const data = await api.get<UserProfile>('/users/me/settings');
            setProfile(data);
            setProfileForm({
                name: data.name || '',
                phone: data.phone || '',
                bio: data.bio || '',
                matchingProfile: {
                    ...createDefaultMatchingProfile(),
                    ...(data.matchingProfile || {})
                },
                contestPreferences: {
                    ...createDefaultContestPreferences(),
                    ...(data.contestPreferences || {})
                },
                consents: {
                    ...createDefaultConsents(),
                    ...(data.consents || {})
                },
            });
            setNotificationSettings(data.notifications || {
                email: true,
                push: true,
                contestReminders: true,
                courseUpdates: true,
                marketing: false,
            });
            setPrivacySettings(data.privacy || {
                showProfile: true,
                showActivity: true,
                showAchievements: true,
            });

            // Sync with localStorage to keep sidebar and header in sync
            const userStr = localStorage.getItem('user');
            if (userStr) {
                const user = JSON.parse(userStr);
                let needsUpdate = false;

                if (data.name && user.name !== data.name) {
                    user.name = data.name;
                    needsUpdate = true;
                }
                if (data.avatar && user.avatar !== data.avatar) {
                    user.avatar = data.avatar;
                    needsUpdate = true;
                }

                if (needsUpdate) {
                    localStorage.setItem('user', JSON.stringify(user));
                    window.dispatchEvent(new Event('auth-change'));
                }
            }
        } catch (err) {
            showToast(err instanceof Error ? err.message : 'Không thể tải thông tin', 'error');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
    };

    const updateMatchingProfileList = (key: MatchingListKeys, rawValue: string, maxItems = 20) => {
        const parsedList = parseListInput(rawValue, maxItems);
        setProfileForm(prev => ({
            ...prev,
            matchingProfile: { ...prev.matchingProfile, [key]: parsedList },
        }));
    };

    const updateContestPreferencesList = (key: ContestListKeys, rawValue: string, maxItems = 20) => {
        const parsedList = parseListInput(rawValue, maxItems);
        setProfileForm(prev => ({
            ...prev,
            contestPreferences: { ...prev.contestPreferences, [key]: parsedList },
        }));
    };

    const validateStringList = (list: string[], label: string, maxItems = 20, maxLength = 60, requireUrl = false) => {
        if (list.length > maxItems) {
            showToast(`${label} kh�ng du?c vu?t qu� ${maxItems} muc`, 'error');
            return false;
        }
        const tooLong = list.find(item => item.length > maxLength);
        if (tooLong) {
            showToast(`${label} m?i muc kh�ng du?c vu?t ${maxLength} ky t?`, 'error');
            return false;
        }
        if (requireUrl) {
            const urlPattern = /^https?:\/\//i;
            const invalid = list.find(item => !urlPattern.test(item));
            if (invalid) {
                showToast(`${label} c?n ph?i l� URL h?p l? (http/https)`, 'error');
                return false;
            }
        }
        return true;
    };

    const handleYearsExperienceChange = (value: string) => {
        if (value === '') {
            setProfileForm(prev => ({
                ...prev,
                matchingProfile: { ...prev.matchingProfile, yearsExperience: null },
            }));
            return;
        }
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
            return;
        }
        const clamped = Math.max(0, Math.min(50, numeric));
        setProfileForm(prev => ({
            ...prev,
            matchingProfile: { ...prev.matchingProfile, yearsExperience: clamped },
        }));
    };

    // Upload avatar to Google Apps Script
    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            showToast('Chỉ chấp nhận file ảnh (JPEG, PNG, GIF, WebP)', 'error');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            showToast('Kích thước file không được vượt quá 5MB', 'error');
            return;
        }

        setIsUploadingAvatar(true);
        try {
            // Get presign info from backend
            const presignData = await api.post<{
                uploadUrl: string;
                fileName: string;
            }>('/media/presign', {
                mimeType: file.type,
                folder: 'avatars'
            });

            // Upload to Google Apps Script
            const formData = new FormData();
            formData.append('file', file);
            formData.append('fileName', presignData.fileName);
            formData.append('folder', 'avatars');

            const uploadResponse = await fetch(presignData.uploadUrl, {
                method: 'POST',
                body: formData,
            });

            const uploadResult = await uploadResponse.json();

            if (uploadResult.status !== 200 || !uploadResult.result) {
                throw new Error(uploadResult.result?.error || 'Upload failed');
            }

            // Convert Drive URL to direct image URL
            const driveFileId = uploadResult.result.id;
            const directImageUrl = `https://lh3.googleusercontent.com/d/${driveFileId}`;

            // Update avatar URL in database
            await api.patch('/users/me/avatar', { avatarUrl: directImageUrl });

            // Update local state
            setProfile(prev => prev ? { ...prev, avatar: directImageUrl } : null);

            // Update localStorage and trigger auth-change event
            const userStr = localStorage.getItem('user');
            if (userStr) {
                const user = JSON.parse(userStr);
                user.avatar = directImageUrl;
                localStorage.setItem('user', JSON.stringify(user));
                window.dispatchEvent(new Event('auth-change'));
            }

            showToast('Đã cập nhật ảnh đại diện thành công', 'success');
        } catch (err) {
            console.error('Avatar upload error:', err);
            showToast(err instanceof Error ? err.message : 'Không thể tải lên ảnh đại diện', 'error');
        } finally {
            setIsUploadingAvatar(false);
            // Reset input
            if (avatarInputRef.current) {
                avatarInputRef.current.value = '';
            }
        }
    };

    // Save profile
    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!profileForm.name.trim()) {
            showToast('Tên không được để trống', 'error');
            return;
        }
        if (profileForm.name.length > 100) {
            showToast('Tên không được quá 100 ký tự', 'error');
            return;
        }
        if (profileForm.bio && profileForm.bio.length > 500) {
            showToast('Tiểu sử không được quá 500 ký tự', 'error');
            return;
        }
        if (profileForm.phone && !/^[0-9+\-\s]{0,20}$/.test(profileForm.phone)) {
            showToast('Số điện thoại không hợp lệ', 'error');
            return;
        }
        const { matchingProfile, contestPreferences } = profileForm;

        if (matchingProfile.yearsExperience !== null && (matchingProfile.yearsExperience < 0 || matchingProfile.yearsExperience > 50)) {
            showToast('Số năm kinh nghiệm phải trong khoảng 0-50', 'error');
            return;
        }
        if (!validateStringList(matchingProfile.skills, 'Kỹ năng chính', 20, 60)) return;
        if (!validateStringList(matchingProfile.techStack, 'Công nghệ', 20, 60)) return;
        if (!validateStringList(matchingProfile.languages, 'Ngôn ngữ', 8, 50)) return;
        if (!validateStringList(matchingProfile.secondaryRoles, 'Vai trò phụ hợp tác', 10, 50)) return;
        if (!validateStringList(matchingProfile.communicationTools, 'Công cụ giao tiếp', 8, 50)) return;
        if (!validateStringList(contestPreferences.contestInterests, 'Sở thích cuộc thi', 15, 60)) return;
        if (!validateStringList(contestPreferences.preferredContestFormats, 'Hình thức cuộc thi', 10, 60)) return;
        if (!validateStringList(contestPreferences.portfolioLinks, 'Liên kết hồ sơ', 5, 300, true)) return;
        if (matchingProfile.availability.length > 200) {
            showToast('Lịch làm việc không được quá 200 ký tự', 'error');
            return;
        }
        if (matchingProfile.collaborationStyle.length > 200) {
            showToast('Phong cách hợp tác không được quá 200 ký tự', 'error');
            return;
        }
        if (contestPreferences.learningGoals.length > 400) {
            showToast('Mục tiêu học tập không được quá 400 ký tự', 'error');
            return;
        }
        if (contestPreferences.strengths.length > 400) {
            showToast('Thói quen/lợi thế không được quá 400 ký tự', 'error');
            return;
        }
        if (contestPreferences.achievements.length > 500) {
            showToast('Thành tích không được quá 500 ký tự', 'error');
            return;
        }

        setIsSaving(true);
        try {
            await api.patch('/users/me/profile', profileForm);

            // Update localStorage user data
            const userStr = localStorage.getItem('user');
            if (userStr) {
                const user = JSON.parse(userStr);
                user.name = profileForm.name;
                localStorage.setItem('user', JSON.stringify(user));
                window.dispatchEvent(new Event('auth-change'));
            }

            showToast('Đã cập nhật hồ sơ thành công', 'success');
        } catch (err) {
            showToast(err instanceof Error ? err.message : 'Không thể cập nhật', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // Change password
    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!passwordForm.currentPassword) {
            showToast('Vui lòng nhập mật khẩu hiện tại', 'error');
            return;
        }
        if (passwordForm.newPassword.length < 6) {
            showToast('Mật khẩu mới phải có ít nhất 6 ký tự', 'error');
            return;
        }
        if (passwordForm.newPassword.length > 128) {
            showToast('Mật khẩu không được quá 128 ký tự', 'error');
            return;
        }
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            showToast('Mật khẩu xác nhận không khớp', 'error');
            return;
        }
        if (passwordForm.currentPassword === passwordForm.newPassword) {
            showToast('Mật khẩu mới phải khác mật khẩu hiện tại', 'error');
            return;
        }

        setIsSaving(true);
        try {
            await api.post('/users/me/change-password', {
                currentPassword: passwordForm.currentPassword,
                newPassword: passwordForm.newPassword,
            });
            setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
            showToast('Đã đổi mật khẩu thành công', 'success');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Không thể đổi mật khẩu';
            const vietnameseErrors: Record<string, string> = {
                'Current password is incorrect.': 'Mật khẩu hiện tại không đúng.',
                'Password must be at least 6 characters.': 'Mật khẩu phải có ít nhất 6 ký tự.',
            };
            showToast(vietnameseErrors[message] || message, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // Save notification settings
    const handleSaveNotifications = async () => {
        setIsSaving(true);
        try {
            await api.patch('/users/me/notifications', notificationSettings);
            showToast('Đã cập nhật cài đặt thông báo', 'success');
        } catch (err) {
            showToast(err instanceof Error ? err.message : 'Không thể cập nhật', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // Save privacy settings
    const handleSavePrivacy = async () => {
        setIsSaving(true);
        try {
            await api.patch('/users/me/privacy', privacySettings);
            showToast('Đã cập nhật cài đặt quyền riêng tư', 'success');
        } catch (err) {
            showToast(err instanceof Error ? err.message : 'Không thể cập nhật', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // Test notification
    const handleTestNotification = async () => {
        setIsTestingNotification(true);
        try {
            await api.post('/notifications/test', { type: 'announcement' });
            showToast('✅ Email thử nghiệm đã được gửi! Kiểm tra hộp thư của bạn.', 'success');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Không thể gửi thông báo thử nghiệm';
            showToast(message, 'error');
        } finally {
            setIsTestingNotification(false);
        }
    };

    // Toggle Switch Component - using checkbox pattern for better accessibility
    const ToggleSwitch: React.FC<{
        checked: boolean;
        onChange: (checked: boolean) => void;
        disabled?: boolean;
        label?: string;
        id?: string;
    }> = ({ checked, onChange, disabled, label, id }) => {
        const switchId = id || `toggle-${Math.random().toString(36).substr(2, 9)}`;
        return (
            <label
                htmlFor={switchId}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${checked ? 'bg-primary-600' : 'bg-slate-200'
                    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={label || "Toggle switch"}
            >
                <input
                    type="checkbox"
                    id={switchId}
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                    disabled={disabled}
                    className="sr-only peer"
                    aria-label={label || "Toggle switch"}
                />
                <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'
                        }`}
                />
            </label>
        );
    };

    // Render tab content
    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="flex justify-center items-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
                </div>
            );
        }

        switch (activeTab) {
            case 'profile':
                return (
                    <Card className="p-6">
                        <h3 className="text-lg font-semibold text-slate-900 mb-6 flex items-center">
                            <User className="w-5 h-5 mr-2 text-primary-600" />
                            Thông tin cá nhân
                        </h3>

                        <form onSubmit={handleSaveProfile} className="space-y-6">
                            {/* Avatar */}
                            <div className="flex items-center gap-4">
                                <div className="relative">
                                    <div className="w-20 h-20 rounded-full bg-slate-200 overflow-hidden">
                                        {isUploadingAvatar ? (
                                            <div className="w-full h-full flex items-center justify-center bg-slate-100">
                                                <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                                            </div>
                                        ) : (
                                            <img
                                                src={profile?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(profileForm.name || 'User')}&background=6366f1&color=fff`}
                                                alt="Avatar"
                                                className="w-full h-full object-cover"
                                            />
                                        )}
                                    </div>
                                    <input
                                        ref={avatarInputRef}
                                        type="file"
                                        accept="image/jpeg,image/png,image/gif,image/webp"
                                        onChange={handleAvatarUpload}
                                        className="hidden"
                                        id="avatar-upload"
                                        aria-label="Chọn ảnh đại diện"
                                        title="Chọn ảnh đại diện"
                                    />
                                    <label
                                        htmlFor="avatar-upload"
                                        className={`absolute bottom-0 right-0 p-1.5 bg-primary-600 text-white rounded-full shadow-lg hover:bg-primary-700 transition-colors cursor-pointer ${isUploadingAvatar ? 'opacity-50 pointer-events-none' : ''}`}
                                        title="Thay đổi avatar"
                                    >
                                        <Camera className="w-3.5 h-3.5" />
                                    </label>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-slate-900">{profile?.name}</p>
                                    <p className="text-xs text-slate-500">{profile?.email}</p>
                                    <p className="text-xs text-slate-400 mt-1">
                                        Tham gia từ {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('vi-VN') : 'N/A'}
                                    </p>
                                </div>
                            </div>

                            {/* Name */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Họ và tên <span className="text-red-500">*</span>
                                </label>
                                <Input
                                    value={profileForm.name}
                                    onChange={(e) => setProfileForm(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="Nhập họ và tên"
                                    maxLength={100}
                                />
                                <p className="text-xs text-slate-400 mt-1">{profileForm.name.length}/100</p>
                            </div>

                            {/* Email (read-only) */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Email
                                </label>
                                <div className="relative">
                                    <Input
                                        value={profile?.email || ''}
                                        disabled
                                        className="bg-slate-50 text-slate-500"
                                    />
                                    <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                </div>
                                <p className="text-xs text-slate-400 mt-1">Email không thể thay đổi</p>
                            </div>

                            {/* Phone */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Số điện thoại
                                </label>
                                <Input
                                    type="tel"
                                    value={profileForm.phone}
                                    onChange={(e) => setProfileForm(prev => ({ ...prev, phone: e.target.value }))}
                                    placeholder="Nhập số điện thoại"
                                    maxLength={20}
                                />
                            </div>

                            {/* Bio */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Giới thiệu bản thân
                                </label>
                                <textarea
                                    value={profileForm.bio}
                                    onChange={(e) => setProfileForm(prev => ({ ...prev, bio: e.target.value }))}
                                    placeholder="Viết vài dòng giới thiệu về bản thân..."
                                    rows={4}
                                    maxLength={500}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                                />
                                <p className="text-xs text-slate-400 mt-1">{profileForm.bio.length}/500</p>
                            </div>

                            {/* Matching profile - roles */}
                            <div className="border-t border-slate-100 pt-4">
                                <h4 className="text-sm font-semibold text-slate-900 mb-3">Hồ sơ hợp tác & vai trò</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <CustomDropdown
                                            label="Vai trò chính"
                                            value={profileForm.matchingProfile.primaryRole}
                                            onChange={(value) => setProfileForm(prev => ({
                                                ...prev,
                                                matchingProfile: { ...prev.matchingProfile, primaryRole: value }
                                            }))}
                                            placeholder="Chọn vai trò"
                                            options={[{ value: '', label: 'Chọn vai trò' }, ...ROLES.map(r => ({ value: r, label: r }))]}
                                        />
                                    </div>
                                    <div>
                                        <CustomDropdown
                                            label="Vai trò muốn đảm nhiệm trong đội"
                                            value={profileForm.contestPreferences.preferredTeamRole}
                                            onChange={(value) => setProfileForm(prev => ({
                                                ...prev,
                                                contestPreferences: { ...prev.contestPreferences, preferredTeamRole: value }
                                            }))}
                                            placeholder="Chọn vai trò"
                                            options={[{ value: '', label: 'Chọn vai trò' }, ...ROLES.map(r => ({ value: r, label: r }))]}
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <MultiSelectTags
                                            label="Vai trò phụ (có thể đảm nhiệm thêm)"
                                            values={profileForm.matchingProfile.secondaryRoles}
                                            onChange={(values) => setProfileForm(prev => ({
                                                ...prev,
                                                matchingProfile: { ...prev.matchingProfile, secondaryRoles: values }
                                            }))}
                                            options={ROLES}
                                            maxItems={5}
                                            colorMap={ROLE_COLORS}
                                            placeholder="Tìm và chọn vai trò..."
                                        />
                                    </div>
                                    <div>
                                        <CustomDropdown
                                            label="Cấp độ kinh nghiệm"
                                            value={profileForm.matchingProfile.experienceLevel}
                                            onChange={(value) => setProfileForm(prev => ({
                                                ...prev,
                                                matchingProfile: { ...prev.matchingProfile, experienceLevel: value }
                                            }))}
                                            placeholder="Chọn cấp độ"
                                            options={[{ value: '', label: 'Chọn cấp độ' }, ...EXPERIENCE_LEVELS.map(e => ({ value: e.value, label: e.label }))]}
                                        />
                                    </div>
                                    <div>
                                        <CustomDropdown
                                            label="Số năm kinh nghiệm"
                                            value={String(profileForm.matchingProfile.yearsExperience ?? '')}
                                            onChange={(value) => setProfileForm(prev => ({
                                                ...prev,
                                                matchingProfile: { ...prev.matchingProfile, yearsExperience: value ? parseInt(value) : null }
                                            }))}
                                            placeholder="Chọn"
                                            options={[{ value: '', label: 'Chọn' }, ...YEARS_EXPERIENCE.map(y => ({ value: y.value, label: y.label }))]}
                                        />
                                    </div>
                                    <div>
                                        <CustomDropdown
                                            label="Quy mô đội ưa thích"
                                            value={profileForm.contestPreferences.preferredTeamSize}
                                            onChange={(value) => setProfileForm(prev => ({
                                                ...prev,
                                                contestPreferences: { ...prev.contestPreferences, preferredTeamSize: value }
                                            }))}
                                            placeholder="Chọn quy mô"
                                            options={[{ value: '', label: 'Chọn quy mô' }, ...TEAM_SIZES.map(t => ({ value: t.value, label: t.label }))]}
                                        />
                                    </div>
                                    <div>
                                        <CustomDropdown
                                            label="Địa điểm / khu vực"
                                            value={profileForm.matchingProfile.location}
                                            onChange={(value) => setProfileForm(prev => ({
                                                ...prev,
                                                matchingProfile: { ...prev.matchingProfile, location: value }
                                            }))}
                                            placeholder="Chọn khu vực"
                                            options={[{ value: '', label: 'Chọn khu vực' }, ...LOCATIONS_VN.map(l => ({ value: l, label: l }))]}
                                        />
                                    </div>
                                    <div>
                                        <CustomDropdown
                                            label="Múi giờ"
                                            value={profileForm.matchingProfile.timeZone}
                                            onChange={(value) => setProfileForm(prev => ({
                                                ...prev,
                                                matchingProfile: { ...prev.matchingProfile, timeZone: value }
                                            }))}
                                            placeholder="Chọn múi giờ"
                                            options={[{ value: '', label: 'Chọn múi giờ' }, ...TIMEZONES.map(t => ({ value: t.value, label: t.label }))]}
                                        />
                                    </div>
                                    <div>
                                        <MultiSelectTags
                                            label="Ngôn ngữ giao tiếp"
                                            values={profileForm.matchingProfile.languages}
                                            onChange={(values) => setProfileForm(prev => ({
                                                ...prev,
                                                matchingProfile: { ...prev.matchingProfile, languages: values }
                                            }))}
                                            options={LANGUAGES}
                                            maxItems={5}
                                            placeholder="Chọn ngôn ngữ..."
                                        />
                                    </div>
                                    <div>
                                        <CustomDropdown
                                            label="Hình thức làm việc"
                                            value={profileForm.matchingProfile.remotePreference}
                                            onChange={(value) => setProfileForm(prev => ({
                                                ...prev,
                                                matchingProfile: { ...prev.matchingProfile, remotePreference: value }
                                            }))}
                                            placeholder="Chọn"
                                            options={[{ value: '', label: 'Chọn' }, ...REMOTE_PREFERENCES.map(r => ({ value: r.value, label: r.label }))]}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Skills & availability */}
                            <div className="border-t border-slate-100 pt-4">
                                <h4 className="text-sm font-semibold text-slate-900 mb-3">Kỹ năng, công cụ & lịch làm việc</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <MultiSelectTags
                                            label="Kỹ năng chính"
                                            values={profileForm.matchingProfile.skills}
                                            onChange={(values) => setProfileForm(prev => ({
                                                ...prev,
                                                matchingProfile: { ...prev.matchingProfile, skills: values }
                                            }))}
                                            options={SKILLS}
                                            maxItems={20}
                                            placeholder="Chọn kỹ năng..."
                                        />
                                    </div>
                                    <div>
                                        <MultiSelectTags
                                            label="Tech stack / công cụ"
                                            values={profileForm.matchingProfile.techStack}
                                            onChange={(values) => setProfileForm(prev => ({
                                                ...prev,
                                                matchingProfile: { ...prev.matchingProfile, techStack: values }
                                            }))}
                                            options={TECH_STACK}
                                            maxItems={20}
                                            placeholder="Chọn tech stack..."
                                        />
                                    </div>
                                    <div>
                                        <MultiSelectTags
                                            label="Công cụ giao tiếp ưa thích"
                                            values={profileForm.matchingProfile.communicationTools}
                                            onChange={(values) => setProfileForm(prev => ({
                                                ...prev,
                                                matchingProfile: { ...prev.matchingProfile, communicationTools: values }
                                            }))}
                                            options={COMMUNICATION_TOOLS}
                                            maxItems={8}
                                            placeholder="Chọn công cụ giao tiếp..."
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                    <div className="md:col-span-2">
                                        <MultiSelectTags
                                            label="Lịch / mức độ sẵn sàng"
                                            values={profileForm.matchingProfile.availability ? profileForm.matchingProfile.availability.split(',').map(s => s.trim()).filter(Boolean) : []}
                                            onChange={(values) => setProfileForm(prev => ({
                                                ...prev,
                                                matchingProfile: { ...prev.matchingProfile, availability: values.join(', ') }
                                            }))}
                                            options={AVAILABILITY_OPTIONS}
                                            maxItems={10}
                                            placeholder="Chọn thời gian rảnh..."
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <MultiSelectTags
                                            label="Phong cách phối hợp / kỳ vọng"
                                            values={profileForm.matchingProfile.collaborationStyle ? profileForm.matchingProfile.collaborationStyle.split(',').map(s => s.trim()).filter(Boolean) : []}
                                            onChange={(values) => setProfileForm(prev => ({
                                                ...prev,
                                                matchingProfile: { ...prev.matchingProfile, collaborationStyle: values.join(', ') }
                                            }))}
                                            options={COLLABORATION_STYLES}
                                            maxItems={10}
                                            placeholder="Chọn phong cách..."
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Contest preferences */}
                            <div className="border-t border-slate-100 pt-4">
                                <h4 className="text-sm font-semibold text-slate-900 mb-3">Sở thích cuộc thi & mục tiêu</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <MultiSelectTags
                                            label="Chủ đề / lĩnh vực ưu tiên"
                                            values={profileForm.contestPreferences.contestInterests}
                                            onChange={(values) => setProfileForm(prev => ({
                                                ...prev,
                                                contestPreferences: { ...prev.contestPreferences, contestInterests: values }
                                            }))}
                                            options={CONTEST_INTERESTS}
                                            maxItems={15}
                                            placeholder="Chọn chủ đề..."
                                        />
                                    </div>
                                    <div>
                                        <MultiSelectTags
                                            label="Hình thức cuộc thi ưa thích"
                                            values={profileForm.contestPreferences.preferredContestFormats}
                                            onChange={(values) => setProfileForm(prev => ({
                                                ...prev,
                                                contestPreferences: { ...prev.contestPreferences, preferredContestFormats: values }
                                            }))}
                                            options={CONTEST_FORMATS.map(f => f.label)}
                                            maxItems={10}
                                            placeholder="Chọn hình thức..."
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <MultiSelectTags
                                            label="Mục tiêu / động lực"
                                            values={profileForm.contestPreferences.learningGoals ? profileForm.contestPreferences.learningGoals.split(',').map(s => s.trim()).filter(Boolean) : []}
                                            onChange={(values) => setProfileForm(prev => ({
                                                ...prev,
                                                contestPreferences: { ...prev.contestPreferences, learningGoals: values.join(', ') }
                                            }))}
                                            options={LEARNING_GOALS}
                                            maxItems={10}
                                            placeholder="Chọn mục tiêu..."
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <MultiSelectTags
                                            label="Điểm mạnh & cách làm việc"
                                            values={profileForm.contestPreferences.strengths ? profileForm.contestPreferences.strengths.split(',').map(s => s.trim()).filter(Boolean) : []}
                                            onChange={(values) => setProfileForm(prev => ({
                                                ...prev,
                                                contestPreferences: { ...prev.contestPreferences, strengths: values.join(', ') }
                                            }))}
                                            options={STRENGTHS}
                                            maxItems={10}
                                            placeholder="Chọn điểm mạnh..."
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Thành tích / kinh nghiệm nổi bật</label>
                                        <textarea
                                            value={profileForm.contestPreferences.achievements}
                                            onChange={(e) => setProfileForm(prev => ({
                                                ...prev,
                                                contestPreferences: { ...prev.contestPreferences, achievements: e.target.value }
                                            }))}
                                            placeholder="Ví dụ: top 5 hackathon X, giải nhì cuộc thi Y, 3 dự án sản phẩm thực tế..."
                                            rows={4}
                                            maxLength={500}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                                        />
                                        <p className="text-xs text-slate-400 mt-1">{profileForm.contestPreferences.achievements.length}/500</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Liên kết hồ sơ / portfolio</label>
                                        <Input
                                            value={joinList(profileForm.contestPreferences.portfolioLinks)}
                                            onChange={(e) => updateContestPreferencesList('portfolioLinks', e.target.value, 5)}
                                            placeholder="https://, github.com/..., behance.net/..."
                                            maxLength={300}
                                        />
                                        <p className="text-xs text-slate-400 mt-1">Tối đa 5 liên kết, ngăn cách bằng dấu phẩy</p>
                                    </div>
                                </div>
                            </div>

                            {/* Consent & privacy */}
                            <div className="border-t border-slate-100 pt-4">
                                <h4 className="text-sm font-semibold text-slate-900 mb-3">Tùy chọn gợi ý & quyền riêng tư</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="flex items-center justify-between p-3 border border-slate-100 rounded-lg">
                                        <div>
                                            <p className="font-medium text-slate-900 text-sm">Sẵn sàng ghép đội mới</p>
                                            <p className="text-xs text-slate-500">Cho phép người khác mời tham gia đội</p>
                                        </div>
                                        <ToggleSwitch
                                            checked={profileForm.matchingProfile.openToNewTeams}
                                            onChange={(checked) => setProfileForm(prev => ({
                                                ...prev,
                                                matchingProfile: { ...prev.matchingProfile, openToNewTeams: checked }
                                            }))}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between p-3 border border-slate-100 rounded-lg">
                                        <div>
                                            <p className="font-medium text-slate-900 text-sm">Bật đề xuất ghép đội thông minh</p>
                                            <p className="text-xs text-slate-500">Cho phép dùng dữ liệu trên để tính độ phù hợp</p>
                                        </div>
                                        <ToggleSwitch
                                            checked={profileForm.consents.allowMatching}
                                            onChange={(checked) => setProfileForm(prev => ({
                                                ...prev,
                                                consents: { ...prev.consents, allowMatching: checked }
                                            }))}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between p-3 border border-slate-100 rounded-lg">
                                        <div>
                                            <p className="font-medium text-slate-900 text-sm">Gợi ý cuộc thi cá nhân hóa</p>
                                            <p className="text-xs text-slate-500">Dùng hồ sơ để chọn cuộc thi phù hợp</p>
                                        </div>
                                        <ToggleSwitch
                                            checked={profileForm.consents.allowRecommendations}
                                            onChange={(checked) => setProfileForm(prev => ({
                                                ...prev,
                                                consents: { ...prev.consents, allowRecommendations: checked }
                                            }))}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between p-3 border border-slate-100 rounded-lg">
                                        <div>
                                            <p className="font-medium text-slate-900 text-sm">Chia sẻ hồ sơ mở rộng cho đội</p>
                                            <p className="text-xs text-slate-500">Chỉ hiển thị khi gửi lời mời ghép đội</p>
                                        </div>
                                        <ToggleSwitch
                                            checked={profileForm.consents.shareExtendedProfile}
                                            onChange={(checked) => setProfileForm(prev => ({
                                                ...prev,
                                                consents: { ...prev.consents, shareExtendedProfile: checked }
                                            }))}
                                        />
                                    </div>
                                </div>
                                <p className="text-xs text-slate-500 mt-2">
                                    Dữ liệu chỉ phục vụ ghép đội và gợi ý cuộc thi. Bạn có thể tắt bất kỳ lúc nào để bảo vệ quyền riêng tư.
                                </p>
                            </div>

                            <div className="flex justify-end">
                                <Button type="submit" disabled={isSaving}>
                                    {isSaving ? (
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                        <Save className="w-4 h-4 mr-2" />
                                    )}
                                    Lưu thay đổi
                                </Button>
                            </div>
                        </form>
                    </Card>
                );



            case 'security':
                return (
                    <Card className="p-6">
                        <h3 className="text-lg font-semibold text-slate-900 mb-6 flex items-center">
                            <Lock className="w-5 h-5 mr-2 text-primary-600" />
                            Bảo mật tài khoản
                        </h3>

                        <form onSubmit={handleChangePassword} className="space-y-6">
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                                <p className="text-sm text-amber-800">
                                    <Shield className="w-4 h-4 inline mr-1" />
                                    Để bảo vệ tài khoản, hãy sử dụng mật khẩu mạnh với ít nhất 6 ký tự, bao gồm chữ hoa, chữ thường và số.
                                </p>
                            </div>

                            {/* Current Password */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Mật khẩu hiện tại <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <Input
                                        type={showPasswords.current ? 'text' : 'password'}
                                        value={passwordForm.currentPassword}
                                        onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                                        placeholder="Nhập mật khẩu hiện tại"
                                        autoComplete="current-password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            {/* New Password */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Mật khẩu mới <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <Input
                                        type={showPasswords.new ? 'text' : 'password'}
                                        value={passwordForm.newPassword}
                                        onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                                        placeholder="Nhập mật khẩu mới (ít nhất 6 ký tự)"
                                        autoComplete="new-password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                {/* Password strength indicator */}
                                {passwordForm.newPassword && (
                                    <div className="mt-2">
                                        <div className="flex gap-1">
                                            {[1, 2, 3, 4].map((level) => {
                                                const strength = calculatePasswordStrength(passwordForm.newPassword);
                                                return (
                                                    <div
                                                        key={level}
                                                        className={`h-1 flex-1 rounded-full ${level <= strength
                                                            ? strength <= 1 ? 'bg-red-500'
                                                                : strength <= 2 ? 'bg-orange-500'
                                                                    : strength <= 3 ? 'bg-yellow-500'
                                                                        : 'bg-green-500'
                                                            : 'bg-slate-200'
                                                            }`}
                                                    />
                                                );
                                            })}
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1">
                                            {getPasswordStrengthText(calculatePasswordStrength(passwordForm.newPassword))}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Confirm Password */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Xác nhận mật khẩu mới <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <Input
                                        type={showPasswords.confirm ? 'text' : 'password'}
                                        value={passwordForm.confirmPassword}
                                        onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                        placeholder="Nhập lại mật khẩu mới"
                                        autoComplete="new-password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                {passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword && (
                                    <p className="text-xs text-red-500 mt-1">Mật khẩu xác nhận không khớp</p>
                                )}
                            </div>

                            <div className="flex justify-end">
                                <Button type="submit" disabled={isSaving}>
                                    {isSaving ? (
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                        <Lock className="w-4 h-4 mr-2" />
                                    )}
                                    Đổi mật khẩu
                                </Button>
                            </div>
                        </form>
                    </Card>
                );

            case 'notifications':
                return (
                    <Card className="p-6">
                        <h3 className="text-lg font-semibold text-slate-900 mb-6 flex items-center">
                            <Bell className="w-5 h-5 mr-2 text-primary-600" />
                            Cài đặt thông báo
                        </h3>

                        {/* Test Notification Section */}
                        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-blue-900">🧪 Kiểm tra thông báo</p>
                                    <p className="text-sm text-blue-700">Gửi email thử nghiệm đến địa chỉ của bạn</p>
                                </div>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={handleTestNotification}
                                    disabled={isTestingNotification}
                                >
                                    {isTestingNotification ? (
                                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                    ) : (
                                        <Bell className="w-4 h-4 mr-1" />
                                    )}
                                    Gửi thử
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="flex items-center justify-between py-3 border-b border-slate-100">
                                <div>
                                    <p className="font-medium text-slate-900">Thông báo qua email</p>
                                    <p className="text-sm text-slate-500">Nhận thông báo quan trọng qua email</p>
                                </div>
                                <ToggleSwitch
                                    checked={notificationSettings.email}
                                    onChange={(checked) => setNotificationSettings(prev => ({ ...prev, email: checked }))}
                                />
                            </div>

                            <div className="flex items-center justify-between py-3 border-b border-slate-100">
                                <div>
                                    <p className="font-medium text-slate-900">Thông báo đẩy</p>
                                    <p className="text-sm text-slate-500">Nhận thông báo trên trình duyệt</p>
                                </div>
                                <ToggleSwitch
                                    checked={notificationSettings.push}
                                    onChange={(checked) => setNotificationSettings(prev => ({ ...prev, push: checked }))}
                                />
                            </div>

                            <div className="flex items-center justify-between py-3 border-b border-slate-100">
                                <div>
                                    <p className="font-medium text-slate-900">Nhắc nhở cuộc thi</p>
                                    <p className="text-sm text-slate-500">Nhận nhắc nhở trước khi cuộc thi bắt đầu</p>
                                </div>
                                <ToggleSwitch
                                    checked={notificationSettings.contestReminders}
                                    onChange={(checked) => setNotificationSettings(prev => ({ ...prev, contestReminders: checked }))}
                                />
                            </div>

                            <div className="flex items-center justify-between py-3 border-b border-slate-100">
                                <div>
                                    <p className="font-medium text-slate-900">Cập nhật khóa học</p>
                                    <p className="text-sm text-slate-500">Nhận thông báo khi khóa học có nội dung mới</p>
                                </div>
                                <ToggleSwitch
                                    checked={notificationSettings.courseUpdates}
                                    onChange={(checked) => setNotificationSettings(prev => ({ ...prev, courseUpdates: checked }))}
                                />
                            </div>

                            <div className="flex items-center justify-between py-3">
                                <div>
                                    <p className="font-medium text-slate-900">Tin tức và khuyến mãi</p>
                                    <p className="text-sm text-slate-500">Nhận thông tin về ưu đãi và tính năng mới</p>
                                </div>
                                <ToggleSwitch
                                    checked={notificationSettings.marketing}
                                    onChange={(checked) => setNotificationSettings(prev => ({ ...prev, marketing: checked }))}
                                />
                            </div>

                            <div className="flex justify-end pt-4">
                                <Button onClick={handleSaveNotifications} disabled={isSaving}>
                                    {isSaving ? (
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                        <Save className="w-4 h-4 mr-2" />
                                    )}
                                    Lưu cài đặt
                                </Button>
                            </div>
                        </div>
                    </Card>
                );

            case 'privacy':
                return (
                    <Card className="p-6">
                        <h3 className="text-lg font-semibold text-slate-900 mb-6 flex items-center">
                            <Shield className="w-5 h-5 mr-2 text-primary-600" />
                            Quyền riêng tư
                        </h3>

                        <div className="space-y-6">
                            <div className="flex items-center justify-between py-3 border-b border-slate-100">
                                <div>
                                    <p className="font-medium text-slate-900">Hiển thị hồ sơ công khai</p>
                                    <p className="text-sm text-slate-500">Cho phép người khác xem hồ sơ của bạn</p>
                                </div>
                                <ToggleSwitch
                                    checked={privacySettings.showProfile}
                                    onChange={(checked) => setPrivacySettings(prev => ({ ...prev, showProfile: checked }))}
                                />
                            </div>

                            <div className="flex items-center justify-between py-3 border-b border-slate-100">
                                <div>
                                    <p className="font-medium text-slate-900">Hiển thị hoạt động</p>
                                    <p className="text-sm text-slate-500">Cho phép người khác xem hoạt động gần đây của bạn</p>
                                </div>
                                <ToggleSwitch
                                    checked={privacySettings.showActivity}
                                    onChange={(checked) => setPrivacySettings(prev => ({ ...prev, showActivity: checked }))}
                                />
                            </div>

                            <div className="flex items-center justify-between py-3">
                                <div>
                                    <p className="font-medium text-slate-900">Hiển thị thành tích</p>
                                    <p className="text-sm text-slate-500">Cho phép người khác xem huy hiệu và thành tích của bạn</p>
                                </div>
                                <ToggleSwitch
                                    checked={privacySettings.showAchievements}
                                    onChange={(checked) => setPrivacySettings(prev => ({ ...prev, showAchievements: checked }))}
                                />
                            </div>

                            <div className="flex justify-end pt-4">
                                <Button onClick={handleSavePrivacy} disabled={isSaving}>
                                    {isSaving ? (
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                        <Save className="w-4 h-4 mr-2" />
                                    )}
                                    Lưu cài đặt
                                </Button>
                            </div>
                        </div>
                    </Card>
                );
        }
    };

    // Tab navigation items
    const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
        { id: 'profile', label: 'Hồ sơ', icon: <User className="w-4 h-4" /> },
        { id: 'security', label: 'Bảo mật', icon: <Lock className="w-4 h-4" /> },
        { id: 'notifications', label: 'Thông báo', icon: <Bell className="w-4 h-4" /> },
        { id: 'privacy', label: 'Quyền riêng tư', icon: <Shield className="w-4 h-4" /> },
    ];

    return (
        <div className="space-y-6">
            {/* Tab Navigation */}
            <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.id
                            ? 'bg-primary-100 text-primary-700'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                            }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            {renderContent()}

            {/* Toast */}
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </div>
    );
};

// Helper functions
function calculatePasswordStrength(password: string): number {
    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.length >= 10) strength++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)) strength++;
    return strength;
}

function getPasswordStrengthText(strength: number): string {
    switch (strength) {
        case 0: return 'Quá yếu';
        case 1: return 'Yếu';
        case 2: return 'Trung bình';
        case 3: return 'Mạnh';
        case 4: return 'Rất mạnh';
        default: return '';
    }
}

export default UserSettings;

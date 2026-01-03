/**
 * User Management Modals
 * Secure modal components for user actions:
 * - ViewProfileModal: Display detailed user profile
 * - EditUserModal: Edit user details form
 * - ConfirmActionModal: Confirmation for status change/delete
 */

import React, { useState, useEffect } from 'react';
import { X, User, Mail, Phone, School, GraduationCap, Calendar, Wallet, ShoppingCart, Trophy, Loader2, AlertTriangle, Shield, ShieldAlert } from 'lucide-react';
import { Modal } from './Modal';
import { Dropdown } from './Dropdown';
import { UserProfile, UpdateUserPayload } from '../../types';
import { getAvatarUrl, avatarPresets } from '../../utils/avatar';

// ==========================================
// VIEW PROFILE MODAL
// ==========================================

interface ViewProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    profile: UserProfile | null;
    isLoading: boolean;
}

export const ViewProfileModal: React.FC<ViewProfileModalProps> = ({
    isOpen,
    onClose,
    profile,
    isLoading,
}) => {
    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('vi-VN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND',
        }).format(amount);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="User Profile">
            <div className="p-6">
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                        <span className="ml-3 text-gray-600">Loading profile...</span>
                    </div>
                ) : profile ? (
                    <div className="space-y-6">
                        {/* Header with Avatar */}
                        <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
                            <img
                                src={getAvatarUrl(profile.avatar, profile.name, avatarPresets.large)}
                                alt={profile.name}
                                className="w-16 h-16 rounded-full border-2 border-gray-200"
                            />
                            <div>
                                <h3 className="text-xl font-semibold text-gray-900">{profile.name}</h3>
                                <p className="text-gray-500 flex items-center gap-1">
                                    <Mail size={14} />
                                    {profile.email}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                        profile.role === 'super_admin'
                                            ? 'bg-red-100 text-red-800'
                                            : profile.role === 'admin'
                                                ? 'bg-purple-100 text-purple-800'
                                                : profile.role === 'mentor'
                                                    ? 'bg-emerald-100 text-emerald-800'
                                                    : 'bg-gray-100 text-gray-800'
                                    }`}>
                                        {profile.role}
                                    </span>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                        profile.status === 'active' 
                                            ? 'bg-green-100 text-green-800'
                                            : profile.status === 'banned'
                                            ? 'bg-red-100 text-red-800'
                                            : 'bg-yellow-100 text-yellow-800'
                                    }`}>
                                        {profile.status}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Profile Details */}
                        <div className="grid grid-cols-2 gap-4">
                            {profile.phoneNumber && (
                                <div className="flex items-center gap-2 text-sm">
                                    <Phone size={16} className="text-gray-400" />
                                    <span className="text-gray-600">{profile.phoneNumber}</span>
                                </div>
                            )}
                            {profile.school && (
                                <div className="flex items-center gap-2 text-sm">
                                    <School size={16} className="text-gray-400" />
                                    <span className="text-gray-600">{profile.school}</span>
                                </div>
                            )}
                            {profile.grade && (
                                <div className="flex items-center gap-2 text-sm">
                                    <GraduationCap size={16} className="text-gray-400" />
                                    <span className="text-gray-600">Grade {profile.grade}</span>
                                </div>
                            )}
                            <div className="flex items-center gap-2 text-sm">
                                <Calendar size={16} className="text-gray-400" />
                                <span className="text-gray-600">Joined {formatDate(profile.createdAt)}</span>
                            </div>
                        </div>

                        {/* Stats Cards */}
                        <div className="grid grid-cols-3 gap-3 pt-4 border-t border-gray-100">
                            <div className="bg-emerald-50 rounded-lg p-3 text-center">
                                <Wallet size={20} className="text-emerald-600 mx-auto mb-1" />
                                <p className="text-sm font-semibold text-emerald-700">
                                    {formatCurrency(profile.wallet?.balance || profile.balance || 0)}
                                </p>
                                <p className="text-xs text-emerald-600">Balance</p>
                            </div>
                            <div className="bg-blue-50 rounded-lg p-3 text-center">
                                <Trophy size={20} className="text-blue-600 mx-auto mb-1" />
                                <p className="text-sm font-semibold text-blue-700">
                                    {profile._count?.contestRegistrations || 0}
                                </p>
                                <p className="text-xs text-blue-600">Contests</p>
                            </div>
                            <div className="bg-orange-50 rounded-lg p-3 text-center">
                                <ShoppingCart size={20} className="text-orange-600 mx-auto mb-1" />
                                <p className="text-sm font-semibold text-orange-700">
                                    {profile._count?.orders || 0}
                                </p>
                                <p className="text-xs text-orange-600">Orders</p>
                            </div>
                        </div>

                        {/* Interests & Talents */}
                        {(profile.interests?.length || profile.talents?.length) && (
                            <div className="pt-4 border-t border-gray-100 space-y-3">
                                {profile.interests && profile.interests.length > 0 && (
                                    <div>
                                        <p className="text-xs font-medium text-gray-500 mb-1">Interests</p>
                                        <div className="flex flex-wrap gap-1">
                                            {profile.interests.map((interest, idx) => (
                                                <span key={idx} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                                                    {interest}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {profile.talents && profile.talents.length > 0 && (
                                    <div>
                                        <p className="text-xs font-medium text-gray-500 mb-1">Talents</p>
                                        <div className="flex flex-wrap gap-1">
                                            {profile.talents.map((talent, idx) => (
                                                <span key={idx} className="px-2 py-0.5 bg-emerald-100 text-emerald-600 rounded text-xs">
                                                    {talent}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center py-8 text-gray-500">
                        Unable to load profile
                    </div>
                )}

                {/* Close Button */}
                <div className="mt-6 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </Modal>
    );
};


// ==========================================
// EDIT USER MODAL
// ==========================================

interface EditUserModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: { id: string; name: string; email: string; role: string } | null;
    onSave: (data: UpdateUserPayload) => Promise<void>;
    isLoading: boolean;
    isSelf: boolean;
}

export const EditUserModal: React.FC<EditUserModalProps> = ({
    isOpen,
    onClose,
    user,
    onSave,
    isLoading,
    isSelf,
}) => {
    const [formData, setFormData] = useState<UpdateUserPayload>({
        name: '',
        email: '',
        phoneNumber: '',
        school: '',
        grade: '',
        role: 'student',
    });
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Reset form when user changes
    useEffect(() => {
        if (user) {
            setFormData({
                name: user.name || '',
                email: user.email || '',
                phoneNumber: '',
                school: '',
                grade: '',
                role: user.role as UpdateUserPayload['role'],
            });
            setErrors({});
        }
    }, [user]);

    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!formData.name?.trim()) {
            newErrors.name = 'Name is required';
        }

        if (!formData.email?.trim()) {
            newErrors.email = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = 'Invalid email format';
        }

        if (formData.phoneNumber && !/^[0-9+\-\s()]{8,15}$/.test(formData.phoneNumber)) {
            newErrors.phoneNumber = 'Invalid phone number';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!validateForm()) return;

        // Only send changed fields
        const payload: UpdateUserPayload = {};
        if (formData.name !== user?.name) payload.name = formData.name;
        if (formData.email !== user?.email) payload.email = formData.email;
        if (formData.phoneNumber) payload.phoneNumber = formData.phoneNumber;
        if (formData.school) payload.school = formData.school;
        if (formData.grade) payload.grade = formData.grade;
        if (!isSelf && formData.role !== user?.role) payload.role = formData.role;

        await onSave(payload);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Edit User Details">
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {/* Name */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Full Name *
                    </label>
                    <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none ${
                            errors.name ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="Enter full name"
                    />
                    {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
                </div>

                {/* Email */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email Address *
                    </label>
                    <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none ${
                            errors.email ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="Enter email address"
                    />
                    {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
                </div>

                {/* Phone Number */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Phone Number
                    </label>
                    <input
                        type="tel"
                        value={formData.phoneNumber}
                        onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none ${
                            errors.phoneNumber ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="Enter phone number"
                    />
                    {errors.phoneNumber && <p className="mt-1 text-xs text-red-500">{errors.phoneNumber}</p>}
                </div>

                {/* School & Grade */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            School
                        </label>
                        <input
                            type="text"
                            value={formData.school}
                            onChange={(e) => setFormData({ ...formData, school: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                            placeholder="School name"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Grade
                        </label>
                        <input
                            type="text"
                            value={formData.grade}
                            onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                            placeholder="Grade level"
                        />
                    </div>
                </div>

                {/* Role - disabled for self */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Role {isSelf && <span className="text-gray-400 text-xs">(cannot change own role)</span>}
                    </label>
                    <Dropdown
                        options={[
                            { 
                                value: 'student', 
                                label: 'Student', 
                                color: 'bg-blue-500',
                                icon: <Shield size={16} className="text-gray-400" />
                            },
                            { 
                                value: 'mentor', 
                                label: 'Mentor', 
                                color: 'bg-emerald-500',
                                icon: <GraduationCap size={16} className="text-emerald-600" />
                            },
                            { 
                                value: 'admin', 
                                label: 'Admin', 
                                color: 'bg-purple-500',
                                icon: <ShieldAlert size={16} className="text-purple-500" />
                            },
                            { 
                                value: 'super_admin', 
                                label: 'Super Admin', 
                                color: 'bg-red-500',
                                icon: <ShieldAlert size={16} className="text-red-600" />
                            },
                        ]}
                        value={formData.role || 'student'}
                        onChange={(val) => setFormData({ ...formData, role: val as UpdateUserPayload['role'] })}
                        disabled={isSelf}
                        placeholder="Select role"
                        headerText="User Role"
                    />
                    {isSelf && (
                        <p className="mt-1.5 text-xs text-amber-600 flex items-center gap-1">
                            <AlertTriangle size={12} />
                            You cannot change your own role for security reasons
                        </p>
                    )}
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isLoading}
                        className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        {isLoading && <Loader2 size={16} className="animate-spin" />}
                        Save Changes
                    </button>
                </div>
            </form>
        </Modal>
    );
};


// ==========================================
// CONFIRM ACTION MODAL
// ==========================================

type ConfirmVariant = 'danger' | 'warning' | 'success' | 'info';

interface ConfirmActionModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    message: string;
    confirmLabel: string;
    variant?: ConfirmVariant;
    showReasonInput?: boolean;
    reasonRequired?: boolean;
    onConfirm: (reason?: string) => void;
    isLoading: boolean;
}

export const ConfirmActionModal: React.FC<ConfirmActionModalProps> = ({
    isOpen,
    onClose,
    title,
    message,
    confirmLabel,
    variant = 'danger',
    showReasonInput = false,
    reasonRequired = false,
    onConfirm,
    isLoading,
}) => {
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setReason('');
            setError('');
        }
    }, [isOpen]);

    const handleConfirm = () => {
        if (showReasonInput && reasonRequired && !reason.trim()) {
            setError('Please provide a reason');
            return;
        }
        onConfirm(reason.trim() || undefined);
    };

    const getVariantStyles = () => {
        switch (variant) {
            case 'danger':
                return {
                    icon: 'bg-red-100 text-red-600',
                    button: 'bg-red-600 hover:bg-red-700',
                };
            case 'warning':
                return {
                    icon: 'bg-amber-100 text-amber-600',
                    button: 'bg-amber-600 hover:bg-amber-700',
                };
            case 'success':
                return {
                    icon: 'bg-emerald-100 text-emerald-600',
                    button: 'bg-emerald-600 hover:bg-emerald-700',
                };
            default:
                return {
                    icon: 'bg-blue-100 text-blue-600',
                    button: 'bg-blue-600 hover:bg-blue-700',
                };
        }
    };

    const styles = getVariantStyles();

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <div className="p-6">
                {/* Icon & Title */}
                <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${styles.icon}`}>
                        <AlertTriangle size={20} />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                        <p className="mt-2 text-sm text-gray-600">{message}</p>
                    </div>
                </div>

                {/* Reason Input */}
                {showReasonInput && (
                    <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Reason {reasonRequired && <span className="text-red-500">*</span>}
                        </label>
                        <textarea
                            value={reason}
                            onChange={(e) => {
                                setReason(e.target.value);
                                setError('');
                            }}
                            rows={3}
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none ${
                                error ? 'border-red-300' : 'border-gray-300'
                            }`}
                            placeholder="Enter reason for this action..."
                        />
                        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
                    </div>
                )}

                {/* Actions */}
                <div className="mt-6 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isLoading}
                        className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={isLoading}
                        className={`px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 ${styles.button}`}
                    >
                        {isLoading && <Loader2 size={16} className="animate-spin" />}
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default { ViewProfileModal, EditUserModal, ConfirmActionModal };

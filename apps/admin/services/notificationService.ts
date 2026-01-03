/**
 * Notification Service
 * Handles admin notifications from real API
 */

import api from './api';

export interface AdminNotification {
    id: string;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    category: 'system' | 'contest' | 'user' | 'course' | 'security';
    link?: string | null;
    read: boolean;
    createdAt: string;
    metadata?: Record<string, unknown>;
}

export interface NotificationResponse {
    notifications: AdminNotification[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
    unreadCount: number;
}

export interface NotificationFilters {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
}

/**
 * Get notifications with pagination
 */
export const getNotifications = async (
    filters: NotificationFilters = {}
): Promise<NotificationResponse> => {
    const { page = 1, limit = 20, unreadOnly = false } = filters;

    const response = await api.get<NotificationResponse>('/admin/notifications', {
        params: {
            page,
            limit,
            unreadOnly: unreadOnly.toString()
        }
    });

    return response.data;
};

/**
 * Get unread count only (lightweight)
 */
export const getUnreadCount = async (): Promise<number> => {
    const response = await api.get<NotificationResponse>('/admin/notifications', {
        params: { limit: 1 }
    });
    return response.data.unreadCount;
};

/**
 * Mark a notification as read
 */
export const markAsRead = async (id: string): Promise<void> => {
    await api.patch(`/admin/notifications/${id}/read`);
};

/**
 * Mark all notifications as read
 */
export const markAllAsRead = async (): Promise<{ modifiedCount: number }> => {
    const response = await api.patch<{ ok: boolean; modifiedCount: number }>(
        '/admin/notifications/mark-all-read'
    );
    return { modifiedCount: response.data.modifiedCount };
};

/**
 * Delete a notification
 */
export const deleteNotification = async (id: string): Promise<void> => {
    await api.delete(`/admin/notifications/${id}`);
};

/**
 * Clear all read notifications
 */
export const clearAllRead = async (): Promise<{ deletedCount: number }> => {
    const response = await api.delete<{ ok: boolean; deletedCount: number }>(
        '/admin/notifications/clear-all'
    );
    return { deletedCount: response.data.deletedCount };
};

/**
 * Seed test notifications (DEV only)
 */
export const seedNotifications = async (): Promise<{ message: string }> => {
    const response = await api.post<{ ok: boolean; message: string }>(
        '/admin/notifications/seed'
    );
    return { message: response.data.message };
};

/**
 * Format relative time for notifications
 */
export const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;

    return date.toLocaleDateString('vi-VN');
};

export const notificationService = {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllRead,
    formatRelativeTime
};

export default notificationService;

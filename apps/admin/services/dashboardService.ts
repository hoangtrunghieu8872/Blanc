/**
 * Dashboard Service
 * API operations for dashboard statistics and analytics
 * Note: Using /stats endpoints (shared with user app)
 */

import api from './api';

export interface DashboardStats {
    totalStudents: number;
    activeContests: number;
    totalRevenue: number;
    courseCompletionRate: number;
    trends: {
        students: { value: number; isUp: boolean };
        contests: { value: number; isUp: boolean };
        revenue: { value: number; isUp: boolean };
        completion: { value: number; isUp: boolean };
    };
}

export interface RevenueData {
    date: string;
    revenue: number;
}

export interface ActivityData {
    date: string;
    logins: number;
    registrations: number;
    enrollments: number;
}

export const dashboardService = {
    /**
     * Get dashboard overview statistics
     */
    getStats: async (_period: 'day' | 'week' | 'month' = 'week'): Promise<DashboardStats> => {
        try {
            const response = await api.get<{ users?: number; contests?: number }>('/stats');
            return {
                totalStudents: response.data.users || 0,
                activeContests: response.data.contests || 0,
                totalRevenue: 0,
                courseCompletionRate: 0,
                trends: {
                    students: { value: 0, isUp: true },
                    contests: { value: 0, isUp: true },
                    revenue: { value: 0, isUp: true },
                    completion: { value: 0, isUp: true },
                },
            };
        } catch {
            return {
                totalStudents: 0,
                activeContests: 0,
                totalRevenue: 0,
                courseCompletionRate: 0,
                trends: {
                    students: { value: 0, isUp: true },
                    contests: { value: 0, isUp: true },
                    revenue: { value: 0, isUp: true },
                    completion: { value: 0, isUp: true },
                },
            };
        }
    },

    /**
     * Get revenue analytics data
     */
    getRevenueAnalytics: async (
        _startDate?: string,
        _endDate?: string,
        _granularity: 'day' | 'week' | 'month' = 'day'
    ): Promise<RevenueData[]> => {
        // Return empty array - endpoint not available
        return [];
    },

    /**
     * Get user activity data
     */
    getActivityData: async (
        _startDate?: string,
        _endDate?: string
    ): Promise<ActivityData[]> => {
        // Return empty array - endpoint not available
        return [];
    },

    /**
     * Get recent notifications
     */
    getNotifications: async (_limit = 10): Promise<{
        id: string;
        title: string;
        message: string;
        type: 'info' | 'success' | 'warning' | 'error';
        timestamp: string;
        read: boolean;
    }[]> => {
        // Return empty array - endpoint not available
        return [];
    },

    /**
     * Mark notification as read
     */
    markNotificationRead: async (_id: string): Promise<void> => {
        // No-op - endpoint not available
    },

    /**
     * Mark all notifications as read
     */
    markAllNotificationsRead: async (): Promise<void> => {
        // No-op - endpoint not available
    },

    /**
     * Get top performing content
     */
    getTopContent: async (): Promise<{
        topCourses: { id: string; title: string; enrollments: number; revenue: number }[];
        topContests: { id: string; title: string; participants: number; revenue: number }[];
    }> => {
        // Return empty data - endpoint not available
        return {
            topCourses: [],
            topContests: [],
        };
    },
};

export default dashboardService;

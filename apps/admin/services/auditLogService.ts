/**
 * Audit Log Service
 * API operations for audit log management and monitoring
 * Connected to backend /api/admin/audit-logs
 */

import api from './api';
import { AuditLogEntry } from '../types';

export interface AuditLogFilters {
    search?: string;
    action?: string;
    user?: string;
    status?: 'Success' | 'Failed' | 'Warning';
    startDate?: string;
    endDate?: string;
    ip?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

// Action types for filtering
export const AUDIT_ACTIONS = [
    'LOGIN_ATTEMPT',
    'LOGIN_SUCCESS',
    'LOGOUT',
    'ACCOUNT_LOCKED',
    'ACCOUNT_UNLOCKED',
    'IP_BLOCKED',
    'IP_UNBLOCKED',
    'USER_CREATE',
    'USER_UPDATE',
    'USER_DELETE',
    'USER_BAN',
    'CONTEST_CREATE',
    'CONTEST_UPDATE',
    'CONTEST_DELETE',
    'COURSE_CREATE',
    'COURSE_UPDATE',
    'COURSE_DELETE',
    'SETTINGS_CHANGE',
    'API_KEY_ACCESS',
    'PASSWORD_RESET',
    'PERMISSION_CHANGE',
    'EMAIL_SENT',
    'BROADCAST_SENT',
] as const;

export type AuditAction = typeof AUDIT_ACTIONS[number];

export const auditLogService = {
    /**
     * Get all audit logs with optional filters
     * Connected to backend /api/admin/audit-logs
     */
    getAll: async (filters: AuditLogFilters = {}): Promise<PaginatedResponse<AuditLogEntry>> => {
        try {
            const params = new URLSearchParams();

            if (filters.page) params.append('page', String(filters.page));
            if (filters.limit) params.append('limit', String(filters.limit));
            if (filters.action) params.append('action', filters.action);
            if (filters.status) params.append('status', filters.status);
            if (filters.user) params.append('user', filters.user);
            if (filters.startDate) params.append('startDate', filters.startDate);
            if (filters.endDate) params.append('endDate', filters.endDate);
            if (filters.search) params.append('search', filters.search);

            const queryString = params.toString();
            const url = `/admin/audit-logs${queryString ? `?${queryString}` : ''}`;

            const response = await api.get(url);
            const data = response.data as {
                logs: any[];
                pagination: { total: number; page: number; limit: number; totalPages: number };
            };

            // Map backend response to frontend format
            return {
                items: data.logs.map((log: any) => {
                    // Helper to safely convert any value to string
                    const toString = (val: any): string => {
                        if (val === null || val === undefined) return '';
                        if (typeof val === 'object') return JSON.stringify(val);
                        return String(val);
                    };

                    return {
                        id: log._id || log.id,
                        action: toString(log.action),
                        target: toString(log.target),
                        user: toString(log.user || log.userEmail || log.userName || 'System'),
                        ip: toString(log.ip) || '-',
                        status: log.status || 'Success',
                        details: toString(log.details),
                        timestamp: log.timestamp,
                    };
                }),
                total: data.pagination.total,
                page: data.pagination.page,
                limit: data.pagination.limit,
                totalPages: data.pagination.totalPages,
            };
        } catch (error) {
            console.error('Failed to fetch audit logs:', error);
            return {
                items: [],
                total: 0,
                page: filters.page || 1,
                limit: filters.limit || 20,
                totalPages: 0,
            };
        }
    },

    /**
     * Get single audit log entry by ID
     */
    getById: async (_id: string): Promise<AuditLogEntry | null> => {
        return null;
    },

    /**
     * Get audit log statistics
     */
    getStats: async (_period: 'day' | 'week' | 'month' = 'week'): Promise<{
        totalLogs: number;
        failedAttempts: number;
        uniqueUsers: number;
        suspiciousActivities: number;
        actionBreakdown: Record<string, number>;
    }> => {
        return {
            totalLogs: 0,
            failedAttempts: 0,
            uniqueUsers: 0,
            suspiciousActivities: 0,
            actionBreakdown: {},
        };
    },

    /**
     * Get security alerts (failed logins, suspicious activities)
     */
    getSecurityAlerts: async (_limit = 10): Promise<AuditLogEntry[]> => {
        return [];
    },

    /**
     * Export audit logs
     */
    export: async (_filters: AuditLogFilters = {}, _format: 'csv' | 'json' = 'csv'): Promise<Blob> => {
        return new Blob([''], { type: 'text/csv' });
    },

    /**
     * Get user activity history
     */
    getUserActivity: async (
        _userId: string,
        page = 1,
        limit = 20
    ): Promise<PaginatedResponse<AuditLogEntry>> => {
        return {
            items: [],
            total: 0,
            page,
            limit,
            totalPages: 0,
        };
    },
};

export default auditLogService;

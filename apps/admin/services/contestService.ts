/**
 * Contest Service
 * API operations for contest management
 * Note: Using /contests endpoints (shared with user app)
 */

import api from './api';
import { Contest } from '../types';

export interface ContestFilters {
    search?: string;
    status?: 'OPEN' | 'FULL' | 'CLOSED';
    tags?: string[];
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

export interface ContestPrize {
    rank: number;
    title: string;
    value: string;
    description?: string;
}

export interface ContestScheduleItem {
    date: string;
    title: string;
    description?: string;
}

export interface OrganizerDetails {
    name: string;
    school?: string;
    logo?: string;
    description?: string;
    contact?: string;
    website?: string;
}

export interface CreateContestData {
    title: string;
    organizer: string;
    dateStart: string;
    endDate?: string;
    deadline: string;
    fee: number;
    tags: string[];
    image?: string;
    description?: string;
    maxParticipants?: number;
    // New fields
    location?: string;
    locationType?: 'online' | 'offline' | 'hybrid';
    category?: string;
    rules?: string;
    schedule?: ContestScheduleItem[];
    prizes?: ContestPrize[];
    objectives?: string;
    eligibility?: string;
    organizerDetails?: OrganizerDetails;
}

export interface UpdateContestData extends Partial<CreateContestData> {
    status?: 'OPEN' | 'FULL' | 'CLOSED';
}

export const contestService = {
    /**
     * Get all contests with optional filters
     */
    getAll: async (filters: ContestFilters = {}): Promise<PaginatedResponse<Contest>> => {
        try {
            const response = await api.get<{ contests?: Contest[]; items?: Contest[]; total?: number }>('/contests', {
                params: {
                    search: filters.search,
                    status: filters.status,
                    tags: filters.tags?.join(','),
                    page: filters.page || 1,
                    limit: filters.limit || 10,
                    sortBy: filters.sortBy,
                    sortOrder: filters.sortOrder,
                },
            });

            const contests = response.data.contests || response.data.items || [];
            const total = response.data.total || contests.length;
            const limit = filters.limit || 10;

            return {
                items: contests,
                total,
                page: filters.page || 1,
                limit,
                totalPages: Math.ceil(total / limit),
            };
        } catch {
            return {
                items: [],
                total: 0,
                page: 1,
                limit: 10,
                totalPages: 0,
            };
        }
    },

    /**
     * Get single contest by ID
     */
    getById: async (id: string): Promise<Contest> => {
        const response = await api.get<Contest>(`/contests/${id}`);
        return response.data;
    },

    /**
     * Create new contest (requires admin role)
     */
    create: async (data: CreateContestData): Promise<Contest> => {
        const response = await api.post<Contest>('/contests', data);
        return response.data;
    },

    /**
     * Update contest (requires admin role)
     */
    update: async (id: string, data: UpdateContestData): Promise<Contest> => {
        const response = await api.patch<Contest>(`/contests/${id}`, data);
        return response.data;
    },

    /**
     * Delete contest
     */
    delete: async (id: string): Promise<void> => {
        await api.delete(`/contests/${id}`);
    },

    /**
     * Change contest status
     */
    changeStatus: async (id: string, status: 'OPEN' | 'FULL' | 'CLOSED'): Promise<Contest> => {
        const response = await api.patch<Contest>(`/contests/${id}`, { status });
        return response.data;
    },

    /**
     * Get contest participants
     */
    getParticipants: async (
        id: string,
        page = 1,
        limit = 20
    ): Promise<PaginatedResponse<{ userId: string; userName: string; joinedAt: string }>> => {
        try {
            const response = await api.get<{ participants: { userId: string; userName: string; joinedAt: string }[] }>(
                `/contests/${id}`,
                { params: { page, limit } }
            );
            const participants = response.data.participants || [];
            return {
                items: participants,
                total: participants.length,
                page,
                limit,
                totalPages: Math.ceil(participants.length / limit),
            };
        } catch {
            return { items: [], total: 0, page, limit, totalPages: 0 };
        }
    },

    /**
     * Remove participant from contest
     */
    removeParticipant: async (contestId: string, userId: string): Promise<void> => {
        await api.delete(`/contests/${contestId}/participants/${userId}`);
    },

    /**
     * Get contest statistics
     */
    getStats: async (): Promise<{
        totalContests: number;
        activeContests: number;
        totalParticipants: number;
        revenue: number;
    }> => {
        try {
            const response = await api.get<{ contests?: Contest[] }>('/contests');
            const contests = response.data.contests || [];
            return {
                totalContests: contests.length,
                activeContests: contests.filter(c => c.status === 'OPEN').length,
                totalParticipants: 0,
                revenue: 0,
            };
        } catch {
            return {
                totalContests: 0,
                activeContests: 0,
                totalParticipants: 0,
                revenue: 0,
            };
        }
    },
};

export default contestService;

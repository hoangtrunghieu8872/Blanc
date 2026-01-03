/**
 * Community Service
 * Admin tooling for managing community "team posts".
 */

import api from './api';
import { TeamPost } from '../types';

export interface TeamPostFilters {
  search?: string;
  status?: 'open' | 'closed' | 'full' | 'all';
  role?: string;
  contestId?: string;
  includeDeleted?: boolean;
  includeExpired?: boolean;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'maxMembers';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const sanitizeSearch = (value?: string) => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, 100);
};

export const communityService = {
  async listTeamPosts(filters: TeamPostFilters = {}): Promise<PaginatedResponse<TeamPost>> {
    const response = await api.get<{
      posts: TeamPost[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>('/admin/team-posts', {
      params: {
        page: filters.page ?? 1,
        limit: filters.limit ?? 12,
        search: sanitizeSearch(filters.search),
        contestId: filters.contestId || undefined,
        status: filters.status && filters.status !== 'all' ? filters.status : undefined,
        includeDeleted: filters.includeDeleted ? 'true' : undefined,
        includeExpired: filters.includeExpired ? 'true' : undefined,
        sortBy: filters.sortBy === 'maxMembers' ? 'maxMembers' : filters.sortBy,
        sortOrder: filters.sortOrder,
      },
    });

    const pagination = response.data.pagination || { page: 1, limit: filters.limit ?? 12, total: 0, totalPages: 1 };

    return {
      items: response.data.posts || [],
      total: pagination.total || 0,
      page: pagination.page || 1,
      limit: pagination.limit || (filters.limit ?? 12),
      totalPages: pagination.totalPages || 1,
    };
  },

  async getTeamPost(id: string): Promise<TeamPost> {
    const response = await api.get<TeamPost>(`/admin/team-posts/${id}`);
    return response.data;
  },

  async deleteTeamPost(id: string, reason?: string): Promise<void> {
    await api.post(`/admin/team-posts/${id}/soft-delete`, { reason });
  },

  async restoreTeamPost(id: string): Promise<void> {
    await api.post(`/admin/team-posts/${id}/restore`);
  },
};

export default communityService;

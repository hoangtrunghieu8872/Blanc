/**
 * Recruitment Service
 * Admin tooling for managing recruitment posts.
 */

import api from './api';
import { RecruitmentPost } from '../types';

export type RecruitmentStatus = 'draft' | 'published';

export interface RecruitmentFilters {
  search?: string;
  status?: RecruitmentStatus | 'all';
  tag?: string;
  role?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
  sortBy?: 'publishAt' | 'createdAt' | 'updatedAt' | 'title';
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
  return trimmed.slice(0, 200);
};

export const recruitmentService = {
  async listAdmin(filters: RecruitmentFilters = {}): Promise<PaginatedResponse<RecruitmentPost>> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;

    const response = await api.get<{
      items: RecruitmentPost[];
      total: number;
      page: number;
      limit: number;
    }>('/recruitments/admin', {
      params: {
        page,
        limit,
        search: sanitizeSearch(filters.search),
        status: filters.status && filters.status !== 'all' ? filters.status : undefined,
        tag: filters.tag?.trim() || undefined,
        role: filters.role?.trim() || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
      },
    });

    const total = response.data.total || 0;
    const resolvedLimit = response.data.limit || limit;
    const resolvedPage = response.data.page || page;

    return {
      items: response.data.items || [],
      total,
      page: resolvedPage,
      limit: resolvedLimit,
      totalPages: Math.max(1, Math.ceil(total / resolvedLimit)),
    };
  },

  async getAdmin(idOrSlug: string): Promise<RecruitmentPost> {
    const response = await api.get<{ item: RecruitmentPost }>(`/recruitments/admin/${idOrSlug}`);
    return response.data.item;
  },

  async create(payload: Partial<RecruitmentPost> & { body?: string; publishAt?: string | null; authorName?: string }): Promise<RecruitmentPost> {
    const response = await api.post<{ item: RecruitmentPost }>('/recruitments', payload);
    return response.data.item;
  },

  async update(idOrSlug: string, payload: Partial<RecruitmentPost> & { body?: string; publishAt?: string | null; authorName?: string }): Promise<RecruitmentPost> {
    const response = await api.patch<{ item: RecruitmentPost }>(`/recruitments/${idOrSlug}`, payload);
    return response.data.item;
  },

  async setStatus(idOrSlug: string, status: RecruitmentStatus, publishAt?: string | null): Promise<RecruitmentPost> {
    const response = await api.patch<{ item: RecruitmentPost }>(`/recruitments/${idOrSlug}/status`, { status, publishAt });
    return response.data.item;
  },

  async remove(idOrSlug: string): Promise<void> {
    await api.delete<{ success: boolean }>(`/recruitments/${idOrSlug}`);
  },
};

export default recruitmentService;


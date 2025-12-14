import { api } from './api';
import { RecruitmentPost } from '../types';

type ListParams = {
  page?: number;
  limit?: number;
  search?: string;
  tag?: string;
  role?: string;
  from?: string;
  to?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  status?: 'draft' | 'published';
};

const buildQuery = (params: Record<string, string | number | undefined | null>) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    searchParams.set(key, String(value));
  });
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
};

export const recruitmentApi = {
  async listPublic(params: ListParams = {}) {
    const query = buildQuery({
      page: params.page,
      limit: params.limit,
      search: params.search,
      tag: params.tag,
      role: params.role,
      from: params.from,
      to: params.to,
    });
    return api.get<{ items: RecruitmentPost[]; total: number; page: number; limit: number }>(`/recruitments${query}`);
  },

  async getPublic(slugOrId: string) {
    return api.get<{ item: RecruitmentPost }>(`/recruitments/${slugOrId}`);
  },

  async listAdmin(params: ListParams = {}) {
    const query = buildQuery({
      page: params.page,
      limit: params.limit,
      search: params.search,
      tag: params.tag,
      role: params.role,
      from: params.from,
      to: params.to,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
      status: params.status,
    });
    return api.get<{ items: RecruitmentPost[]; total: number; page: number; limit: number }>(`/recruitments/admin${query}`);
  },

  async create(payload: Partial<RecruitmentPost> & { body?: string; publishAt?: string | null }) {
    return api.post<{ item: RecruitmentPost }>('/recruitments', payload);
  },

  async update(idOrSlug: string, payload: Partial<RecruitmentPost> & { body?: string; publishAt?: string | null }) {
    return api.patch<{ item: RecruitmentPost }>(`/recruitments/${idOrSlug}`, payload);
  },

  async setStatus(idOrSlug: string, status: 'draft' | 'published', publishAt?: string | null) {
    return api.patch<{ item: RecruitmentPost }>(`/recruitments/${idOrSlug}/status`, {
      status,
      publishAt,
    });
  },

  async remove(idOrSlug: string) {
    return api.delete<{ success: boolean }>(`/recruitments/${idOrSlug}`);
  },
};

export type { ListParams as RecruitmentListParams };

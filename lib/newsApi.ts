import { api } from './api';
import { NewsArticle } from '../types';

type ListParams = {
  page?: number;
  limit?: number;
  search?: string;
  tag?: string;
  from?: string;
  to?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  status?: 'draft' | 'published';
  highlight?: boolean;
};

const buildQuery = (params: Record<string, string | number | boolean | undefined | null>) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    searchParams.set(key, String(value));
  });
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
};

export const newsApi = {
  async listPublic(params: ListParams = {}) {
    const query = buildQuery({
      page: params.page,
      limit: params.limit,
      search: params.search,
      tag: params.tag,
      from: params.from,
      to: params.to,
      highlight: params.highlight,
    });
    return api.get<{ items: NewsArticle[]; total: number; page: number; limit: number }>(`/news${query}`);
  },

  async getPublic(slugOrId: string) {
    return api.get<{ item: NewsArticle }>(`/news/${slugOrId}`);
  },

  async listAdmin(params: ListParams = {}) {
    const query = buildQuery({
      page: params.page,
      limit: params.limit,
      search: params.search,
      tag: params.tag,
      from: params.from,
      to: params.to,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
      status: params.status,
      highlight: params.highlight,
    });
    return api.get<{ items: NewsArticle[]; total: number; page: number; limit: number }>(`/news/admin${query}`);
  },

  async create(payload: Partial<NewsArticle> & { body?: string; publishAt?: string | null }) {
    return api.post<{ item: NewsArticle }>('/news', payload);
  },

  async update(idOrSlug: string, payload: Partial<NewsArticle> & { body?: string; publishAt?: string | null }) {
    return api.patch<{ item: NewsArticle }>(`/news/${idOrSlug}`, payload);
  },

  async setStatus(idOrSlug: string, status: 'draft' | 'published', publishAt?: string | null) {
    return api.patch<{ item: NewsArticle }>(`/news/${idOrSlug}/status`, {
      status,
      publishAt,
    });
  },

  async remove(idOrSlug: string) {
    return api.delete<{ success: boolean }>(`/news/${idOrSlug}`);
  },
};

export type { ListParams as NewsListParams };

import api from './api';
import { MentorPublicDetail, MentorPublicSummary } from '../types';

export type MentorSortValue = 'random' | 'newest' | 'oldest' | 'name-asc' | 'name-desc';

export interface MentorPublicFilters {
  search?: string;
  field?: string;
  sort?: MentorSortValue;
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const normalizeSearch = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

export const mentorPublicService = {
  async listPublic(filters: MentorPublicFilters = {}): Promise<PaginatedResponse<MentorPublicSummary>> {
    const response = await api.get<{ items: MentorPublicSummary[]; total: number; page: number; limit: number }>(
      '/mentors',
      {
        params: {
          page: filters.page ?? 1,
          limit: filters.limit ?? 12,
          search: normalizeSearch(filters.search),
          field: normalizeSearch(filters.field),
          sort: filters.sort,
        },
      }
    );

    const total = response.data.total || 0;
    const limit = response.data.limit || (filters.limit ?? 12);
    const page = response.data.page || (filters.page ?? 1);

    return {
      items: response.data.items || [],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  },

  async getPublic(id: string): Promise<MentorPublicDetail> {
    if (!id) {
      throw new Error('Mentor ID is required');
    }
    const response = await api.get<{ mentor: MentorPublicDetail }>(`/mentors/${encodeURIComponent(id)}`);
    return response.data.mentor;
  },
};

export default mentorPublicService;

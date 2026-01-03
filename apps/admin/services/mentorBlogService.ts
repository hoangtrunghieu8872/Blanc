import api from './api';
import { validateAndSanitizeUrl } from './documentService';
import { MentorBlogDetail, MentorBlogSummary } from '../types';

export interface MentorBlogFilters {
  search?: string;
  completed?: 'all' | 'completed' | 'incomplete';
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

export interface UpdateMentorBlogData {
  bannerUrl?: string;
  body?: string;
}

const sanitizeString = (value: unknown, maxLength: number): string => {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
};

const sanitizeBody = (value: unknown, maxLength: number): string => {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
};

const sanitizeOptionalUrl = (value: unknown): string => {
  const url = sanitizeString(value, 500);
  if (!url) return '';
  const validation = validateAndSanitizeUrl(url);
  if (!validation.isValid) {
    throw new Error(validation.error || 'Invalid URL');
  }
  return validation.sanitizedUrl;
};

const buildUpdatePayload = (data: UpdateMentorBlogData) => {
  const payload: Record<string, unknown> = {};

  if (data.bannerUrl !== undefined) {
    payload.bannerUrl = sanitizeOptionalUrl(data.bannerUrl);
  }

  if (data.body !== undefined) {
    payload.body = sanitizeBody(data.body, 20000);
  }

  return payload as UpdateMentorBlogData;
};

export const mentorBlogService = {
  async listAdmin(filters: MentorBlogFilters = {}): Promise<PaginatedResponse<MentorBlogSummary>> {
    const completedParam =
      filters.completed === 'completed'
        ? 'true'
        : filters.completed === 'incomplete'
          ? 'false'
          : undefined;

    const response = await api.get<{ items: MentorBlogSummary[]; total: number; page: number; limit: number }>(
      '/mentors/admin',
      {
        params: {
          page: filters.page ?? 1,
          limit: filters.limit ?? 12,
          search: filters.search?.trim() || undefined,
          completed: completedParam,
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

  async getAdmin(id: string): Promise<MentorBlogDetail> {
    const response = await api.get<{ mentor: MentorBlogDetail }>(`/mentors/admin/${id}`);
    return response.data.mentor;
  },

  async update(id: string, data: UpdateMentorBlogData): Promise<MentorBlogDetail> {
    const payload = buildUpdatePayload(data);
    const response = await api.patch<{ mentor: MentorBlogDetail }>(`/mentors/admin/${id}`, payload);
    return response.data.mentor;
  },
};

export default mentorBlogService;

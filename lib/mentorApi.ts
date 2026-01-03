import { api } from './api';
import { MentorBlog, MentorDetail, MentorSummary } from '../types';

type ListParams = {
  page?: number;
  limit?: number;
  search?: string;
  field?: string;
  sort?: string;
  seed?: string;
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

export const mentorApi = {
  async listPublic(params: ListParams = {}) {
    const query = buildQuery({
      page: params.page,
      limit: params.limit,
      search: params.search,
      field: params.field,
      sort: params.sort,
      seed: params.seed,
    });
    return api.get<{ items: MentorSummary[]; total: number; page: number; limit: number }>(`/mentors${query}`);
  },

  async getPublic(id: string) {
    return api.get<{ mentor: MentorDetail }>(`/mentors/${id}`);
  },

  async getMyBlog() {
    return api.get<{ blog: MentorBlog; mentorBlogCompleted: boolean }>(`/mentors/me/blog`);
  },

  async updateMyBlog(payload: { bannerUrl?: string; body?: string }) {
    return api.patch<{ blog: MentorBlog; mentorBlogCompleted: boolean }>(`/mentors/me/blog`, payload);
  },
};

/**
 * News Service
 * Admin-focused API operations for managing "News" items.
 *
 * Security:
 * - Input trimming + length limits to match backend constraints
 * - URL validation to prevent dangerous protocols
 */

import api from './api';
import { validateAndSanitizeUrl } from './documentService';
import { NewsArticle, NewsType } from '../types';

export interface NewsFilters {
  search?: string;
  status?: 'draft' | 'published' | 'all';
  tag?: string;
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

export interface CreateNewsData {
  title: string;
  summary?: string;
  body: string;
  tags?: string[] | string;
  coverImage?: string;
  type?: NewsType;
  highlight?: boolean;
  actionLabel?: string;
  actionLink?: string;
  status?: 'draft' | 'published';
  publishAt?: string | null;
  authorName?: string;
}

export type UpdateNewsData = Partial<CreateNewsData>;

const sanitizeString = (value: unknown, maxLength: number): string => {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
};

const sanitizeBody = (value: unknown, maxLength: number): string => {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
};

const normalizeStatus = (value: unknown): 'draft' | 'published' => {
  return value === 'published' ? 'published' : 'draft';
};

const normalizeType = (value: unknown): NewsType => {
  const v = String(value || '');
  if (v === 'minigame' || v === 'update' || v === 'event' || v === 'tip') return v;
  return 'announcement';
};

const sanitizeTags = (tags: unknown, maxItems = 10): string[] => {
  const raw: string[] = Array.isArray(tags)
    ? tags.filter((t) => typeof t === 'string') as string[]
    : typeof tags === 'string'
      ? tags.split(',').map((t) => t.trim())
      : [];

  const unique = new Set<string>();
  const result: string[] = [];
  for (const tag of raw) {
    const t = sanitizeString(tag, 50);
    if (!t) continue;
    const key = t.toLowerCase();
    if (unique.has(key)) continue;
    unique.add(key);
    result.push(t);
    if (result.length >= maxItems) break;
  }
  return result;
};

const sanitizeOptionalUrl = (value: unknown): string => {
  const url = sanitizeString(value, 500);
  if (!url) return '';
  // Support legacy placeholder links (e.g. seeded "#") by treating them as empty.
  // Backend only allows absolute http(s) or app-relative paths; plain hash links are not meaningful.
  if (url.startsWith('#')) return '';
  const validation = validateAndSanitizeUrl(url);
  if (!validation.isValid) {
    throw new Error(validation.error || 'Invalid URL');
  }
  return validation.sanitizedUrl;
};

const sanitizePublishAt = (value: unknown): string | null | undefined => {
  if (value === null) return null;
  if (value === undefined) return undefined;
  const raw = sanitizeString(value, 40);
  if (!raw) return undefined;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid publish date');
  }
  return parsed.toISOString();
};

const sanitizeCreatePayload = (data: CreateNewsData) => {
  const title = sanitizeString(data.title, 200);
  const summary = sanitizeString(data.summary, 500);
  const body = sanitizeBody(data.body, 20000);
  if (!title) throw new Error('Title is required');
  if (!body) throw new Error('Body is required');

  return {
    title,
    summary,
    body,
    tags: sanitizeTags(data.tags),
    coverImage: sanitizeOptionalUrl(data.coverImage),
    type: normalizeType(data.type),
    highlight: !!data.highlight,
    actionLabel: sanitizeString(data.actionLabel, 80),
    actionLink: sanitizeOptionalUrl(data.actionLink),
    status: normalizeStatus(data.status),
    publishAt: sanitizePublishAt(data.publishAt),
    authorName: sanitizeString(data.authorName, 120),
  };
};

const sanitizeUpdatePayload = (data: UpdateNewsData) => {
  const payload: Record<string, unknown> = {};

  if (data.title !== undefined) {
    const title = sanitizeString(data.title, 200);
    if (!title) throw new Error('Title cannot be empty');
    payload.title = title;
  }
  if (data.summary !== undefined) payload.summary = sanitizeString(data.summary, 500);
  if (data.body !== undefined) {
    const body = sanitizeBody(data.body, 20000);
    if (!body) throw new Error('Body cannot be empty');
    payload.body = body;
  }
  if (data.tags !== undefined) payload.tags = sanitizeTags(data.tags);
  if (data.coverImage !== undefined) payload.coverImage = sanitizeOptionalUrl(data.coverImage);
  if (data.type !== undefined) payload.type = normalizeType(data.type);
  if (data.highlight !== undefined) payload.highlight = !!data.highlight;
  if (data.actionLabel !== undefined) payload.actionLabel = sanitizeString(data.actionLabel, 80);
  if (data.actionLink !== undefined) payload.actionLink = sanitizeOptionalUrl(data.actionLink);
  if (data.status !== undefined) payload.status = normalizeStatus(data.status);
  if (data.publishAt !== undefined) payload.publishAt = sanitizePublishAt(data.publishAt);
  if (data.authorName !== undefined) payload.authorName = sanitizeString(data.authorName, 120);

  return payload as UpdateNewsData;
};

export const newsService = {
  async listAdmin(filters: NewsFilters = {}): Promise<PaginatedResponse<NewsArticle>> {
    const response = await api.get<{ items: NewsArticle[]; total: number; page: number; limit: number }>('/news/admin', {
      params: {
        page: filters.page ?? 1,
        limit: filters.limit ?? 20,
        search: filters.search?.trim() || undefined,
        tag: filters.tag?.trim() || undefined,
        status: filters.status && filters.status !== 'all' ? filters.status : undefined,
        from: filters.from,
        to: filters.to,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
      },
    });

    const total = response.data.total || 0;
    const limit = response.data.limit || (filters.limit ?? 20);
    const page = response.data.page || (filters.page ?? 1);

    return {
      items: response.data.items || [],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  },

  async getAdmin(idOrSlug: string): Promise<NewsArticle> {
    const response = await api.get<{ item: NewsArticle }>(`/news/admin/${idOrSlug}`);
    return response.data.item;
  },

  async create(data: CreateNewsData): Promise<NewsArticle> {
    const payload = sanitizeCreatePayload(data);
    const response = await api.post<{ item: NewsArticle }>('/news', payload);
    return response.data.item;
  },

  async update(idOrSlug: string, data: UpdateNewsData): Promise<NewsArticle> {
    const payload = sanitizeUpdatePayload(data);
    const response = await api.patch<{ item: NewsArticle }>(`/news/${idOrSlug}`, payload);
    return response.data.item;
  },

  async setStatus(idOrSlug: string, status: 'draft' | 'published', publishAt?: string | null): Promise<NewsArticle> {
    const response = await api.patch<{ item: NewsArticle }>(`/news/${idOrSlug}/status`, {
      status: normalizeStatus(status),
      publishAt: sanitizePublishAt(publishAt),
    });
    return response.data.item;
  },

  async remove(idOrSlug: string): Promise<void> {
    await api.delete(`/news/${idOrSlug}`);
  },
};

export default newsService;

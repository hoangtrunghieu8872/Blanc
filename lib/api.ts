import { apiCache, sessionCache, CACHE_TTL } from './cache';

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

// Request deduplication - prevent multiple identical requests
const pendingRequests = new Map<string, Promise<unknown>>();

// Generic fetch wrapper with error handling and caching
async function fetchAPI<T>(
  endpoint: string,
  options?: Omit<RequestInit, 'cache'> & {
    useCache?: boolean;
    cacheTTL?: number;
    cacheKey?: string;
  }
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const { useCache = false, cacheTTL, cacheKey, ...fetchOptions } = options || {};

  // Generate cache key
  const key = cacheKey || `api:${endpoint}`;

  // Check memory cache first (for GET requests only)
  if (useCache && (!fetchOptions.method || fetchOptions.method === 'GET')) {
    const cached = apiCache.get<T>(key);
    if (cached) {
      return cached;
    }

    // Also check session storage for persistence
    const sessionCached = sessionCache.get<T>(key);
    if (sessionCached) {
      apiCache.set(key, sessionCached, cacheTTL);
      return sessionCached;
    }
  }

  // Request deduplication for GET requests
  const isGet = !fetchOptions.method || fetchOptions.method === 'GET';
  if (isGet && pendingRequests.has(key)) {
    return pendingRequests.get(key) as Promise<T>;
  }

  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...fetchOptions?.headers,
    },
    ...fetchOptions,
  };

  // Add auth token if available
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    };
  }

  const requestPromise = (async () => {
    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Cache successful GET responses
      if (useCache && isGet && cacheTTL) {
        apiCache.set(key, data, cacheTTL);
        sessionCache.set(key, data, cacheTTL);
      }

      return data as T;
    } finally {
      // Clean up pending request
      if (isGet) {
        pendingRequests.delete(key);
      }
    }
  })();

  // Store pending request for deduplication
  if (isGet) {
    pendingRequests.set(key, requestPromise);
  }

  return requestPromise;
}

// API exports with cache support
export const api = {
  get: <T>(endpoint: string, options?: { useCache?: boolean; cacheTTL?: number; cacheKey?: string }) =>
    fetchAPI<T>(endpoint, { method: 'GET', ...options }),

  post: <T>(endpoint: string, data?: unknown) =>
    fetchAPI<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  put: <T>(endpoint: string, data: unknown) =>
    fetchAPI<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  patch: <T>(endpoint: string, data: unknown) =>
    fetchAPI<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: <T>(endpoint: string) =>
    fetchAPI<T>(endpoint, { method: 'DELETE' }),
};

// Cached API helpers for common endpoints
export const cachedApi = {
  getStats: () => api.get('/stats', { useCache: true, cacheTTL: CACHE_TTL.STATS }),

  getContests: (limit = 10) =>
    api.get(`/contests?limit=${limit}`, { useCache: true, cacheTTL: CACHE_TTL.CONTESTS }),

  getCourses: (limit = 10, level?: string) => {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (level) params.append('level', level);
    return api.get(`/courses?${params}`, { useCache: true, cacheTTL: CACHE_TTL.COURSES });
  },

  getCourseDetail: (id: string) =>
    api.get(`/courses/${id}`, { useCache: true, cacheTTL: CACHE_TTL.COURSE_DETAIL, cacheKey: `course:${id}` }),

  getContestDetail: (id: string) =>
    api.get(`/contests/${id}`, { useCache: true, cacheTTL: CACHE_TTL.COURSE_DETAIL, cacheKey: `contest:${id}` }),
};

// Cache invalidation helpers
export const invalidateCache = {
  all: () => {
    apiCache.clear();
    sessionCache.clear();
  },
  stats: () => apiCache.invalidate('api:/stats'),
  contests: () => apiCache.invalidatePattern('contest'),
  courses: () => apiCache.invalidatePattern('course'),
  course: (id: string) => apiCache.invalidate(`course:${id}`),
};

export { API_BASE_URL, CACHE_TTL };


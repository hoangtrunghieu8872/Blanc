import { apiCache, sessionCache, localCache, CACHE_TTL } from './cache';

// API Configuration
const apiBaseUrlRaw =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? '/api' : 'http://localhost:4000/api');
const API_BASE_URL = apiBaseUrlRaw.replace(/\/+$/, '');

// Request deduplication - prevent multiple identical requests
const pendingRequests = new Map<string, Promise<unknown>>();

function getCookieValue(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

// Generic fetch wrapper with error handling and caching
async function fetchAPI<T>(
  endpoint: string,
  options?: Omit<RequestInit, 'cache'> & {
    useCache?: boolean;
    cacheTTL?: number;
    cacheKey?: string;
    persist?: 'session' | 'local';
  }
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const { useCache = false, cacheTTL, cacheKey, persist = 'session', ...fetchOptions } = options || {};

  // Generate cache key
  const key = cacheKey || `api:${endpoint}`;
  const persistentCache = persist === 'local' ? localCache : sessionCache;

  // Check memory cache first (for GET requests only)
  if (useCache && (!fetchOptions.method || fetchOptions.method === 'GET')) {
    const cached = apiCache.get<T>(key);
    if (cached) {
      return cached;
    }

    // Also check persistent storage (sessionStorage or localStorage)
    const persistentCached = persistentCache.get<T>(key);
    if (persistentCached) {
      apiCache.set(key, persistentCached, cacheTTL);
      return persistentCached;
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
    credentials: 'include',
    ...fetchOptions,
  };

  // CSRF token for cookie-based auth (required for state-changing requests)
  const method = String(config.method || 'GET').toUpperCase();
  const isSafeMethod = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
  if (!isSafeMethod) {
    const csrf = getCookieValue('csrf_token');
    if (csrf) {
      config.headers = {
        ...config.headers,
        'X-CSRF-Token': csrf,
      };
    }
  }

  const requestPromise = (async () => {
    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const baseMessage = errorData?.error || `HTTP error! status: ${response.status}`;
        const details =
          Array.isArray(errorData?.details) && errorData.details.length > 0
            ? `: ${errorData.details.join('; ')}`
            : '';
        throw new Error(`${baseMessage}${details}`);
      }

      const data = await response.json();

      // Cache successful GET responses
      if (useCache && isGet && cacheTTL) {
        apiCache.set(key, data, cacheTTL);
        persistentCache.set(key, data, cacheTTL);
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
  get: <T>(
    endpoint: string,
    options?: { useCache?: boolean; cacheTTL?: number; cacheKey?: string; persist?: 'session' | 'local' }
  ) =>
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
  getStats: () => api.get('/stats', { useCache: true, cacheTTL: CACHE_TTL.STATS, persist: 'local' }),

  getContests: (limit = 10) =>
    api.get(`/contests?limit=${limit}`, { useCache: true, cacheTTL: CACHE_TTL.CONTESTS, persist: 'local' }),

  getCourses: (limit = 10, level?: string) => {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (level) params.append('level', level);
    return api.get(`/courses?${params}`, { useCache: true, cacheTTL: CACHE_TTL.COURSES, persist: 'local' });
  },

  getCourseDetail: (id: string) =>
    api.get(`/courses/${id}`, { useCache: true, cacheTTL: CACHE_TTL.COURSE_DETAIL, cacheKey: `course:${id}` }),

  getContestDetail: (id: string) =>
    api.get(`/contests/${id}`, { useCache: true, cacheTTL: CACHE_TTL.COURSE_DETAIL, cacheKey: `contest:${id}` }),

  getMembershipPlans: () =>
    api.get('/membership/plans', { useCache: true, cacheTTL: CACHE_TTL.MEMBERSHIP_PLANS, cacheKey: 'membership:plans', persist: 'local' }),
};

// Cache invalidation helpers
export const invalidateCache = {
  all: () => {
    apiCache.clear();
    sessionCache.clear();
    localCache.clear();
  },
  stats: () => apiCache.invalidate('api:/stats'),
  contests: () => apiCache.invalidatePattern('contest'),
  courses: () => apiCache.invalidatePattern('course'),
  course: (id: string) => apiCache.invalidate(`course:${id}`),
};

export { API_BASE_URL, CACHE_TTL };

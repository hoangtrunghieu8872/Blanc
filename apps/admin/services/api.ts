/**
 * API Service Configuration
 * Provides secure axios instance with:
 * - JWT token management
 * - Request/Response interceptors
 * - Automatic token refresh
 * - Error handling
 */

const apiBaseUrlRaw =
    import.meta.env.VITE_API_URL ||
    (import.meta.env.PROD ? '/api' : 'http://localhost:4000/api');
const API_BASE_URL = apiBaseUrlRaw.replace(/\/+$/, '');

// Token storage keys
const ACCESS_TOKEN_KEY = 'admin_access_token';
const REFRESH_TOKEN_KEY = 'admin_refresh_token';

// Types
interface ApiResponse<T> {
    data: T;
    message?: string;
    success: boolean;
}

interface AuthTokens {
    accessToken: string;
    refreshToken: string;
}

interface RequestConfig extends RequestInit {
    params?: Record<string, string | number | boolean | undefined>;
    skipAuth?: boolean;
}

function getCookieValue(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
}

// Token management
export const tokenManager = {
    getAccessToken: (): string | null => {
        return localStorage.getItem(ACCESS_TOKEN_KEY);
    },

    getRefreshToken: (): string | null => {
        return localStorage.getItem(REFRESH_TOKEN_KEY);
    },

    setTokens: (tokens: AuthTokens): void => {
        localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
        localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
    },

    clearTokens: (): void => {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
    },

    isAuthenticated: (): boolean => {
        const token = localStorage.getItem(ACCESS_TOKEN_KEY);
        if (!token) return false;

        try {
            // Decode JWT to check expiration
            const payload = JSON.parse(atob(token.split('.')[1]));
            const expirationTime = payload.exp * 1000;
            return Date.now() < expirationTime;
        } catch {
            return false;
        }
    }
};

// Refresh token logic
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

const refreshAccessToken = async (): Promise<boolean> => {
    if (isRefreshing && refreshPromise) {
        return refreshPromise;
    }

    isRefreshing = true;
    refreshPromise = (async () => {
        try {
            const refreshToken = tokenManager.getRefreshToken();
            if (!refreshToken) {
                throw new Error('No refresh token');
            }

            const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ refreshToken }),
            });

            if (!response.ok) {
                throw new Error('Failed to refresh token');
            }

            const data = await response.json();
            tokenManager.setTokens({
                accessToken: data.accessToken,
                refreshToken: data.refreshToken || refreshToken,
            });

            return true;
        } catch (error) {
            tokenManager.clearTokens();
            window.dispatchEvent(new CustomEvent('auth:logout'));
            return false;
        } finally {
            isRefreshing = false;
            refreshPromise = null;
        }
    })();

    return refreshPromise;
};

// Build URL with query params
const buildUrl = (endpoint: string, params?: Record<string, string | number | boolean | undefined>): string => {
    const fallbackOrigin =
        typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null'
            ? window.location.origin
            : 'http://localhost';

    // If API_BASE_URL is relative (e.g. "/api" on Netlify), URL() needs a base.
    // If it's absolute (e.g. https://example.com/api), the base is ignored.
    const url = new URL(`${API_BASE_URL}${endpoint}`, fallbackOrigin);

    if (params) {
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined) {
                url.searchParams.append(key, String(value));
            }
        });
    }

    return url.toString();
};

// Main API request function
async function apiRequest<T>(
    endpoint: string,
    config: RequestConfig = {}
): Promise<ApiResponse<T>> {
    const { params, skipAuth = false, ...fetchConfig } = config;

    const url = buildUrl(endpoint, params);

    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...fetchConfig.headers,
    };

    // Add CSRF token for cookie-based auth on state-changing requests
    const method = String(fetchConfig.method || 'GET').toUpperCase();
    const isSafeMethod = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
    if (!isSafeMethod) {
        const csrf = getCookieValue('csrf_token');
        if (csrf) {
            (headers as Record<string, string>)['X-CSRF-Token'] = csrf;
        }
    }

    // Add authorization header if not skipped (legacy support)
    if (!skipAuth) {
        const accessToken = tokenManager.getAccessToken();
        if (accessToken) {
            (headers as Record<string, string>)['Authorization'] = `Bearer ${accessToken}`;
        }
    }

    try {
        let response = await fetch(url, {
            ...fetchConfig,
            headers,
            credentials: 'include',
        });

        // Handle 401 - try to refresh token
        if (response.status === 401 && !skipAuth) {
            const hasRefreshToken = Boolean(tokenManager.getRefreshToken());
            const refreshed = hasRefreshToken ? await refreshAccessToken() : false;
            if (refreshed) {
                // Retry the request with new token
                const newAccessToken = tokenManager.getAccessToken();
                (headers as Record<string, string>)['Authorization'] = `Bearer ${newAccessToken}`;

                response = await fetch(url, {
                    ...fetchConfig,
                    headers,
                    credentials: 'include',
                });
            } else {
                throw new ApiError('Session expired. Please login again.', 401);
            }
        }

        // Parse response
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new ApiError(
                data.message || `Request failed with status ${response.status}`,
                response.status,
                data
            );
        }

        return {
            data: data.data ?? data,
            message: data.message,
            success: true,
        };
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }

        // Network error or other
        throw new ApiError(
            error instanceof Error ? error.message : 'Network error occurred',
            0
        );
    }
}

// Custom API Error class
export class ApiError extends Error {
    public status: number;
    public data?: unknown;

    constructor(message: string, status: number, data?: unknown) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.data = data;
    }
}

// HTTP method helpers
export const api = {
    get: <T>(endpoint: string, config?: RequestConfig) =>
        apiRequest<T>(endpoint, { ...config, method: 'GET' }),

    post: <T>(endpoint: string, body?: unknown, config?: RequestConfig) =>
        apiRequest<T>(endpoint, {
            ...config,
            method: 'POST',
            body: body ? JSON.stringify(body) : undefined,
        }),

    put: <T>(endpoint: string, body?: unknown, config?: RequestConfig) =>
        apiRequest<T>(endpoint, {
            ...config,
            method: 'PUT',
            body: body ? JSON.stringify(body) : undefined,
        }),

    patch: <T>(endpoint: string, body?: unknown, config?: RequestConfig) =>
        apiRequest<T>(endpoint, {
            ...config,
            method: 'PATCH',
            body: body ? JSON.stringify(body) : undefined,
        }),

    delete: <T>(endpoint: string, config?: RequestConfig) =>
        apiRequest<T>(endpoint, { ...config, method: 'DELETE' }),
};

export default api;

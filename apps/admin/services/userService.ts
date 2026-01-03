/**
 * User Service
 * API operations for user management
 * Kết nối với backend API: GET /admin/users
 * 
 * Features:
 * - Caching để giảm API calls
 * - AbortController để cancel requests
 * - Retry logic cho network errors
 * - Sanitization và validation dữ liệu
 */

import api, { ApiError } from './api';
import { User, UserProfile, UpdateUserPayload, UpdateStatusPayload, DeleteUserPayload } from '../types';

// ==========================================
// TYPES & INTERFACES
// ==========================================

export interface UserFilters {
    search?: string;
    role?: 'student' | 'mentor' | 'admin' | 'super_admin';
    status?: 'active' | 'banned';
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface CreateUserData {
    name: string;
    email: string;
    password: string;
    role: 'student' | 'mentor' | 'admin' | 'super_admin';
}

export interface UpdateUserData {
    name?: string;
    email?: string;
    role?: 'student' | 'mentor' | 'admin' | 'super_admin';
    status?: 'active' | 'banned';
    balance?: number;
}

// ==========================================
// CACHING SYSTEM
// ==========================================

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    key: string;
}

const CACHE_TTL = 30 * 1000; // 30 seconds cache
const userCache = new Map<string, CacheEntry<PaginatedResponse<User>>>();

const generateCacheKey = (filters: UserFilters): string => {
    return JSON.stringify({
        page: filters.page || 1,
        limit: filters.limit || 10,
        search: filters.search || '',
        role: filters.role || '',
        status: filters.status || '',
        sortBy: filters.sortBy || '',
        sortOrder: filters.sortOrder || '',
    });
};

const getCachedData = (key: string): PaginatedResponse<User> | null => {
    const entry = userCache.get(key);
    if (!entry) return null;

    const isExpired = Date.now() - entry.timestamp > CACHE_TTL;
    if (isExpired) {
        userCache.delete(key);
        return null;
    }

    return entry.data;
};

const setCachedData = (key: string, data: PaginatedResponse<User>): void => {
    // Limit cache size to prevent memory leaks
    if (userCache.size > 50) {
        const oldestKey = userCache.keys().next().value;
        if (oldestKey) userCache.delete(oldestKey);
    }

    userCache.set(key, {
        data,
        timestamp: Date.now(),
        key,
    });
};

// Clear cache when data is modified
const invalidateCache = (): void => {
    userCache.clear();
};

// ==========================================
// DATA SANITIZATION & VALIDATION
// ==========================================

// Sanitize string to prevent XSS
const sanitizeString = (str: string | undefined | null): string => {
    if (!str) return '';
    return str
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .trim();
};

// Validate email format
const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

// Transform and validate user data from API
const transformUser = (rawUser: any): User => {
    const id = String(rawUser.id || rawUser._id || '');
    const name = sanitizeString(rawUser.name || rawUser.fullName || rawUser.username);
    const email = sanitizeString(rawUser.email);

    // Validate required fields
    if (!id) {
        console.warn('User missing ID:', rawUser);
    }

    // Generate avatar if not provided
    const avatar = rawUser.avatar || rawUser.avatarUrl ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=random&color=fff`;

    // Normalize role
    const role: 'student' | 'mentor' | 'admin' | 'super_admin' =
        rawUser.role === 'super_admin'
            ? 'super_admin'
            : rawUser.role === 'admin'
                ? 'admin'
                : rawUser.role === 'mentor'
                    ? 'mentor'
                    : 'student';

    // Normalize status
    const status: 'active' | 'banned' =
        rawUser.status === 'banned' || rawUser.status === 'inactive' || rawUser.status === 'suspended'
            ? 'banned'
            : 'active';

    // Normalize balance
    const balance = typeof rawUser.balance === 'number'
        ? rawUser.balance
        : (rawUser.wallet?.balance || 0);

    return {
        id,
        name,
        email,
        avatar,
        role,
        status,
        balance: Math.max(0, balance), // Ensure non-negative
    };
};

// ==========================================
// RETRY LOGIC
// ==========================================

const MAX_RETRIES = 2;
const RETRY_DELAY = 1000;

const delay = (ms: number): Promise<void> =>
    new Promise(resolve => setTimeout(resolve, ms));

const shouldRetry = (error: any, retryCount: number): boolean => {
    if (retryCount >= MAX_RETRIES) return false;

    // Retry on network errors or 5xx server errors
    if (error instanceof ApiError) {
        return error.status >= 500 || error.status === 0;
    }

    return false;
};

// ==========================================
// API SERVICE
// ==========================================

export const userService = {
    /**
     * Get all users with optional filters
     * Endpoint: GET /admin/users
     * 
     * @param filters - Optional filtering and pagination options
     * @param options - Request options including signal for abort
     */
    getAll: async (
        filters: UserFilters = {},
        options?: { signal?: AbortSignal; skipCache?: boolean }
    ): Promise<PaginatedResponse<User>> => {
        const limit = Math.min(filters.limit || 10, 100); // Max 100 per page
        const page = Math.max(filters.page || 1, 1); // Min page 1

        // Check cache first (unless skipCache is true)
        const cacheKey = generateCacheKey({ ...filters, page, limit });
        if (!options?.skipCache) {
            const cachedData = getCachedData(cacheKey);
            if (cachedData) {
                return cachedData;
            }
        }

        // Build query params
        const params: Record<string, string | number | boolean | undefined> = {
            page,
            limit,
        };

        // Sanitize search input
        if (filters.search) {
            const sanitizedSearch = sanitizeString(filters.search);
            if (sanitizedSearch.length > 0 && sanitizedSearch.length <= 100) {
                params.search = sanitizedSearch;
            }
        }

        if (filters.role && ['admin', 'student'].includes(filters.role)) {
            params.role = filters.role;
        }

        if (filters.status && ['active', 'banned'].includes(filters.status)) {
            params.status = filters.status;
        }

        if (filters.sortBy) {
            params.sortBy = sanitizeString(filters.sortBy);
            params.sortOrder = filters.sortOrder || 'asc';
        }

        let retryCount = 0;
        let lastError: any;

        while (retryCount <= MAX_RETRIES) {
            try {
                const response = await api.get<any>('/admin/users', {
                    params,
                    signal: options?.signal,
                });

                const data = response.data;

                // Handle different response formats from backend
                const rawUsers = data.users || data.items || data.data || (Array.isArray(data) ? data : []);
                const total = data.total || data.totalCount || data.count || rawUsers.length;
                const totalPages = data.totalPages || Math.ceil(total / limit);

                // Transform and validate each user
                const users: User[] = rawUsers.map(transformUser).filter((u: User) => u.id);

                const result: PaginatedResponse<User> = {
                    items: users,
                    total,
                    page: data.page || page,
                    limit,
                    totalPages,
                };

                // Cache the result
                setCachedData(cacheKey, result);

                return result;
            } catch (error: any) {
                lastError = error;

                // Don't retry if request was aborted
                if (error.name === 'AbortError' || options?.signal?.aborted) {
                    // Return empty result instead of throwing for aborted requests
                    const emptyResult: PaginatedResponse<User> = {
                        items: [],
                        total: 0,
                        page,
                        limit,
                        totalPages: 0,
                    };
                    return emptyResult;
                }

                if (shouldRetry(error, retryCount)) {
                    retryCount++;
                    await delay(RETRY_DELAY * retryCount); // Exponential backoff
                    continue;
                }

                throw error;
            }
        }

        throw lastError;
    },

    /**
     * Get single user by ID
     * Endpoint: GET /admin/users/:id
     */
    getById: async (id: string, options?: { signal?: AbortSignal }): Promise<User> => {
        if (!id || typeof id !== 'string') {
            throw new Error('Invalid user ID');
        }

        const response = await api.get<any>(`/admin/users/${encodeURIComponent(id)}`, {
            signal: options?.signal,
        });
        return transformUser(response.data);
    },

    /**
     * Create new user
     * Endpoint: POST /admin/users
     */
    create: async (data: CreateUserData): Promise<User> => {
        // Validate input
        if (!data.name || data.name.trim().length < 2) {
            throw new Error('Name must be at least 2 characters');
        }
        if (!data.email || !isValidEmail(data.email)) {
            throw new Error('Invalid email format');
        }
        if (!data.password || data.password.length < 6) {
            throw new Error('Password must be at least 6 characters');
        }

        const sanitizedData = {
            name: sanitizeString(data.name),
            email: data.email.trim().toLowerCase(),
            password: data.password,
            role: ['student', 'mentor', 'admin', 'super_admin'].includes(data.role) ? data.role : 'student',
        };

        const response = await api.post<any>('/admin/users', sanitizedData);

        // Invalidate cache after creating user
        invalidateCache();

        return transformUser(response.data);
    },

    /**
     * Update user
     * Endpoint: PATCH /admin/users/:id
     */
    update: async (id: string, data: UpdateUserData): Promise<User> => {
        if (!id) {
            throw new Error('User ID is required');
        }

        const sanitizedData: Record<string, any> = {};

        if (data.name !== undefined) {
            sanitizedData.name = sanitizeString(data.name);
        }
        if (data.email !== undefined) {
            if (!isValidEmail(data.email)) {
                throw new Error('Invalid email format');
            }
            sanitizedData.email = data.email.trim().toLowerCase();
        }
        if (data.role !== undefined) {
            sanitizedData.role = ['student', 'mentor', 'admin', 'super_admin'].includes(data.role)
                ? data.role
                : 'student';
        }
        if (data.status !== undefined) {
            sanitizedData.status = data.status === 'banned' ? 'banned' : 'active';
        }
        if (data.balance !== undefined) {
            sanitizedData.balance = Math.max(0, Number(data.balance) || 0);
        }

        const response = await api.patch<any>(`/admin/users/${encodeURIComponent(id)}`, sanitizedData);

        // Invalidate cache after updating user
        invalidateCache();

        return transformUser(response.data);
    },

    /**
     * Delete user
     * Endpoint: DELETE /admin/users/:id
     */
    delete: async (id: string): Promise<void> => {
        if (!id) {
            throw new Error('User ID is required');
        }

        await api.delete(`/admin/users/${encodeURIComponent(id)}`);

        // Invalidate cache after deleting user
        invalidateCache();
    },

    /**
     * Ban user
     * Endpoint: POST /admin/users/:id/ban
     */
    ban: async (id: string, reason?: string): Promise<User> => {
        if (!id) {
            throw new Error('User ID is required');
        }

        const response = await api.post<any>(`/admin/users/${encodeURIComponent(id)}/ban`, {
            reason: reason ? sanitizeString(reason) : undefined,
        });

        invalidateCache();
        return transformUser(response.data);
    },

    /**
     * Activate/unban user
     * Endpoint: POST /admin/users/:id/activate
     */
    activate: async (id: string): Promise<User> => {
        if (!id) {
            throw new Error('User ID is required');
        }

        const response = await api.post<any>(`/admin/users/${encodeURIComponent(id)}/activate`);

        invalidateCache();
        return transformUser(response.data);
    },

    /**
     * Reset user password (admin)
     * Endpoint: PATCH /admin/users/:id
     */
    resetPassword: async (id: string): Promise<{ temporaryPassword: string }> => {
        if (!id) {
            throw new Error('User ID is required');
        }

        // Generate secure temporary password
        const tempPassword = Array.from(crypto.getRandomValues(new Uint8Array(12)))
            .map(b => String.fromCharCode((b % 62) + (b % 62 < 10 ? 48 : b % 62 < 36 ? 55 : 61)))
            .join('');

        await api.patch(`/admin/users/${encodeURIComponent(id)}`, { password: tempPassword });

        return { temporaryPassword: tempPassword };
    },

    /**
     * Get user statistics
     * Endpoint: GET /admin/users/stats
     */
    getStats: async (options?: { signal?: AbortSignal }): Promise<{
        totalUsers: number;
        activeUsers: number;
        bannedUsers: number;
        newUsersThisMonth: number;
    }> => {
        try {
            const response = await api.get<{
                totalUsers: number;
                activeUsers: number;
                bannedUsers: number;
                newUsersThisMonth: number;
            }>('/admin/users/stats', { signal: options?.signal });

            return {
                totalUsers: Math.max(0, response.data.totalUsers || 0),
                activeUsers: Math.max(0, response.data.activeUsers || 0),
                bannedUsers: Math.max(0, response.data.bannedUsers || 0),
                newUsersThisMonth: Math.max(0, response.data.newUsersThisMonth || 0),
            };
        } catch (error) {
            // Don't throw on stats error, return defaults
            console.warn('Failed to fetch user stats:', error);
            return {
                totalUsers: 0,
                activeUsers: 0,
                bannedUsers: 0,
                newUsersThisMonth: 0,
            };
        }
    },

    /**
     * Invalidate user cache
     * Call this when user data might have changed from external source
     */
    invalidateCache,

    // ==========================================
    // ADMIN USER MANAGEMENT OPERATIONS
    // ==========================================

    /**
     * Get detailed user profile (Admin only)
     * Returns full profile with wallet, counts, and extended info
     */
    getUserProfile: async (userId: string): Promise<UserProfile> => {
        const response = await api.get<UserProfile>(`/admin/users/${userId}/profile`);
        return response.data;
    },

    /**
     * Update user details (Admin only)
     * Includes audit logging on backend
     */
    updateUserDetails: async (userId: string, data: UpdateUserPayload): Promise<UserProfile> => {
        const response = await api.put<UserProfile>(`/admin/users/${userId}`, data);
        return response.data;
    },

    /**
     * Update user status - activate/deactivate/ban (Admin only)
     * Requires reason for banning
     */
    updateUserStatus: async (userId: string, data: UpdateStatusPayload): Promise<User> => {
        // Fallback to dedicated endpoints to avoid path issues
        if (data.status === 'banned') {
            return userService.ban(userId, data.reason);
        }
        if (data.status === 'active') {
            return userService.activate(userId);
        }
        const response = await api.patch<User>(`/admin/users/${userId}/status`, data);
        return response.data;
    },

    /**
     * Delete user account (Admin only)
     * Supports soft delete (default) or hard delete
     * Soft delete: marks user as 'deleted'
     * Hard delete: removes user and related records
     */
    deleteUser: async (userId: string, data: DeleteUserPayload = {}): Promise<{ message: string }> => {
        const response = await api.delete<{ message: string }>(`/admin/users/${userId}`, {
            body: JSON.stringify(data),
        });
        return response.data;
    },
};

export default userService;

/**
 * Course Service
 * API operations for course management
 * Includes security measures for contact validation and sanitization
 */

import api from './api';
import { Course } from '../types';

export interface CourseFilters {
    search?: string;
    level?: 'Beginner' | 'Intermediate' | 'Advanced';
    instructor?: string;
    minPrice?: number;
    maxPrice?: number;
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

export interface CourseSectionData {
    title: string;
    lessons: number;
    duration: string;
    description?: string;
}

export interface CreateCourseData {
    title: string;
    instructor: string;
    contact?: string; // Deprecated: use contactInfo
    contactInfo?: string; // Phone number or link
    contactType?: 'link' | 'phone';
    price: number;
    level: 'Beginner' | 'Intermediate' | 'Advanced';
    image?: string;
    description?: string;
    syllabus?: string;
    // Schedule fields
    duration?: string; // e.g., "8 tuần", "20 giờ"
    hoursPerWeek?: number;
    startDate?: string;
    endDate?: string;
    // New fields
    benefits?: string[];
    sections?: CourseSectionData[];
    category?: string;
}

export interface UpdateCourseData extends Partial<CreateCourseData> {
    published?: boolean;
}

/**
 * Validate and sanitize contact (phone or URL)
 * Prevents XSS and ensures valid format
 */
export const validateAndSanitizeContact = (contact: string): { isValid: boolean; sanitizedContact: string; type: 'phone' | 'url' | 'unknown'; error?: string } => {
    const trimmed = contact.trim();

    if (!trimmed) {
        return { isValid: true, sanitizedContact: '', type: 'unknown' };
    }

    // Check for maximum length
    if (trimmed.length > 500) {
        return { isValid: false, sanitizedContact: '', type: 'unknown', error: 'Contact is too long' };
    }

    // Check for dangerous protocols
    const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
    const lowerContact = trimmed.toLowerCase();
    for (const protocol of dangerousProtocols) {
        if (lowerContact.startsWith(protocol)) {
            return { isValid: false, sanitizedContact: '', type: 'unknown', error: 'Invalid contact format' };
        }
    }

    // Check if it's a phone number (Vietnamese format)
    const phoneRegex = /^(\+84|84|0)?[1-9]\d{8,9}$/;
    const cleanPhone = trimmed.replace(/[\s\-\.]/g, '');
    if (phoneRegex.test(cleanPhone)) {
        return { isValid: true, sanitizedContact: cleanPhone, type: 'phone' };
    }

    // Check if it's a URL
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        try {
            const urlObj = new URL(trimmed);
            if (['http:', 'https:'].includes(urlObj.protocol)) {
                return { isValid: true, sanitizedContact: urlObj.href, type: 'url' };
            }
        } catch {
            return { isValid: false, sanitizedContact: '', type: 'unknown', error: 'Invalid URL format' };
        }
    }

    // Try adding https:// for potential URLs
    if (trimmed.includes('.') && !trimmed.includes(' ')) {
        try {
            const urlObj = new URL(`https://${trimmed}`);
            return { isValid: true, sanitizedContact: urlObj.href, type: 'url' };
        } catch {
            // Not a valid URL
        }
    }

    // Accept as plain text (could be other contact info)
    return { isValid: true, sanitizedContact: trimmed, type: 'unknown' };
};

/**
 * Sanitize text input to prevent XSS
 */
export const sanitizeText = (text: string): string => {
    return text
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
};

// Request deduplication cache
const requestCache = new Map<string, { promise: Promise<unknown>; timestamp: number }>();
const CACHE_TTL = 5000; // 5 seconds

const getCachedRequest = <T>(key: string): Promise<T> | null => {
    const cached = requestCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.promise as Promise<T>;
    }
    requestCache.delete(key);
    return null;
};

const setCachedRequest = <T>(key: string, promise: Promise<T>): void => {
    requestCache.set(key, { promise, timestamp: Date.now() });
};

export const courseService = {
    /**
     * Get all courses with optional filters
     * Includes request deduplication
     */
    getAll: async (filters: CourseFilters = {}): Promise<PaginatedResponse<Course>> => {
        const cacheKey = `courses_${JSON.stringify(filters)}`;
        const cached = getCachedRequest<PaginatedResponse<Course>>(cacheKey);
        if (cached) return cached;

        const promise = (async () => {
            try {
                const response = await api.get<{ courses?: Course[]; items?: Course[]; total?: number }>('/courses', {
                    params: {
                        search: filters.search,
                        level: filters.level,
                        instructor: filters.instructor,
                        minPrice: filters.minPrice,
                        maxPrice: filters.maxPrice,
                        page: filters.page || 1,
                        limit: filters.limit || 10,
                        sortBy: filters.sortBy,
                        sortOrder: filters.sortOrder,
                    },
                });

                const courses = response.data.courses || response.data.items || [];
                const total = response.data.total || courses.length;
                const limit = filters.limit || 10;

                return {
                    items: courses,
                    total,
                    page: filters.page || 1,
                    limit,
                    totalPages: Math.ceil(total / limit),
                };
            } catch {
                return {
                    items: [],
                    total: 0,
                    page: 1,
                    limit: 10,
                    totalPages: 0,
                };
            }
        })();

        setCachedRequest(cacheKey, promise);
        return promise;
    },

    /**
     * Get single course by ID with caching
     */
    getById: async (id: string): Promise<Course> => {
        const cacheKey = `course_${id}`;
        const cached = getCachedRequest<Course>(cacheKey);
        if (cached) return cached;

        const promise = api.get<{ course: Course }>(`/courses/${id}`).then(res => res.data.course);
        setCachedRequest(cacheKey, promise);
        return promise;
    },

    /**
     * Create new course (requires admin role)
     * Includes input validation and sanitization
     */
    create: async (data: CreateCourseData): Promise<Course> => {
        // Validate contact if provided
        if (data.contact) {
            const contactValidation = validateAndSanitizeContact(data.contact);
            if (!contactValidation.isValid) {
                throw new Error(contactValidation.error || 'Invalid contact format');
            }
            data.contact = contactValidation.sanitizedContact;
        }

        const sanitizedData = {
            ...data,
            title: data.title.trim(),
            instructor: data.instructor.trim(),
            description: data.description?.trim(),
        };

        // Clear cache after mutation
        requestCache.clear();

        const response = await api.post<Course>('/courses', sanitizedData);
        return response.data;
    },

    /**
     * Update course (requires admin role)
     * Includes input validation and sanitization
     */
    update: async (id: string, data: UpdateCourseData): Promise<Course> => {
        // Validate contact if provided
        if (data.contact) {
            const contactValidation = validateAndSanitizeContact(data.contact);
            if (!contactValidation.isValid) {
                throw new Error(contactValidation.error || 'Invalid contact format');
            }
            data.contact = contactValidation.sanitizedContact;
        }

        const sanitizedData = {
            ...data,
            title: data.title?.trim(),
            instructor: data.instructor?.trim(),
            description: data.description?.trim(),
        };

        // Clear cache after mutation
        requestCache.clear();

        const response = await api.patch<Course>(`/courses/${id}`, sanitizedData);
        return response.data;
    },

    /**
     * Delete course
     */
    delete: async (id: string): Promise<void> => {
        // Clear cache after mutation
        requestCache.clear();
        await api.delete(`/courses/${id}`);
    },

    /**
     * Toggle course visibility (public/private)
     */
    toggleVisibility: async (id: string, isPublic: boolean): Promise<void> => {
        // Clear cache after mutation
        requestCache.clear();
        await api.patch(`/courses/${id}`, { isPublic });
    },

    /**
     * Get course enrollments
     */
    getEnrollments: async (
        id: string,
        page = 1,
        limit = 20
    ): Promise<PaginatedResponse<{ userId: string; userName: string; enrolledAt: string; progress: number }>> => {
        try {
            const response = await api.get<{ enrollments?: { userId: string; userName: string; enrolledAt: string; progress: number }[] }>(
                `/courses/${id}`,
                { params: { page, limit } }
            );
            const enrollments = response.data.enrollments || [];
            return {
                items: enrollments,
                total: enrollments.length,
                page,
                limit,
                totalPages: Math.ceil(enrollments.length / limit),
            };
        } catch {
            return { items: [], total: 0, page, limit, totalPages: 0 };
        }
    },

    /**
     * Get course statistics
     */
    getStats: async (): Promise<{
        totalCourses: number;
        totalEnrollments: number;
        averageRating: number;
        revenue: number;
    }> => {
        try {
            const response = await api.get<{ courses?: Course[] }>('/courses');
            const courses = response.data.courses || [];
            return {
                totalCourses: courses.length,
                totalEnrollments: 0,
                averageRating: 0,
                revenue: 0,
            };
        } catch {
            return {
                totalCourses: 0,
                totalEnrollments: 0,
                averageRating: 0,
                revenue: 0,
            };
        }
    },

    /**
     * Publish/unpublish course
     */
    togglePublish: async (id: string, published: boolean): Promise<Course> => {
        requestCache.clear();
        const response = await api.patch<Course>(`/courses/${id}`, { published });
        return response.data;
    },

    /**
     * Clear request cache manually
     */
    clearCache: (): void => {
        requestCache.clear();
    },
};

export default courseService;

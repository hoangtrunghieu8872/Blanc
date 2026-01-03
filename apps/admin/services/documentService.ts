/**
 * Document Service
 * API operations for document management
 * Includes security measures for link validation and sanitization
 * Includes request caching for optimization
 */

import api from './api';
import { Document } from '../types';

export interface DocumentFilters {
    search?: string;
    category?: 'Tutorial' | 'Reference' | 'Guide' | 'Research';
    author?: string;
    isPublic?: boolean;
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

export interface CreateDocumentData {
    title: string;
    author: string;
    category: 'Tutorial' | 'Reference' | 'Guide' | 'Research';
    link: string;
    description?: string;
    isPublic?: boolean;
}

export interface UpdateDocumentData extends Partial<CreateDocumentData> {
    isPublic?: boolean;
}

/**
 * Validate and sanitize URL for security
 * Prevents XSS and ensures valid URL format
 */
export const validateAndSanitizeUrl = (url: string): { isValid: boolean; sanitizedUrl: string; error?: string } => {
    // Trim whitespace
    const trimmedUrl = url.trim();

    // Check for empty URL
    if (!trimmedUrl) {
        return { isValid: false, sanitizedUrl: '', error: 'URL cannot be empty' };
    }

    // Check for maximum length (prevent DoS)
    if (trimmedUrl.length > 2048) {
        return { isValid: false, sanitizedUrl: '', error: 'URL is too long (max 2048 characters)' };
    }

    // Check for dangerous protocols
    const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
    const lowerUrl = trimmedUrl.toLowerCase();
    for (const protocol of dangerousProtocols) {
        if (lowerUrl.startsWith(protocol)) {
            return { isValid: false, sanitizedUrl: '', error: 'Invalid URL protocol' };
        }
    }

    // Validate URL format
    try {
        const urlObj = new URL(trimmedUrl);

        // Only allow http and https protocols
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
            return { isValid: false, sanitizedUrl: '', error: 'Only HTTP and HTTPS protocols are allowed' };
        }

        // Sanitize and return the URL
        return { isValid: true, sanitizedUrl: urlObj.href };
    } catch {
        // If URL parsing fails, check if it's a relative URL or needs protocol
        if (trimmedUrl.startsWith('/') || trimmedUrl.startsWith('./')) {
            return { isValid: true, sanitizedUrl: trimmedUrl };
        }

        // Try adding https:// prefix
        try {
            const urlWithProtocol = new URL(`https://${trimmedUrl}`);
            return { isValid: true, sanitizedUrl: urlWithProtocol.href };
        } catch {
            return { isValid: false, sanitizedUrl: '', error: 'Invalid URL format' };
        }
    }
};

/**
 * Sanitize text input to prevent XSS
 */
export const sanitizeText = (text: string): string => {
    return text
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
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

export const documentService = {
    /**
     * Get all documents with optional filters
     * Includes request deduplication
     */
    getAll: async (filters: DocumentFilters = {}): Promise<PaginatedResponse<Document>> => {
        const cacheKey = `documents_${JSON.stringify(filters)}`;
        const cached = getCachedRequest<PaginatedResponse<Document>>(cacheKey);
        if (cached) return cached;

        const promise = (async () => {
            try {
                const response = await api.get<{ documents?: Document[]; items?: Document[]; total?: number }>('/documents', {
                    params: {
                        search: filters.search,
                        category: filters.category,
                        author: filters.author,
                        isPublic: filters.isPublic,
                        page: filters.page || 1,
                        limit: filters.limit || 10,
                        sortBy: filters.sortBy,
                        sortOrder: filters.sortOrder,
                    },
                });

                const documents = response.data.documents || response.data.items || [];
                const total = response.data.total || documents.length;
                const limit = filters.limit || 10;

                return {
                    items: documents,
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
     * Get single document by ID with caching
     */
    getById: async (id: string): Promise<Document> => {
        const cacheKey = `document_${id}`;
        const cached = getCachedRequest<Document>(cacheKey);
        if (cached) return cached;

        const promise = api.get<Document>(`/documents/${id}`).then(res => res.data);
        setCachedRequest(cacheKey, promise);
        return promise;
    },

    /**
     * Create new document (requires admin role)
     * Includes URL validation and sanitization
     */
    create: async (data: CreateDocumentData): Promise<Document> => {
        // Validate and sanitize URL
        const urlValidation = validateAndSanitizeUrl(data.link);
        if (!urlValidation.isValid) {
            throw new Error(urlValidation.error || 'Invalid URL');
        }

        const sanitizedData = {
            ...data,
            title: data.title.trim(),
            author: data.author.trim(),
            link: urlValidation.sanitizedUrl,
            description: data.description?.trim(),
        };

        // Clear cache after mutation
        requestCache.clear();

        const response = await api.post<Document>('/documents', sanitizedData);
        return response.data;
    },

    /**
     * Update document (requires admin role)
     */
    update: async (id: string, data: UpdateDocumentData): Promise<Document> => {
        // Validate and sanitize URL if provided
        if (data.link) {
            const urlValidation = validateAndSanitizeUrl(data.link);
            if (!urlValidation.isValid) {
                throw new Error(urlValidation.error || 'Invalid URL');
            }
            data.link = urlValidation.sanitizedUrl;
        }

        const sanitizedData = {
            ...data,
            title: data.title?.trim(),
            author: data.author?.trim(),
            description: data.description?.trim(),
        };

        // Clear cache after mutation
        requestCache.clear();

        const response = await api.patch<Document>(`/documents/${id}`, sanitizedData);
        return response.data;
    },

    /**
     * Delete document
     */
    delete: async (id: string): Promise<void> => {
        // Clear cache after mutation
        requestCache.clear();
        await api.delete(`/documents/${id}`);
    },

    /**
     * Toggle document visibility
     */
    toggleVisibility: async (id: string, isPublic: boolean): Promise<Document> => {
        // Clear cache after mutation
        requestCache.clear();
        const response = await api.patch<Document>(`/documents/${id}`, { isPublic });
        return response.data;
    },

    /**
     * Get document statistics
     */
    getStats: async (): Promise<{
        totalDocuments: number;
        publicDocuments: number;
        privateDocuments: number;
        totalDownloads: number;
    }> => {
        try {
            const response = await api.get<{ documents?: Document[] }>('/documents');
            const documents = response.data.documents || [];
            return {
                totalDocuments: documents.length,
                publicDocuments: documents.filter(d => d.isPublic).length,
                privateDocuments: documents.filter(d => !d.isPublic).length,
                totalDownloads: documents.reduce((acc, d) => acc + d.downloads, 0),
            };
        } catch {
            return {
                totalDocuments: 0,
                publicDocuments: 0,
                privateDocuments: 0,
                totalDownloads: 0,
            };
        }
    },

    /**
     * Clear request cache manually
     */
    clearCache: (): void => {
        requestCache.clear();
    },
};

export default documentService;

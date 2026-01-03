/**
 * Custom hooks for API data fetching
 * Provides reusable hooks with loading, error states and caching
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { ApiError } from '../services/api';

interface UseApiState<T> {
    data: T | null;
    isLoading: boolean;
    error: string | null;
}

interface UseApiOptions {
    immediate?: boolean;
    onSuccess?: (data: unknown) => void;
    onError?: (error: string) => void;
}

/**
 * Generic hook for API calls with loading and error states
 */
export function useApi<T, P extends unknown[] = []>(
    apiFunction: (...args: P) => Promise<T>,
    options: UseApiOptions = {}
) {
    const { immediate = false, onSuccess, onError } = options;

    const [state, setState] = useState<UseApiState<T>>({
        data: null,
        isLoading: immediate,
        error: null,
    });

    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const execute = useCallback(async (...args: P): Promise<T | null> => {
        setState(prev => ({ ...prev, isLoading: true, error: null }));

        try {
            const result = await apiFunction(...args);

            if (mountedRef.current) {
                setState({ data: result, isLoading: false, error: null });
                onSuccess?.(result);
            }

            return result;
        } catch (error) {
            const message = error instanceof ApiError
                ? error.message
                : error instanceof Error
                    ? error.message
                    : 'An unexpected error occurred';

            if (mountedRef.current) {
                setState(prev => ({ ...prev, isLoading: false, error: message }));
                onError?.(message);
            }

            return null;
        }
    }, [apiFunction, onSuccess, onError]);

    const reset = useCallback(() => {
        setState({ data: null, isLoading: false, error: null });
    }, []);

    const setData = useCallback((data: T | null) => {
        setState(prev => ({ ...prev, data }));
    }, []);

    return {
        ...state,
        execute,
        reset,
        setData,
    };
}

/**
 * Hook for paginated API calls
 */
export function usePaginatedApi<T>(
    apiFunction: (page: number, limit: number, ...args: unknown[]) => Promise<{
        items: T[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>,
    initialLimit = 10
) {
    const [items, setItems] = useState<T[]>([]);
    const [pagination, setPagination] = useState({
        page: 1,
        limit: initialLimit,
        total: 0,
        totalPages: 0,
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const fetchPage = useCallback(async (page: number, ...args: unknown[]) => {
        setIsLoading(true);
        setError(null);

        try {
            const result = await apiFunction(page, pagination.limit, ...args);

            if (mountedRef.current) {
                setItems(result.items);
                setPagination({
                    page: result.page,
                    limit: result.limit,
                    total: result.total,
                    totalPages: result.totalPages,
                });
            }
        } catch (err) {
            if (mountedRef.current) {
                const message = err instanceof ApiError
                    ? err.message
                    : err instanceof Error
                        ? err.message
                        : 'Failed to fetch data';
                setError(message);
            }
        } finally {
            if (mountedRef.current) {
                setIsLoading(false);
            }
        }
    }, [apiFunction, pagination.limit]);

    const goToPage = useCallback((page: number, ...args: unknown[]) => {
        if (page >= 1 && page <= pagination.totalPages) {
            fetchPage(page, ...args);
        }
    }, [fetchPage, pagination.totalPages]);

    const nextPage = useCallback((...args: unknown[]) => {
        if (pagination.page < pagination.totalPages) {
            goToPage(pagination.page + 1, ...args);
        }
    }, [pagination.page, pagination.totalPages, goToPage]);

    const prevPage = useCallback((...args: unknown[]) => {
        if (pagination.page > 1) {
            goToPage(pagination.page - 1, ...args);
        }
    }, [pagination.page, goToPage]);

    const setLimit = useCallback((newLimit: number) => {
        setPagination(prev => ({ ...prev, limit: newLimit, page: 1 }));
    }, []);

    const refresh = useCallback((...args: unknown[]) => {
        fetchPage(pagination.page, ...args);
    }, [fetchPage, pagination.page]);

    return {
        items,
        pagination,
        isLoading,
        error,
        fetchPage,
        goToPage,
        nextPage,
        prevPage,
        setLimit,
        refresh,
        setItems,
    };
}

/**
 * Hook for mutations (create, update, delete)
 */
export function useMutation<T, P extends unknown[] = []>(
    mutationFn: (...args: P) => Promise<T>,
    options: {
        onSuccess?: (data: T) => void;
        onError?: (error: string) => void;
    } = {}
) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const mutate = useCallback(async (...args: P): Promise<T | null> => {
        setIsLoading(true);
        setError(null);

        try {
            const result = await mutationFn(...args);
            options.onSuccess?.(result);
            return result;
        } catch (err) {
            const message = err instanceof ApiError
                ? err.message
                : err instanceof Error
                    ? err.message
                    : 'Operation failed';
            setError(message);
            options.onError?.(message);
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [mutationFn, options]);

    return {
        mutate,
        isLoading,
        error,
        reset: () => setError(null),
    };
}

/**
 * Simple debounce hook for search inputs
 */
export function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

export default useApi;

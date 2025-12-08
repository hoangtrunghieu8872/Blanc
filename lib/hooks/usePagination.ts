import { useState, useEffect, useCallback } from 'react';

// ============ HOOK FOR PAGINATION ============
interface UsePaginationOptions {
    totalItems: number;
    itemsPerPage?: number;
    initialPage?: number;
}

interface UsePaginationReturn {
    currentPage: number;
    totalPages: number;
    startIndex: number;
    endIndex: number;
    setPage: (page: number) => void;
    nextPage: () => void;
    prevPage: () => void;
    paginatedItems: <T>(items: T[]) => T[];
}

export function usePagination({
    totalItems,
    itemsPerPage = 6,
    initialPage = 1
}: UsePaginationOptions): UsePaginationReturn {
    const [currentPage, setCurrentPage] = useState(initialPage);

    // Tính tổng số trang (làm tròn lên)
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    // Reset về trang 1 nếu current page > total pages
    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(1);
        }
    }, [currentPage, totalPages]);

    // Index bắt đầu và kết thúc
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

    const setPage = useCallback((page: number) => {
        const newPage = Math.max(1, Math.min(page, totalPages));
        setCurrentPage(newPage);
    }, [totalPages]);

    const nextPage = useCallback(() => setPage(currentPage + 1), [currentPage, setPage]);
    const prevPage = useCallback(() => setPage(currentPage - 1), [currentPage, setPage]);

    // Helper để lấy items cho trang hiện tại
    const paginatedItems = useCallback(<T,>(items: T[]): T[] => {
        return items.slice(startIndex, endIndex);
    }, [startIndex, endIndex]);

    return {
        currentPage,
        totalPages,
        startIndex,
        endIndex,
        setPage,
        nextPage,
        prevPage,
        paginatedItems
    };
}

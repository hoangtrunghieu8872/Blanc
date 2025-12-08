import React, { memo, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from './ui/Common';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    className?: string;
}

/**
 * Pagination Component - Google-style with modern design
 * 
 * Logic hiển thị số trang (giống Google):
 * - Luôn hiển thị trang đầu và trang cuối
 * - Hiển thị tối đa 7 số (bao gồm "...")
 * - Khi ở gần đầu: 1 2 3 4 5 ... 10
 * - Khi ở giữa: 1 ... 4 5 6 ... 10
 * - Khi ở gần cuối: 1 ... 6 7 8 9 10
 */
const Pagination: React.FC<PaginationProps> = memo(({
    currentPage,
    totalPages,
    onPageChange,
    className
}) => {
    // Không hiển thị nếu chỉ có 1 trang
    if (totalPages <= 1) return null;

    // Tính toán các số trang cần hiển thị
    const pageNumbers = useMemo(() => {
        const pages: (number | 'ellipsis')[] = [];

        // Nếu tổng số trang <= 7, hiển thị tất cả
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
            return pages;
        }

        // Logic phức tạp hơn cho nhiều trang
        const showLeftEllipsis = currentPage > 4;
        const showRightEllipsis = currentPage < totalPages - 3;

        // Luôn có trang 1
        pages.push(1);

        if (showLeftEllipsis) {
            pages.push('ellipsis');
        }

        // Tính range các số ở giữa
        let startPage: number;
        let endPage: number;

        if (!showLeftEllipsis && showRightEllipsis) {
            // Gần đầu: 1 2 3 4 5 ... n
            startPage = 2;
            endPage = 5;
        } else if (showLeftEllipsis && !showRightEllipsis) {
            // Gần cuối: 1 ... n-4 n-3 n-2 n-1 n
            startPage = totalPages - 4;
            endPage = totalPages - 1;
        } else {
            // Ở giữa: 1 ... x-1 x x+1 ... n
            startPage = currentPage - 1;
            endPage = currentPage + 1;
        }

        for (let i = startPage; i <= endPage; i++) {
            if (i > 1 && i < totalPages) {
                pages.push(i);
            }
        }

        if (showRightEllipsis) {
            pages.push('ellipsis');
        }

        // Luôn có trang cuối
        pages.push(totalPages);

        return pages;
    }, [currentPage, totalPages]);

    const handlePageClick = (page: number) => {
        if (page !== currentPage && page >= 1 && page <= totalPages) {
            onPageChange(page);
            // Scroll to top smoothly
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    return (
        <nav
            className={cn(
                'flex items-center justify-center gap-1 sm:gap-2 py-8',
                className
            )}
            aria-label="Pagination"
        >
            {/* Previous Button */}
            <button
                onClick={() => handlePageClick(currentPage - 1)}
                disabled={currentPage === 1}
                className={cn(
                    'flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200',
                    'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                    'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent'
                )}
                aria-label="Trang trước"
            >
                <ChevronLeft className="w-5 h-5" />
            </button>

            {/* Page Numbers */}
            <div className="flex items-center gap-1">
                {pageNumbers.map((page, index) => {
                    if (page === 'ellipsis') {
                        return (
                            <span
                                key={`ellipsis-${index}`}
                                className="w-10 h-10 flex items-center justify-center text-slate-400 select-none"
                            >
                                •••
                            </span>
                        );
                    }

                    const isActive = page === currentPage;

                    return (
                        <button
                            key={page}
                            onClick={() => handlePageClick(page)}
                            className={cn(
                                'min-w-[40px] h-10 px-3 rounded-full font-medium text-sm transition-all duration-200',
                                isActive
                                    ? 'bg-primary-600 text-white shadow-md shadow-primary-200 scale-105'
                                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                            )}
                            aria-label={`Trang ${page}`}
                            aria-current={isActive ? 'page' : undefined}
                        >
                            {page}
                        </button>
                    );
                })}
            </div>

            {/* Next Button */}
            <button
                onClick={() => handlePageClick(currentPage + 1)}
                disabled={currentPage === totalPages}
                className={cn(
                    'flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200',
                    'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                    'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent'
                )}
                aria-label="Trang sau"
            >
                <ChevronRight className="w-5 h-5" />
            </button>
        </nav>
    );
});

Pagination.displayName = 'Pagination';

// Re-export usePagination from hooks for backward compatibility
export { usePagination } from '../lib/hooks/usePagination';

export default Pagination;

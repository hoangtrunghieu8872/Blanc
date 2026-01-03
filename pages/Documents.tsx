import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, FileText, Search, X, Download } from 'lucide-react';
import { Badge, Button, Card, Dropdown, DropdownOption } from '../components/ui/Common';
import OptimizedImage from '../components/OptimizedImage';
import Pagination from '../components/Pagination';
import { useDebounce, useDocuments } from '../lib/hooks';
import { api } from '../lib/api';
import { Document, DocumentCategory } from '../types';
import { LIBRARY_FIELDS, LibraryFieldValue } from '../constants/libraryFields';

type DocumentSortValue = 'newest' | 'downloads' | 'titleAsc' | 'titleDesc';

const SORT_OPTIONS: DropdownOption[] = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'downloads', label: 'Tải nhiều nhất' },
  { value: 'titleAsc', label: 'Tên A → Z' },
  { value: 'titleDesc', label: 'Tên Z → A' },
];

const CATEGORY_PILLS: Array<{ value: '' | DocumentCategory; label: string }> = [
  { value: '', label: 'Tất cả' },
  { value: 'Tutorial', label: 'Tutorial' },
  { value: 'Reference', label: 'Reference' },
  { value: 'Guide', label: 'Guide' },
  { value: 'Research', label: 'Research' },
];

const ITEMS_PER_PAGE = 12;

const Documents: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<'' | DocumentCategory>('');
  const [activeField, setActiveField] = useState<LibraryFieldValue>('');
  const [showAllFields, setShowAllFields] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortValue, setSortValue] = useState<DocumentSortValue>('newest');
  const [currentPage, setCurrentPage] = useState(1);

  const debouncedSearch = useDebounce(searchQuery, 300);

  const sortParams = useMemo(() => {
    switch (sortValue) {
      case 'downloads':
        return { sortBy: 'downloads', sortOrder: 'desc' as const };
      case 'titleAsc':
        return { sortBy: 'title', sortOrder: 'asc' as const };
      case 'titleDesc':
        return { sortBy: 'title', sortOrder: 'desc' as const };
      case 'newest':
      default:
        return { sortBy: 'createdAt', sortOrder: 'desc' as const };
    }
  }, [sortValue]);

  const { documents, meta, isLoading, error, refetch } = useDocuments({
    limit: ITEMS_PER_PAGE,
    page: currentPage,
    category: activeCategory || undefined,
    field: activeField || undefined,
    search: debouncedSearch || undefined,
    isPublic: true,
    sortBy: sortParams.sortBy,
    sortOrder: sortParams.sortOrder,
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [activeCategory, activeField, debouncedSearch, sortValue]);

  const handleOpenDocument = (doc: Document) => {
    if (!doc?.link) return;
    window.open(doc.link, '_blank', 'noopener,noreferrer');
    api.post(`/documents/${doc.id}/download`).catch(() => undefined);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Intro hero section */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-sky-100/60 mb-10">
        <div className="absolute inset-0 bg-linear-to-br from-sky-50 via-white to-emerald-50 opacity-90" aria-hidden="true" />
        <div className="absolute -top-24 right-8 h-48 w-48 rounded-full bg-sky-200/40 blur-3xl" aria-hidden="true" />
        <div className="absolute -bottom-28 left-6 h-56 w-56 rounded-full bg-emerald-200/40 blur-3xl" aria-hidden="true" />
        <div className="relative p-6 md:p-8 lg:p-10">
          <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-8 items-center">
            <div className="space-y-4 animate-fade-in-up">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/80 border border-white/70 text-xs font-semibold text-sky-700 shadow-sm">
                <FileText className="w-3.5 h-3.5" />
                Thư viện tài liệu
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight">
                Tài liệu chọn lọc, học nhanh và hiệu quả
              </h2>
              <p className="text-sm md:text-base text-slate-600 leading-relaxed max-w-xl md:max-w-none">
                Tổng hợp hướng dẫn, tham khảo và nghiên cứu theo lĩnh vực. Tìm kiếm và mở tài liệu chỉ với một lần nhấn.
              </p>
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2 rounded-xl bg-white/90 border border-slate-100 px-3 py-2 text-xs text-slate-600 shadow-sm">
                  <Search className="w-4 h-4 text-sky-500" />
                  Tìm theo từ khóa
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-white/90 border border-slate-100 px-3 py-2 text-xs text-slate-600 shadow-sm">
                  Danh mục đa dạng
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-white/90 border border-slate-100 px-3 py-2 text-xs text-slate-600 shadow-sm">
                  Lọc theo lĩnh vực
                </div>
              </div>
            </div>

            {(() => {
              const fieldCount = LIBRARY_FIELDS.length;
              const visibleCount = documents.length;
              const pageCount = meta.totalPages;
              const resultLabel = debouncedSearch || activeCategory || activeField ? 'Kết quả phù hợp' : 'Tổng tài liệu';
              return (
                <div className="space-y-4 animate-fade-in-up">
                  <div className="rounded-2xl border border-white/80 bg-white/80 p-5 shadow-md">
                    <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">{resultLabel}</div>
                    <div className="mt-3 flex items-end gap-2">
                      <span className="text-3xl font-bold text-slate-900">{isLoading ? '--' : meta.total}</span>
                      <span className="text-sm text-slate-500">tài liệu</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">Cập nhật liên tục, ưu tiên tài liệu mới.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-3">
                    <div className="rounded-xl border border-sky-100 bg-sky-50/80 px-4 py-3">
                      <div className="text-xs font-semibold text-sky-700">Đang hiển thị</div>
                      <div className="mt-1 text-2xl font-bold text-sky-800">{isLoading ? '--' : visibleCount}</div>
                    </div>
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/80 px-4 py-3">
                      <div className="text-xs font-semibold text-emerald-700">Lĩnh vực</div>
                      <div className="mt-1 text-2xl font-bold text-emerald-800">{fieldCount}</div>
                    </div>
                    <div className="rounded-xl border border-amber-100 bg-amber-50/80 px-4 py-3">
                      <div className="text-xs font-semibold text-amber-700">Trang</div>
                      <div className="mt-1 text-2xl font-bold text-amber-800">{isLoading ? '--' : pageCount}</div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </section>

      {/* Search */}
      <div className="max-w-md mx-auto mb-8">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Tìm tài liệu, tác giả..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-12 pl-12 pr-10 rounded-full border border-slate-200 shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              title="Xóa tìm kiếm"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <p className="text-sm text-slate-500 text-center mb-3">Loại tài liệu</p>
      {/* Category pills */}
      <div className="flex flex-wrap justify-center gap-2 mb-8">
        {CATEGORY_PILLS.map((cat) => (
          <button
            key={cat.value || 'all'}
            onClick={() => setActiveCategory(cat.value)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${activeCategory === cat.value
              ? 'bg-primary-600 text-white shadow-md shadow-primary-100'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <p className="text-sm text-slate-500 text-center mb-3">Lĩnh vực</p>
      {/* Field pills */}
      <div className="flex flex-wrap justify-center gap-2 mb-3">
        {(showAllFields ? LIBRARY_FIELDS : LIBRARY_FIELDS.slice(0, 6)).map((field) => (
          <button
            key={field.value || 'all-field'}
            onClick={() => setActiveField(field.value)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${activeField === field.value
              ? 'bg-slate-900 text-white shadow-md'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
          >
            {field.label}
          </button>
        ))}
      </div>
      {LIBRARY_FIELDS.length > 6 && (
        <div className="flex justify-center mb-8">
          <button
            type="button"
            onClick={() => setShowAllFields((prev) => !prev)}
            className="text-sm font-medium text-primary-700 hover:text-primary-800"
          >
            {showAllFields ? 'Thu gọn' : 'Xem thêm'}
          </button>
        </div>
      )}

      {/* Results + sort */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <p className="text-sm text-slate-500 text-center sm:text-left">
          {isLoading ? 'Đang tải...' : `${meta.total} tài liệu`}
        </p>
        <div className="w-full sm:w-72">
          <Dropdown
            label="Sắp xếp"
            headerText="Sắp xếp"
            value={sortValue}
            onChange={(value) => setSortValue(value as DocumentSortValue)}
            options={SORT_OPTIONS}
          />
        </div>
      </div>

      {/* Documents grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {isLoading ? (
          [...Array(8)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="aspect-4/3 bg-slate-200" />
              <div className="p-4 space-y-3">
                <div className="h-5 w-3/4 bg-slate-200 rounded" />
                <div className="h-3 w-1/2 bg-slate-100 rounded" />
                <div className="h-4 w-24 bg-slate-100 rounded" />
                <div className="h-10 w-full bg-slate-100 rounded" />
              </div>
            </Card>
          ))
        ) : error ? (
          <div className="col-span-full text-center py-12">
            <p className="text-red-500 mb-4">{error}</p>
            <Button onClick={refetch}>Thử lại</Button>
          </div>
        ) : documents.length > 0 ? (
          <>
            {documents.map((doc) => (
              <Card
                key={doc.id}
                className="group hover:-translate-y-1 transition-transform overflow-hidden"
              >
                <div className="aspect-4/3 overflow-hidden bg-slate-50 relative flex items-center justify-center">
                  {doc.thumbnail ? (
                    <OptimizedImage
                      src={doc.thumbnail}
                      alt={doc.title}
                      className="w-full h-full"
                      lazy={true}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-slate-50 to-slate-100">
                      <FileText className="w-12 h-12 text-slate-300" />
                    </div>
                  )}
                  <div className="absolute top-3 left-3">
                    <Badge className="bg-white/90 text-slate-700 border border-slate-200">
                      {doc.category}
                    </Badge>
                  </div>
                </div>

                <div className="p-4">
                  <h3 className="font-bold text-slate-900 line-clamp-2 mb-2">{doc.title}</h3>
                  <div className="text-xs text-slate-500 mb-3">{doc.author}</div>
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-4">
                    <span className="inline-flex items-center gap-1">
                      <Download className="w-4 h-4" />
                      {doc.downloads || 0}
                    </span>
                    <span className="text-slate-400">{doc.createdAt ? new Date(doc.createdAt).toLocaleDateString('vi-VN') : ''}</span>
                  </div>

                  <Button
                    variant="secondary"
                    className="w-full justify-center"
                    onClick={() => handleOpenDocument(doc)}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Mở tài liệu
                  </Button>
                </div>
              </Card>
            ))}

            <div className="col-span-full">
              <Pagination currentPage={currentPage} totalPages={meta.totalPages} onPageChange={setCurrentPage} />
            </div>
          </>
        ) : (
          <div className="col-span-full text-center py-12">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-100 mb-4">
              <FileText className="w-7 h-7 text-slate-400" />
            </div>
            <p className="text-slate-600 font-medium mb-2">Không tìm thấy tài liệu phù hợp</p>
            <p className="text-sm text-slate-500 mb-4">Hãy thử từ khóa khác hoặc đổi danh mục.</p>
            <Button variant="secondary" onClick={() => { setSearchQuery(''); setActiveCategory(''); setActiveField(''); setCurrentPage(1); setShowAllFields(false); }}>
              Xóa bộ lọc
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Documents;

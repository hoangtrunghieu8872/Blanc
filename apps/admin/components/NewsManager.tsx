import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  Eye,
  X,
  Loader2,
  Tag,
  Calendar,
  CheckCircle2,
  FileText,
  Pin,
} from 'lucide-react';
import { NewsArticle, NewsType } from '../types';
import { newsService } from '../services/newsService';
import { useDebounce } from '../hooks/useApi';
import { Dropdown } from './ui/Dropdown';

const NEWS_TYPE_OPTIONS: Array<{ value: NewsType; label: string; color: string }> = [
  { value: 'announcement', label: 'Announcement', color: 'bg-indigo-500' },
  { value: 'minigame', label: 'Mini game', color: 'bg-amber-500' },
  { value: 'update', label: 'Update', color: 'bg-emerald-500' },
  { value: 'event', label: 'Event', color: 'bg-sky-500' },
  { value: 'tip', label: 'Study tip', color: 'bg-teal-500' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All', color: 'bg-gray-400' },
  { value: 'draft', label: 'Draft', color: 'bg-slate-500' },
  { value: 'published', label: 'Published', color: 'bg-emerald-600' },
];

const NEWS_TYPE_LABELS = NEWS_TYPE_OPTIONS.reduce<Record<NewsType, string>>((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {
  announcement: 'Announcement',
  minigame: 'Mini game',
  update: 'Update',
  event: 'Event',
  tip: 'Study tip',
});

const getTypeLabel = (value?: NewsType) => NEWS_TYPE_LABELS[value || 'announcement'] || 'Announcement';

const toDatetimeLocal = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const safeArray = <T,>(value: unknown, fallback: T[] = []): T[] => (Array.isArray(value) ? (value as T[]) : fallback);

const NewsManager: React.FC = () => {
  const [items, setItems] = useState<NewsArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'published'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | NewsType>('all');

  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, totalPages: 1 });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<NewsArticle | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    title: '',
    summary: '',
    body: '',
    tags: '',
    coverImage: '',
    type: 'announcement' as NewsType,
    highlight: false,
    actionLabel: '',
    actionLink: '',
    status: 'draft' as 'draft' | 'published',
    publishAt: '',
  });

  const filteredItems = useMemo(() => {
    if (typeFilter === 'all') return items;
    return items.filter((i) => (i.type || 'announcement') === typeFilter);
  }, [items, typeFilter]);

  const fetchNews = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await newsService.listAdmin({
        page: pagination.page,
        limit: pagination.limit,
        search: debouncedSearch || undefined,
        status: statusFilter,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      });
      setItems(res.items || []);
      setPagination((prev) => ({
        ...prev,
        page: res.page,
        limit: res.limit,
        total: res.total,
        totalPages: res.totalPages,
      }));
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load news';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, pagination.limit, pagination.page, statusFilter]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  const openCreate = () => {
    setActiveItem(null);
    setForm({
      title: '',
      summary: '',
      body: '',
      tags: '',
      coverImage: '',
      type: 'announcement',
      highlight: false,
      actionLabel: '',
      actionLink: '',
      status: 'draft',
      publishAt: '',
    });
    setIsModalOpen(true);
  };

  const openEdit = async (item: NewsArticle) => {
    setIsSaving(true);
    setError(null);
    try {
      const full = await newsService.getAdmin(item.id || item.slug);
      setActiveItem(full);
      setForm({
        title: full.title || '',
        summary: full.summary || '',
        body: full.body || '',
        tags: safeArray<string>(full.tags).join(', '),
        coverImage: full.coverImage || '',
        type: (full.type || 'announcement') as NewsType,
        highlight: !!full.highlight,
        actionLabel: full.actionLabel || '',
        actionLink: full.actionLink && full.actionLink.startsWith('#') ? '' : (full.actionLink || ''),
        status: full.status || 'draft',
        publishAt: toDatetimeLocal(full.publishAt),
      });
      setIsModalOpen(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load item';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const openView = async (item: NewsArticle) => {
    setIsSaving(true);
    setError(null);
    try {
      const full = await newsService.getAdmin(item.id || item.slug);
      setActiveItem(full);
      setIsViewOpen(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load item';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (item: NewsArticle) => {
    const id = item.id || item.slug;
    if (!id) return;
    if (!window.confirm(`Delete news "${item.title}"?`)) return;
    setIsSaving(true);
    setError(null);
    try {
      await newsService.remove(id);
      await fetchNews();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Delete failed';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (item: NewsArticle) => {
    const id = item.id || item.slug;
    if (!id) return;
    const next = item.status === 'published' ? 'draft' : 'published';
    setIsSaving(true);
    setError(null);
    try {
      await newsService.setStatus(id, next);
      await fetchNews();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Update status failed';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      const payload = {
        title: form.title,
        summary: form.summary,
        body: form.body,
        tags: form.tags,
        coverImage: form.coverImage,
        type: form.type,
        highlight: form.highlight,
        actionLabel: form.actionLabel,
        actionLink: form.actionLink,
        status: form.status,
        publishAt: form.publishAt ? new Date(form.publishAt).toISOString() : undefined,
      };

      if (activeItem?.id || activeItem?.slug) {
        await newsService.update(activeItem.id || activeItem.slug, payload);
      } else {
        await newsService.create(payload as any);
      }

      setIsModalOpen(false);
      setActiveItem(null);
      await fetchNews();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Save failed';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const Modal = useMemo(() => {
    if (!isModalOpen) return null;
    return createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
        <div
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={() => !isSaving && setIsModalOpen(false)}
          aria-hidden="true"
        />
        <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="text-emerald-600" size={18} />
              <h3 className="text-lg font-semibold text-gray-900">{activeItem ? 'Edit News' : 'Create News'}</h3>
            </div>
            <button
              type="button"
              onClick={() => !isSaving && setIsModalOpen(false)}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-50 rounded-lg"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Title *</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  placeholder="News title"
                  required
                  disabled={isSaving}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Summary</label>
                <textarea
                  value={form.summary}
                  onChange={(e) => setForm((p) => ({ ...p, summary: e.target.value }))}
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
                  placeholder="Short summary"
                  disabled={isSaving}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Body *</label>
                <textarea
                  value={form.body}
                  onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
                  rows={8}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  placeholder="Full content (plain text)"
                  required
                  disabled={isSaving}
                />
              </div>

              <div>
                <Dropdown
                  label="Type"
                  value={form.type}
                  onChange={(v) => setForm((p) => ({ ...p, type: v as NewsType }))}
                  options={NEWS_TYPE_OPTIONS}
                  headerText="News type"
                />
              </div>

              <div>
                <Dropdown
                  label="Status"
                  value={form.status}
                  onChange={(v) => setForm((p) => ({ ...p, status: v as 'draft' | 'published' }))}
                  options={[
                    { value: 'draft', label: 'Draft', color: 'bg-slate-500' },
                    { value: 'published', label: 'Published', color: 'bg-emerald-600' },
                  ]}
                />
              </div>

              <div className="md:col-span-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Publish at</label>
                    <div className="relative">
                      <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="datetime-local"
                        value={form.publishAt}
                        onChange={(e) => setForm((p) => ({ ...p, publishAt: e.target.value }))}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                        disabled={isSaving}
                      />
                    </div>
                  </div>

                  <div>
                    <p className="block text-sm font-medium text-gray-700 mb-1.5">Highlight</p>
                    <label className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-white hover:border-gray-300 transition-colors cursor-pointer">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${form.highlight ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
                            }`}
                          aria-hidden="true"
                        >
                          <Pin size={16} />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {form.highlight ? 'Pinned to highlights' : 'Pin to highlights'}
                          </p>
                          <p className="text-xs text-gray-500 truncate">Show in highlighted section</p>
                        </div>
                      </div>

                      <span
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.highlight ? 'bg-emerald-600' : 'bg-gray-300'
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={form.highlight}
                          onChange={(e) => setForm((p) => ({ ...p, highlight: e.target.checked }))}
                          className="sr-only"
                          disabled={isSaving}
                        />
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${form.highlight ? 'translate-x-5' : 'translate-x-1'
                            }`}
                        />
                      </span>
                    </label>
                  </div>
                </div>

                <p className="text-xs text-gray-500 mt-1">Leave empty to publish immediately (when published)</p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Tags</label>
                <div className="relative">
                  <Tag size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={form.tags}
                    onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    placeholder="tag1, tag2, tag3"
                    disabled={isSaving}
                  />
                </div>
              </div>

              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Cover image URL</label>
                  <input
                    value={form.coverImage}
                    onChange={(e) => setForm((p) => ({ ...p, coverImage: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    placeholder="https://..."
                    disabled={isSaving}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Action label</label>
                  <input
                    value={form.actionLabel}
                    onChange={(e) => setForm((p) => ({ ...p, actionLabel: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    placeholder="e.g. Learn more"
                    disabled={isSaving}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Action link (URL or /path)</label>
                  <input
                    value={form.actionLink}
                    onChange={(e) => setForm((p) => ({ ...p, actionLink: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    placeholder="/community or https://..."
                    disabled={isSaving}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                Save
              </button>
            </div>
          </form>
        </div>
      </div>,
      document.body
    );
  }, [activeItem, form, handleSave, isModalOpen, isSaving]);

  const ViewModal = useMemo(() => {
    if (!isViewOpen || !activeItem) return null;
    return createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
        <div
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={() => !isSaving && setIsViewOpen(false)}
          aria-hidden="true"
        />
        <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="text-emerald-600" size={18} />
              <h3 className="text-lg font-semibold text-gray-900">Preview</h3>
            </div>
            <button
              type="button"
              onClick={() => !isSaving && setIsViewOpen(false)}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-50 rounded-lg"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
          <div className="p-6 space-y-3 max-h-[70vh] overflow-y-auto">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${activeItem.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                {activeItem.status}
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                {getTypeLabel(activeItem.type || 'announcement')}
              </span>
              {activeItem.highlight && (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                  highlighted
                </span>
              )}
            </div>
            <h2 className="text-2xl font-bold text-gray-900">{activeItem.title}</h2>
            {activeItem.summary && <p className="text-gray-600">{activeItem.summary}</p>}
            {activeItem.body && (
              <pre className="whitespace-pre-wrap text-sm text-gray-800 bg-gray-50 border border-gray-100 rounded-xl p-4">
                {activeItem.body}
              </pre>
            )}
          </div>
        </div>
      </div>,
      document.body
    );
  }, [activeItem, isSaving, isViewOpen]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">News & Tips</h2>
          <p className="text-gray-500 mt-1">Manage announcements, updates, events, and study tips shown to users</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchNews}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gray-50 text-gray-700 hover:bg-gray-100"
            disabled={isLoading}
            title="Refresh"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <Plus size={18} />
            Create
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-end gap-3">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Search</label>
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              placeholder="Search by title or summary..."
            />
          </div>
        </div>

        <div className="w-full lg:w-56">
          <Dropdown
            label="Status"
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v as any);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            options={STATUS_OPTIONS}
          />
        </div>

        <div className="w-full lg:w-56">
          <Dropdown
            label="Type"
            value={typeFilter}
            onChange={(v) => setTypeFilter(v as any)}
            options={[{ value: 'all', label: 'All', color: 'bg-gray-400' }, ...NEWS_TYPE_OPTIONS]}
          />
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-800 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 border-b border-gray-100 text-gray-900 uppercase font-semibold text-xs">
              <tr>
                <th className="px-6 py-4">Title</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Publish At</th>
                <th className="px-6 py-4">Tags</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 size={18} className="animate-spin" />
                      Loading...
                    </div>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                    No news or tips found.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 line-clamp-1">{item.title}</span>
                        {item.highlight && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">
                            pin
                          </span>
                        )}
                      </div>
                      {item.summary && <p className="text-xs text-gray-500 line-clamp-1 mt-1">{item.summary}</p>}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                        {getTypeLabel(item.type || 'announcement')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${item.status === 'published'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-700'
                        }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500">
                      {item.publishAt ? new Date(item.publishAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {safeArray<string>(item.tags).slice(0, 3).map((t) => (
                          <span key={t} className="px-2 py-0.5 rounded-full text-[11px] bg-gray-100 text-gray-700">
                            {t}
                          </span>
                        ))}
                        {safeArray<string>(item.tags).length > 3 && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] bg-gray-100 text-gray-700">
                            +{safeArray<string>(item.tags).length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openView(item)}
                          className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                          title="Preview"
                          disabled={isSaving}
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => openEdit(item)}
                          className="p-2 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg"
                          title="Edit"
                          disabled={isSaving}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(item)}
                          className="px-3 py-2 rounded-lg text-xs font-semibold bg-gray-50 text-gray-700 hover:bg-gray-100"
                          disabled={isSaving}
                          title="Toggle status"
                        >
                          {item.status === 'published' ? 'Unpublish' : 'Publish'}
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          title="Delete"
                          disabled={isSaving}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-6 py-4 text-sm text-gray-600 border-t border-gray-100">
          <span>
            {pagination.total > 0 ? `Showing ${(pagination.page - 1) * pagination.limit + 1}-${Math.min(pagination.page * pagination.limit, pagination.total)} of ${pagination.total}` : '—'}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPagination((p) => ({ ...p, page: Math.max(1, p.page - 1) }))}
              disabled={pagination.page <= 1 || isLoading}
              className="px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:text-gray-300 disabled:hover:bg-transparent"
            >
              Prev
            </button>
            <span className="text-sm text-gray-500">
              Page {pagination.page} / {pagination.totalPages}
            </span>
            <button
              onClick={() => setPagination((p) => ({ ...p, page: Math.min(p.totalPages, p.page + 1) }))}
              disabled={pagination.page >= pagination.totalPages || isLoading}
              className="px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:text-gray-300 disabled:hover:bg-transparent"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {Modal}
      {ViewModal}
    </div>
  );
};

export default NewsManager;

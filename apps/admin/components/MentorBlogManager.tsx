import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, Edit2, ExternalLink, Loader2, RefreshCw, Search, X } from 'lucide-react';
import { MentorBlogDetail, MentorBlogSummary } from '../types';
import { mentorBlogService } from '../services/mentorBlogService';
import { useDebounce } from '../hooks/useApi';
import { Dropdown } from './ui/Dropdown';
import { getAvatarUrl, avatarPresets } from '../utils/avatar';
import { buildPublicMentorUrl } from '../utils/publicSite';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All', color: 'bg-gray-400' },
  { value: 'completed', label: 'Completed', color: 'bg-emerald-500' },
  { value: 'incomplete', label: 'Incomplete', color: 'bg-amber-500' },
];

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('vi-VN');
};

const MentorBlogManager: React.FC = () => {
  const [items, setItems] = useState<MentorBlogSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'incomplete'>('all');
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, totalPages: 1 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeMentor, setActiveMentor] = useState<MentorBlogDetail | null>(null);
  const [form, setForm] = useState({ bannerUrl: '', body: '' });
  const [isSaving, setIsSaving] = useState(false);

  const fetchMentors = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await mentorBlogService.listAdmin({
        page: pagination.page,
        limit: pagination.limit,
        search: debouncedSearch || undefined,
        completed: statusFilter,
      });
      setItems(res.items || []);
      setPagination((prev) => ({
        ...prev,
        page: res.page,
        limit: res.limit,
        total: res.total,
        totalPages: res.totalPages,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load mentor blogs');
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, pagination.limit, pagination.page, statusFilter]);

  useEffect(() => {
    fetchMentors();
  }, [fetchMentors]);

  const openEdit = async (item: MentorBlogSummary) => {
    setIsSaving(true);
    setError(null);
    try {
      const full = await mentorBlogService.getAdmin(item.id);
      setActiveMentor(full);
      setForm({
        bannerUrl: full.mentorBlog?.bannerUrl || '',
        body: full.mentorBlog?.body || '',
      });
      setIsModalOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load mentor');
    } finally {
      setIsSaving(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setActiveMentor(null);
    setForm({ bannerUrl: '', body: '' });
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeMentor) return;
    setIsSaving(true);
    setError(null);
    try {
      const updated = await mentorBlogService.update(activeMentor.id, form);
      setActiveMentor(updated);
      closeModal();
      fetchMentors();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update mentor blog');
    } finally {
      setIsSaving(false);
    }
  };

  const modal = isModalOpen && activeMentor
    ? createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Edit mentor blog</h3>
              <p className="text-xs text-gray-500">{activeMentor.name}</p>
            </div>
            <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Banner URL</label>
              <input
                type="text"
                value={form.bannerUrl}
                onChange={(e) => setForm((prev) => ({ ...prev, bannerUrl: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="https://..."
              />
              {form.bannerUrl && (
                <div className="mt-3 rounded-xl overflow-hidden border border-gray-200">
                  <img src={form.bannerUrl} alt="Banner preview" className="w-full h-40 object-cover" />
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Blog body</label>
              <textarea
                value={form.body}
                onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
                rows={8}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Mentor introduction..."
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>,
      document.body
    )
    : null;

  const showingText = useMemo(() => {
    if (!pagination.total) return '-';
    const start = (pagination.page - 1) * pagination.limit + 1;
    const end = Math.min(pagination.page * pagination.limit, pagination.total);
    return `Showing ${start}-${end} of ${pagination.total}`;
  }, [pagination.limit, pagination.page, pagination.total]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mentor Blogs</h1>
          <p className="text-sm text-gray-500">Manage mentor blog content and completion status.</p>
        </div>
        <button
          onClick={fetchMentors}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="relative w-full lg:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="Search mentor..."
          />
        </div>
        <div className="w-full lg:w-56">
          <Dropdown
            label="Completion"
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v as 'all' | 'completed' | 'incomplete');
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            options={STATUS_OPTIONS}
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
                <th className="px-6 py-4">Mentor</th>
                <th className="px-6 py-4">Joined</th>
                <th className="px-6 py-4">Blog Status</th>
                <th className="px-6 py-4">Updated</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 size={18} className="animate-spin" />
                      Loading...
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                    No mentors found.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const avatarUrl = getAvatarUrl(item.avatar, item.name, avatarPresets.table);
                  const updatedAt = item.mentorBlog?.updatedAt || item.mentorBlog?.createdAt || item.joinedAt;
                  return (
                    <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img src={avatarUrl} alt={item.name} className="w-8 h-8 rounded-full object-cover" />
                          <div>
                            <p className="font-medium text-gray-900">{item.name}</p>
                            <p className="text-xs text-gray-500">{item.email || '-'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500">
                        <div className="flex items-center gap-2">
                          <Calendar size={14} />
                          {formatDate(item.joinedAt)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${item.mentorBlogCompleted
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                          }`}>
                          {item.mentorBlogCompleted ? 'Completed' : 'Incomplete'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500">
                        {formatDate(updatedAt)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <a
                            href={buildPublicMentorUrl(item.id)}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 text-gray-500 hover:text-sky-600 hover:bg-sky-50 rounded-lg"
                            title="View public profile"
                          >
                            <ExternalLink size={16} />
                          </a>
                          <button
                            onClick={() => openEdit(item)}
                            className="p-2 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg"
                            title="Edit"
                            disabled={isSaving}
                          >
                            <Edit2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-6 py-4 text-sm text-gray-600 border-t border-gray-100">
          <span>{showingText}</span>
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

      {modal}
    </div>
  );
};

export default MentorBlogManager;

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, Loader2, Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { RecruitmentPost } from '../types';
import { recruitmentService } from '../services/recruitmentService';
import { useDebounce } from '../hooks/useApi';
import { Dropdown } from './ui/Dropdown';
import { Modal } from './ui/Modal';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All', color: 'bg-gray-400' },
  { value: 'draft', label: 'Draft', color: 'bg-slate-500' },
  { value: 'published', label: 'Published', color: 'bg-emerald-600' },
];

type EditorMode = 'create' | 'edit' | 'view';

type RoleDraft = {
  role: string;
  description: string;
  skills: string;
};

type ContactDraft = {
  name: string;
  email: string;
  phone: string;
  link: string;
  discord: string;
  note: string;
};

type FormState = {
  title: string;
  summary: string;
  body: string;
  tags: string;
  coverImage: string;
  status: 'draft' | 'published';
  publishAt: string;
  authorName: string;
  roles: RoleDraft[];
  contact: ContactDraft;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
};

const toDatetimeLocal = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const parseCsv = (value: string, maxItems = 10) => {
  const parts = value
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  return parts.slice(0, maxItems);
};

const initialFormState = (): FormState => ({
  title: '',
  summary: '',
  body: '',
  tags: '',
  coverImage: '',
  status: 'draft',
  publishAt: '',
  authorName: '',
  roles: [],
  contact: { name: '', email: '', phone: '', link: '', discord: '', note: '' },
});

const RecruitmentManager: React.FC = () => {
  const [items, setItems] = useState<RecruitmentPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'published'>('all');
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, totalPages: 1 });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mode, setMode] = useState<EditorMode>('view');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [activePost, setActivePost] = useState<RecruitmentPost | null>(null);
  const [form, setForm] = useState<FormState>(() => initialFormState());
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fetchPosts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await recruitmentService.listAdmin({
        page: pagination.page,
        limit: pagination.limit,
        search: debouncedSearch || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
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
      const message = e instanceof Error ? e.message : 'Failed to load recruitment posts';
      setError(message);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, pagination.limit, pagination.page, statusFilter]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const openModal = async (nextMode: EditorMode, item?: RecruitmentPost) => {
    setIsModalOpen(true);
    setMode(nextMode);
    setError(null);
    setIsDetailLoading(false);

    if (nextMode === 'create') {
      setActiveId(null);
      setActiveSlug(null);
      setActivePost(null);
      setForm(initialFormState());
      return;
    }

    const idOrSlug = item?.id || item?.slug;
    if (!idOrSlug) return;
    setActiveId(item?.id || null);
    setActiveSlug(item?.slug || null);
    setIsDetailLoading(true);
    try {
      const detail = await recruitmentService.getAdmin(idOrSlug);
      setActivePost(detail);
      setForm({
        title: detail.title || '',
        summary: detail.summary || '',
        body: detail.body || '',
        tags: (detail.tags || []).join(', '),
        coverImage: detail.coverImage || '',
        status: detail.status || 'draft',
        publishAt: toDatetimeLocal(detail.publishAt),
        authorName: detail.author?.name || '',
        roles: (detail.roles || []).map((r) => ({
          role: r.role || '',
          description: r.description || '',
          skills: (r.skills || []).join(', '),
        })),
        contact: {
          name: detail.contact?.name || '',
          email: detail.contact?.email || '',
          phone: detail.contact?.phone || '',
          link: detail.contact?.link || '',
          discord: detail.contact?.discord || '',
          note: detail.contact?.note || '',
        },
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load post';
      setError(message);
      setActivePost(null);
    } finally {
      setIsDetailLoading(false);
    }
  };

  const closeModal = (force = false) => {
    if (isSaving && !force) return;
    setIsModalOpen(false);
    setMode('view');
    setActiveId(null);
    setActiveSlug(null);
    setActivePost(null);
    setForm(initialFormState());
    setIsDetailLoading(false);
  };

  const handleDelete = async (item: RecruitmentPost) => {
    if (!window.confirm(`Delete recruitment post "${item.title}"?`)) return;
    setIsSaving(true);
    setError(null);
    try {
      await recruitmentService.remove(item.id);
      await fetchPosts();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Delete failed';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (mode === 'view') return;
    setIsSaving(true);
    setError(null);

    try {
      const publishAt = form.publishAt ? new Date(form.publishAt).toISOString() : null;
      const contact = Object.fromEntries(
        Object.entries(form.contact).filter(([, value]) => Boolean(String(value || '').trim()))
      );
      const roles = form.roles
        .map((r) => ({
          role: r.role.trim(),
          description: r.description.trim() || undefined,
          skills: parseCsv(r.skills, 8),
        }))
        .filter((r) => r.role);

      const payload = {
        title: form.title.trim(),
        summary: form.summary.trim(),
        body: form.body.trim(),
        tags: parseCsv(form.tags, 10),
        coverImage: form.coverImage.trim() || undefined,
        roles,
        contact,
        status: form.status,
        publishAt,
        authorName: form.authorName.trim() || undefined,
      };

      if (!payload.title) {
        throw new Error('Title is required');
      }
      if (!payload.body) {
        throw new Error('Body is required');
      }

      if (mode === 'create') {
        await recruitmentService.create(payload);
      } else if (mode === 'edit') {
        const id = activeId || activeSlug;
        if (!id) throw new Error('Missing post id');
        await recruitmentService.update(id, payload);
      }

      closeModal(true);
      await fetchPosts();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Save failed';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const modalTitle = useMemo(() => {
    if (mode === 'create') return 'Create recruitment post';
    if (mode === 'edit') return 'Edit recruitment post';
    return 'Recruitment post';
  }, [mode]);

  const isReadOnly = mode === 'view';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Recruitments</h2>
          <p className="text-gray-500 mt-1">Create and manage recruitment posts</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => openModal('create')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700"
            disabled={isLoading}
            title="Create"
          >
            <Plus size={18} />
            Create
          </button>
          <button
            onClick={fetchPosts}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gray-50 text-gray-700 hover:bg-gray-100"
            disabled={isLoading}
            title="Refresh"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
            Refresh
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
              placeholder="Search title, summary..."
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
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Publish at</th>
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
                    No recruitment posts found.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <p className="font-medium text-gray-900 line-clamp-1">{item.title}</p>
                        <p className="text-xs text-gray-500 line-clamp-1">{item.summary || '-'}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        item.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500">{formatDateTime(item.publishAt)}</td>
                    <td className="px-6 py-4 text-xs text-gray-500">{formatDateTime(item.updatedAt)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openModal('view', item)}
                          className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                          title="View"
                          disabled={isSaving}
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => openModal('edit', item)}
                          className="p-2 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg"
                          title="Edit"
                          disabled={isSaving}
                        >
                          <Pencil size={16} />
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
            {pagination.total > 0
              ? `Showing ${(pagination.page - 1) * pagination.limit + 1}-${Math.min(pagination.page * pagination.limit, pagination.total)} of ${pagination.total}`
              : '-'}
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

      <Modal isOpen={isModalOpen} onClose={closeModal} title={modalTitle} maxWidthClassName="max-w-4xl">
        <div className="p-6 space-y-4">
          {isDetailLoading ? (
            <div className="flex items-center justify-center py-10 text-gray-500">
              <Loader2 size={20} className="animate-spin" />
              <span className="ml-2">Loading...</span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Title</label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    placeholder="Title"
                    disabled={isReadOnly}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Summary</label>
                  <textarea
                    value={form.summary}
                    onChange={(e) => setForm((prev) => ({ ...prev, summary: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    rows={3}
                    placeholder="Short summary"
                    disabled={isReadOnly}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Body</label>
                  <textarea
                    value={form.body}
                    onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none font-mono text-sm"
                    rows={10}
                    placeholder="Full content"
                    disabled={isReadOnly}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
                  <Dropdown
                    value={form.status}
                    onChange={(v) => setForm((prev) => ({ ...prev, status: v as any }))}
                    options={STATUS_OPTIONS.filter((opt) => opt.value !== 'all')}
                    disabled={isReadOnly}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Publish at</label>
                  <input
                    type="datetime-local"
                    value={form.publishAt}
                    onChange={(e) => setForm((prev) => ({ ...prev, publishAt: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    disabled={isReadOnly}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Tags</label>
                  <input
                    value={form.tags}
                    onChange={(e) => setForm((prev) => ({ ...prev, tags: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    placeholder="tag1, tag2, tag3"
                    disabled={isReadOnly}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Cover image</label>
                  <input
                    value={form.coverImage}
                    onChange={(e) => setForm((prev) => ({ ...prev, coverImage: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    placeholder="https://..."
                    disabled={isReadOnly}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Author name</label>
                  <input
                    value={form.authorName}
                    onChange={(e) => setForm((prev) => ({ ...prev, authorName: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    placeholder="Optional"
                    disabled={isReadOnly}
                  />
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-gray-900">Roles</h4>
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, roles: [...prev.roles, { role: '', description: '', skills: '' }] }))}
                      className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-50 text-gray-700 hover:bg-gray-100"
                    >
                      Add role
                    </button>
                  )}
                </div>
                {form.roles.length === 0 ? (
                  <p className="text-sm text-gray-500">-</p>
                ) : (
                  <div className="space-y-3">
                    {form.roles.map((r, idx) => (
                      <div key={idx} className="rounded-xl border border-gray-200 p-4 space-y-3 bg-gray-50">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-gray-800">Role #{idx + 1}</p>
                          {!isReadOnly && (
                            <button
                              type="button"
                              onClick={() =>
                                setForm((prev) => ({
                                  ...prev,
                                  roles: prev.roles.filter((_, i) => i !== idx),
                                }))
                              }
                              className="text-sm text-red-600 hover:text-red-700"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
                            <input
                              value={r.role}
                              onChange={(e) =>
                                setForm((prev) => ({
                                  ...prev,
                                  roles: prev.roles.map((x, i) => (i === idx ? { ...x, role: e.target.value } : x)),
                                }))
                              }
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                              disabled={isReadOnly}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Skills</label>
                            <input
                              value={r.skills}
                              onChange={(e) =>
                                setForm((prev) => ({
                                  ...prev,
                                  roles: prev.roles.map((x, i) => (i === idx ? { ...x, skills: e.target.value } : x)),
                                }))
                              }
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                              placeholder="skill1, skill2"
                              disabled={isReadOnly}
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                            <textarea
                              value={r.description}
                              onChange={(e) =>
                                setForm((prev) => ({
                                  ...prev,
                                  roles: prev.roles.map((x, i) => (i === idx ? { ...x, description: e.target.value } : x)),
                                }))
                              }
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                              rows={2}
                              disabled={isReadOnly}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-gray-100 pt-4 space-y-3">
                <h4 className="text-sm font-semibold text-gray-900">Contact</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                    <input
                      value={form.contact.name}
                      onChange={(e) => setForm((prev) => ({ ...prev, contact: { ...prev.contact, name: e.target.value } }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      disabled={isReadOnly}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                    <input
                      value={form.contact.email}
                      onChange={(e) => setForm((prev) => ({ ...prev, contact: { ...prev.contact, email: e.target.value } }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      disabled={isReadOnly}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                    <input
                      value={form.contact.phone}
                      onChange={(e) => setForm((prev) => ({ ...prev, contact: { ...prev.contact, phone: e.target.value } }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      disabled={isReadOnly}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Link</label>
                    <input
                      value={form.contact.link}
                      onChange={(e) => setForm((prev) => ({ ...prev, contact: { ...prev.contact, link: e.target.value } }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      disabled={isReadOnly}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Discord</label>
                    <input
                      value={form.contact.discord}
                      onChange={(e) => setForm((prev) => ({ ...prev, contact: { ...prev.contact, discord: e.target.value } }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      disabled={isReadOnly}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Note</label>
                    <textarea
                      value={form.contact.note}
                      onChange={(e) => setForm((prev) => ({ ...prev, contact: { ...prev.contact, note: e.target.value } }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      rows={2}
                      disabled={isReadOnly}
                    />
                  </div>
                </div>
              </div>

              {activePost && (
                <div className="pt-2 text-xs text-gray-500">
                  <p>Slug: {activePost.slug}</p>
                  <p>Created: {formatDateTime(activePost.createdAt)}</p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-50 text-gray-700 hover:bg-gray-100"
                  disabled={isSaving}
                >
                  Close
                </button>
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={handleSave}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                    disabled={isSaving}
                  >
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default RecruitmentManager;

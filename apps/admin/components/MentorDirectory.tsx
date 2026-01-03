import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, Eye, Loader2, RefreshCw, Search } from 'lucide-react';
import { MentorPublicDetail, MentorPublicSummary } from '../types';
import { mentorPublicService, MentorSortValue } from '../services/mentorPublicService';
import { useDebounce } from '../hooks/useApi';
import { Dropdown } from './ui/Dropdown';
import { Modal } from './ui/Modal';
import { getAvatarUrl, avatarPresets } from '../utils/avatar';
import { buildPublicMentorUrl } from '../utils/publicSite';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest', color: 'bg-emerald-500' },
  { value: 'oldest', label: 'Oldest', color: 'bg-slate-500' },
  { value: 'name-asc', label: 'Name A-Z', color: 'bg-sky-500' },
  { value: 'name-desc', label: 'Name Z-A', color: 'bg-indigo-500' },
];

const FIELD_OPTIONS = [
  { value: 'all', label: 'All fields', color: 'bg-gray-400' },
  { value: 'it', label: 'IT & Tech', color: 'bg-sky-500' },
  { value: 'data', label: 'Data & Analytics', color: 'bg-emerald-500' },
  { value: 'cyber', label: 'Cybersecurity', color: 'bg-slate-500' },
  { value: 'robotics', label: 'Robotics & IoT', color: 'bg-amber-500' },
  { value: 'design', label: 'Design', color: 'bg-pink-500' },
  { value: 'business', label: 'Business', color: 'bg-indigo-500' },
  { value: 'startup', label: 'Startup', color: 'bg-orange-500' },
  { value: 'marketing', label: 'Marketing', color: 'bg-emerald-600' },
  { value: 'finance', label: 'Finance', color: 'bg-teal-500' },
  { value: 'health', label: 'Health', color: 'bg-red-500' },
  { value: 'education', label: 'Education', color: 'bg-blue-500' },
  { value: 'sustainability', label: 'Sustainability', color: 'bg-green-600' },
  { value: 'gaming', label: 'Gaming', color: 'bg-purple-500' },
  { value: 'research', label: 'Research', color: 'bg-slate-600' },
  { value: 'other', label: 'Other', color: 'bg-gray-500' },
];

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('vi-VN');
};

const MentorDirectory: React.FC = () => {
  const [items, setItems] = useState<MentorPublicSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [field, setField] = useState('all');
  const [sort, setSort] = useState<MentorSortValue>('newest');
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, totalPages: 1 });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeMentor, setActiveMentor] = useState<MentorPublicDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const fetchMentors = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await mentorPublicService.listPublic({
        page: pagination.page,
        limit: pagination.limit,
        search: debouncedSearch || undefined,
        field: field === 'all' ? undefined : field,
        sort,
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
      setError(err instanceof Error ? err.message : 'Failed to load mentors');
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, field, pagination.limit, pagination.page, sort]);

  useEffect(() => {
    fetchMentors();
  }, [fetchMentors]);

  const openDetail = async (item: MentorPublicSummary) => {
    setIsModalOpen(true);
    setIsDetailLoading(true);
    setDetailError(null);
    try {
      const detail = await mentorPublicService.getPublic(item.id);
      setActiveMentor(detail);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Failed to load mentor');
      setActiveMentor(null);
    } finally {
      setIsDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setIsModalOpen(false);
    setActiveMentor(null);
    setDetailError(null);
  };

  const showingText = useMemo(() => {
    if (!pagination.total) return '-';
    const start = (pagination.page - 1) * pagination.limit + 1;
    const end = Math.min(pagination.page * pagination.limit, pagination.total);
    return `Showing ${start}-${end} of ${pagination.total}`;
  }, [pagination.limit, pagination.page, pagination.total]);

  const renderFields = (fields?: string[]) => {
    if (!fields || fields.length === 0) return <span className="text-xs text-gray-400">-</span>;
    const visible = fields.slice(0, 3);
    const extra = fields.length - visible.length;
    return (
      <div className="flex flex-wrap gap-1">
        {visible.map((value) => (
          <span key={value} className="px-2 py-0.5 rounded-full text-[11px] bg-gray-100 text-gray-700">
            {value}
          </span>
        ))}
        {extra > 0 && (
          <span className="px-2 py-0.5 rounded-full text-[11px] bg-gray-100 text-gray-700">
            +{extra}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mentor Directory</h1>
          <p className="text-sm text-gray-500">Browse public mentor profiles and verify public data.</p>
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
        <div className="relative w-full lg:flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="Search mentor by name, email, or skills..."
          />
        </div>
        <div className="w-full lg:w-60">
          <Dropdown
            label="Field"
            value={field}
            onChange={(value) => {
              setField(value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            options={FIELD_OPTIONS}
          />
        </div>
        <div className="w-full lg:w-56">
          <Dropdown
            label="Sort"
            value={sort}
            onChange={(value) => {
              setSort(value as MentorSortValue);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            options={SORT_OPTIONS}
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
                <th className="px-6 py-4">Fields</th>
                <th className="px-6 py-4">Joined</th>
                <th className="px-6 py-4">Blog Status</th>
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
                  return (
                    <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img src={avatarUrl} alt={item.name} className="w-8 h-8 rounded-full object-cover" />
                          <div>
                            <p className="font-medium text-gray-900">{item.name}</p>
                            <p className="text-xs text-gray-500">ID: {item.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {renderFields(item.fields)}
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500">
                        {formatDate(item.joinedAt)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            item.mentorBlogCompleted
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {item.mentorBlogCompleted ? 'Completed' : 'Incomplete'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openDetail(item)}
                            className="p-2 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg"
                            title="View details"
                          >
                            <Eye size={16} />
                          </button>
                          <a
                            href={buildPublicMentorUrl(item.id)}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 text-gray-500 hover:text-sky-600 hover:bg-sky-50 rounded-lg"
                            title="View public profile"
                          >
                            <ExternalLink size={16} />
                          </a>
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

      <Modal isOpen={isModalOpen} onClose={closeDetail} title="Mentor Profile">
        <div className="p-6 space-y-4">
          {isDetailLoading ? (
            <div className="flex items-center justify-center py-10 text-gray-500">
              <Loader2 size={20} className="animate-spin" />
              <span className="ml-2">Loading mentor...</span>
            </div>
          ) : detailError ? (
            <div className="text-sm text-red-600">{detailError}</div>
          ) : activeMentor ? (
            <>
              <div className="overflow-hidden rounded-xl border border-gray-200">
                <img
                  src={activeMentor.bannerUrl || `https://picsum.photos/seed/mentor-${activeMentor.id}/800/400`}
                  alt={activeMentor.name}
                  className="w-full h-40 object-cover"
                />
              </div>

              <div className="flex items-center gap-3">
                <img
                  src={getAvatarUrl(activeMentor.avatar, activeMentor.name, avatarPresets.detail)}
                  alt={activeMentor.name}
                  className="w-12 h-12 rounded-full object-cover"
                />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{activeMentor.name}</h3>
                  <p className="text-xs text-gray-500">Joined {formatDate(activeMentor.joinedAt)}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {activeMentor.mentorBlogCompleted ? (
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                    Blog completed
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                    Blog incomplete
                  </span>
                )}
                <a
                  href={buildPublicMentorUrl(activeMentor.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-100 text-sky-700"
                >
                  View public profile
                </a>
              </div>

              {activeMentor.fields && activeMentor.fields.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {activeMentor.fields.map((value) => (
                    <span key={value} className="px-2.5 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
                      {value}
                    </span>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-900">Bio</h4>
                <p className="text-sm text-gray-700 whitespace-pre-line">
                  {activeMentor.bio || '-'}
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-900">Mentor blog</h4>
                <p className="text-sm text-gray-700 whitespace-pre-line">
                  {activeMentor.mentorBlog?.body || '-'}
                </p>
              </div>
            </>
          ) : (
            <div className="text-sm text-gray-500">No mentor selected.</div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default MentorDirectory;

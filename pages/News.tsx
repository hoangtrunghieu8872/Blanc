import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Megaphone, Sparkles, Trophy, Calendar, MessageCircle, ArrowRight, Tag, Lightbulb, Send, CheckCircle2, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Card } from '../components/ui/Common';
import { api } from '../lib/api';
import { newsApi } from '../lib/newsApi';
import { NewsArticle } from '../types';

type NewsType = 'announcement' | 'minigame' | 'update' | 'event';

const safeArray = <T,>(value: unknown, fallback: T[] = []): T[] =>
  Array.isArray(value) ? (value as T[]) : fallback;

const normalizeType = (value: unknown): NewsType => {
  const v = String(value || '').trim();
  if (v === 'announcement' || v === 'minigame' || v === 'update' || v === 'event') return v as NewsType;
  return 'announcement';
};

interface Suggestion {
  id: string;
  idea: string;
  contact?: string;
  createdAt: string;
  userEmail?: string | null;
}

const NEWS_TYPE_META: Record<NewsType, { label: string; color: string; Icon: React.ComponentType<{ className?: string }> }> = {
  announcement: { label: 'Thông báo', color: 'bg-indigo-50 text-indigo-700 border-indigo-100', Icon: Megaphone },
  minigame: { label: 'Mini game', color: 'bg-amber-50 text-amber-700 border-amber-100', Icon: Trophy },
  update: { label: 'Cập nhật', color: 'bg-emerald-50 text-emerald-700 border-emerald-100', Icon: Sparkles },
  event: { label: 'Sự kiện', color: 'bg-sky-50 text-sky-700 border-sky-100', Icon: Calendar },
};

const INITIAL_NEWS = [
  {
    id: 'n1',
    title: 'Thông báo bảo trì 12/12',
    description: 'Hệ thống sẽ bảo trì nhanh để tối ưu tốc độ tải và bổ sung lớp bảo mật mới. Các phiên đăng nhập hiện tại không bị ảnh hưởng.',
    type: 'announcement',
    createdAt: '2025-12-10T07:00:00Z',
    author: 'Ban điều hành',
    tags: ['Bảo trì', 'Hiệu năng'],
    actionLabel: 'Xem chi tiết',
    actionLink: '#',
    highlight: true,
  },
  {
    id: 'n2',
    title: 'Mini game: Săn huy hiệu cuối năm',
    description: 'Hoàn thành 3 thử thách nhỏ trong Cộng đồng để nhận huy hiệu hiếm và mã giảm giá khóa học. Tổng giá trị phần thưởng 3.000.000đ.',
    type: 'minigame',
    createdAt: '2025-12-09T13:00:00Z',
    author: 'Team Cộng đồng',
    tags: ['Quà tặng', 'Gamification'],
    actionLabel: 'Tham gia ngay',
    actionLink: '/community',
    highlight: true,
  },
  {
    id: 'n3',
    title: 'Cập nhật lộ trình học mới',
    description: 'Thêm 4 lộ trình Data/AI với mentor hướng dẫn trực tiếp. Người học có thể đặt lịch cố vấn ngay trong tuần này.',
    type: 'update',
    createdAt: '2025-12-08T09:00:00Z',
    author: 'Academic Ops',
    tags: ['Lộ trình', 'Mentor'],
  },
  {
    id: 'n4',
    title: 'Workshop “Pitch deck trong 10 phút”',
    description: 'Buổi chia sẻ online cùng giám khảo các cuộc thi lớn. Mang theo deck của bạn để được góp ý trực tiếp.',
    type: 'event',
    createdAt: '2025-12-06T11:30:00Z',
    author: 'Ban Nội dung',
    tags: ['Workshop', 'Online'],
    actionLabel: 'Giữ chỗ',
    actionLink: '#',
  },
] as unknown as NewsArticle[];

const News: React.FC = () => {
  const [newsItems, setNewsItems] = useState<NewsArticle[]>([]);
  const [filter, setFilter] = useState<'all' | NewsType>('all');
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedback, setFeedback] = useState<{ idea: string; contact: string }>({ idea: '', contact: '' });
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suggestionCount, setSuggestionCount] = useState(0);
  const [isLoadingNews, setIsLoadingNews] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<NewsArticle | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const getNewsType = (item: NewsArticle): NewsType =>
    normalizeType(item.type || (item as any).type);

  const getNewsSummary = (item: NewsArticle) =>
    item.summary || (item as any).description || '';

  const getNewsDate = (item: NewsArticle) =>
    item.publishAt || (item as any).createdAt || item.createdAt || null;

  const getNewsAuthorName = (item: NewsArticle): string => {
    const name = item.author?.name;
    if (typeof name === 'string' && name.trim()) return name;

    const email = item.author?.email;
    if (typeof email === 'string' && email.trim()) return email;

    const rawAuthor = (item as any).author;
    if (typeof rawAuthor === 'string' && rawAuthor.trim()) return rawAuthor;

    if (rawAuthor && typeof rawAuthor === 'object') {
      const rawName = (rawAuthor as any).name;
      if (typeof rawName === 'string' && rawName.trim()) return rawName;

      const rawEmail = (rawAuthor as any).email;
      if (typeof rawEmail === 'string' && rawEmail.trim()) return rawEmail;
    }

    return 'Admin';
  };

  const getNewsTags = (item: NewsArticle): string[] => {
    const raw = (item as any).tags ?? item.tags;
    if (typeof raw === 'string') {
      return raw
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
    }
    return safeArray<string>(raw)
      .map((t) => (typeof t === 'string' ? t.trim() : ''))
      .filter(Boolean);
  };

  const getNewsActionLabel = (item: NewsArticle) =>
    item.actionLabel || (item as any).actionLabel || '';

  const getNewsActionLink = (item: NewsArticle) => {
    const raw = String(item.actionLink || (item as any).actionLink || '').trim();
    if (!raw || raw.startsWith('#')) return '';
    return raw;
  };

  const isHighlighted = (item: NewsArticle) =>
    !!(item.highlight || (item as any).highlight);

  const filteredNews = useMemo(() => {
    const scoped = filter === 'all'
      ? newsItems
      : newsItems.filter(item => getNewsType(item) === filter);
    return [...scoped].sort((a, b) => {
      const dateA = new Date(getNewsDate(a) || 0).getTime();
      const dateB = new Date(getNewsDate(b) || 0).getTime();
      return dateB - dateA;
    });
  }, [filter, newsItems]);

  const highlightNews = useMemo(() => newsItems.filter(isHighlighted), [newsItems]);

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const timeAgo = (dateStr?: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return 'Vừa xong';
    if (diffMinutes < 60) return `${diffMinutes} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;
    return formatDate(dateStr);
  };

  const fetchNews = useCallback(async () => {
    setIsLoadingNews(true);
    try {
      const data = await newsApi.listPublic({ limit: 50 });
      setNewsItems(safeArray<NewsArticle>(data.items));
    } catch (err) {
      console.error('Failed to fetch news:', err);
      setNewsItems(INITIAL_NEWS);
    } finally {
      setIsLoadingNews(false);
    }
  }, []);

  const fetchSuggestions = useCallback(async () => {
    setIsLoadingSuggestions(true);
    try {
      const data = await api.get<{ suggestions: Suggestion[]; total?: number }>('/feedback/news?limit=10');
      const nextSuggestions = safeArray<Suggestion>(data.suggestions);
      setSuggestions(nextSuggestions);
      if (typeof data.total === 'number') {
        setSuggestionCount(data.total);
      } else {
        setSuggestionCount(nextSuggestions.length);
      }
    } catch (err) {
      console.error('Failed to load suggestions', err);
      toast.error('Không tải được góp ý gần đây.');
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, []);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  useEffect(() => {
    if (showFeedbackForm) {
      fetchSuggestions();
    }
  }, [showFeedbackForm, fetchSuggestions]);

  const closeDetail = () => {
    setIsDetailOpen(false);
    setDetailItem(null);
  };

  const openDetail = async (item: NewsArticle) => {
    setIsDetailOpen(true);
    setDetailItem(item);

    const idOrSlug = item.slug || item.id;
    if (!idOrSlug) return;

    setIsLoadingDetail(true);
    try {
      const data = await newsApi.getPublic(idOrSlug);
      setDetailItem(data.item);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không tải được nội dung bản tin.';
      toast.error(message);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.idea.trim()) {
      toast.error('Bạn hãy nhập góp ý trước nhé!');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        idea: feedback.idea.trim(),
        contact: feedback.contact.trim() || undefined,
      };
      const data = await api.post<{ suggestion: Suggestion }>('/feedback/news', payload);
      setSuggestions(prev => [data.suggestion, ...prev].slice(0, 10));
      toast.success('Cảm ơn bạn! Chúng mình đã ghi nhận góp ý.');
      setFeedback({ idea: '', contact: '' });
      setShowFeedbackForm(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gửi góp ý thất bại, thử lại nhé.';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      <section className="relative overflow-hidden rounded-3xl border border-slate-100 bg-gradient-to-r from-sky-50 via-white to-emerald-50 shadow-sm p-6 md:p-8">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -left-10 -top-12 w-40 h-40 bg-primary-200/40 blur-3xl rounded-full"></div>
          <div className="absolute right-0 top-10 w-64 h-64 bg-amber-100/60 blur-3xl rounded-full"></div>
        </div>
        <div className="relative flex flex-col md:flex-row justify-between gap-6 md:gap-8 items-start md:items-center">
          <div className="space-y-4 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/70 text-primary-700 border border-primary-100 shadow-sm">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-semibold">Bản tin Blanc</span>
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight">Bản tin & thông báo quan trọng</h1>
              <p className="text-slate-600 text-base md:text-lg">
                Nơi admin đăng thông báo hệ thống, mini game và các hoạt động nổi bật. Người dùng có thể góp ý thêm tin tức để cộng đồng luôn tươi mới.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" className="gap-2" onClick={() => setShowFeedbackForm(true)}>
                <MessageCircle className="w-4 h-4" />
                Góp ý thêm tin tức
              </Button>
            </div>
          </div>
          <div className="w-full md:w-auto">
            <Card className="p-5 bg-white/80 border-slate-100 shadow-md">
              <div className="flex items-center gap-3 mb-3">
                <Megaphone className="w-5 h-5 text-primary-600" />
                <div>
                  <p className="text-xs uppercase tracking-wide text-primary-600 font-semibold">Tổng quan</p>
                  <p className="text-sm text-slate-500">Bản tin đang chạy</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="rounded-xl bg-primary-50 text-primary-700 px-3 py-2">
                  <p className="text-2xl font-bold">{newsItems.length}</p>
                  <p className="text-xs font-medium">Tin đang hiển thị</p>
                </div>
                <div className="rounded-xl bg-amber-50 text-amber-700 px-3 py-2">
                  <p className="text-2xl font-bold">{suggestionCount}</p>
                  <p className="text-xs font-medium">Góp ý mới</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {highlightNews.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-primary-600 font-semibold">Nổi bật</p>
              <h2 className="text-xl font-bold text-slate-900">Tin được ghim cho toàn bộ cộng đồng</h2>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {highlightNews.map(item => {
              const meta = NEWS_TYPE_META[getNewsType(item)] || NEWS_TYPE_META.announcement;
              const tags = getNewsTags(item);
              const actionLink = getNewsActionLink(item);
              return (
                <Card
                  key={item.id || item.slug}
                  className="relative overflow-hidden border-primary-100 cursor-pointer"
                  onClick={() => openDetail(item)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') openDetail(item);
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-primary-50/60 via-white to-amber-50/40 pointer-events-none" aria-hidden="true" />
                  <div className="relative p-6 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-sm font-semibold ${meta.color}`}>
                        <meta.Icon className="w-4 h-4" />
                        {meta.label}
                      </div>
                      <span className="text-xs text-slate-500">{timeAgo(getNewsDate(item))}</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">{item.title}</h3>
                    <p className="text-slate-600 text-sm leading-relaxed">{getNewsSummary(item)}</p>
                    <div className="flex flex-wrap gap-2">
                      {tags.map(tag => (
                        <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-slate-200 text-xs text-slate-600">
                          <Tag className="w-3 h-3 text-slate-400" />
                          {tag}
                        </span>
                      ))}
                    </div>
                    {actionLink && (
                      <a
                        href={actionLink}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700 hover:text-primary-800"
                      >
                        {item.actionLabel || 'Tìm hiểu thêm'} <ArrowRight className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold">Dòng tin mới nhất</p>
            <h2 className="text-xl font-bold text-slate-900">Tin tức từ admin</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['all', 'announcement', 'minigame', 'update', 'event'] as Array<'all' | NewsType>).map(type => {
              const meta = type === 'all' ? { label: 'Tất cả', color: 'bg-slate-100 text-slate-700 border-slate-200' } : NEWS_TYPE_META[type];
              return (
                <button
                  key={type}
                  onClick={() => setFilter(type)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                    filter === type ? 'bg-primary-600 text-white border-primary-600 shadow-sm' : `${meta.color} hover:border-primary-200`
                  }`}
                >
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {isLoadingNews && (
            <div className="col-span-full flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Đang tải bản tin...
            </div>
          )}
          {!isLoadingNews && filteredNews.length === 0 && (
            <p className="col-span-full text-sm text-slate-500">Chưa có bản tin nào.</p>
          )}
          {filteredNews.map(item => {
            const meta = NEWS_TYPE_META[getNewsType(item)] || NEWS_TYPE_META.announcement;
            const tags = getNewsTags(item);
            const actionLink = getNewsActionLink(item);
            return (
              <Card
                key={item.id || item.slug}
                className="p-5 flex flex-col h-full cursor-pointer"
                onClick={() => openDetail(item)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') openDetail(item);
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 px-2.5 py-1 rounded-full border text-xs font-semibold bg-white">
                    <meta.Icon className="w-4 h-4 text-slate-500" />
                    <span className="text-slate-700">{meta.label}</span>
                  </div>
                  <span className="text-xs text-slate-500">{timeAgo(getNewsDate(item))}</span>
                </div>
                <div className="mt-3 space-y-2 flex-1">
                  <h3 className="text-lg font-semibold text-slate-900 leading-snug">{item.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{getNewsSummary(item)}</p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {tags.map(tag => (
                    <span key={tag} className="px-2.5 py-1 rounded-full bg-slate-50 text-slate-600 text-xs border border-slate-200">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                  <span>{getNewsAuthorName(item)}</span>
                  {actionLink && (
                    <a
                      href={actionLink}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-primary-700 font-semibold text-sm"
                    >
                      {item.actionLabel || 'Xem thêm'}
                      <ArrowRight className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {isDetailOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={closeDetail}
            aria-hidden="true"
          />
          <Card className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-900">
                <Megaphone className="w-5 h-5 text-primary-600" />
                <span className="font-semibold">Nội dung bản tin</span>
              </div>
              <button
                type="button"
                onClick={closeDetail}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg"
                aria-label="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 max-h-[75vh] overflow-y-auto space-y-4">
              {isLoadingDetail && (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang tải nội dung...
                </div>
              )}

              {detailItem && (
                <>
                  {detailItem.coverImage && (
                    <img
                      src={detailItem.coverImage}
                      alt={detailItem.title}
                      className="w-full h-56 object-cover rounded-xl border border-slate-100"
                      loading="lazy"
                    />
                  )}

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-50 text-slate-600 border border-slate-200">
                      {NEWS_TYPE_META[getNewsType(detailItem)].label}
                    </span>
                    <span className="text-slate-500">{formatDate(getNewsDate(detailItem))}</span>
                    <span className="text-slate-500">•</span>
                    <span className="text-slate-500">{getNewsAuthorName(detailItem)}</span>
                  </div>

                  <h2 className="text-2xl font-bold text-slate-900">{detailItem.title}</h2>

                  {getNewsSummary(detailItem) && (
                    <p className="text-slate-600">{getNewsSummary(detailItem)}</p>
                  )}

                  {(detailItem.body || '').trim() ? (
                    <div className="text-slate-800 whitespace-pre-wrap leading-relaxed text-sm">
                      {detailItem.body}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">Chưa có nội dung.</p>
                  )}

                  {getNewsTags(detailItem).length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {getNewsTags(detailItem).map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-slate-200 text-xs text-slate-600"
                        >
                          <Tag className="w-3 h-3 text-slate-400" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {getNewsActionLink(detailItem) && (
                    <a
                      href={getNewsActionLink(detailItem)}
                      target={getNewsActionLink(detailItem).startsWith('http') ? '_blank' : undefined}
                      rel={getNewsActionLink(detailItem).startsWith('http') ? 'noreferrer' : undefined}
                      className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700 hover:text-primary-800"
                    >
                      {getNewsActionLabel(detailItem) || 'Xem thêm'} <ArrowRight className="w-4 h-4" />
                    </a>
                  )}
                </>
              )}
            </div>
          </Card>
        </div>
      )}

      {showFeedbackForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setShowFeedbackForm(false)}
            aria-hidden="true"
          />
          <Card className="relative w-full max-w-2xl p-6 md:p-7 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 text-primary-700 font-semibold">
                <Lightbulb className="w-5 h-5" />
                <span>Góp ý bản tin</span>
              </div>
              <button
                type="button"
                onClick={() => setShowFeedbackForm(false)}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-600">
              Gửi ý tưởng tin tức, mini game hoặc chủ đề bạn muốn xuất hiện. Admin sẽ cân nhắc và phản hồi sớm.
            </p>
            <form className="space-y-4" onSubmit={handleFeedbackSubmit}>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">Ý tưởng / góp ý</label>
                <textarea
                  value={feedback.idea}
                  onChange={e => setFeedback(prev => ({ ...prev, idea: e.target.value }))}
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition"
                  placeholder="Ví dụ: Tổ chức mini game theo chủ đề Data, cập nhật lịch thi học kỳ..."
                  required
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">Thông tin liên hệ (tuỳ chọn)</label>
                <input
                  type="text"
                  value={feedback.contact}
                  onChange={e => setFeedback(prev => ({ ...prev, contact: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 transition"
                  placeholder="Email, Discord, Facebook..."
                  disabled={isSubmitting}
                />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Góp ý sẽ được ghi nhận ngay lập tức.
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" type="button" onClick={() => setShowFeedbackForm(false)} disabled={isSubmitting}>
                    Huỷ
                  </Button>
                  <Button type="submit" className="gap-2" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {isSubmitting ? 'Đang gửi...' : 'Gửi góp ý'}
                  </Button>
                </div>
              </div>
              <div className="pt-1 space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold">Góp ý gần đây</p>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {isLoadingSuggestions && (
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Đang tải góp ý...
                    </div>
                  )}
                  {!isLoadingSuggestions && suggestions.length === 0 && (
                    <p className="text-sm text-slate-500">Chưa có góp ý nào. Hãy là người đầu tiên!</p>
                  )}
                  {!isLoadingSuggestions &&
                    suggestions.slice(0, 5).map((suggestion) => (
                      <div key={suggestion.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                        <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                          <span>{formatDate(suggestion.createdAt)}</span>
                          {suggestion.contact && <span className="text-primary-700 font-medium">{suggestion.contact}</span>}
                          {!suggestion.contact && suggestion.userEmail && <span className="text-primary-700 font-medium">{suggestion.userEmail}</span>}
                        </div>
                        <p className="text-sm text-slate-800 leading-relaxed">{suggestion.idea}</p>
                      </div>
                    ))}
                </div>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};

export default News;

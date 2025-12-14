import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Pin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from './ui/Common';
import type { NewsArticle } from '../types';

type Props = {
  lead?: React.ReactNode;
  leadKey?: string;
  items: NewsArticle[];
  intervalMs?: number;
  className?: string;
  buildItemHref?: (item: NewsArticle) => string;
  viewAllHref?: string;
};

type Slide =
  | { type: 'lead'; key: string; content: React.ReactNode }
  | { type: 'item'; key: string; item: NewsArticle };

const defaultBuildItemHref = (item: NewsArticle): string => {
  void item;
  return '/news';
};

const formatPinnedDate = (iso?: string | null): string => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const PinnedNewsSlider: React.FC<Props> = ({
  lead,
  leadKey = 'lead',
  items,
  intervalMs = 10_000,
  className,
  buildItemHref = defaultBuildItemHref,
  viewAllHref = '/news',
}) => {
  const slides = useMemo<Slide[]>(() => {
    const normalized = Array.isArray(items) ? items.filter(Boolean) : [];
    const mapped: Slide[] = normalized.map((item, idx) => ({
      type: 'item',
      key: item.id || item.slug || `item-${idx}`,
      item,
    }));
    return lead ? [{ type: 'lead', key: leadKey, content: lead }, ...mapped] : mapped;
  }, [items, lead, leadKey]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const hasMultiple = slides.length > 1;

  const goTo = useCallback(
    (index: number) => {
      if (slides.length === 0) return;
      const nextIndex = (index + slides.length) % slides.length;
      setActiveIndex(nextIndex);
    },
    [slides.length],
  );

  const goNext = useCallback(() => goTo(activeIndex + 1), [activeIndex, goTo]);
  const goPrev = useCallback(() => goTo(activeIndex - 1), [activeIndex, goTo]);

  useEffect(() => {
    if (activeIndex >= slides.length) setActiveIndex(0);
  }, [activeIndex, slides.length]);

  useEffect(() => {
    if (!hasMultiple || isPaused) return;
    const id = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slides.length);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [hasMultiple, intervalMs, isPaused, slides.length]);

  if (slides.length === 0) return null;

  return (
    <div
      className={cn('w-full', className)}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={() => setIsPaused(false)}
    >
      <div className="relative">
        <div className="overflow-hidden">
          <div
            className="flex transition-transform duration-700 ease-in-out"
            style={{ transform: `translateX(-${activeIndex * 100}%)` }}
            aria-live={hasMultiple ? 'polite' : 'off'}
          >
            {slides.map((slide) => {
              if (slide.type === 'lead') {
                return (
                  <div key={slide.key} className="w-full shrink-0">
                    <div className="min-h-[260px] sm:min-h-[300px] md:min-h-[360px] flex items-center justify-center px-4 sm:px-6 lg:px-10">
                      <div className="w-full">{slide.content}</div>
                    </div>
                  </div>
                );
              }

              const item = slide.item;
              const dateLabel = formatPinnedDate(item.publishAt || item.publishedAt || item.createdAt || null);
              const tags = Array.isArray(item.tags) ? item.tags.filter(Boolean).slice(0, 3) : [];
              const title = String(item.title || '').trim();
              const summary = String(item.summary || '').trim();
              const coverImage = String(item.coverImage || '').trim();

              return (
                <div key={slide.key} className="w-full shrink-0">
                  <div className="relative min-h-[260px] sm:min-h-[300px] md:min-h-[360px] flex items-center justify-center px-4 sm:px-6 lg:px-10">
                    {coverImage && (
                      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
                        <div
                          className="absolute inset-0 bg-center bg-cover opacity-20"
                          style={{ backgroundImage: `url(${coverImage})` }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-b from-white/85 via-white/75 to-white/90" />
                      </div>
                    )}

                    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
                      <div className="absolute -left-20 top-6 w-72 h-72 bg-primary-200/50 blur-3xl rounded-full" />
                      <div className="absolute right-[-120px] bottom-[-120px] w-80 h-80 bg-emerald-200/50 blur-3xl rounded-full" />
                    </div>

                    <div className="relative w-full max-w-4xl mx-auto text-center">
                      <div className="flex items-center justify-center gap-3 flex-wrap">
                        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/70 text-primary-700 border border-primary-100 shadow-sm">
                          <Pin className="w-4 h-4" />
                          <span className="text-sm font-semibold">Tin được ghim</span>
                        </span>
                        {dateLabel && <span className="text-xs text-slate-500">{dateLabel}</span>}
                      </div>

                      <h2 className="mt-6 text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
                        {title || 'Bản tin ghim'}
                      </h2>

                      {summary && (
                        <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed line-clamp-3">
                          {summary}
                        </p>
                      )}

                      {tags.length > 0 && (
                        <div className="mt-5 flex flex-wrap gap-2 justify-center">
                          {tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center px-3 py-1 rounded-full bg-white/70 border border-slate-200 text-xs font-medium text-slate-600"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="mt-7 flex items-center justify-center gap-3">
                        <Link
                          to={buildItemHref(item)}
                          className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 bg-primary-600 text-white font-semibold shadow-sm hover:bg-primary-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                          aria-label={title ? `Mở tin ghim: ${title}` : 'Mở tin ghim'}
                        >
                          <span>{item.actionLabel?.trim() || 'Xem chi tiết'}</span>
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                        <Link
                          to={viewAllHref}
                          className="text-sm font-semibold text-slate-600 hover:text-primary-700 transition-colors"
                        >
                          Xem tất cả tin
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {hasMultiple && (
          <>
            <button
              type="button"
              onClick={goPrev}
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/85 border border-slate-200 shadow-sm text-slate-700 hover:bg-white hover:shadow-md transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 z-10"
              aria-label="Slide trước"
            >
              <ChevronLeft className="w-5 h-5 mx-auto" />
            </button>
            <button
              type="button"
              onClick={goNext}
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/85 border border-slate-200 shadow-sm text-slate-700 hover:bg-white hover:shadow-md transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 z-10"
              aria-label="Slide tiếp theo"
            >
              <ChevronRight className="w-5 h-5 mx-auto" />
            </button>
          </>
        )}
      </div>

      {hasMultiple && (
        <div className="mt-4 flex items-center justify-center">
          <div className="flex items-center gap-1.5">
            {slides.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => goTo(idx)}
                className={cn(
                  'h-2.5 rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                  idx === activeIndex ? 'w-7 bg-primary-600' : 'w-2.5 bg-slate-300 hover:bg-slate-400',
                )}
                aria-label={`Đến slide ${idx + 1}`}
                aria-current={idx === activeIndex ? 'true' : undefined}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

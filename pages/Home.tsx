import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, ArrowRight, Users, Trophy, BookOpen, Star, Calendar, Loader2, X } from 'lucide-react';
import { Button, Card, Badge } from '../components/ui/Common';
import { useNavigate } from 'react-router-dom';
import { useSearch, useStats, useContests, useCourses, useRecommendedContent } from '../lib/hooks';
import OptimizedImage from '../components/OptimizedImage';
import { newsApi } from '../lib/newsApi';
import { PinnedNewsSlider } from '../components/PinnedNewsSlider';
import type { NewsArticle } from '../types';

const Home: React.FC = () => {
  const navigate = useNavigate();

  // Check login status
  const isLoggedIn = !!localStorage.getItem('user');

  // Database hooks
  const { stats, isLoading: statsLoading } = useStats();
  const { contests: defaultContests, isLoading: contestsLoading } = useContests({ limit: 3 });
  const { courses: defaultCourses, isLoading: coursesLoading } = useCourses({ limit: 3 });

  // Personalized recommendations (only for logged-in users)
  const {
    contests: recommendedContests,
    courses: recommendedCourses,
    isLoading: recommendationsLoading,
    isPersonalized,
    hasRecommendations
  } = useRecommendedContent({
    contestLimit: 3,
    courseLimit: 4,
    autoFetch: isLoggedIn
  });

  // Use personalized recommendations if available, otherwise fall back to default
  const displayContests = isLoggedIn && hasRecommendations && recommendedContests.length > 0
    ? recommendedContests
    : defaultContests;
  const displayCourses = isLoggedIn && hasRecommendations && recommendedCourses.length > 0
    ? recommendedCourses
    : defaultCourses;

  // Combined loading state
  const isContestsLoading = isLoggedIn ? (recommendationsLoading && contestsLoading) : contestsLoading;
  const isCoursesLoading = isLoggedIn ? (recommendationsLoading && coursesLoading) : coursesLoading;

  // Search functionality
  const { query, setQuery, results, isLoading: searchLoading, hasResults, clearSearch } = useSearch({
    debounceMs: 300,
    minChars: 2,
    limit: 5
  });
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Pinned news slider (admin-highlighted news)
  const [pinnedNews, setPinnedNews] = useState<NewsArticle[]>([]);

  const fetchPinnedNews = useCallback(async () => {
    try {
      const data = await newsApi.listPublic({ limit: 6, highlight: true });
      const items = Array.isArray(data.items) ? data.items : [];
      setPinnedNews(items.filter((item) => !!item.highlight));
    } catch (err) {
      console.error('Failed to fetch pinned news:', err);
      setPinnedNews([]);
    }
  }, []);

  useEffect(() => {
    fetchPinnedNews();
  }, [fetchPinnedNews]);

  // Click outside to close search results
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchResultClick = (type: string, id: string) => {
    setShowResults(false);
    clearSearch();
    navigate(type === 'contest' ? `/contests/${id}` : `/courses/${id}`);
  };

  // Format price in VND
  const formatPrice = (price: number) => {
    if (price === 0) return 'Miễn phí';
    return price.toLocaleString('vi-VN') + 'đ';
  };

  // Calculate remaining days
  const getRemainingDays = (deadline: string) => {
    const diff = new Date(deadline).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days < 0) return 'Đã kết thúc';
    if (days === 0) return 'Hôm nay';
    return `Còn ${days} ngày`;
  };

  const handleHeroCta = useCallback(() => {
    if (isLoggedIn) {
      navigate('/contests');
    } else {
      navigate('/register');
    }
  }, [isLoggedIn, navigate]);

  return (
    <div className="flex flex-col gap-16 pb-16">

      {/* Hero Section */}
      <section className="relative bg-white pt-0 pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute top-0 left-1/2 w-full -translate-x-1/2 h-full bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-primary-50 via-white to-white pointer-events-none" />
        <div className="max-w-7xl mx-auto relative z-10 text-center">
          <div className="relative left-1/2 right-1/2 w-screen -ml-[50vw] -mr-[50vw]">
            <PinnedNewsSlider
              className="mb-10"
              intervalMs={10_000}
              items={pinnedNews}
              lead={(
              <>
          <Badge className="mb-6 bg-primary-50 text-primary-700 border-primary-100 px-4 py-1.5 text-sm">
            🚀 Nền tảng phát triển cá nhân số 1 cho học sinh
          </Badge>
          <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 tracking-tight mb-6">
            Khám phá tiềm năng <br className="hidden md:block" />
            <span className="text-primary-600">Nâng tầm kiến thức</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-500 max-w-2xl mx-auto">
            Tham gia các cuộc thi uy tín, học hỏi từ các khóa học hàng đầu và kết nối với cộng đồng tài năng trên toàn quốc.
          </p>
              </>
            )}
            />
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            {/* Search with dropdown results */}
            <div className="relative w-full max-w-md" ref={searchRef}>
              <input
                type="text"
                placeholder="Tìm cuộc thi, khóa học..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShowResults(true);
                }}
                onFocus={() => setShowResults(true)}
                className="w-full h-12 pl-12 pr-10 rounded-full border border-slate-200 shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />

              {/* Loading indicator */}
              {searchLoading && (
                <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary-500 animate-spin" />
              )}

              {/* Clear button */}
              {query && !searchLoading && (
                <button
                  onClick={clearSearch}
                  title="Xóa tìm kiếm"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              )}

              {/* Search Results Dropdown */}
              {showResults && query.length >= 2 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50 max-h-96 overflow-y-auto">
                  {searchLoading ? (
                    <div className="p-4 text-center text-slate-500">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                      Đang tìm kiếm...
                    </div>
                  ) : hasResults ? (
                    <div>
                      {results.contests.length > 0 && (
                        <div>
                          <div className="px-4 py-2 bg-slate-50 text-xs font-semibold text-slate-500 uppercase">
                            Cuộc thi ({results.contests.length})
                          </div>
                          {results.contests.map((item) => (
                            <div
                              key={item.id}
                              onClick={() => handleSearchResultClick('contest', item.id)}
                              className="px-4 py-3 hover:bg-slate-50 cursor-pointer flex items-center gap-3"
                            >
                              <img src={item.image || 'https://picsum.photos/seed/default/100/100'} alt="" className="w-10 h-10 rounded-lg object-cover" />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-slate-900 truncate">{item.title}</div>
                                <div className="text-xs text-slate-500">{item.organizer}</div>
                              </div>
                              <Badge status={item.status} className="shrink-0">{item.status}</Badge>
                            </div>
                          ))}
                        </div>
                      )}
                      {results.courses.length > 0 && (
                        <div>
                          <div className="px-4 py-2 bg-slate-50 text-xs font-semibold text-slate-500 uppercase">
                            Khóa học ({results.courses.length})
                          </div>
                          {results.courses.map((item) => (
                            <div
                              key={item.id}
                              onClick={() => handleSearchResultClick('course', item.id)}
                              className="px-4 py-3 hover:bg-slate-50 cursor-pointer flex items-center gap-3"
                            >
                              <img src={item.image || 'https://picsum.photos/seed/default/100/100'} alt="" className="w-10 h-10 rounded-lg object-cover" />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-slate-900 truncate">{item.title}</div>
                                <div className="text-xs text-slate-500">{item.instructor}</div>
                              </div>
                              <span className="text-sm font-medium text-primary-600">{formatPrice(item.price)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* View all results */}
                      <div className="px-4 py-3 bg-slate-50 border-t border-slate-100">
                        <button
                          onClick={() => navigate(`/contests?search=${encodeURIComponent(query)}`)}
                          className="text-sm font-medium text-primary-600 hover:text-primary-700"
                        >
                          Xem tất cả kết quả →
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 text-center text-slate-500">
                      <Search className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      Không tìm thấy kết quả cho "{query}"
                    </div>
                  )}
                </div>
              )}
            </div>
            <Button size="lg" className="w-full sm:w-auto rounded-full px-8" onClick={handleHeroCta}>
              Bắt đầu ngay
            </Button>
          </div>

          {/* Stats */}
          <div className="relative left-1/2 right-1/2 w-screen -ml-[50vw] -mr-[50vw] overflow-hidden mb-[-88px] md:mb-[-104px]">
            <div className="absolute inset-0 bg-gradient-to-r from-primary-50 via-white to-emerald-50" />
            <div className="absolute -left-20 top-0 w-72 h-72 bg-primary-200/60 blur-3xl" />
            <div className="absolute right-[-120px] bottom-[-120px] w-80 h-80 bg-emerald-200/60 blur-3xl" />

            <div className="relative max-w-6xl mx-auto px-6 md:px-14 py-14 md:py-16">
              <div className="flex flex-col items-center text-center gap-4 md:gap-5">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary-600">Số liệu trực tiếp</p>
                <h3 className="text-3xl md:text-4xl font-black text-slate-900">Nhịp đập ContestHub</h3>
                <p className="text-slate-600 max-w-3xl">
                  Cập nhật liên tục từ hệ thống đăng ký, lớp học và các cuộc thi đang diễn ra.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                {statsLoading ? (
                  [...Array(3)].map((_, idx) => (
                    <div
                      key={idx}
                      className="relative overflow-hidden rounded-2xl border border-white/60 bg-white/70 backdrop-blur p-6 shadow-lg shadow-primary-100/50 animate-pulse"
                    >
                      <div className="h-12 w-12 bg-slate-200 rounded-full mb-5" />
                      <div className="h-8 w-24 bg-slate-200 rounded" />
                      <div className="h-4 w-32 bg-slate-100 rounded mt-3" />
                      <div className="h-2 w-full bg-slate-100 rounded-full mt-6" />
                    </div>
                  ))
                ) : (
                  [
                    {
                      label: 'Thành viên',
                      value: stats?.formatted.users || '0+',
                      icon: Users,
                      badge: 'Cộng đồng',
                      helper: 'Gia nhập mới mỗi ngày',
                      progress: '78%',
                    },
                    {
                      label: 'Cuộc thi',
                      value: stats?.formatted.contests || '0+',
                      icon: Trophy,
                      badge: 'Đang mở',
                      helper: 'Lịch thi cập nhật liên tục',
                      progress: '64%',
                    },
                    {
                      label: 'Khóa học',
                      value: stats?.formatted.courses || '0+',
                      icon: BookOpen,
                      badge: 'Nội dung',
                      helper: 'Lộ trình được tuyển chọn',
                      progress: '72%',
                    },
                  ].map((stat, idx) => (
                    <div
                      key={idx}
                      className="relative overflow-hidden rounded-2xl bg-white/85 backdrop-blur border border-white/60 shadow-lg shadow-primary-100/60 p-6 group transition duration-300 hover:-translate-y-1 hover:shadow-xl flex flex-col items-center text-center gap-4"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-white via-white to-primary-50 opacity-80 group-hover:opacity-100 transition-opacity duration-300" />
                      <div className="absolute -right-10 -top-12 h-32 w-32 bg-primary-100 blur-2xl opacity-70" />
                      <div className="absolute -left-10 bottom-0 h-24 w-24 bg-emerald-100 blur-2xl opacity-80" />

                      <div className="relative flex items-center justify-between mb-2 w-full">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary-500 to-emerald-400 text-white flex items-center justify-center shadow-md ring-4 ring-primary-100/70">
                            <stat.icon className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-[0.15em]">{stat.badge}</p>
                            <p className="text-sm font-semibold text-slate-900">{stat.label}</p>
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                          Đang hoạt động
                        </span>
                      </div>

                      <div className="relative z-10 w-full">
                        <div className="flex items-baseline justify-center gap-2">
                          <span className="text-4xl font-black text-slate-900 leading-none">{stat.value}</span>
                          <span className="text-sm font-semibold text-slate-500">tổng</span>
                        </div>
                        <p className="text-sm text-slate-500 mt-2">{stat.helper}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Contests */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              {isLoggedIn && isPersonalized ? 'Cuộc thi dành cho bạn' : 'Cuộc thi nổi bật'}
            </h2>
            <p className="text-slate-500 mt-1">
              {isLoggedIn && isPersonalized
                ? 'Được gợi ý dựa trên hồ sơ của bạn'
                : 'Thử thách bản thân với các cuộc thi mới nhất'}
            </p>
          </div>
          <Button variant="ghost" className="hidden sm:flex" onClick={() => navigate('/contests')}>
            Xem tất cả <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {isContestsLoading ? (
            // Loading skeleton for contests
            [...Array(3)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <div className="h-48 bg-slate-200" />
                <div className="p-5">
                  <div className="h-4 w-20 bg-slate-200 rounded mb-3" />
                  <div className="h-6 w-full bg-slate-200 rounded mb-2" />
                  <div className="h-4 w-3/4 bg-slate-100 rounded mb-4" />
                  <div className="pt-4 border-t border-slate-100 flex justify-between">
                    <div className="h-4 w-24 bg-slate-100 rounded" />
                    <div className="h-4 w-16 bg-slate-100 rounded" />
                  </div>
                </div>
              </Card>
            ))
          ) : displayContests.length > 0 ? (
            displayContests.map((contest) => (
              <Card key={contest.id} className="group cursor-pointer" onClick={() => navigate(`/contests/${contest.id}`)}>
                <div className="relative h-48 overflow-hidden">
                  <OptimizedImage
                    src={contest.image || `https://picsum.photos/seed/${contest.id}/600/400`}
                    alt={contest.title}
                    className="w-full h-full transition-transform duration-500 group-hover:scale-105"
                    lazy={true}
                  />
                  <div className="absolute top-3 left-3">
                    <Badge status={contest.status}>{contest.status}</Badge>
                  </div>
                </div>
                <div className="p-5">
                  <div className="text-xs font-semibold text-primary-600 mb-2 uppercase tracking-wide">
                    {contest.tags?.[0] || 'General'}
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-primary-600 transition-colors line-clamp-2">
                    {contest.title}
                  </h3>
                  <p className="text-sm text-slate-500 mb-4 line-clamp-2">
                    {contest.description || 'Tham gia để trải nghiệm và phát triển kỹ năng của bạn.'}
                  </p>
                  <div className="flex items-center justify-between text-sm text-slate-500 pt-4 border-t border-slate-100">
                    <span className="flex items-center">
                      <Calendar className="w-3 h-3 mr-1" />
                      {getRemainingDays(contest.deadline)}
                    </span>
                    <span className="font-medium text-slate-900">{formatPrice(contest.fee)}</span>
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <div className="md:col-span-3 text-center py-12 text-slate-500">
              Chưa có cuộc thi nào. Hãy quay lại sau!
            </div>
          )}
        </div>
        <div className="mt-6 sm:hidden">
          <Button variant="secondary" className="w-full" onClick={() => navigate('/contests')}>Xem tất cả</Button>
        </div>
      </section>

      {/* Featured Courses */}
      <section className="bg-slate-100 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                {isLoggedIn && isPersonalized ? 'Khóa học dành cho bạn' : 'Khóa học đề xuất'}
              </h2>
              <p className="text-slate-500 mt-1">
                {isLoggedIn && isPersonalized
                  ? 'Được gợi ý dựa trên kỹ năng và sở thích của bạn'
                  : 'Nâng cao kỹ năng với lộ trình bài bản'}
              </p>
            </div>
            <Button variant="ghost" className="hidden sm:flex" onClick={() => navigate('/marketplace')}>
              Xem Marketplace <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {isCoursesLoading ? (
              // Loading skeleton for courses
              [...Array(4)].map((_, i) => (
                <Card key={i} className="border-0 shadow-none animate-pulse">
                  <div className="aspect-video bg-slate-200 rounded-t-xl" />
                  <div className="p-4">
                    <div className="h-5 w-full bg-slate-200 rounded mb-2" />
                    <div className="h-3 w-24 bg-slate-100 rounded mb-3" />
                    <div className="h-4 w-20 bg-slate-100 rounded mb-3" />
                    <div className="flex justify-between">
                      <div className="h-5 w-20 bg-slate-200 rounded" />
                      <div className="h-5 w-16 bg-slate-100 rounded" />
                    </div>
                  </div>
                </Card>
              ))
            ) : displayCourses.length > 0 ? (
              displayCourses.map((course) => (
                <Card key={course.id} className="group cursor-pointer border-0 shadow-none hover:shadow-lg" onClick={() => navigate(`/courses/${course.id}`)}>
                  <div className="aspect-video overflow-hidden rounded-t-xl bg-slate-200">
                    <OptimizedImage
                      src={course.image || `https://picsum.photos/seed/${course.id}/400/250`}
                      alt={course.title}
                      className="w-full h-full"
                      lazy={true}
                    />
                  </div>
                  <div className="p-4">
                    <h4 className="font-bold text-slate-900 mb-1 line-clamp-1 group-hover:text-primary-600">
                      {course.title}
                    </h4>
                    <div className="text-xs text-slate-500 mb-2">Bởi {course.instructor}</div>
                    <div className="flex items-center mb-3">
                      <Star className="w-4 h-4 text-yellow-400 fill-current" />
                      <span className="text-sm font-medium ml-1">{course.rating?.toFixed(1) || '0.0'}</span>
                      <span className="text-xs text-slate-400 ml-1">({course.reviewsCount || 0})</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-primary-700">{formatPrice(course.price)}</span>
                      <Badge className="bg-slate-100 text-slate-600 border-0">{course.level}</Badge>
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              <div className="sm:col-span-2 md:col-span-4 text-center py-12 text-slate-500">
                Chưa có khóa học nào. Hãy quay lại sau!
              </div>
            )}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full text-center">
        <h2 className="text-2xl font-bold text-slate-900 mb-12">Quy trình tham gia</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { step: '01', title: 'Tạo tài khoản', desc: 'Đăng ký tài khoản miễn phí và cập nhật hồ sơ cá nhân.' },
            { step: '02', title: 'Chọn cuộc thi/khóa học', desc: 'Tìm kiếm và đăng ký tham gia các chương trình phù hợp.' },
            { step: '03', title: 'Phát triển & Nhận giải', desc: 'Học tập, thi đấu hết mình và nhận chứng nhận giá trị.' }
          ].map((item) => (
            <div key={item.step} className="relative p-6 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all">
              <div className="text-6xl font-black text-slate-100 absolute -top-4 -left-4 z-0 opacity-50 select-none">
                {item.step}
              </div>
              <div className="relative z-10">
                <h3 className="text-lg font-bold text-slate-900 mb-2">{item.title}</h3>
                <p className="text-slate-500 text-sm">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA - Only show when not logged in */}
      {!isLoggedIn && (
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="bg-primary-600 rounded-3xl p-8 md:p-16 text-center text-white relative overflow-hidden">
            <div className="relative z-10">
              <h2 className="text-3xl font-bold mb-4">Sẵn sàng để tỏa sáng?</h2>
              <p className="text-primary-100 mb-8 max-w-xl mx-auto">
                Gia nhập cộng đồng hơn 10.000 sinh viên tài năng và bắt đầu hành trình chinh phục tri thức ngay hôm nay.
              </p>
              <Button size="lg" className="bg-white text-primary-700 hover:bg-slate-50 border-0" onClick={() => navigate('/register')}>
                Đăng ký ngay
              </Button>
            </div>
            <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-10 rounded-full translate-y-1/2 -translate-x-1/2" />
          </div>
        </section>
      )}

    </div>
  );
};

export default Home;

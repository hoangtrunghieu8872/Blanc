import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Search, Star, BookOpen, Clock, PlayCircle, CheckCircle, Loader2, X, Phone, ExternalLink, Calendar, Copy, Check } from 'lucide-react';
import { Button, Card, Badge, Tabs } from '../components/ui/Common';
import { useCourses, useDebounce, useEnrolledCourses } from '../lib/hooks';
import { Course } from '../types';
import { api } from '../lib/api';
import OptimizedImage from '../components/OptimizedImage';
import Pagination from '../components/Pagination';
import Reviews from '../components/Reviews';

// Helper functions
const formatPrice = (price: number) => {
  if (price === 0) return 'Miễn phí';
  return price.toLocaleString('vi-VN') + 'đ';
};

const CATEGORIES = [
  { label: 'Tất cả', value: '' },
  { label: 'Lập trình', value: 'programming' },
  { label: 'Thiết kế', value: 'design' },
  { label: 'Data & AI', value: 'data' },
  { label: 'Marketing', value: 'marketing' },
];

const LEVEL_MAP: Record<string, string> = {
  'Beginner': 'Cơ bản',
  'Intermediate': 'Trung cấp',
  'Advanced': 'Nâng cao',
};

// Constants
const ITEMS_PER_PAGE = 6;

// --- MARKETPLACE LIST ---
const Marketplace: React.FC = () => {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState('');
  const [activeLevel, setActiveLevel] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const debouncedSearch = useDebounce(searchQuery, 300);

  // Fetch courses from database
  const { courses, isLoading, error, refetch } = useCourses({ limit: 50 });

  // Filter courses locally
  const filteredCourses = courses.filter(course => {
    // Search filter
    if (debouncedSearch) {
      const query = debouncedSearch.toLowerCase();
      const matchesSearch =
        course.title.toLowerCase().includes(query) ||
        course.instructor.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    // Level filter
    if (activeLevel && course.level !== activeLevel) {
      return false;
    }

    // Category filter (based on title keywords for now)
    if (activeCategory) {
      const titleLower = course.title.toLowerCase();
      switch (activeCategory) {
        case 'programming':
          if (!titleLower.match(/react|node|web|fullstack|python|java|code/i)) return false;
          break;
        case 'design':
          if (!titleLower.match(/ui|ux|design|figma|creative/i)) return false;
          break;
        case 'data':
          if (!titleLower.match(/data|ai|ml|machine|analysis|generative/i)) return false;
          break;
        case 'marketing':
          if (!titleLower.match(/marketing|seo|content|social/i)) return false;
          break;
      }
    }

    return true;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredCourses.length / ITEMS_PER_PAGE);

  // Get paginated courses
  const paginatedCourses = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredCourses.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredCourses, currentPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, activeCategory, activeLevel]);

  // Reset to page 1 if current page exceeds total pages
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-slate-900 mb-4">Thư viện khóa học</h1>
        <p className="text-slate-500 max-w-2xl mx-auto">
          Trau dồi kiến thức chuyên môn từ các chuyên gia hàng đầu. Lộ trình học tập được cá nhân hóa cho bạn.
        </p>
      </div>

      {/* Search */}
      <div className="max-w-md mx-auto mb-8">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Tìm khóa học, giảng viên..."
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

      {/* Categories */}
      <div className="flex flex-wrap justify-center gap-3 mb-6">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setActiveCategory(cat.value)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${activeCategory === cat.value
              ? 'bg-primary-600 text-white shadow-md'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Level filters */}
      <div className="flex flex-wrap justify-center gap-2 mb-10">
        <span className="text-sm text-slate-500 py-1">Trình độ:</span>
        <button
          onClick={() => setActiveLevel('')}
          className={`px-3 py-1 rounded text-sm transition-all ${!activeLevel ? 'bg-slate-200 text-slate-800' : 'text-slate-500 hover:bg-slate-100'
            }`}
        >
          Tất cả
        </button>
        {Object.entries(LEVEL_MAP).map(([level, label]) => (
          <button
            key={level}
            onClick={() => setActiveLevel(level)}
            className={`px-3 py-1 rounded text-sm transition-all ${activeLevel === level ? 'bg-slate-200 text-slate-800' : 'text-slate-500 hover:bg-slate-100'
              }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Results count */}
      <div className="text-center mb-6">
        <p className="text-sm text-slate-500">
          {isLoading ? 'Đang tải...' : `${filteredCourses.length} khóa học`}
        </p>
      </div>

      {/* Course Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {isLoading ? (
          // Loading skeleton
          [...Array(8)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="aspect-[4/3] bg-slate-200" />
              <div className="p-4">
                <div className="h-5 w-full bg-slate-200 rounded mb-2" />
                <div className="h-3 w-24 bg-slate-100 rounded mb-3" />
                <div className="h-4 w-20 bg-slate-100 rounded mb-3" />
                <div className="pt-3 border-t border-slate-100 flex justify-between">
                  <div className="h-5 w-20 bg-slate-200 rounded" />
                  <div className="h-5 w-16 bg-slate-100 rounded" />
                </div>
              </div>
            </Card>
          ))
        ) : error ? (
          <div className="col-span-full text-center py-12">
            <p className="text-red-500 mb-4">{error}</p>
            <Button onClick={refetch}>Thử lại</Button>
          </div>
        ) : filteredCourses.length > 0 ? (
          <>
            {paginatedCourses.map((course) => (
              <Card
                key={course.id}
                className="group cursor-pointer hover:-translate-y-1 transition-transform"
                onClick={() => navigate(`/courses/${course.id}`)}
              >
                <div className="aspect-[4/3] overflow-hidden bg-slate-200 relative">
                  <OptimizedImage
                    src={course.image || `https://picsum.photos/seed/${course.id}/400/300`}
                    alt={course.title}
                    className="w-full h-full"
                    lazy={true}
                  />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <PlayCircle className="w-12 h-12 text-white" />
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-slate-900 line-clamp-2 pr-2">{course.title}</h3>
                  </div>
                  <div className="text-xs text-slate-500 mb-3">{course.instructor}</div>
                  <div className="flex items-center gap-1 mb-3">
                    <span className="text-yellow-500 font-bold text-sm">{course.rating?.toFixed(1) || '0.0'}</span>
                    <div className="flex text-yellow-400 text-xs">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-3 h-3 ${i < Math.floor(course.rating || 0) ? 'fill-current' : ''}`}
                        />
                      ))}
                    </div>
                    <span className="text-slate-400 text-xs">({course.reviewsCount || 0})</span>
                  </div>
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-lg font-bold text-slate-900">{formatPrice(course.price)}</span>
                    <Badge className="bg-primary-50 text-primary-700 border-0">
                      {LEVEL_MAP[course.level] || course.level}
                    </Badge>
                  </div>
                </div>
              </Card>
            ))}

            {/* Pagination */}
            <div className="col-span-full">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          </>
        ) : (
          <div className="col-span-full text-center py-12">
            <BookOpen className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p className="text-slate-500 mb-2">Không tìm thấy khóa học nào</p>
            <p className="text-sm text-slate-400 mb-4">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
            <Button variant="secondary" onClick={() => {
              setActiveCategory('');
              setActiveLevel('');
              setSearchQuery('');
              setCurrentPage(1);
            }}>
              Xóa bộ lọc
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

// --- COURSE DETAIL ---
interface EnrollmentStatus {
  enrolled: boolean;
  enrollmentId?: string;
  status?: 'active' | 'completed';
  enrolledAt?: string;
  progress?: number;
}

const CourseDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Nội dung');
  const [course, setCourse] = useState<Course | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [copied, setCopied] = useState(false);
  const [enrollSuccess, setEnrollSuccess] = useState(false);

  // Enrollment status state
  const [enrollmentStatus, setEnrollmentStatus] = useState<EnrollmentStatus | null>(null);
  const [isCheckingEnrollment, setIsCheckingEnrollment] = useState(true);

  const { enrollCourse } = useEnrolledCourses({ autoFetch: false });

  // Fetch course details và enrollment status
  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      setIsLoading(true);
      setIsCheckingEnrollment(true);
      setError(null);

      try {
        // Fetch course details
        const courseData = await api.get<{ course: Course }>(`/courses/${id}`);
        setCourse(courseData.course);

        // Check enrollment status (có thể fail nếu chưa login - không sao)
        try {
          const statusData = await api.get<EnrollmentStatus>(`/courses/enrollment-status/${id}`);
          setEnrollmentStatus(statusData);
        } catch {
          // User chưa đăng nhập hoặc chưa enroll - set default
          setEnrollmentStatus({ enrolled: false });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không thể tải khóa học');
      } finally {
        setIsLoading(false);
        setIsCheckingEnrollment(false);
      }
    };
    fetchData();
  }, [id]);

  // Handle course enrollment
  const handleEnrollCourse = useCallback(async () => {
    if (!course || !id) return;

    setIsEnrolling(true);
    try {
      // 1. Đăng ký khóa học (lưu vào database)
      await enrollCourse(id);

      // 2. Cập nhật enrollment status ngay lập tức
      setEnrollmentStatus({
        enrolled: true,
        status: 'active',
        enrolledAt: new Date().toISOString(),
        progress: 0
      });

      setEnrollSuccess(true);

      // 3. Xử lý thông tin liên hệ
      if (course.contactInfo) {
        if (course.contactType === 'link') {
          // Chuyển hướng đến link đăng ký
          setTimeout(() => {
            window.open(course.contactInfo, '_blank', 'noopener,noreferrer');
          }, 500);
        } else if (course.contactType === 'phone') {
          // Copy số điện thoại
          try {
            await navigator.clipboard.writeText(course.contactInfo);
            setCopied(true);
            setTimeout(() => setCopied(false), 3000);
          } catch {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = course.contactInfo;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            setCopied(true);
            setTimeout(() => setCopied(false), 3000);
          }
        }
      }

      // Hide success message after 5 seconds
      setTimeout(() => {
        setEnrollSuccess(false);
      }, 5000);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Đăng ký thất bại';
      // Check if already enrolled
      if (errorMessage.includes('Already enrolled')) {
        // Refresh enrollment status
        setEnrollmentStatus({ enrolled: true, status: 'active' });
        alert('Bạn đã đăng ký khóa học này rồi!');
      } else {
        alert(errorMessage);
      }
    } finally {
      setIsEnrolling(false);
    }
  }, [course, id, enrollCourse]);

  // Copy phone number manually
  const handleCopyPhone = useCallback(async () => {
    if (!course?.contactInfo || course.contactType !== 'phone') return;
    try {
      await navigator.clipboard.writeText(course.contactInfo);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = course.contactInfo;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [course]);

  // Format price
  const formatPrice = (price: number) => {
    if (price === 0) return 'Miễn phí';
    return price.toLocaleString('vi-VN') + 'đ';
  };

  // Format date
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <p className="text-red-500 mb-4">{error || 'Không tìm thấy khóa học'}</p>
        <Button onClick={() => navigate('/marketplace')}>Quay lại</Button>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen pb-16">
      <div className="bg-slate-900 text-white py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row gap-8">
          <div className="flex-1">
            <div className="text-primary-400 font-semibold mb-2 text-sm tracking-wide uppercase">
              {course.level === 'Beginner' ? 'Cơ bản' : course.level === 'Intermediate' ? 'Trung cấp' : 'Nâng cao'}
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-4">{course.title}</h1>
            <p className="text-slate-300 text-lg mb-6 max-w-2xl">
              {course.description || 'Khóa học chất lượng cao từ các chuyên gia hàng đầu.'}
            </p>
            <div className="flex flex-wrap items-center gap-4 md:gap-6 text-sm text-slate-300">
              <span className="flex items-center">
                <Star className="w-4 h-4 text-yellow-400 fill-current mr-1" />
                {course.rating?.toFixed(1) || '0.0'} ({course.reviewsCount || 0} đánh giá)
              </span>
              {course.duration && (
                <span className="flex items-center">
                  <Clock className="w-4 h-4 mr-1" /> {course.duration}
                </span>
              )}
              {course.hoursPerWeek && (
                <span className="flex items-center">
                  <BookOpen className="w-4 h-4 mr-1" /> {course.hoursPerWeek} giờ/tuần
                </span>
              )}
            </div>
            {(course.startDate || course.endDate) && (
              <div className="mt-4 flex items-center gap-2 text-sm text-slate-400">
                <Calendar className="w-4 h-4" />
                <span>
                  Thời gian: {formatDate(course.startDate)} - {formatDate(course.endDate)}
                </span>
              </div>
            )}
            <div className="mt-8 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-700 overflow-hidden">
                <OptimizedImage
                  src={`https://picsum.photos/seed/${course.instructor}/100/100`}
                  alt={course.instructor}
                  className="w-full h-full"
                  lazy={false}
                />
              </div>
              <div>
                <div className="font-medium text-white">Giảng viên: {course.instructor}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <Tabs tabs={['Nội dung', 'Lợi ích', 'Đánh giá']} activeTab={activeTab} onChange={setActiveTab} />
            <div className="prose prose-slate max-w-none">
              {activeTab === 'Nội dung' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-slate-900">Giáo trình chi tiết</h3>
                  {course.description ? (
                    <div className="whitespace-pre-wrap text-slate-600">{course.description}</div>
                  ) : (
                    [1, 2, 3, 4].map((section) => (
                      <div key={section} className="border border-slate-200 rounded-lg overflow-hidden">
                        <div className="bg-slate-50 px-4 py-3 font-medium text-slate-700 flex justify-between cursor-pointer">
                          <span>Phần {section}: Kiến thức nền tảng</span>
                          <span className="text-xs text-slate-500 mt-1">5 bài học • 45 phút</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
              {activeTab === 'Lợi ích' && (
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <li className="flex items-start"><CheckCircle className="w-5 h-5 text-emerald-500 mr-2 shrink-0" /> <span>Kiến thức chuyên sâu</span></li>
                  <li className="flex items-start"><CheckCircle className="w-5 h-5 text-emerald-500 mr-2 shrink-0" /> <span>Xây dựng Portfolio xịn</span></li>
                  <li className="flex items-start"><CheckCircle className="w-5 h-5 text-emerald-500 mr-2 shrink-0" /> <span>Chứng chỉ hoàn thành</span></li>
                  <li className="flex items-start"><CheckCircle className="w-5 h-5 text-emerald-500 mr-2 shrink-0" /> <span>Hỗ trợ 24/7</span></li>
                </ul>
              )}
              {activeTab === 'Đánh giá' && (
                <Reviews
                  targetType="course"
                  targetId={id!}
                  targetTitle={course.title}
                  canReview={enrollmentStatus?.enrolled}
                  showTitle={true}
                />
              )}
            </div>
          </div>
        </div>

        <div className="relative">
          <Card className="p-6 sticky top-24 shadow-lg border-primary-100">
            {/* Course Image */}
            <div className="aspect-video rounded-lg overflow-hidden mb-4 bg-slate-100">
              <OptimizedImage
                src={course.image || `https://picsum.photos/seed/${course.id}/400/300`}
                alt={course.title}
                className="w-full h-full"
                lazy={false}
              />
            </div>

            {/* Price */}
            <div className="text-3xl font-bold text-slate-900 mb-2">{formatPrice(course.price)}</div>

            {/* Schedule Info */}
            {(course.startDate || course.duration) && (
              <div className="mb-4 p-3 bg-primary-50 rounded-lg">
                <div className="flex items-center gap-2 text-primary-700 text-sm font-medium mb-1">
                  <Calendar className="w-4 h-4" />
                  Lịch học dự kiến
                </div>
                {course.duration && (
                  <p className="text-sm text-slate-600">Thời lượng: {course.duration}</p>
                )}
                {course.hoursPerWeek && (
                  <p className="text-sm text-slate-600">{course.hoursPerWeek} giờ/tuần</p>
                )}
                {course.startDate && (
                  <p className="text-sm text-slate-600">
                    Bắt đầu: {formatDate(course.startDate)}
                  </p>
                )}
              </div>
            )}

            {/* Enroll Button - Hiển thị dựa trên trạng thái enrollment */}
            {isCheckingEnrollment ? (
              <Button className="w-full mb-3" size="lg" disabled>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Đang kiểm tra...
              </Button>
            ) : enrollmentStatus?.enrolled ? (
              // Đã đăng ký - hiển thị trạng thái
              <div className="mb-3">
                <div className="w-full p-3 bg-emerald-50 border border-emerald-200 rounded-lg mb-2">
                  <div className="flex items-center justify-center gap-2 text-emerald-700 font-medium">
                    <CheckCircle className="w-5 h-5" />
                    <span>Đã mua khóa học</span>
                  </div>
                  {enrollmentStatus.enrolledAt && (
                    <p className="text-xs text-emerald-600 mt-1">
                      Ngày đăng ký: {formatDate(enrollmentStatus.enrolledAt)}
                    </p>
                  )}
                  {typeof enrollmentStatus.progress === 'number' && (
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-slate-600 mb-1">
                        <span>Tiến độ học</span>
                        <span>{enrollmentStatus.progress}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div
                          className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${enrollmentStatus.progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                <Button
                  className="w-full"
                  variant="secondary"
                  onClick={() => navigate('/profile?tab=courses')}
                >
                  <BookOpen className="w-4 h-4 mr-2" />
                  Xem trong khóa học của tôi
                </Button>
              </div>
            ) : (
              // Chưa đăng ký - nút mua
              <Button
                className="w-full mb-3 shadow-md shadow-primary-200"
                size="lg"
                onClick={handleEnrollCourse}
                disabled={isEnrolling}
              >
                {isEnrolling ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Đang xử lý...
                  </>
                ) : enrollSuccess ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Đã đăng ký thành công!
                  </>
                ) : (
                  'Mua khóa học'
                )}
              </Button>
            )}

            {/* Success Message - Chỉ hiển thị khi vừa mua xong */}
            {enrollSuccess && !enrollmentStatus?.enrolled && (
              <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <p className="text-sm text-emerald-700 font-medium">
                  ✓ Đã mua khóa học thành công!
                </p>
                <p className="text-sm text-emerald-600 mt-1">
                  ✓ Khóa học đã được lưu vào tài khoản của bạn
                </p>
                {course.contactType === 'phone' && copied && (
                  <p className="text-sm text-emerald-600 mt-1">
                    ✓ Đã copy số điện thoại: {course.contactInfo}
                  </p>
                )}
                {course.contactType === 'link' && (
                  <p className="text-sm text-emerald-600 mt-1">
                    ✓ Đang chuyển hướng đến trang đăng ký...
                  </p>
                )}
              </div>
            )}

            {/* Contact Info Display */}
            {course.contactInfo && (
              <div className="mb-3">
                {course.contactType === 'phone' ? (
                  <button
                    onClick={handleCopyPhone}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-emerald-600">Đã copy!</span>
                      </>
                    ) : (
                      <>
                        <Phone className="w-4 h-4" />
                        <span>{course.contactInfo}</span>
                        <Copy className="w-4 h-4 text-slate-400" />
                      </>
                    )}
                  </button>
                ) : course.contactType === 'link' ? (
                  <a
                    href={course.contactInfo}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Xem trang đăng ký</span>
                  </a>
                ) : null}
              </div>
            )}

            <Button variant="secondary" className="w-full" onClick={() => navigate('/marketplace')}>
              Quay lại danh sách
            </Button>

            <div className="mt-4 text-center text-xs text-slate-500">
              Hoàn tiền trong 30 ngày nếu không hài lòng
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export { Marketplace, CourseDetail };
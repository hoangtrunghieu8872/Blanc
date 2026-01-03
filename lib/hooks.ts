import { useState, useEffect, useCallback, useRef } from 'react';
import { api, CACHE_TTL } from './api';
import { Contest, Course, Document, ScheduleEvent, WorkloadAnalysis, UserRegistration } from '../types';
import { StreakData, checkin, getStreak, clearStreakCache, refreshStreak } from '../services/streakService';
import { getVietnamDate, VIETNAM_OFFSET_MS } from '../services/streakTime';

// ============ DEBOUNCE UTILITY ============
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

// ============ SEARCH HOOK ============
interface SearchResult {
  contests: Array<Contest & { type: 'contest' }>;
  courses: Array<Course & { type: 'course' }>;
  total: number;
}

interface UseSearchOptions {
  debounceMs?: number;
  minChars?: number;
  type?: 'contests' | 'courses';
  limit?: number;
}

export function useSearch(options: UseSearchOptions = {}) {
  const { debounceMs = 300, minChars = 2, type, limit = 10 } = options;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult>({ contests: [], courses: [], total: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedQuery = useDebounce(query, debounceMs);

  useEffect(() => {
    const search = async () => {
      if (debouncedQuery.length < minChars) {
        setResults({ contests: [], courses: [], total: 0 });
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          q: debouncedQuery,
          limit: limit.toString(),
        });
        if (type) params.append('type', type);

        const data = await api.get<SearchResult>(`/search?${params}`);
        setResults(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed');
        setResults({ contests: [], courses: [], total: 0 });
      } finally {
        setIsLoading(false);
      }
    };

    search();
  }, [debouncedQuery, minChars, type, limit]);

  const clearSearch = useCallback(() => {
    setQuery('');
    setResults({ contests: [], courses: [], total: 0 });
  }, []);

  return {
    query,
    setQuery,
    results,
    isLoading,
    error,
    clearSearch,
    hasResults: results.total > 0,
  };
}

// ============ STATS HOOK ============
interface Stats {
  users: number;
  contests: number;
  courses: number;
  formatted: {
    users: string;
    contests: string;
    courses: string;
  };
}

export function useStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    // Prevent double fetch in StrictMode
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const fetchStats = async () => {
      try {
        // Use cached API call
        const data = await api.get<Stats>('/stats', {
          useCache: true,
          cacheTTL: CACHE_TTL.STATS
        });
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load stats');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  return { stats, isLoading, error };
}

// ============ CONTESTS HOOK ============
interface ContestsResponse {
  contests: Contest[];
}

interface UseContestsOptions {
  limit?: number;
  tag?: string;
  autoFetch?: boolean;
}

export function useContests(options: UseContestsOptions = {}) {
  const { limit = 10, tag, autoFetch = true } = options;

  const [contests, setContests] = useState<Contest[]>([]);
  const [isLoading, setIsLoading] = useState(autoFetch);
  const [error, setError] = useState<string | null>(null);

  const fetchContests = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ limit: limit.toString() });
      if (tag) params.append('tag', tag);

      // Use cached API call
      const data = await api.get<ContestsResponse>(`/contests?${params}`, {
        useCache: true,
        cacheTTL: CACHE_TTL.CONTESTS
      });
      setContests(data.contests);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contests');
    } finally {
      setIsLoading(false);
    }
  }, [limit, tag]);

  useEffect(() => {
    if (autoFetch) {
      fetchContests();
    }
  }, [autoFetch, fetchContests]);

  return { contests, isLoading, error, refetch: fetchContests };
}

// ============ COURSES HOOK ============
interface CoursesResponse {
  courses: Course[];
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

interface UseCoursesOptions {
  limit?: number;
  page?: number;
  level?: 'Beginner' | 'Intermediate' | 'Advanced';
  search?: string;
  instructor?: string;
  minPrice?: number;
  maxPrice?: number;
  isPublic?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  autoFetch?: boolean;
}

export function useCourses(options: UseCoursesOptions = {}) {
  const {
    limit = 10,
    page = 1,
    level,
    search,
    instructor,
    minPrice,
    maxPrice,
    isPublic,
    sortBy,
    sortOrder,
    autoFetch = true,
  } = options;

  const [courses, setCourses] = useState<Course[]>([]);
  const [meta, setMeta] = useState<{ total: number; page: number; limit: number; totalPages: number }>({
    total: 0,
    page,
    limit,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(autoFetch);
  const [error, setError] = useState<string | null>(null);

  const fetchCourses = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ limit: limit.toString(), page: page.toString() });
      if (level) params.append('level', level);
      if (search) params.append('search', search);
      if (instructor) params.append('instructor', instructor);
      if (minPrice !== undefined) params.append('minPrice', String(minPrice));
      if (maxPrice !== undefined) params.append('maxPrice', String(maxPrice));
      if (isPublic !== undefined) params.append('isPublic', String(isPublic));
      if (sortBy) params.append('sortBy', sortBy);
      if (sortOrder) params.append('sortOrder', sortOrder);

      // Use cached API call
      const data = await api.get<CoursesResponse>(`/courses?${params}`, {
        useCache: true,
        cacheTTL: CACHE_TTL.COURSES
      });
      setCourses(data.courses);
      setMeta({
        total: data.total ?? 0,
        page: data.page ?? page,
        limit: data.limit ?? limit,
        totalPages: data.totalPages ?? 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load courses');
    } finally {
      setIsLoading(false);
    }
  }, [instructor, isPublic, level, limit, maxPrice, minPrice, page, search, sortBy, sortOrder]);

  useEffect(() => {
    if (autoFetch) {
      fetchCourses();
    }
  }, [autoFetch, fetchCourses]);

  return { courses, meta, isLoading, error, refetch: fetchCourses };
}

// ============ DOCUMENTS HOOK ============
interface DocumentsResponse {
  documents: Document[];
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

interface UseDocumentsOptions {
  limit?: number;
  page?: number;
  category?: string;
  field?: string;
  search?: string;
  author?: string;
  isPublic?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  autoFetch?: boolean;
}

export function useDocuments(options: UseDocumentsOptions = {}) {
  const {
    limit = 20,
    page = 1,
    category,
    field,
    search,
    author,
    isPublic,
    sortBy,
    sortOrder,
    autoFetch = true,
  } = options;

  const [documents, setDocuments] = useState<Document[]>([]);
  const [meta, setMeta] = useState<{ total: number; page: number; limit: number; totalPages: number }>({
    total: 0,
    page,
    limit,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(autoFetch);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        page: page.toString(),
      });
      if (category) params.append('category', category);
      if (field) params.append('field', field);
      if (search) params.append('search', search);
      if (author) params.append('author', author);
      if (isPublic !== undefined) params.append('isPublic', String(isPublic));
      if (sortBy) params.append('sortBy', sortBy);
      if (sortOrder) params.append('sortOrder', sortOrder);

      const data = await api.get<DocumentsResponse>(`/documents?${params}`, {
        useCache: true,
        cacheTTL: CACHE_TTL.DOCUMENTS,
      });

      setDocuments(data.documents || []);
      setMeta({
        total: data.total ?? 0,
        page: data.page ?? page,
        limit: data.limit ?? limit,
        totalPages: data.totalPages ?? 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  }, [author, category, field, isPublic, limit, page, search, sortBy, sortOrder]);

  useEffect(() => {
    if (autoFetch) {
      fetchDocuments();
    }
  }, [autoFetch, fetchDocuments]);

  return { documents, meta, isLoading, error, refetch: fetchDocuments };
}

// ============ USER SCHEDULE HOOK ============
interface ScheduleResponse {
  schedule: ScheduleEvent[];
  totalActive: number;
}

interface UseUserScheduleOptions {
  startDate?: Date;
  endDate?: Date;
  autoFetch?: boolean;
}

export function useUserSchedule(options: UseUserScheduleOptions = {}) {
  const { autoFetch = true } = options;

  const [schedule, setSchedule] = useState<ScheduleEvent[]>([]);
  const [totalActive, setTotalActive] = useState(0);
  const [isLoading, setIsLoading] = useState(autoFetch);
  const [error, setError] = useState<string | null>(null);

  const fetchSchedule = useCallback(async (startDate?: Date, endDate?: Date) => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate.toISOString());
      if (endDate) params.append('endDate', endDate.toISOString());

      const data = await api.get<ScheduleResponse>(`/registrations/schedule?${params}`);
      setSchedule(data.schedule);
      setTotalActive(data.totalActive);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải lịch thi đấu');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoFetch) {
      fetchSchedule(options.startDate, options.endDate);
    }
  }, [autoFetch, fetchSchedule, options.startDate, options.endDate]);

  return { schedule, totalActive, isLoading, error, refetch: fetchSchedule };
}

// ============ WORKLOAD ANALYSIS HOOK ============
export function useWorkloadAnalysis(autoFetch = true) {
  const [analysis, setAnalysis] = useState<WorkloadAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(autoFetch);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  const fetchAnalysis = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await api.get<WorkloadAnalysis>('/registrations/workload');
      setAnalysis(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải phân tích workload');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoFetch && !fetchedRef.current) {
      fetchedRef.current = true;
      fetchAnalysis();
    }
  }, [autoFetch, fetchAnalysis]);

  return { analysis, isLoading, error, refetch: fetchAnalysis };
}

// ============ USER REGISTRATIONS HOOK ============
interface RegistrationsResponse {
  registrations: UserRegistration[];
  pagination: {
    page: number;
    limit: number;
    hasMore: boolean;
  };
}

interface UseUserRegistrationsOptions {
  page?: number;
  limit?: number;
  autoFetch?: boolean;
}

export function useUserRegistrations(options: UseUserRegistrationsOptions = {}) {
  const { page = 1, limit = 20, autoFetch = true } = options;

  const [registrations, setRegistrations] = useState<UserRegistration[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, hasMore: false });
  const [isLoading, setIsLoading] = useState(autoFetch);
  const [error, setError] = useState<string | null>(null);

  const fetchRegistrations = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });

      const data = await api.get<RegistrationsResponse>(`/registrations?${params}`);
      setRegistrations(data.registrations);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải danh sách đăng ký');
    } finally {
      setIsLoading(false);
    }
  }, [page, limit]);

  useEffect(() => {
    if (autoFetch) {
      fetchRegistrations();
    }
  }, [autoFetch, fetchRegistrations]);

  // Register for a contest
  const registerForContest = useCallback(async (contestId: string) => {
    try {
      const result = await api.post<{ id: string; message: string; warning?: string }>('/registrations', { contestId });
      await fetchRegistrations(); // Refresh list
      return result;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Đăng ký thất bại');
    }
  }, [fetchRegistrations]);

  // Cancel registration
  const cancelRegistration = useCallback(async (contestId: string) => {
    try {
      await api.delete(`/registrations/${contestId}`);
      await fetchRegistrations(); // Refresh list
    } catch (err) {
      throw err instanceof Error ? err : new Error('Hủy đăng ký thất bại');
    }
  }, [fetchRegistrations]);

  return {
    registrations,
    pagination,
    isLoading,
    error,
    refetch: fetchRegistrations,
    registerForContest,
    cancelRegistration
  };
}

// Re-export debounce for general use
export { useDebounce };

// ============ USER STREAK HOOK ============

interface UseStreakOptions {
  autoCheckin?: boolean; // Auto check-in on mount
  userId?: string; // User ID for cache isolation
}

export function useStreak(options: UseStreakOptions = {}) {
  const { autoCheckin = true, userId } = options;

  const [streak, setStreak] = useState<StreakData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const lastAutoCheckinKeyRef = useRef<string | null>(null);
  const midnightTimerRef = useRef<number | null>(null);

  const buildStreakKey = useCallback((base: string, keyUserId?: string) => {
    return keyUserId ? `${base}_${keyUserId}` : base;
  }, []);

  const msUntilNextVietnamMidnight = useCallback(() => {
    const oneDayMs = 24 * 60 * 60 * 1000;
    const nowMs = Date.now();
    const vnNowMs = nowMs + VIETNAM_OFFSET_MS;
    const vnDate = new Date(vnNowMs);
    vnDate.setUTCHours(0, 0, 0, 0);
    const nextVnMidnightMs = vnDate.getTime() + oneDayMs;
    return Math.max(0, nextVnMidnightMs - vnNowMs);
  }, []);

  // Fetch streak data (uses localStorage cache - 24h TTL)
  const fetchStreak = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await getStreak(userId);
      setStreak(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải dữ liệu streak');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Force refresh from database (bypasses cache)
  const forceRefresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await refreshStreak(userId);
      setStreak(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải dữ liệu streak');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Check-in for today
  const doCheckin = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await checkin(userId);
      setStreak({
        currentStreak: response.currentStreak,
        longestStreak: response.longestStreak,
        lastActivityDate: response.lastActivityDate ?? new Date().toISOString(),
        todayCheckedIn: response.todayCheckedIn
      });
      setMessage(response.message);
      return response;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check-in thất bại');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const maybeAutoCheckin = useCallback(async () => {
    if (!autoCheckin) return;

    const today = getVietnamDate();
    const autoKey = `${userId ?? 'anon'}:${today}`;
    if (lastAutoCheckinKeyRef.current === autoKey) return;

    // If we already checked in today (in localStorage), don't spam check-in calls on focus.
    // Still fetch once if we don't have data yet so the badge is populated.
    try {
      const lastCheckin = localStorage.getItem(buildStreakKey('streak_last_checkin', userId));
      if (lastCheckin === today) {
        lastAutoCheckinKeyRef.current = autoKey;
        if (!streak) {
          fetchStreak();
        }
        return;
      }
    } catch {
      // ignore storage errors and fall back to API
    }

    lastAutoCheckinKeyRef.current = autoKey;
    try {
      await doCheckin();
    } catch {
      lastAutoCheckinKeyRef.current = null;
      fetchStreak();
    }
  }, [autoCheckin, buildStreakKey, doCheckin, fetchStreak, streak, userId]);

  // Auto check-in on mount (autoCheckin = true)
  useEffect(() => {
    if (!autoCheckin) return;
    maybeAutoCheckin();
  }, [autoCheckin, maybeAutoCheckin]);

  // Load streak once when autoCheckin is disabled
  useEffect(() => {
    if (autoCheckin) return;
    fetchStreak();
  }, [autoCheckin, fetchStreak]);

  // Keep streak accurate when the app stays open across days
  useEffect(() => {
    if (!autoCheckin) return;

    const onFocus = () => {
      maybeAutoCheckin();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        maybeAutoCheckin();
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    const scheduleMidnight = () => {
      if (midnightTimerRef.current) {
        window.clearTimeout(midnightTimerRef.current);
        midnightTimerRef.current = null;
      }

      // Run a check shortly after Vietnam midnight to refresh/check-in for the new day
      const delayMs = msUntilNextVietnamMidnight() + 1000;
      midnightTimerRef.current = window.setTimeout(() => {
        if (document.visibilityState === 'visible') {
          maybeAutoCheckin();
        }
        scheduleMidnight();
      }, delayMs);
    };

    scheduleMidnight();

    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (midnightTimerRef.current) {
        window.clearTimeout(midnightTimerRef.current);
        midnightTimerRef.current = null;
      }
    };
  }, [autoCheckin, maybeAutoCheckin, msUntilNextVietnamMidnight]);

  // Clear message after 5 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  return {
    streak,
    currentStreak: streak?.currentStreak || 0,
    longestStreak: streak?.longestStreak || 0,
    todayCheckedIn: streak?.todayCheckedIn || false,
    isLoading,
    error,
    message,
    refetch: fetchStreak,
    forceRefresh, // Force refresh from database (bypasses 24h cache)
    checkin: doCheckin,
    clearCache: clearStreakCache
  };
}

// ============ USER NOTIFICATIONS HOOK ============
import { Notification } from '../types';

interface NotificationsResponse {
  notifications: Notification[];
  total: number;
}

interface UseUserNotificationsOptions {
  limit?: number;
  autoFetch?: boolean;
}

export function useUserNotifications(options: UseUserNotificationsOptions = {}) {
  const { limit = 20, autoFetch = true } = options;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(autoFetch);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ limit: limit.toString() });
      const data = await api.get<NotificationsResponse>(`/users/me/notifications-history?${params}`);
      setNotifications(data.notifications);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải thông báo');
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    if (autoFetch) {
      fetchNotifications();
    }
  }, [autoFetch, fetchNotifications]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return {
    notifications,
    total,
    unreadCount,
    isLoading,
    error,
    refetch: fetchNotifications,
  };
}

// ============ USER ENROLLED COURSES HOOK ============
import { CourseEnrollment } from '../types';

interface EnrolledCoursesResponse {
  enrollments: CourseEnrollment[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface UseEnrolledCoursesOptions {
  limit?: number;
  status?: 'active' | 'completed' | 'all';
  autoFetch?: boolean;
}

export function useEnrolledCourses(options: UseEnrolledCoursesOptions = {}) {
  const { limit = 10, status = 'all', autoFetch = true } = options;

  const [enrollments, setEnrollments] = useState<CourseEnrollment[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(autoFetch);
  const [error, setError] = useState<string | null>(null);

  const fetchEnrollments = useCallback(async (page = 1) => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        status
      });
      const data = await api.get<EnrolledCoursesResponse>(`/courses/enrolled?${params}`);
      setEnrollments(data.enrollments);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải khóa học');
    } finally {
      setIsLoading(false);
    }
  }, [limit, status]);

  useEffect(() => {
    if (autoFetch) {
      fetchEnrollments();
    }
  }, [autoFetch, fetchEnrollments]);

  // Enroll in a course
  const enrollCourse = useCallback(async (courseId: string) => {
    try {
      await api.post(`/courses/enroll/${courseId}`);
      await fetchEnrollments(); // Refresh list
    } catch (err) {
      throw err instanceof Error ? err : new Error('Đăng ký khóa học thất bại');
    }
  }, [fetchEnrollments]);

  // Update progress
  const updateProgress = useCallback(async (enrollmentId: string, progress: number, completedLessonId?: string) => {
    try {
      await api.patch(`/courses/enrolled/${enrollmentId}/progress`, {
        progress,
        completedLessonId
      });
      await fetchEnrollments(); // Refresh to get updated progress
    } catch (err) {
      throw err instanceof Error ? err : new Error('Cập nhật tiến độ thất bại');
    }
  }, [fetchEnrollments]);

  // Unenroll from course
  const unenrollCourse = useCallback(async (enrollmentId: string) => {
    try {
      await api.delete(`/courses/enrolled/${enrollmentId}`);
      await fetchEnrollments(); // Refresh list
    } catch (err) {
      throw err instanceof Error ? err : new Error('Hủy đăng ký thất bại');
    }
  }, [fetchEnrollments]);

  // Stats
  const activeCount = enrollments.filter(e => e.status === 'active').length;
  const completedCount = enrollments.filter(e => e.status === 'completed').length;
  const avgProgress = enrollments.length > 0
    ? Math.round(enrollments.reduce((sum, e) => sum + (e.progress || 0), 0) / enrollments.length)
    : 0;

  return {
    enrollments,
    pagination,
    isLoading,
    error,
    activeCount,
    completedCount,
    avgProgress,
    refetch: fetchEnrollments,
    enrollCourse,
    updateProgress,
    unenrollCourse
  };
}

// ============ RECOMMENDED CONTENT HOOK (for Homepage) ============

interface RecommendedContentResponse {
  success: boolean;
  contests: Contest[];
  courses: Course[];
  meta: {
    personalized: boolean;
    cached: boolean;
    cacheTTL: string;
  };
}

interface UseRecommendedContentOptions {
  contestLimit?: number;
  courseLimit?: number;
  autoFetch?: boolean;
}

/**
 * Hook to get personalized contest and course recommendations
 * Based on user's profile, skills, and interests
 * Falls back to regular contests/courses if not logged in or API fails
 */
export function useRecommendedContent(options: UseRecommendedContentOptions = {}) {
  const { contestLimit = 3, courseLimit = 3, autoFetch = true } = options;

  const [contests, setContests] = useState<Contest[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(autoFetch);
  const [error, setError] = useState<string | null>(null);
  const [isPersonalized, setIsPersonalized] = useState(false);
  const fetchedRef = useRef(false);

  const fetchRecommendations = useCallback(async () => {
    // Check if user is logged in
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      setIsPersonalized(false);
      setIsLoading(false);
      return { contests: [], courses: [], isPersonalized: false };
    }

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        contestLimit: contestLimit.toString(),
        courseLimit: courseLimit.toString()
      });

      const data = await api.get<RecommendedContentResponse>(
        `/matching/content-recommendations?${params}`
      );

      setContests(data.contests);
      setCourses(data.courses);
      setIsPersonalized(data.meta?.personalized || false);

      return { contests: data.contests, courses: data.courses, isPersonalized: true };
    } catch (err) {
      // Silently fail and let fallback logic handle it
      console.warn('Failed to fetch recommendations, will use fallback:', err);
      setError(err instanceof Error ? err.message : 'Không thể tải gợi ý');
      setIsPersonalized(false);
      return { contests: [], courses: [], isPersonalized: false };
    } finally {
      setIsLoading(false);
    }
  }, [contestLimit, courseLimit]);

  useEffect(() => {
    if (autoFetch && !fetchedRef.current) {
      fetchedRef.current = true;
      fetchRecommendations();
    }
  }, [autoFetch, fetchRecommendations]);

  return {
    contests,
    courses,
    isLoading,
    error,
    isPersonalized,
    refetch: fetchRecommendations,
    hasRecommendations: contests.length > 0 || courses.length > 0
  };
}

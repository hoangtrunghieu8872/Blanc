import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Calendar as CalendarIcon, Trophy, BookOpen, Clock, Settings, LogOut, ChevronRight, Loader2, Play, CheckCircle2, BarChart3, Trash2, Flame } from 'lucide-react';
import { Button, Card, Badge, Input, Tabs } from '../components/ui/Common';
import ScheduleCalendar from '../components/ScheduleCalendar';
import WorkloadWarningCard from '../components/WorkloadWarningCard';
import UserSettings from '../components/UserSettings';
import { ScheduleEvent, User, CourseEnrollment } from '../types';
import { useUserRegistrations, useWorkloadAnalysis, useEnrolledCourses, useStreak } from '../lib/hooks';

type TabType = 'overview' | 'schedule' | 'courses' | 'settings';

// Helper to get user from localStorage
function getStoredUser(): User | null {
   try {
      const token = localStorage.getItem('auth_token');
      const userStr = localStorage.getItem('user');
      if (token && userStr) {
         return JSON.parse(userStr);
      }
   } catch {
      return null;
   }
   return null;
}

const Profile: React.FC = () => {
   const navigate = useNavigate();
   const [searchParams] = useSearchParams();
   const tabFromUrl = searchParams.get('tab') as TabType | null;
   const [activeTab, setActiveTab] = useState<TabType>(tabFromUrl && ['overview', 'schedule', 'courses', 'settings'].includes(tabFromUrl) ? tabFromUrl : 'overview');
   const [currentUser, setCurrentUser] = useState<User | null>(() => getStoredUser());
   const [isInitialized, setIsInitialized] = useState(false);

   // Update tab when URL changes
   useEffect(() => {
      if (tabFromUrl && ['overview', 'schedule', 'courses', 'settings'].includes(tabFromUrl)) {
         setActiveTab(tabFromUrl);
      }
   }, [tabFromUrl]);

   // Listen for auth changes (avatar updates, profile changes)
   useEffect(() => {
      const handleAuthChange = () => {
         setCurrentUser(getStoredUser());
      };
      window.addEventListener('auth-change', handleAuthChange);
      window.addEventListener('storage', handleAuthChange);

      // Mark as initialized after first render
      setIsInitialized(true);

      return () => {
         window.removeEventListener('auth-change', handleAuthChange);
         window.removeEventListener('storage', handleAuthChange);
      };
   }, []);

   // Redirect to login if not authenticated (only after initialization)
   useEffect(() => {
      if (isInitialized && !currentUser) {
         navigate('/login');
      }
   }, [currentUser, navigate, isInitialized]);

   // Fetch user data - only when user is authenticated
   const { registrations, isLoading: registrationsLoading, error: registrationsError } = useUserRegistrations({ limit: 5, autoFetch: !!currentUser });
   const { analysis, error: analysisError } = useWorkloadAnalysis(!!currentUser);
   const {
      enrollments,
      isLoading: coursesLoading,
      activeCount,
      completedCount,
      avgProgress,
      unenrollCourse,
      refetch: refetchCourses,
      error: coursesError
   } = useEnrolledCourses({ status: 'all', autoFetch: !!currentUser });

   // Streak data - auto check-in on page load
   const {
      currentStreak,
      longestStreak,
      todayCheckedIn,
      isLoading: streakLoading,
      message: streakMessage
   } = useStreak({ autoCheckin: !!currentUser });

   // Show loading while initializing or if no user
   if (!isInitialized || !currentUser) {
      return (
         <div className="flex flex-col justify-center items-center min-h-[60vh] bg-slate-50">
            <Loader2 className="w-10 h-10 animate-spin text-primary-600 mb-4" />
            <p className="text-slate-500 text-sm">Đang tải thông tin...</p>
         </div>
      );
   }

   // Show error state if there are critical errors
   const hasCriticalError = registrationsError || analysisError || coursesError;
   if (hasCriticalError && !registrationsLoading && !coursesLoading) {
      console.error('Profile errors:', { registrationsError, analysisError, coursesError });
   }

   // Handle calendar event click
   const handleEventClick = (event: ScheduleEvent) => {
      navigate(`/contests/${event.id}`);
   };

   // Handle unenroll with confirmation
   const handleUnenroll = async (enrollmentId: string, courseTitle: string) => {
      if (window.confirm(`Bạn có chắc muốn hủy đăng ký khóa học "${courseTitle}"?`)) {
         try {
            await unenrollCourse(enrollmentId);
         } catch (err) {
            alert(err instanceof Error ? err.message : 'Có lỗi xảy ra');
         }
      }
   };

   // Get level badge color
   const getLevelColor = (level: string) => {
      switch (level?.toLowerCase()) {
         case 'beginner': return 'bg-green-50 text-green-700 border-green-100';
         case 'intermediate': return 'bg-yellow-50 text-yellow-700 border-yellow-100';
         case 'advanced': return 'bg-red-50 text-red-700 border-red-100';
         default: return 'bg-slate-50 text-slate-700 border-slate-100';
      }
   };

   // Get progress bar color
   const getProgressColor = (progress: number) => {
      if (progress >= 80) return 'bg-green-500';
      if (progress >= 50) return 'bg-primary-500';
      if (progress >= 25) return 'bg-yellow-500';
      return 'bg-slate-300';
   };

   // Tab content renderer
   const renderTabContent = () => {
      switch (activeTab) {
         case 'schedule':
            return (
               <div className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                     <ScheduleCalendar onEventClick={handleEventClick} />
                     <WorkloadWarningCard />
                  </div>

                  {/* Registered Contests List */}
                  <Card className="p-6">
                     <h3 className="font-bold text-slate-900 mb-4 flex items-center">
                        <Trophy className="w-5 h-5 mr-2 text-primary-600" /> Cuộc thi đã đăng ký
                     </h3>
                     {registrationsLoading ? (
                        <div className="flex justify-center py-8">
                           <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                        </div>
                     ) : registrations.length > 0 ? (
                        <div className="space-y-3">
                           {registrations.map(reg => reg.contest && (
                              <div
                                 key={reg.id}
                                 onClick={() => navigate(`/contests/${reg.contestId}`)}
                                 className="flex items-center p-3 rounded-lg hover:bg-slate-50 border border-slate-100 transition-colors cursor-pointer"
                              >
                                 <div className="w-12 h-12 rounded-lg bg-slate-200 shrink-0 overflow-hidden mr-4">
                                    <img
                                       src={reg.contest.image || `https://picsum.photos/seed/${reg.contestId}/100/100`}
                                       alt={reg.contest.title}
                                       className="w-full h-full object-cover"
                                    />
                                 </div>
                                 <div className="grow min-w-0">
                                    <h4 className="font-semibold text-slate-900 truncate">{reg.contest.title}</h4>
                                    <p className="text-xs text-slate-500">
                                       {new Date(reg.contest.dateStart).toLocaleDateString('vi-VN')} - {reg.contest.organizer}
                                    </p>
                                 </div>
                                 <Badge status={reg.contest.status as 'OPEN' | 'FULL' | 'CLOSED'} className="ml-2">
                                    {reg.contest.status}
                                 </Badge>
                                 <ChevronRight className="w-4 h-4 text-slate-400 ml-2" />
                              </div>
                           ))}
                        </div>
                     ) : (
                        <div className="text-center py-8 text-slate-500">
                           <Trophy className="w-12 h-12 mx-auto mb-2 opacity-50" />
                           <p>Bạn chưa đăng ký cuộc thi nào</p>
                           <Button className="mt-4" onClick={() => navigate('/contests')}>
                              Khám phá cuộc thi
                           </Button>
                        </div>
                     )}
                  </Card>
               </div>
            );

         case 'courses':
            return (
               <div className="space-y-6">
                  {/* Course Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <Card className="p-4 flex items-center space-x-4">
                        <div className="p-3 bg-primary-100 text-primary-600 rounded-lg">
                           <Play className="w-6 h-6" />
                        </div>
                        <div>
                           <div className="text-2xl font-bold text-slate-900">{activeCount}</div>
                           <div className="text-xs text-slate-500">Đang học</div>
                        </div>
                     </Card>
                     <Card className="p-4 flex items-center space-x-4">
                        <div className="p-3 bg-green-100 text-green-600 rounded-lg">
                           <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <div>
                           <div className="text-2xl font-bold text-slate-900">{completedCount}</div>
                           <div className="text-xs text-slate-500">Đã hoàn thành</div>
                        </div>
                     </Card>
                     <Card className="p-4 flex items-center space-x-4">
                        <div className="p-3 bg-amber-100 text-amber-600 rounded-lg">
                           <BarChart3 className="w-6 h-6" />
                        </div>
                        <div>
                           <div className="text-2xl font-bold text-slate-900">{avgProgress}%</div>
                           <div className="text-xs text-slate-500">Tiến độ trung bình</div>
                        </div>
                     </Card>
                  </div>

                  {/* Course List */}
                  <Card className="p-6">
                     <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-slate-900 flex items-center">
                           <BookOpen className="w-5 h-5 mr-2 text-primary-600" />
                           Khóa học của tôi
                        </h3>
                        <Button variant="secondary" size="sm" onClick={() => navigate('/marketplace')}>
                           Khám phá thêm
                        </Button>
                     </div>

                     {coursesLoading ? (
                        <div className="flex justify-center py-12">
                           <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
                        </div>
                     ) : enrollments.length > 0 ? (
                        <div className="space-y-4">
                           {enrollments.map(enrollment => enrollment.course && (
                              <div
                                 key={enrollment.id}
                                 className="flex items-start p-4 rounded-xl border border-slate-200 hover:border-primary-300 hover:shadow-md transition-all group"
                              >
                                 {/* Course Image */}
                                 <div className="w-24 h-16 rounded-lg bg-slate-200 shrink-0 overflow-hidden mr-4">
                                    <img
                                       src={enrollment.course.image || `https://picsum.photos/seed/${enrollment.courseId}/200/150`}
                                       alt={enrollment.course.title}
                                       className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                    />
                                 </div>

                                 {/* Course Info */}
                                 <div className="grow min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                       <div className="min-w-0">
                                          <h4 className="font-semibold text-slate-900 line-clamp-1 group-hover:text-primary-600 transition-colors">
                                             {enrollment.course.title}
                                          </h4>
                                          <p className="text-sm text-slate-500 mt-0.5">
                                             {enrollment.course.instructor}
                                          </p>
                                       </div>
                                       <div className="flex items-center gap-2 shrink-0">
                                          <Badge className={getLevelColor(enrollment.course.level)}>
                                             {enrollment.course.level}
                                          </Badge>
                                          {enrollment.status === 'completed' && (
                                             <Badge className="bg-green-50 text-green-700 border-green-100">
                                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                                Hoàn thành
                                             </Badge>
                                          )}
                                       </div>
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="mt-3">
                                       <div className="flex items-center justify-between text-xs mb-1.5">
                                          <span className="text-slate-500">
                                             {enrollment.completedLessons?.length || 0} / {enrollment.course.lessonsCount || '?'} bài học
                                          </span>
                                          <span className="font-semibold text-slate-700">{enrollment.progress || 0}%</span>
                                       </div>
                                       <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                          <div
                                             className={`h-2 rounded-full transition-all ${getProgressColor(enrollment.progress || 0)}`}
                                             data-progress={enrollment.progress || 0}
                                             ref={(el) => { if (el) el.style.width = `${enrollment.progress || 0}%`; }}
                                          />
                                       </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                                       <span className="text-xs text-slate-400">
                                          {enrollment.lastAccessedAt
                                             ? `Truy cập: ${new Date(enrollment.lastAccessedAt).toLocaleDateString('vi-VN')}`
                                             : `Đăng ký: ${new Date(enrollment.enrolledAt).toLocaleDateString('vi-VN')}`
                                          }
                                       </span>
                                       <div className="flex items-center gap-2">
                                          <Button
                                             variant="ghost"
                                             size="sm"
                                             className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                             onClick={(e) => {
                                                e.stopPropagation();
                                                handleUnenroll(enrollment.id, enrollment.course!.title);
                                             }}
                                          >
                                             <Trash2 className="w-4 h-4" />
                                          </Button>
                                          <Button
                                             size="sm"
                                             onClick={() => navigate(`/courses/${enrollment.courseId}`)}
                                          >
                                             <Play className="w-4 h-4 mr-1" />
                                             {enrollment.progress && enrollment.progress > 0 ? 'Tiếp tục' : 'Bắt đầu'}
                                          </Button>
                                       </div>
                                    </div>
                                 </div>
                              </div>
                           ))}
                        </div>
                     ) : (
                        <div className="text-center py-12">
                           <div className="w-20 h-20 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center">
                              <BookOpen className="w-10 h-10 text-slate-400" />
                           </div>
                           <h4 className="text-lg font-semibold text-slate-900 mb-2">Chưa có khóa học nào</h4>
                           <p className="text-slate-500 mb-6 max-w-sm mx-auto">
                              Khám phá kho khóa học chất lượng cao và bắt đầu hành trình học tập của bạn ngay hôm nay!
                           </p>
                           <Button onClick={() => navigate('/marketplace')}>
                              <BookOpen className="w-4 h-4 mr-2" />
                              Khám phá khóa học
                           </Button>
                        </div>
                     )}
                  </Card>
               </div>
            );

         case 'settings':
            return <UserSettings />;

         case 'overview':
         default:
            return (
               <>
                  {/* Streak Message Toast */}
                  {streakMessage && (
                     <div className="mb-4 p-4 bg-linear-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl flex items-center gap-3 animate-fade-in">
                        <Flame className="w-6 h-6 text-orange-500" />
                        <span className="text-orange-800 font-medium">{streakMessage}</span>
                     </div>
                  )}

                  {/* Stats / Streak */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <Card className="p-4 flex items-center space-x-4">
                        <div className="p-3 bg-orange-100 text-orange-600 rounded-lg"><Trophy className="w-6 h-6" /></div>
                        <div>
                           <div className="text-2xl font-bold text-slate-900">{longestStreak} ngày</div>
                           <div className="text-xs text-slate-500">Kỷ lục streak</div>
                        </div>
                     </Card>
                     <Card className={`p-4 flex items-center space-x-4 ${todayCheckedIn ? 'ring-2 ring-emerald-200' : ''}`}>
                        <div className={`p-3 rounded-lg ${todayCheckedIn ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                           {streakLoading ? (
                              <Loader2 className="w-6 h-6 animate-spin" />
                           ) : (
                              <Flame className="w-6 h-6" />
                           )}
                        </div>
                        <div>
                           <div className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                              {currentStreak} ngày
                              {currentStreak >= 7 && <span className="text-lg">🔥</span>}
                              {currentStreak >= 30 && <span className="text-lg">⭐</span>}
                           </div>
                           <div className="text-xs text-slate-500">
                              {todayCheckedIn ? '✓ Đã điểm danh hôm nay' : 'Chuỗi học tập'}
                           </div>
                        </div>
                     </Card>
                     <Card className="p-4 flex items-center space-x-4">
                        <div className="p-3 bg-blue-100 text-blue-600 rounded-lg"><BookOpen className="w-6 h-6" /></div>
                        <div>
                           <div className="text-2xl font-bold text-slate-900">{activeCount + completedCount}</div>
                           <div className="text-xs text-slate-500">Khóa học đã đăng ký</div>
                        </div>
                     </Card>
                  </div>

                  {/* Workload Warning - Shows on overview if there are warnings */}
                  {analysis && analysis.warnings.length > 0 && (
                     <WorkloadWarningCard className="mt-6" />
                  )}

                  {/* Upcoming */}
                  <Card className="p-6 mt-6">
                     <h3 className="font-bold text-slate-900 mb-4 flex items-center">
                        <CalendarIcon className="w-5 h-5 mr-2 text-primary-600" /> Sắp diễn ra
                     </h3>
                     {registrationsLoading ? (
                        <div className="flex justify-center py-8">
                           <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                        </div>
                     ) : (
                        <div className="space-y-4">
                           {registrations.slice(0, 2).map(reg => reg.contest && (
                              <div
                                 key={reg.id}
                                 className="flex items-center p-3 rounded-lg hover:bg-slate-50 border border-slate-100 transition-colors cursor-pointer"
                                 onClick={() => navigate(`/contests/${reg.contestId}`)}
                              >
                                 <div className="w-12 h-12 rounded-lg bg-slate-200 shrink-0 flex flex-col items-center justify-center text-xs font-bold text-slate-600 mr-4">
                                    <span className="text-primary-600">
                                       {new Date(reg.contest.dateStart).toLocaleDateString('vi-VN', { month: 'short' }).toUpperCase()}
                                    </span>
                                    <span className="text-lg">{new Date(reg.contest.dateStart).getDate()}</span>
                                 </div>
                                 <div className="grow">
                                    <h4 className="font-semibold text-slate-900">{reg.contest.title}</h4>
                                    <p className="text-xs text-slate-500">
                                       {new Date(reg.contest.dateStart).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {reg.contest.organizer}
                                    </p>
                                 </div>
                                 <Button size="sm" variant="secondary">Chi tiết</Button>
                              </div>
                           ))}
                           {registrations.length === 0 && (
                              <p className="text-center text-slate-500 py-4">Không có sự kiện sắp diễn ra</p>
                           )}
                        </div>
                     )}
                  </Card>

                  {/* Learning Progress - Real data from enrollments */}
                  <Card className="p-6 mt-6">
                     <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-slate-900 flex items-center">
                           <BookOpen className="w-5 h-5 mr-2 text-primary-600" /> Đang học
                        </h3>
                        <button
                           onClick={() => setActiveTab('courses')}
                           className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                        >
                           Xem tất cả
                        </button>
                     </div>
                     {coursesLoading ? (
                        <div className="flex justify-center py-6">
                           <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                        </div>
                     ) : enrollments.filter(e => e.status === 'active').slice(0, 3).length > 0 ? (
                        <div className="space-y-5">
                           {enrollments.filter(e => e.status === 'active').slice(0, 3).map(enrollment => enrollment.course && (
                              <div key={enrollment.id}>
                                 <div className="flex justify-between text-sm mb-1.5">
                                    <span className="font-medium text-slate-900 line-clamp-1">{enrollment.course.title}</span>
                                    <span className="text-slate-500 shrink-0 ml-2">{enrollment.progress || 0}%</span>
                                 </div>
                                 <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                    <div
                                       className={`h-2 rounded-full transition-all ${getProgressColor(enrollment.progress || 0)}`}
                                       data-progress={enrollment.progress || 0}
                                       ref={(el) => { if (el) el.style.width = `${enrollment.progress || 0}%`; }}
                                    />
                                 </div>
                              </div>
                           ))}
                        </div>
                     ) : (
                        <p className="text-center text-slate-500 py-4">
                           Bạn chưa đăng ký khóa học nào
                        </p>
                     )}
                  </Card>
               </>
            );
      }
   };

   return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
         <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

            {/* Left Sidebar */}
            <div className="space-y-6">
               <Card className="p-6 text-center">
                  <div className="w-24 h-24 rounded-full bg-slate-200 mx-auto mb-4 overflow-hidden border-4 border-white shadow-sm">
                     <img
                        src={currentUser?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.name || 'User')}&background=6366f1&color=fff`}
                        alt="Avatar"
                        className="w-full h-full object-cover"
                     />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">{currentUser?.name || 'Người dùng'}</h2>
                  <p className="text-sm text-slate-500 mb-4">Học viên tích cực</p>
                  <div className="flex justify-center gap-2 mb-6">
                     <Badge className="bg-yellow-50 text-yellow-700 border-yellow-100">Gold Member</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-center">
                     <div>
                        <div className="font-bold text-slate-900 text-lg">{analysis?.workload.activeContests ?? 0}</div>
                        <div className="text-xs text-slate-500">Cuộc thi</div>
                     </div>
                     <div>
                        <div className="font-bold text-slate-900 text-lg">{analysis?.workload.activeCourses ?? 0}</div>
                        <div className="text-xs text-slate-500">Khóa học</div>
                     </div>
                  </div>
               </Card>

               <Card className="p-0 overflow-hidden">
                  <div className="p-4 border-b border-slate-100 font-semibold text-slate-900">Menu</div>
                  <nav className="flex flex-col">
                     <button
                        onClick={() => setActiveTab('overview')}
                        className={`px-4 py-3 text-sm text-left border-l-4 transition-colors ${activeTab === 'overview'
                           ? 'text-primary-600 bg-primary-50 border-primary-600 font-medium'
                           : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-transparent'
                           }`}
                     >
                        Tổng quan
                     </button>
                     <button
                        onClick={() => setActiveTab('schedule')}
                        className={`px-4 py-3 text-sm text-left border-l-4 transition-colors ${activeTab === 'schedule'
                           ? 'text-primary-600 bg-primary-50 border-primary-600 font-medium'
                           : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-transparent'
                           }`}
                     >
                        <span className="flex items-center gap-2">
                           Lịch thi đấu
                           {analysis && analysis.warnings.length > 0 && (
                              <span className="w-2 h-2 rounded-full bg-red-500" />
                           )}
                        </span>
                     </button>
                     <button
                        onClick={() => setActiveTab('courses')}
                        className={`px-4 py-3 text-sm text-left border-l-4 transition-colors ${activeTab === 'courses'
                           ? 'text-primary-600 bg-primary-50 border-primary-600 font-medium'
                           : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-transparent'
                           }`}
                     >
                        Khóa học của tôi
                     </button>

                     <button
                        onClick={() => setActiveTab('settings')}
                        className={`px-4 py-3 text-sm text-left border-l-4 transition-colors ${activeTab === 'settings'
                           ? 'text-primary-600 bg-primary-50 border-primary-600 font-medium'
                           : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-transparent'
                           }`}
                     >
                        Cài đặt
                     </button>
                  </nav>
               </Card>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-3 space-y-6">
               {renderTabContent()}
            </div>
         </div>
      </div>
   );
};

export default Profile;
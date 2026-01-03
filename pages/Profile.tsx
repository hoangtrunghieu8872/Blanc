import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Calendar as CalendarIcon, Trophy, BookOpen, Clock, Settings, LogOut, ChevronRight, Loader2, Play, CheckCircle2, Trash2 } from 'lucide-react';
import { Button, Card, Badge, Input, Tabs } from '../components/ui/Common';
import ScheduleCalendar from '../components/ScheduleCalendar';
import WorkloadWarningCard from '../components/WorkloadWarningCard';
import UserSettings from '../components/UserSettings';
import { ScheduleEvent, User, CourseEnrollment, MentorBlog } from '../types';
import { useUserRegistrations, useWorkloadAnalysis, useEnrolledCourses, useStreak } from '../lib/hooks';
import { api } from '../lib/api';
import { mentorApi } from '../lib/mentorApi';

type TabType = 'overview' | 'schedule' | 'courses' | 'settings' | 'mentor-blog';

// Helper to get user from localStorage
function getStoredUser(): User | null {
   try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
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
   const [activeTab, setActiveTab] = useState<TabType>(tabFromUrl && ['overview', 'schedule', 'courses', 'settings', 'mentor-blog'].includes(tabFromUrl) ? tabFromUrl : 'overview');
   const [currentUser, setCurrentUser] = useState<User | null>(() => getStoredUser());
   const [isInitialized, setIsInitialized] = useState(false);
   const [mentorBlog, setMentorBlog] = useState<MentorBlog>({ bannerUrl: '', body: '' });
   const [isBlogLoading, setIsBlogLoading] = useState(false);
   const [isBlogSaving, setIsBlogSaving] = useState(false);
   const [isBlogUploading, setIsBlogUploading] = useState(false);
   const [blogError, setBlogError] = useState<string | null>(null);
   const bannerInputRef = useRef<HTMLInputElement>(null);
   const isMentor = currentUser?.role === 'mentor';

   // Update tab when URL changes
   useEffect(() => {
      if (tabFromUrl && ['overview', 'schedule', 'courses', 'settings', 'mentor-blog'].includes(tabFromUrl)) {
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
   } = useStreak({ autoCheckin: false, userId: currentUser?.id });

   const prevStreakRef = useRef<number | null>(null);
   const [isStreakCelebrating, setIsStreakCelebrating] = useState(false);

   useEffect(() => {
      const prev = prevStreakRef.current;
      prevStreakRef.current = currentStreak;
      if (todayCheckedIn && prev !== null && currentStreak > prev) {
         setIsStreakCelebrating(true);
         const timer = window.setTimeout(() => setIsStreakCelebrating(false), 650);
         return () => window.clearTimeout(timer);
      }
   }, [currentStreak, todayCheckedIn]);

   useEffect(() => {
      if (!streakMessage) return;
      setIsStreakCelebrating(true);
      const timer = window.setTimeout(() => setIsStreakCelebrating(false), 650);
      return () => window.clearTimeout(timer);
   }, [streakMessage]);

   useEffect(() => {
      if (!isMentor || !currentUser?.id) return;
      let isActive = true;

      const fetchMentorBlog = async () => {
         setIsBlogLoading(true);
         setBlogError(null);
         try {
            const data = await mentorApi.getMyBlog();
            if (!isActive) return;
            setMentorBlog({
               bannerUrl: data.blog?.bannerUrl || '',
               body: data.blog?.body || '',
               createdAt: data.blog?.createdAt || null,
               updatedAt: data.blog?.updatedAt || null,
            });
            syncMentorBlogCompletion(data.mentorBlogCompleted);
         } catch (err) {
            if (!isActive) return;
            setBlogError(err instanceof Error ? err.message : 'Khong the tai blog');
         } finally {
            if (isActive) setIsBlogLoading(false);
         }
      };

      fetchMentorBlog();

      return () => {
         isActive = false;
      };
   }, [currentUser?.id, isMentor]);

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
      if (event.type === 'course') {
         navigate(`/courses/${event.id}`);
      } else {
         navigate(`/contests/${event.id}`);
      }
   };

   const syncMentorBlogCompletion = (completed?: boolean) => {
      if (typeof completed !== 'boolean') return;
      try {
         const userStr = localStorage.getItem('user');
         if (!userStr) return;
         const user = JSON.parse(userStr);
         if (user.mentorBlogCompleted === completed) return;
         user.mentorBlogCompleted = completed;
         localStorage.setItem('user', JSON.stringify(user));
         window.dispatchEvent(new Event('auth-change'));
      } catch {
         // ignore
      }
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

   // star removed

   const handleMentorBannerUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
         setBlogError('Chi chap nhan file anh (JPEG, PNG, GIF, WebP)');
         return;
      }

      if (file.size > 5 * 1024 * 1024) {
         setBlogError('Kich thuoc file vuot qua 5MB');
         return;
      }

      setIsBlogUploading(true);
      setBlogError(null);

      try {
         const presignData = await api.post<{
            uploadUrl: string;
            fileName: string;
            folder: string;
            mimeType: string;
            nonce: string;
            timestamp: number;
            signature: string;
         }>('/media/presign', {
            mimeType: file.type,
            folder: 'mentor-blog'
         });

         const formData = new FormData();
         formData.append('file', file);
         formData.append('fileName', presignData.fileName);
         formData.append('folder', presignData.folder);
         formData.append('mimeType', presignData.mimeType);
         formData.append('nonce', presignData.nonce);
         formData.append('timestamp', String(presignData.timestamp));
         formData.append('signature', presignData.signature);

         const uploadResponse = await fetch(presignData.uploadUrl, {
            method: 'POST',
            body: formData,
         });

         const uploadResult = await uploadResponse.json();

         if (uploadResult.status !== 200 || !uploadResult.result) {
            throw new Error(uploadResult.result?.error || 'Upload failed');
         }

         const driveFileId = uploadResult.result.id;
         const directImageUrl = `https://lh3.googleusercontent.com/d/${driveFileId}`;

         setMentorBlog(prev => ({ ...prev, bannerUrl: directImageUrl }));
      } catch (err) {
         setBlogError(err instanceof Error ? err.message : 'Khong the tai len banner');
      } finally {
         setIsBlogUploading(false);
         if (bannerInputRef.current) {
            bannerInputRef.current.value = '';
         }
      }
   };

   const handleSaveMentorBlog = async (event: React.FormEvent) => {
      event.preventDefault();
      setIsBlogSaving(true);
      setBlogError(null);

      try {
         const data = await mentorApi.updateMyBlog({
            bannerUrl: mentorBlog.bannerUrl,
            body: mentorBlog.body,
         });

         setMentorBlog({
            bannerUrl: data.blog?.bannerUrl || '',
            body: data.blog?.body || '',
            createdAt: data.blog?.createdAt || null,
            updatedAt: data.blog?.updatedAt || null,
         });
         syncMentorBlogCompletion(data.mentorBlogCompleted);
      } catch (err) {
         setBlogError(err instanceof Error ? err.message : 'Khong the cap nhat blog');
      } finally {
         setIsBlogSaving(false);
      }
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                                     {/* Progress UI removed */}
                                    <div className="mt-3">
                                       <div className="flex items-center justify-between text-xs mb-1.5">
                                          <span className="text-slate-500">
                                             {enrollment.completedLessons?.length || 0} / {enrollment.course.lessonsCount || '?'} bài học
                                          </span>
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

         case 'mentor-blog':
            if (!isMentor) {
               return (
                  <Card className="p-6">
                     <p className="text-sm text-slate-500">Ban khong co quyen truy cap muc nay.</p>
                  </Card>
               );
            }

            return (
               <div className="space-y-6">
                  <Card className="p-6">
                     <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                           <h3 className="text-lg font-bold text-slate-900">Blog ca nhan</h3>
                           <p className="text-sm text-slate-500 mt-1">Cap nhat banner va noi dung gioi thieu.</p>
                        </div>
                     </div>

                     {blogError && (
                        <div className="mt-4 text-sm text-red-600">{blogError}</div>
                     )}

                     {isBlogLoading ? (
                        <div className="flex items-center justify-center py-10 text-slate-500">
                           <Loader2 className="w-5 h-5 animate-spin mr-2" />
                           Dang tai blog...
                        </div>
                     ) : (
                        <form onSubmit={handleSaveMentorBlog} className="mt-6 space-y-5">
                           <div>
                              <label className="block text-sm font-medium text-slate-700">Banner</label>
                              <div className="mt-2 rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
                                 {mentorBlog.bannerUrl ? (
                                    <img
                                       src={mentorBlog.bannerUrl}
                                       alt="Banner"
                                       className="w-full h-40 object-cover"
                                    />
                                 ) : (
                                    <div className="h-40 flex items-center justify-center text-xs text-slate-400">
                                       Chua co banner
                                    </div>
                                 )}
                              </div>
                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                 <input
                                    ref={bannerInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleMentorBannerUpload}
                                 />
                                 <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => bannerInputRef.current?.click()}
                                    disabled={isBlogUploading}
                                 >
                                    {isBlogUploading ? (
                                       <>
                                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                          Dang tai...
                                       </>
                                    ) : (
                                       'Tai banner'
                                    )}
                                 </Button>
                                 {mentorBlog.bannerUrl && (
                                    <Button
                                       type="button"
                                       variant="ghost"
                                       size="sm"
                                       onClick={() => setMentorBlog(prev => ({ ...prev, bannerUrl: '' }))}
                                    >
                                       Xoa banner
                                    </Button>
                                 )}
                              </div>
                           </div>

                           <div>
                              <label className="block text-sm font-medium text-slate-700">Noi dung blog</label>
                              <textarea
                                 value={mentorBlog.body}
                                 onChange={(e) => setMentorBlog(prev => ({ ...prev, body: e.target.value }))}
                                 rows={8}
                                 className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                 placeholder="Gioi thieu ve ban than..."
                              />
                           </div>

                           <div className="flex justify-end">
                              <Button type="submit" disabled={isBlogSaving}>
                                 {isBlogSaving ? (
                                    <>
                                       <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                       Dang luu...
                                    </>
                                 ) : (
                                    'Luu cap nhat'
                                 )}
                              </Button>
                           </div>
                        </form>
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
                         <img src="/streak/flame-tight.gif" className="streak-motion w-6 h-6 object-contain mix-blend-screen" alt="" aria-hidden="true" />
                         <img src="/streak/flame-tight.png" className="streak-reduce-motion w-6 h-6 object-contain mix-blend-screen" alt="" aria-hidden="true" />
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
                     <Card className={`relative overflow-hidden p-4 ${todayCheckedIn ? 'ring-2 ring-emerald-200 bg-linear-to-r from-emerald-50/80 to-white' : ''}`}>
                        {todayCheckedIn && currentStreak >= 3 && (
                           <span
                              className="pointer-events-none absolute inset-y-0 left-0 w-[35%] bg-linear-to-r from-white/0 via-white/70 to-white/0 opacity-25 animate-streak-shine"
                              aria-hidden="true"
                           />
                        )}

                        <div className="relative flex items-center space-x-4">
                           <div className={`relative w-12 h-12 shrink-0 grid place-items-center overflow-hidden rounded-xl ring-1 ring-inset ${todayCheckedIn ? 'bg-linear-to-br from-emerald-500 to-teal-500 text-white ring-white/25 shadow-sm' : 'bg-slate-100 text-slate-400 ring-slate-200/70'}`}>
                              {streakLoading ? (
                                 <Loader2 className="w-6 h-6 animate-spin" />
                              ) : todayCheckedIn ? (
                                 <>
                                    <img
                                       src="/streak/flame-tight.gif"
                                       className="streak-motion w-[150%] h-[150%] -translate-y-[8%] object-contain mix-blend-screen brightness-110 saturate-150 contrast-125 drop-shadow-[0_6px_14px_rgba(0,0,0,0.18)]"
                                       alt=""
                                       aria-hidden="true"
                                    />
                                    <img
                                       src="/streak/flame-tight.png"
                                       className="streak-reduce-motion w-[150%] h-[150%] -translate-y-[8%] object-contain mix-blend-screen brightness-110 saturate-150 contrast-125 drop-shadow-[0_6px_14px_rgba(0,0,0,0.18)]"
                                       alt=""
                                       aria-hidden="true"
                                    />
                                 </>
                              ) : (
                                  <img src="/streak/flame-tight.png" className="w-[150%] h-[150%] -translate-y-[8%] object-contain mix-blend-screen opacity-60 grayscale" alt="" aria-hidden="true" />
                              )}
                           </div>

                           <div>
                              <div className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                                 <span className={`inline-flex items-baseline gap-1 ${isStreakCelebrating ? 'animate-streak-pop' : ''}`}>
                                    <span className="tabular-nums">{currentStreak}</span>
                                    <span className="text-base font-semibold text-slate-600">ngày</span>
                                 </span>

                                  {/* star removed */}
                               </div>

                              <div className="text-xs text-slate-500 flex items-center gap-1">
                                 {todayCheckedIn ? (
                                    <>
                                       <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                       <span>Đã điểm danh hôm nay</span>
                                    </>
                                 ) : (
                                    <span>Chuỗi học tập</span>
                                 )}
                              </div>
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
                                 <div className="flex justify-between text-sm">
                                     <span className="font-medium text-slate-900 line-clamp-1">{enrollment.course.title}</span>
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
                     {(() => {
                        const tier = currentUser?.membership?.effectiveTier || currentUser?.membership?.tier || 'free';
                        const tierLabel = tier === 'plus' ? 'Plus' : tier === 'pro' ? 'Pro' : tier === 'business' ? 'Business' : 'Free';
                        const tierClass =
                           tier === 'business'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                              : tier === 'pro'
                                 ? 'bg-purple-50 text-purple-700 border-purple-100'
                                 : tier === 'plus'
                                    ? 'bg-yellow-50 text-yellow-700 border-yellow-100'
                                    : 'bg-slate-100 text-slate-700 border-slate-200';

                        return (
                           <div className="flex flex-col items-center gap-2">
                              <Badge className={tierClass}>{tierLabel}</Badge>
                              <button
                                 onClick={() => navigate('/profile?tab=settings&settingsTab=membership')}
                                 className="text-xs font-medium text-primary-600 hover:text-primary-700 hover:underline"
                              >
                                 Quản lý gói đăng ký
                              </button>
                           </div>
                        );
                     })()}
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

                     {isMentor && (
                        <button
                           onClick={() => setActiveTab('mentor-blog')}
                           className={`px-4 py-3 text-sm text-left border-l-4 transition-colors ${activeTab === 'mentor-blog'
                              ? 'text-primary-600 bg-primary-50 border-primary-600 font-medium'
                              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-transparent'
                              }`}
                        >
                           Blog ca nhan
                        </button>
                     )}

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
               {isMentor && !currentUser?.mentorBlogCompleted && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                     <span className="text-sm text-amber-800">
                        Ban chua cap nhat blog ca nhan. Hay hoan thanh de ho so day du hon.
                     </span>
                     <Button size="sm" onClick={() => navigate('/profile?tab=mentor-blog')}>
                        Cap nhat thong tin
                     </Button>
                  </div>
               )}
               {renderTabContent()}
            </div>
         </div>
      </div>
   );
};

export default Profile;


import React, { useState, useRef, useEffect, useCallback } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, Bell, User as UserIcon, LogOut, ChevronDown, Check, Trophy, Users, Info, BookOpen, Loader2, FileText, Mail, Phone, ShieldCheck, Rocket, Sparkles } from 'lucide-react';
import { Button, cn } from './ui/Common';
import { User, Notification } from '../types';
import { api } from '../lib/api';
import StreakBadge from './StreakBadge';
import MentorBlogPrompt from './MentorBlogPrompt';

interface LayoutProps {
  user: User | null;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ user, onLogout }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isLearningOpen, setIsLearningOpen] = useState(false);
  const [isLearningMobileOpen, setIsLearningMobileOpen] = useState(false);
  const [isCommunityOpen, setIsCommunityOpen] = useState(false);
  const [isCommunityMobileOpen, setIsCommunityMobileOpen] = useState(false);
  const [isMentorPromptOpen, setIsMentorPromptOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoadingNotifs, setIsLoadingNotifs] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const learningRef = useRef<HTMLDivElement>(null);
  const communityRef = useRef<HTMLDivElement>(null);
  const learningHoverCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const communityHoverCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const navigate = useNavigate();
  const location = useLocation();

  // Hide footer on reports page (for full-screen editor experience)
  const hideFooter = location.pathname.startsWith('/reports');

  const learningItems = [
    { name: 'Khóa học', path: '/marketplace' },
    { name: 'Tài liệu', path: '/documents' },
  ];

  const communityItems = [
    { name: 'Cộng đồng', path: '/community' },
    { name: 'Bản tin', path: '/news' },
  ];

  const navItems = [
    { name: 'Trang chủ', path: '/' },
    { name: 'Cuộc thi', path: '/contests' },
    { name: 'Mentor', path: '/mentors' },
  ];

  const leadingNavItems = navItems.slice(0, 2);
  const trailingNavItems = navItems.slice(2);

  const isLearningActive = location.pathname.startsWith('/marketplace') || location.pathname.startsWith('/documents');
  const isCommunityActive = location.pathname.startsWith('/community') || location.pathname.startsWith('/news');

  const desktopNavLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
      isActive
        ? 'bg-primary-50 text-primary-700 shadow-sm shadow-primary-100/70'
        : 'text-slate-600 hover:text-primary-600 hover:bg-slate-50'
    );

  const desktopNavDropdownButtonClass = (isActive: boolean, isOpen: boolean) =>
    cn(
      'inline-flex items-center gap-1 px-4 py-2 rounded-full text-sm font-semibold leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
      isActive
        ? 'bg-primary-50 text-primary-700 shadow-sm shadow-primary-100/70'
        : isOpen
          ? 'bg-slate-50 text-primary-600'
          : 'text-slate-600 hover:text-primary-600 hover:bg-slate-50'
    );

  const desktopDropdownLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center w-full px-3 py-2 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
      isActive ? 'bg-primary-50 text-primary-700' : 'text-slate-700 hover:bg-slate-50 hover:text-primary-700'
    );

  const mobileNavLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'block px-4 py-2 rounded-lg text-base font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
      isActive ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:text-primary-600 hover:bg-slate-50'
    );

  const mobileNavDropdownButtonClass = (isActive: boolean, isOpen: boolean) =>
    cn(
      'w-full flex items-center justify-between px-4 py-2 rounded-lg text-base font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
      isActive
        ? 'bg-primary-50 text-primary-700'
        : isOpen
          ? 'bg-slate-50 text-primary-600'
          : 'text-slate-600 hover:text-primary-600 hover:bg-slate-50'
    );

  const mobileNavSubLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'block px-4 py-2 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
      isActive ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:text-primary-600 hover:bg-slate-50'
    );

  const unreadCount = notifications.filter(n => !n.isRead).length;

  useEffect(() => {
    if (!user || user.role !== 'mentor' || user.mentorBlogCompleted) {
      setIsMentorPromptOpen(false);
      return;
    }

    try {
      const promptKey = `mentor-blog-prompt:${user.id || 'me'}`;
      if (sessionStorage.getItem(promptKey)) return;
      sessionStorage.setItem(promptKey, '1');
    } catch {
      // ignore sessionStorage errors
    }

    setIsMentorPromptOpen(true);
  }, [user?.id, user?.role, user?.mentorBlogCompleted]);

  // Fetch notifications from server
  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    setIsLoadingNotifs(true);
    try {
      const data = await api.get<{ notifications: Notification[] }>('/users/me/notifications-history?limit=10');
      setNotifications(data.notifications || []);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
      // Fallback to empty array on error
      setNotifications([]);
    } finally {
      setIsLoadingNotifs(false);
    }
  }, [user]);

  // Fetch notifications when user logs in or component mounts
  useEffect(() => {
    if (user) {
      fetchNotifications();
    } else {
      setNotifications([]);
    }
  }, [user, fetchNotifications]);

  // Mark all notifications as read - sync with API
  const markAllAsRead = async () => {
    try {
      await api.patch('/users/me/notifications/mark-all-read', {});
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.error('Failed to mark notifications as read:', err);
    }
  };

  // Mark single notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      await api.patch(`/users/me/notifications/${notificationId}/read`, {});
      setNotifications(prev => prev.map(n =>
        n.id === notificationId ? { ...n, isRead: true } : n
      ));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  // Handle notification click
  const handleNotificationClick = (notif: Notification) => {
    if (!notif.isRead) {
      markAsRead(notif.id);
    }
    // TODO: Navigate to relevant page based on notification type
  };

  // View all notifications - go to settings with notifications tab
  const handleViewAllNotifications = () => {
    setIsNotifOpen(false);
    navigate('/profile?tab=settings&settingsTab=notifications');
  };

  // Close notifications when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (learningRef.current && !learningRef.current.contains(event.target as Node)) {
        setIsLearningOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (communityRef.current && !communityRef.current.contains(event.target as Node)) {
        setIsCommunityOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const clearLearningHoverCloseTimeout = () => {
    if (!learningHoverCloseTimeoutRef.current) return;
    clearTimeout(learningHoverCloseTimeoutRef.current);
    learningHoverCloseTimeoutRef.current = null;
  };

  const clearCommunityHoverCloseTimeout = () => {
    if (!communityHoverCloseTimeoutRef.current) return;
    clearTimeout(communityHoverCloseTimeoutRef.current);
    communityHoverCloseTimeoutRef.current = null;
  };

  const openLearningMenu = () => {
    clearLearningHoverCloseTimeout();
    clearCommunityHoverCloseTimeout();
    setIsCommunityOpen(false);
    setIsLearningOpen(true);
  };

  const scheduleCloseLearningMenu = () => {
    clearLearningHoverCloseTimeout();
    learningHoverCloseTimeoutRef.current = setTimeout(() => {
      setIsLearningOpen(false);
    }, 160);
  };

  const openCommunityMenu = () => {
    clearCommunityHoverCloseTimeout();
    clearLearningHoverCloseTimeout();
    setIsLearningOpen(false);
    setIsCommunityOpen(true);
  };

  const scheduleCloseCommunityMenu = () => {
    clearCommunityHoverCloseTimeout();
    communityHoverCloseTimeoutRef.current = setTimeout(() => {
      setIsCommunityOpen(false);
    }, 160);
  };

  useEffect(() => {
    return () => {
      clearLearningHoverCloseTimeout();
      clearCommunityHoverCloseTimeout();
    };
  }, []);

  useEffect(() => {
    setIsLearningOpen(false);
    setIsLearningMobileOpen(false);
    setIsCommunityOpen(false);
    setIsCommunityMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isMenuOpen) {
      setIsLearningMobileOpen(false);
      setIsCommunityMobileOpen(false);
    }
  }, [isMenuOpen]);

  const getIconByType = (type: string) => {
    switch (type) {
      case 'reward': return <Trophy className="w-5 h-5 text-amber-500" />;
      case 'invite': return <Users className="w-5 h-5 text-blue-500" />;
      case 'course':
      case 'courseUpdate': return <BookOpen className="w-5 h-5 text-emerald-500" />;
      case 'contestReminder':
      case 'contestRegistration': return <Trophy className="w-5 h-5 text-primary-500" />;
      case 'announcement': return <Info className="w-5 h-5 text-blue-500" />;
      case 'welcome': return <Trophy className="w-5 h-5 text-amber-500" />;
      default: return <Info className="w-5 h-5 text-slate-500" />;
    }
  };

  // Format time ago
  const formatTimeAgo = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;
    return date.toLocaleDateString('vi-VN');
  };

  const handleMentorPromptUpdate = () => {
    setIsMentorPromptOpen(false);
    navigate('/profile?tab=mentor-blog');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans">
      <MentorBlogPrompt
        isOpen={isMentorPromptOpen}
        onClose={() => setIsMentorPromptOpen(false)}
        onUpdate={handleMentorPromptUpdate}
      />
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative flex h-16 items-center justify-center">
            {/* Logo - Absolute left */}
            <div className="absolute left-0 top-1/2 -translate-y-1/2 flex flex-row items-center cursor-pointer" onClick={() => navigate('/')}>
              <img src="/logo.png" alt="Blanc Logo" className="h-10 w-10 md:h-12 md:w-12 rounded-full object-cover shrink-0" />
              <div className="ml-2 md:ml-3 flex-col hidden sm:flex">
                <span className="text-sm font-semibold text-slate-800 leading-tight">Beyond Learning</span>
                <span className="text-xs text-slate-500 leading-tight">And New Challenges</span>
              </div>
            </div>

            {/* Desktop Nav - True Center */}
            <nav className="hidden md:flex items-center gap-1" aria-label="Menu chính">
              {leadingNavItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  className={desktopNavLinkClass}
                >
                  {item.name}
                </NavLink>
              ))}

              <div
                className="relative after:absolute after:inset-x-0 after:top-full after:h-3 after:content-['']"
                ref={learningRef}
                onMouseEnter={openLearningMenu}
                onMouseLeave={scheduleCloseLearningMenu}
              >
                <button
                  type="button"
                  onClick={() => {
                    clearLearningHoverCloseTimeout();
                    clearCommunityHoverCloseTimeout();
                    setIsCommunityOpen(false);
                    setIsLearningOpen(v => !v);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setIsLearningOpen(false);
                  }}
                  className={desktopNavDropdownButtonClass(isLearningActive, isLearningOpen)}
                  aria-haspopup="menu"
                  aria-expanded={isLearningOpen}
                  aria-controls="learning-menu"
                >
                  <span>Học tập</span>
                </button>

                {isLearningOpen && (
                  <div
                    id="learning-menu"
                    role="menu"
                    aria-label="Học tập"
                    className="absolute left-1/2 -translate-x-1/2 mt-3 w-52 bg-white rounded-xl shadow-xl border border-slate-100 p-1 animation-fade-in z-50"
                  >
                    {learningItems.map((item) => (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        className={desktopDropdownLinkClass}
                        role="menuitem"
                        onClick={() => setIsLearningOpen(false)}
                      >
                        {item.name}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>

              <div
                className="relative after:absolute after:inset-x-0 after:top-full after:h-3 after:content-['']"
                ref={communityRef}
                onMouseEnter={openCommunityMenu}
                onMouseLeave={scheduleCloseCommunityMenu}
              >
                <button
                  type="button"
                  onClick={() => {
                    clearCommunityHoverCloseTimeout();
                    clearLearningHoverCloseTimeout();
                    setIsLearningOpen(false);
                    setIsCommunityOpen(v => !v);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setIsCommunityOpen(false);
                  }}
                  className={desktopNavDropdownButtonClass(isCommunityActive, isCommunityOpen)}
                  aria-haspopup="menu"
                  aria-expanded={isCommunityOpen}
                  aria-controls="community-menu"
                >
                  <span>Cộng đồng</span>
                </button>

                {isCommunityOpen && (
                  <div
                    id="community-menu"
                    role="menu"
                    aria-label="Cộng đồng"
                    className="absolute left-1/2 -translate-x-1/2 mt-3 w-52 bg-white rounded-xl shadow-xl border border-slate-100 p-1 animation-fade-in z-50"
                  >
                    {communityItems.map((item) => (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        className={desktopDropdownLinkClass}
                        role="menuitem"
                        onClick={() => setIsCommunityOpen(false)}
                      >
                        {item.name}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>

              {trailingNavItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  className={desktopNavLinkClass}
                >
                  {item.name}
                </NavLink>
              ))}
            </nav>

            {/* Auth/Profile Actions - Absolute right */}
            <div className="absolute right-0 hidden md:flex items-center space-x-4">
              {user ? (
                <div className="flex items-center space-x-3">
                  {/* Streak Indicator */}
                  <StreakBadge userId={user.id} />

                  {/* Notification Bell with Dropdown */}
                  <div className="relative" ref={notifRef}>
                    <button
                      onClick={() => setIsNotifOpen(!isNotifOpen)}
                      className={`relative p-2 transition-colors rounded-full hover:bg-slate-100 ${isNotifOpen ? 'bg-slate-100 text-slate-800' : 'text-slate-500'}`}
                    >
                      <Bell className="w-5 h-5" />
                      {unreadCount > 0 && (
                        <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white ring-1 ring-white"></span>
                      )}
                    </button>

                    {/* Notification Dropdown Panel */}
                    {isNotifOpen && (
                      <div className="absolute right-0 mt-3 w-80 md:w-96 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden animation-fade-in z-50 origin-top-right">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white">
                          <h3 className="font-bold text-slate-900">Thông báo</h3>
                          {unreadCount > 0 && (
                            <button
                              onClick={markAllAsRead}
                              className="text-xs font-medium text-primary-600 hover:text-primary-700 flex items-center"
                            >
                              <Check className="w-3 h-3 mr-1" /> Đánh dấu đã đọc
                            </button>
                          )}
                        </div>

                        <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                          {isLoadingNotifs ? (
                            <div className="flex justify-center py-8">
                              <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                            </div>
                          ) : notifications.length > 0 ? (
                            <div className="py-1">
                              {notifications.map((notif) => (
                                <div
                                  key={notif.id}
                                  onClick={() => handleNotificationClick(notif)}
                                  className={`px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer border-b border-slate-50 last:border-0 ${!notif.isRead ? 'bg-primary-50/30' : ''}`}
                                >
                                  <div className="flex gap-3">
                                    <div className={`mt-1 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${!notif.isRead ? 'bg-white shadow-sm' : 'bg-slate-100'}`}>
                                      {getIconByType(notif.type)}
                                    </div>
                                    <div className="flex-1 space-y-1">
                                      <div className="flex justify-between items-start">
                                        <p className={`text-sm ${!notif.isRead ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                                          {notif.title}
                                        </p>
                                        {!notif.isRead && (
                                          <span className="w-2 h-2 bg-primary-500 rounded-full mt-1.5"></span>
                                        )}
                                      </div>
                                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                                        {notif.message}
                                      </p>
                                      <p className="text-[10px] text-slate-400 font-medium pt-1">
                                        {notif.time || formatTimeAgo(notif.createdAt)}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-8 text-center text-slate-500">
                              <Bell className="w-8 h-8 mx-auto mb-3 text-slate-300" />
                              <p className="text-sm">Bạn chưa có thông báo nào</p>
                            </div>
                          )}
                        </div>

                        <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
                          <button
                            onClick={handleViewAllNotifications}
                            className="text-sm font-medium text-primary-600 hover:text-primary-700"
                          >
                            Xem tất cả
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="relative group">
                    <button className="flex items-center space-x-2 focus:outline-none">
                      <img
                        src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=6366f1&color=fff`}
                        alt="Avatar"
                        className="w-8 h-8 rounded-full border border-slate-200 object-cover"
                      />
                      <span className="text-sm font-medium text-slate-700">{user.name}</span>
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    </button>

                    {/* Dropdown */}
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg py-1 border border-slate-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all transform origin-top-right z-40">
                      <div className="px-4 py-3 border-b border-slate-100 mb-1">
                        <p className="text-xs text-slate-500">Đăng nhập với</p>
                        <p className="text-sm font-bold text-slate-900 truncate">{user.email}</p>
                      </div>
                      <NavLink to="/profile" className="flex px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 items-center">
                        <UserIcon className="w-4 h-4 mr-2 text-slate-400" /> Hồ sơ
                      </NavLink>
                      <NavLink to="/my-team-posts" className="flex px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 items-center">
                        <FileText className="w-4 h-4 mr-2 text-slate-400" /> Bài đăng của tôi
                      </NavLink>
                      <button onClick={onLogout} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center">
                        <LogOut className="w-4 h-4 mr-2" /> Đăng xuất
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center space-x-3">
                  <NavLink to="/login">
                    <Button variant="ghost" size="sm">Đăng nhập</Button>
                  </NavLink>
                  <NavLink to="/register">
                    <Button size="sm">Bắt đầu học</Button>
                  </NavLink>
                </div>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden absolute right-0 top-1/2 -translate-y-1/2 flex items-center">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="text-slate-500 hover:text-slate-700 focus:outline-none p-2"
              >
                {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Nav */}
        {isMenuOpen && (
          <div className="md:hidden bg-white border-b border-slate-200">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              {leadingNavItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMenuOpen(false)}
                  end={item.path === '/'}
                  className={mobileNavLinkClass}
                >
                  {item.name}
                </NavLink>
              ))}

              <div>
                <button
                  type="button"
                  onClick={() =>
                    setIsLearningMobileOpen(v => {
                      const next = !v;
                      if (next) setIsCommunityMobileOpen(false);
                      return next;
                    })
                  }
                  className={mobileNavDropdownButtonClass(isLearningActive, isLearningMobileOpen)}
                  aria-expanded={isLearningMobileOpen}
                  aria-controls="learning-menu-mobile"
                >
                  <span>Học tập</span>
                </button>

                {isLearningMobileOpen && (
                  <div id="learning-menu-mobile" className="mt-1 space-y-1 pl-4 border-l border-slate-100 ml-4">
                    {learningItems.map((item) => (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={() => {
                          setIsMenuOpen(false);
                          setIsLearningMobileOpen(false);
                        }}
                        className={mobileNavSubLinkClass}
                      >
                        {item.name}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <button
                  type="button"
                  onClick={() =>
                    setIsCommunityMobileOpen(v => {
                      const next = !v;
                      if (next) setIsLearningMobileOpen(false);
                      return next;
                    })
                  }
                  className={mobileNavDropdownButtonClass(isCommunityActive, isCommunityMobileOpen)}
                  aria-expanded={isCommunityMobileOpen}
                  aria-controls="community-menu-mobile"
                >
                  <span>Cộng đồng</span>
                </button>

                {isCommunityMobileOpen && (
                  <div id="community-menu-mobile" className="mt-1 space-y-1 pl-4 border-l border-slate-100 ml-4">
                    {communityItems.map((item) => (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={() => {
                          setIsMenuOpen(false);
                          setIsCommunityMobileOpen(false);
                        }}
                        className={mobileNavSubLinkClass}
                      >
                        {item.name}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>

              {trailingNavItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMenuOpen(false)}
                  end={item.path === '/'}
                  className={mobileNavLinkClass}
                >
                  {item.name}
                </NavLink>
              ))}
              {user ? (
                <>
                  <div className="border-t border-slate-100 my-2 pt-2">
                    {/* Mobile Streak Display */}
                    <div className="px-3 py-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <img src="/streak/flame-tight.gif" className="streak-motion w-5 h-5 object-contain mix-blend-screen" alt="" aria-hidden="true" />
                        <img src="/streak/flame-tight.png" className="streak-reduce-motion w-5 h-5 object-contain mix-blend-screen" alt="" aria-hidden="true" />
                        <span className="font-medium text-slate-700">Chuỗi học tập</span>
                      </div>
                      <StreakBadge userId={user.id} />
                    </div>
                  </div>
                  <div className="border-t border-slate-100 my-2 pt-2">
                    <div className="px-3 py-2 flex items-center justify-between text-slate-600">
                      <span className="font-medium">Thông báo</span>
                      {unreadCount > 0 && <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{unreadCount} mới</span>}
                    </div>
                  </div>
                  <NavLink to="/profile" className="block px-3 py-2 rounded-md text-base font-medium text-slate-600 hover:bg-slate-50">
                    Hồ sơ cá nhân
                  </NavLink>
                  <NavLink to="/my-team-posts" className="block px-3 py-2 rounded-md text-base font-medium text-slate-600 hover:bg-slate-50">
                    Bài đăng của tôi
                  </NavLink>
                  <button onClick={() => { onLogout(); setIsMenuOpen(false); }} className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-red-600 hover:bg-red-50">
                    Đăng xuất
                  </button>
                </>
              ) : (
                <div className="pt-4 flex flex-col space-y-2 px-3">
                  <NavLink to="/login" onClick={() => setIsMenuOpen(false)}>
                    <Button variant="secondary" className="w-full justify-center">Đăng nhập</Button>
                  </NavLink>
                  <NavLink to="/register" onClick={() => setIsMenuOpen(false)}>
                    <Button className="w-full justify-center">Đăng ký ngay</Button>
                  </NavLink>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="grow">
        <Outlet />
      </main>

      {/* Footer - Hidden on reports page for full-screen editor */}
      {!hideFooter && (
        <footer className="bg-white border-t border-slate-200 py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
              <div className="col-span-1 lg:col-span-3">
                <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-lg shadow-slate-200/60 p-6 h-full flex flex-col">
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-sky-50 opacity-80" aria-hidden="true"></div>
                  <div className="relative">
                    <div className="flex items-center mb-4">
                      <img src="/logo.png" alt="Blanc Logo" className="h-10 w-10 rounded-full object-cover mr-3 shadow-sm" />
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-800 leading-tight">Beyond Learning</span>
                        <span className="text-xs text-slate-500 leading-tight">And New Challenges</span>
                      </div>
                    </div>
                    <p className="text-slate-600 text-sm leading-relaxed mb-4">
                      Nền tảng kết nối tri thức, nâng tầm bản thân qua các cuộc thi và khóa học chất lượng cao.
                    </p>
                    <div className="space-y-2 text-sm text-slate-600">
                      <div className="flex items-start gap-2">
                        <ShieldCheck className="w-4 h-4 text-indigo-500 mt-0.5" />
                        <span>Cam kết bảo mật và đồng hành cùng học viên.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Rocket className="w-4 h-4 text-sky-500 mt-0.5" />
                        <span>Lộ trình học và thi được cập nhật liên tục.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Sparkles className="w-4 h-4 text-amber-500 mt-0.5" />
                        <span>Cộng đồng năng động, hỗ trợ 24/7.</span>
                      </div>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-2">
                      <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-xs font-semibold">Blanc Community</span>
                      <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-xs font-semibold">Học & Thi</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-span-1 lg:col-span-3">
                <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-md shadow-slate-200/40 p-6 h-full flex flex-col">
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-indigo-50 opacity-60" aria-hidden="true"></div>
                  <div className="relative flex flex-col gap-4 h-full">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-1">Hỗ trợ</h3>
                        <p className="text-xs text-slate-500">Tài liệu & hỗ trợ kỹ thuật</p>
                      </div>
                      <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-xs font-semibold">Online</span>
                    </div>
                    <ul className="space-y-3">
                      <li><NavLink to="/terms" className="text-slate-500 hover:text-primary-600 text-sm">Điều khoản sử dụng</NavLink></li>
                      <li><NavLink to="/privacy" className="text-slate-500 hover:text-primary-600 text-sm">Chính sách bảo mật</NavLink></li>
                      <li><a href="mailto:clbflife2025thptfptcantho@gmail.com?subject=Li%C3%AAn%20h%E1%BB%87%20t%E1%BB%AB%20Blanc&body=Xin%20ch%C3%A0o%2C%0A%0AT%C3%B4i%20mu%E1%BB%91n%20li%C3%AAn%20h%E1%BB%87%20v%E1%BB%81..." className="text-slate-500 hover:text-primary-600 text-sm">Liên hệ</a></li>
                    </ul>
                    <div className="mt-auto inline-flex items-center gap-2 px-3 py-2 rounded-full bg-slate-50 text-slate-600 text-xs font-medium">
                      <Sparkles className="w-4 h-4 text-indigo-500" /> Sẵn sàng hỗ trợ trong giờ hành chính
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-6">
                <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl shadow-slate-200/50">
                  <div className="absolute inset-0 bg-gradient-to-r from-sky-50 via-white to-indigo-50 opacity-80" aria-hidden="true"></div>
                  <div className="relative px-6 py-8 md:px-10 md:py-10">
                    <div className="text-center">
                      <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-2">Liên hệ</h3>
                      <p className="text-slate-500 text-sm">Đội ngũ Blanc sẽ phản hồi trong 24 giờ làm việc</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8 mt-8">
                      <div className="rounded-xl border border-white/80 bg-white/70 backdrop-blur-sm p-6 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200">
                            <Mail className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-indigo-600">Hòm thư</p>
                            <p className="text-sm text-slate-500">CLB Blanc</p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-slate-700 text-sm font-medium break-words">clbflife2025thptfptcantho@gmail.com</p>
                          <div className="flex items-center gap-2 text-slate-500 text-sm">
                            <Phone className="w-4 h-4 text-indigo-500" />
                            <span>+84 916 007 090</span>
                          </div>
                        </div>
                        <div className="flex gap-3 mt-5">
                          <a
                            href="https://www.facebook.com/profile.php?id=61584015058767"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center hover:bg-indigo-100 transition-colors shadow-sm"
                            title="Facebook"
                          >
                            <span className="sr-only">Facebook</span>
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
                            </svg>
                          </a>
                          <a
                            href="https://www.tiktok.com/@blancfpt"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-colors shadow-sm"
                            title="TikTok"
                          >
                            <span className="sr-only">TikTok</span>
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
                            </svg>
                          </a>
                        </div>
                      </div>

                      <div className="rounded-xl border border-white/80 bg-white/70 backdrop-blur-sm p-6 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 rounded-full bg-sky-500 text-white flex items-center justify-center shadow-md shadow-sky-200">
                            <Mail className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-600">Hòm thư</p>
                            <p className="text-sm text-slate-500">Trần Hữu Hải Đăng</p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-slate-700 text-sm font-medium break-words">dangthhfct31147@gmail.com</p>
                          <div className="flex items-center gap-2 text-slate-500 text-sm">
                            <Phone className="w-4 h-4 text-sky-500" />
                            <span>+84 339 122 620</span>
                          </div>
                        </div>
                        <div className="flex gap-3 mt-5">
                          <a
                            href="https://www.facebook.com/hai.ang.782631/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center hover:bg-indigo-100 transition-colors shadow-sm"
                            title="Facebook"
                          >
                            <span className="sr-only">Facebook</span>
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
                            </svg>
                          </a>
                          <a
                            href="https://www.tiktok.com/@mrhomeless_12"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-colors shadow-sm"
                            title="TikTok"
                          >
                            <span className="sr-only">TikTok</span>
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
                            </svg>
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-12 pt-8 border-t border-slate-100 flex flex-col md:flex-row justify-center items-center">
              <span className="text-slate-400 text-sm">Made with ❤️ for Education</span>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
};

export default Layout;

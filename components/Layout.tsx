
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Menu, X, Bell, User as UserIcon, LogOut, ChevronDown, Check, Trophy, Users, Info, BookOpen, Loader2, FileText, Flame } from 'lucide-react';
import { Button } from './ui/Common';
import { User, Notification } from '../types';
import { api } from '../lib/api';
import { useStreak } from '../lib/hooks';

interface LayoutProps {
  user: User | null;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ user, onLogout }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoadingNotifs, setIsLoadingNotifs] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const navigate = useNavigate();

  const navItems = [
    { name: 'Trang chủ', path: '/' },
    { name: 'Cuộc thi', path: '/contests' },
    { name: 'Khóa học', path: '/marketplace' },
    { name: 'Cộng đồng', path: '/community' },
  ];

  const unreadCount = notifications.filter(n => !n.isRead).length;

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

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
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

  // Streak Badge Component with milestone animations
  const StreakBadge: React.FC = () => {
    const { currentStreak, todayCheckedIn, isLoading } = useStreak({ autoCheckin: !!user });

    if (isLoading) {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 rounded-full">
          <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
        </div>
      );
    }

    // Get streak styling based on milestones
    const getStreakStyle = () => {
      if (!todayCheckedIn) {
        return {
          containerClass: 'bg-slate-100 text-slate-500',
          flameClass: 'text-slate-400',
          badge: null,
          glow: ''
        };
      }

      // 100+ days - Legendary
      if (currentStreak >= 100) {
        return {
          containerClass: 'bg-linear-to-r from-violet-500 via-purple-500 to-fuchsia-500 text-white shadow-lg shadow-purple-300',
          flameClass: 'animate-fire text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]',
          badge: '👑',
          glow: 'ring-2 ring-purple-300 ring-offset-1'
        };
      }

      // 30+ days - Master
      if (currentStreak >= 30) {
        return {
          containerClass: 'bg-linear-to-r from-amber-400 via-orange-500 to-red-500 text-white shadow-md shadow-orange-200',
          flameClass: 'animate-fire text-red-400 drop-shadow-[0_0_6px_rgba(248,113,113,0.7)]',
          badge: '⭐',
          glow: 'ring-2 ring-orange-200 ring-offset-1'
        };
      }

      // 14+ days - Pro
      if (currentStreak >= 14) {
        return {
          containerClass: 'bg-linear-to-r from-orange-400 to-red-500 text-white shadow-md shadow-red-100',
          flameClass: 'animate-fire text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.6)]',
          badge: '🔥',
          glow: ''
        };
      }

      // 7+ days - Streak
      if (currentStreak >= 7) {
        return {
          containerClass: 'bg-linear-to-r from-yellow-400 to-orange-500 text-white shadow-sm',
          flameClass: 'animate-fire text-orange-500 drop-shadow-[0_0_4px_rgba(249,115,22,0.6)]',
          badge: '🔥',
          glow: ''
        };
      }

      // 3+ days - Starting
      if (currentStreak >= 3) {
        return {
          containerClass: 'bg-linear-to-r from-emerald-400 to-teal-500 text-white',
          flameClass: 'animate-fire text-orange-400',
          badge: '✨',
          glow: ''
        };
      }

      // 1-2 days - New
      return {
        containerClass: 'bg-linear-to-r from-green-400 to-emerald-500 text-white',
        flameClass: 'animate-fire text-red-400',
        badge: null,
        glow: ''
      };
    };

    const style = getStreakStyle();

    return (
      <NavLink
        to="/profile"
        className={`
          group relative flex items-center gap-1.5 px-3 py-1.5 rounded-full 
          transition-all duration-300 ease-out
          hover:scale-110 hover:shadow-lg active:scale-95
          ${style.containerClass} ${style.glow}
        `}
        title={`Chuỗi học tập: ${currentStreak} ngày${todayCheckedIn ? ' ✓' : ''}`}
      >
        {/* Animated flame icon */}
        <Flame className={`w-4 h-4 transition-transform ${style.flameClass}`} />

        {/* Streak number with pop animation on hover */}
        <span className="text-sm font-bold transition-transform group-hover:scale-110">
          {currentStreak}
        </span>

        {/* Milestone badge */}
        {style.badge && (
          <span className="text-xs animate-bounce [animation-duration:2s]">
            {style.badge}
          </span>
        )}

        {/* Sparkle effect for high streaks */}
        {currentStreak >= 30 && todayCheckedIn && (
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-300"></span>
          </span>
        )}
      </NavLink>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans">
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
            <nav className="hidden md:flex space-x-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive
                      ? 'text-primary-700 bg-primary-50'
                      : 'text-slate-600 hover:text-primary-600 hover:bg-slate-50'
                    }`
                  }
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
                  <StreakBadge />

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
                          <button className="text-sm font-medium text-primary-600 hover:text-primary-700">
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
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMenuOpen(false)}
                  className={({ isActive }) =>
                    `block px-3 py-2 rounded-md text-base font-medium ${isActive
                      ? 'text-primary-700 bg-primary-50'
                      : 'text-slate-600 hover:text-primary-600 hover:bg-slate-50'
                    }`
                  }
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
                        <Flame className="w-5 h-5 text-orange-500" />
                        <span className="font-medium text-slate-700">Chuỗi học tập</span>
                      </div>
                      <StreakBadge />
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

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-1">
              <div className="flex items-center mb-4">
                <img src="/logo.png" alt="Blanc Logo" className="h-10 w-10 rounded-full object-cover mr-2" />
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-slate-800 leading-tight">Beyond Learning</span>
                  <span className="text-xs text-slate-500 leading-tight">And New Challenges</span>
                </div>
              </div>
              <p className="text-slate-500 text-sm leading-relaxed">
                Nền tảng kết nối tri thức, nâng tầm bản thân qua các cuộc thi và khóa học chất lượng cao.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">Nền tảng</h3>
              <ul className="space-y-3">
                <li><a href="#" className="text-slate-500 hover:text-primary-600 text-sm">Cuộc thi</a></li>
                <li><a href="#" className="text-slate-500 hover:text-primary-600 text-sm">Khóa học</a></li>
                <li><a href="https://www.facebook.com/profile.php?id=61584015058767" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-primary-600 text-sm">Đối tác</a></li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">Hỗ trợ</h3>
              <ul className="space-y-3">
                <li><NavLink to="/terms" className="text-slate-500 hover:text-primary-600 text-sm">Điều khoản sử dụng</NavLink></li>
                <li><NavLink to="/privacy" className="text-slate-500 hover:text-primary-600 text-sm">Chính sách bảo mật</NavLink></li>
                <li><a href="mailto:dangthhfct31147@gmail.com?subject=Li%C3%AAn%20h%E1%BB%87%20t%E1%BB%AB%20Blanc&body=Xin%20ch%C3%A0o%2C%0A%0AT%C3%B4i%20mu%E1%BB%91n%20li%C3%AAn%20h%E1%BB%87%20v%E1%BB%81..." className="text-slate-500 hover:text-primary-600 text-sm">Liên hệ</a></li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">Liên hệ</h3>
              <ul className="space-y-3">
                <li className="text-slate-500 text-sm">dangthhfct31147@gmail.com</li>
                <li className="text-slate-500 text-sm">+84 339 122 620</li>
                <li className="flex space-x-4 mt-4">
                  {/* Social Links */}
                  <a
                    href="https://www.facebook.com/hai.ang.782631/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 hover:bg-[#1877F2] hover:text-white transition-colors"
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
                    className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 hover:bg-black hover:text-white transition-colors"
                    title="TikTok"
                  >
                    <span className="sr-only">TikTok</span>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
                    </svg>
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-slate-100 flex flex-col md:flex-row justify-center items-center">
            <span className="text-slate-400 text-sm">Made with ❤️ for Education</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;

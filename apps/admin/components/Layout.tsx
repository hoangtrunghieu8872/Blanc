import React, { ReactNode, useState, useEffect, useCallback } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Trophy,
  BookOpen,
  Settings,
  LogOut,
  Menu,
  Bell,
  Search,
  FileText,
  Briefcase,
  Check,
  Info,
  AlertTriangle,
  XCircle,
  Clock,
  ShieldAlert,
  MessageSquare,
  Newspaper,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getAvatarUrl, avatarPresets } from '../utils/avatar';
import {
  notificationService,
  AdminNotification,
  formatRelativeTime
} from '../services/notificationService';

interface LayoutProps {
  children: ReactNode;
}

const SidebarItem = ({ to, icon: Icon, label }: { to: string, icon: React.ElementType, label: string }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors duration-200 ${isActive
        ? 'bg-emerald-50 text-emerald-600 font-medium'
        : 'text-gray-600 hover:bg-gray-50 hover:text-emerald-600'
      }`
    }
  >
    <Icon size={20} />
    <span>{label}</span>
  </NavLink>
);

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const { user, logout } = useAuth();
  const isMentor = user?.role === 'mentor';

  // Notification state
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (isMentor) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    try {
      setIsLoadingNotifications(true);
      const response = await notificationService.getNotifications({ limit: 10 });
      // Ensure title and message are strings (handle if API returns objects)
      const sanitizedNotifications = response.notifications.map(n => ({
        ...n,
        title: typeof n.title === 'object' ? JSON.stringify(n.title) : String(n.title || ''),
        message: typeof n.message === 'object' ? JSON.stringify(n.message) : String(n.message || ''),
      }));
      setNotifications(sanitizedNotifications);
      setUnreadCount(response.unreadCount);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setIsLoadingNotifications(false);
    }
  }, [isMentor]);

  // Initial fetch and polling
  useEffect(() => {
    if (isMentor) return;
    fetchNotifications();

    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications, isMentor]);

  // Mark single notification as read
  const handleMarkAsRead = async (id: string) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  // Mark all as read
  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  // Delete notification
  const handleDeleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await notificationService.deleteNotification(id);
      const deletedNotification = notifications.find(n => n.id === id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      if (deletedNotification && !deletedNotification.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to logout?')) {
      await logout();
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success': return <Check size={16} className="text-green-600" />;
      case 'warning': return <AlertTriangle size={16} className="text-orange-600" />;
      case 'error': return <XCircle size={16} className="text-red-600" />;
      default: return <Info size={16} className="text-blue-600" />;
    }
  };

  const getNotificationBg = (type: string) => {
    switch (type) {
      case 'success': return 'bg-green-100';
      case 'warning': return 'bg-orange-100';
      case 'error': return 'bg-red-100';
      default: return 'bg-blue-100';
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans text-gray-900">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 flex flex-col ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        <div className="flex items-center justify-center h-16 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2 cursor-pointer">
            <img src="/logo.png" alt="Blanc Logo" className="h-10 w-10 rounded-full object-cover" />
            <div className="flex flex-col">
              <span className="text-lg font-bold text-emerald-600 leading-tight">Blanc Admin</span>
              <span className="text-xs text-gray-500 leading-tight">Beyond Learning</span>
            </div>
          </div>
        </div>

        <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
          {!isMentor && <SidebarItem to="/" icon={LayoutDashboard} label="Dashboard" />}
          <SidebarItem to="/reports" icon={FileText} label="Reports" />
          {!isMentor && (
            <>
              <SidebarItem to="/users" icon={Users} label="Students" />
              <SidebarItem to="/contests" icon={Trophy} label="Contests" />
              <SidebarItem to="/courses" icon={FileText} label="Documents" />
              <SidebarItem to="/community" icon={MessageSquare} label="Community" />
              <SidebarItem to="/recruitments" icon={Briefcase} label="Recruitments" />
              <SidebarItem to="/news" icon={Newspaper} label="News & Tips" />
              <SidebarItem to="/mentors" icon={Users} label="Mentor Directory" />
              <SidebarItem to="/mentor-blogs" icon={BookOpen} label="Mentor Blogs" />

              <div className="pt-8 pb-2">
                <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">System</p>
              </div>
              <SidebarItem to="/security" icon={ShieldAlert} label="Security" />
              <SidebarItem to="/audit" icon={FileText} label="Audit Log" />
              <SidebarItem to="/settings" icon={Settings} label="Settings" />
            </>
          )}
        </nav>

        <div className="w-full p-4 border-t border-gray-100 bg-white shrink-0">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full text-gray-600 hover:text-red-600 transition-colors"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6 lg:px-8 relative z-30">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title="Toggle menu"
            className="lg:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-md"
          >
            <Menu size={24} />
          </button>

          <div className="flex items-center bg-gray-100 rounded-lg px-3 py-2 w-full max-w-md mx-4 lg:mx-0">
            <Search size={18} className="text-gray-400" />
            <input
              type="text"
              placeholder="Search anything..."
              className="bg-transparent border-none outline-none text-sm ml-2 w-full text-gray-700 placeholder-gray-400"
            />
          </div>

          <div className="flex items-center gap-4">
            {!isMentor && (
              <>
                {/* Notification Button & Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-full outline-none transition-colors"
                  >
                    <Bell size={20} />
                    {unreadCount > 0 && (
                      <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 bg-red-500 border-2 border-white rounded-full"></span>
                    )}
                  </button>

              {showNotifications && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)}></div>
                  <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden animate-fade-in-up origin-top-right">
                    <div className="px-4 py-3 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">Notifications</h3>
                        <button
                          onClick={fetchNotifications}
                          className="p-1 text-gray-400 hover:text-gray-600 rounded"
                          title="Refresh"
                        >
                          <RefreshCw size={14} className={isLoadingNotifications ? 'animate-spin' : ''} />
                        </button>
                      </div>
                      {unreadCount > 0 && (
                        <button
                          onClick={handleMarkAllAsRead}
                          className="text-xs text-emerald-600 font-medium hover:text-emerald-700"
                        >
                          Mark all as read
                        </button>
                      )}
                    </div>
                    <div className="max-h-[400px] overflow-y-auto">
                      {isLoadingNotifications && notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center">
                          <RefreshCw size={24} className="animate-spin mx-auto text-gray-400 mb-2" />
                          <p className="text-sm text-gray-500">Loading...</p>
                        </div>
                      ) : notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center">
                          <Bell size={32} className="mx-auto text-gray-300 mb-2" />
                          <p className="text-sm text-gray-500">No notifications</p>
                        </div>
                      ) : (
                        notifications.map((notification) => (
                          <div
                            key={notification.id}
                            onClick={() => !notification.read && handleMarkAsRead(notification.id)}
                            className={`px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 cursor-pointer group ${!notification.read ? 'bg-emerald-50/30' : ''}`}
                          >
                            <div className="flex gap-3">
                              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${getNotificationBg(notification.type)}`}>
                                {getNotificationIcon(notification.type)}
                              </div>
                              <div className="flex-1 space-y-1 min-w-0">
                                <div className="flex justify-between items-start gap-2">
                                  <p className={`text-sm truncate ${!notification.read ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                                    {notification.title}
                                  </p>
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    {!notification.read && <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>}
                                    <button
                                      onClick={(e) => handleDeleteNotification(notification.id, e)}
                                      className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                      title="Delete"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </div>
                                <p className="text-xs text-gray-500 line-clamp-2">{notification.message}</p>
                                <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-1">
                                  <Clock size={10} />
                                  {formatRelativeTime(notification.createdAt)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="p-2 border-t border-gray-50 bg-gray-50/30 text-center">
                      <button className="text-xs text-gray-500 hover:text-gray-800 font-medium w-full py-1">
                        View all notifications
                      </button>
                    </div>
                  </div>
                </>
              )}
                </div>
              </>
            )}

            <div className={`flex items-center gap-3 ${isMentor ? '' : 'border-l border-gray-200 pl-4'}`}>
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-gray-900">{user?.name || 'Admin User'}</p>
                <p className="text-xs text-gray-500">
                  {user?.role === 'super_admin' ? 'Super Admin' : user?.role === 'mentor' ? 'Mentor' : 'Admin'}
                </p>
              </div>
              <img
                src={getAvatarUrl(user?.avatar, user?.name, avatarPresets.sidebar)}
                alt="Admin"
                className="h-9 w-9 rounded-full border-2 border-emerald-100"
              />
            </div>
          </div>
        </header>

        {/* Scrollable Area */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;

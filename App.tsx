import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import ChatBubble from './components/ChatBubble';
import { ContestList, ContestDetail } from './pages/Contests';
import { Marketplace, CourseDetail } from './pages/Marketplace';
import Community from './pages/Community';
import Profile from './pages/Profile';
import UserProfile from './pages/UserProfile';
import MyTeamPosts from './pages/MyTeamPosts';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import Auth from './pages/Auth';
import ForgotPassword from './pages/ForgotPassword';
import MaintenancePage from './components/MaintenancePage';
import { User } from './types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

// Helper to get user from localStorage
function getStoredUser(): User | null {
  try {
    const token = localStorage.getItem('auth_token');
    const userStr = localStorage.getItem('user');
    if (token && userStr) {
      return JSON.parse(userStr);
    }
  } catch {
    // Invalid data, clear it
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
  }
  return null;
}

const App: React.FC = () => {
  // Auth state from localStorage
  const [user, setUser] = useState<User | null>(getStoredUser);

  // Maintenance mode state
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [siteName, setSiteName] = useState('Blanc');
  const [isCheckingMaintenance, setIsCheckingMaintenance] = useState(true);

  // Check maintenance mode on mount
  useEffect(() => {
    const checkMaintenanceMode = async () => {
      try {
        const response = await fetch(`${API_BASE}/admin/status`);
        if (response.ok) {
          const data = await response.json();
          setIsMaintenanceMode(data.maintenanceMode || false);
          setSiteName(data.siteName || 'Blanc');
        }
      } catch (error) {
        console.error('Failed to check maintenance status:', error);
        // If API fails, assume not in maintenance mode
        setIsMaintenanceMode(false);
      } finally {
        setIsCheckingMaintenance(false);
      }
    };

    checkMaintenanceMode();

    // Check every 30 seconds for maintenance mode changes
    const interval = setInterval(checkMaintenanceMode, 30000);
    return () => clearInterval(interval);
  }, []);

  // Listen for storage changes (login/logout from other tabs)
  useEffect(() => {
    const handleStorageChange = () => {
      setUser(getStoredUser());
    };

    window.addEventListener('storage', handleStorageChange);

    // Also listen for custom event from Auth component
    window.addEventListener('auth-change', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth-change', handleStorageChange);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    setUser(null);
    window.dispatchEvent(new Event('auth-change'));
  };

  // Show loading while checking maintenance mode
  if (isCheckingMaintenance) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Show maintenance page if in maintenance mode (except for admin users)
  if (isMaintenanceMode && user?.role !== 'admin') {
    return <MaintenancePage siteName={siteName} />;
  }

  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout user={user} onLogout={handleLogout} />}>
          <Route path="/" element={<Home />} />
          <Route path="/contests" element={<ContestList />} />
          <Route path="/contests/:id" element={<ContestDetail />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/courses/:id" element={<CourseDetail />} />
          <Route path="/community" element={<Community />} />
          <Route path="/my-team-posts" element={user ? <MyTeamPosts /> : <Navigate to="/login" />} />
          <Route path="/profile" element={user ? <Profile /> : <Navigate to="/login" />} />
          <Route path="/user/:userId" element={user ? <UserProfile /> : <Navigate to="/login" />} />
        </Route>

        {/* Auth routes */}
        <Route path="/login" element={<Auth type="login" />} />
        <Route path="/register" element={<Auth type="register" />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* Legal pages */}
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />

        {/* Admin routes (Placeholder) */}
        <Route path="/admin" element={<div className="p-8">Admin Panel Placeholder</div>} />
      </Routes>

      {/* AI Chat Assistant - only show when logged in */}
      {user && <ChatBubble />}
    </HashRouter>
  );
};

export default App;

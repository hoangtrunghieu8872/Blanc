import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Layout
import Layout from './components/Layout';

// Components
import ChatBubble from './components/ChatBubble';

// Pages
import Home from './pages/Home';
import Auth from './pages/Auth';
import { ContestList, ContestDetail } from './pages/Contests';
import { Marketplace, CourseDetail } from './pages/Marketplace';
import Community from './pages/Community';
import News from './pages/News';
import Profile from './pages/Profile';
import UserProfile from './pages/UserProfile';
import MyTeamPosts from './pages/MyTeamPosts';
import Reports from './pages/Reports';
import ReportTemplates from './pages/ReportTemplates';
import ForgotPassword from './pages/ForgotPassword';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';

// Types
import { User } from './types';

// Auth modal event listener type
interface AuthModalDetail {
    mode: 'login' | 'register';
}

const App: React.FC = () => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Initialize user from localStorage
    useEffect(() => {
        const initAuth = () => {
            try {
                const token = localStorage.getItem('auth_token');
                const userStr = localStorage.getItem('user');

                if (token && userStr) {
                    const userData = JSON.parse(userStr);
                    setUser(userData);
                }
            } catch (err) {
                console.error('Failed to parse user data:', err);
                localStorage.removeItem('auth_token');
                localStorage.removeItem('user');
            } finally {
                setIsLoading(false);
            }
        };

        initAuth();

        // Listen for auth changes from other components
        const handleAuthChange = () => {
            const userStr = localStorage.getItem('user');
            if (userStr) {
                try {
                    setUser(JSON.parse(userStr));
                } catch {
                    setUser(null);
                }
            } else {
                setUser(null);
            }
        };

        window.addEventListener('auth-change', handleAuthChange);
        window.addEventListener('storage', handleAuthChange);

        return () => {
            window.removeEventListener('auth-change', handleAuthChange);
            window.removeEventListener('storage', handleAuthChange);
        };
    }, []);

    // Logout handler
    const handleLogout = useCallback(() => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        setUser(null);
        window.dispatchEvent(new Event('auth-change'));
    }, []);

    // Loading state
    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    return (
        <BrowserRouter>
            <Toaster
                position="top-center"
                toastOptions={{
                    duration: 4000,
                    style: {
                        background: '#fff',
                        color: '#1e293b',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                        borderRadius: '12px',
                        padding: '12px 16px',
                    },
                    success: {
                        iconTheme: {
                            primary: '#10b981',
                            secondary: '#fff',
                        },
                    },
                    error: {
                        iconTheme: {
                            primary: '#ef4444',
                            secondary: '#fff',
                        },
                    },
                }}
            />

            {/* Chatbot */}
            <ChatBubble />

            <Routes>
                {/* Auth routes - no layout */}
                <Route path="/login" element={user ? <Navigate to="/" replace /> : <Auth type="login" />} />
                <Route path="/register" element={user ? <Navigate to="/" replace /> : <Auth type="register" />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />

                {/* Main routes with layout */}
                <Route element={<Layout user={user} onLogout={handleLogout} />}>
                    <Route path="/" element={<Home />} />
                    <Route path="/contests" element={<ContestList />} />
                    <Route path="/contests/:id" element={<ContestDetail />} />
                    <Route path="/marketplace" element={<Marketplace />} />
                    <Route path="/courses/:id" element={<CourseDetail />} />
                    <Route path="/community" element={<Community />} />
                    <Route path="/news" element={<News />} />
                    <Route path="/reports" element={user ? <Reports /> : <Navigate to="/login" replace />} />
                    <Route path="/reports/new" element={user ? <ReportTemplates /> : <Navigate to="/login" replace />} />
                    <Route path="/profile" element={user ? <Profile /> : <Navigate to="/login" replace />} />
                    <Route path="/user/:id" element={<UserProfile />} />
                    <Route path="/my-team-posts" element={user ? <MyTeamPosts /> : <Navigate to="/login" replace />} />
                    <Route path="/terms" element={<Terms />} />
                    <Route path="/privacy" element={<Privacy />} />
                </Route>

                {/* Catch all - redirect to home */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
};

export default App;

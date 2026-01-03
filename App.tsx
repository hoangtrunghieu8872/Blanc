import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Layout
import Layout from './components/Layout';
import ScrollToTop from './components/ScrollToTop';
import LoadingSpinner from './components/LoadingSpinner';

// Components
import ChatBubble from './components/ChatBubble';

// Pages - Direct imports for critical pages
import Home from './pages/Home';
import Auth from './pages/Auth';
import ForgotPassword from './pages/ForgotPassword';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';

// Lazy-loaded pages for better code splitting
const ContestList = lazy(() => import('./pages/Contests').then(m => ({ default: m.ContestList })));
const ContestDetail = lazy(() => import('./pages/Contests').then(m => ({ default: m.ContestDetail })));
const Marketplace = lazy(() => import('./pages/Marketplace').then(m => ({ default: m.Marketplace })));
const CourseDetail = lazy(() => import('./pages/Marketplace').then(m => ({ default: m.CourseDetail })));
const Documents = lazy(() => import('./pages/Documents'));
const Community = lazy(() => import('./pages/Community'));
const News = lazy(() => import('./pages/News'));
const MentorList = lazy(() => import('./pages/Mentors').then(m => ({ default: m.MentorList })));
const MentorDetail = lazy(() => import('./pages/Mentors').then(m => ({ default: m.MentorDetail })));
const Profile = lazy(() => import('./pages/Profile'));
const UserProfile = lazy(() => import('./pages/UserProfile'));
const MyTeamPosts = lazy(() => import('./pages/MyTeamPosts'));
const Reports = lazy(() => import('./pages/Reports'));
const ReportTemplates = lazy(() => import('./pages/ReportTemplates'));

// Types
import { User } from './types';
import { api, invalidateCache } from './lib/api';
import { clientStorage, localDrafts } from './lib/cache';

// Auth modal event listener type
interface AuthModalDetail {
    mode: 'login' | 'register';
}

const DEFAULT_SESSION_TIMEOUT_MINUTES = 30;
const IDLE_ACTIVITY_KEY = clientStorage.buildKey('session', 'last_activity');
const IDLE_USER_KEY = clientStorage.buildKey('session', 'last_activity_user');
const IDLE_ACTIVITY_THROTTLE_MS = 5000;

const App: React.FC = () => {
    const isChatEnabled = import.meta.env.VITE_CHAT_ENABLED === 'true';
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [sessionTimeoutMs, setSessionTimeoutMs] = useState(DEFAULT_SESSION_TIMEOUT_MINUTES * 60 * 1000);
    const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastActivityRef = useRef<number>(Date.now());
    const lastPersistedActivityRef = useRef<number>(0);

    // Initialize user from localStorage
    useEffect(() => {
        const initAuth = async () => {
            try {
                const userStr = localStorage.getItem('user');

                if (userStr) {
                    const userData = JSON.parse(userStr);
                    setUser(userData);
                }

                // Always re-sync user from backend when possible (keeps membership in sync)
                try {
                    const me = await api.get<{ user: User }>('/auth/me');
                    if (me?.user) {
                        localStorage.setItem('user', JSON.stringify(me.user));
                        setUser(me.user);
                    }
                } catch (err) {
                    const message = err instanceof Error ? err.message : String(err || '');
                    const looksUnauthorized =
                        message.includes('Unauthorized') ||
                        message.includes('Invalid or expired token') ||
                        message.includes('HTTP error! status: 401');

                    if (looksUnauthorized) {
                        localStorage.removeItem('user');
                        localStorage.removeItem(IDLE_ACTIVITY_KEY);
                        localStorage.removeItem(IDLE_USER_KEY);
                        setUser(null);
                        invalidateCache.all();
                        localDrafts.clear();
                    }
                }
            } catch (err) {
                console.error('Failed to parse user data:', err);
                localStorage.removeItem('user');
                localStorage.removeItem(IDLE_ACTIVITY_KEY);
                localStorage.removeItem(IDLE_USER_KEY);
                setUser(null);
                invalidateCache.all();
                localDrafts.clear();
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
                localStorage.removeItem(IDLE_ACTIVITY_KEY);
                localStorage.removeItem(IDLE_USER_KEY);
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

    useEffect(() => {
        let isMounted = true;

        const loadSessionTimeout = async () => {
            try {
                const status = await api.get<{ sessionTimeout?: number }>('/admin/status');
                const timeoutMinutes = Number(status?.sessionTimeout);
                if (isMounted && Number.isFinite(timeoutMinutes) && timeoutMinutes > 0) {
                    setSessionTimeoutMs(timeoutMinutes * 60 * 1000);
                }
            } catch {
                // Ignore failures and keep the default timeout
            }
        };

        loadSessionTimeout();

        return () => {
            isMounted = false;
        };
    }, []);

    // Logout handler
    const handleLogout = useCallback(() => {
        (async () => {
            try {
                await api.post('/auth/logout');
            } catch {
                // Ignore logout errors - we still clear local state
            }

            invalidateCache.all();
            localDrafts.clear();
            localStorage.removeItem('user');
            localStorage.removeItem(IDLE_ACTIVITY_KEY);
            localStorage.removeItem(IDLE_USER_KEY);
            setUser(null);
            window.dispatchEvent(new Event('auth-change'));
        })();
    }, []);

    useEffect(() => {
        if (!user) {
            if (idleTimerRef.current) {
                clearTimeout(idleTimerRef.current);
                idleTimerRef.current = null;
            }
            return;
        }

        const timeoutMs = Number(sessionTimeoutMs);
        if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
            return;
        }

        const now = Date.now();
        const storedUserId = localStorage.getItem(IDLE_USER_KEY);
        const storedActivity = Number(localStorage.getItem(IDLE_ACTIVITY_KEY));

        if (storedUserId !== user.id || !Number.isFinite(storedActivity) || storedActivity <= 0) {
            lastActivityRef.current = now;
            lastPersistedActivityRef.current = now;
            localStorage.setItem(IDLE_USER_KEY, user.id);
            localStorage.setItem(IDLE_ACTIVITY_KEY, String(now));
        } else {
            lastActivityRef.current = storedActivity;
        }

        const scheduleLogoutCheck = () => {
            if (idleTimerRef.current) {
                clearTimeout(idleTimerRef.current);
            }

            const elapsed = Date.now() - lastActivityRef.current;
            const remaining = timeoutMs - elapsed;

            if (remaining <= 0) {
                handleLogout();
                return;
            }

            idleTimerRef.current = setTimeout(() => {
                const elapsedNow = Date.now() - lastActivityRef.current;
                if (elapsedNow >= timeoutMs) {
                    handleLogout();
                    return;
                }
                scheduleLogoutCheck();
            }, remaining);
        };

        const recordActivity = () => {
            const timestamp = Date.now();
            lastActivityRef.current = timestamp;

            if (timestamp - lastPersistedActivityRef.current < IDLE_ACTIVITY_THROTTLE_MS) {
                return;
            }

            lastPersistedActivityRef.current = timestamp;
            localStorage.setItem(IDLE_ACTIVITY_KEY, String(timestamp));
            scheduleLogoutCheck();
        };

        const handleStorage = (event: StorageEvent) => {
            if (event.key !== IDLE_ACTIVITY_KEY || !event.newValue) return;
            const next = Number(event.newValue);
            if (!Number.isFinite(next) || next <= lastActivityRef.current) return;
            lastActivityRef.current = next;
            scheduleLogoutCheck();
        };

        const handleVisibility = () => {
            if (!document.hidden) {
                recordActivity();
            }
        };

        const eventOptions: AddEventListenerOptions = { passive: true };
        const activityEvents: Array<keyof WindowEventMap> = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];

        activityEvents.forEach((eventName) => {
            window.addEventListener(eventName, recordActivity, eventOptions);
        });
        window.addEventListener('focus', recordActivity);
        window.addEventListener('storage', handleStorage);
        document.addEventListener('visibilitychange', handleVisibility);

        scheduleLogoutCheck();

        return () => {
            if (idleTimerRef.current) {
                clearTimeout(idleTimerRef.current);
                idleTimerRef.current = null;
            }
            activityEvents.forEach((eventName) => {
                window.removeEventListener(eventName, recordActivity, eventOptions);
            });
            window.removeEventListener('focus', recordActivity);
            window.removeEventListener('storage', handleStorage);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [handleLogout, sessionTimeoutMs, user]);

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
            <ScrollToTop />
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
            {isChatEnabled && <ChatBubble />}

            <Routes>
                {/* Auth routes - no layout */}
                <Route path="/login" element={user ? <Navigate to="/" replace /> : <Auth type="login" />} />
                <Route path="/register" element={user ? <Navigate to="/" replace /> : <Auth type="register" />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />

                {/* Main routes with layout */}
                <Route element={<Layout user={user} onLogout={handleLogout} />}>
                    <Route path="/" element={<Home />} />
                    <Route path="/contests" element={
                        <Suspense fallback={<LoadingSpinner fullScreen />}>
                            <ContestList />
                        </Suspense>
                    } />
                    <Route path="/contests/:id" element={
                        <Suspense fallback={<LoadingSpinner fullScreen />}>
                            <ContestDetail />
                        </Suspense>
                    } />
                    <Route path="/marketplace" element={
                        <Suspense fallback={<LoadingSpinner fullScreen />}>
                            <Marketplace />
                        </Suspense>
                    } />
                    <Route path="/courses/:id" element={
                        <Suspense fallback={<LoadingSpinner fullScreen />}>
                            <CourseDetail />
                        </Suspense>
                    } />
                    <Route path="/documents" element={
                        <Suspense fallback={<LoadingSpinner fullScreen />}>
                            <Documents />
                        </Suspense>
                    } />
                    <Route path="/community" element={
                        <Suspense fallback={<LoadingSpinner fullScreen />}>
                            <Community />
                        </Suspense>
                    } />
                    <Route path="/news" element={
                        <Suspense fallback={<LoadingSpinner fullScreen />}>
                            <News />
                        </Suspense>
                    } />
                    <Route path="/mentors" element={
                        <Suspense fallback={<LoadingSpinner fullScreen />}>
                            <MentorList />
                        </Suspense>
                    } />
                    <Route path="/mentors/:id" element={
                        <Suspense fallback={<LoadingSpinner fullScreen />}>
                            <MentorDetail />
                        </Suspense>
                    } />
                    <Route
                        path="/reports"
                        element={
                            user ? (
                                <Suspense fallback={<LoadingSpinner fullScreen />}>
                                    <Reports />
                                </Suspense>
                            ) : <Navigate to="/login" replace />
                        }
                    />
                    <Route
                        path="/reports/new"
                        element={
                            user ? (
                                <Suspense fallback={<LoadingSpinner fullScreen />}>
                                    <ReportTemplates />
                                </Suspense>
                            ) : <Navigate to="/login" replace />
                        }
                    />
                    <Route path="/profile" element={
                        user ? (
                            <Suspense fallback={<LoadingSpinner fullScreen />}>
                                <Profile />
                            </Suspense>
                        ) : <Navigate to="/login" replace />
                    } />
                    <Route path="/user/:id" element={
                        <Suspense fallback={<LoadingSpinner fullScreen />}>
                            <UserProfile />
                        </Suspense>
                    } />
                    <Route path="/my-team-posts" element={
                        user ? (
                            <Suspense fallback={<LoadingSpinner fullScreen />}>
                                <MyTeamPosts />
                            </Suspense>
                        ) : <Navigate to="/login" replace />
                    } />
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

/**
 * Authentication Context
 * Provides secure authentication state management with:
 * - Login/Logout functionality
 * - 2FA support (mandatory for admin)
 * - Token refresh
 * - Protected route wrapper
 * - User session management
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import api, { tokenManager, ApiError } from '../services/api';

// Types
export interface AdminUser {
    id: string;
    email: string;
    name: string;
    role: 'admin' | 'super_admin' | 'mentor' | 'student';
    avatar?: string;
    permissions?: string[];
}

interface LoginCredentials {
    email: string;
    password: string;
}

interface LoginInitiateResponse {
    requiresOTP: boolean;
    sessionToken?: string;
    token?: string;
    user?: AdminUser;
    message: string;
}

interface AuthState {
    user: AdminUser | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
    // 2FA state
    pending2FA: {
        email: string;
        sessionToken: string;
    } | null;
}

interface AuthContextValue extends AuthState {
    login: (credentials: LoginCredentials) => Promise<{ success: boolean; requires2FA: boolean }>;
    verify2FA: (otp: string) => Promise<boolean>;
    resendOTP: () => Promise<boolean>;
    logout: () => Promise<void>;
    clearError: () => void;
    checkAuth: () => Promise<void>;
    cancel2FA: () => void;
}

// Create context
const AuthContext = createContext<AuthContextValue | null>(null);

// Auth Provider component
interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [state, setState] = useState<AuthState>({
        user: null,
        isAuthenticated: false,
        isLoading: true,
        error: null,
        pending2FA: null,
    });

    // Helper: Check if user can access privileged area (admin/mentor)
    const isPrivilegedRole = (role: string): boolean => {
        return role === 'admin' || role === 'super_admin' || role === 'mentor';
    };

    // Check authentication status on mount
    const checkAuth = useCallback(async () => {
        setState(prev => ({ ...prev, isLoading: true }));
        try {
            const response = await api.get<{ user: AdminUser }>('/auth/me');
            const userData = response.data.user;

            // SECURITY: Verify user has privileged role
            if (!isPrivilegedRole(userData.role)) {
                tokenManager.clearTokens();
                setState({
                    user: null,
                    isAuthenticated: false,
                    isLoading: false,
                    error: 'Access denied. Privileged access required.',
                    pending2FA: null,
                });
                return;
            }

            setState({
                user: userData,
                isAuthenticated: true,
                isLoading: false,
                error: null,
                pending2FA: null,
            });
        } catch {
            tokenManager.clearTokens();
            setState({
                user: null,
                isAuthenticated: false,
                isLoading: false,
                error: null,
                pending2FA: null,
            });
        }
    }, []);

    // Login function - Step 1: Initiate login (may require 2FA)
    const login = useCallback(async (credentials: LoginCredentials): Promise<{ success: boolean; requires2FA: boolean }> => {
        setState(prev => ({ ...prev, isLoading: true, error: null, pending2FA: null }));

        try {
            // Validate email format
            if (!credentials.email || !credentials.email.includes('@')) {
                throw new Error('Please enter a valid email address');
            }

            // Validate password
            if (!credentials.password || credentials.password.length < 6) {
                throw new Error('Password must be at least 6 characters');
            }

            // Generate session token for 2FA flow
            const sessionToken = crypto.randomUUID();

            // Use 2FA login flow: /auth/login/initiate
            const response = await api.post<LoginInitiateResponse>(
                '/auth/login/initiate',
                { ...credentials, sessionToken },
                { skipAuth: true }
            );

            // Check if 2FA is required
            if (response.data.requiresOTP) {
                const otpSessionToken = response.data.sessionToken || sessionToken;

                // Request OTP to be sent to user's email
                try {
                    await api.post('/otp/request', {
                        email: credentials.email.toLowerCase().trim(),
                        sessionToken: otpSessionToken,
                        action: 'login_2fa'
                    }, { skipAuth: true });
                } catch (otpError) {
                    console.error('[Auth] Failed to request OTP:', otpError);
                    // Continue with 2FA flow even if OTP request fails
                    // User can use resend button if needed
                }

                // Store pending 2FA state for non-exempt accounts
                setState(prev => ({
                    ...prev,
                    isLoading: false,
                    pending2FA: {
                        email: credentials.email,
                        sessionToken: otpSessionToken,
                    },
                }));
                return { success: true, requires2FA: true };
            }

            // No 2FA required - direct login
            const userData = response.data.user;

            // SECURITY: Verify privileged role
            if (!userData || !isPrivilegedRole(userData.role)) {
                throw new Error('Access denied. Privileged access required.');
            }

            // Prefer httpOnly cookie auth; avoid persisting tokens in localStorage
            tokenManager.clearTokens();

            setState({
                user: userData,
                isAuthenticated: true,
                isLoading: false,
                error: null,
                pending2FA: null,
            });

            return { success: true, requires2FA: false };
        } catch (error) {
            const message = error instanceof ApiError
                ? error.message
                : error instanceof Error
                    ? error.message
                    : 'Login failed. Please try again.';

            setState(prev => ({
                ...prev,
                isLoading: false,
                error: message,
                pending2FA: null,
            }));

            return { success: false, requires2FA: false };
        }
    }, []);

    // Verify 2FA - Step 2: Complete login with OTP
    const verify2FA = useCallback(async (otp: string): Promise<boolean> => {
        if (!state.pending2FA) {
            setState(prev => ({ ...prev, error: 'No pending 2FA session' }));
            return false;
        }

        setState(prev => ({ ...prev, isLoading: true, error: null }));

        try {
            const response = await api.post<{
                user: AdminUser;
                token: string;
            }>('/auth/login/verify-2fa', {
                email: state.pending2FA.email,
                sessionToken: state.pending2FA.sessionToken,
                otp,
            }, { skipAuth: true });

            const userData = response.data.user;

            // SECURITY: Verify privileged role
            if (!isPrivilegedRole(userData.role)) {
                throw new Error('Access denied. Privileged access required.');
            }

            // Prefer httpOnly cookie auth; avoid persisting tokens in localStorage
            tokenManager.clearTokens();

            setState({
                user: userData,
                isAuthenticated: true,
                isLoading: false,
                error: null,
                pending2FA: null,
            });

            return true;
        } catch (error) {
            const message = error instanceof ApiError
                ? error.message
                : error instanceof Error
                    ? error.message
                    : '2FA verification failed. Please try again.';

            setState(prev => ({
                ...prev,
                isLoading: false,
                error: message,
            }));

            return false;
        }
    }, [state.pending2FA]);

    // Resend OTP for 2FA
    const resendOTP = useCallback(async (): Promise<boolean> => {
        if (!state.pending2FA) {
            setState(prev => ({ ...prev, error: 'No pending 2FA session' }));
            return false;
        }

        try {
            await api.post('/otp/request', {
                email: state.pending2FA.email.toLowerCase().trim(),
                sessionToken: state.pending2FA.sessionToken,
                action: 'login_2fa'
            }, { skipAuth: true });

            return true;
        } catch (error) {
            const message = error instanceof ApiError
                ? error.message
                : 'Failed to resend OTP. Please try again.';

            setState(prev => ({ ...prev, error: message }));
            return false;
        }
    }, [state.pending2FA]);

    // Cancel 2FA flow
    const cancel2FA = useCallback(() => {
        setState(prev => ({
            ...prev,
            pending2FA: null,
            error: null,
        }));
    }, []);

    // Logout function
    const logout = useCallback(async () => {
        try {
            await api.post('/auth/logout', undefined, { skipAuth: true });
        } catch {
            // Continue with local logout even if server request fails
        } finally {
            tokenManager.clearTokens();
            setState({
                user: null,
                isAuthenticated: false,
                isLoading: false,
                error: null,
                pending2FA: null,
            });
        }
    }, []);

    // Clear error
    const clearError = useCallback(() => {
        setState(prev => ({ ...prev, error: null }));
    }, []);

    // Listen for auth logout events (from api interceptor)
    useEffect(() => {
        const handleLogout = () => {
            setState({
                user: null,
                isAuthenticated: false,
                isLoading: false,
                error: 'Session expired. Please login again.',
                pending2FA: null,
            });
        };

        window.addEventListener('auth:logout', handleLogout);
        return () => window.removeEventListener('auth:logout', handleLogout);
    }, []);

    // Check auth on mount
    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    const contextValue: AuthContextValue = {
        ...state,
        login,
        verify2FA,
        resendOTP,
        logout,
        clearError,
        checkAuth,
        cancel2FA,
    };

    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    );
};

// Hook to use auth context
export const useAuth = (): AuthContextValue => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

// Protected Route Component
interface ProtectedRouteProps {
    children: ReactNode;
    requiredPermissions?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
    children,
    requiredPermissions = []
}) => {
    const { isAuthenticated, isLoading, user } = useAuth();

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        // Will be handled by App.tsx router
        return null;
    }

    // Check permissions if required
    if (requiredPermissions.length > 0 && user) {
        const hasPermission = requiredPermissions.every(
            permission => (user.permissions || []).includes(permission)
        );

        if (!hasPermission) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-50">
                    <div className="text-center p-8">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
                        <p className="text-gray-600">You don't have permission to access this page.</p>
                    </div>
                </div>
            );
        }
    }

    return <>{children}</>;
};

export default AuthContext;

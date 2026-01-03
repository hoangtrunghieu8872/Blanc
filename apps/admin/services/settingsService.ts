/**
 * Settings Service
 * API operations for platform settings management
 * Sử dụng API backend /api/admin/settings
 */

import api, { ApiError, tokenManager } from './api';

export interface PlatformSettings {
    general: {
        siteName: string;
        supportEmail: string;
        maintenanceMode: boolean;
        defaultLanguage: string;
        timezone: string;
    };
    notifications: {
        emailNotifications: boolean;
        pushNotifications: boolean;
        marketingEmails: boolean;
        systemAlerts: boolean;
    };
    security: {
        twoFactorRequired: boolean;
        sessionTimeout: number;
        passwordMinLength: number;
        maxLoginAttempts: number;
        ipWhitelist: string[];
    };
    features: {
        contestsEnabled: boolean;
        coursesEnabled: boolean;
        teamsEnabled: boolean;
        paymentsEnabled: boolean;
    };
}

// Default settings (fallback)
const defaultSettings: PlatformSettings = {
    general: {
        siteName: 'Blanc',
        supportEmail: 'support@blanc.com',
        maintenanceMode: false,
        defaultLanguage: 'vi',
        timezone: 'Asia/Ho_Chi_Minh',
    },
    notifications: {
        emailNotifications: true,
        pushNotifications: true,
        marketingEmails: false,
        systemAlerts: true,
    },
    security: {
        twoFactorRequired: false,
        sessionTimeout: 30,
        passwordMinLength: 8,
        maxLoginAttempts: 5,
        ipWhitelist: [],
    },
    features: {
        contestsEnabled: true,
        coursesEnabled: true,
        teamsEnabled: true,
        paymentsEnabled: false,
    },
};

// API keys still use localStorage (no backend endpoint)
const API_KEYS_KEY = 'blanc_admin_api_keys';

interface ApiKey {
    id: string;
    name: string;
    key: string;
    createdAt: string;
    lastUsed?: string;
}

const getStoredApiKeys = (): ApiKey[] => {
    try {
        const stored = localStorage.getItem(API_KEYS_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (error) {
        console.error('Error reading API keys from localStorage:', error);
    }
    return [];
};

const saveApiKeys = (keys: ApiKey[]): void => {
    try {
        localStorage.setItem(API_KEYS_KEY, JSON.stringify(keys));
    } catch (error) {
        console.error('Error saving API keys to localStorage:', error);
    }
};

export const settingsService = {
    /**
     * Get all platform settings from API
     */
    getAll: async (): Promise<PlatformSettings> => {
        try {
            const response = await api.get<PlatformSettings>('/admin/settings');
            return { ...defaultSettings, ...response.data };
        } catch (error) {
            // Avoid noisy logs for expected 401s (e.g., expired session)
            if (!(error instanceof ApiError) || error.status !== 401) {
                console.error('Failed to fetch settings from API:', error);
            }
            return defaultSettings;
        }
    },

    /**
     * Update general settings
     */
    updateGeneral: async (settings: Partial<PlatformSettings['general']>): Promise<PlatformSettings['general']> => {
        const response = await api.patch<PlatformSettings['general']>('/admin/settings/general', settings);
        return response.data;
    },

    /**
     * Update notification settings
     */
    updateNotifications: async (settings: Partial<PlatformSettings['notifications']>): Promise<PlatformSettings['notifications']> => {
        const response = await api.patch<PlatformSettings['notifications']>('/admin/settings/notifications', settings);
        return response.data;
    },

    /**
     * Update security settings
     */
    updateSecurity: async (settings: Partial<PlatformSettings['security']>): Promise<PlatformSettings['security']> => {
        const response = await api.patch<PlatformSettings['security']>('/admin/settings/security', settings);
        return response.data;
    },

    /**
     * Update feature flags
     */
    updateFeatures: async (settings: Partial<PlatformSettings['features']>): Promise<PlatformSettings['features']> => {
        const response = await api.patch<PlatformSettings['features']>('/admin/settings/features', settings);
        return response.data;
    },

    /**
     * Reset all sessions
     */
    resetAllSessions: async (): Promise<{ sessionsCleared: number }> => {
        const response = await api.post<{ sessionsCleared: number }>('/admin/settings/reset-sessions');
        return response.data;
    },

    /**
     * Get API keys (from localStorage - no backend endpoint)
     */
    getApiKeys: async (): Promise<ApiKey[]> => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return getStoredApiKeys();
    },

    /**
     * Generate new API key
     */
    generateApiKey: async (name: string): Promise<ApiKey> => {
        await new Promise(resolve => setTimeout(resolve, 200));
        const newKey: ApiKey = {
            id: `key_${Date.now()}`,
            name,
            key: `ch_${btoa(Math.random().toString(36)).substring(0, 32)}`,
            createdAt: new Date().toISOString(),
        };
        const keys = getStoredApiKeys();
        keys.push(newKey);
        saveApiKeys(keys);
        return newKey;
    },

    /**
     * Revoke API key
     */
    revokeApiKey: async (id: string): Promise<void> => {
        await new Promise(resolve => setTimeout(resolve, 100));
        const keys = getStoredApiKeys().filter(k => k.id !== id);
        saveApiKeys(keys);
    },

    /**
     * Test email configuration (real API call)
     */
    testEmailConfig: async (email: string): Promise<{ success: boolean; message: string }> => {
        const response = await api.post<{ success: boolean; message: string }>('/admin/email/test', { email });
        return response.data;
    },

    /**
     * Send test email
     */
    sendTestEmail: async (email: string): Promise<{ success: boolean; message: string }> => {
        const response = await api.post<{ success: boolean; message: string }>('/admin/email/test', { email });
        return response.data;
    },

    /**
     * Broadcast email to users
     */
    broadcastEmail: async (data: {
        subject: string;
        content: string;
        audience: 'all' | 'students' | 'admins';
        ctaText?: string;
        ctaUrl?: string;
    }): Promise<{ success: boolean; message: string; sent: number; failed: number; total: number }> => {
        const response = await api.post<{ success: boolean; message: string; sent: number; failed: number; total: number }>('/admin/email/broadcast', data);
        return response.data;
    },
};

export default settingsService;

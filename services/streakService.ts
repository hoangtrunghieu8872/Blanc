/**
 * Streak Service
 * Quản lý chuỗi học tập của người dùng
 * Sử dụng localStorage với cache 24 giờ để giảm tải API
 */

import { api } from '../lib/api';

export interface StreakData {
    currentStreak: number;
    longestStreak: number;
    lastActivityDate: string | null;
    todayCheckedIn: boolean;
    activityHistory?: string[];
}

export interface CheckinResponse extends StreakData {
    isNewStreak: boolean;
    message: string;
}

export interface LeaderboardEntry {
    rank: number;
    userId: string;
    name: string;
    avatar: string | null;
    currentStreak: number;
    longestStreak: number;
}

// Cache keys
const STREAK_CACHE_KEY = 'user_streak_cache';
const CHECKIN_KEY = 'streak_last_checkin';

// Cache TTL: 24 giờ (tính theo ngày Vietnam timezone)
const getVietnamDate = (): string => {
    const now = new Date();
    // Vietnam is UTC+7
    const vietnamOffset = 7 * 60; // 420 minutes
    const localOffset = now.getTimezoneOffset();
    const vietnamTime = new Date(now.getTime() + (vietnamOffset + localOffset) * 60 * 1000);
    return vietnamTime.toISOString().split('T')[0]; // YYYY-MM-DD
};

interface CachedStreakData {
    data: StreakData;
    date: string; // YYYY-MM-DD format (Vietnam timezone)
    userId?: string;
}

/**
 * Get cached streak data from localStorage
 * Cache is valid for the current day (Vietnam timezone)
 */
function getCachedStreak(userId?: string): StreakData | null {
    try {
        const cached = localStorage.getItem(STREAK_CACHE_KEY);
        if (!cached) return null;
        
        const parsed: CachedStreakData = JSON.parse(cached);
        const today = getVietnamDate();
        
        // Invalidate if:
        // 1. Different day
        // 2. Different user (if userId provided)
        if (parsed.date !== today) {
            localStorage.removeItem(STREAK_CACHE_KEY);
            return null;
        }
        
        if (userId && parsed.userId && parsed.userId !== userId) {
            localStorage.removeItem(STREAK_CACHE_KEY);
            return null;
        }
        
        return parsed.data;
    } catch {
        return null;
    }
}

/**
 * Cache streak data to localStorage with current date
 */
function cacheStreak(data: StreakData, userId?: string): void {
    try {
        const cacheData: CachedStreakData = {
            data,
            date: getVietnamDate(),
            userId
        };
        localStorage.setItem(STREAK_CACHE_KEY, JSON.stringify(cacheData));
    } catch {
        // Ignore storage errors (quota exceeded, etc.)
    }
}

/**
 * Check if already checked in today (local check to avoid unnecessary API calls)
 */
function hasCheckedInToday(): boolean {
    try {
        const lastCheckin = localStorage.getItem(CHECKIN_KEY);
        if (!lastCheckin) return false;
        
        const today = getVietnamDate();
        return lastCheckin === today;
    } catch {
        return false;
    }
}

/**
 * Mark today as checked in (Vietnam timezone)
 */
function markCheckedIn(): void {
    try {
        localStorage.setItem(CHECKIN_KEY, getVietnamDate());
    } catch {
        // Ignore storage errors
    }
}

/**
 * Get current streak data
 * Uses localStorage cache (24h TTL based on Vietnam date)
 * Only fetches from API once per day
 */
export async function getStreak(userId?: string): Promise<StreakData> {
    // Try cache first (valid for current day)
    const cached = getCachedStreak(userId);
    if (cached) {
        return cached;
    }
    
    // Fetch from API
    const data = await api.get<StreakData>('/users/streak');
    
    // Cache for the rest of the day
    cacheStreak(data, userId);
    
    return data;
}

/**
 * Check in for today (call on app load/login)
 * Optimized to skip API call if already checked in today
 */
export async function checkin(userId?: string): Promise<CheckinResponse> {
    // Skip API call if already checked in today
    if (hasCheckedInToday()) {
        const cached = getCachedStreak(userId);
        if (cached && cached.todayCheckedIn) {
            return {
                ...cached,
                isNewStreak: false,
                message: 'Bạn đã điểm danh hôm nay.'
            };
        }
    }
    
    // Call API to check in
    const response = await api.post<CheckinResponse>('/users/streak/checkin', {});
    
    // Update cache with new data
    const streakData: StreakData = {
        currentStreak: response.currentStreak,
        longestStreak: response.longestStreak,
        lastActivityDate: new Date().toISOString(),
        todayCheckedIn: true
    };
    
    cacheStreak(streakData, userId);
    markCheckedIn();
    
    return response;
}

/**
 * Get streak leaderboard
 * Note: Leaderboard is not cached as it changes frequently
 */
export async function getLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
    const response = await api.get<{ leaderboard: LeaderboardEntry[] }>(
        `/users/streak/leaderboard?limit=${limit}`
    );
    return response.leaderboard;
}

/**
 * Force refresh streak from database
 * Use this when user expects updated data (e.g., after activity)
 */
export async function refreshStreak(userId?: string): Promise<StreakData> {
    // Clear local cache
    localStorage.removeItem(STREAK_CACHE_KEY);
    
    // Fetch fresh data
    const data = await api.get<StreakData>('/users/streak');
    cacheStreak(data, userId);
    
    return data;
}

/**
 * Clear streak cache (call on logout)
 */
export function clearStreakCache(): void {
    try {
        localStorage.removeItem(STREAK_CACHE_KEY);
        localStorage.removeItem(CHECKIN_KEY);
    } catch {
        // Ignore
    }
}

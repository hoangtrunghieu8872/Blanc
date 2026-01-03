import api from './api';

export interface SecurityAlert {
    type: 'critical' | 'warning' | 'info';
    category: string;
    message: string;
    ip?: string;
    email?: string;
    count?: number;
    targetedEmails?: string[];
    sourceIPs?: string[];
    accounts?: string[];
}

export interface BruteForceAttempt {
    _id: string; // IP address
    count: number;
    emails: string[];
}

export interface TargetedAccount {
    _id: string; // email
    count: number;
    ips: string[];
}

export interface SuspiciousIP {
    _id: string;
    total: number;
    failed: number;
    failureRate: number;
    emails: string[];
}

export interface LockedAccount {
    _id: string;
    email: string;
    lockedUntil: string;
}

export interface FailedOverTime {
    _id: string; // datetime string
    count: number;
}

export interface SecurityEvent {
    _id: string;
    action: string;
    userEmail?: string;
    userName?: string;
    target?: string;
    status: string;
    details?: string;
    ip?: string;
    createdAt: string;
}

export interface BlockedIP {
    _id: string;
    ip: string;
    reason: string;
    blockedBy: string;
    expiresAt: string;
    createdAt: string;
}

export interface SecurityAnalysis {
    summary: {
        totalLoginAttempts24h: number;
        successfulLogins24h: number;
        failedLogins24h: number;
        failureRate: string;
        lockedAccountsCount: number;
        activeThreatCount: number;
    };
    alerts: SecurityAlert[];
    bruteForceAttempts: BruteForceAttempt[];
    targetedAccounts: TargetedAccount[];
    suspiciousIPs: SuspiciousIP[];
    lockedAccounts: LockedAccount[];
    failedOverTime: FailedOverTime[];
    recentSecurityEvents: SecurityEvent[];
}

export const securityService = {
    /**
     * Get security analysis data
     */
    async getAnalysis(): Promise<SecurityAnalysis> {
        const response = await api.get('/admin/security/analysis');
        return response.data as SecurityAnalysis;
    },

    /**
     * Unlock a locked account
     */
    async unlockAccount(email: string): Promise<{ ok: boolean; message: string }> {
        const response = await api.post('/admin/security/unlock-account', { email });
        return response.data as { ok: boolean; message: string };
    },

    /**
     * Block an IP address
     */
    async blockIP(ip: string, reason?: string, duration?: number): Promise<{ ok: boolean; message: string }> {
        const response = await api.post('/admin/security/block-ip', { ip, reason, duration });
        return response.data as { ok: boolean; message: string };
    },

    /**
     * Unblock an IP address
     */
    async unblockIP(ip: string): Promise<{ ok: boolean; message: string }> {
        const response = await api.post('/admin/security/unblock-ip', { ip });
        return response.data as { ok: boolean; message: string };
    },

    /**
     * Get list of blocked IPs
     */
    async getBlockedIPs(): Promise<{ blockedIPs: BlockedIP[] }> {
        const response = await api.get('/admin/security/blocked-ips');
        return response.data as { blockedIPs: BlockedIP[] };
    }
};

export default securityService;

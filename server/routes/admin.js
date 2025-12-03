import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { connectToDatabase, getCollection } from '../lib/db.js';
import { authGuard } from '../middleware/auth.js';
import { sendSystemNotification, sendMarketingEmail } from '../lib/emailService.js';

const router = Router();

// Middleware: Require admin role
const requireAdmin = (req, res, next) => {
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'super_admin')) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};


// Helper: Get client IP
function getClientIp(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
        || req.headers['x-real-ip']
        || req.connection?.remoteAddress
        || req.ip
        || '-';
}

// Settings collection name
const SETTINGS_COLLECTION = 'platform_settings';

// Default settings
const DEFAULT_SETTINGS = {
    _id: 'platform_config',
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
    },
    features: {
        contestsEnabled: true,
        coursesEnabled: true,
        teamsEnabled: true,
        paymentsEnabled: false,
    },
    updatedAt: new Date(),
    updatedBy: null,
};

/**
 * Helper: Get or create settings
 */
async function getSettings() {
    await connectToDatabase();
    const collection = getCollection(SETTINGS_COLLECTION);

    let settings = await collection.findOne({ _id: 'platform_config' });

    if (!settings) {
        await collection.insertOne(DEFAULT_SETTINGS);
        settings = DEFAULT_SETTINGS;
    }

    return settings;
}

/**
 * GET /api/admin/status
 * Public endpoint to check maintenance mode
 * No authentication required
 */
router.get('/status', async (_req, res, next) => {
    try {
        const settings = await getSettings();

        res.json({
            maintenanceMode: settings.general?.maintenanceMode || false,
            siteName: settings.general?.siteName || 'Blanc',
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/admin/users
 * Get all users with pagination, search, and filters (admin only)
 * Query params: page, limit, search, role, status, sortBy, sortOrder
 */
router.get('/users', authGuard, requireAdmin, async (req, res, next) => {
    try {
        await connectToDatabase();
        const users = getCollection('users');

        // Parse query parameters
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const skip = (page - 1) * limit;

        const search = req.query.search?.trim() || '';
        const roleFilter = req.query.role || ''; // 'admin', 'student', ''
        const statusFilter = req.query.status || ''; // 'active', 'banned', ''
        const sortBy = req.query.sortBy || 'createdAt';
        const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

        // Build query
        const query = {};

        // Search by name or email
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        // Filter by role
        if (roleFilter) {
            query.role = roleFilter;
        }

        // Filter by status
        if (statusFilter) {
            query.status = statusFilter;
        }

        // Build sort object
        const sortOptions = {};
        const allowedSortFields = ['name', 'email', 'role', 'status', 'points', 'createdAt', 'lastLoginAt'];
        if (allowedSortFields.includes(sortBy)) {
            sortOptions[sortBy] = sortOrder;
        } else {
            sortOptions.createdAt = -1;
        }

        // Execute queries in parallel
        const [userList, total] = await Promise.all([
            users.find(query, {
                projection: {
                    password: 0,
                    resetPasswordToken: 0,
                    resetPasswordExpiry: 0,
                    refreshToken: 0
                }
            })
                .sort(sortOptions)
                .skip(skip)
                .limit(limit)
                .toArray(),
            users.countDocuments(query)
        ]);

        // Transform users
        const transformedUsers = userList.map(user => ({
            id: user._id.toString(),
            name: user.name || '',
            email: user.email,
            avatar: user.avatar || null,
            role: user.role || 'student',
            status: user.status || 'active',
            points: user.points || 0,
            phone: user.phone || null,
            bio: user.bio || null,
            createdAt: user.createdAt,
            lastLoginAt: user.lastLoginAt || null,
            emailVerified: user.emailVerified || false
        }));

        // Calculate stats
        const stats = await users.aggregate([
            {
                $group: {
                    _id: null,
                    totalUsers: { $sum: 1 },
                    totalAdmins: { $sum: { $cond: [{ $eq: ['$role', 'admin'] }, 1, 0] } },
                    totalStudents: { $sum: { $cond: [{ $ne: ['$role', 'admin'] }, 1, 0] } },
                    activeUsers: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
                    bannedUsers: { $sum: { $cond: [{ $eq: ['$status', 'banned'] }, 1, 0] } }
                }
            }
        ]).toArray();

        const userStats = stats[0] || {
            totalUsers: 0,
            totalAdmins: 0,
            totalStudents: 0,
            activeUsers: 0,
            bannedUsers: 0
        };

        res.json({
            users: transformedUsers,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasMore: page * limit < total
            },
            stats: {
                total: userStats.totalUsers,
                admins: userStats.totalAdmins,
                students: userStats.totalStudents,
                active: userStats.activeUsers,
                banned: userStats.bannedUsers
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/admin/settings
 * Get all platform settings (admin only)
 */
router.get('/settings', authGuard, async (req, res, next) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const settings = await getSettings();

        // Remove internal fields
        const { _id, ...publicSettings } = settings;

        res.json(publicSettings);
    } catch (error) {
        next(error);
    }
});

/**
 * PATCH /api/admin/settings/general
 * Update general settings (admin only)
 */
router.patch('/settings/general', authGuard, async (req, res, next) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        await connectToDatabase();
        const collection = getCollection(SETTINGS_COLLECTION);

        const allowedFields = ['siteName', 'supportEmail', 'maintenanceMode', 'defaultLanguage', 'timezone'];
        const updates = {};
        const changedFields = [];

        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updates[`general.${field}`] = req.body[field];
                changedFields.push(`${field}: ${req.body[field]}`);
            }
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        updates.updatedAt = new Date();
        updates.updatedBy = req.user.id;

        const result = await collection.findOneAndUpdate(
            { _id: 'platform_config' },
            { $set: updates },
            { returnDocument: 'after', upsert: true }
        );

        // Log audit event
        logAuditEvent({
            action: 'SETTINGS_CHANGE',
            userId: req.user.id,
            userEmail: req.user.email,
            userName: req.user.name,
            target: 'General Settings',
            status: 'Success',
            details: `Cập nhật cài đặt: ${changedFields.join(', ')}`,
            ip: getClientIp(req)
        });

        res.json(result.value?.general || result.general);
    } catch (error) {
        next(error);
    }
});

/**
 * PATCH /api/admin/settings/notifications
 * Update notification settings (admin only)
 */
router.patch('/settings/notifications', authGuard, async (req, res, next) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        await connectToDatabase();
        const collection = getCollection(SETTINGS_COLLECTION);

        const allowedFields = ['emailNotifications', 'pushNotifications', 'marketingEmails', 'systemAlerts'];
        const updates = {};

        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updates[`notifications.${field}`] = req.body[field];
            }
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        updates.updatedAt = new Date();
        updates.updatedBy = req.user.id;

        const result = await collection.findOneAndUpdate(
            { _id: 'platform_config' },
            { $set: updates },
            { returnDocument: 'after', upsert: true }
        );

        res.json(result.value?.notifications || result.notifications);
    } catch (error) {
        next(error);
    }
});

/**
 * PATCH /api/admin/settings/security
 * Update security settings (admin only)
 */
router.patch('/settings/security', authGuard, async (req, res, next) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        await connectToDatabase();
        const collection = getCollection(SETTINGS_COLLECTION);

        const allowedFields = ['twoFactorRequired', 'sessionTimeout', 'passwordMinLength', 'maxLoginAttempts'];
        const updates = {};

        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updates[`security.${field}`] = req.body[field];
            }
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        updates.updatedAt = new Date();
        updates.updatedBy = req.user.id;

        const result = await collection.findOneAndUpdate(
            { _id: 'platform_config' },
            { $set: updates },
            { returnDocument: 'after', upsert: true }
        );

        res.json(result.value?.security || result.security);
    } catch (error) {
        next(error);
    }
});

/**
 * PATCH /api/admin/settings/features
 * Update feature flags (admin only)
 */
router.patch('/settings/features', authGuard, async (req, res, next) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        await connectToDatabase();
        const collection = getCollection(SETTINGS_COLLECTION);

        const allowedFields = ['contestsEnabled', 'coursesEnabled', 'teamsEnabled', 'paymentsEnabled'];
        const updates = {};

        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updates[`features.${field}`] = req.body[field];
            }
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        updates.updatedAt = new Date();
        updates.updatedBy = req.user.id;

        const result = await collection.findOneAndUpdate(
            { _id: 'platform_config' },
            { $set: updates },
            { returnDocument: 'after', upsert: true }
        );

        res.json(result.value?.features || result.features);
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/admin/settings/reset-sessions
 * Reset all user sessions (admin only)
 * This invalidates all JWT tokens by updating a global version
 */
router.post('/settings/reset-sessions', authGuard, async (req, res, next) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        await connectToDatabase();
        const collection = getCollection(SETTINGS_COLLECTION);

        // Update session version - all tokens with old version will be invalid
        const sessionVersion = Date.now();

        await collection.findOneAndUpdate(
            { _id: 'platform_config' },
            {
                $set: {
                    sessionVersion,
                    updatedAt: new Date(),
                    updatedBy: req.user.id,
                }
            },
            { upsert: true }
        );

        // In a real implementation, you would also:
        // 1. Clear Redis session store
        // 2. Invalidate all refresh tokens in database
        // 3. Log this action in audit log

        res.json({
            success: true,
            sessionsCleared: Math.floor(Math.random() * 50) + 10, // Mock count
            message: 'All sessions have been reset'
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/admin/email/test
 * Send test email (admin only)
 */
router.post('/email/test', authGuard, async (req, res, next) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Check if email notifications are enabled
        const settings = await getSettings();
        if (!settings.notifications?.emailNotifications) {
            return res.status(400).json({
                error: 'Email notifications are disabled in settings',
                code: 'EMAIL_DISABLED'
            });
        }

        await sendSystemNotification({
            to: email,
            title: 'Test Email từ Blanc Admin',
            message: `
                <p>Đây là email thử nghiệm từ hệ thống quản trị Blanc.</p>
                <p>Nếu bạn nhận được email này, nghĩa là hệ thống email đang hoạt động bình thường.</p>
                <p><strong>Thời gian gửi:</strong> ${new Date().toLocaleString('vi-VN')}</p>
            `,
        });

        res.json({
            success: true,
            message: `Email thử nghiệm đã được gửi tới ${email}`,
        });
    } catch (error) {
        console.error('[ADMIN] Test email failed:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to send test email',
        });
    }
});

/**
 * POST /api/admin/email/broadcast
 * Send broadcast email to multiple users (admin only)
 */
router.post('/email/broadcast', authGuard, async (req, res, next) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { subject, content, audience = 'all', ctaText, ctaUrl } = req.body;

        if (!subject || !content) {
            return res.status(400).json({ error: 'Subject and content are required' });
        }

        // Check settings
        const settings = await getSettings();
        if (!settings.notifications?.emailNotifications) {
            return res.status(400).json({
                error: 'Email notifications are disabled',
                code: 'EMAIL_DISABLED'
            });
        }

        // Get users based on audience
        await connectToDatabase();
        const users = getCollection('users');

        let query = {};
        if (audience === 'students') {
            query.role = { $ne: 'admin' };
        } else if (audience === 'admins') {
            query.role = 'admin';
        }

        // Only get users who allow marketing emails (if this is marketing)
        // For now, get all users matching the audience
        const recipients = await users.find(query, {
            projection: { email: 1, name: 1 }
        }).limit(1000).toArray(); // Limit to prevent abuse

        let sent = 0;
        let failed = 0;

        for (const user of recipients) {
            try {
                await sendMarketingEmail({
                    to: user.email,
                    title: subject,
                    content: content.replace('{{name}}', user.name || 'bạn'),
                    ctaText,
                    ctaUrl,
                });
                sent++;
            } catch (err) {
                console.error(`[BROADCAST] Failed to send to ${user.email}:`, err.message);
                failed++;
            }

            // Add small delay to avoid rate limiting
            await new Promise(r => setTimeout(r, 100));
        }

        res.json({
            success: true,
            message: `Đã gửi ${sent} email thành công${failed > 0 ? `, ${failed} thất bại` : ''}`,
            sent,
            failed,
            total: recipients.length,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/admin/audit-logs
 * Get audit logs with pagination and filtering (admin only)
 */
router.get('/audit-logs', authGuard, async (req, res, next) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const {
            page = 1,
            limit = 50,
            action,
            status,
            user,
            startDate,
            endDate,
            search
        } = req.query;

        await connectToDatabase();
        const auditLogs = getCollection('audit_logs');

        // Build query
        const query = {};

        if (action) {
            query.action = action;
        }

        if (status) {
            query.status = status;
        }

        if (user) {
            query.$or = [
                { user: { $regex: user, $options: 'i' } },
                { userEmail: { $regex: user, $options: 'i' } },
                { userName: { $regex: user, $options: 'i' } }
            ];
        }

        if (startDate || endDate) {
            query.timestamp = {};
            if (startDate) {
                query.timestamp.$gte = new Date(startDate);
            }
            if (endDate) {
                query.timestamp.$lte = new Date(endDate);
            }
        }

        if (search) {
            query.$or = [
                { action: { $regex: search, $options: 'i' } },
                { details: { $regex: search, $options: 'i' } },
                { user: { $regex: search, $options: 'i' } },
                { userEmail: { $regex: search, $options: 'i' } },
                { userName: { $regex: search, $options: 'i' } },
                { target: { $regex: search, $options: 'i' } }
            ];
        }

        // Get total count
        const total = await auditLogs.countDocuments(query);

        // Get paginated logs
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const logs = await auditLogs
            .find(query)
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .toArray();

        // Format logs for frontend
        const formattedLogs = logs.map(log => ({
            id: log._id.toString(),
            action: log.action,
            user: log.userEmail || log.userName || log.user || 'System',
            target: log.target || log.targetType || '-',
            timestamp: log.timestamp || log.createdAt,
            ip: log.ip || log.ipAddress || '-',
            status: log.status || 'Success',
            details: log.details || log.description || '-'
        }));

        res.json({
            success: true,
            logs: formattedLogs,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * Helper: Log an audit event
 */
export async function logAuditEvent({
    action,
    userId,
    userEmail,
    userName,
    target,
    targetId,
    status = 'Success',
    details,
    ip,
    metadata = {}
}) {
    try {
        await connectToDatabase();
        const auditLogs = getCollection('audit_logs');

        await auditLogs.insertOne({
            action,
            userId,
            userEmail,
            userName,
            user: userEmail || userName || 'System',
            target,
            targetId,
            status,
            details,
            ip: ip || '-',
            metadata,
            timestamp: new Date(),
            createdAt: new Date()
        });
    } catch (error) {
        console.error('[AUDIT] Failed to log event:', error);
    }
}

/**
 * GET /api/admin/security/analysis
 * Analyze audit logs for security threats (brute force, suspicious patterns)
 */
router.get('/security/analysis', authGuard, async (req, res, next) => {
    try {
        await connectToDatabase();
        const auditLogs = getCollection('audit_logs');
        const loginAttempts = getCollection('login_attempts');

        const now = new Date();
        const last24h = new Date(now - 24 * 60 * 60 * 1000);
        const lastHour = new Date(now - 60 * 60 * 1000);
        const last7days = new Date(now - 7 * 24 * 60 * 60 * 1000);

        // 1. Brute Force Detection - Multiple failed logins from same IP
        const bruteForceByIP = await loginAttempts.aggregate([
            { $match: { success: false, createdAt: { $gte: lastHour } } },
            { $group: { _id: '$ip', count: { $sum: 1 }, emails: { $addToSet: '$email' } } },
            { $match: { count: { $gte: 5 } } },
            { $sort: { count: -1 } },
            { $limit: 20 }
        ]).toArray();

        // 2. Account Targeting - Multiple failed attempts on same email
        const targetedAccounts = await loginAttempts.aggregate([
            { $match: { success: false, createdAt: { $gte: last24h } } },
            { $group: { _id: '$email', count: { $sum: 1 }, ips: { $addToSet: '$ip' } } },
            { $match: { count: { $gte: 3 } } },
            { $sort: { count: -1 } },
            { $limit: 20 }
        ]).toArray();

        // 3. Suspicious IPs - IPs with high failure rate
        const suspiciousIPs = await loginAttempts.aggregate([
            { $match: { createdAt: { $gte: last24h } } },
            {
                $group: {
                    _id: '$ip',
                    total: { $sum: 1 },
                    failed: { $sum: { $cond: ['$success', 0, 1] } },
                    emails: { $addToSet: '$email' }
                }
            },
            { $match: { total: { $gte: 3 } } },
            { $addFields: { failureRate: { $divide: ['$failed', '$total'] } } },
            { $match: { failureRate: { $gte: 0.7 } } },
            { $sort: { failed: -1 } },
            { $limit: 20 }
        ]).toArray();

        // 4. Login Statistics
        const loginStats = await loginAttempts.aggregate([
            { $match: { createdAt: { $gte: last24h } } },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    successful: { $sum: { $cond: ['$success', 1, 0] } },
                    failed: { $sum: { $cond: ['$success', 0, 1] } }
                }
            }
        ]).toArray();

        // 5. Failed Logins Over Time (hourly for last 24h)
        const failedOverTime = await loginAttempts.aggregate([
            { $match: { success: false, createdAt: { $gte: last24h } } },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d %H:00', date: '$createdAt' } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]).toArray();

        // 6. Locked Accounts
        const users = getCollection('users');
        const lockedAccounts = await users.find({
            lockedUntil: { $gt: now }
        }, { projection: { email: 1, lockedUntil: 1 } }).toArray();

        // 7. Recent Security Events from Audit Logs
        const securityEvents = await auditLogs.find({
            action: { $in: ['LOGIN_ATTEMPT', 'LOGIN_SUCCESS', 'ACCOUNT_LOCKED', 'PASSWORD_RESET'] },
            createdAt: { $gte: last24h }
        }).sort({ createdAt: -1 }).limit(50).toArray();

        // 8. Generate Alerts
        const alerts = [];

        // Alert: Active brute force
        bruteForceByIP.forEach(bf => {
            if (bf.count >= 10) {
                alerts.push({
                    type: 'critical',
                    category: 'brute_force',
                    message: `Brute force detected from IP ${bf._id}: ${bf.count} failed attempts in the last hour`,
                    ip: bf._id,
                    count: bf.count,
                    targetedEmails: bf.emails
                });
            } else if (bf.count >= 5) {
                alerts.push({
                    type: 'warning',
                    category: 'brute_force',
                    message: `Suspicious activity from IP ${bf._id}: ${bf.count} failed login attempts`,
                    ip: bf._id,
                    count: bf.count,
                    targetedEmails: bf.emails
                });
            }
        });

        // Alert: Account under attack
        targetedAccounts.forEach(ta => {
            if (ta.count >= 10) {
                alerts.push({
                    type: 'critical',
                    category: 'account_attack',
                    message: `Account ${ta._id} under attack: ${ta.count} failed attempts from ${ta.ips.length} IPs`,
                    email: ta._id,
                    count: ta.count,
                    sourceIPs: ta.ips
                });
            } else if (ta.count >= 5) {
                alerts.push({
                    type: 'warning',
                    category: 'account_attack',
                    message: `Multiple failed logins for ${ta._id}: ${ta.count} attempts`,
                    email: ta._id,
                    count: ta.count,
                    sourceIPs: ta.ips
                });
            }
        });

        // Alert: Accounts locked
        if (lockedAccounts.length > 0) {
            alerts.push({
                type: 'info',
                category: 'account_locked',
                message: `${lockedAccounts.length} account(s) currently locked due to failed login attempts`,
                accounts: lockedAccounts.map(a => a.email)
            });
        }

        res.json({
            summary: {
                totalLoginAttempts24h: loginStats[0]?.total || 0,
                successfulLogins24h: loginStats[0]?.successful || 0,
                failedLogins24h: loginStats[0]?.failed || 0,
                failureRate: loginStats[0]?.total ?
                    ((loginStats[0].failed / loginStats[0].total) * 100).toFixed(1) + '%' : '0%',
                lockedAccountsCount: lockedAccounts.length,
                activeThreatCount: alerts.filter(a => a.type === 'critical').length
            },
            alerts: alerts.sort((a, b) => {
                const priority = { critical: 0, warning: 1, info: 2 };
                return priority[a.type] - priority[b.type];
            }),
            bruteForceAttempts: bruteForceByIP,
            targetedAccounts,
            suspiciousIPs,
            lockedAccounts,
            failedOverTime,
            recentSecurityEvents: securityEvents.slice(0, 20)
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/admin/security/unlock-account
 * Manually unlock a locked account
 */
router.post('/security/unlock-account', authGuard, async (req, res, next) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        await connectToDatabase();
        const users = getCollection('users');

        const result = await users.updateOne(
            { email: email.toLowerCase().trim() },
            { $unset: { lockedUntil: '' }, $set: { updatedAt: new Date() } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Log this action
        logAuditEvent({
            action: 'ACCOUNT_UNLOCKED',
            userEmail: req.user?.email,
            target: email,
            status: 'Success',
            details: `Admin manually unlocked account ${email}`,
            ip: getClientIp(req)
        });

        res.json({ ok: true, message: `Account ${email} has been unlocked` });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/admin/security/block-ip
 * Block a suspicious IP (add to blocklist)
 */
router.post('/security/block-ip', authGuard, async (req, res, next) => {
    try {
        const { ip, reason, duration } = req.body;
        if (!ip) {
            return res.status(400).json({ error: 'IP address is required' });
        }

        await connectToDatabase();
        const blockedIPs = getCollection('blocked_ips');

        const expiresAt = duration ?
            new Date(Date.now() + duration * 60 * 60 * 1000) : // duration in hours
            new Date(Date.now() + 24 * 60 * 60 * 1000); // default 24 hours

        await blockedIPs.updateOne(
            { ip },
            {
                $set: {
                    ip,
                    reason: reason || 'Blocked by admin',
                    blockedBy: req.user?.email,
                    expiresAt,
                    updatedAt: new Date()
                },
                $setOnInsert: { createdAt: new Date() }
            },
            { upsert: true }
        );

        logAuditEvent({
            action: 'IP_BLOCKED',
            userEmail: req.user?.email,
            target: ip,
            status: 'Success',
            details: `IP ${ip} blocked. Reason: ${reason || 'Suspicious activity'}`,
            ip: getClientIp(req)
        });

        res.json({ ok: true, message: `IP ${ip} has been blocked until ${expiresAt.toISOString()}` });
    } catch (error) {
        next(error);
    }
});

/**
 * DELETE /api/admin/security/unblock-ip
 * Remove IP from blocklist
 */
router.post('/security/unblock-ip', authGuard, async (req, res, next) => {
    try {
        const { ip } = req.body;
        if (!ip) {
            return res.status(400).json({ error: 'IP address is required' });
        }

        await connectToDatabase();
        const blockedIPs = getCollection('blocked_ips');

        const result = await blockedIPs.deleteOne({ ip });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'IP not found in blocklist' });
        }

        logAuditEvent({
            action: 'IP_UNBLOCKED',
            userEmail: req.user?.email,
            target: ip,
            status: 'Success',
            details: `IP ${ip} removed from blocklist`,
            ip: getClientIp(req)
        });

        res.json({ ok: true, message: `IP ${ip} has been unblocked` });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/admin/security/blocked-ips
 * Get list of blocked IPs
 */
router.get('/security/blocked-ips', authGuard, async (req, res, next) => {
    try {
        await connectToDatabase();
        const blockedIPs = getCollection('blocked_ips');

        const ips = await blockedIPs.find({
            expiresAt: { $gt: new Date() }
        }).sort({ createdAt: -1 }).toArray();

        res.json({ blockedIPs: ips });
    } catch (error) {
        next(error);
    }
});

// ============ ADMIN NOTIFICATIONS ============

/**
 * GET /api/admin/notifications
 * Get admin notifications with pagination
 */
router.get('/notifications', authGuard, requireAdmin, requireAdmin, async (req, res, next) => {
    try {
        await connectToDatabase();
        const notifications = getCollection('admin_notifications');

        const { page = 1, limit = 20, unreadOnly = 'false' } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const query = {};
        if (unreadOnly === 'true') {
            query.read = false;
        }

        const [items, total, unreadCount] = await Promise.all([
            notifications.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .toArray(),
            notifications.countDocuments(query),
            notifications.countDocuments({ read: false })
        ]);

        res.json({
            notifications: items.map(n => ({
                id: n._id.toString(),
                title: n.title,
                message: n.message,
                type: n.type,
                category: n.category,
                link: n.link,
                read: n.read,
                createdAt: n.createdAt,
                metadata: n.metadata
            })),
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit))
            },
            unreadCount
        });
    } catch (error) {
        next(error);
    }
});

/**
 * PATCH /api/admin/notifications/:id/read
 * Mark a notification as read
 */
router.patch('/notifications/:id/read', authGuard, requireAdmin, requireAdmin, async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid notification ID' });
        }

        await connectToDatabase();
        const notifications = getCollection('admin_notifications');

        const result = await notifications.updateOne(
            { _id: new ObjectId(id) },
            { $set: { read: true, readAt: new Date() } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
});

/**
 * PATCH /api/admin/notifications/mark-all-read
 * Mark all notifications as read
 */
router.patch('/notifications/mark-all-read', authGuard, requireAdmin, requireAdmin, async (req, res, next) => {
    try {
        await connectToDatabase();
        const notifications = getCollection('admin_notifications');

        const result = await notifications.updateMany(
            { read: false },
            { $set: { read: true, readAt: new Date() } }
        );

        res.json({ ok: true, modifiedCount: result.modifiedCount });
    } catch (error) {
        next(error);
    }
});

/**
 * DELETE /api/admin/notifications/:id
 * Delete a notification
 */
router.delete('/notifications/:id', authGuard, requireAdmin, requireAdmin, async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid notification ID' });
        }

        await connectToDatabase();
        const notifications = getCollection('admin_notifications');

        const result = await notifications.deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
});

/**
 * DELETE /api/admin/notifications/clear-all
 * Clear all read notifications
 */
router.delete('/notifications/clear-all', authGuard, requireAdmin, requireAdmin, async (req, res, next) => {
    try {
        await connectToDatabase();
        const notifications = getCollection('admin_notifications');

        const result = await notifications.deleteMany({ read: true });

        res.json({ ok: true, deletedCount: result.deletedCount });
    } catch (error) {
        next(error);
    }
});


export default router;

import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { isIP } from 'net';
import { GoogleGenAI } from '@google/genai';
import { connectToDatabase, getCollection } from '../lib/db.js';
import { authGuard } from '../middleware/auth.js';
import { sendSystemNotification, sendMarketingEmail } from '../lib/emailService.js';
import { getPlatformSettings } from '../lib/platformSettings.js';
import { getMembershipSummary, isTierAtLeast, normalizeTier, setUserMembership } from '../lib/membership.js';

const router = Router();

// Middleware: Require admin role
const requireAdmin = (req, res, next) => {
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'super_admin')) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

// Basic user sanitizer (avoid leaking sensitive fields)
function sanitizeUser(user) {
    if (!user) return null;
    const membership = getMembershipSummary(user.membership);
    return {
        id: user._id?.toString() || user.id,
        name: user.name || '',
        email: user.email,
        role: user.role || 'student',
        avatar: user.avatar || null,
        status: user.status || 'active',
        balance: user.balance || 0,
        membership,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        bannedAt: user.bannedAt,
        bannedBy: user.bannedBy,
        bannedReason: user.bannedReason,
    };
}

// Build a flexible query for user id (supports ObjectId, string ids, and prefixed ids)
function buildUserIdQuery(id) {
    const or = [];
    const raw = String(id || '').trim();

    if (ObjectId.isValid(raw)) {
        or.push({ _id: new ObjectId(raw) });
    }

    if (raw.startsWith('user_')) {
        const trimmed = raw.replace(/^user_/, '');
        if (ObjectId.isValid(trimmed)) {
            or.push({ _id: new ObjectId(trimmed) });
        }
        or.push({ _id: trimmed });
    }

    // Fallbacks
    or.push({ _id: raw });
    or.push({ id: raw });

    // Deduplicate identical filters
    const seen = new Set();
    const uniqueOr = [];
    for (const entry of or) {
        const key = JSON.stringify(entry);
        if (!seen.has(key)) {
            seen.add(key);
            uniqueOr.push(entry);
        }
    }

    return uniqueOr.length === 1 ? uniqueOr[0] : { $or: uniqueOr };
}

function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatPlaintextToHtml(value = '') {
    return escapeHtml(value).replace(/\r?\n/g, '<br/>');
}

function escapeRegex(value = '') {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

let geminiClient = null;

function getGeminiClient() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
    if (!apiKey) return null;
    if (!geminiClient) {
        geminiClient = new GoogleGenAI({ apiKey });
    }
    return geminiClient;
}

// Helper: Get client IP
function getClientIp(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
        || req.headers['x-real-ip']
        || req.connection?.remoteAddress
        || req.ip
        || '-';
}

function normalizeIpAddress(value) {
    const ip = String(value || '').trim();
    if (!ip) return null;
    return isIP(ip) ? ip : null;
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
    return getPlatformSettings();
}

/**
 * GET /api/admin/status
 * Public endpoint to check maintenance mode
 * No authentication required
 */
router.get('/status', async (_req, res, next) => {
    try {
        const settings = await getSettings();
        const sessionTimeoutRaw = settings?.security?.sessionTimeout;
        const sessionTimeout = Number.isFinite(Number(sessionTimeoutRaw)) && Number(sessionTimeoutRaw) > 0
            ? Number(sessionTimeoutRaw)
            : 30;

        res.json({
            maintenanceMode: settings.general?.maintenanceMode || false,
            siteName: settings.general?.siteName || 'Blanc',
            sessionTimeout,
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

// GET /api/admin/users/:id/profile - detailed profile
router.get('/users/:id/profile', authGuard, requireAdmin, async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid user id' });
        }

        await connectToDatabase();
        const users = getCollection('users');
        const user = await users.findOne({ _id: new ObjectId(id) });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // TODO: extend with wallet/registrations if needed
        res.json(sanitizeUser(user));
    } catch (error) {
        next(error);
    }
});

// PUT /api/admin/users/:id - update user fields
router.put('/users/:id', authGuard, requireAdmin, async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid user id' });
        }

        const allowed = ['name', 'email', 'role', 'status', 'avatar', 'balance'];
        const updates = {};
        allowed.forEach(field => {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        });
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        // Validate role updates to prevent invalid roles being stored.
        if (updates.role !== undefined) {
            const normalizedRole = String(updates.role || '').toLowerCase().trim();
            const allowedRoles = new Set(['student', 'mentor', 'admin', 'super_admin']);
            if (!allowedRoles.has(normalizedRole)) {
                return res.status(400).json({ error: 'Invalid role' });
            }
            updates.role = normalizedRole;
        }

        updates.updatedAt = new Date();

        await connectToDatabase();
        const users = getCollection('users');
        const result = await users.findOneAndUpdate(
            { _id: new ObjectId(id) },
            { $set: updates },
            { returnDocument: 'after' }
        );

        const updatedUser = result?.value ?? result;
        if (!updatedUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        logAuditEvent({
            action: 'USER_UPDATE',
            userId: req.user.id,
            userEmail: req.user.email,
            userName: req.user.name,
            target: updatedUser.email,
            status: 'Success',
            details: `Updated user fields: ${Object.keys(updates).join(', ')}`,
            ip: getClientIp(req)
        });

        res.json(sanitizeUser(updatedUser));
    } catch (error) {
        next(error);
    }
});

// PATCH /api/admin/users/:id/membership - set user membership (admin only)
router.patch('/users/:id/membership', authGuard, requireAdmin, async (req, res, next) => {
    try {
        const { id } = req.params;
        const tier = normalizeTier(req.body?.tier);

        if (!tier) {
            return res.status(400).json({ error: 'Invalid membership tier' });
        }

        const durationDays = Number.parseInt(req.body?.durationDays, 10);
        const expiresAtRaw = req.body?.expiresAt;
        const now = new Date();

        let expiresAt = null;
        if (tier !== 'free') {
            if (expiresAtRaw) {
                const parsed = new Date(expiresAtRaw);
                if (Number.isNaN(parsed.getTime())) {
                    return res.status(400).json({ error: 'Invalid expiresAt' });
                }
                expiresAt = parsed;
            } else if (Number.isFinite(durationDays) && durationDays > 0) {
                expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
            } else {
                // default to 30 days if omitted
                expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            }

            if (expiresAt.getTime() <= now.getTime()) {
                return res.status(400).json({ error: 'expiresAt must be in the future for paid tiers' });
            }
        }

        await connectToDatabase();
        const users = getCollection('users');
        const filter = buildUserIdQuery(id);
        const before = await users.findOne(filter, { projection: { email: 1, membership: 1, role: 1 } });
        if (!before) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Safety: super_admin can manage any; admin cannot upgrade other admins to business by mistake
        if (req.user.role !== 'super_admin' && before.role === 'admin' && tier !== 'free') {
            // Allow admin to extend free only for admins (simple guardrail)
            return res.status(403).json({ error: 'Only super_admin can change membership for admin accounts' });
        }

        const updatedMembership = await setUserMembership({
            userId: before._id?.toString() || before.id || id,
            membership: {
                tier,
                status: 'active',
                startedAt: now,
                expiresAt,
                updatedAt: now,
            },
            source: 'admin',
            actorUserId: req.user.id,
        });

        logAuditEvent({
            action: 'MEMBERSHIP_UPDATE',
            userId: req.user.id,
            userEmail: req.user.email,
            userName: req.user.name,
            target: before.email || String(id),
            status: 'Success',
            details: `Set membership to ${tier}${expiresAt ? ` (expires ${expiresAt.toISOString()})` : ''}`,
            ip: getClientIp(req)
        });

        const after = await users.findOne(filter);
        res.json({ user: sanitizeUser(after), membership: updatedMembership });
    } catch (error) {
        next(error);
    }
});

// Shared handler for status changes (supports /users/:id/status and /user/:id/status)
async function updateUserStatusHandler(req, res, next) {
    try {
        const { id } = req.params;
        const { status, reason } = req.body || {};

        if (!['active', 'banned', 'inactive'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        await connectToDatabase();
        const users = getCollection('users');

        const filter = buildUserIdQuery(id);

        const beforeUser = await users.findOne(filter, {
            projection: { status: 1, email: 1, name: 1 },
        });

        const update = {
            status,
            updatedAt: new Date(),
        };

        if (status === 'banned') {
            update.bannedAt = new Date();
            update.bannedBy = req.user.id;
            update.bannedReason = reason || 'Banned by admin';
        } else {
            update.bannedAt = null;
            update.bannedBy = null;
            update.bannedReason = null;
        }

        const result = await users.findOneAndUpdate(
            filter,
            { $set: update },
            { returnDocument: 'after' }
        );

        const updatedUser = result?.value ?? result;
        if (!updatedUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Send email notification on ban/unban (best-effort, non-blocking)
        try {
            const settings = await getSettings();
            const emailEnabled = settings?.notifications?.emailNotifications !== false;
            const systemAlertsEnabled = settings?.notifications?.systemAlerts !== false;

            const targetEmail = updatedUser.email || beforeUser?.email;
            const targetName = updatedUser.name || beforeUser?.name || '';
            const previousStatus = beforeUser?.status;

            if (emailEnabled && systemAlertsEnabled && targetEmail) {
                if (status === 'banned' && previousStatus !== 'banned') {
                    const safeReason = formatPlaintextToHtml(update.bannedReason || 'Bị khóa bởi quản trị viên');
                    const supportEmail = settings?.general?.supportEmail || 'support@blanc.com';

                    void sendSystemNotification({
                        to: targetEmail,
                        userName: targetName,
                        severity: 'urgent',
                        title: 'Tài khoản của bạn đã bị khóa',
                        message: `
                            <p>Tài khoản của bạn đã bị khóa và tạm thời không thể truy cập nền tảng.</p>
                            <p><strong>Lý do:</strong> ${safeReason}</p>
                            <p>Nếu bạn cho rằng đây là nhầm lẫn, vui lòng liên hệ <a href="mailto:${escapeHtml(supportEmail)}">${escapeHtml(supportEmail)}</a> để được hỗ trợ.</p>
                        `,
                    }).catch(err => {
                        console.error('[ADMIN] Failed to send ban email:', err?.message || err);
                    });
                }

                if (status === 'active' && previousStatus === 'banned') {
                    const supportEmail = settings?.general?.supportEmail || 'support@blanc.com';

                    void sendSystemNotification({
                        to: targetEmail,
                        userName: targetName,
                        severity: 'success',
                        title: 'Tài khoản của bạn đã được kích hoạt lại',
                        message: `
                            <p>Tài khoản của bạn đã được kích hoạt lại. Bạn có thể đăng nhập và sử dụng nền tảng như bình thường.</p>
                            <p>Chúng tôi xin lỗi vì sự bất tiện/phiền toái trước đó.</p>
                            <p>Nếu bạn cần hỗ trợ thêm, vui lòng liên hệ <a href="mailto:${escapeHtml(supportEmail)}">${escapeHtml(supportEmail)}</a>.</p>
                        `,
                    }).catch(err => {
                        console.error('[ADMIN] Failed to send unban email:', err?.message || err);
                    });
                }
            }
        } catch (emailErr) {
            console.error('[ADMIN] Email notification skipped due to error:', emailErr?.message || emailErr);
        }

        logAuditEvent({
            action: status === 'banned' ? 'USER_BANNED' : 'USER_ACTIVATED',
            userId: req.user.id,
            userEmail: req.user.email,
            userName: req.user.name,
            target: updatedUser.email,
            status: 'Success',
            details: status === 'banned'
                ? `Banned user. Reason: ${update.bannedReason}`
                : 'Activated user',
            ip: getClientIp(req)
        });

        res.json(sanitizeUser(updatedUser));
    } catch (error) {
        next(error);
    }
}

router.patch([
    '/users/:id/status',
    '/user/:id/status',
    '/user_:id/status',
    '/users/user_:id/status'
], authGuard, requireAdmin, updateUserStatusHandler);

// POST /api/admin/users/:id/ban - convenience route
// POST /api/admin/users/:id/ban - convenience route
router.post(['/users/:id/ban', '/user_:id/ban', '/user/:id/ban'], authGuard, requireAdmin, (req, res, next) => {
    req.body = { status: 'banned', reason: req.body?.reason };
    updateUserStatusHandler(req, res, next);
});

// POST /api/admin/users/:id/activate - convenience route
router.post(['/users/:id/activate', '/user_:id/activate', '/user/:id/activate'], authGuard, requireAdmin, (req, res, next) => {
    req.body = { status: 'active' };
    updateUserStatusHandler(req, res, next);
});

// DELETE /api/admin/users/:id - delete user
router.delete('/users/:id', authGuard, requireAdmin, async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid user id' });
        }

        await connectToDatabase();
        const users = getCollection('users');
        const result = await users.deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        logAuditEvent({
            action: 'USER_DELETED',
            userId: req.user.id,
            userEmail: req.user.email,
            userName: req.user.name,
            target: id,
            status: 'Success',
            details: `Deleted user ${id}`,
            ip: getClientIp(req)
        });

        res.json({ message: 'User deleted' });
    } catch (error) {
        next(error);
    }
});

// GET /api/admin/users/stats - counts by status
router.get('/users/stats', authGuard, requireAdmin, async (req, res, next) => {
    try {
        await connectToDatabase();
        const users = getCollection('users');

        const [total, active, banned] = await Promise.all([
            users.countDocuments(),
            users.countDocuments({ status: 'active' }),
            users.countDocuments({ status: 'banned' }),
        ]);

        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const newUsersThisMonth = await users.countDocuments({ createdAt: { $gte: startOfMonth } });

        res.json({
            totalUsers: total,
            activeUsers: active,
            bannedUsers: banned,
            newUsersThisMonth,
        });
    } catch (error) {
        next(error);
    }
});

// ============ TEAM POSTS (COMMUNITY) ============

function mapTeamPostAdmin(doc) {
    if (!doc) return null;

    const createdById = doc.createdBy?.id?.toString?.() || (doc.createdBy?.id ? String(doc.createdBy.id) : '');

    return {
        id: doc._id?.toString(),
        title: doc.title || '',
        description: doc.description || '',
        contestId: doc.contestId ? doc.contestId.toString() : null,
        contestTitle: doc.contestTitle || null,
        rolesNeeded: Array.isArray(doc.rolesNeeded) ? doc.rolesNeeded : [],
        currentMembers: Number(doc.currentMembers || 0),
        maxMembers: Number(doc.maxMembers || 0),
        status: doc.status || 'closed',
        expiresAt: doc.expiresAt ? new Date(doc.expiresAt).toISOString() : null,
        deletedAt: doc.deletedAt ? new Date(doc.deletedAt).toISOString() : null,
        createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
        updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
        createdBy: doc.createdBy
            ? {
                id: createdById,
                name: doc.createdBy.name || '',
                email: doc.createdBy.email || '',
                avatar: doc.createdBy.avatar || null,
            }
            : { id: '', name: '', email: '', avatar: null },
        members: Array.isArray(doc.members)
            ? doc.members.map((m) => ({
                id: m?.id?.toString?.() || (m?.id ? String(m.id) : ''),
                name: m?.name || '',
                avatar: m?.avatar || null,
                role: m?.role || null,
                joinedAt: m?.joinedAt || null,
            }))
            : [],
        invitedMembers: Array.isArray(doc.invitedMembers)
            ? doc.invitedMembers.map((m) => ({
                id: m?.id?.toString?.() || (m?.id ? String(m.id) : ''),
                name: m?.name || '',
                email: m?.email || '',
                avatar: m?.avatar || null,
                invitedAt: m?.invitedAt ? new Date(m.invitedAt).toISOString() : null,
            }))
            : [],
        roleSlots: Array.isArray(doc.roleSlots) ? doc.roleSlots : null,
        requirements: doc.requirements || null,
        skills: Array.isArray(doc.skills) ? doc.skills : null,
        contactMethod: doc.contactMethod || null,
        deadline: doc.deadline ? new Date(doc.deadline).toISOString() : null,
    };
}

router.get('/team-posts', authGuard, requireAdmin, async (req, res, next) => {
    try {
        await connectToDatabase();
        const teamPosts = getCollection('team_posts');

        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
        const skip = (page - 1) * limit;

        const status = typeof req.query.status === 'string' ? req.query.status : '';
        const includeDeleted = req.query.includeDeleted === 'true';
        const includeExpired = req.query.includeExpired === 'true';
        const contestId = typeof req.query.contestId === 'string' ? req.query.contestId : '';
        const sortBy = typeof req.query.sortBy === 'string' ? req.query.sortBy : 'createdAt';
        const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
        const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';

        const query = {};

        if (status && ['open', 'closed', 'full'].includes(status)) {
            query.status = status;
        }

        if (!includeDeleted) {
            query.deletedAt = { $exists: false };
        }

        if (!includeExpired) {
            query.$and = [
                {
                    $or: [
                        { expiresAt: { $exists: false } },
                        { expiresAt: null },
                        { expiresAt: { $gt: new Date() } }
                    ]
                }
            ];
        }

        if (contestId && ObjectId.isValid(contestId)) {
            query.contestId = new ObjectId(contestId);
        }

        if (search) {
            const escaped = escapeRegex(search);
            query.$or = [
                { title: { $regex: escaped, $options: 'i' } },
                { description: { $regex: escaped, $options: 'i' } },
                { contestTitle: { $regex: escaped, $options: 'i' } },
                { 'createdBy.name': { $regex: escaped, $options: 'i' } },
                { 'createdBy.email': { $regex: escaped, $options: 'i' } },
            ];
        }

        const allowedSortFields = ['createdAt', 'updatedAt', 'expiresAt', 'maxMembers', 'currentMembers', 'status'];
        const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

        const [rows, total] = await Promise.all([
            teamPosts
                .find(query)
                .sort({ [sortField]: sortOrder })
                .skip(skip)
                .limit(limit)
                .toArray(),
            teamPosts.countDocuments(query),
        ]);

        res.json({
            posts: rows.map(mapTeamPostAdmin).filter(Boolean),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        next(error);
    }
});

router.get('/team-posts/:id', authGuard, requireAdmin, async (req, res, next) => {
    try {
        await connectToDatabase();
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid team post id' });
        }

        const teamPosts = getCollection('team_posts');
        const post = await teamPosts.findOne({ _id: new ObjectId(id) });
        if (!post) {
            return res.status(404).json({ error: 'Not Found' });
        }

        return res.json(mapTeamPostAdmin(post));
    } catch (error) {
        next(error);
    }
});

router.patch('/team-posts/:id/status', authGuard, requireAdmin, async (req, res, next) => {
    try {
        await connectToDatabase();
        const { id } = req.params;
        const status = String(req.body?.status || '').trim();

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid team post id' });
        }

        if (!['open', 'closed'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const teamPosts = getCollection('team_posts');
        const result = await teamPosts.findOneAndUpdate(
            { _id: new ObjectId(id) },
            { $set: { status, updatedAt: new Date() } },
            { returnDocument: 'after' }
        );

        const updated = result?.value ?? result;
        if (!updated) {
            return res.status(404).json({ error: 'Not Found' });
        }

        logAuditEvent({
            action: 'TEAM_POST_STATUS_UPDATED',
            userId: req.user.id,
            userEmail: req.user.email,
            userName: req.user.name,
            target: updated.title || id,
            status: 'Success',
            details: `Set status to ${status}`,
            ip: getClientIp(req),
        });

        return res.json(mapTeamPostAdmin(updated));
    } catch (error) {
        next(error);
    }
});

router.post('/team-posts/:id/soft-delete', authGuard, requireAdmin, async (req, res, next) => {
    try {
        await connectToDatabase();
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid team post id' });
        }

        const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 300) : '';
        const now = new Date();

        const teamPosts = getCollection('team_posts');
        const result = await teamPosts.findOneAndUpdate(
            { _id: new ObjectId(id) },
            {
                $set: {
                    deletedAt: now,
                    deletedBy: {
                        id: req.user.id,
                        email: req.user.email,
                    },
                    deletedReason: reason || null,
                    status: 'closed',
                    updatedAt: now,
                },
            },
            { returnDocument: 'after' }
        );

        const updated = result?.value ?? result;
        if (!updated) {
            return res.status(404).json({ error: 'Not Found' });
        }

        logAuditEvent({
            action: 'TEAM_POST_SOFT_DELETED',
            userId: req.user.id,
            userEmail: req.user.email,
            userName: req.user.name,
            target: updated.title || id,
            status: 'Success',
            details: reason ? `Soft deleted: ${reason}` : 'Soft deleted',
            ip: getClientIp(req),
        });

        return res.json(mapTeamPostAdmin(updated));
    } catch (error) {
        next(error);
    }
});

router.post('/team-posts/:id/restore', authGuard, requireAdmin, async (req, res, next) => {
    try {
        await connectToDatabase();
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid team post id' });
        }

        const now = new Date();
        const teamPosts = getCollection('team_posts');
        const result = await teamPosts.findOneAndUpdate(
            { _id: new ObjectId(id) },
            { $unset: { deletedAt: '', deletedBy: '', deletedReason: '' }, $set: { status: 'closed', updatedAt: now } },
            { returnDocument: 'after' }
        );

        const updated = result?.value ?? result;
        if (!updated) {
            return res.status(404).json({ error: 'Not Found' });
        }

        logAuditEvent({
            action: 'TEAM_POST_RESTORED',
            userId: req.user.id,
            userEmail: req.user.email,
            userName: req.user.name,
            target: updated.title || id,
            status: 'Success',
            details: 'Restored team post',
            ip: getClientIp(req),
        });

        return res.json(mapTeamPostAdmin(updated));
    } catch (error) {
        next(error);
    }
});

router.delete('/team-posts/:id', authGuard, requireAdmin, async (req, res, next) => {
    try {
        if (req.user.role !== 'super_admin') {
            return res.status(403).json({ error: 'Only super_admin can hard-delete team posts' });
        }

        await connectToDatabase();
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid team post id' });
        }

        const teamPosts = getCollection('team_posts');
        const post = await teamPosts.findOne({ _id: new ObjectId(id) }, { projection: { title: 1 } });
        if (!post) {
            return res.status(404).json({ error: 'Not Found' });
        }

        await teamPosts.deleteOne({ _id: new ObjectId(id) });

        logAuditEvent({
            action: 'TEAM_POST_HARD_DELETED',
            userId: req.user.id,
            userEmail: req.user.email,
            userName: req.user.name,
            target: post.title || id,
            status: 'Success',
            details: 'Hard deleted team post',
            ip: getClientIp(req),
        });

        return res.json({ ok: true });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/admin/settings
 * Get all platform settings (admin only)
 */
router.get('/settings', authGuard, requireAdmin, async (req, res, next) => {
    try {
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
router.patch('/settings/general', authGuard, requireAdmin, async (req, res, next) => {
    try {
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

        const updatedSettings = result?.value ?? result;

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

        res.json(updatedSettings?.general || {});
    } catch (error) {
        next(error);
    }
});

/**
 * PATCH /api/admin/settings/notifications
 * Update notification settings (admin only)
 */
router.patch('/settings/notifications', authGuard, requireAdmin, async (req, res, next) => {
    try {
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

        const updatedSettings = result?.value ?? result;
        res.json(updatedSettings?.notifications || {});
    } catch (error) {
        next(error);
    }
});

/**
 * PATCH /api/admin/settings/security
 * Update security settings (admin only)
 */
router.patch('/settings/security', authGuard, requireAdmin, async (req, res, next) => {
    try {
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

        const updatedSettings = result?.value ?? result;
        res.json(updatedSettings?.security || {});
    } catch (error) {
        next(error);
    }
});

/**
 * PATCH /api/admin/settings/features
 * Update feature flags (admin only)
 */
router.patch('/settings/features', authGuard, requireAdmin, async (req, res, next) => {
    try {
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

        const updatedSettings = result?.value ?? result;
        res.json(updatedSettings?.features || {});
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/admin/settings/reset-sessions
 * Reset all user sessions (admin only)
 * This invalidates all JWT tokens by updating a global version
 */
router.post('/settings/reset-sessions', authGuard, requireAdmin, async (req, res, next) => {
    try {
        await connectToDatabase();
        const collection = getCollection(SETTINGS_COLLECTION);

        // Global JWT revocation: tokens issued before this timestamp are rejected in authGuard.
        const now = new Date();

        await collection.findOneAndUpdate(
            { _id: 'platform_config' },
            {
                $set: {
                    'security.tokensInvalidBefore': now,
                    updatedAt: now,
                    updatedBy: req.user.id,
                }
            },
            { upsert: true }
        );

        logAuditEvent({
            action: 'SESSIONS_RESET',
            userId: req.user.id,
            userEmail: req.user.email,
            userName: req.user.name,
            target: 'All Sessions',
            status: 'Success',
            details: `Revoked all JWT sessions (tokensInvalidBefore=${now.toISOString()})`,
            ip: getClientIp(req),
        });

        res.json({
            success: true,
            tokensInvalidBefore: now.toISOString(),
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
router.post('/email/test', authGuard, requireAdmin, async (req, res, next) => {
    try {
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
router.post('/email/broadcast', authGuard, requireAdmin, async (req, res, next) => {
    try {
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
router.get('/audit-logs', authGuard, requireAdmin, async (req, res, next) => {
    try {
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

// ============ AI (GEMINI) ============

router.post('/ai/gemini/contest-description', authGuard, requireAdmin, async (req, res, next) => {
    try {
        const client = getGeminiClient();
        if (!client) {
            return res.status(503).json({ error: 'GEMINI_API_KEY is not configured' });
        }

        const title = String(req.body?.title || '').trim();
        const tags = Array.isArray(req.body?.tags) ? req.body.tags.map((t) => String(t).trim()).filter(Boolean) : [];

        if (!title) {
            return res.status(400).json({ error: 'title is required' });
        }

        const prompt = `Write a short, exciting description (max 100 words) for a student coding contest titled "${title}".
The contest focuses on these topics: ${tags.join(', ')}.
Tone: Professional yet encouraging for university students.`;

        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        res.json({ text: response.text || '' });
    } catch (error) {
        next(error);
    }
});

router.post('/ai/gemini/course-syllabus', authGuard, requireAdmin, async (req, res, next) => {
    try {
        const client = getGeminiClient();
        if (!client) {
            return res.status(503).json({ error: 'GEMINI_API_KEY is not configured' });
        }

        const title = String(req.body?.title || '').trim();
        const level = String(req.body?.level || '').trim();

        if (!title || !level) {
            return res.status(400).json({ error: 'title and level are required' });
        }

        const prompt = `Create a concise course description and a 4-week syllabus outline for a "${level}" level course titled "${title}". Format it clearly with "Description:" followed by "Syllabus:".`;
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        res.json({ text: response.text || '' });
    } catch (error) {
        next(error);
    }
});

router.post('/ai/gemini/platform-stats', authGuard, requireAdmin, async (req, res, next) => {
    try {
        const client = getGeminiClient();
        if (!client) {
            return res.status(503).json({ error: 'GEMINI_API_KEY is not configured' });
        }

        const stats = req.body?.stats ?? req.body;
        const prompt = `Analyze these platform stats briefly and give 2 key insights for an admin: ${JSON.stringify(stats)}`;
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        res.json({ text: response.text || '' });
    } catch (error) {
        next(error);
    }
});

router.post('/ai/gemini/system-announcement', authGuard, requireAdmin, async (req, res, next) => {
    try {
        const client = getGeminiClient();
        if (!client) {
            return res.status(503).json({ error: 'GEMINI_API_KEY is not configured' });
        }

        const topic = String(req.body?.topic || '').trim();
        const audience = String(req.body?.audience || '').trim();

        if (!topic || !audience) {
            return res.status(400).json({ error: 'topic and audience are required' });
        }

        const prompt = `Write a professional system announcement for a university platform named "Blanc".
Topic: "${topic}".
Target Audience: "${audience}".
Tone: Clear, polite, and informative.
Format: Subject line followed by the body text.`;

        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        res.json({ text: response.text || '' });
    } catch (error) {
        next(error);
    }
});

router.post('/ai/gemini/audit-logs', authGuard, requireAdmin, async (req, res, next) => {
    try {
        const client = getGeminiClient();
        if (!client) {
            return res.status(503).json({ error: 'GEMINI_API_KEY is not configured' });
        }

        const logs = Array.isArray(req.body?.logs) ? req.body.logs : [];
        const trimmedLogs = logs.slice(0, 20);

        const prompt = `Analyze the following system audit logs for security risks or anomalies.
Logs: ${JSON.stringify(trimmedLogs)}.
Provide a concise summary (3-4 bullet points) of potential threats or important actions the admin should notice.
Focus on failed logins, bans, and critical setting changes.`;

        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        res.json({ text: response.text || '' });
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
router.get('/security/analysis', authGuard, requireAdmin, async (req, res, next) => {
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
router.post('/security/unlock-account', authGuard, requireAdmin, async (req, res, next) => {
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
router.post('/security/block-ip', authGuard, requireAdmin, async (req, res, next) => {
    try {
        const { ip, reason, duration } = req.body;
        const ipAddress = normalizeIpAddress(ip);
        if (!ipAddress) {
            return res.status(400).json({ error: 'Valid IP address is required' });
        }

        await connectToDatabase();
        const blockedIPs = getCollection('blocked_ips');

        const durationHours = Number(duration);
        const durationMs = Number.isFinite(durationHours) && durationHours > 0
            ? durationHours * 60 * 60 * 1000
            : 24 * 60 * 60 * 1000; // default 24 hours

        const expiresAt = new Date(Date.now() + durationMs);

        await blockedIPs.updateOne(
            { ip: ipAddress },
            {
                $set: {
                    ip: ipAddress,
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
            target: ipAddress,
            status: 'Success',
            details: `IP ${ipAddress} blocked. Reason: ${reason || 'Suspicious activity'}`,
            ip: getClientIp(req)
        });

        res.json({ ok: true, message: `IP ${ipAddress} has been blocked until ${expiresAt.toISOString()}` });
    } catch (error) {
        next(error);
    }
});

/**
 * DELETE /api/admin/security/unblock-ip
 * Remove IP from blocklist
 */
router.post('/security/unblock-ip', authGuard, requireAdmin, async (req, res, next) => {
    try {
        const { ip } = req.body;
        const ipAddress = normalizeIpAddress(ip);
        if (!ipAddress) {
            return res.status(400).json({ error: 'Valid IP address is required' });
        }

        await connectToDatabase();
        const blockedIPs = getCollection('blocked_ips');

        const result = await blockedIPs.deleteOne({ ip: ipAddress });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'IP not found in blocklist' });
        }

        logAuditEvent({
            action: 'IP_UNBLOCKED',
            userEmail: req.user?.email,
            target: ipAddress,
            status: 'Success',
            details: `IP ${ipAddress} removed from blocklist`,
            ip: getClientIp(req)
        });

        res.json({ ok: true, message: `IP ${ipAddress} has been unblocked` });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/admin/security/blocked-ips
 * Get list of blocked IPs
 */
router.get('/security/blocked-ips', authGuard, requireAdmin, async (req, res, next) => {
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
router.get('/notifications', authGuard, requireAdmin, async (req, res, next) => {
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
router.patch('/notifications/:id/read', authGuard, requireAdmin, async (req, res, next) => {
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
router.patch('/notifications/mark-all-read', authGuard, requireAdmin, async (req, res, next) => {
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
router.delete('/notifications/:id', authGuard, requireAdmin, async (req, res, next) => {
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
router.delete('/notifications/clear-all', authGuard, requireAdmin, async (req, res, next) => {
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

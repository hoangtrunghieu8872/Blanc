import crypto from 'crypto';
import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { connectToDatabase, getCollection } from '../lib/db.js';
import { authGuard } from '../middleware/auth.js';

const router = Router();

// ============ HELPERS ============

/**
 * Generate HMAC signature for notification requests
 * @param {string} action - The notification action type
 * @param {string} secretKey - The secret key for HMAC
 * @param {string} [email] - Optional email to include in signature (for email-bound requests)
 */
function generateSignature(action, secretKey, email = null) {
    const timestamp = Date.now();
    const nonce = crypto.randomUUID();

    // Build canonical string - MUST match App Script's verification order:
    // action, nonce, timestamp, [email]
    let canonicalString = `action=${action}&nonce=${nonce}&timestamp=${timestamp}`;
    if (email) {
        canonicalString += `&email=${email}`;
    }

    const signature = crypto
        .createHmac('sha256', secretKey)
        .update(canonicalString)
        .digest('base64');

    return { timestamp, nonce, signature };
}

/**
 * Send notification to App Script
 */
async function sendToAppScript(payload) {
    const notificationUrl = process.env.NOTIFICATION_EMAIL_URL;

    if (!notificationUrl) {
        throw new Error('NOTIFICATION_EMAIL_URL is not configured');
    }

    const secretKey = process.env.OTP_SECRET_KEY;
    if (!secretKey) {
        throw new Error('OTP_SECRET_KEY is not configured');
    }

    // Include email in signature if present in payload
    const sigData = generateSignature(payload.action, secretKey, payload.email || null);

    const response = await fetch(notificationUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ...payload,
            ...sigData
        })
    });

    const result = await response.json();

    if (!result.ok) {
        throw new Error(result.error || 'Failed to send notification');
    }

    return result;
}

/**
 * Check if user has enabled specific notification type
 */
async function checkUserNotificationPreference(userId, notificationType) {
    const users = getCollection('users');
    const user = await users.findOne(
        { _id: new ObjectId(userId) },
        { projection: { notifications: 1, email: 1, name: 1 } }
    );

    if (!user) return null;

    const prefs = user.notifications || {};

    // Map notification type to preference key
    const prefMap = {
        contestReminder: prefs.contestReminders !== false,
        courseUpdate: prefs.courseUpdates !== false,
        marketing: prefs.marketing === true, // Default off
        announcement: prefs.email !== false // System announcements always on if email is on
    };

    return {
        enabled: prefMap[notificationType] ?? true,
        email: user.email,
        name: user.name
    };
}

// ============ ROUTES ============

/**
 * POST /api/notifications/contest-reminder
 * Send contest reminder to registered users
 * (Admin only or triggered by scheduler)
 */
router.post('/contest-reminder', authGuard, async (req, res, next) => {
    try {
        await connectToDatabase();

        const { contestId, reminderType } = req.body;

        if (!contestId) {
            return res.status(400).json({ error: 'Contest ID is required' });
        }

        if (!['24h', '1h'].includes(reminderType)) {
            return res.status(400).json({ error: 'Invalid reminder type. Use "24h" or "1h"' });
        }

        // Get contest details
        const contests = getCollection('contests');
        const contest = await contests.findOne({ _id: new ObjectId(contestId) });

        if (!contest) {
            return res.status(404).json({ error: 'Contest not found' });
        }

        // Get registered users
        const registrations = getCollection('registrations');
        const regs = await registrations.find({ contestId: contestId }).toArray();

        if (regs.length === 0) {
            return res.json({ message: 'No registrations found', sent: 0 });
        }

        // Get user IDs
        const userIds = regs.map(r => new ObjectId(r.userId));

        // Get users with notification preferences
        const users = getCollection('users');
        const usersData = await users.find(
            { _id: { $in: userIds } },
            { projection: { email: 1, name: 1, notifications: 1 } }
        ).toArray();

        // Filter users who want contest reminders
        const eligibleUsers = usersData.filter(u => {
            const notifs = u.notifications || {};
            return notifs.contestReminders !== false && notifs.email !== false;
        });

        // Format date
        const contestDate = new Date(contest.dateStart);
        const dateStr = contestDate.toLocaleDateString('vi-VN', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const timeStr = contestDate.toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit'
        });

        // Send notifications
        let sent = 0;
        let failed = 0;
        const errors = [];

        for (const user of eligibleUsers) {
            try {
                await sendToAppScript({
                    action: 'contestReminder',
                    email: user.email,
                    userName: user.name || 'bạn',
                    contestTitle: contest.title,
                    contestDate: dateStr,
                    contestTime: timeStr,
                    contestUrl: `${process.env.FRONTEND_ORIGIN?.split(',')[0] || 'http://localhost:5173'}/#/contests/${contestId}`,
                    reminderType
                });
                sent++;
            } catch (err) {
                failed++;
                errors.push({ email: user.email, error: err.message });
            }

            // Rate limiting - wait 100ms between emails
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Log the notification batch
        const notificationLogs = getCollection('notification_logs');
        await notificationLogs.insertOne({
            type: 'contestReminder',
            contestId,
            reminderType,
            totalUsers: eligibleUsers.length,
            sent,
            failed,
            errors: errors.length > 0 ? errors : undefined,
            createdAt: new Date(),
            createdBy: req.user.id
        });

        res.json({
            message: 'Contest reminders sent',
            total: eligibleUsers.length,
            sent,
            failed,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/notifications/course-update
 * Send course update notification to enrolled users
 */
router.post('/course-update', authGuard, async (req, res, next) => {
    try {
        await connectToDatabase();

        const { courseId, updateType, updateTitle } = req.body;

        if (!courseId || !updateTitle) {
            return res.status(400).json({ error: 'Course ID and update title are required' });
        }

        // Get course details
        const courses = getCollection('courses');
        const course = await courses.findOne({ _id: new ObjectId(courseId) });

        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }

        // Get enrolled users (assuming there's an enrollments collection)
        const enrollments = getCollection('enrollments');
        const enrolled = await enrollments.find({ courseId: courseId }).toArray();

        if (enrolled.length === 0) {
            return res.json({ message: 'No enrollments found', sent: 0 });
        }

        const userIds = enrolled.map(e => new ObjectId(e.userId));

        const users = getCollection('users');
        const usersData = await users.find(
            { _id: { $in: userIds } },
            { projection: { email: 1, name: 1, notifications: 1 } }
        ).toArray();

        // Filter users who want course updates
        const eligibleUsers = usersData.filter(u => {
            const notifs = u.notifications || {};
            return notifs.courseUpdates !== false && notifs.email !== false;
        });

        let sent = 0;
        let failed = 0;

        for (const user of eligibleUsers) {
            try {
                await sendToAppScript({
                    action: 'courseUpdate',
                    email: user.email,
                    userName: user.name || 'bạn',
                    courseTitle: course.title,
                    updateType: updateType || 'lesson',
                    updateTitle,
                    courseUrl: `${process.env.FRONTEND_ORIGIN?.split(',')[0] || 'http://localhost:5173'}/#/courses/${courseId}`
                });
                sent++;
            } catch (err) {
                failed++;
            }

            await new Promise(resolve => setTimeout(resolve, 100));
        }

        res.json({
            message: 'Course update notifications sent',
            total: eligibleUsers.length,
            sent,
            failed
        });

    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/notifications/announcement
 * Send system announcement to all users or specific groups
 */
router.post('/announcement', authGuard, async (req, res, next) => {
    try {
        await connectToDatabase();

        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { title, message, severity, targetAudience } = req.body;

        if (!title || !message) {
            return res.status(400).json({ error: 'Title and message are required' });
        }

        const users = getCollection('users');

        // Build query based on target audience
        let query = {};
        if (targetAudience === 'students') {
            query.role = 'student';
        } else if (targetAudience === 'instructors') {
            query.role = 'instructor';
        } else if (targetAudience === 'admins') {
            query.role = 'admin';
        }
        // 'all' = no filter

        const usersData = await users.find(
            query,
            { projection: { email: 1, name: 1, notifications: 1 } }
        ).toArray();

        // Filter users who have email notifications enabled
        const eligibleUsers = usersData.filter(u => {
            const notifs = u.notifications || {};
            return notifs.email !== false;
        });

        let sent = 0;
        let failed = 0;

        for (const user of eligibleUsers) {
            try {
                await sendToAppScript({
                    action: 'announcement',
                    email: user.email,
                    userName: user.name || 'bạn',
                    title,
                    message,
                    severity: severity || 'info'
                });
                sent++;
            } catch (err) {
                failed++;
            }

            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Log announcement
        const notificationLogs = getCollection('notification_logs');
        await notificationLogs.insertOne({
            type: 'announcement',
            title,
            message,
            severity,
            targetAudience,
            totalUsers: eligibleUsers.length,
            sent,
            failed,
            createdAt: new Date(),
            createdBy: req.user.id
        });

        res.json({
            message: 'Announcement sent',
            total: eligibleUsers.length,
            sent,
            failed
        });

    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/notifications/test
 * Test notification to current user (for debugging)
 */
router.post('/test', authGuard, async (req, res, next) => {
    try {
        await connectToDatabase();

        const { type } = req.body;

        const users = getCollection('users');
        const user = await users.findOne({ _id: new ObjectId(req.user.id) });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        let result;

        switch (type) {
            case 'contestReminder':
                result = await sendToAppScript({
                    action: 'contestReminder',
                    email: user.email,
                    userName: user.name || 'bạn',
                    contestTitle: 'Cuộc thi thử nghiệm',
                    contestDate: 'Thứ Bảy, 30 tháng 11, 2024',
                    contestTime: '09:00',
                    contestUrl: 'https://blanc.com',
                    reminderType: '1h'
                });
                break;

            case 'courseUpdate':
                result = await sendToAppScript({
                    action: 'courseUpdate',
                    email: user.email,
                    userName: user.name || 'bạn',
                    courseTitle: 'Khóa học thử nghiệm',
                    updateType: 'lesson',
                    updateTitle: 'Bài học mới: Test Notification',
                    courseUrl: 'https://blanc.com'
                });
                break;

            case 'announcement':
                result = await sendToAppScript({
                    action: 'announcement',
                    email: user.email,
                    userName: user.name || 'bạn',
                    title: 'Thông báo thử nghiệm',
                    message: 'Đây là email thử nghiệm hệ thống thông báo của Blanc.',
                    severity: 'info'
                });
                break;

            default:
                return res.status(400).json({ error: 'Invalid type. Use: contestReminder, courseUpdate, announcement' });
        }

        res.json({
            message: 'Test notification sent',
            email: user.email,
            result
        });

    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/notifications/logs
 * Get notification logs (admin only)
 */
router.get('/logs', authGuard, async (req, res, next) => {
    try {
        await connectToDatabase();

        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { type, limit = 50, skip = 0 } = req.query;

        const notificationLogs = getCollection('notification_logs');

        const query = type ? { type } : {};

        const logs = await notificationLogs
            .find(query)
            .sort({ createdAt: -1 })
            .skip(parseInt(skip))
            .limit(parseInt(limit))
            .toArray();

        const total = await notificationLogs.countDocuments(query);

        res.json({
            logs,
            total,
            limit: parseInt(limit),
            skip: parseInt(skip)
        });

    } catch (error) {
        next(error);
    }
});

export default router;

import { Router } from 'express';
import { ObjectId } from 'mongodb';
import crypto from 'crypto';
import { connectToDatabase, getCollection } from '../lib/db.js';
import { authGuard } from '../middleware/auth.js';

const router = Router();

// Constants for workload limits
const WORKLOAD_LIMITS = {
    MAX_ACTIVE_CONTESTS: 5,
    MAX_ACTIVE_COURSES: 8,
    MAX_WEEKLY_EVENTS: 10,
    WARNING_THRESHOLD_CONTESTS: 3,
    WARNING_THRESHOLD_COURSES: 5,
};

// ============ NOTIFICATION HELPER ============

/**
 * Generate HMAC signature for notification requests
 * @param {string} action - The notification action type
 * @param {string} secretKey - The secret key for HMAC
 * @param {string} [email] - Optional email to include in signature
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
 * Send contest registration confirmation email (async, non-blocking)
 */
async function sendContestRegistrationEmail(userEmail, userName, contest) {
    const notificationUrl = process.env.NOTIFICATION_EMAIL_URL;
    const secretKey = process.env.OTP_SECRET_KEY;

    if (!notificationUrl || !secretKey) {
        console.log('[registrations] Notification not configured, skipping');
        return;
    }

    // Format date
    let contestDate = '';
    let contestTime = '';
    if (contest.dateStart) {
        const date = new Date(contest.dateStart);
        contestDate = date.toLocaleDateString('vi-VN', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        contestTime = date.toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    const frontendUrl = process.env.FRONTEND_ORIGIN?.split(',')[0] || 'http://localhost:5173';

    // Run asynchronously
    setImmediate(async () => {
        try {
            // Include email in signature for email-bound verification
            const sigData = generateSignature('contestRegistration', secretKey, userEmail);

            const response = await fetch(notificationUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'contestRegistration',
                    email: userEmail,
                    userName: userName || 'bạn',
                    contestTitle: contest.title,
                    contestDate,
                    contestTime,
                    contestUrl: `${frontendUrl}/#/contests/${contest._id.toString()}`,
                    organizerName: contest.organizer,
                    ...sigData
                })
            });

            const result = await response.json();
            if (result.ok) {
                console.log(`[registrations] Confirmation email sent to ${userEmail}`);
            } else {
                console.error(`[registrations] Failed to send email: ${result.error}`);
            }
        } catch (err) {
            console.error('[registrations] Error sending email:', err.message);
        }
    });
}

// Helper: Sanitize and validate ObjectId
function isValidObjectId(id) {
    return id && ObjectId.isValid(id) && new ObjectId(id).toString() === id;
}

// Helper: Map registration document
function mapRegistration(doc, contest = null) {
    return {
        id: doc._id?.toString(),
        contestId: doc.contestId?.toString(),
        userId: doc.userId?.toString(),
        registeredAt: doc.registeredAt,
        status: doc.status,
        contest: contest ? {
            id: contest._id?.toString(),
            title: contest.title,
            organizer: contest.organizer,
            dateStart: contest.dateStart,
            deadline: contest.deadline,
            status: contest.status,
            tags: contest.tags || [],
            image: contest.image,
        } : null,
    };
}

// GET /api/registrations - Get user's registered contests with schedule
router.get('/', authGuard, async (req, res, next) => {
    try {
        await connectToDatabase();
        const userId = req.user.id;

        // Input validation
        if (!isValidObjectId(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        // Get registrations with pagination
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
        const skip = (page - 1) * limit;

        const registrations = await getCollection('registrations')
            .find({
                userId: new ObjectId(userId),
                status: { $in: ['active', 'completed'] }
            })
            .sort({ registeredAt: -1 })
            .skip(skip)
            .limit(limit)
            .toArray();

        // Get contest details for each registration
        const contestIds = registrations
            .map(r => r.contestId)
            .filter(id => id);

        const contests = contestIds.length > 0
            ? await getCollection('contests')
                .find(
                    { _id: { $in: contestIds } },
                    { projection: { title: 1, organizer: 1, dateStart: 1, deadline: 1, status: 1, tags: 1, image: 1 } }
                )
                .toArray()
            : [];

        const contestMap = new Map(contests.map(c => [c._id.toString(), c]));

        const result = registrations.map(reg =>
            mapRegistration(reg, contestMap.get(reg.contestId?.toString()))
        );

        res.json({
            registrations: result,
            pagination: { page, limit, hasMore: registrations.length === limit }
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/registrations/schedule - Get user's contest & course schedule for calendar
router.get('/schedule', authGuard, async (req, res, next) => {
    try {
        await connectToDatabase();
        const userId = req.user.id;

        if (!isValidObjectId(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        // Parse date range (default: current month ± 1 month)
        const now = new Date();
        const startDate = req.query.startDate
            ? new Date(req.query.startDate)
            : new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endDate = req.query.endDate
            ? new Date(req.query.endDate)
            : new Date(now.getFullYear(), now.getMonth() + 2, 0);

        // Validate dates
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return res.status(400).json({ error: 'Invalid date format' });
        }

        const userObjectId = new ObjectId(userId);
        const schedule = [];

        // Get active contest registrations
        const registrations = await getCollection('registrations')
            .find({
                userId: userObjectId,
                status: 'active'
            })
            .toArray();

        const contestIds = registrations.map(r => r.contestId).filter(Boolean);

        // Get contests within date range
        if (contestIds.length > 0) {
            const contests = await getCollection('contests')
                .find({
                    _id: { $in: contestIds },
                    $or: [
                        { dateStart: { $gte: startDate.toISOString(), $lte: endDate.toISOString() } },
                        { deadline: { $gte: startDate.toISOString(), $lte: endDate.toISOString() } }
                    ]
                })
                .project({ title: 1, organizer: 1, dateStart: 1, deadline: 1, status: 1, tags: 1, image: 1 })
                .toArray();

            contests.forEach(contest => {
                schedule.push({
                    id: contest._id.toString(),
                    title: contest.title,
                    organizer: contest.organizer,
                    dateStart: contest.dateStart,
                    deadline: contest.deadline,
                    status: contest.status,
                    tags: contest.tags || [],
                    image: contest.image,
                    type: 'contest',
                });
            });
        }

        // Get active course enrollments
        const enrollments = await getCollection('enrollments')
            .find({
                userId: userObjectId,
                status: 'active'
            })
            .toArray();

        const courseIds = enrollments.map(e => e.courseId).filter(Boolean);

        // Get courses with schedule info within date range
        if (courseIds.length > 0) {
            const courses = await getCollection('courses')
                .find({
                    _id: { $in: courseIds },
                    $or: [
                        { startDate: { $exists: true } },
                        { endDate: { $exists: true } }
                    ]
                })
                .project({ title: 1, instructor: 1, startDate: 1, endDate: 1, level: 1, image: 1, duration: 1, hoursPerWeek: 1 })
                .toArray();

            courses.forEach(course => {
                // Use startDate and endDate if available, otherwise use enrollment date
                const enrollment = enrollments.find(e => e.courseId?.toString() === course._id.toString());
                const courseStartDate = course.startDate || enrollment?.enrolledAt?.toISOString();
                const courseEndDate = course.endDate || (course.startDate ?
                    // If no end date but has start date, estimate based on duration or 30 days
                    new Date(new Date(course.startDate).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
                    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());

                // Check if course falls within date range
                const start = new Date(courseStartDate);
                const end = new Date(courseEndDate);
                if (start <= endDate && end >= startDate) {
                    schedule.push({
                        id: course._id.toString(),
                        title: `📚 ${course.title}`,
                        organizer: course.instructor,
                        dateStart: courseStartDate,
                        deadline: courseEndDate,
                        status: 'OPEN',
                        tags: [course.level, course.duration || '', course.hoursPerWeek ? `${course.hoursPerWeek}h/tuần` : ''].filter(Boolean),
                        image: course.image,
                        type: 'course',
                    });
                }
            });
        }

        res.json({
            schedule,
            totalActive: registrations.length + enrollments.length
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/registrations/workload - Get user's workload analysis and warnings
router.get('/workload', authGuard, async (req, res, next) => {
    try {
        await connectToDatabase();
        const userId = req.user.id;

        if (!isValidObjectId(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        const userObjectId = new ObjectId(userId);
        const now = new Date();
        const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        // Get active contest registrations
        const contestRegistrations = await getCollection('registrations')
            .find({ userId: userObjectId, status: 'active' })
            .toArray();

        // Get enrolled courses
        const courseEnrollments = await getCollection('enrollments')
            .find({ userId: userObjectId, status: 'active' })
            .toArray();

        const contestIds = contestRegistrations.map(r => r.contestId).filter(Boolean);

        // Get upcoming contests (within next 7 days)
        const upcomingContests = contestIds.length > 0
            ? await getCollection('contests')
                .find({
                    _id: { $in: contestIds },
                    dateStart: {
                        $gte: now.toISOString(),
                        $lte: weekFromNow.toISOString()
                    }
                })
                .toArray()
            : [];

        // Calculate workload metrics
        const activeContests = contestRegistrations.length;
        const activeCourses = courseEnrollments.length;
        const weeklyEvents = upcomingContests.length;

        // Generate warnings based on thresholds
        const warnings = [];
        let overallStatus = 'normal'; // normal, warning, critical

        // Check contest overload
        if (activeContests >= WORKLOAD_LIMITS.MAX_ACTIVE_CONTESTS) {
            warnings.push({
                type: 'critical',
                category: 'contests',
                message: `Bạn đang tham gia ${activeContests} cuộc thi, vượt quá giới hạn khuyến nghị (${WORKLOAD_LIMITS.MAX_ACTIVE_CONTESTS}). Hãy cân nhắc giảm bớt để đảm bảo chất lượng.`,
                suggestion: 'Hoàn thành các cuộc thi hiện tại trước khi đăng ký thêm.',
            });
            overallStatus = 'critical';
        } else if (activeContests >= WORKLOAD_LIMITS.WARNING_THRESHOLD_CONTESTS) {
            warnings.push({
                type: 'warning',
                category: 'contests',
                message: `Bạn đang tham gia ${activeContests} cuộc thi. Hãy quản lý thời gian hợp lý.`,
                suggestion: 'Lập kế hoạch chi tiết cho từng cuộc thi để tránh trùng lịch.',
            });
            if (overallStatus !== 'critical') overallStatus = 'warning';
        }

        // Check course overload
        if (activeCourses >= WORKLOAD_LIMITS.MAX_ACTIVE_COURSES) {
            warnings.push({
                type: 'critical',
                category: 'courses',
                message: `Bạn đang học ${activeCourses} khóa học, vượt quá giới hạn khuyến nghị (${WORKLOAD_LIMITS.MAX_ACTIVE_COURSES}). Việc học quá nhiều có thể giảm hiệu quả.`,
                suggestion: 'Tập trung hoàn thành một số khóa học trước khi đăng ký thêm.',
            });
            overallStatus = 'critical';
        } else if (activeCourses >= WORKLOAD_LIMITS.WARNING_THRESHOLD_COURSES) {
            warnings.push({
                type: 'warning',
                category: 'courses',
                message: `Bạn đang học ${activeCourses} khóa học. Hãy đảm bảo có đủ thời gian cho mỗi khóa.`,
                suggestion: 'Ưu tiên các khóa học quan trọng nhất và phân bổ thời gian hợp lý.',
            });
            if (overallStatus !== 'critical') overallStatus = 'warning';
        }

        // Check weekly schedule conflict
        if (weeklyEvents >= WORKLOAD_LIMITS.MAX_WEEKLY_EVENTS) {
            warnings.push({
                type: 'critical',
                category: 'schedule',
                message: `Bạn có ${weeklyEvents} sự kiện trong tuần tới. Lịch trình quá dày có thể gây stress.`,
                suggestion: 'Xem xét hoãn hoặc hủy bớt một số hoạt động không quan trọng.',
            });
            overallStatus = 'critical';
        }

        // Check for overlapping contest dates
        if (upcomingContests.length >= 2) {
            const sortedContests = upcomingContests.sort((a, b) =>
                new Date(a.dateStart).getTime() - new Date(b.dateStart).getTime()
            );

            for (let i = 0; i < sortedContests.length - 1; i++) {
                const current = sortedContests[i];
                const next = sortedContests[i + 1];
                const currentEnd = new Date(current.deadline || current.dateStart);
                const nextStart = new Date(next.dateStart);

                // Check if contests overlap or are too close (within 24 hours)
                const timeDiff = nextStart.getTime() - currentEnd.getTime();
                if (timeDiff < 24 * 60 * 60 * 1000) {
                    warnings.push({
                        type: 'warning',
                        category: 'overlap',
                        message: `Cuộc thi "${current.title}" và "${next.title}" có lịch trình gần nhau. Có thể gây khó khăn trong việc chuẩn bị.`,
                        suggestion: 'Kiểm tra lại lịch trình và ưu tiên cuộc thi quan trọng hơn.',
                        contests: [current._id.toString(), next._id.toString()],
                    });
                    if (overallStatus === 'normal') overallStatus = 'warning';
                }
            }
        }

        // Calculate health score (0-100)
        let healthScore = 100;
        healthScore -= Math.min(30, activeContests * 6); // Max -30 for contests
        healthScore -= Math.min(30, activeCourses * 4); // Max -30 for courses
        healthScore -= Math.min(20, weeklyEvents * 4); // Max -20 for weekly events
        healthScore -= warnings.filter(w => w.type === 'critical').length * 10;
        healthScore -= warnings.filter(w => w.type === 'warning').length * 5;
        healthScore = Math.max(0, Math.min(100, healthScore));

        res.json({
            workload: {
                activeContests,
                activeCourses,
                weeklyEvents,
                upcomingContests: upcomingContests.map(c => ({
                    id: c._id.toString(),
                    title: c.title,
                    dateStart: c.dateStart,
                    deadline: c.deadline,
                })),
            },
            limits: WORKLOAD_LIMITS,
            warnings,
            overallStatus,
            healthScore,
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/registrations - Register for a contest
router.post('/', authGuard, async (req, res, next) => {
    try {
        await connectToDatabase();
        const userId = req.user.id;
        const { contestId } = req.body;

        // Validate inputs
        if (!isValidObjectId(userId) || !isValidObjectId(contestId)) {
            return res.status(400).json({ error: 'Invalid user or contest ID' });
        }

        const userObjectId = new ObjectId(userId);
        const contestObjectId = new ObjectId(contestId);

        // Check if contest exists and is open
        const contest = await getCollection('contests').findOne({
            _id: contestObjectId,
            status: 'OPEN'
        });

        if (!contest) {
            return res.status(404).json({ error: 'Contest not found or not open for registration' });
        }

        // Check for existing registration
        const existingReg = await getCollection('registrations').findOne({
            userId: userObjectId,
            contestId: contestObjectId,
            status: { $ne: 'cancelled' }
        });

        if (existingReg) {
            return res.status(409).json({ error: 'Already registered for this contest' });
        }

        // Check workload before allowing registration
        const activeRegistrations = await getCollection('registrations')
            .countDocuments({ userId: userObjectId, status: 'active' });

        if (activeRegistrations >= WORKLOAD_LIMITS.MAX_ACTIVE_CONTESTS) {
            return res.status(400).json({
                error: 'Maximum active contests limit reached',
                message: `Bạn đã đạt giới hạn ${WORKLOAD_LIMITS.MAX_ACTIVE_CONTESTS} cuộc thi. Vui lòng hoàn thành hoặc hủy bớt trước khi đăng ký thêm.`
            });
        }

        // Create registration
        const registration = {
            userId: userObjectId,
            contestId: contestObjectId,
            registeredAt: new Date(),
            status: 'active',
        };

        const result = await getCollection('registrations').insertOne(registration);

        // Get user info for email
        const user = await getCollection('users').findOne(
            { _id: userObjectId },
            { projection: { email: 1, name: 1, notifications: 1 } }
        );

        // Send confirmation email if user has notifications enabled
        if (user && user.notifications?.email !== false) {
            sendContestRegistrationEmail(user.email, user.name, contest);
        }

        // Return warning if approaching limit
        const newCount = activeRegistrations + 1;
        const warning = newCount >= WORKLOAD_LIMITS.WARNING_THRESHOLD_CONTESTS
            ? `Bạn đang tham gia ${newCount} cuộc thi. Hãy quản lý thời gian hợp lý.`
            : null;

        res.status(201).json({
            id: result.insertedId.toString(),
            message: 'Đăng ký thành công',
            warning,
        });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/registrations/:contestId - Cancel registration
router.delete('/:contestId', authGuard, async (req, res, next) => {
    try {
        await connectToDatabase();
        const userId = req.user.id;
        const { contestId } = req.params;

        if (!isValidObjectId(userId) || !isValidObjectId(contestId)) {
            return res.status(400).json({ error: 'Invalid user or contest ID' });
        }

        const result = await getCollection('registrations').updateOne(
            {
                userId: new ObjectId(userId),
                contestId: new ObjectId(contestId),
                status: 'active'
            },
            {
                $set: {
                    status: 'cancelled',
                    cancelledAt: new Date()
                }
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Registration not found' });
        }

        res.json({ message: 'Hủy đăng ký thành công' });
    } catch (error) {
        next(error);
    }
});

export default router;

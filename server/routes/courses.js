import { Router } from 'express';
import { ObjectId } from 'mongodb';
import crypto from 'crypto';
import { connectToDatabase, getCollection } from '../lib/db.js';
import { authGuard, requireRole } from '../middleware/auth.js';

const router = Router();

const courseFields = {
    projection: {
        code: 1,
        title: 1,
        instructor: 1,
        price: 1,
        rating: 1,
        reviewsCount: 1,
        level: 1,
        image: 1,
        description: 1,
        duration: 1,
        hoursPerWeek: 1,
        startDate: 1,
        endDate: 1,
        contactInfo: 1,
        contactType: 1,
        lessonsCount: 1,
        isPublic: 1,
        benefits: 1,
        sections: 1,
        createdAt: 1,
        updatedAt: 1,
    },
};

const ALLOWED_LEVELS = new Set(['Beginner', 'Intermediate', 'Advanced']);
const ALLOWED_SORT_FIELDS = new Set(['createdAt', 'rating', 'price', 'title', 'reviewsCount']);

function escapeRegExp(value = '') {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============ NOTIFICATION HELPERS ============

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
 * Send course update notification to enrolled users
 * @param {string} courseId 
 * @param {string} courseTitle 
 * @param {string} updateType - 'lesson' | 'quiz' | 'material'
 * @param {string} updateTitle 
 */
async function sendCourseUpdateNotification(courseId, courseTitle, updateType, updateTitle) {
    const notificationUrl = process.env.NOTIFICATION_EMAIL_URL;
    const secretKey = process.env.OTP_SECRET_KEY;

    if (!notificationUrl || !secretKey) {
        console.log('[courses] Notification not configured, skipping...');
        return;
    }

    try {
        // Get enrolled users
        const enrollments = getCollection('enrollments');
        const enrolled = await enrollments.find({ courseId }).toArray();

        if (enrolled.length === 0) return;

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

        const frontendUrl = process.env.FRONTEND_ORIGIN?.split(',')[0] || 'http://localhost:5173';

        // Send notifications asynchronously (don't block response)
        setImmediate(async () => {
            for (const user of eligibleUsers) {
                try {
                    // Include email in signature for email-bound verification
                    const sigData = generateSignature('courseUpdate', secretKey, user.email);

                    await fetch(notificationUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'courseUpdate',
                            email: user.email,
                            userName: user.name || 'bạn',
                            courseTitle,
                            updateType,
                            updateTitle,
                            courseUrl: `${frontendUrl}/#/courses/${courseId}`,
                            ...sigData
                        })
                    });

                    // Rate limiting
                    await new Promise(resolve => setTimeout(resolve, 200));
                } catch (err) {
                    console.error(`[courses] Failed to notify ${user.email}:`, err.message);
                }
            }
            console.log(`[courses] Sent course update notifications to ${eligibleUsers.length} users`);
        });

    } catch (err) {
        console.error('[courses] Error sending notifications:', err.message);
    }
}

// GET /api/courses - Lấy danh sách khóa học
router.get('/', async (req, res, next) => {
    try {
        await connectToDatabase();
        const limit = Math.min(Number(req.query.limit) || 50, 100);
        const page = Math.max(Number(req.query.page) || 1, 1);
        const skip = (page - 1) * limit;

        const levelRaw = typeof req.query.level === 'string' ? req.query.level : undefined;
        const level = levelRaw && ALLOWED_LEVELS.has(levelRaw) ? levelRaw : undefined;
        const search = typeof req.query.search === 'string' ? req.query.search : undefined;
        const instructor = typeof req.query.instructor === 'string' ? req.query.instructor : undefined;
        const minPrice = req.query.minPrice !== undefined ? Number(req.query.minPrice) : undefined;
        const maxPrice = req.query.maxPrice !== undefined ? Number(req.query.maxPrice) : undefined;
        const isPublic = req.query.isPublic !== undefined ? req.query.isPublic === 'true' : undefined;
        const sortBy = typeof req.query.sortBy === 'string' ? req.query.sortBy : undefined;
        const sortOrderRaw = typeof req.query.sortOrder === 'string' ? req.query.sortOrder : undefined;

        // Base query - exclude deleted courses
        const query = { deletedAt: { $exists: false } };
        if (level) {
            query.level = level;
        }

        if (isPublic !== undefined) {
            query.isPublic = isPublic;
        }

        if (Number.isFinite(minPrice) || Number.isFinite(maxPrice)) {
            query.price = {};
            if (Number.isFinite(minPrice)) query.price.$gte = minPrice;
            if (Number.isFinite(maxPrice)) query.price.$lte = maxPrice;
        }

        if (instructor && instructor.trim()) {
            const safeInstructor = escapeRegExp(instructor.trim().slice(0, 100));
            query.instructor = { $regex: safeInstructor, $options: 'i' };
        }

        if (search && search.trim()) {
            const safeSearch = escapeRegExp(search.trim().slice(0, 200));
            query.$or = [
                { title: { $regex: safeSearch, $options: 'i' } },
                { instructor: { $regex: safeSearch, $options: 'i' } },
                { description: { $regex: safeSearch, $options: 'i' } },
                { code: { $regex: safeSearch, $options: 'i' } },
            ];
        }

        const sortOrder = sortOrderRaw === 'asc' ? 1 : -1;
        const sortField = sortBy && ALLOWED_SORT_FIELDS.has(sortBy) ? sortBy : 'createdAt';
        const sort = { [sortField]: sortOrder, _id: -1 };

        const collection = getCollection('courses');
        const total = await collection.countDocuments(query);

        const courses = await collection
            .find(query, courseFields)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .toArray();

        res.json({
            courses: courses.map(mapCourse),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/courses/enrolled - Lấy khóa học đã đăng ký của user (PROTECTED)
router.get('/enrolled', authGuard, async (req, res, next) => {
    try {
        await connectToDatabase();
        const userId = req.user.id;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(parseInt(req.query.limit) || 10, 50);
        const status = req.query.status || 'active'; // active, completed, all
        const skip = (page - 1) * limit;

        // Build query
        const enrollmentQuery = { userId: new ObjectId(userId) };
        if (status !== 'all') {
            enrollmentQuery.status = status;
        }

        // Get enrollments with pagination
        const enrollments = await getCollection('enrollments')
            .find(enrollmentQuery)
            .sort({ enrolledAt: -1 })
            .skip(skip)
            .limit(limit)
            .toArray();

        // Get total count
        const totalCount = await getCollection('enrollments')
            .countDocuments(enrollmentQuery);

        if (enrollments.length === 0) {
            return res.json({
                enrollments: [],
                pagination: {
                    page,
                    limit,
                    total: 0,
                    totalPages: 0
                }
            });
        }

        // Get course details
        const courseIds = enrollments
            .map(e => e.courseId)
            .filter(Boolean)
            .map(id => typeof id === 'string' ? new ObjectId(id) : id);

        const courses = await getCollection('courses')
            .find({ _id: { $in: courseIds } })
            .toArray();

        const courseMap = new Map(courses.map(c => [c._id.toString(), c]));

        // Map enrollments with course details
        const mappedEnrollments = enrollments.map(enrollment => {
            const courseId = enrollment.courseId?.toString();
            const course = courseMap.get(courseId);

            return {
                id: enrollment._id.toString(),
                courseId: courseId,
                userId: enrollment.userId.toString(),
                enrolledAt: enrollment.enrolledAt || enrollment.createdAt,
                status: enrollment.status || 'active',
                progress: enrollment.progress || 0,
                completedLessons: enrollment.completedLessons || [],
                lastAccessedAt: enrollment.lastAccessedAt,
                course: course ? {
                    id: course._id.toString(),
                    title: course.title,
                    instructor: course.instructor,
                    price: course.price,
                    rating: course.rating || 0,
                    reviewsCount: course.reviewsCount || 0,
                    level: course.level,
                    image: course.image,
                    description: course.description,
                    lessonsCount: course.lessons?.length || course.lessonsCount || 0,
                    duration: course.duration,
                    hoursPerWeek: course.hoursPerWeek,
                    startDate: course.startDate,
                    endDate: course.endDate,
                    contactInfo: course.contactInfo,
                    contactType: course.contactType
                } : null
            };
        });

        res.json({
            enrollments: mappedEnrollments,
            pagination: {
                page,
                limit,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limit)
            }
        });

    } catch (error) {
        next(error);
    }
});

// GET /api/courses/enrollment-status/:id - Kiểm tra trạng thái enrollment (PROTECTED)
router.get('/enrollment-status/:id', authGuard, async (req, res, next) => {
    try {
        await connectToDatabase();
        const courseId = req.params.id;
        const userId = req.user.id;

        if (!ObjectId.isValid(courseId)) {
            return res.status(400).json({ error: 'Invalid course id' });
        }

        const enrollment = await getCollection('enrollments').findOne({
            userId: new ObjectId(userId),
            courseId: new ObjectId(courseId)
        });

        if (enrollment) {
            res.json({
                enrolled: true,
                enrollmentId: enrollment._id.toString(),
                status: enrollment.status,
                enrolledAt: enrollment.enrolledAt,
                progress: enrollment.progress || 0
            });
        } else {
            res.json({
                enrolled: false
            });
        }
    } catch (error) {
        next(error);
    }
});

// POST /api/courses/enroll/:id - Đăng ký khóa học (PROTECTED)
router.post('/enroll/:id', authGuard, async (req, res, next) => {
    try {
        await connectToDatabase();
        const courseId = req.params.id;
        const userId = req.user.id;

        if (!ObjectId.isValid(courseId)) {
            return res.status(400).json({ error: 'Invalid course id' });
        }

        // Check if course exists
        const course = await getCollection('courses').findOne({ _id: new ObjectId(courseId) });
        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }

        // Check if already enrolled
        const existingEnrollment = await getCollection('enrollments').findOne({
            userId: new ObjectId(userId),
            courseId: new ObjectId(courseId)
        });

        if (existingEnrollment) {
            return res.status(400).json({ error: 'Already enrolled in this course' });
        }

        // Create enrollment
        const enrollment = {
            userId: new ObjectId(userId),
            courseId: new ObjectId(courseId),
            enrolledAt: new Date(),
            status: 'active',
            progress: 0,
            completedLessons: [],
            lastAccessedAt: new Date()
        };

        const result = await getCollection('enrollments').insertOne(enrollment);

        // Log to audit
        await getCollection('audit_logs').insertOne({
            action: 'course_enrollment',
            userId: new ObjectId(userId),
            targetId: new ObjectId(courseId),
            targetType: 'course',
            details: { courseTitle: course.title },
            createdAt: new Date(),
            ip: req.ip
        });

        res.status(201).json({
            message: 'Enrolled successfully',
            enrollmentId: result.insertedId.toString()
        });

    } catch (error) {
        next(error);
    }
});

// PATCH /api/courses/enrolled/:id/progress - Cập nhật tiến độ học (PROTECTED)
router.patch('/enrolled/:id/progress', authGuard, async (req, res, next) => {
    try {
        await connectToDatabase();
        const enrollmentId = req.params.id;
        const userId = req.user.id;
        const { progress, completedLessonId } = req.body;

        if (!ObjectId.isValid(enrollmentId)) {
            return res.status(400).json({ error: 'Invalid enrollment id' });
        }

        // Verify ownership
        const enrollment = await getCollection('enrollments').findOne({
            _id: new ObjectId(enrollmentId),
            userId: new ObjectId(userId)
        });

        if (!enrollment) {
            return res.status(404).json({ error: 'Enrollment not found' });
        }

        const updateData = {
            lastAccessedAt: new Date()
        };

        if (typeof progress === 'number') {
            updateData.progress = Math.min(100, Math.max(0, progress));
            if (updateData.progress === 100) {
                updateData.status = 'completed';
                updateData.completedAt = new Date();
            }
        }

        if (completedLessonId) {
            updateData.$addToSet = { completedLessons: completedLessonId };
        }

        const { $addToSet, ...setFields } = updateData;
        const updateOps = { $set: setFields };
        if ($addToSet) {
            updateOps.$addToSet = $addToSet;
        }

        await getCollection('enrollments').updateOne(
            { _id: new ObjectId(enrollmentId) },
            updateOps
        );

        res.json({ message: 'Progress updated' });

    } catch (error) {
        next(error);
    }
});

// DELETE /api/courses/enrolled/:id - Hủy đăng ký khóa học (PROTECTED)
router.delete('/enrolled/:id', authGuard, async (req, res, next) => {
    try {
        await connectToDatabase();
        const enrollmentId = req.params.id;
        const userId = req.user.id;

        if (!ObjectId.isValid(enrollmentId)) {
            return res.status(400).json({ error: 'Invalid enrollment id' });
        }

        // Verify ownership
        const enrollment = await getCollection('enrollments').findOne({
            _id: new ObjectId(enrollmentId),
            userId: new ObjectId(userId)
        });

        if (!enrollment) {
            return res.status(404).json({ error: 'Enrollment not found' });
        }

        // Soft delete - update status
        await getCollection('enrollments').updateOne(
            { _id: new ObjectId(enrollmentId) },
            { $set: { status: 'cancelled', cancelledAt: new Date() } }
        );

        // Log to audit
        await getCollection('audit_logs').insertOne({
            action: 'course_unenrollment',
            userId: new ObjectId(userId),
            targetId: enrollment.courseId,
            targetType: 'course',
            createdAt: new Date(),
            ip: req.ip
        });

        res.json({ message: 'Unenrolled successfully' });

    } catch (error) {
        next(error);
    }
});

// GET /api/courses/:id - Chi tiết khóa học
router.get('/:id', async (req, res, next) => {
    try {
        await connectToDatabase();
        const id = req.params.id;
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid course id' });
        }

        const course = await getCollection('courses').findOne({
            _id: new ObjectId(id),
            deletedAt: { $exists: false }
        }, courseFields);
        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }
        res.json({ course: mapCourse(course) });
    } catch (error) {
        next(error);
    }
});

// POST /api/courses - Tạo khóa học (admin only)
router.post('/', authGuard, requireRole('admin'), async (req, res, next) => {
    try {
        await connectToDatabase();
        const body = req.body || {};
        const required = ['title', 'instructor', 'price'];
        const missing = required.filter((field) => body[field] === undefined);
        if (missing.length) {
            return res.status(400).json({ error: `Missing fields: ${missing.join(', ')}` });
        }

        const payload = {
            code: body.code || `CR-${Date.now()}`,
            title: String(body.title),
            instructor: String(body.instructor),
            price: Number(body.price) || 0,
            rating: Number(body.rating) || 0,
            reviewsCount: Number(body.reviewsCount) || 0,
            level: body.level || 'Beginner',
            image: body.image || '',
            description: body.description || '',
            // Schedule fields
            duration: body.duration || '',
            hoursPerWeek: Number(body.hoursPerWeek) || 0,
            startDate: body.startDate || null,
            endDate: body.endDate || null,
            // Contact fields
            contactInfo: body.contactInfo || '',
            contactType: body.contactType || 'phone',
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: req.user?.id || null,
        };

        const result = await getCollection('courses').insertOne(payload);
        res.status(201).json({ id: result.insertedId.toString() });
    } catch (error) {
        next(error);
    }
});

// PATCH /api/courses/:id - Cập nhật khóa học (admin only)
router.patch('/:id', authGuard, requireRole('admin'), async (req, res, next) => {
    try {
        await connectToDatabase();
        const id = req.params.id;
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid course id' });
        }

        const updates = { ...req.body, updatedAt: new Date() };
        const allowed = ['title', 'instructor', 'price', 'rating', 'reviewsCount', 'level', 'image', 'description', 'duration', 'hoursPerWeek', 'startDate', 'endDate', 'contactInfo', 'contactType', 'isPublic', 'benefits', 'sections'];
        const set = {};
        allowed.forEach((key) => {
            if (updates[key] !== undefined) {
                set[key] = updates[key];
            }
        });

        const result = await getCollection('courses').updateOne(
            { _id: new ObjectId(id) },
            { $set: set }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Course not found' });
        }

        res.json({ updated: true });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/courses/:id - Xóa khóa học (admin only)
router.delete('/:id', authGuard, requireRole('admin'), async (req, res, next) => {
    try {
        await connectToDatabase();
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid course id' });
        }

        // Check if course exists
        const course = await getCollection('courses').findOne({ _id: new ObjectId(id) });
        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }

        // Check if there are active enrollments
        const activeEnrollments = await getCollection('enrollments').countDocuments({
            courseId: new ObjectId(id),
            status: { $nin: ['cancelled', 'completed'] }
        });

        if (activeEnrollments > 0) {
            return res.status(400).json({
                error: 'Cannot delete course with active enrollments',
                activeEnrollments
            });
        }

        // Soft delete - mark as deleted instead of removing
        const result = await getCollection('courses').updateOne(
            { _id: new ObjectId(id) },
            {
                $set: {
                    deletedAt: new Date(),
                    deletedBy: new ObjectId(req.user.id),
                    isActive: false
                }
            }
        );

        // Log to audit
        await getCollection('audit_logs').insertOne({
            action: 'course_deleted',
            userId: new ObjectId(req.user.id),
            targetId: new ObjectId(id),
            targetType: 'course',
            details: {
                courseTitle: course.title,
                courseCode: course.code
            },
            createdAt: new Date(),
            ip: req.ip
        });

        res.json({
            deleted: true,
            message: 'Course deleted successfully'
        });
    } catch (error) {
        next(error);
    }
});

function mapCourse(doc) {
    return {
        id: doc._id?.toString(),
        code: doc.code,
        title: doc.title,
        instructor: doc.instructor,
        price: doc.price,
        rating: doc.rating,
        reviewsCount: doc.reviewsCount,
        level: doc.level,
        image: doc.image,
        description: doc.description,
        duration: doc.duration,
        hoursPerWeek: doc.hoursPerWeek,
        startDate: doc.startDate,
        endDate: doc.endDate,
        contactInfo: doc.contactInfo,
        contactType: doc.contactType,
        lessonsCount: doc.lessons?.length || doc.lessonsCount || 0,
        isPublic: doc.isPublic ?? true,
        benefits: doc.benefits || [],
        sections: doc.sections || [],
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    };
}

// ============ LESSON MANAGEMENT ============

// POST /api/courses/:id/lessons - Thêm bài học mới (admin/instructor)
router.post('/:id/lessons', authGuard, async (req, res, next) => {
    try {
        await connectToDatabase();
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid course id' });
        }

        const course = await getCollection('courses').findOne({ _id: new ObjectId(id) });
        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }

        // Check permission (admin or course instructor)
        if (req.user.role !== 'admin' && course.createdBy !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const { title, content, videoUrl, duration, order } = req.body;

        if (!title) {
            return res.status(400).json({ error: 'Lesson title is required' });
        }

        const lesson = {
            _id: new ObjectId(),
            title: String(title),
            content: content || '',
            videoUrl: videoUrl || '',
            duration: Number(duration) || 0,
            order: Number(order) || 0,
            createdAt: new Date()
        };

        // Add lesson to course
        await getCollection('courses').updateOne(
            { _id: new ObjectId(id) },
            {
                $push: { lessons: lesson },
                $set: { updatedAt: new Date() }
            }
        );

        // Send notification to enrolled users
        sendCourseUpdateNotification(id, course.title, 'lesson', title);

        res.status(201).json({
            message: 'Lesson added',
            lessonId: lesson._id.toString()
        });

    } catch (error) {
        next(error);
    }
});

// POST /api/courses/:id/materials - Thêm tài liệu mới (admin/instructor)
router.post('/:id/materials', authGuard, async (req, res, next) => {
    try {
        await connectToDatabase();
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid course id' });
        }

        const course = await getCollection('courses').findOne({ _id: new ObjectId(id) });
        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }

        // Check permission
        if (req.user.role !== 'admin' && course.createdBy !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const { title, type, url, fileSize } = req.body;

        if (!title || !url) {
            return res.status(400).json({ error: 'Title and URL are required' });
        }

        const material = {
            _id: new ObjectId(),
            title: String(title),
            type: type || 'document', // document, video, pdf, etc.
            url: String(url),
            fileSize: Number(fileSize) || 0,
            createdAt: new Date()
        };

        await getCollection('courses').updateOne(
            { _id: new ObjectId(id) },
            {
                $push: { materials: material },
                $set: { updatedAt: new Date() }
            }
        );

        // Send notification
        sendCourseUpdateNotification(id, course.title, 'material', title);

        res.status(201).json({
            message: 'Material added',
            materialId: material._id.toString()
        });

    } catch (error) {
        next(error);
    }
});

// POST /api/courses/:id/notify - Gửi thông báo thủ công (admin only)
router.post('/:id/notify', authGuard, requireRole('admin'), async (req, res, next) => {
    try {
        await connectToDatabase();
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid course id' });
        }

        const course = await getCollection('courses').findOne({ _id: new ObjectId(id) });
        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }

        const { updateType, updateTitle } = req.body;

        if (!updateTitle) {
            return res.status(400).json({ error: 'Update title is required' });
        }

        // Send notification
        sendCourseUpdateNotification(id, course.title, updateType || 'announcement', updateTitle);

        res.json({ message: 'Notification triggered' });

    } catch (error) {
        next(error);
    }
});

export default router;

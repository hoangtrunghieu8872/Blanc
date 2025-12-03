import { Router } from 'express';
import { ObjectId } from 'mongodb';
import rateLimit from 'express-rate-limit';
import { connectToDatabase, getCollection } from '../lib/db.js';
import { authGuard } from '../middleware/auth.js';

const router = Router();

// ============ CONSTANTS ============
const MAX_COMMENT_LENGTH = 1000;
const MIN_COMMENT_LENGTH = 10;
const MAX_RATING = 5;
const MIN_RATING = 1;
const REVIEWS_PER_PAGE = 20;

// Rate limiting for reviews - prevent spam
const reviewLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 reviews per hour per IP
    message: { error: 'Bạn đã gửi quá nhiều đánh giá. Vui lòng thử lại sau.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const helpfulLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 helpful marks per minute
    message: { error: 'Vui lòng chậm lại.' },
});

// ============ VALIDATION HELPERS ============

/**
 * Sanitize string input
 */
function sanitizeString(str, maxLength = 1000) {
    if (!str || typeof str !== 'string') return '';
    return str
        .trim()
        .slice(0, maxLength)
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // Remove control chars
}

/**
 * Validate target type
 */
function isValidTargetType(type) {
    return ['contest', 'course', 'document'].includes(type);
}

/**
 * Validate rating
 */
function isValidRating(rating) {
    const num = Number(rating);
    return Number.isInteger(num) && num >= MIN_RATING && num <= MAX_RATING;
}

/**
 * Validate target ID - support both ObjectId and custom string IDs
 */
function isValidTargetId(id) {
    if (!id || typeof id !== 'string') return false;
    // Allow ObjectId format or alphanumeric string IDs (with optional prefix like co_, doc_)
    return ObjectId.isValid(id) || /^[a-zA-Z0-9_-]{1,50}$/.test(id);
}

/**
 * Get collection name for target type
 */
function getTargetCollection(targetType) {
    const collections = {
        contest: 'contests',
        course: 'courses',
        document: 'documents'
    };
    return collections[targetType];
}

/**
 * Check if user is eligible to review
 * - For contests: must be registered
 * - For courses: must be enrolled
 * - For documents: must be authenticated
 */
async function checkReviewEligibility(userId, targetId, targetType) {
    if (targetType === 'contest') {
        const registrations = getCollection('registrations');
        const registration = await registrations.findOne({
            userId: userId,
            contestId: targetId
        });
        return !!registration;
    }

    if (targetType === 'course') {
        const enrollments = getCollection('enrollments');
        const enrollment = await enrollments.findOne({
            userId: new ObjectId(userId),
            courseId: new ObjectId(targetId)
        });
        return !!enrollment;
    }

    // Documents: any authenticated user can review
    return true;
}

// ============ ROUTES ============

/**
 * GET /api/reviews/:targetType/:targetId
 * Get all reviews for a target (contest/course/document)
 * Public endpoint with optional auth for user-specific data
 */
router.get('/:targetType/:targetId', async (req, res, next) => {
    try {
        await connectToDatabase();

        const { targetType, targetId } = req.params;
        const { page = 1, limit = REVIEWS_PER_PAGE, sort = 'recent' } = req.query;

        // Validate target type
        if (!isValidTargetType(targetType)) {
            return res.status(400).json({ error: 'Loại đối tượng không hợp lệ' });
        }

        // Validate target ID
        if (!isValidTargetId(targetId)) {
            return res.status(400).json({ error: 'ID không hợp lệ' });
        }

        const reviews = getCollection('reviews');

        // Build query
        const query = {
            targetId,
            targetType,
            deletedAt: { $exists: false }
        };

        // Sort options
        const sortOptions = {
            recent: { createdAt: -1 },
            helpful: { helpfulCount: -1, createdAt: -1 },
            rating_high: { rating: -1, createdAt: -1 },
            rating_low: { rating: 1, createdAt: -1 }
        };
        const sortBy = sortOptions[sort] || sortOptions.recent;

        // Pagination
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
        const skip = (pageNum - 1) * limitNum;

        // Fetch reviews
        const [reviewsList, totalCount] = await Promise.all([
            reviews
                .find(query)
                .sort(sortBy)
                .skip(skip)
                .limit(limitNum)
                .toArray(),
            reviews.countDocuments(query)
        ]);

        // Calculate stats
        const statsAggregation = await reviews.aggregate([
            { $match: query },
            {
                $group: {
                    _id: null,
                    averageRating: { $avg: '$rating' },
                    totalReviews: { $sum: 1 },
                    rating1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
                    rating2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
                    rating3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
                    rating4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
                    rating5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } }
                }
            }
        ]).toArray();

        const statsResult = statsAggregation[0] || {
            averageRating: 0,
            totalReviews: 0,
            rating1: 0,
            rating2: 0,
            rating3: 0,
            rating4: 0,
            rating5: 0
        };

        // Check if current user has reviewed (if authenticated)
        let hasUserReviewed = false;
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const jwt = await import('jsonwebtoken');
                const token = authHeader.slice(7);
                const decoded = jwt.default.verify(token, process.env.JWT_SECRET);
                const userId = decoded.id;

                const userReview = await reviews.findOne({
                    targetId,
                    targetType,
                    userId,
                    deletedAt: { $exists: false }
                });
                hasUserReviewed = !!userReview;
            } catch (e) {
                // Invalid token, ignore
            }
        }

        // Transform reviews
        const transformedReviews = reviewsList.map(r => ({
            id: r._id.toString(),
            targetId: r.targetId,
            targetType: r.targetType,
            userId: r.userId,
            userName: r.userName,
            userAvatar: r.userAvatar || null,
            rating: r.rating,
            comment: r.comment,
            isVerified: r.isVerified || false,
            helpfulCount: r.helpfulCount || 0,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt
        }));

        res.json({
            reviews: transformedReviews,
            stats: {
                averageRating: Math.round((statsResult.averageRating || 0) * 10) / 10,
                totalReviews: statsResult.totalReviews,
                ratingDistribution: {
                    1: statsResult.rating1,
                    2: statsResult.rating2,
                    3: statsResult.rating3,
                    4: statsResult.rating4,
                    5: statsResult.rating5
                }
            },
            hasUserReviewed,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limitNum)
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/reviews/:targetType/:targetId
 * Create a new review (requires auth)
 */
router.post('/:targetType/:targetId', authGuard, reviewLimiter, async (req, res, next) => {
    try {
        await connectToDatabase();

        const { targetType, targetId } = req.params;
        const { rating, comment } = req.body;
        const userId = req.user.id;

        // Validate target type
        if (!isValidTargetType(targetType)) {
            return res.status(400).json({ error: 'Loại đối tượng không hợp lệ' });
        }

        // Validate target ID
        if (!isValidTargetId(targetId)) {
            return res.status(400).json({ error: 'ID không hợp lệ' });
        }

        // Validate rating
        if (!isValidRating(rating)) {
            return res.status(400).json({ error: `Đánh giá phải từ ${MIN_RATING} đến ${MAX_RATING} sao` });
        }

        // Validate comment
        const sanitizedComment = sanitizeString(comment, MAX_COMMENT_LENGTH);
        if (sanitizedComment.length < MIN_COMMENT_LENGTH) {
            return res.status(400).json({ error: `Nhận xét phải có ít nhất ${MIN_COMMENT_LENGTH} ký tự` });
        }

        // Check if target exists - support both ObjectId and string ID
        const targetCollection = getCollection(getTargetCollection(targetType));
        const targetQuery = ObjectId.isValid(targetId) 
            ? { $or: [{ _id: new ObjectId(targetId) }, { _id: targetId }] }
            : { _id: targetId };
        const target = await targetCollection.findOne(targetQuery);
        if (!target) {
            return res.status(404).json({ error: 'Không tìm thấy đối tượng để đánh giá' });
        }

        // Check eligibility
        const isEligible = await checkReviewEligibility(userId, targetId, targetType);
        if (!isEligible) {
            const messages = {
                contest: 'Bạn cần đăng ký cuộc thi trước khi đánh giá',
                course: 'Bạn cần đăng ký khóa học trước khi đánh giá',
                document: 'Bạn cần đăng nhập để đánh giá'
            };
            return res.status(403).json({ error: messages[targetType] });
        }

        // Check if user already reviewed
        const reviews = getCollection('reviews');
        const existingReview = await reviews.findOne({
            targetId,
            targetType,
            userId,
            deletedAt: { $exists: false }
        });

        if (existingReview) {
            return res.status(409).json({ error: 'Bạn đã đánh giá đối tượng này rồi' });
        }

        // Get user info
        const users = getCollection('users');
        const user = await users.findOne(
            { _id: new ObjectId(userId) },
            { projection: { name: 1, avatar: 1 } }
        );

        if (!user) {
            return res.status(404).json({ error: 'Không tìm thấy người dùng' });
        }

        // Create review
        const now = new Date();
        const newReview = {
            targetId,
            targetType,
            userId,
            userName: user.name,
            userAvatar: user.avatar || null,
            rating: Number(rating),
            comment: sanitizedComment,
            isVerified: isEligible, // Verified if eligible (registered/enrolled)
            helpfulCount: 0,
            helpfulBy: [],
            createdAt: now,
            updatedAt: now
        };

        const result = await reviews.insertOne(newReview);

        // Update target's rating stats
        await updateTargetRating(targetId, targetType);

        // Log activity
        const auditLogs = getCollection('audit_logs');
        await auditLogs.insertOne({
            action: 'review_created',
            userId: new ObjectId(userId),
            resourceType: targetType,
            resourceId: new ObjectId(targetId),
            details: { rating, commentLength: sanitizedComment.length },
            createdAt: now,
            ip: req.ip
        });

        res.status(201).json({
            message: 'Đánh giá đã được gửi thành công',
            review: {
                id: result.insertedId.toString(),
                ...newReview,
                _id: undefined
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * PUT /api/reviews/:reviewId
 * Update a review (owner only)
 */
router.put('/:reviewId', authGuard, async (req, res, next) => {
    try {
        await connectToDatabase();

        const { reviewId } = req.params;
        const { rating, comment } = req.body;
        const userId = req.user.id;

        if (!ObjectId.isValid(reviewId)) {
            return res.status(400).json({ error: 'ID đánh giá không hợp lệ' });
        }

        const reviews = getCollection('reviews');
        const review = await reviews.findOne({ _id: new ObjectId(reviewId) });

        if (!review) {
            return res.status(404).json({ error: 'Không tìm thấy đánh giá' });
        }

        // Check ownership
        if (review.userId !== userId) {
            return res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa đánh giá này' });
        }

        // Build update
        const updateData = { updatedAt: new Date() };

        if (rating !== undefined) {
            if (!isValidRating(rating)) {
                return res.status(400).json({ error: `Đánh giá phải từ ${MIN_RATING} đến ${MAX_RATING} sao` });
            }
            updateData.rating = Number(rating);
        }

        if (comment !== undefined) {
            const sanitizedComment = sanitizeString(comment, MAX_COMMENT_LENGTH);
            if (sanitizedComment.length < MIN_COMMENT_LENGTH) {
                return res.status(400).json({ error: `Nhận xét phải có ít nhất ${MIN_COMMENT_LENGTH} ký tự` });
            }
            updateData.comment = sanitizedComment;
        }

        await reviews.updateOne(
            { _id: new ObjectId(reviewId) },
            { $set: updateData }
        );

        // Update target's rating stats if rating changed
        if (updateData.rating !== undefined) {
            await updateTargetRating(review.targetId, review.targetType);
        }

        res.json({ message: 'Đánh giá đã được cập nhật' });
    } catch (error) {
        next(error);
    }
});

/**
 * DELETE /api/reviews/:reviewId
 * Delete a review (owner or admin)
 */
router.delete('/:reviewId', authGuard, async (req, res, next) => {
    try {
        await connectToDatabase();

        const { reviewId } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role;

        if (!ObjectId.isValid(reviewId)) {
            return res.status(400).json({ error: 'ID đánh giá không hợp lệ' });
        }

        const reviews = getCollection('reviews');
        const review = await reviews.findOne({ _id: new ObjectId(reviewId) });

        if (!review) {
            return res.status(404).json({ error: 'Không tìm thấy đánh giá' });
        }

        // Check ownership or admin
        if (review.userId !== userId && userRole !== 'admin') {
            return res.status(403).json({ error: 'Bạn không có quyền xóa đánh giá này' });
        }

        // Soft delete
        await reviews.updateOne(
            { _id: new ObjectId(reviewId) },
            { $set: { deletedAt: new Date(), deletedBy: userId } }
        );

        // Update target's rating stats
        await updateTargetRating(review.targetId, review.targetType);

        // Log activity
        const auditLogs = getCollection('audit_logs');
        await auditLogs.insertOne({
            action: 'review_deleted',
            userId: new ObjectId(userId),
            resourceType: 'review',
            resourceId: new ObjectId(reviewId),
            details: { deletedBy: userRole === 'admin' ? 'admin' : 'owner' },
            createdAt: new Date(),
            ip: req.ip
        });

        res.json({ message: 'Đánh giá đã được xóa' });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/reviews/:reviewId/helpful
 * Mark a review as helpful
 */
router.post('/:reviewId/helpful', authGuard, helpfulLimiter, async (req, res, next) => {
    try {
        await connectToDatabase();

        const { reviewId } = req.params;
        const userId = req.user.id;

        if (!ObjectId.isValid(reviewId)) {
            return res.status(400).json({ error: 'ID đánh giá không hợp lệ' });
        }

        const reviews = getCollection('reviews');
        const review = await reviews.findOne({ _id: new ObjectId(reviewId) });

        if (!review) {
            return res.status(404).json({ error: 'Không tìm thấy đánh giá' });
        }

        // Check if user already marked as helpful
        if (review.helpfulBy && review.helpfulBy.includes(userId)) {
            return res.status(409).json({ error: 'Bạn đã đánh dấu hữu ích rồi' });
        }

        // Cannot mark own review as helpful
        if (review.userId === userId) {
            return res.status(400).json({ error: 'Không thể tự đánh dấu đánh giá của mình' });
        }

        // Update review
        await reviews.updateOne(
            { _id: new ObjectId(reviewId) },
            {
                $inc: { helpfulCount: 1 },
                $push: { helpfulBy: userId }
            }
        );

        res.json({
            message: 'Đã đánh dấu hữu ích',
            helpfulCount: (review.helpfulCount || 0) + 1
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/reviews/user/:userId
 * Get all reviews by a user (for profile page)
 */
router.get('/user/:userId', async (req, res, next) => {
    try {
        await connectToDatabase();

        const { userId } = req.params;
        const { page = 1, limit = 10 } = req.query;

        if (!ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'ID người dùng không hợp lệ' });
        }

        const reviews = getCollection('reviews');

        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
        const skip = (pageNum - 1) * limitNum;

        const [userReviews, total] = await Promise.all([
            reviews
                .find({ userId, deletedAt: { $exists: false } })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .toArray(),
            reviews.countDocuments({ userId, deletedAt: { $exists: false } })
        ]);

        res.json({
            reviews: userReviews.map(r => ({
                id: r._id.toString(),
                targetId: r.targetId,
                targetType: r.targetType,
                rating: r.rating,
                comment: r.comment,
                helpfulCount: r.helpfulCount || 0,
                createdAt: r.createdAt
            })),
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum)
            }
        });
    } catch (error) {
        next(error);
    }
});

// ============ HELPER FUNCTIONS ============

/**
 * Update target's average rating
 */
async function updateTargetRating(targetId, targetType) {
    try {
        const reviews = getCollection('reviews');
        const targetCollection = getCollection(getTargetCollection(targetType));

        const stats = await reviews.aggregate([
            {
                $match: {
                    targetId,
                    targetType,
                    deletedAt: { $exists: false }
                }
            },
            {
                $group: {
                    _id: null,
                    averageRating: { $avg: '$rating' },
                    reviewsCount: { $sum: 1 }
                }
            }
        ]).toArray();

        const result = stats[0] || { averageRating: 0, reviewsCount: 0 };

        await targetCollection.updateOne(
            { _id: new ObjectId(targetId) },
            {
                $set: {
                    rating: Math.round(result.averageRating * 10) / 10,
                    reviewsCount: result.reviewsCount,
                    updatedAt: new Date()
                }
            }
        );
    } catch (error) {
        console.error('Failed to update target rating:', error);
    }
}

export default router;

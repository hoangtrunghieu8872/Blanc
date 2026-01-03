import { Router } from 'express';
import crypto from 'crypto';
import { ObjectId } from 'mongodb';
import { connectToDatabase, getCollection } from '../lib/db.js';
import { authGuard } from '../middleware/auth.js';

const router = Router();

// ============ CONSTANTS ============
const ROLES_ALLOWED = [
    'Frontend Dev',
    'Backend Dev',
    'Fullstack Dev',
    'Mobile Dev',
    'UI/UX Designer',
    'Graphic Designer',
    'Business Analyst',
    'Product Manager',
    'Data Analyst',
    'DevOps',
    'QA/Tester',
    'Pitching',
    'Content Writer',
    'Marketing',
    'Other'
];

const MAX_TITLE_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 1000;
const MAX_REQUIREMENTS_LENGTH = 500;
const MAX_ROLES_COUNT = 5;
const MAX_MEMBERS = 10;
const MIN_MEMBERS = 2;
const MAX_POSTS_PER_USER = 5; // Active posts per user
const POST_EXPIRY_DAYS = 30;

// ============ NOTIFICATION HELPERS ============

/**
 * Generate HMAC signature for notification requests
 */
function generateSignature(action, secretKey, email = null) {
    const timestamp = Date.now();
    const nonce = crypto.randomUUID();

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
 * Send email notification via App Script
 */
async function sendEmailNotification(payload) {
    const notificationUrl = process.env.NOTIFICATION_EMAIL_URL;
    const secretKey = process.env.OTP_SECRET_KEY;

    if (!notificationUrl || !secretKey) {
        console.warn('Email notification not configured');
        return null;
    }

    try {
        const sigData = generateSignature(payload.action, secretKey, payload.email || null);

        const response = await fetch(notificationUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, ...sigData })
        });

        return await response.json();
    } catch (error) {
        console.error('Failed to send email notification:', error);
        return null;
    }
}

/**
 * Create in-app notification
 */
async function createNotification(userId, type, title, message, data = {}) {
    try {
        const notifications = getCollection('notifications');
        await notifications.insertOne({
            userId: new ObjectId(userId),
            type,
            title,
            message,
            data,
            read: false,
            createdAt: new Date()
        });
        return true;
    } catch (error) {
        console.error('Failed to create notification:', error);
        return false;
    }
}

/**
 * Send join request notifications to team owner and members
 */
async function sendJoinRequestNotifications(post, requester, requestMessage) {
    const users = getCollection('users');

    // Get team owner info with email
    const owner = await users.findOne(
        { _id: post.createdBy.id },
        { projection: { email: 1, name: 1, notifications: 1 } }
    );

    if (!owner) return;

    const notificationTitle = `Yêu cầu tham gia nhóm`;
    const notificationMessage = `${requester.name} muốn tham gia nhóm "${post.title}"`;
    const notificationData = {
        teamPostId: post._id.toString(),
        teamTitle: post.title,
        requesterId: requester._id.toString(),
        requesterName: requester.name,
        message: requestMessage
    };

    // 1. Create in-app notification for team owner
    await createNotification(
        owner._id.toString(),
        'team_join_request',
        notificationTitle,
        notificationMessage,
        notificationData
    );

    // 2. Send email to team owner if enabled
    const ownerPrefs = owner.notifications || {};
    if (ownerPrefs.email !== false && owner.email) {
        await sendEmailNotification({
            action: 'team_join_request',
            email: owner.email,
            recipientName: owner.name,
            requesterName: requester.name,
            teamTitle: post.title,
            message: requestMessage || 'Không có lời nhắn',
            teamPostUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/community?post=${post._id.toString()}`
        });
    }

    // 3. Optionally notify other team members (only in-app, not email)
    for (const member of post.members) {
        // Skip the owner (already notified) and the requester
        if (member.id.toString() === post.createdBy.id.toString()) continue;
        if (member.id.toString() === requester._id.toString()) continue;

        await createNotification(
            member.id.toString(),
            'team_join_request',
            notificationTitle,
            `${requester.name} muốn tham gia nhóm của bạn`,
            notificationData
        );
    }
}

// ============ VALIDATION HELPERS ============

function sanitizeString(str, maxLength = 255) {
    if (!str || typeof str !== 'string') return '';
    return str
        .trim()
        .slice(0, maxLength)
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/[<>]/g, ''); // Remove remaining angle brackets
}

function validateTeamPost(data) {
    const errors = [];

    // Title validation
    if (!data.title || typeof data.title !== 'string') {
        errors.push('Tiêu đề là bắt buộc');
    } else if (data.title.trim().length < 10) {
        errors.push('Tiêu đề phải có ít nhất 10 ký tự');
    } else if (data.title.length > MAX_TITLE_LENGTH) {
        errors.push(`Tiêu đề không được vượt quá ${MAX_TITLE_LENGTH} ký tự`);
    }

    // Description validation
    if (!data.description || typeof data.description !== 'string') {
        errors.push('Mô tả là bắt buộc');
    } else if (data.description.trim().length < 30) {
        errors.push('Mô tả phải có ít nhất 30 ký tự');
    } else if (data.description.length > MAX_DESCRIPTION_LENGTH) {
        errors.push(`Mô tả không được vượt quá ${MAX_DESCRIPTION_LENGTH} ký tự`);
    }

    // Roles needed validation
    if (!data.rolesNeeded || !Array.isArray(data.rolesNeeded)) {
        errors.push('Cần chọn ít nhất một vai trò cần tìm');
    } else {
        if (data.rolesNeeded.length === 0) {
            errors.push('Cần chọn ít nhất một vai trò');
        }
        if (data.rolesNeeded.length > MAX_ROLES_COUNT) {
            errors.push(`Chỉ được chọn tối đa ${MAX_ROLES_COUNT} vai trò`);
        }
        const invalidRoles = data.rolesNeeded.filter(r => !ROLES_ALLOWED.includes(r));
        if (invalidRoles.length > 0) {
            errors.push(`Vai trò không hợp lệ: ${invalidRoles.join(', ')}`);
        }
    }

    // Max members validation
    const maxMembers = parseInt(data.maxMembers, 10);
    if (isNaN(maxMembers) || maxMembers < MIN_MEMBERS || maxMembers > MAX_MEMBERS) {
        errors.push(`Số thành viên phải từ ${MIN_MEMBERS} đến ${MAX_MEMBERS}`);
    }

    // Contact method validation
    const validContactMethods = ['message', 'email', 'both'];
    if (!validContactMethods.includes(data.contactMethod)) {
        errors.push('Phương thức liên hệ không hợp lệ');
    }

    // Requirements validation (optional)
    if (data.requirements && data.requirements.length > MAX_REQUIREMENTS_LENGTH) {
        errors.push(`Yêu cầu không được vượt quá ${MAX_REQUIREMENTS_LENGTH} ký tự`);
    }

    // Expires at validation (optional)
    if (data.expiresAt) {
        const expiresDate = new Date(data.expiresAt);
        const now = new Date();
        const maxExpiry = new Date();
        maxExpiry.setDate(maxExpiry.getDate() + POST_EXPIRY_DAYS);

        if (isNaN(expiresDate.getTime())) {
            errors.push('Ngày hết hạn không hợp lệ');
        } else if (expiresDate <= now) {
            errors.push('Ngày hết hạn phải sau ngày hiện tại');
        } else if (expiresDate > maxExpiry) {
            errors.push(`Ngày hết hạn không được quá ${POST_EXPIRY_DAYS} ngày`);
        }
    }

    return errors;
}

// ============ ROUTES ============

/**
 * GET /api/teams
 * List team posts with pagination and filters
 */
router.get('/', async (req, res, next) => {
    try {
        await connectToDatabase();

        const {
            page = 1,
            limit = 12,
            role,
            contestId,
            status = 'open',
            search,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));
        const skip = (pageNum - 1) * limitNum;

        // Build query
        const query = {};

        // Status filter (default: open)
        if (status && ['open', 'closed', 'full'].includes(status)) {
            query.status = status;
        }

        // Always hide soft-deleted posts from the public listing.
        query.deletedAt = { $exists: false };

        // Role filter
        if (role && ROLES_ALLOWED.includes(role)) {
            query.rolesNeeded = role;
        }

        // Contest filter
        if (contestId && ObjectId.isValid(contestId)) {
            query.contestId = new ObjectId(contestId);
        }

        // Search filter
        if (search && typeof search === 'string' && search.trim()) {
            const searchTerm = sanitizeString(search, 100);
            query.$or = [
                { title: { $regex: searchTerm, $options: 'i' } },
                { description: { $regex: searchTerm, $options: 'i' } },
                { contestTitle: { $regex: searchTerm, $options: 'i' } }
            ];
        }

        // Exclude expired posts
        query.$or = query.$or || [];
        query.$and = [
            {
                $or: [
                    { expiresAt: { $exists: false } },
                    { expiresAt: null },
                    { expiresAt: { $gt: new Date() } }
                ]
            }
        ];

        if (query.$or.length === 0) delete query.$or;

        // Sort options
        const allowedSortFields = ['createdAt', 'updatedAt', 'maxMembers'];
        const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
        const sortDirection = sortOrder === 'asc' ? 1 : -1;

        const teamPosts = getCollection('team_posts');

        const [posts, total] = await Promise.all([
            teamPosts
                .find(query)
                .sort({ [sortField]: sortDirection })
                .skip(skip)
                .limit(limitNum)
                .toArray(),
            teamPosts.countDocuments(query)
        ]);

        // Transform _id to id and ensure all IDs are strings
        const transformedPosts = posts.map(post => ({
            ...post,
            id: post._id.toString(),
            _id: undefined,
            contestId: post.contestId?.toString(),
            createdBy: post.createdBy ? {
                id: post.createdBy.id?.toString() || post.createdBy.toString(),
                name: post.createdBy.name || 'Unknown',
                avatar: post.createdBy.avatar || '',
                email: post.createdBy.email || ''
            } : { id: '', name: 'Unknown', avatar: '', email: '' },
            members: post.members?.map(member => ({
                ...member,
                id: member.id?.toString() || ''
            })) || []
        }));

        res.json({
            posts: transformedPosts,
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

/**
 * PATCH /api/teams/:id/status
 * Toggle team post status (owner only)
 */
router.patch('/:id/status', authGuard, async (req, res, next) => {
    try {
        await connectToDatabase();

        const { id } = req.params;
        const { status } = req.body;
        const userId = req.user.id;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'ID không hợp lệ' });
        }

        if (!['open', 'closed'].includes(status)) {
            return res.status(400).json({ error: 'Trạng thái không hợp lệ. Chỉ chấp nhận: open, closed' });
        }

        const teamPosts = getCollection('team_posts');
        const post = await teamPosts.findOne({ _id: new ObjectId(id) });

        // Hide soft-deleted or expired posts from the public detail endpoint.
        if (post && (post.deletedAt || (post.expiresAt && new Date(post.expiresAt).getTime() <= Date.now()))) {
            return res.status(404).json({ error: 'Not Found' });
        }

        // Hide soft-deleted posts from the public endpoint.
        if (post && post.deletedAt) {
            return res.status(404).json({ error: 'Not Found' });
        }

        if (!post) {
            return res.status(404).json({ error: 'Không tìm thấy bài đăng' });
        }

        // Check ownership
        if (post.createdBy.id.toString() !== userId) {
            return res.status(403).json({ error: 'Bạn không có quyền thay đổi trạng thái bài đăng này' });
        }

        // Check if post is soft-deleted
        if (post.deletedAt) {
            return res.status(400).json({ error: 'Không thể thay đổi trạng thái bài đăng đã xóa' });
        }

        await teamPosts.updateOne(
            { _id: new ObjectId(id) },
            { $set: { status, updatedAt: new Date() } }
        );

        // Log activity
        const auditLogs = getCollection('audit_logs');
        await auditLogs.insertOne({
            action: 'team_post_status_changed',
            userId: new ObjectId(userId),
            resourceType: 'team_post',
            resourceId: new ObjectId(id),
            details: { title: post.title, oldStatus: post.status, newStatus: status },
            createdAt: new Date()
        });

        res.json({ message: 'Cập nhật trạng thái thành công', status });
    } catch (error) {
        next(error);
    }
});

/**
 * DELETE /api/teams/:id/soft
 * Soft delete team post (owner only)
 */
router.delete('/:id/soft', authGuard, async (req, res, next) => {
    try {
        await connectToDatabase();

        const { id } = req.params;
        const userId = req.user.id;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'ID không hợp lệ' });
        }

        const teamPosts = getCollection('team_posts');
        const post = await teamPosts.findOne({ _id: new ObjectId(id) });

        if (!post) {
            return res.status(404).json({ error: 'Không tìm thấy bài đăng' });
        }

        // Check ownership
        if (post.createdBy.id.toString() !== userId) {
            return res.status(403).json({ error: 'Bạn không có quyền xóa bài đăng này' });
        }

        // Check if already deleted
        if (post.deletedAt) {
            return res.status(400).json({ error: 'Bài đăng đã được xóa trước đó' });
        }

        await teamPosts.updateOne(
            { _id: new ObjectId(id) },
            { $set: { deletedAt: new Date(), status: 'closed', updatedAt: new Date() } }
        );

        // Log activity
        const auditLogs = getCollection('audit_logs');
        await auditLogs.insertOne({
            action: 'team_post_soft_deleted',
            userId: new ObjectId(userId),
            resourceType: 'team_post',
            resourceId: new ObjectId(id),
            details: { title: post.title },
            createdAt: new Date()
        });

        res.json({ message: 'Xóa bài đăng thành công' });
    } catch (error) {
        next(error);
    }
});

/**
 * PATCH /api/teams/:id/restore
 * Restore soft-deleted team post (owner only)
 */
router.patch('/:id/restore', authGuard, async (req, res, next) => {
    try {
        await connectToDatabase();

        const { id } = req.params;
        const userId = req.user.id;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'ID không hợp lệ' });
        }

        const teamPosts = getCollection('team_posts');
        const post = await teamPosts.findOne({ _id: new ObjectId(id) });

        if (!post) {
            return res.status(404).json({ error: 'Không tìm thấy bài đăng' });
        }

        // Check ownership
        if (post.createdBy.id.toString() !== userId) {
            return res.status(403).json({ error: 'Bạn không có quyền khôi phục bài đăng này' });
        }

        // Check if not deleted
        if (!post.deletedAt) {
            return res.status(400).json({ error: 'Bài đăng chưa bị xóa' });
        }

        await teamPosts.updateOne(
            { _id: new ObjectId(id) },
            { $unset: { deletedAt: '' }, $set: { status: 'closed', updatedAt: new Date() } }
        );

        // Log activity
        const auditLogs = getCollection('audit_logs');
        await auditLogs.insertOne({
            action: 'team_post_restored',
            userId: new ObjectId(userId),
            resourceType: 'team_post',
            resourceId: new ObjectId(id),
            details: { title: post.title },
            createdAt: new Date()
        });

        res.json({ message: 'Khôi phục bài đăng thành công' });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/teams/:id
 * Get single team post details
 */
router.get('/:id', async (req, res, next) => {
    try {
        await connectToDatabase();

        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'ID không hợp lệ' });
        }

        const teamPosts = getCollection('team_posts');
        const post = await teamPosts.findOne({ _id: new ObjectId(id) });

        if (!post) {
            return res.status(404).json({ error: 'Không tìm thấy bài đăng' });
        }

        res.json({
            ...post,
            id: post._id.toString(),
            _id: undefined,
            contestId: post.contestId?.toString(),
            createdBy: {
                ...post.createdBy,
                id: post.createdBy.id.toString()
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/teams
 * Create new team post (requires auth)
 */
router.post('/', authGuard, async (req, res, next) => {
    try {
        await connectToDatabase();

        const userId = req.user.id;
        const teamPosts = getCollection('team_posts');
        const users = getCollection('users');

        // Check user's active posts limit
        const activePostsCount = await teamPosts.countDocuments({
            'createdBy.id': new ObjectId(userId),
            status: 'open',
            $or: [
                { expiresAt: { $exists: false } },
                { expiresAt: null },
                { expiresAt: { $gt: new Date() } }
            ]
        });

        if (activePostsCount >= MAX_POSTS_PER_USER) {
            return res.status(429).json({
                error: `Bạn chỉ được tạo tối đa ${MAX_POSTS_PER_USER} bài đăng đang hoạt động`
            });
        }

        // Validate input
        const validationErrors = validateTeamPost(req.body);
        if (validationErrors.length > 0) {
            return res.status(400).json({ error: validationErrors.join('. ') });
        }

        // Get user info
        const user = await users.findOne(
            { _id: new ObjectId(userId) },
            { projection: { name: 1, avatar: 1, email: 1 } }
        );

        if (!user) {
            return res.status(404).json({ error: 'Không tìm thấy người dùng' });
        }

        // Get contest info if provided
        let contestInfo = null;
        if (req.body.contestId && ObjectId.isValid(req.body.contestId)) {
            const contests = getCollection('contests');
            const contest = await contests.findOne(
                { _id: new ObjectId(req.body.contestId) },
                { projection: { title: 1 } }
            );
            if (contest) {
                contestInfo = {
                    id: contest._id,
                    title: contest.title
                };
            }
        }

        // Prepare document
        const now = new Date();
        const defaultExpiry = new Date();
        defaultExpiry.setDate(defaultExpiry.getDate() + POST_EXPIRY_DAYS);

        // Process roleSlots if provided
        let roleSlots = null;
        if (req.body.roleSlots && Array.isArray(req.body.roleSlots)) {
            roleSlots = req.body.roleSlots
                .filter(slot => ROLES_ALLOWED.includes(slot.role))
                .map(slot => ({
                    role: slot.role,
                    count: Math.min(5, Math.max(1, parseInt(slot.count, 10) || 1)),
                    description: slot.description ? sanitizeString(slot.description, 300) : null,
                    skills: Array.isArray(slot.skills) ? slot.skills.slice(0, 5) : []
                }));
        }

        // Process skills if provided
        let skills = null;
        if (req.body.skills && Array.isArray(req.body.skills)) {
            skills = req.body.skills.slice(0, 10).map(s => sanitizeString(s, 50));
        }

        // Process deadline if provided
        let deadline = null;
        if (req.body.deadline) {
            const deadlineDate = new Date(req.body.deadline);
            if (!isNaN(deadlineDate.getTime()) && deadlineDate > now) {
                deadline = deadlineDate;
            }
        }

        // Process invitedMembers if provided
        let invitedMembers = [];
        if (req.body.invitedMembers && Array.isArray(req.body.invitedMembers)) {
            // Validate and sanitize invited members
            const validInvites = req.body.invitedMembers
                .filter(m => m.id && ObjectId.isValid(m.id) && m.id !== userId)
                .slice(0, 10); // Limit to 10 invites

            // Verify invited users exist
            if (validInvites.length > 0) {
                const inviteIds = validInvites.map(m => new ObjectId(m.id));
                const invitedUsers = await users.find(
                    { _id: { $in: inviteIds } },
                    { projection: { _id: 1, name: 1, email: 1, avatar: 1 } }
                ).toArray();

                invitedMembers = invitedUsers.map(u => ({
                    id: u._id,
                    name: u.name,
                    email: u.email,
                    avatar: u.avatar || null,
                    invitedAt: now
                }));
            }
        }

        const newPost = {
            title: sanitizeString(req.body.title, MAX_TITLE_LENGTH),
            description: sanitizeString(req.body.description, MAX_DESCRIPTION_LENGTH),
            contestId: contestInfo?.id || null,
            contestTitle: contestInfo?.title || null,
            rolesNeeded: req.body.rolesNeeded.filter(r => ROLES_ALLOWED.includes(r)),
            roleSlots,
            currentMembers: 1, // Creator is first member
            maxMembers: Math.min(MAX_MEMBERS, Math.max(MIN_MEMBERS, parseInt(req.body.maxMembers, 10))),
            requirements: req.body.requirements ? sanitizeString(req.body.requirements, MAX_REQUIREMENTS_LENGTH) : null,
            skills,
            contactMethod: req.body.contactMethod,
            status: 'open',
            deadline,
            invitedMembers: invitedMembers.length > 0 ? invitedMembers : null,
            createdBy: {
                id: new ObjectId(userId),
                name: user.name,
                avatar: user.avatar || null,
                email: user.email || null
            },
            members: [{
                id: new ObjectId(userId),
                name: user.name,
                avatar: user.avatar || null,
                role: 'Trưởng nhóm',
                joinedAt: now.toISOString()
            }],
            createdAt: now,
            updatedAt: now,
            expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : defaultExpiry
        };

        const result = await teamPosts.insertOne(newPost);

        // Send notifications to invited members
        if (invitedMembers.length > 0) {
            for (const invited of invitedMembers) {
                // Create in-app notification
                await createNotification(
                    invited.id.toString(),
                    'team_invitation',
                    'Bạn được mời tham gia nhóm',
                    `${user.name} đã mời bạn tham gia nhóm "${newPost.title}"`,
                    {
                        teamPostId: result.insertedId.toString(),
                        teamTitle: newPost.title,
                        inviterId: userId,
                        inviterName: user.name
                    }
                );

                // Send email notification if email available
                if (invited.email) {
                    await sendEmailNotification({
                        action: 'team_invite',
                        email: invited.email,
                        recipientName: invited.name,
                        inviterName: user.name,
                        teamTitle: newPost.title,
                        teamPostUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/community?post=${result.insertedId.toString()}`
                    });
                }
            }
        }

        // Log activity
        const auditLogs = getCollection('audit_logs');
        await auditLogs.insertOne({
            action: 'team_post_created',
            userId: new ObjectId(userId),
            resourceType: 'team_post',
            resourceId: result.insertedId,
            details: { title: newPost.title },
            createdAt: now
        });

        res.status(201).json({
            message: 'Đăng tin tìm đội thành công',
            post: {
                ...newPost,
                id: result.insertedId.toString(),
                contestId: newPost.contestId?.toString(),
                createdBy: {
                    ...newPost.createdBy,
                    id: newPost.createdBy.id.toString()
                },
                members: newPost.members?.map(member => ({
                    ...member,
                    id: member.id?.toString() || ''
                })) || []
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * PATCH /api/teams/:id
 * Update team post (owner only)
 */
router.patch('/:id', authGuard, async (req, res, next) => {
    try {
        await connectToDatabase();

        const { id } = req.params;
        const userId = req.user.id;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'ID không hợp lệ' });
        }

        const teamPosts = getCollection('team_posts');
        const post = await teamPosts.findOne({ _id: new ObjectId(id) });

        if (!post) {
            return res.status(404).json({ error: 'Không tìm thấy bài đăng' });
        }

        // Check ownership
        if (post.createdBy.id.toString() !== userId) {
            return res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa bài đăng này' });
        }

        // Build update object with allowed fields only
        const allowedFields = ['title', 'description', 'rolesNeeded', 'maxMembers', 'requirements', 'contactMethod', 'status'];
        const updateData = {};

        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                if (field === 'title') {
                    updateData.title = sanitizeString(req.body.title, MAX_TITLE_LENGTH);
                } else if (field === 'description') {
                    updateData.description = sanitizeString(req.body.description, MAX_DESCRIPTION_LENGTH);
                } else if (field === 'rolesNeeded') {
                    if (Array.isArray(req.body.rolesNeeded)) {
                        updateData.rolesNeeded = req.body.rolesNeeded.filter(r => ROLES_ALLOWED.includes(r));
                    }
                } else if (field === 'maxMembers') {
                    const max = parseInt(req.body.maxMembers, 10);
                    if (!isNaN(max) && max >= MIN_MEMBERS && max <= MAX_MEMBERS) {
                        updateData.maxMembers = max;
                    }
                } else if (field === 'requirements') {
                    updateData.requirements = sanitizeString(req.body.requirements, MAX_REQUIREMENTS_LENGTH);
                } else if (field === 'contactMethod') {
                    if (['message', 'email', 'both'].includes(req.body.contactMethod)) {
                        updateData.contactMethod = req.body.contactMethod;
                    }
                } else if (field === 'status') {
                    if (['open', 'closed'].includes(req.body.status)) {
                        updateData.status = req.body.status;
                    }
                }
            }
        }

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: 'Không có dữ liệu cần cập nhật' });
        }

        updateData.updatedAt = new Date();

        await teamPosts.updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );

        res.json({ message: 'Cập nhật thành công', updated: updateData });
    } catch (error) {
        next(error);
    }
});

/**
 * PUT /api/teams/:id
 * Update team post (owner only) - Alternative to PATCH for full update
 * Supports additional fields: summary, lookingFor, tags, skills, roleSlots, deadline
 */
router.put('/:id', authGuard, async (req, res, next) => {
    try {
        await connectToDatabase();

        const { id } = req.params;
        const userId = req.user.id;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'ID không hợp lệ' });
        }

        const teamPosts = getCollection('team_posts');
        const post = await teamPosts.findOne({ _id: new ObjectId(id) });

        if (!post) {
            return res.status(404).json({ error: 'Không tìm thấy bài đăng' });
        }

        // Check ownership
        if (post.createdBy.id.toString() !== userId) {
            return res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa bài đăng này' });
        }

        // Build update object
        const updateData = {};
        const {
            title, description, summary, lookingFor,
            rolesNeeded, roleSlots, maxMembers,
            requirements, contactMethod, status,
            tags, skills, deadline
        } = req.body;

        // Basic fields
        if (title) updateData.title = sanitizeString(title, MAX_TITLE_LENGTH);
        if (description !== undefined) updateData.description = sanitizeString(description, MAX_DESCRIPTION_LENGTH);
        if (summary !== undefined) updateData.summary = sanitizeString(summary, 500);
        if (lookingFor !== undefined) updateData.lookingFor = sanitizeString(lookingFor, 500);
        if (requirements !== undefined) updateData.requirements = sanitizeString(requirements, MAX_REQUIREMENTS_LENGTH);

        // Arrays
        if (rolesNeeded && Array.isArray(rolesNeeded)) {
            updateData.rolesNeeded = rolesNeeded.filter(r => ROLES_ALLOWED.includes(r)).slice(0, MAX_ROLES_COUNT);
        }
        if (roleSlots && Array.isArray(roleSlots)) {
            updateData.roleSlots = roleSlots.slice(0, MAX_ROLES_COUNT).map(slot => ({
                role: sanitizeString(slot.role, 50),
                count: Math.min(10, Math.max(1, parseInt(slot.count, 10) || 1)),
                description: slot.description ? sanitizeString(slot.description, 200) : undefined,
                skills: Array.isArray(slot.skills) ? slot.skills.slice(0, 10).map(s => sanitizeString(s, 50)) : undefined
            }));
        }
        if (skills && Array.isArray(skills)) {
            updateData.skills = skills.slice(0, 20).map(s => sanitizeString(s, 50));
        }
        if (tags && Array.isArray(tags)) {
            updateData.tags = tags.slice(0, 10).map(t => sanitizeString(t, 50));
        }

        // Numbers
        if (maxMembers !== undefined) {
            const max = parseInt(maxMembers, 10);
            if (!isNaN(max)) {
                updateData.maxMembers = Math.min(MAX_MEMBERS, Math.max(MIN_MEMBERS, max));
            }
        }

        // Enums
        if (contactMethod && ['message', 'email', 'both'].includes(contactMethod)) {
            updateData.contactMethod = contactMethod;
        }
        if (status && ['open', 'closed'].includes(status)) {
            updateData.status = status;
        }

        // Date
        if (deadline !== undefined) {
            if (deadline) {
                const deadlineDate = new Date(deadline);
                if (!isNaN(deadlineDate.getTime())) {
                    updateData.deadline = deadlineDate;
                }
            } else {
                updateData.deadline = null;
            }
        }

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: 'Không có dữ liệu cần cập nhật' });
        }

        updateData.updatedAt = new Date();

        await teamPosts.updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );

        // Get updated post
        const updatedPost = await teamPosts.findOne({ _id: new ObjectId(id) });

        res.json({
            message: 'Cập nhật thành công',
            team: {
                ...updatedPost,
                id: updatedPost._id.toString(),
                _id: undefined
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * DELETE /api/teams/:id
 * Delete team post (owner or admin only)
 */
router.delete('/:id', authGuard, async (req, res, next) => {
    try {
        await connectToDatabase();

        const { id } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'ID không hợp lệ' });
        }

        const teamPosts = getCollection('team_posts');
        const post = await teamPosts.findOne({ _id: new ObjectId(id) });

        if (!post) {
            return res.status(404).json({ error: 'Không tìm thấy bài đăng' });
        }

        // Check ownership or admin
        const isPrivileged = userRole === 'admin' || userRole === 'super_admin';
        if (post.createdBy.id.toString() !== userId && !isPrivileged) {
            return res.status(403).json({ error: 'Bạn không có quyền xóa bài đăng này' });
        }

        await teamPosts.deleteOne({ _id: new ObjectId(id) });

        // Log activity
        const auditLogs = getCollection('audit_logs');
        await auditLogs.insertOne({
            action: 'team_post_deleted',
            userId: new ObjectId(userId),
            resourceType: 'team_post',
            resourceId: new ObjectId(id),
            details: { title: post.title, deletedBy: isPrivileged ? userRole : 'owner' },
            createdAt: new Date()
        });

        res.json({ message: 'Xóa bài đăng thành công' });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/teams/:id/join
 * Request to join team
 */
router.post('/:id/join', authGuard, async (req, res, next) => {
    try {
        await connectToDatabase();

        const { id } = req.params;
        const { role, message } = req.body;
        const userId = req.user.id;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'ID không hợp lệ' });
        }

        const teamPosts = getCollection('team_posts');
        const users = getCollection('users');

        const post = await teamPosts.findOne({ _id: new ObjectId(id) });

        if (!post) {
            return res.status(404).json({ error: 'Không tìm thấy bài đăng' });
        }

        if (post.status !== 'open') {
            return res.status(400).json({ error: 'Bài đăng không còn nhận thành viên' });
        }

        if (post.currentMembers >= post.maxMembers) {
            return res.status(400).json({ error: 'Nhóm đã đủ thành viên' });
        }

        // Check if already a member
        const isMember = post.members.some(m => m.id.toString() === userId);
        if (isMember) {
            return res.status(400).json({ error: 'Bạn đã là thành viên của nhóm này' });
        }

        // Get user info
        const user = await users.findOne(
            { _id: new ObjectId(userId) },
            { projection: { name: 1, avatar: 1 } }
        );

        if (!user) {
            return res.status(404).json({ error: 'Không tìm thấy người dùng' });
        }

        // Create join request or add directly (depending on your flow)
        // For now, we'll create a join request
        const joinRequests = getCollection('team_join_requests');

        // Check for existing pending request
        const existingRequest = await joinRequests.findOne({
            teamPostId: new ObjectId(id),
            userId: new ObjectId(userId),
            status: 'pending'
        });

        if (existingRequest) {
            return res.status(400).json({ error: 'Bạn đã gửi yêu cầu tham gia trước đó' });
        }

        const now = new Date();
        await joinRequests.insertOne({
            teamPostId: new ObjectId(id),
            teamTitle: post.title,
            userId: new ObjectId(userId),
            userName: user.name,
            userAvatar: user.avatar,
            role: role && ROLES_ALLOWED.includes(role) ? role : null,
            message: message ? sanitizeString(message, 500) : null,
            status: 'pending',
            createdAt: now
        });

        // Send notifications to team owner and members (async, don't wait)
        sendJoinRequestNotifications(post, { _id: new ObjectId(userId), name: user.name }, message)
            .catch(err => console.error('Failed to send join request notifications:', err));

        res.json({ message: 'Đã gửi yêu cầu tham gia. Vui lòng chờ phản hồi từ trưởng nhóm.' });
    } catch (error) {
        next(error);
    }
});

/**
 * PATCH /api/teams/:id/members/:memberId
 * Update member role and task (owner only)
 */
router.patch('/:id/members/:memberId', authGuard, async (req, res, next) => {
    try {
        await connectToDatabase();

        const { id, memberId } = req.params;
        const { role, task } = req.body;
        const userId = req.user.id;

        if (!ObjectId.isValid(id) || !ObjectId.isValid(memberId)) {
            return res.status(400).json({ error: 'ID không hợp lệ' });
        }

        const teamPosts = getCollection('team_posts');
        const post = await teamPosts.findOne({ _id: new ObjectId(id) });

        if (!post) {
            return res.status(404).json({ error: 'Không tìm thấy bài đăng' });
        }

        // Check ownership
        if (post.createdBy.id.toString() !== userId) {
            return res.status(403).json({ error: 'Chỉ trưởng nhóm mới có thể cập nhật thành viên' });
        }

        // Find member
        const memberIndex = post.members.findIndex(m => m.id.toString() === memberId);
        if (memberIndex === -1) {
            return res.status(404).json({ error: 'Không tìm thấy thành viên trong nhóm' });
        }

        // Build update
        const memberUpdate = {};
        if (role !== undefined) {
            memberUpdate[`members.${memberIndex}.role`] = role && ROLES_ALLOWED.includes(role) ? role : null;
        }
        if (task !== undefined) {
            memberUpdate[`members.${memberIndex}.task`] = task ? sanitizeString(task, 500) : null;
        }

        if (Object.keys(memberUpdate).length === 0) {
            return res.status(400).json({ error: 'Không có dữ liệu cần cập nhật' });
        }

        memberUpdate.updatedAt = new Date();

        await teamPosts.updateOne(
            { _id: new ObjectId(id) },
            { $set: memberUpdate }
        );

        res.json({ message: 'Cập nhật thành viên thành công' });
    } catch (error) {
        next(error);
    }
});

/**
 * DELETE /api/teams/:id/members/:memberId
 * Remove member from team (owner only)
 */
router.delete('/:id/members/:memberId', authGuard, async (req, res, next) => {
    try {
        await connectToDatabase();

        const { id, memberId } = req.params;
        const userId = req.user.id;

        if (!ObjectId.isValid(id) || !ObjectId.isValid(memberId)) {
            return res.status(400).json({ error: 'ID không hợp lệ' });
        }

        const teamPosts = getCollection('team_posts');
        const post = await teamPosts.findOne({ _id: new ObjectId(id) });

        if (!post) {
            return res.status(404).json({ error: 'Không tìm thấy bài đăng' });
        }

        // Check ownership
        if (post.createdBy.id.toString() !== userId) {
            return res.status(403).json({ error: 'Chỉ trưởng nhóm mới có thể xóa thành viên' });
        }

        // Cannot remove self (owner)
        if (memberId === userId) {
            return res.status(400).json({ error: 'Trưởng nhóm không thể tự xóa khỏi nhóm' });
        }

        // Find member
        const memberExists = post.members.some(m => m.id.toString() === memberId);
        if (!memberExists) {
            return res.status(404).json({ error: 'Không tìm thấy thành viên trong nhóm' });
        }

        // Remove member and update count
        await teamPosts.updateOne(
            { _id: new ObjectId(id) },
            {
                $pull: { members: { id: new ObjectId(memberId) } },
                $inc: { currentMembers: -1 },
                $set: {
                    updatedAt: new Date(),
                    // Reopen if was full
                    status: post.status === 'full' ? 'open' : post.status
                }
            }
        );

        // Log activity
        const auditLogs = getCollection('audit_logs');
        await auditLogs.insertOne({
            action: 'team_member_removed',
            userId: new ObjectId(userId),
            resourceType: 'team_post',
            resourceId: new ObjectId(id),
            details: { removedMemberId: memberId },
            createdAt: new Date()
        });

        res.json({ message: 'Đã xóa thành viên khỏi nhóm' });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/teams/my/posts
 * Get current user's team posts with stats (requires auth)
 */
router.get('/my/posts', authGuard, async (req, res, next) => {
    try {
        await connectToDatabase();

        const userId = req.user.id;
        const { status, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc', includeDeleted = 'false' } = req.query;

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
        const skip = (pageNum - 1) * limitNum;

        // Build query for user's posts
        const query = { 'createdBy.id': new ObjectId(userId) };

        // Filter by status if provided
        if (status && ['open', 'closed', 'full'].includes(status)) {
            query.status = status;
        }

        // Include or exclude soft-deleted posts
        if (includeDeleted !== 'true') {
            query.deletedAt = { $exists: false };
        }

        // Sort options
        const allowedSortFields = ['createdAt', 'updatedAt', 'status', 'currentMembers'];
        const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
        const sortDirection = sortOrder === 'asc' ? 1 : -1;

        const teamPosts = getCollection('team_posts');
        const joinRequests = getCollection('team_join_requests');

        // Get posts and counts in parallel
        const [posts, total, stats] = await Promise.all([
            teamPosts
                .find(query)
                .sort({ [sortField]: sortDirection })
                .skip(skip)
                .limit(limitNum)
                .toArray(),
            teamPosts.countDocuments(query),
            // Get aggregated stats for user's posts
            teamPosts.aggregate([
                { $match: { 'createdBy.id': new ObjectId(userId), deletedAt: { $exists: false } } },
                {
                    $group: {
                        _id: null,
                        totalPosts: { $sum: 1 },
                        openPosts: { $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] } },
                        closedPosts: { $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] } },
                        fullPosts: { $sum: { $cond: [{ $eq: ['$status', 'full'] }, 1, 0] } },
                        totalMembers: { $sum: '$currentMembers' }
                    }
                }
            ]).toArray()
        ]);

        // Get pending join requests count for each post
        const postIds = posts.map(p => p._id);
        const pendingRequestsCounts = await joinRequests.aggregate([
            { $match: { teamPostId: { $in: postIds }, status: 'pending' } },
            { $group: { _id: '$teamPostId', count: { $sum: 1 } } }
        ]).toArray();

        const pendingCountsMap = new Map(pendingRequestsCounts.map(p => [p._id.toString(), p.count]));

        // Transform posts - ensure all IDs are strings
        const transformedPosts = posts.map(post => ({
            ...post,
            id: post._id.toString(),
            _id: undefined,
            contestId: post.contestId?.toString(),
            pendingRequests: pendingCountsMap.get(post._id.toString()) || 0,
            isDeleted: !!post.deletedAt,
            createdBy: {
                id: post.createdBy.id?.toString() || '',
                name: post.createdBy.name || 'Unknown',
                avatar: post.createdBy.avatar || '',
                email: post.createdBy.email || ''
            },
            members: post.members?.map(member => ({
                ...member,
                id: member.id?.toString() || ''
            })) || []
        }));

        const statsResult = stats[0] || { totalPosts: 0, openPosts: 0, closedPosts: 0, fullPosts: 0, totalMembers: 0 };

        res.json({
            posts: transformedPosts,
            stats: {
                totalPosts: statsResult.totalPosts,
                openPosts: statsResult.openPosts,
                closedPosts: statsResult.closedPosts,
                fullPosts: statsResult.fullPosts,
                totalMembers: statsResult.totalMembers
            },
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

/**
 * GET /api/teams/roles
 * Get list of allowed roles
 */
router.get('/config/roles', async (req, res) => {
    res.json({ roles: ROLES_ALLOWED });
});

export default router;

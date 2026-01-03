import { Router } from 'express';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import { connectToDatabase, getCollection } from '../lib/db.js';
import { getVietnamStartOfDay } from '../lib/time.js';
import { authGuard } from '../middleware/auth.js';
import { invalidateUserCache } from '../lib/matchingEngine.js';

const router = Router();

// ============ VALIDATION HELPERS ============

/**
 * Sanitize string input - remove control characters, trim whitespace
 */
function sanitizeString(str, maxLength = 500) {
    if (typeof str !== 'string') return '';
    // Remove control characters except newlines/tabs for bio
    return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim().slice(0, maxLength);
}

/**
 * Validate phone number format
 */
function isValidPhone(phone) {
    if (!phone) return true; // Optional field
    return /^[0-9+\-\s]{0,20}$/.test(phone);
}

/**
 * Validate notification settings structure
 */
function validateNotificationSettings(settings) {
    const validKeys = ['email', 'push', 'contestReminders', 'courseUpdates', 'marketing'];
    if (typeof settings !== 'object' || settings === null) return false;

    for (const key of Object.keys(settings)) {
        if (!validKeys.includes(key)) return false;
        if (typeof settings[key] !== 'boolean') return false;
    }
    return true;
}

/**
 * Validate privacy settings structure
 */
function validatePrivacySettings(settings) {
    const validKeys = ['showProfile', 'showActivity', 'showAchievements'];
    if (typeof settings !== 'object' || settings === null) return false;

    for (const key of Object.keys(settings)) {
        if (!validKeys.includes(key)) return false;
        if (typeof settings[key] !== 'boolean') return false;
    }
    return true;
}

// Default shapes for extended profile data
const DEFAULT_MATCHING_PROFILE = {
    primaryRole: '',
    secondaryRoles: [],
    experienceLevel: '',
    yearsExperience: null,
    location: '',
    timeZone: '',
    languages: [],
    skills: [],
    techStack: [],
    remotePreference: '',
    availability: '',
    collaborationStyle: '',
    communicationTools: [],
    openToNewTeams: true,
    openToMentor: false,
};

const DEFAULT_CONTEST_PREFERENCES = {
    contestInterests: [],
    preferredContestFormats: [],
    preferredTeamRole: '',
    preferredTeamSize: '',
    learningGoals: '',
    strengths: '',
    achievements: '',
    portfolioLinks: [],
};

const DEFAULT_CONSENTS = {
    allowMatching: true,
    allowRecommendations: true,
    shareExtendedProfile: false,
};

/**
 * Sanitize an array of strings (comma separated string also supported)
 */
function sanitizeStringArray(value, maxItems = 15, maxLength = 50) {
    const rawArray = Array.isArray(value)
        ? value
        : typeof value === 'string'
            ? value.split(',')
            : [];

    return rawArray
        .map(item => sanitizeString(item, maxLength))
        .filter(Boolean)
        .slice(0, maxItems);
}

/**
 * Sanitize number within bounds, otherwise return null
 */
function sanitizeNumber(value, min = 0, max = 50) {
    const num = Number(value);
    if (Number.isFinite(num) && num >= min && num <= max) {
        return num;
    }
    return null;
}

/**
 * Sanitize URLs list (best effort)
 */
function sanitizeUrlList(value, maxItems = 5) {
    const urls = sanitizeStringArray(value, maxItems, 300);
    const urlPattern = /^https?:\/\//i;
    return urls.filter(url => urlPattern.test(url));
}

/**
 * Normalize matching profile payload
 */
function sanitizeMatchingProfile(input = {}) {
    const source = typeof input === 'object' && input !== null ? input : {};
    return {
        ...DEFAULT_MATCHING_PROFILE,
        primaryRole: sanitizeString(source.primaryRole, 80),
        secondaryRoles: sanitizeStringArray(source.secondaryRoles, 10, 50),
        experienceLevel: sanitizeString(source.experienceLevel, 50),
        yearsExperience: sanitizeNumber(source.yearsExperience, 0, 50),
        location: sanitizeString(source.location, 120),
        timeZone: sanitizeString(source.timeZone, 80),
        languages: sanitizeStringArray(source.languages, 8, 50),
        skills: sanitizeStringArray(source.skills, 20, 50),
        techStack: sanitizeStringArray(source.techStack, 20, 50),
        remotePreference: sanitizeString(source.remotePreference, 50),
        availability: sanitizeString(source.availability, 200),
        collaborationStyle: sanitizeString(source.collaborationStyle, 200),
        communicationTools: sanitizeStringArray(source.communicationTools, 10, 50),
        openToNewTeams: typeof source.openToNewTeams === 'boolean' ? source.openToNewTeams : true,
        openToMentor: !!source.openToMentor,
    };
}

/**
 * Normalize contest preference payload
 */
function sanitizeContestPreferences(input = {}) {
    const source = typeof input === 'object' && input !== null ? input : {};
    return {
        ...DEFAULT_CONTEST_PREFERENCES,
        contestInterests: sanitizeStringArray(source.contestInterests, 15, 50),
        preferredContestFormats: sanitizeStringArray(source.preferredContestFormats, 10, 50),
        preferredTeamRole: sanitizeString(source.preferredTeamRole, 80),
        preferredTeamSize: sanitizeString(source.preferredTeamSize, 50),
        learningGoals: sanitizeString(source.learningGoals, 400),
        strengths: sanitizeString(source.strengths, 400),
        achievements: sanitizeString(source.achievements, 500),
        portfolioLinks: sanitizeUrlList(source.portfolioLinks, 5),
    };
}

/**
 * Normalize consent flags
 */
function sanitizeConsents(consents = {}) {
    const source = typeof consents === 'object' && consents !== null ? consents : {};
    return {
        allowMatching: source.allowMatching !== false,
        allowRecommendations: source.allowRecommendations !== false,
        shareExtendedProfile: !!source.shareExtendedProfile,
    };
}

// ============ ROUTES ============

/**
 * GET /api/users/:id/profile
 * Get public profile of a user (respects privacy settings)
 * Can be accessed by authenticated users
 */
router.get('/:id/profile', authGuard, async (req, res, next) => {
    try {
        await connectToDatabase();
        const { id: targetUserId } = req.params;
        const currentUserId = req.user.id;

        if (!ObjectId.isValid(targetUserId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        const users = getCollection('users');
        const user = await users.findOne(
            { _id: new ObjectId(targetUserId) },
            {
                projection: {
                    password: 0,
                    resetPasswordToken: 0,
                    resetPasswordExpiry: 0,
                }
            }
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const isOwnProfile = targetUserId === currentUserId;
        const privacy = user.privacy || {
            showProfile: true,
            showActivity: true,
            showAchievements: true,
        };

        // If profile is completely hidden and not own profile
        if (!isOwnProfile && !privacy.showProfile) {
            return res.json({
                id: user._id.toString(),
                name: user.name || 'Ẩn danh',
                avatar: null,
                isPrivate: true,
                message: 'Người dùng này đã ẩn hồ sơ của họ'
            });
        }

        // Get user's streak data
        let streakData = null;
        if (isOwnProfile || privacy.showAchievements) {
            const streakCollection = getCollection('user_streaks');
            const streak = await streakCollection.findOne({ userId: targetUserId });
            if (streak) {
                const today = getVietnamStartOfDay();
                const yesterdayStart = new Date(today.getTime() - 24 * 60 * 60 * 1000);
                const lastActivity = streak.lastActivityDate
                    ? getVietnamStartOfDay(new Date(streak.lastActivityDate))
                    : null;

                let currentStreak = streak.currentStreak || 0;
                if (lastActivity && lastActivity < yesterdayStart) {
                    currentStreak = 0;
                }

                streakData = {
                    currentStreak,
                    longestStreak: streak.longestStreak || 0,
                };
            }
        }

        // Get user's registrations (activities)
        let activities = [];
        if (isOwnProfile || privacy.showActivity) {
            const registrations = getCollection('registrations');
            const contests = getCollection('contests');

            const userRegistrations = await registrations
                .find({ userId: targetUserId })
                .sort({ registeredAt: -1 })
                .limit(10)
                .toArray();

            if (userRegistrations.length > 0) {
                const contestIds = userRegistrations
                    .map(r => ObjectId.isValid(r.contestId) ? new ObjectId(r.contestId) : null)
                    .filter(Boolean);

                const contestDocs = await contests
                    .find({ _id: { $in: contestIds } })
                    .toArray();

                const contestMap = new Map(contestDocs.map(c => [c._id.toString(), c]));

                activities = userRegistrations.map(r => {
                    const contest = contestMap.get(r.contestId);
                    return {
                        type: 'contest_registration',
                        title: contest?.title || 'Cuộc thi',
                        date: r.registeredAt,
                        status: r.status,
                    };
                });
            }
        }

        // Get user's course enrollments
        let enrollments = [];
        if (isOwnProfile || privacy.showActivity) {
            const courseEnrollments = getCollection('course_enrollments');
            const courses = getCollection('courses');

            const userEnrollments = await courseEnrollments
                .find({ userId: targetUserId })
                .sort({ enrolledAt: -1 })
                .limit(5)
                .toArray();

            if (userEnrollments.length > 0) {
                const courseIds = userEnrollments
                    .map(e => ObjectId.isValid(e.courseId) ? new ObjectId(e.courseId) : null)
                    .filter(Boolean);

                const courseDocs = await courses
                    .find({ _id: { $in: courseIds } })
                    .toArray();

                const courseMap = new Map(courseDocs.map(c => [c._id.toString(), c]));

                enrollments = userEnrollments.map(e => {
                    const course = courseMap.get(e.courseId);
                    return {
                        title: course?.title || 'Khóa học',
                        progress: e.progress || 0,
                        status: e.status,
                        enrolledAt: e.enrolledAt,
                    };
                });
            }
        }

        // Get achievements/stats
        let achievements = null;
        if (isOwnProfile || privacy.showAchievements) {
            const registrations = getCollection('registrations');
            const courseEnrollments = getCollection('course_enrollments');

            const [totalContests, completedCourses] = await Promise.all([
                registrations.countDocuments({ userId: targetUserId }),
                courseEnrollments.countDocuments({ userId: targetUserId, status: 'completed' })
            ]);

            achievements = {
                totalContests,
                completedCourses,
                contestAchievements: user.contestPreferences?.achievements || '',
                portfolioLinks: user.contestPreferences?.portfolioLinks || [],
            };
        }

        // Build response based on privacy settings
        const response = {
            id: user._id.toString(),
            name: user.name || 'Ẩn danh',
            email: isOwnProfile ? user.email : undefined, // Only show email to self
            avatar: user.avatar || null,
            bio: user.bio || '',
            isOwnProfile,
            privacy: isOwnProfile ? privacy : undefined, // Only show privacy settings to self
            createdAt: user.createdAt,

            // Matching profile (public info)
            matchingProfile: (isOwnProfile || privacy.showProfile) ? {
                primaryRole: user.matchingProfile?.primaryRole || '',
                secondaryRoles: user.matchingProfile?.secondaryRoles || [],
                experienceLevel: user.matchingProfile?.experienceLevel || '',
                location: user.matchingProfile?.location || '',
                skills: user.matchingProfile?.skills || [],
                techStack: user.matchingProfile?.techStack || [],
                languages: user.matchingProfile?.languages || [],
                openToNewTeams: user.matchingProfile?.openToNewTeams,
                openToMentor: user.matchingProfile?.openToMentor,
            } : null,

            // Contest preferences
            contestPreferences: (isOwnProfile || privacy.showProfile) ? {
                contestInterests: user.contestPreferences?.contestInterests || [],
                preferredTeamRole: user.contestPreferences?.preferredTeamRole || '',
                preferredTeamSize: user.contestPreferences?.preferredTeamSize || '',
            } : null,

            // Streak data
            streak: streakData,

            // Activities (if allowed)
            activities: (isOwnProfile || privacy.showActivity) ? activities : null,
            enrollments: (isOwnProfile || privacy.showActivity) ? enrollments : null,

            // Achievements (if allowed)
            achievements: (isOwnProfile || privacy.showAchievements) ? achievements : null,
        };

        res.json(response);
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/users/search
 * Search users by name or email for tagging/inviting
 * Protected route - requires authentication
 */
router.get('/search', authGuard, async (req, res, next) => {
    try {
        await connectToDatabase();
        const userId = req.user.id;
        const { q, limit = 8 } = req.query;

        // Validate and sanitize search query
        const query = sanitizeString(q, 100);
        if (!query || query.length < 2) {
            return res.json({ users: [] });
        }

        // Escape regex special characters
        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const searchRegex = { $regex: escapedQuery, $options: 'i' };

        const users = getCollection('users');

        // Search by name or email, exclude current user
        const results = await users.find(
            {
                _id: { $ne: new ObjectId(userId) },
                $or: [
                    { name: searchRegex },
                    { email: searchRegex }
                ],
                // Only search users who allow being found (optional privacy check)
                // 'privacy.showProfile': { $ne: false }
            },
            {
                projection: {
                    _id: 1,
                    name: 1,
                    email: 1,
                    avatar: 1,
                    'matchingProfile.primaryRole': 1
                }
            }
        )
            .limit(Math.min(parseInt(limit) || 8, 20))
            .toArray();

        res.json({
            users: results.map(user => ({
                id: user._id.toString(),
                name: user.name || 'Unknown',
                email: user.email,
                avatar: user.avatar || null,
                role: user.matchingProfile?.primaryRole || null
            }))
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/users/me/settings
 * Get current user's full settings
 */
router.get('/me/settings', authGuard, async (req, res, next) => {
    try {
        await connectToDatabase();
        const userId = req.user.id;

        if (!ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        const users = getCollection('users');
        const user = await users.findOne(
            { _id: new ObjectId(userId) },
            {
                projection: {
                    password: 0, // Never return password
                    resetPasswordToken: 0,
                    resetPasswordExpiry: 0,
                }
            }
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Return user settings with defaults
        res.json({
            id: user._id.toString(),
            name: user.name || '',
            email: user.email,
            avatar: user.avatar || '',
            phone: user.phone || '',
            bio: user.bio || '',
            matchingProfile: {
                ...DEFAULT_MATCHING_PROFILE,
                ...(user.matchingProfile || {})
            },
            contestPreferences: {
                ...DEFAULT_CONTEST_PREFERENCES,
                ...(user.contestPreferences || {})
            },
            consents: {
                ...DEFAULT_CONSENTS,
                ...(user.consents || {})
            },
            notifications: user.notifications || {
                email: true,
                push: true,
                contestReminders: true,
                courseUpdates: true,
                marketing: false,
            },
            privacy: user.privacy || {
                showProfile: true,
                showActivity: true,
                showAchievements: true,
            },
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * PATCH /api/users/me/profile
 * Update user profile (name, phone, bio)
 */
router.patch('/me/profile', authGuard, async (req, res, next) => {
    try {
        await connectToDatabase();
        const userId = req.user.id;
        const {
            name,
            phone,
            bio,
            matchingProfile,
            contestPreferences,
            consents,
        } = req.body || {};

        if (!ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        // Validate and sanitize inputs
        const sanitizedName = sanitizeString(name, 100);
        const sanitizedPhone = sanitizeString(phone, 20);
        const sanitizedBio = sanitizeString(bio, 500);

        if (!sanitizedName) {
            return res.status(400).json({ error: 'Name is required.' });
        }

        if (sanitizedName.length > 100) {
            return res.status(400).json({ error: 'Name must be 100 characters or less.' });
        }

        if (!isValidPhone(sanitizedPhone)) {
            return res.status(400).json({ error: 'Invalid phone number format.' });
        }

        const sanitizedMatchingProfile = sanitizeMatchingProfile(matchingProfile);
        const sanitizedContestPreferences = sanitizeContestPreferences(contestPreferences);
        const sanitizedConsents = sanitizeConsents(consents);

        const users = getCollection('users');
        const updateData = {
            name: sanitizedName,
            phone: sanitizedPhone,
            bio: sanitizedBio,
            matchingProfile: sanitizedMatchingProfile,
            contestPreferences: sanitizedContestPreferences,
            consents: sanitizedConsents,
            updatedAt: new Date(),
        };

        const result = await users.updateOne(
            { _id: new ObjectId(userId) },
            { $set: updateData }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Invalidate matching cache when profile is updated
        try {
            invalidateUserCache(userId);
        } catch (cacheError) {
            console.warn('[Users] Failed to invalidate matching cache:', cacheError.message);
            // Non-critical, continue
        }

        res.json({
            message: 'Profile updated successfully.',
            updated: {
                name: sanitizedName,
                phone: sanitizedPhone,
                bio: sanitizedBio,
                matchingProfile: sanitizedMatchingProfile,
                contestPreferences: sanitizedContestPreferences,
                consents: sanitizedConsents,
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/users/me/change-password
 * Change user password (requires current password)
 */
router.post('/me/change-password', authGuard, async (req, res, next) => {
    try {
        await connectToDatabase();
        const userId = req.user.id;
        const { currentPassword, newPassword } = req.body || {};

        if (!ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        // Validate inputs
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current password and new password are required.' });
        }

        if (typeof newPassword !== 'string' || newPassword.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters.' });
        }

        if (newPassword.length > 128) {
            return res.status(400).json({ error: 'Password must be 128 characters or less.' });
        }

        const users = getCollection('users');
        const user = await users.findOne({ _id: new ObjectId(userId) });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Verify current password
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isCurrentPasswordValid) {
            return res.status(400).json({ error: 'Current password is incorrect.' });
        }

        // Check if new password is same as current
        const isSamePassword = await bcrypt.compare(newPassword, user.password);
        if (isSamePassword) {
            return res.status(400).json({ error: 'New password must be different from current password.' });
        }

        // Hash new password with bcrypt (12 rounds for security)
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        await users.updateOne(
            { _id: new ObjectId(userId) },
            {
                $set: {
                    password: hashedPassword,
                    updatedAt: new Date(),
                },
                // Invalidate any password reset tokens
                $unset: {
                    resetPasswordToken: '',
                    resetPasswordExpiry: '',
                }
            }
        );

        res.json({ message: 'Password changed successfully.' });
    } catch (error) {
        next(error);
    }
});

/**
 * PATCH /api/users/me/notifications
 * Update notification preferences
 */
router.patch('/me/notifications', authGuard, async (req, res, next) => {
    try {
        await connectToDatabase();
        const userId = req.user.id;
        const settings = req.body;

        if (!ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        if (!validateNotificationSettings(settings)) {
            return res.status(400).json({ error: 'Invalid notification settings format.' });
        }

        const users = getCollection('users');

        // Only update valid boolean fields
        const validSettings = {
            'notifications.email': !!settings.email,
            'notifications.push': !!settings.push,
            'notifications.contestReminders': !!settings.contestReminders,
            'notifications.courseUpdates': !!settings.courseUpdates,
            'notifications.marketing': !!settings.marketing,
        };

        const result = await users.updateOne(
            { _id: new ObjectId(userId) },
            {
                $set: {
                    ...validSettings,
                    updatedAt: new Date(),
                }
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ message: 'Notification settings updated successfully.' });
    } catch (error) {
        next(error);
    }
});

/**
 * PATCH /api/users/me/privacy
 * Update privacy settings
 */
router.patch('/me/privacy', authGuard, async (req, res, next) => {
    try {
        await connectToDatabase();
        const userId = req.user.id;
        const settings = req.body;

        if (!ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        if (!validatePrivacySettings(settings)) {
            return res.status(400).json({ error: 'Invalid privacy settings format.' });
        }

        const users = getCollection('users');

        // Only update valid boolean fields
        const validSettings = {
            'privacy.showProfile': !!settings.showProfile,
            'privacy.showActivity': !!settings.showActivity,
            'privacy.showAchievements': !!settings.showAchievements,
        };

        const result = await users.updateOne(
            { _id: new ObjectId(userId) },
            {
                $set: {
                    ...validSettings,
                    updatedAt: new Date(),
                }
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ message: 'Privacy settings updated successfully.' });
    } catch (error) {
        next(error);
    }
});

/**
 * PATCH /api/users/me/avatar
 * Update user avatar URL (after uploading to Google Drive)
 */
router.patch('/me/avatar', authGuard, async (req, res, next) => {
    try {
        await connectToDatabase();
        const userId = req.user.id;
        const { avatarUrl } = req.body || {};

        if (!ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        // Validate avatar URL
        if (!avatarUrl || typeof avatarUrl !== 'string') {
            return res.status(400).json({ error: 'Avatar URL is required.' });
        }

        // Basic URL validation - allow Google Drive URLs and common image URLs
        const urlPattern = /^https:\/\/(drive\.google\.com|lh3\.googleusercontent\.com|.*\.googleusercontent\.com|ui-avatars\.com)/i;
        if (!urlPattern.test(avatarUrl) && avatarUrl.length > 500) {
            return res.status(400).json({ error: 'Invalid avatar URL format.' });
        }

        const users = getCollection('users');

        const result = await users.updateOne(
            { _id: new ObjectId(userId) },
            {
                $set: {
                    avatar: avatarUrl,
                    updatedAt: new Date(),
                }
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            message: 'Avatar updated successfully.',
            avatar: avatarUrl
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/users/me/notifications-history
 * Get user's notification history from notification_logs collection
 */
router.get('/me/notifications-history', authGuard, async (req, res, next) => {
    try {
        await connectToDatabase();
        const userId = req.user.id;
        const { limit = 20, skip = 0 } = req.query;

        if (!ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        // Get user email to filter notifications
        const users = getCollection('users');
        const user = await users.findOne(
            { _id: new ObjectId(userId) },
            { projection: { email: 1 } }
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get notifications sent to this user
        const notificationLogs = getCollection('notification_logs');

        // Query for notifications - both individual and bulk
        const notifications = await notificationLogs
            .find({
                $or: [
                    { recipientEmail: user.email },
                    { type: 'announcement' }, // System announcements sent to all
                    { type: { $in: ['contestReminder', 'courseUpdate'] } } // User-specific
                ]
            })
            .sort({ createdAt: -1 })
            .skip(parseInt(skip))
            .limit(parseInt(limit))
            .toArray();

        res.json({
            notifications: notifications.map(n => ({
                id: n._id.toString(),
                type: n.type,
                title: n.title || getNotificationTitle(n.type),
                message: n.message || getNotificationMessage(n),
                createdAt: n.createdAt,
                isRead: n.readBy?.includes(userId) || false,
            })),
            total: await notificationLogs.countDocuments({
                $or: [
                    { recipientEmail: user.email },
                    { type: 'announcement' }
                ]
            })
        });
    } catch (error) {
        next(error);
    }
});

/**
 * Helper: Get notification title by type
 */
function getNotificationTitle(type) {
    const titles = {
        contestReminder: '🔔 Nhắc nhở cuộc thi',
        courseUpdate: '📚 Cập nhật khóa học',
        announcement: '📢 Thông báo hệ thống',
        welcome: '🎉 Chào mừng',
        contestRegistration: '✅ Đăng ký thành công',
    };
    return titles[type] || 'Thông báo';
}

/**
 * Helper: Get notification message
 */
function getNotificationMessage(notification) {
    if (notification.message) return notification.message;

    switch (notification.type) {
        case 'contestReminder':
            return `Cuộc thi sắp bắt đầu`;
        case 'courseUpdate':
            return `Khóa học có nội dung mới`;
        case 'announcement':
            return notification.title || 'Thông báo từ hệ thống';
        default:
            return 'Bạn có thông báo mới';
    }
}

/**
 * PATCH /api/users/me/notifications/mark-all-read
 * Mark all notifications as read for current user
 */
router.patch('/me/notifications/mark-all-read', authGuard, async (req, res, next) => {
    try {
        await connectToDatabase();
        const userId = req.user.id;

        if (!ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        const notificationLogs = getCollection('notification_logs');

        // Add userId to readBy array for all notifications
        await notificationLogs.updateMany(
            { readBy: { $ne: userId } },
            { $addToSet: { readBy: userId } }
        );

        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
        next(error);
    }
});

/**
 * PATCH /api/users/me/notifications/:notificationId/read
 * Mark a single notification as read
 */
router.patch('/me/notifications/:notificationId/read', authGuard, async (req, res, next) => {
    try {
        await connectToDatabase();
        const userId = req.user.id;
        const { notificationId } = req.params;

        if (!ObjectId.isValid(userId) || !ObjectId.isValid(notificationId)) {
            return res.status(400).json({ error: 'Invalid ID' });
        }

        const notificationLogs = getCollection('notification_logs');

        await notificationLogs.updateOne(
            { _id: new ObjectId(notificationId) },
            { $addToSet: { readBy: userId } }
        );

        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

// ============ STREAK ENDPOINTS ============

/**
 * Helper: Calculate streak from activity log
 */
function calculateStreak(activityDates, today) {
    if (!activityDates || activityDates.length === 0) return 0;

    // Sort dates descending (newest first)
    const sortedDates = [...activityDates]
        .map(d => new Date(d).getTime())
        .sort((a, b) => b - a);

    const todayStart = getVietnamStartOfDay(today).getTime();
    const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;

    // Check if user was active today or yesterday
    const lastActivityDay = getVietnamStartOfDay(new Date(sortedDates[0])).getTime();

    // If last activity was before yesterday, streak is broken
    if (lastActivityDay < yesterdayStart) {
        return 0;
    }

    // Count consecutive days
    let streak = 0;
    let expectedDay = lastActivityDay;
    const oneDayMs = 24 * 60 * 60 * 1000;

    const uniqueDays = new Set(
        sortedDates.map(d => getVietnamStartOfDay(new Date(d)).getTime())
    );

    for (const dayTime of [...uniqueDays].sort((a, b) => b - a)) {
        if (dayTime === expectedDay) {
            streak++;
            expectedDay -= oneDayMs;
        } else if (dayTime < expectedDay) {
            // Gap found, streak ends
            break;
        }
    }

    return streak;
}

/**
 * GET /api/users/streak
 * Get current user's learning streak
 */
router.get('/streak', authGuard, async (req, res, next) => {
    try {
        await connectToDatabase();

        const userId = req.user.id;
        const streakCollection = getCollection('user_streaks');

        const streakData = await streakCollection.findOne({ userId });

        if (!streakData) {
            return res.json({
                currentStreak: 0,
                longestStreak: 0,
                lastActivityDate: null,
                todayCheckedIn: false
            });
        }

        const today = getVietnamStartOfDay();
        const lastActivity = streakData.lastActivityDate
            ? getVietnamStartOfDay(new Date(streakData.lastActivityDate))
            : null;

        // Check if streak is still valid
        const yesterdayStart = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        let currentStreak = streakData.currentStreak || 0;

        // If last activity was before yesterday, streak is broken
        if (lastActivity && lastActivity < yesterdayStart) {
            currentStreak = 0;
            // Update in database
            await streakCollection.updateOne(
                { userId },
                { $set: { currentStreak: 0 } }
            );
        }

        const todayCheckedIn = lastActivity && lastActivity.getTime() === today.getTime();

        res.json({
            currentStreak,
            longestStreak: streakData.longestStreak || 0,
            lastActivityDate: streakData.lastActivityDate,
            todayCheckedIn,
            activityHistory: streakData.activityDates?.slice(-30) || [] // Last 30 days
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/users/streak/checkin
 * Record daily activity (called on login/app visit)
 */
router.post('/streak/checkin', authGuard, async (req, res, next) => {
    try {
        await connectToDatabase();

        const userId = req.user.id;
        const streakCollection = getCollection('user_streaks');

        const today = getVietnamStartOfDay();
        const oneDayMs = 24 * 60 * 60 * 1000;
        const now = new Date();
        const yesterdayStart = new Date(today.getTime() - oneDayMs);
        const tomorrowStart = new Date(today.getTime() + oneDayMs);
        const ninetyDaysAgo = new Date(now.getTime() - 90 * oneDayMs);

        // Atomic, idempotent check-in (safe under concurrent requests)
        const updatePipeline = [
            {
                $set: {
                    userId,
                    createdAt: { $ifNull: ['$createdAt', now] },
                    currentStreak: { $ifNull: ['$currentStreak', 0] },
                    longestStreak: { $ifNull: ['$longestStreak', 0] },
                    activityDates: { $ifNull: ['$activityDates', []] },
                    lastActivityDate: { $ifNull: ['$lastActivityDate', null] },
                    updatedAt: { $ifNull: ['$updatedAt', now] }
                }
            },
            {
                $set: {
                    _already: {
                        $and: [
                            { $ne: ['$lastActivityDate', null] },
                            { $gte: ['$lastActivityDate', today] },
                            { $lt: ['$lastActivityDate', tomorrowStart] }
                        ]
                    },
                    _isConsecutive: {
                        $and: [
                            { $ne: ['$lastActivityDate', null] },
                            { $gte: ['$lastActivityDate', yesterdayStart] },
                            { $lt: ['$lastActivityDate', today] }
                        ]
                    }
                }
            },
            {
                $set: {
                    _newStreak: {
                        $cond: [
                            '$_already',
                            '$currentStreak',
                            { $cond: ['$_isConsecutive', { $add: ['$currentStreak', 1] }, 1] }
                        ]
                    }
                }
            },
            {
                $set: {
                    currentStreak: '$_newStreak',
                    longestStreak: { $max: ['$longestStreak', '$_newStreak'] },
                    lastActivityDate: { $cond: ['$_already', '$lastActivityDate', now] },
                    updatedAt: { $cond: ['$_already', '$updatedAt', now] },
                    activityDates: {
                        $cond: [
                            '$_already',
                            '$activityDates',
                            {
                                $let: {
                                    vars: {
                                        combined: { $concatArrays: ['$activityDates', [now]] }
                                    },
                                    in: {
                                        $filter: {
                                            input: '$$combined',
                                            as: 'd',
                                            cond: { $gte: ['$$d', ninetyDaysAgo] }
                                        }
                                    }
                                }
                            }
                        ]
                    }
                }
            },
            { $unset: ['_already', '_isConsecutive', '_newStreak'] }
        ];

        let beforeDoc;
        try {
            const result = await streakCollection.findOneAndUpdate(
                { userId },
                updatePipeline,
                { upsert: true, returnDocument: 'before' }
            );
            beforeDoc = result?.value ?? null;
        } catch (err) {
            // If two concurrent upserts race, one may lose with a duplicate key error; retry as a normal update.
            if (err?.code === 11000) {
                const result = await streakCollection.findOneAndUpdate(
                    { userId },
                    updatePipeline,
                    { upsert: false, returnDocument: 'before' }
                );
                beforeDoc = result?.value ?? null;
            } else {
                throw err;
            }
        }

        if (!beforeDoc) {
            return res.json({
                currentStreak: 1,
                longestStreak: 1,
                lastActivityDate: now,
                todayCheckedIn: true,
                isNewStreak: true,
                message: 'Chào mừng! Bạn đã bắt đầu chuỗi học tập.'
            });
        }

        const lastActivity = beforeDoc.lastActivityDate
            ? getVietnamStartOfDay(new Date(beforeDoc.lastActivityDate))
            : null;

        // Already checked in today
        if (lastActivity && lastActivity.getTime() === today.getTime()) {
            return res.json({
                currentStreak: beforeDoc.currentStreak || 0,
                longestStreak: beforeDoc.longestStreak || 0,
                lastActivityDate: beforeDoc.lastActivityDate,
                todayCheckedIn: true,
                isNewStreak: false,
                message: 'Bạn đã điểm danh hôm nay.'
            });
        }

        let newStreak;
        let message;
        if (lastActivity && lastActivity.getTime() === yesterdayStart.getTime()) {
            newStreak = (beforeDoc.currentStreak || 0) + 1;
            message = `Tuyệt vời! Chuỗi ${newStreak} ngày liên tiếp! 🔥`;
        } else {
            newStreak = 1;
            if ((beforeDoc.currentStreak || 0) > 1) {
                message = `Chuỗi đã bị gián đoạn. Hãy bắt đầu lại! 💪`;
            } else {
                message = 'Chào mừng trở lại! Hãy duy trì học tập mỗi ngày.';
            }
        }

        const newLongest = Math.max(beforeDoc.longestStreak || 0, newStreak);

        res.json({
            currentStreak: newStreak,
            longestStreak: newLongest,
            lastActivityDate: now,
            todayCheckedIn: true,
            isNewStreak: newStreak === 1 && (beforeDoc.currentStreak || 0) > 1,
            message
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/users/streak/leaderboard
 * Get streak leaderboard (top users by current streak)
 */
router.get('/streak/leaderboard', authGuard, async (req, res, next) => {
    try {
        await connectToDatabase();

        const limit = Math.min(parseInt(req.query.limit) || 10, 50);
        const streakCollection = getCollection('user_streaks');
        const usersCollection = getCollection('users');

        const today = getVietnamStartOfDay();
        const yesterdayStart = new Date(today.getTime() - 24 * 60 * 60 * 1000);

        // Get top streaks
        const topStreaks = await streakCollection
            .find({ currentStreak: { $gt: 0 }, lastActivityDate: { $gte: yesterdayStart } })
            .sort({ currentStreak: -1, longestStreak: -1 })
            .limit(limit)
            .toArray();

        if (topStreaks.length === 0) {
            return res.json({ leaderboard: [] });
        }

        // Get user info
        const userIds = topStreaks
            .map(s => {
                try {
                    return new ObjectId(s.userId);
                } catch {
                    return null;
                }
            })
            .filter(Boolean);
        const users = await usersCollection
            .find(
                { _id: { $in: userIds } },
                { projection: { name: 1, avatar: 1, privacy: 1 } }
            )
            .toArray();

        const userMap = new Map(users.map(u => [u._id.toString(), u]));

        const leaderboard = topStreaks.map((streak, index) => {
            const userIdStr = streak.userId?.toString?.() || '';
            const user = userMap.get(userIdStr);
            const showProfile = user?.privacy?.showProfile !== false;

            return {
                rank: index + 1,
                userId: userIdStr,
                name: showProfile ? (user?.name || 'Ẩn danh') : 'Ẩn danh',
                avatar: showProfile ? user?.avatar : null,
                currentStreak: streak.currentStreak,
                longestStreak: streak.longestStreak
            };
        });

        res.json({ leaderboard });
    } catch (error) {
        next(error);
    }
});

export default router;

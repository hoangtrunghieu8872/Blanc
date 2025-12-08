/**
 * MongoDB 7.0 Optimized Indexes Setup Script
 * 
 * Features:
 * - Compound indexes for complex queries
 * - TTL indexes for auto-cleanup
 * - Text indexes for search
 * - Partial indexes for sparse data
 * 
 * Run with: node server/scripts/setup-indexes.cjs
 */

require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');

const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME || 'blanc';

async function setupIndexes() {
    if (!uri) {
        console.error('❌ MONGODB_URI not set');
        process.exit(1);
    }

    // Note: Text indexes require strict: false
    const client = new MongoClient(uri, {
        serverApi: { version: ServerApiVersion.v1, strict: false, deprecationErrors: true }
    });

    try {
        await client.connect();
        const db = client.db(dbName);

        // Verify connection with ping (compatible with Stable API)
        await db.command({ ping: 1 });
        console.log(`✅ Connected to MongoDB (${dbName})`);

        console.log('🚀 Setting up MongoDB 7.0 optimized indexes...\n');

        // Helper function to safely create indexes (handles existing indexes)
        async function safeCreateIndexes(collection, indexes, collectionName) {
            let created = 0;
            let skipped = 0;

            for (const indexSpec of indexes) {
                try {
                    // Build options object - only include defined values
                    const options = { name: indexSpec.name };

                    if (indexSpec.unique) options.unique = true;
                    if (indexSpec.partialFilterExpression) {
                        options.partialFilterExpression = indexSpec.partialFilterExpression;
                    }
                    if (typeof indexSpec.expireAfterSeconds === 'number') {
                        options.expireAfterSeconds = indexSpec.expireAfterSeconds;
                    }

                    await collection.createIndex(indexSpec.key, options);
                    created++;
                } catch (err) {
                    if (err.code === 85 || err.code === 86) {
                        // Index already exists (85) or different options (86)
                        skipped++;
                    } else {
                        console.error(`    ⚠️ ${indexSpec.name}: ${err.message}`);
                    }
                }
            }

            console.log(`  ✅ ${created} created, ${skipped} already exist`);
        }

        // ============ USERS COLLECTION ============
        console.log('📦 Users collection...');
        const users = db.collection('users');

        await safeCreateIndexes(users, [
            // Unique email index
            { key: { email: 1 }, unique: true, name: 'idx_email_unique' },

            // Role + Status compound index (for admin filtering)
            { key: { role: 1, status: 1 }, name: 'idx_role_status' },

            // Search index (name + email)
            { key: { name: 'text', email: 'text' }, name: 'idx_search_text' },

            // Login tracking
            { key: { lastLoginAt: -1 }, name: 'idx_last_login' },

            // Points leaderboard
            { key: { points: -1 }, name: 'idx_points_desc' },

            // Created date for sorting
            { key: { createdAt: -1 }, name: 'idx_created' },

            // Locked accounts (partial index - only indexed when locked)
            {
                key: { lockedUntil: 1 },
                name: 'idx_locked_accounts',
                partialFilterExpression: { lockedUntil: { $exists: true } }
            },

            // Email verification status
            { key: { emailVerified: 1 }, name: 'idx_email_verified' },
        ], 'users');

        // ============ CONTESTS COLLECTION ============
        console.log('📦 Contests collection...');
        const contests = db.collection('contests');

        await safeCreateIndexes(contests, [
            // Status + Date compound (for active contests)
            { key: { status: 1, startDate: 1 }, name: 'idx_status_startdate' },

            // Tags for filtering
            { key: { tags: 1 }, name: 'idx_tags' },

            // Text search
            { key: { title: 'text', description: 'text' }, name: 'idx_contest_search' },

            // Date range queries
            { key: { startDate: 1, endDate: 1 }, name: 'idx_date_range' },

            // Featured contests
            {
                key: { featured: 1, startDate: -1 },
                name: 'idx_featured',
                partialFilterExpression: { featured: true }
            },
        ], 'contests');

        // ============ COURSES COLLECTION ============
        console.log('📦 Courses collection...');
        const courses = db.collection('courses');

        await safeCreateIndexes(courses, [
            // Level + Rating compound
            { key: { level: 1, rating: -1 }, name: 'idx_level_rating' },

            // Text search
            { key: { title: 'text', description: 'text' }, name: 'idx_course_search' },

            // Provider filtering
            { key: { provider: 1 }, name: 'idx_provider' },

            // Enrollment count (popular courses)
            { key: { enrollmentCount: -1 }, name: 'idx_popular' },
        ], 'courses');

        // ============ REGISTRATIONS COLLECTION ============
        console.log('📦 Registrations collection...');
        const registrations = db.collection('registrations');

        await safeCreateIndexes(registrations, [
            // User + Contest compound (unique registration)
            { key: { userId: 1, contestId: 1 }, unique: true, name: 'idx_user_contest_unique' },

            // User's registrations
            { key: { userId: 1, registeredAt: -1 }, name: 'idx_user_registrations' },

            // Contest participants
            { key: { contestId: 1, status: 1 }, name: 'idx_contest_participants' },

            // Date range for schedule
            { key: { 'contestDetails.startDate': 1 }, name: 'idx_schedule' },
        ], 'registrations');

        // ============ TEAM_POSTS COLLECTION ============
        console.log('📦 Team Posts collection...');
        const teamPosts = db.collection('team_posts');

        await safeCreateIndexes(teamPosts, [
            // Creator's posts
            { key: { 'createdBy.id': 1, createdAt: -1 }, name: 'idx_creator_posts' },

            // Status + Date (active posts)
            { key: { status: 1, createdAt: -1 }, name: 'idx_status_date' },

            // Contest-specific posts
            { key: { contestId: 1, status: 1 }, name: 'idx_contest_posts' },

            // Text search
            { key: { title: 'text', description: 'text' }, name: 'idx_team_search' },

            // Roles needed (for matching)
            { key: { 'rolesNeeded.name': 1 }, name: 'idx_roles_needed' },

            // Expiration (for cleanup)
            { key: { expiresAt: 1 }, name: 'idx_expires' },

            // Deleted posts (partial)
            {
                key: { deletedAt: 1 },
                name: 'idx_deleted',
                partialFilterExpression: { deletedAt: { $exists: true } }
            },
        ], 'team_posts');

        // ============ NOTIFICATIONS COLLECTION ============
        console.log('📦 Notifications collection...');
        const notifications = db.collection('notifications');

        await safeCreateIndexes(notifications, [
            // User's notifications
            { key: { userId: 1, read: 1, createdAt: -1 }, name: 'idx_user_notifications' },

            // TTL - Auto delete after 90 days
            { key: { createdAt: 1 }, expireAfterSeconds: 90 * 24 * 60 * 60, name: 'idx_ttl_90days' },

            // Type filtering
            { key: { type: 1, createdAt: -1 }, name: 'idx_type_date' },
        ], 'notifications');

        // ============ AUDIT_LOGS COLLECTION ============
        console.log('📦 Audit Logs collection...');
        const auditLogs = db.collection('audit_logs');

        await safeCreateIndexes(auditLogs, [
            // Time-based queries
            { key: { timestamp: -1 }, name: 'idx_timestamp' },

            // Action + Status compound
            { key: { action: 1, status: 1, timestamp: -1 }, name: 'idx_action_status' },

            // User audit trail
            { key: { userId: 1, timestamp: -1 }, name: 'idx_user_audit' },

            // IP-based queries (security)
            { key: { ip: 1, timestamp: -1 }, name: 'idx_ip_audit' },

            // TTL - Auto delete after 1 year
            { key: { timestamp: 1 }, expireAfterSeconds: 365 * 24 * 60 * 60, name: 'idx_ttl_1year' },

            // Text search
            { key: { action: 'text', details: 'text', userEmail: 'text' }, name: 'idx_audit_search' },
        ], 'audit_logs');

        // ============ LOGIN_ATTEMPTS COLLECTION ============
        console.log('📦 Login Attempts collection...');
        const loginAttempts = db.collection('login_attempts');

        await safeCreateIndexes(loginAttempts, [
            // IP-based rate limiting
            { key: { ip: 1, createdAt: -1 }, name: 'idx_ip_attempts' },

            // Email-based tracking
            { key: { email: 1, success: 1, createdAt: -1 }, name: 'idx_email_attempts' },

            // TTL - Auto delete after 7 days
            { key: { createdAt: 1 }, expireAfterSeconds: 7 * 24 * 60 * 60, name: 'idx_ttl_7days' },

            // Security analysis
            { key: { success: 1, createdAt: -1 }, name: 'idx_success_time' },
        ], 'login_attempts');

        // ============ BLOCKED_IPS COLLECTION ============
        console.log('📦 Blocked IPs collection...');
        const blockedIPs = db.collection('blocked_ips');

        await safeCreateIndexes(blockedIPs, [
            // IP lookup
            { key: { ip: 1 }, unique: true, name: 'idx_ip_unique' },

            // TTL - Auto unblock based on expiresAt
            { key: { expiresAt: 1 }, expireAfterSeconds: 0, name: 'idx_ttl_expires' },
        ], 'blocked_ips');

        // ============ USER_STREAKS COLLECTION ============
        console.log('📦 User Streaks collection...');
        const userStreaks = db.collection('user_streaks');

        await safeCreateIndexes(userStreaks, [
            // User lookup
            { key: { userId: 1 }, unique: true, name: 'idx_user_streak' },

            // Leaderboard
            { key: { currentStreak: -1 }, name: 'idx_streak_leaderboard' },

            // Last activity
            { key: { lastActivityDate: -1 }, name: 'idx_last_activity' },
        ], 'user_streaks');

        // ============ COURSE_ENROLLMENTS COLLECTION ============
        console.log('📦 Course Enrollments collection...');
        const enrollments = db.collection('course_enrollments');

        await safeCreateIndexes(enrollments, [
            // User + Course unique
            { key: { userId: 1, courseId: 1 }, unique: true, name: 'idx_user_course_unique' },

            // User's courses
            { key: { userId: 1, status: 1, enrolledAt: -1 }, name: 'idx_user_enrollments' },

            // Course students
            { key: { courseId: 1, status: 1 }, name: 'idx_course_students' },

            // Progress tracking
            { key: { userId: 1, progress: -1 }, name: 'idx_user_progress' },
        ], 'course_enrollments');

        // ============ REVIEWS COLLECTION ============
        console.log('📦 Reviews collection...');
        const reviews = db.collection('reviews');

        await safeCreateIndexes(reviews, [
            // User + Target unique (one review per user per target)
            { key: { userId: 1, targetType: 1, targetId: 1 }, unique: true, name: 'idx_user_target_unique' },

            // Target's reviews (sorted by newest)
            { key: { targetType: 1, targetId: 1, createdAt: -1 }, name: 'idx_target_reviews' },

            // User's reviews
            { key: { userId: 1, createdAt: -1 }, name: 'idx_user_reviews' },

            // Rating distribution queries
            { key: { targetType: 1, targetId: 1, rating: 1 }, name: 'idx_target_ratings' },

            // Helpful votes sorting
            { key: { targetType: 1, targetId: 1, helpfulCount: -1, createdAt: -1 }, name: 'idx_helpful_sort' },

            // Text search on comments
            { key: { comment: 'text' }, name: 'idx_review_search' },
        ], 'reviews');

        // ============ REPORTS COLLECTION ============
        console.log('📦 Reports collection...');
        const reports = db.collection('reports');

        await safeCreateIndexes(reports, [
            // User's reports (primary query - sorted by newest)
            { key: { userId: 1, updatedAt: -1 }, name: 'idx_user_reports' },

            // User + Status filter (for filtering by draft/sent/ready)
            { key: { userId: 1, status: 1, updatedAt: -1 }, name: 'idx_user_status' },

            // User + Template filter (for filtering by template type)
            { key: { userId: 1, template: 1, updatedAt: -1 }, name: 'idx_user_template' },

            // Text search on title and content
            { key: { title: 'text', content: 'text' }, name: 'idx_report_search' },

            // Created date for sorting
            { key: { createdAt: -1 }, name: 'idx_created' },

            // Updated date for sorting (most common)
            { key: { updatedAt: -1 }, name: 'idx_updated' },
        ], 'reports');

        // ============ SUMMARY ============
        console.log('\n' + '='.repeat(50));
        console.log('✅ All indexes created successfully!');
        console.log('='.repeat(50));

        // List all indexes
        console.log('\n📊 Index Summary:');
        const collections = ['users', 'contests', 'courses', 'registrations', 'team_posts',
            'notifications', 'audit_logs', 'login_attempts', 'blocked_ips',
            'user_streaks', 'course_enrollments', 'reviews', 'reports'];

        for (const collName of collections) {
            const coll = db.collection(collName);
            const indexes = await coll.indexes();
            console.log(`  ${collName}: ${indexes.length} indexes`);
        }

        console.log('\n🎉 MongoDB 7.0 optimization complete!');

    } catch (error) {
        console.error('❌ Error setting up indexes:', error);
        process.exit(1);
    } finally {
        await client.close();
    }
}

setupIndexes();

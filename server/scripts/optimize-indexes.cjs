#!/usr/bin/env node

/**
 * Database Index Optimization Script
 * 
 * Creates all necessary indexes for performance optimization
 * Runs after schema changes or as part of deployment
 * 
 * Usage: node server/scripts/optimize-indexes.cjs
 */

import 'dotenv/config';
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI not configured');
    process.exit(1);
}

let client;

async function connect() {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('✅ Connected to MongoDB');
    return client.db();
}

async function createIndex(collection, spec, options = {}) {
    try {
        const result = await collection.createIndex(spec, options);
        console.log(`  ✅ Index created: ${result}`);
        return true;
    } catch (error) {
        if (error.code === 85) {
            // Index already exists
            console.log(`  ℹ️  Index already exists`);
            return true;
        }
        console.error(`  ❌ Error: ${error.message}`);
        return false;
    }
}

async function optimizeIndexes(db) {
    console.log('\n🔧 Optimizing database indexes...\n');

    const results = {
        success: 0,
        failed: 0,
    };

    // ============================================================================
    // Users collection indexes
    // ============================================================================
    console.log('📋 Users collection:');
    const users = db.collection('users');

    if (await createIndex(users, { email: 1 }, { unique: true })) results.success++;
    else results.failed++;

    if (await createIndex(users, { username: 1 }, { unique: true })) results.success++;
    else results.failed++;

    if (await createIndex(users, { role: 1 })) results.success++;
    else results.failed++;

    if (await createIndex(users, { createdAt: -1 })) results.success++;
    else results.failed++;

    if (await createIndex(users, { email: 'text', username: 'text' }, { name: 'idx_users_search' }))
        results.success++;
    else results.failed++;

    // ============================================================================
    // Contests collection indexes
    // ============================================================================
    console.log('\n📋 Contests collection:');
    const contests = db.collection('contests');

    if (await createIndex(contests, { status: 1, dateStart: -1 }, { name: 'idx_contests_status_date' }))
        results.success++;
    else results.failed++;

    if (await createIndex(contests, { deadline: 1 }, { name: 'idx_contests_deadline' }))
        results.success++;
    else results.failed++;

    if (
        await createIndex(
            contests,
            { title: 'text', description: 'text', tags: 'text' },
            { name: 'idx_contests_search' }
        )
    )
        results.success++;
    else results.failed++;

    if (
        await createIndex(contests, { createdAt: -1 }, { name: 'idx_contests_created' })
    )
        results.success++;
    else results.failed++;

    if (
        await createIndex(contests, { category: 1, status: 1 }, { name: 'idx_contests_category_status' })
    )
        results.success++;
    else results.failed++;

    // ============================================================================
    // Courses collection indexes
    // ============================================================================
    console.log('\n📋 Courses collection:');
    const courses = db.collection('courses');

    if (await createIndex(courses, { title: 'text', description: 'text' }, { name: 'idx_courses_search' }))
        results.success++;
    else results.failed++;

    if (await createIndex(courses, { status: 1, createdAt: -1 }, { name: 'idx_courses_status' }))
        results.success++;
    else results.failed++;

    if (await createIndex(courses, { instructorId: 1 })) results.success++;
    else results.failed++;

    // ============================================================================
    // Reports collection indexes
    // ============================================================================
    console.log('\n📋 Reports collection:');
    const reports = db.collection('reports');

    if (await createIndex(reports, { userId: 1, status: 1 }, { name: 'idx_reports_user_status' }))
        results.success++;
    else results.failed++;

    if (await createIndex(reports, { status: 1, createdAt: -1 }, { name: 'idx_reports_status_date' }))
        results.success++;
    else results.failed++;

    if (await createIndex(reports, { contestId: 1 }, { name: 'idx_reports_contest' })) results.success++;
    else results.failed++;

    if (
        await createIndex(
            reports,
            { title: 'text', description: 'text' },
            { name: 'idx_reports_search' }
        )
    )
        results.success++;
    else results.failed++;

    // ============================================================================
    // Enrollments collection indexes
    // ============================================================================
    console.log('\n📋 Enrollments collection:');
    const enrollments = db.collection('enrollments');

    if (
        await createIndex(
            enrollments,
            { userId: 1, courseId: 1 },
            { unique: true, name: 'idx_enrollments_user_course' }
        )
    )
        results.success++;
    else results.failed++;

    if (await createIndex(enrollments, { userId: 1 }, { name: 'idx_enrollments_user' }))
        results.success++;
    else results.failed++;

    if (await createIndex(enrollments, { courseId: 1 }, { name: 'idx_enrollments_course' }))
        results.success++;
    else results.failed++;

    if (await createIndex(enrollments, { status: 1, createdAt: -1 }, { name: 'idx_enrollments_status' }))
        results.success++;
    else results.failed++;

    // ============================================================================
    // Team Posts collection indexes
    // ============================================================================
    console.log('\n📋 Team Posts collection:');
    const teamPosts = db.collection('team_posts');

    if (await createIndex(teamPosts, { contestId: 1, status: 1 }, { name: 'idx_team_posts_contest' }))
        results.success++;
    else results.failed++;

    if (await createIndex(teamPosts, { userId: 1 }, { name: 'idx_team_posts_user' }))
        results.success++;
    else results.failed++;

    if (
        await createIndex(
            teamPosts,
            { expiresAt: 1 },
            { expireAfterSeconds: 0, name: 'idx_team_posts_expire' }
        )
    )
        results.success++;
    else results.failed++;

    if (
        await createIndex(
            teamPosts,
            { title: 'text', description: 'text' },
            { name: 'idx_team_posts_search' }
        )
    )
        results.success++;
    else results.failed++;

    // ============================================================================
    // Chat Messages collection indexes
    // ============================================================================
    console.log('\n📋 Chat Messages collection:');
    const chatMessages = db.collection('chat_messages');

    if (await createIndex(chatMessages, { chatId: 1, createdAt: -1 }, { name: 'idx_chat_messages' }))
        results.success++;
    else results.failed++;

    if (
        await createIndex(
            chatMessages,
            { createdAt: 1 },
            { expireAfterSeconds: 7776000, name: 'idx_chat_messages_ttl' }
        )
    )
        results.success++;
    else results.failed++;

    // ============================================================================
    // Audit Logs collection indexes
    // ============================================================================
    console.log('\n📋 Audit Logs collection:');
    const auditLogs = db.collection('audit_logs');

    if (await createIndex(auditLogs, { userId: 1, timestamp: -1 }, { name: 'idx_audit_user_date' }))
        results.success++;
    else results.failed++;

    if (await createIndex(auditLogs, { action: 1, timestamp: -1 }, { name: 'idx_audit_action_date' }))
        results.success++;
    else results.failed++;

    if (
        await createIndex(
            auditLogs,
            { timestamp: 1 },
            { expireAfterSeconds: 7776000, name: 'idx_audit_logs_ttl' }
        )
    )
        results.success++;
    else results.failed++;

    // ============================================================================
    // Notifications collection indexes
    // ============================================================================
    console.log('\n📋 Notifications collection:');
    const notifications = db.collection('notifications');

    if (
        await createIndex(
            notifications,
            { userId: 1, createdAt: -1 },
            { name: 'idx_notifications_user' }
        )
    )
        results.success++;
    else results.failed++;

    if (
        await createIndex(
            notifications,
            { userId: 1, read: 1 },
            { name: 'idx_notifications_unread' }
        )
    )
        results.success++;
    else results.failed++;

    // ============================================================================
    // Sessions collection indexes (TTL)
    // ============================================================================
    console.log('\n📋 Sessions collection:');
    const sessions = db.collection('sessions');

    if (
        await createIndex(
            sessions,
            { createdAt: 1 },
            { expireAfterSeconds: 86400, name: 'idx_sessions_ttl' }
        )
    )
        results.success++;
    else results.failed++;

    if (await createIndex(sessions, { userId: 1 }, { name: 'idx_sessions_user' })) results.success++;
    else results.failed++;

    // ============================================================================
    // Summary
    // ============================================================================
    console.log('\n' + '='.repeat(60));
    console.log(`✅ Successfully created ${results.success} indexes`);
    if (results.failed > 0) {
        console.log(`⚠️  ${results.failed} index creations had issues`);
    }
    console.log('='.repeat(60));
}

async function main() {
    try {
        const db = await connect();
        await optimizeIndexes(db);
        process.exit(0);
    } catch (error) {
        console.error('❌ Fatal error:', error.message);
        process.exit(1);
    } finally {
        if (client) {
            await client.close();
        }
    }
}

main();

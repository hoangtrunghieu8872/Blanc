#!/usr/bin/env node

/**
 * Data Consistency Verification Script
 * 
 * Verifies the integrity of data in the database
 * - Orphaned records (no parent)
 * - Missing references (broken foreign keys)
 * - Status inconsistencies
 * - Duplicate entries
 * 
 * Usage: node server/scripts/verify-data.cjs
 */

import 'dotenv/config';
import { MongoClient, ObjectId } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI not configured in .env');
    process.exit(1);
}

let client;
let db;

async function connect() {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db();
    console.log('✅ Connected to MongoDB');
}

async function disconnect() {
    if (client) {
        await client.close();
        console.log('✅ Disconnected from MongoDB');
    }
}

const Issues = {
    ORPHANED_ENROLLMENTS: 'orphaned_enrollments',
    ORPHANED_TEAM_POSTS: 'orphaned_team_posts',
    ORPHANED_CONTEST_REGISTRATIONS: 'orphaned_contest_registrations',
    INVALID_USER_REFERENCES: 'invalid_user_references',
    DUPLICATE_ENROLLMENTS: 'duplicate_enrollments',
    INCONSISTENT_REPORT_STATUS: 'inconsistent_report_status',
    EXPIRED_TEAM_POSTS: 'expired_team_posts',
    STATUS_MISMATCH: 'status_mismatch',
};

async function verifyOrphanedEnrollments() {
    console.log('\n📋 Checking for orphaned course enrollments...');
    const enrollments = db.collection('enrollments');
    const courses = db.collection('courses');

    const allEnrollments = await enrollments.find().toArray();
    const courseIds = [...new Set(allEnrollments.map((e) => e.courseId).filter(Boolean))];

    const foundCourses = await courses
        .find({ _id: { $in: courseIds.map((id) => new ObjectId(id)) } })
        .toArray();

    const orphaned = courseIds.filter(
        (cid) => !foundCourses.find((c) => c._id.toString() === cid.toString())
    );

    if (orphaned.length > 0) {
        console.log(`⚠️  Found ${orphaned.length} orphaned enrollments:`);
        orphaned.slice(0, 5).forEach((cid) => console.log(`   - Course ID: ${cid}`));
        return { issue: Issues.ORPHANED_ENROLLMENTS, count: orphaned.length, data: orphaned };
    }

    console.log('✅ No orphaned enrollments found');
    return null;
}

async function verifyOrphanedTeamPosts() {
    console.log('\n📋 Checking for orphaned team posts...');
    const teamPosts = db.collection('team_posts');
    const contests = db.collection('contests');

    const allPosts = await teamPosts.find().toArray();
    const contestIds = [...new Set(allPosts.map((p) => p.contestId).filter(Boolean))];

    const foundContests = await contests
        .find({ _id: { $in: contestIds.map((id) => new ObjectId(id)) } })
        .toArray();

    const orphaned = contestIds.filter(
        (cid) => !foundContests.find((c) => c._id.toString() === cid.toString())
    );

    if (orphaned.length > 0) {
        console.log(`⚠️  Found ${orphaned.length} team posts with missing contest references:`);
        orphaned.slice(0, 5).forEach((cid) => console.log(`   - Contest ID: ${cid}`));
        return { issue: Issues.ORPHANED_TEAM_POSTS, count: orphaned.length, data: orphaned };
    }

    console.log('✅ No orphaned team posts found');
    return null;
}

async function verifyInvalidUserReferences() {
    console.log('\n📋 Checking for invalid user references...');
    const users = db.collection('users');
    const enrollments = db.collection('enrollments');

    const allEnrollments = await enrollments.find().toArray();
    const userIds = [...new Set(allEnrollments.map((e) => e.userId).filter(Boolean))];

    const foundUsers = await users
        .find({ _id: { $in: userIds.map((id) => new ObjectId(id)) } })
        .toArray();

    const invalid = userIds.filter(
        (uid) => !foundUsers.find((u) => u._id.toString() === uid.toString())
    );

    if (invalid.length > 0) {
        console.log(`⚠️  Found ${invalid.length} enrollments with invalid user references:`);
        invalid.slice(0, 5).forEach((uid) => console.log(`   - User ID: ${uid}`));
        return { issue: Issues.INVALID_USER_REFERENCES, count: invalid.length, data: invalid };
    }

    console.log('✅ No invalid user references found');
    return null;
}

async function verifyDuplicateEnrollments() {
    console.log('\n📋 Checking for duplicate enrollments...');
    const enrollments = db.collection('enrollments');

    const duplicates = await enrollments
        .aggregate([
            {
                $group: {
                    _id: { userId: '$userId', courseId: '$courseId' },
                    count: { $sum: 1 },
                },
            },
            { $match: { count: { $gt: 1 } } },
        ])
        .toArray();

    if (duplicates.length > 0) {
        console.log(`⚠️  Found ${duplicates.length} duplicate enrollment combinations:`);
        duplicates.slice(0, 5).forEach((dup) => {
            console.log(`   - User: ${dup._id.userId}, Course: ${dup._id.courseId} (${dup.count} times)`);
        });
        return { issue: Issues.DUPLICATE_ENROLLMENTS, count: duplicates.length, data: duplicates };
    }

    console.log('✅ No duplicate enrollments found');
    return null;
}

async function verifyReportConsistency() {
    console.log('\n📋 Checking report status consistency...');
    const reports = db.collection('reports');

    // Check for reports with invalid status
    const invalidStatuses = await reports
        .find({
            status: { $nin: ['draft', 'submitted', 'in_review', 'approved', 'rejected'] },
        })
        .toArray();

    if (invalidStatuses.length > 0) {
        console.log(`⚠️  Found ${invalidStatuses.length} reports with invalid status:`);
        invalidStatuses.slice(0, 5).forEach((r) => {
            console.log(`   - Report ${r._id}: status="${r.status}"`);
        });
        return { issue: Issues.INCONSISTENT_REPORT_STATUS, count: invalidStatuses.length };
    }

    console.log('✅ All reports have valid status');
    return null;
}

async function verifyExpiredTeamPosts() {
    console.log('\n📋 Checking for expired team posts...');
    const teamPosts = db.collection('team_posts');

    const now = new Date();
    const expired = await teamPosts
        .find({
            expiresAt: { $lt: now },
            status: { $ne: 'closed' },
        })
        .toArray();

    if (expired.length > 0) {
        console.log(`⚠️  Found ${expired.length} team posts that should be closed but aren't:`);
        expired.slice(0, 5).forEach((p) => {
            console.log(`   - Post ${p._id}: expired at ${p.expiresAt.toISOString()}`);
        });
        return { issue: Issues.EXPIRED_TEAM_POSTS, count: expired.length, data: expired };
    }

    console.log('✅ No improperly expired team posts found');
    return null;
}

async function main() {
    try {
        await connect();

        console.log('\n🔍 Starting data consistency verification...\n');

        const results = [];

        // Run all verification checks
        let result = await verifyOrphanedEnrollments();
        if (result) results.push(result);

        result = await verifyOrphanedTeamPosts();
        if (result) results.push(result);

        result = await verifyInvalidUserReferences();
        if (result) results.push(result);

        result = await verifyDuplicateEnrollments();
        if (result) results.push(result);

        result = await verifyReportConsistency();
        if (result) results.push(result);

        result = await verifyExpiredTeamPosts();
        if (result) results.push(result);

        // Summary
        console.log('\n' + '='.repeat(60));
        if (results.length === 0) {
            console.log('✅ All data consistency checks passed!');
        } else {
            console.log(`⚠️  Found ${results.length} consistency issues:`);
            results.forEach((r) => {
                console.log(`   - ${r.issue}: ${r.count} issues`);
            });
        }
        console.log('='.repeat(60));

        process.exit(results.length === 0 ? 0 : 1);
    } catch (error) {
        console.error('❌ Verification failed:', error.message);
        process.exit(1);
    } finally {
        await disconnect();
    }
}

main();

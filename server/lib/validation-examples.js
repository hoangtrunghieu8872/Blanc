/**
 * Example: How to use unified validation and pagination in routes
 * 
 * This file demonstrates best practices for:
 * 1. Using validation utilities across endpoints
 * 2. Applying consistent pagination
 * 3. Proper error responses
 * 4. Query optimization
 */

import { Router } from 'express';
import { authGuard, requireRole } from '../middleware/auth.js';
import {
    validateReportTitle,
    validateReportDescription,
    validateReportData,
    validateEmail,
} from '../lib/validation.js';
import { normalizePagination, createPaginatedResponse } from '../lib/pagination.js';
import { getClientIp } from '../lib/security.js';

const router = Router();

/**
 * Example 1: Simple field validation
 * 
 * POST /api/reports
 * {
 *   "title": "My Report",
 *   "description": "...",
 *   "activities": [...]
 * }
 */
router.post('/reports', authGuard, async (req, res) => {
    try {
        const { title, description, activities } = req.body;

        // Step 1: Validate individual fields
        const titleValidation = validateReportTitle(title);
        if (!titleValidation.isValid) {
            return res.status(400).json({ error: titleValidation.error });
        }

        const descValidation = validateReportDescription(description);
        if (!descValidation.isValid) {
            return res.status(400).json({ error: descValidation.error });
        }

        // Step 2: Validate entire object
        const reportValidation = validateReportData({ title, description, activities });
        if (!reportValidation.isValid) {
            return res.status(400).json({ errors: reportValidation.errors });
        }

        // Step 3: Proceed with database operation
        const reportsCol = db.collection('reports');
        const result = await reportsCol.insertOne({
            userId: req.user.id,
            title,
            description,
            activities,
            status: 'draft',
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        // Log the action
        console.log(`[Report] Created report ${result.insertedId} by user ${req.user.id}`);

        return res.status(201).json({
            id: result.insertedId,
            message: 'Report created successfully',
        });
    } catch (error) {
        console.error('[Report] Creation error:', error.message);
        return res.status(500).json({ error: 'Failed to create report' });
    }
});

/**
 * Example 2: Pagination with filtering
 * 
 * GET /api/reports?page=1&limit=20&status=draft&sort=-createdAt
 */
router.get('/reports', authGuard, async (req, res) => {
    try {
        // Step 1: Normalize pagination
        const pagination = normalizePagination(req.query.page, req.query.limit, 'REPORTS');

        // Step 2: Build filter
        const filter = { userId: req.user.id };

        if (req.query.status) {
            const validStatuses = ['draft', 'submitted', 'in_review', 'approved', 'rejected'];
            if (validStatuses.includes(req.query.status)) {
                filter.status = req.query.status;
            }
        }

        // Step 3: Query with pagination
        const reportsCol = db.collection('reports');

        const [total, items] = await Promise.all([
            reportsCol.countDocuments(filter),
            reportsCol
                .find(filter)
                .sort({ createdAt: -1 })
                .skip(pagination.skip)
                .limit(pagination.limit)
                .toArray(),
        ]);

        // Step 4: Return paginated response
        return res.json(
            createPaginatedResponse(items, pagination.page, pagination.limit, total)
        );
    } catch (error) {
        console.error('[Report] Fetch error:', error.message);
        return res.status(500).json({ error: 'Failed to fetch reports' });
    }
});

/**
 * Example 3: Admin endpoint with role checking and pagination
 * 
 * GET /api/admin/users?page=1&limit=20&role=student
 */
router.get('/admin/users', authGuard, requireRole('admin'), async (req, res) => {
    try {
        const clientIp = getClientIp(req);
        const pagination = normalizePagination(req.query.page, req.query.limit, 'USERS');

        const filter = {};
        if (req.query.role) {
            filter.role = req.query.role;
        }

        const usersCol = db.collection('users');

        const [total, items] = await Promise.all([
            usersCol.countDocuments(filter),
            usersCol
                .find(filter)
                .select({ passwordHash: 0 }) // Don't return sensitive data
                .skip(pagination.skip)
                .limit(pagination.limit)
                .toArray(),
        ]);

        // Log admin action
        console.log(`[Admin] User listing by ${req.user.id} from ${clientIp}`);

        return res.json(
            createPaginatedResponse(items, pagination.page, pagination.limit, total)
        );
    } catch (error) {
        console.error('[Admin] User fetch error:', error.message);
        return res.status(500).json({ error: 'Failed to fetch users' });
    }
});

/**
 * Example 4: Email validation
 * 
 * POST /api/auth/invite
 * { "email": "user@example.com" }
 */
router.post('/auth/invite', authGuard, requireRole('admin'), async (req, res) => {
    try {
        const { email } = req.body;

        // Validate email
        const emailValidation = validateEmail(email);
        if (!emailValidation.isValid) {
            return res.status(400).json({ error: emailValidation.error });
        }

        // Check if email already exists
        const usersCol = db.collection('users');
        const existing = await usersCol.findOne({ email });
        if (existing) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Create invite token and send email
        // ... (email sending code)

        return res.json({ message: 'Invitation sent' });
    } catch (error) {
        console.error('[Auth] Invite error:', error.message);
        return res.status(500).json({ error: 'Failed to send invitation' });
    }
});

export default router;

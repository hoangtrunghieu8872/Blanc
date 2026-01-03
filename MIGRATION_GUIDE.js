#!/usr/bin/env node

/**
 * MIGRATION GUIDE: How to apply security improvements to existing routes
 * 
 * This guide shows step-by-step how to update each route file to use:
 * 1. Unified validation from server/lib/validation.js
 * 2. Consistent pagination from server/lib/pagination.js
 * 3. Enhanced rate limiting from server/lib/security.js
 * 4. Better error handling and logging
 */

// ============================================================================
// STEP 1: Import the new utilities at the top of each route file
// ============================================================================

// Add these imports to server/routes/reports.js:
/**
import { Router } from 'express';
import { authGuard, requireRole } from '../middleware/auth.js';
import { getClientIp } from '../lib/security.js';
import {
  validateReportTitle,
  validateReportDescription,
  validateReportData,
} from '../lib/validation.js';
import {
  normalizePagination,
  createPaginatedResponse,
  parseSortParam,
} from '../lib/pagination.js';

const router = Router();
*/

// ============================================================================
// STEP 2: Update POST endpoints to validate input
// ============================================================================

// BEFORE (server/routes/reports.js - example):
/**
router.post('/', authGuard, async (req, res) => {
  try {
    const { title, description, activities } = req.body;
    
    // ❌ No validation - accepts invalid data
    const report = await reportsCol.insertOne({
      title,
      description,
      activities,
      userId: req.user.id,
      status: 'draft',
      createdAt: new Date(),
    });
    
    res.status(201).json(report);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create report' });
  }
});
*/

// AFTER - with validation:
/**
router.post('/', authGuard, async (req, res) => {
  try {
    const { title, description, activities } = req.body;
    const clientIp = getClientIp(req);
    
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

    // Step 3: Safe to create
    const reportsCol = db.collection('reports');
    const result = await reportsCol.insertOne({
      title: title.trim(),
      description: description.trim(),
      activities: activities || [],
      userId: req.user.id,
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log(`[Reports] Created report ${result.insertedId} by ${req.user.id}`);

    res.status(201).json({
      id: result.insertedId,
      message: 'Report created successfully',
    });
  } catch (error) {
    console.error('[Reports] Creation error:', error.message);
    res.status(500).json({ error: 'Failed to create report' });
  }
});
*/

// ============================================================================
// STEP 3: Update GET endpoints to use pagination
// ============================================================================

// BEFORE (server/routes/reports.js - example):
/**
router.get('/', authGuard, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    
    // ❌ Problems:
    // - No limit enforcement (user could ask for 1 million items)
    // - No sorting standardization
    // - No total count for pagination info
    
    const items = await reportsCol
      .find({ userId: req.user.id })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    res.json({ items });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});
*/

// AFTER - with pagination:
/**
router.get('/', authGuard, async (req, res) => {
  try {
    // Step 1: Normalize pagination parameters
    const pagination = normalizePagination(req.query.page, req.query.limit, 'REPORTS');

    // Step 2: Build query filter
    const filter = { userId: req.user.id };
    
    // Optional: filter by status
    if (req.query.status) {
      const validStatuses = ['draft', 'submitted', 'in_review', 'approved', 'rejected'];
      if (validStatuses.includes(req.query.status)) {
        filter.status = req.query.status;
      }
    }

    // Step 3: Execute both queries in parallel
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

    // Step 4: Return standardized paginated response
    res.json(
      createPaginatedResponse(items, pagination.page, pagination.limit, total)
    );
  } catch (error) {
    console.error('[Reports] Fetch error:', error.message);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});
*/

// ============================================================================
// STEP 4: Update admin endpoints with requireRole middleware
// ============================================================================

// BEFORE (server/routes/admin.js - example):
/**
router.get('/users', authGuard, async (req, res) => {
  // ❌ Not checking if user is actually admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  const users = await usersCol.find().toArray();
  res.json({ users });
});
*/

// AFTER - with proper middleware:
/**
import { requireAdmin } from '../middleware/auth.js';

router.get('/users', authGuard, requireAdmin(), async (req, res) => {
  try {
    const pagination = normalizePagination(req.query.page, req.query.limit, 'USERS');
    const clientIp = getClientIp(req);
    
    // Create filter based on query params
    const filter = {};
    if (req.query.role) {
      const validRoles = ['student', 'mentor', 'admin', 'super_admin'];
      if (validRoles.includes(req.query.role)) {
        filter.role = req.query.role;
      }
    }

    // Execute queries
    const usersCol = db.collection('users');
    const [total, items] = await Promise.all([
      usersCol.countDocuments(filter),
      usersCol
        .find(filter)
        .select({ passwordHash: 0, otp: 0 }) // Don't expose sensitive data
        .skip(pagination.skip)
        .limit(pagination.limit)
        .toArray(),
    ]);

    // Log admin action
    console.log(`[Admin] Listed users by ${req.user.id} from ${clientIp}`);

    res.json(createPaginatedResponse(items, pagination.page, pagination.limit, total));
  } catch (error) {
    console.error('[Admin] Fetch error:', error.message);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});
*/

// ============================================================================
// STEP 5: Add comprehensive error handling
// ============================================================================

// IMPROVED error handling pattern for all routes:
/**
router.put('/:id', authGuard, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;
    const clientIp = getClientIp(req);

    // Validate input
    const titleValidation = validateReportTitle(title);
    if (!titleValidation.isValid) {
      return res.status(400).json({ error: titleValidation.error });
    }

    // Check ownership
    const reportsCol = db.collection('reports');
    const report = await reportsCol.findOne({ _id: new ObjectId(id) });
    
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    if (report.userId !== req.user.id && req.user.role !== 'admin') {
      console.warn(`[Auth] Unauthorized update attempt by ${req.user.id} from ${clientIp}`);
      return res.status(403).json({ error: 'You can only update your own reports' });
    }

    // Update
    const result = await reportsCol.updateOne(
      { _id: new ObjectId(id) },
      { $set: { title, description, updatedAt: new Date() } }
    );

    if (result.modifiedCount === 0) {
      return res.status(400).json({ error: 'Failed to update report' });
    }

    console.log(`[Reports] Updated report ${id} by ${req.user.id}`);
    res.json({ message: 'Report updated successfully' });

  } catch (error) {
    console.error('[Reports] Update error:', error.message);
    
    // Return appropriate error
    if (error.name === 'MongoServerError' && error.code === 11000) {
      return res.status(400).json({ error: 'This resource already exists' });
    }
    
    res.status(500).json({ error: 'Failed to update report' });
  }
});
*/

// ============================================================================
// STEP 6: Migration Priority Order
// ============================================================================

/**
Priority order for migration (highest impact first):

1. **HIGH** - server/routes/auth.js
   - Apply password validation
   - Add rate limiting via requireRole
   - Enhanced error logging

2. **HIGH** - server/routes/admin.js
   - Apply pagination to all list endpoints
   - Add requireAdmin middleware
   - Add detailed audit logging

3. **HIGH** - server/routes/reports.js
   - Apply validation to all fields
   - Add pagination to list endpoint
   - Add ownership checks

4. **MEDIUM** - server/routes/contests.js
   - Add pagination
   - Add text search validation
   - Add filter validation

5. **MEDIUM** - server/routes/courses.js
   - Add pagination
   - Add validation for fields
   - Add instructor ownership checks

6. **MEDIUM** - server/routes/teams.js
   - Add pagination
   - Add validation
   - Optimize queries

7. **LOW** - Other routes
   - Add pagination where applicable
   - Add input validation
   - Improve error handling
*/

// ============================================================================
// STEP 7: Testing after migration
// ============================================================================

/**
After updating each route file, run these tests:

// Test 1: Invalid input is rejected
curl -X POST http://localhost:4000/api/reports \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title": "Bad", "description": "x"}'

// Expected: 400 with specific error message

// Test 2: Pagination limits are enforced
curl http://localhost:4000/api/reports?limit=999999

// Expected: Max 50 items returned (enforced)

// Test 3: Admin access is restricted
curl http://localhost:4000/api/admin/users \
  -H "Authorization: Bearer $STUDENT_TOKEN"

// Expected: 403 Forbidden

// Test 4: Rate limiting works
for i in {1..10}; do
  curl -X POST http://localhost:4000/api/auth/login
done

// Expected: 6th+ requests get 429 Too Many Requests
*/

// ============================================================================
// UTILITY FUNCTIONS FOR COMMON PATTERNS
// ============================================================================

/**
// Pattern 1: Safe pagination fetch
async function getItemsWithPagination(collection, filter, pagination) {
  const [total, items] = await Promise.all([
    collection.countDocuments(filter),
    collection
      .find(filter)
      .skip(pagination.skip)
      .limit(pagination.limit)
      .toArray(),
  ]);
  return { items, total };
}

// Pattern 2: Check ownership + roles
function checkOwnership(resource, userId, userRole) {
  if (userRole === 'admin' || userRole === 'super_admin') {
    return true; // Admins can access anything
  }
  return resource.userId === userId; // Others can only access their own
}

// Pattern 3: Validate filter value
function validateFilterValue(value, allowedValues) {
  if (!value) return true; // Optional filter
  return allowedValues.includes(value);
}

// Pattern 4: Log sensitive action
function logAction(action, userId, resource, ip, details = {}) {
  console.log(`[${resource}] ${action} by ${userId} from ${ip}`, details);
}
*/

export default {};

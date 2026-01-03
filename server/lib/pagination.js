/**
 * Pagination utilities for consistent pagination across all endpoints
 */

export const DefaultLimits = {
    USERS: 20,
    CONTESTS: 12,
    COURSES: 12,
    REPORTS: 10,
    TEAM_POSTS: 15,
    COMMENTS: 20,
    ACTIVITIES: 10,
    NOTIFICATIONS: 20,
    ENROLLMENTS: 15,
};

export const MaxLimits = {
    USERS: 100,
    CONTESTS: 50,
    COURSES: 50,
    REPORTS: 50,
    TEAM_POSTS: 50,
    COMMENTS: 100,
    ACTIVITIES: 50,
    NOTIFICATIONS: 100,
    ENROLLMENTS: 100,
};

/**
 * Normalize pagination parameters
 * @param {number|string} page - Page number (1-based)
 * @param {number|string} limit - Items per page
 * @param {string} type - Type of resource (e.g., 'USERS', 'CONTESTS')
 * @returns {{page: number, limit: number, skip: number}} Normalized pagination params
 */
export function normalizePagination(page = 1, limit = null, type = 'USERS') {
    const defaultLimit = DefaultLimits[type] || 20;
    const maxLimit = MaxLimits[type] || 100;

    // Parse page
    const p = Math.max(1, parseInt(page) || 1);

    // Parse limit
    let l;
    if (limit === null || limit === undefined) {
        l = defaultLimit;
    } else {
        l = Math.max(1, parseInt(limit) || defaultLimit);
    }

    // Enforce max limit
    l = Math.min(maxLimit, l);

    return {
        page: p,
        limit: l,
        skip: (p - 1) * l,
    };
}

/**
 * Add pagination to a MongoDB query result
 * @param {Array} items - Array of items
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @param {number} total - Total count
 * @returns {Object} Paginated response
 */
export function createPaginatedResponse(items = [], page = 1, limit = 20, total = 0) {
    const totalPages = Math.ceil(total / limit);
    const currentPage = Math.max(1, Math.min(page, totalPages || 1));

    return {
        data: items,
        pagination: {
            currentPage,
            totalPages,
            totalItems: total,
            itemsPerPage: limit,
            hasNext: currentPage < totalPages,
            hasPrev: currentPage > 1,
        },
    };
}

/**
 * Middleware to extract and normalize pagination parameters from query
 * Usage: app.use(paginationMiddleware)
 */
export function paginationMiddleware(req, res, next) {
    const page = req.query.page;
    const limit = req.query.limit;

    // Store normalized pagination in request
    const resourceType = req.params.resourceType || 'USERS';
    req.pagination = normalizePagination(page, limit, resourceType);

    next();
}

/**
 * Example: Generate MongoDB aggregation pipeline with pagination
 */
export function buildPaginationStage(pagination) {
    return [
        { $skip: pagination.skip },
        { $limit: pagination.limit },
    ];
}

/**
 * Example: Count total documents and apply pagination
 * 
 * Usage in route:
 * async function getUsers(req, res) {
 *   const pagination = normalizePagination(req.query.page, req.query.limit, 'USERS');
 *   const users = db.collection('users');
 *   
 *   const [total, items] = await Promise.all([
 *     users.countDocuments(filter),
 *     users.find(filter)
 *       .skip(pagination.skip)
 *       .limit(pagination.limit)
 *       .toArray()
 *   ]);
 *   
 *   return res.json(createPaginatedResponse(items, pagination.page, pagination.limit, total));
 * }
 */

/**
 * Parse sort parameter from query
 * Supports: sort=field or sort=-field (ascending/descending)
 * Allows multiple: sort=field1,-field2,field3
 */
export function parseSortParam(sortParam) {
    if (!sortParam) return {};

    const fields = Array.isArray(sortParam) ? sortParam : [sortParam];
    const sort = {};

    fields.forEach((field) => {
        if (typeof field !== 'string') return;

        if (field.startsWith('-')) {
            // Descending
            sort[field.substring(1)] = -1;
        } else {
            // Ascending
            sort[field] = 1;
        }
    });

    return sort;
}

/**
 * Validate and sanitize sort parameter
 * Only allows specified fields to be sorted
 */
export function validateSort(sortParam, allowedFields) {
    if (!sortParam) return {};

    const fields = Array.isArray(sortParam) ? sortParam : [sortParam];
    const sort = {};

    fields.forEach((field) => {
        if (typeof field !== 'string') return;

        let fieldName = field;
        let direction = 1;

        if (field.startsWith('-')) {
            fieldName = field.substring(1);
            direction = -1;
        }

        // Only allow whitelisted fields
        if (allowedFields.includes(fieldName)) {
            sort[fieldName] = direction;
        }
    });

    return sort;
}

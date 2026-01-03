import rateLimit from 'express-rate-limit';
import crypto from 'crypto';

/**
 * Rate limiting configuration for different endpoint types
 */
export const RateLimiters = {
    // Strict limiting for authentication attempts
    auth: rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 5, // max 5 requests per 15 minutes
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => getClientIp(req),
        message: 'Too many authentication attempts, please try again later',
    }),

    // Moderate limiting for OTP endpoints
    otp: rateLimit({
        windowMs: 5 * 60 * 1000, // 5 minutes
        max: 3, // max 3 requests per 5 minutes
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => getClientIp(req),
        message: 'Too many OTP requests, please try again later',
    }),

    // General API limiting
    api: rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // max 100 requests per 15 minutes
        standardHeaders: true,
        legacyHeaders: false,
        // Mounted at /api, so health path here is usually "/health"
        skip: (req) => req.path === '/health' || req.path?.startsWith('/health/'),
    }),

    // Strict limiting for admin endpoints
    admin: rateLimit({
        windowMs: 1 * 60 * 1000, // 1 minute
        max: 30, // max 30 requests per minute
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => getClientIp(req),
        message: 'Admin endpoint rate limit exceeded',
    }),

    // Limiting for sensitive operations (password reset, etc)
    sensitive: rateLimit({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 3, // max 3 requests per hour
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => getClientIp(req),
        message: 'Too many sensitive operation attempts',
    }),
};

/**
 * Get client IP from request, considering proxies
 */
export function getClientIp(req) {
    return (
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.headers['x-real-ip'] ||
        req.connection?.remoteAddress ||
        req.ip ||
        'unknown'
    );
}

/**
 * Validate CORS origins are properly configured
 * Should be called at startup to ensure production safety
 */
export function validateProductionSetup() {
    const errors = [];

    // Check JWT_SECRET
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        errors.push('JWT_SECRET is not configured');
    } else if (jwtSecret.length < 32) {
        errors.push('JWT_SECRET must be at least 32 characters long');
    }

    // Check NODE_ENV
    if (process.env.NODE_ENV !== 'production') {
        console.warn('[Security] NODE_ENV is not set to "production"');
    }

    // Check FRONTEND_ORIGIN
    const frontendOrigin = process.env.FRONTEND_ORIGIN;
    if (!frontendOrigin) {
        errors.push('FRONTEND_ORIGIN is not configured');
    } else {
        const origins = frontendOrigin.split(',').map((o) => o.trim());
        const hasLocalhost = origins.some(
            (o) => o.includes('localhost') || o.includes('127.0.0.1')
        );
        if (hasLocalhost && process.env.NODE_ENV === 'production') {
            errors.push('FRONTEND_ORIGIN contains localhost - not allowed in production');
        }
    }

    // Check MongoDB URI
    if (!process.env.MONGODB_URI) {
        errors.push('MONGODB_URI is not configured');
    }

    if (errors.length > 0) {
        console.error('[Security Setup] Critical configuration errors:');
        errors.forEach((e) => console.error(`  - ${e}`));
        if (process.env.NODE_ENV === 'production') {
            process.exit(1);
        }
    }

    return errors;
}

/**
 * Generate a cryptographically secure random token
 */
export function generateSecureToken(bytes = 32) {
    return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Validate email format
 */
export function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
}

/**
 * Validate password strength
 */
export function validatePasswordStrength(password) {
    const errors = [];

    if (!password || password.length < 8) {
        errors.push('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        errors.push('Password must contain at least one special character');
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
}

/**
 * Sanitize user input to prevent XSS
 */
export function sanitizeInput(input) {
    if (typeof input !== 'string') return input;

    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

/**
 * Create a structured audit log entry
 */
export function createAuditLog(userId, action, resource, details = {}) {
    return {
        userId: userId || 'anonymous',
        action,
        resource,
        details,
        timestamp: new Date(),
        ip: details.ip || 'unknown',
    };
}

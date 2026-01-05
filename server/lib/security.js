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
        // Mounted at /api/auth. Exclude non-sensitive endpoints that are called frequently in normal flows.
        // (e.g. app bootstrapping calls /auth/me to check session)
        skip: (req) => req.path === '/me' || req.path === '/logout',
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
        // Exempt cheap/read-only endpoints that may be called frequently in normal flows.
        skip: (req) =>
            req.path === '/health'
            || req.path?.startsWith('/health/')
            || req.path === '/auth/me',
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
export function validateProductionSetup(options = {}) {
    const { log = true } = options;
    const errors = [];

    // Check JWT_SECRET
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        errors.push('JWT_SECRET is not configured');
    } else if (jwtSecret.length < 32) {
        errors.push('JWT_SECRET must be at least 32 characters long');
    }

    // Check OTP_SECRET_KEY (avoid sharing JWT secret across purposes in production)
    const otpSecret = process.env.OTP_SECRET_KEY;
    if (!otpSecret) {
        errors.push('OTP_SECRET_KEY is not configured');
    } else if (otpSecret.length < 32) {
        errors.push('OTP_SECRET_KEY must be at least 32 characters long');
    }

    // Ensure OTP delivery is configured (optional strictness)
    const requireOtpEmailProvider = String(process.env.REQUIRE_OTP_EMAIL_URL_IN_PROD || 'false').toLowerCase() === 'true';
    if (requireOtpEmailProvider && !process.env.OTP_EMAIL_URL) {
        errors.push('OTP_EMAIL_URL is not configured (required in production)');
    }

    // Check NODE_ENV
    if (process.env.NODE_ENV !== 'production') {
        console.warn('[Security] NODE_ENV is not set to "production"');
    }

    // Check FRONTEND_ORIGIN (allow Netlify-provided URLs as a safe fallback)
    const frontendOrigin = process.env.FRONTEND_ORIGIN;
    const netlifyUrl = process.env.URL;
    const netlifyDeployPrimeUrl = process.env.DEPLOY_PRIME_URL;
    const fallbackOrigins = [netlifyUrl, netlifyDeployPrimeUrl].filter(Boolean).join(',');
    const originSource = frontendOrigin || fallbackOrigins;

    if (!originSource) {
        errors.push('FRONTEND_ORIGIN is not configured');
    } else {
        const origins = originSource.split(',').map((o) => o.trim());
        const hasLocalhost = origins.some(
            (o) => o.includes('localhost') || o.includes('127.0.0.1')
        );
        if (hasLocalhost && process.env.NODE_ENV === 'production') {
            errors.push('FRONTEND_ORIGIN contains localhost - not allowed in production');
        }
    }

    // Check Database URL
    if (!process.env.DATABASE_URL) {
        errors.push('DATABASE_URL is not configured');
    }

    if (errors.length > 0 && log) {
        console.error('[Security Setup] Critical configuration errors:');
        errors.forEach((e) => console.error(`  - ${e}`));
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

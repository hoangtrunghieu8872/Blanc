import { Router } from 'express';
import crypto from 'crypto';
import { connectToDatabase, getCollection } from '../lib/db.js';

const router = Router();

// ============ CONSTANTS ============
const OTP_CONFIG = {
    LENGTH: 6,                          // 6 digits OTP
    TTL_MINUTES: 2,                     // OTP expires in 2 minutes
    MAX_VERIFY_ATTEMPTS: 5,             // Max wrong attempts per session
    MAX_REQUESTS_PER_WINDOW: 5,         // Max OTP requests per time window (increased for register+login)
    RATE_LIMIT_WINDOW_MINUTES: 15,      // Rate limit window: 15 minutes
    COOLDOWN_SECONDS: 60,               // Minimum seconds between requests
};

// Valid actions for OTP
const VALID_ACTIONS = ['verify', 'reset_password', 'register_verify', 'login_2fa'];

// Secret key for HMAC - should be in environment variables
const SECRET_KEY = process.env.OTP_SECRET_KEY || process.env.JWT_SECRET || 'default-otp-secret-key-change-me';

// ============ HELPER FUNCTIONS ============

/**
 * Derive OTP from session token using HMAC-SHA256
 * OTP is deterministic based on token + secret, not stored in DB
 */
function deriveOtpFromToken(sessionToken) {
    const hmac = crypto.createHmac('sha256', SECRET_KEY);
    hmac.update(sessionToken);
    const hash = hmac.digest();

    // Take first 4 bytes, convert to number, mod 10^6 for 6 digits
    const num = hash.readUInt32BE(0);
    const otp = (num % 1_000_000).toString().padStart(OTP_CONFIG.LENGTH, '0');
    return otp;
}

/**
 * Hash session token for storage (never store raw token)
 */
function hashSessionToken(sessionToken) {
    return crypto.createHash('sha256').update(sessionToken).digest('hex');
}

/**
 * Get client IP from request
 */
function getClientIp(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
        || req.socket?.remoteAddress
        || 'unknown';
}

/**
 * Check rate limit for email/IP
 */
async function checkRateLimit(email, ip) {
    const otpSessions = getCollection('otp_sessions');
    const windowStart = new Date(Date.now() - OTP_CONFIG.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000);

    // Count recent requests by email
    const emailCount = await otpSessions.countDocuments({
        email: email.toLowerCase(),
        createdAt: { $gte: windowStart },
    });

    // Count recent requests by IP
    const ipCount = await otpSessions.countDocuments({
        ip,
        createdAt: { $gte: windowStart },
    });

    // Check cooldown (last request time)
    const lastRequest = await otpSessions.findOne(
        { email: email.toLowerCase() },
        { sort: { createdAt: -1 } }
    );

    const cooldownEnd = lastRequest
        ? new Date(lastRequest.createdAt.getTime() + OTP_CONFIG.COOLDOWN_SECONDS * 1000)
        : null;

    const remainingCooldown = cooldownEnd
        ? Math.max(0, Math.ceil((cooldownEnd.getTime() - Date.now()) / 1000))
        : 0;

    return {
        allowed: emailCount < OTP_CONFIG.MAX_REQUESTS_PER_WINDOW
            && ipCount < OTP_CONFIG.MAX_REQUESTS_PER_WINDOW * 2
            && remainingCooldown === 0,
        emailCount,
        ipCount,
        remainingCooldown,
        maxRequests: OTP_CONFIG.MAX_REQUESTS_PER_WINDOW,
    };
}

// ============ API ENDPOINTS ============

/**
 * POST /api/otp/request
 * Request OTP for email verification / password reset
 */
router.post('/request', async (req, res, next) => {
    try {
        await connectToDatabase();
        const { email, sessionToken, action = 'verify' } = req.body || {};

        // Validate input
        if (!email || !sessionToken) {
            return res.status(400).json({
                error: 'Email và session token là bắt buộc.',
                code: 'MISSING_PARAMS'
            });
        }

        // Validate action type
        if (!VALID_ACTIONS.includes(action)) {
            return res.status(400).json({
                error: 'Action không hợp lệ.',
                code: 'INVALID_ACTION'
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                error: 'Email không hợp lệ.',
                code: 'INVALID_EMAIL'
            });
        }

        // Validate session token (should be UUID or 32+ bytes hex)
        if (sessionToken.length < 32) {
            return res.status(400).json({
                error: 'Session token không hợp lệ.',
                code: 'INVALID_TOKEN'
            });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const ip = getClientIp(req);
        const userAgent = req.headers['user-agent'] || 'unknown';

        // Check rate limit
        const rateLimit = await checkRateLimit(normalizedEmail, ip);
        if (!rateLimit.allowed) {
            if (rateLimit.remainingCooldown > 0) {
                return res.status(429).json({
                    error: `Vui lòng chờ ${rateLimit.remainingCooldown} giây trước khi yêu cầu mã mới.`,
                    code: 'COOLDOWN',
                    remainingCooldown: rateLimit.remainingCooldown,
                });
            }
            return res.status(429).json({
                error: `Bạn đã yêu cầu quá nhiều lần. Vui lòng thử lại sau ${OTP_CONFIG.RATE_LIMIT_WINDOW_MINUTES} phút.`,
                code: 'RATE_LIMITED',
                retryAfterMinutes: OTP_CONFIG.RATE_LIMIT_WINDOW_MINUTES,
            });
        }

        const users = getCollection('users');

        // Check based on action type
        if (action === 'reset_password' || action === 'login_2fa') {
            // User must exist for password reset and 2FA login
            const user = await users.findOne({ email: normalizedEmail });
            if (!user) {
                return res.status(404).json({
                    ok: false,
                    error: 'Email này chưa được đăng ký trong hệ thống.',
                    code: 'EMAIL_NOT_FOUND'
                });
            }
        } else if (action === 'register_verify') {
            // For registration, user should NOT exist
            const existingUser = await users.findOne({ email: normalizedEmail });
            if (existingUser) {
                return res.status(409).json({
                    ok: false,
                    error: 'Email này đã được đăng ký. Vui lòng đăng nhập.',
                    code: 'EMAIL_EXISTS'
                });
            }

            // Check if there's a pending registration
            const pendingRegistrations = getCollection('pending_registrations');
            const pending = await pendingRegistrations.findOne({
                email: normalizedEmail,
                status: 'PENDING',
                expiresAt: { $gt: new Date() },
            });

            if (!pending) {
                return res.status(400).json({
                    ok: false,
                    error: 'Vui lòng bắt đầu đăng ký trước khi xác thực OTP.',
                    code: 'NO_PENDING_REGISTRATION'
                });
            }
        }

        // Invalidate any existing active sessions for this email
        const otpSessions = getCollection('otp_sessions');
        await otpSessions.updateMany(
            { email: normalizedEmail, status: 'ACTIVE' },
            { $set: { status: 'SUPERSEDED', updatedAt: new Date() } }
        );

        // Derive OTP from session token (deterministic)
        const otp = deriveOtpFromToken(sessionToken);

        // Hash session token for storage (moved up before usage)
        const sessionTokenHash = hashSessionToken(sessionToken);

        // CRITICAL: Update pending_logins sessionTokenHash when requesting new OTP for login_2fa
        // This ensures the sessionToken used for OTP matches the one stored in pending_logins
        if (action === 'login_2fa') {
            const pendingLogins = getCollection('pending_logins');
            await pendingLogins.updateMany(
                { email: normalizedEmail, status: 'PENDING_OTP' },
                { $set: { sessionTokenHash, updatedAt: new Date() } }
            );
        }

        // Similarly for register_verify - update pending_registrations
        if (action === 'register_verify') {
            const pendingRegistrations = getCollection('pending_registrations');
            await pendingRegistrations.updateMany(
                { email: normalizedEmail, status: 'PENDING' },
                { $set: { sessionTokenHash, updatedAt: new Date() } }
            );
        }

        // Create OTP session record
        const expiresAt = new Date(Date.now() + OTP_CONFIG.TTL_MINUTES * 60 * 1000);
        const otpSession = {
            email: normalizedEmail,
            sessionTokenHash,
            expiresAt,
            attempts: 0,
            status: 'ACTIVE',
            action,
            ip,
            userAgent,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        await otpSessions.insertOne(otpSession);

        // Send OTP email via Apps Script or direct email
        try {
            await sendOtpEmail(normalizedEmail, otp, action);
        } catch (emailError) {
            // eslint-disable-next-line no-console
            console.error('[OTP] Failed to send email:', emailError.message);
            // Don't fail the request, but log it
        }

        // Log for development (remove in production)
        if (process.env.NODE_ENV !== 'production') {
            // eslint-disable-next-line no-console
            console.log(`[DEV] OTP for ${normalizedEmail}: ${otp}`);
        }

        res.json({
            ok: true,
            message: 'Mã OTP đã được gửi đến email của bạn.',
            ttlSeconds: OTP_CONFIG.TTL_MINUTES * 60,
            expiresAt: expiresAt.toISOString(),
        });

    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/otp/verify
 * Verify OTP code
 */
router.post('/verify', async (req, res, next) => {
    try {
        await connectToDatabase();
        const { email, sessionToken, otp } = req.body || {};

        // Validate input
        if (!email || !sessionToken || !otp) {
            return res.status(400).json({
                error: 'Thiếu thông tin xác thực.',
                code: 'MISSING_PARAMS'
            });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const sessionTokenHash = hashSessionToken(sessionToken);
        const otpSessions = getCollection('otp_sessions');

        // Find the OTP session
        const session = await otpSessions.findOne({
            email: normalizedEmail,
            sessionTokenHash,
        });

        // Generic error for security (don't reveal specific reason)
        const genericError = {
            error: 'Mã OTP không hợp lệ hoặc đã hết hạn.',
            code: 'INVALID_OTP'
        };

        // Check if session exists
        if (!session) {
            return res.status(400).json(genericError);
        }

        // Check status
        if (session.status !== 'ACTIVE') {
            return res.status(400).json({
                error: session.status === 'USED'
                    ? 'Mã OTP đã được sử dụng.'
                    : 'Mã OTP không còn hiệu lực.',
                code: 'OTP_INVALID_STATUS'
            });
        }

        // Check expiry
        if (new Date() > session.expiresAt) {
            await otpSessions.updateOne(
                { _id: session._id },
                { $set: { status: 'EXPIRED', updatedAt: new Date() } }
            );
            return res.status(400).json({
                error: 'Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới.',
                code: 'OTP_EXPIRED'
            });
        }

        // Check attempts
        if (session.attempts >= OTP_CONFIG.MAX_VERIFY_ATTEMPTS) {
            await otpSessions.updateOne(
                { _id: session._id },
                { $set: { status: 'BLOCKED', updatedAt: new Date() } }
            );
            return res.status(400).json({
                error: 'Bạn đã nhập sai quá nhiều lần. Vui lòng yêu cầu mã OTP mới.',
                code: 'MAX_ATTEMPTS_EXCEEDED'
            });
        }

        // Derive expected OTP and compare
        const expectedOtp = deriveOtpFromToken(sessionToken);
        const isValid = otp === expectedOtp;

        if (!isValid) {
            // Increment attempts
            const newAttempts = session.attempts + 1;
            const remainingAttempts = OTP_CONFIG.MAX_VERIFY_ATTEMPTS - newAttempts;

            await otpSessions.updateOne(
                { _id: session._id },
                {
                    $inc: { attempts: 1 },
                    $set: { updatedAt: new Date() }
                }
            );

            return res.status(400).json({
                error: remainingAttempts > 0
                    ? `Mã OTP không đúng. Còn ${remainingAttempts} lần thử.`
                    : 'Bạn đã nhập sai quá nhiều lần. Vui lòng yêu cầu mã OTP mới.',
                code: 'WRONG_OTP',
                remainingAttempts,
            });
        }

        // OTP is valid - mark as used
        await otpSessions.updateOne(
            { _id: session._id },
            {
                $set: {
                    status: 'USED',
                    usedAt: new Date(),
                    updatedAt: new Date()
                }
            }
        );

        // Generate verification token for next step (password reset, etc.)
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationTokenHash = crypto.createHash('sha256').update(verificationToken).digest('hex');
        const verificationExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Store verification token for the action
        if (session.action === 'reset_password') {
            const users = getCollection('users');
            await users.updateOne(
                { email: normalizedEmail },
                {
                    $set: {
                        resetPasswordToken: verificationTokenHash,
                        resetPasswordExpiry: verificationExpiry,
                        updatedAt: new Date(),
                    }
                }
            );
        }

        // For registration verification, bind the verification token to the pending registration
        // so the account is only created after completing profile + terms acceptance.
        if (session.action === 'register_verify') {
            const pendingRegistrations = getCollection('pending_registrations');
            await pendingRegistrations.updateOne(
                {
                    email: normalizedEmail,
                    status: { $in: ['PENDING', 'OTP_VERIFIED'] },
                    expiresAt: { $gt: new Date() },
                },
                {
                    $set: {
                        status: 'OTP_VERIFIED',
                        otpVerifiedAt: new Date(),
                        verificationTokenHash,
                        verificationExpiry,
                        updatedAt: new Date(),
                    }
                }
            );
        }

        res.json({
            ok: true,
            message: 'Xác thực OTP thành công!',
            verificationToken,
            action: session.action,
        });

    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/otp/resend
 * Resend OTP (generates new session)
 */
router.post('/resend', async (req, res, next) => {
    try {
        await connectToDatabase();
        const { email, action = 'verify' } = req.body || {};

        if (!email) {
            return res.status(400).json({
                error: 'Email là bắt buộc.',
                code: 'MISSING_EMAIL'
            });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const ip = getClientIp(req);

        // Check rate limit
        const rateLimit = await checkRateLimit(normalizedEmail, ip);
        if (!rateLimit.allowed) {
            if (rateLimit.remainingCooldown > 0) {
                return res.status(429).json({
                    error: `Vui lòng chờ ${rateLimit.remainingCooldown} giây trước khi yêu cầu mã mới.`,
                    code: 'COOLDOWN',
                    remainingCooldown: rateLimit.remainingCooldown,
                });
            }
            return res.status(429).json({
                error: `Bạn đã yêu cầu quá nhiều lần. Vui lòng thử lại sau ${OTP_CONFIG.RATE_LIMIT_WINDOW_MINUTES} phút.`,
                code: 'RATE_LIMITED',
            });
        }

        // Generate new session token
        const newSessionToken = crypto.randomBytes(32).toString('hex');

        // Invalidate existing sessions
        const otpSessions = getCollection('otp_sessions');
        await otpSessions.updateMany(
            { email: normalizedEmail, status: 'ACTIVE' },
            { $set: { status: 'SUPERSEDED', updatedAt: new Date() } }
        );

        // Create new session
        const otp = deriveOtpFromToken(newSessionToken);
        const sessionTokenHash = hashSessionToken(newSessionToken);
        const expiresAt = new Date(Date.now() + OTP_CONFIG.TTL_MINUTES * 60 * 1000);

        await otpSessions.insertOne({
            email: normalizedEmail,
            sessionTokenHash,
            expiresAt,
            attempts: 0,
            status: 'ACTIVE',
            action,
            ip,
            userAgent: req.headers['user-agent'] || 'unknown',
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        // CRITICAL: Update pending_logins with new sessionTokenHash for login_2fa resend
        if (action === 'login_2fa') {
            const pendingLogins = getCollection('pending_logins');
            await pendingLogins.updateMany(
                { email: normalizedEmail, status: 'PENDING_OTP' },
                { $set: { sessionTokenHash, updatedAt: new Date() } }
            );
        }

        // Similarly for register_verify resend
        if (action === 'register_verify') {
            const pendingRegistrations = getCollection('pending_registrations');
            await pendingRegistrations.updateMany(
                { email: normalizedEmail, status: 'PENDING' },
                { $set: { sessionTokenHash, updatedAt: new Date() } }
            );
        }

        // Send email
        try {
            await sendOtpEmail(normalizedEmail, otp, action);
        } catch (emailError) {
            // eslint-disable-next-line no-console
            console.error('[OTP] Failed to send email:', emailError.message);
        }

        // Dev logging
        if (process.env.NODE_ENV !== 'production') {
            // eslint-disable-next-line no-console
            console.log(`[DEV] New OTP for ${normalizedEmail}: ${otp}`);
        }

        res.json({
            ok: true,
            message: 'Mã OTP mới đã được gửi.',
            sessionToken: newSessionToken,
            ttlSeconds: OTP_CONFIG.TTL_MINUTES * 60,
            expiresAt: expiresAt.toISOString(),
        });

    } catch (error) {
        next(error);
    }
});

// ============ EMAIL SENDING ============

/**
 * Generate HMAC signature for Apps Script request
 * Format: email=<email>&actionType=<actionType>&ttlMinutes=<ttl>&nonce=<nonce>&timestamp=<timestamp>
 */
function generateSignature(payload, secretKey) {
    const canonicalString =
        `email=${payload.email}&actionType=${payload.actionType}&ttlMinutes=${payload.ttlMinutes}&nonce=${payload.nonce}&timestamp=${payload.timestamp}`;

    const hmac = crypto.createHmac('sha256', secretKey);
    hmac.update(canonicalString);
    return hmac.digest('base64');
}

/**
 * Map internal action to Apps Script action type
 * Apps Script only accepts: verify, reset_password, login
 */
function mapActionType(action) {
    const mapping = {
        'verify': 'verify',
        'register_verify': 'verify',
        'reset_password': 'reset_password',
        'login_2fa': 'login',
    };
    return mapping[action] || 'verify';
}

/**
 * Send OTP email using Apps Script with HMAC signature
 */
async function sendOtpEmail(email, otp, action) {
    const appScriptUrl = process.env.OTP_EMAIL_URL;

    // Map action to Apps Script compatible actionType
    const actionType = mapActionType(action);

    const actionText = {
        verify: 'xác thực email',
        reset_password: 'đặt lại mật khẩu',
        login: 'đăng nhập',
    }[actionType] || 'xác thực';

    // Generate nonce and timestamp for signature
    const nonce = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now();

    const emailData = {
        action: 'sendOtp',
        email,
        otp,  // OTP đã được derive từ sessionToken, gửi trực tiếp
        actionType,  // Sử dụng actionType đã được map
        actionText,
        ttlMinutes: OTP_CONFIG.TTL_MINUTES,
        appName: 'Blanc',
        // Security fields for HMAC verification
        nonce,
        timestamp,
        origin: process.env.FRONTEND_ORIGIN?.split(',')[0] || 'http://localhost:5173',
    };

    // Add HMAC signature
    emailData.signature = generateSignature(emailData, SECRET_KEY);

    if (appScriptUrl) {
        // Send via Apps Script with signature
        const response = await fetch(appScriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(emailData),
        });

        const result = await response.json();

        if (!result.ok && result.statusCode !== 200) {
            throw new Error(result.error || `Apps Script error: ${result.statusCode}`);
        }

        return result;
    }

    // Fallback: just log (in production, integrate with email service)
    // eslint-disable-next-line no-console
    console.log(`[EMAIL] Would send OTP ${otp} to ${email} for ${actionText}`);
    return { ok: true, method: 'log' };
}

export default router;

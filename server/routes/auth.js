import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { ObjectId } from 'mongodb';
import { connectToDatabase, getCollection } from '../lib/db.js';
import { authGuard, issueToken } from '../middleware/auth.js';
import { logAuditEvent } from './admin.js';

const router = Router();

// Helper: Get client IP
function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || req.connection?.remoteAddress
    || req.ip
    || '-';
}

// ============ CONSTANTS ============
const PENDING_REGISTRATION_TTL_MINUTES = 10; // Pending registrations expire in 10 minutes
const LOGIN_2FA_TTL_MINUTES = 2; // 2FA/OTP session expires in 2 minutes (matches OTP TTL)

// ============ TEST ACCOUNTS (bypass OTP) ============
const OTP_BYPASS_EMAILS = [
  'admin@blanc.dev',
];

// ============ LOGIN RATE LIMIT CONFIG ============
const LOGIN_RATE_LIMIT = {
  // IP-based rate limit
  IP_MAX_ATTEMPTS: 5,           // Max attempts per IP
  IP_WINDOW_MS: 60 * 1000,      // 1 minute window

  // Email-based rate limit  
  EMAIL_MAX_ATTEMPTS: 10,       // Max attempts per email
  EMAIL_WINDOW_MS: 60 * 60 * 1000, // 1 hour window

  // Account lockout
  LOCKOUT_THRESHOLD: 10,        // Lock after 10 failed attempts
  LOCKOUT_DURATION_MS: 15 * 60 * 1000, // 15 minutes lockout
};

// In-memory store for IP rate limiting (consider Redis for production)
const loginAttempts = new Map();

/**
 * Clean up expired entries from loginAttempts map
 */
function cleanupLoginAttempts() {
  const now = Date.now();
  for (const [key, data] of loginAttempts.entries()) {
    if (now - data.firstAttempt > Math.max(LOGIN_RATE_LIMIT.IP_WINDOW_MS, LOGIN_RATE_LIMIT.EMAIL_WINDOW_MS)) {
      loginAttempts.delete(key);
    }
  }
}

// Clean up every 5 minutes
setInterval(cleanupLoginAttempts, 5 * 60 * 1000);

/**
 * Check IP-based rate limit
 */
function checkIpRateLimit(ip) {
  const key = `ip:${ip}`;
  const now = Date.now();
  const data = loginAttempts.get(key);

  if (!data || now - data.firstAttempt > LOGIN_RATE_LIMIT.IP_WINDOW_MS) {
    return { allowed: true };
  }

  if (data.count >= LOGIN_RATE_LIMIT.IP_MAX_ATTEMPTS) {
    const remainingMs = LOGIN_RATE_LIMIT.IP_WINDOW_MS - (now - data.firstAttempt);
    return {
      allowed: false,
      remainingSeconds: Math.ceil(remainingMs / 1000),
      reason: 'IP_RATE_LIMIT'
    };
  }

  return { allowed: true };
}

/**
 * Record failed login attempt for IP
 */
function recordIpAttempt(ip) {
  const key = `ip:${ip}`;
  const now = Date.now();
  const data = loginAttempts.get(key);

  if (!data || now - data.firstAttempt > LOGIN_RATE_LIMIT.IP_WINDOW_MS) {
    loginAttempts.set(key, { count: 1, firstAttempt: now });
  } else {
    data.count++;
  }
}

/**
 * Clear IP attempts on successful login
 */
function clearIpAttempts(ip) {
  loginAttempts.delete(`ip:${ip}`);
}

/**
 * Check and record email-based rate limit (stored in DB)
 */
async function checkEmailRateLimit(email) {
  const loginAttemptsCol = getCollection('login_attempts');
  const now = new Date();
  const windowStart = new Date(now.getTime() - LOGIN_RATE_LIMIT.EMAIL_WINDOW_MS);

  // Count failed attempts in the last hour
  const recentAttempts = await loginAttemptsCol.countDocuments({
    email,
    success: false,
    createdAt: { $gte: windowStart }
  });

  if (recentAttempts >= LOGIN_RATE_LIMIT.EMAIL_MAX_ATTEMPTS) {
    return {
      allowed: false,
      reason: 'EMAIL_RATE_LIMIT',
      message: 'Quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau 1 giờ.'
    };
  }

  return { allowed: true };
}

/**
 * Check if account is locked
 */
async function checkAccountLockout(email) {
  const users = getCollection('users');
  const user = await users.findOne({ email });

  if (!user) return { locked: false };

  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    const remainingMs = new Date(user.lockedUntil).getTime() - Date.now();
    const remainingMinutes = Math.ceil(remainingMs / 60000);
    return {
      locked: true,
      remainingMinutes,
      message: `Tài khoản tạm khóa. Vui lòng thử lại sau ${remainingMinutes} phút.`
    };
  }

  return { locked: false };
}

/**
 * Record login attempt in database
 */
async function recordLoginAttempt(email, ip, userAgent, success) {
  const loginAttemptsCol = getCollection('login_attempts');

  await loginAttemptsCol.insertOne({
    email,
    ip,
    userAgent,
    success,
    createdAt: new Date()
  });

  // If failed, check if we need to lock the account
  if (!success) {
    const windowStart = new Date(Date.now() - LOGIN_RATE_LIMIT.EMAIL_WINDOW_MS);
    const failedCount = await loginAttemptsCol.countDocuments({
      email,
      success: false,
      createdAt: { $gte: windowStart }
    });

    if (failedCount >= LOGIN_RATE_LIMIT.LOCKOUT_THRESHOLD) {
      const users = getCollection('users');
      await users.updateOne(
        { email },
        {
          $set: {
            lockedUntil: new Date(Date.now() + LOGIN_RATE_LIMIT.LOCKOUT_DURATION_MS),
            updatedAt: new Date()
          }
        }
      );
      return { accountLocked: true };
    }
  } else {
    // Clear lockout on successful login
    const users = getCollection('users');
    await users.updateOne(
      { email, lockedUntil: { $exists: true } },
      { $unset: { lockedUntil: '' }, $set: { updatedAt: new Date() } }
    );
  }

  return { accountLocked: false };
}

// ============ NOTIFICATION HELPER ============

/**
 * Generate HMAC signature for notification requests
 * @param {string} action - The notification action type
 * @param {string} secretKey - The secret key for HMAC
 * @param {string} [email] - Optional email to include in signature
 */
function generateSignature(action, secretKey, email = null) {
  const timestamp = Date.now();
  const nonce = crypto.randomUUID();

  // Build canonical string - MUST match App Script's verification order:
  // action, nonce, timestamp, [email]
  let canonicalString = `action=${action}&nonce=${nonce}&timestamp=${timestamp}`;
  if (email) {
    canonicalString += `&email=${email}`;
  }

  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(canonicalString)
    .digest('base64');
  return { timestamp, nonce, signature };
}

/**
 * Send welcome email to new user (async, non-blocking)
 */
async function sendWelcomeEmail(email, userName) {
  const notificationUrl = process.env.NOTIFICATION_EMAIL_URL;
  const secretKey = process.env.OTP_SECRET_KEY;

  if (!notificationUrl || !secretKey) {
    console.log('[auth] Notification not configured, skipping welcome email');
    return;
  }

  // Run asynchronously to not block registration response
  setImmediate(async () => {
    try {
      // Include email in signature for email-bound verification
      const sigData = generateSignature('welcome', secretKey, email);

      const response = await fetch(notificationUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'welcome',
          email,
          userName: userName || 'bạn',
          ...sigData
        })
      });

      const result = await response.json();
      if (result.ok) {
        console.log(`[auth] Welcome email sent to ${email}`);
      } else {
        console.error(`[auth] Failed to send welcome email: ${result.error}`);
      }
    } catch (err) {
      console.error('[auth] Error sending welcome email:', err.message);
    }
  });
}

// ============ REGISTRATION WITH OTP VERIFICATION ============

/**
 * POST /auth/register/initiate
 * Step 1: Initiate registration - validate data and send OTP
 * Stores pending registration data temporarily until OTP is verified
 */
router.post('/register/initiate', async (req, res, next) => {
  try {
    await connectToDatabase();
    const { name, email, password, sessionToken } = req.body || {};

    // Validate required fields
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    if (!sessionToken || sessionToken.length < 32) {
      return res.status(400).json({ error: 'Valid session token is required.' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format.' });
    }

    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const users = getCollection('users');

    // Check if user already exists
    const existing = await users.findOne({ email: normalizedEmail }, { projection: { _id: 1 } });
    if (existing) {
      return res.status(409).json({ error: 'User already exists.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Store pending registration
    const pendingRegistrations = getCollection('pending_registrations');

    // Remove any existing pending registration for this email
    await pendingRegistrations.deleteMany({ email: normalizedEmail });

    const sessionTokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex');
    const expiresAt = new Date(Date.now() + PENDING_REGISTRATION_TTL_MINUTES * 60 * 1000);

    await pendingRegistrations.insertOne({
      email: normalizedEmail,
      name: String(name).trim(),
      passwordHash: hashedPassword,
      sessionTokenHash,
      expiresAt,
      createdAt: new Date(),
      status: 'PENDING',
      ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

    // OTP will be sent via /otp/request endpoint called by frontend
    res.json({
      ok: true,
      message: 'Registration initiated. Please verify your email with OTP.',
      email: normalizedEmail,
      ttlMinutes: PENDING_REGISTRATION_TTL_MINUTES,
      expiresAt: expiresAt.toISOString(),
    });

  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/register/verify
 * Step 2: Complete registration after OTP verification
 */
router.post('/register/verify', async (req, res, next) => {
  try {
    await connectToDatabase();
    const { email, verificationToken } = req.body || {};

    if (!email || !verificationToken) {
      return res.status(400).json({ error: 'Email and verification token are required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const verificationTokenHash = crypto.createHash('sha256').update(verificationToken).digest('hex');

    // Find pending registration
    const pendingRegistrations = getCollection('pending_registrations');
    const pending = await pendingRegistrations.findOne({
      email: normalizedEmail,
      status: 'PENDING',
      expiresAt: { $gt: new Date() },
    });

    if (!pending) {
      return res.status(400).json({
        error: 'Registration session expired or not found. Please register again.',
        code: 'REGISTRATION_EXPIRED'
      });
    }

    // Verify the OTP was verified (check otp_sessions)
    const otpSessions = getCollection('otp_sessions');
    const verifiedSession = await otpSessions.findOne({
      email: normalizedEmail,
      status: 'USED',
      action: 'register_verify',
      usedAt: { $gt: new Date(Date.now() - 10 * 60 * 1000) }, // Within last 10 minutes
    });

    if (!verifiedSession) {
      return res.status(400).json({
        error: 'OTP verification required. Please verify your email first.',
        code: 'OTP_NOT_VERIFIED'
      });
    }

    // Check if user was created in the meantime
    const users = getCollection('users');
    const existingUser = await users.findOne({ email: normalizedEmail });
    if (existingUser) {
      // Clean up pending registration
      await pendingRegistrations.deleteOne({ _id: pending._id });
      return res.status(409).json({ error: 'User already exists.' });
    }

    // Create the actual user
    const user = {
      name: pending.name,
      email: normalizedEmail,
      password: pending.passwordHash,
      role: 'student',
      avatar: '',
      emailVerified: true,
      emailVerifiedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await users.insertOne(user);

    // Clean up pending registration
    await pendingRegistrations.updateOne(
      { _id: pending._id },
      { $set: { status: 'COMPLETED', completedAt: new Date() } }
    );

    // Issue token
    const token = issueToken({ _id: result.insertedId, role: user.role, email: user.email });

    // Send welcome email (non-blocking)
    sendWelcomeEmail(user.email, user.name);

    res.status(201).json({
      ok: true,
      token,
      user: sanitizeUser({ ...user, _id: result.insertedId }),
      message: 'Registration successful! Your email has been verified.',
    });

  } catch (error) {
    next(error);
  }
});

// ============ LOGIN WITH OPTIONAL 2FA ============

/**
 * POST /auth/login/initiate
 * Step 1: Validate credentials and initiate 2FA if enabled
 * 
 * Rate Limiting:
 * - 5 attempts per IP per minute
 * - 10 attempts per email per hour
 * - Account locked for 15 minutes after 10 failed attempts
 */
router.post('/login/initiate', async (req, res, next) => {
  try {
    await connectToDatabase();
    const { email, password, sessionToken } = req.body || {};
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || '';

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    // sessionToken is always required for OTP verification
    if (!sessionToken || sessionToken.length < 32) {
      return res.status(400).json({ error: 'Valid session token is required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // ===== RATE LIMIT CHECKS =====

    // 1. Check IP rate limit (in-memory, fast)
    const ipCheck = checkIpRateLimit(ip);
    if (!ipCheck.allowed) {
      return res.status(429).json({
        error: `Quá nhiều yêu cầu. Vui lòng thử lại sau ${ipCheck.remainingSeconds} giây.`,
        code: 'IP_RATE_LIMIT',
        retryAfter: ipCheck.remainingSeconds
      });
    }

    // 2. Check if account is locked
    const lockoutCheck = await checkAccountLockout(normalizedEmail);
    if (lockoutCheck.locked) {
      return res.status(423).json({
        error: lockoutCheck.message,
        code: 'ACCOUNT_LOCKED',
        retryAfter: lockoutCheck.remainingMinutes * 60
      });
    }

    // 3. Check email rate limit (from DB)
    const emailCheck = await checkEmailRateLimit(normalizedEmail);
    if (!emailCheck.allowed) {
      return res.status(429).json({
        error: emailCheck.message,
        code: 'EMAIL_RATE_LIMIT'
      });
    }

    // ===== CREDENTIAL VALIDATION =====
    const users = getCollection('users');
    const user = await users.findOne({ email: normalizedEmail });

    if (!user) {
      // Record failed attempt
      recordIpAttempt(ip);
      await recordLoginAttempt(normalizedEmail, ip, userAgent, false);
      return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng.' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      // Record failed attempt and check for lockout
      recordIpAttempt(ip);
      const result = await recordLoginAttempt(normalizedEmail, ip, userAgent, false);

      if (result.accountLocked) {
        return res.status(423).json({
          error: `Tài khoản đã bị khóa do quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau ${LOGIN_RATE_LIMIT.LOCKOUT_DURATION_MS / 60000} phút.`,
          code: 'ACCOUNT_LOCKED',
          retryAfter: LOGIN_RATE_LIMIT.LOCKOUT_DURATION_MS / 1000
        });
      }

      return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng.' });
    }

    // Clear IP attempts on successful password verification
    clearIpAttempts(ip);

    // ===== BYPASS OTP FOR TEST ACCOUNTS =====
    if (OTP_BYPASS_EMAILS.includes(normalizedEmail)) {
      // Record successful login
      await recordLoginAttempt(normalizedEmail, ip, userAgent, true);

      // Update last login
      await users.updateOne(
        { _id: user._id },
        { $set: { lastLoginAt: new Date(), updatedAt: new Date() } }
      );

      const token = issueToken(user);

      return res.json({
        ok: true,
        requiresOTP: false,
        token,
        user: sanitizeUser(user),
        message: 'Đăng nhập thành công!',
      });
    }

    // Always require OTP verification for login (enhanced security)
    // Create pending login session
    const pendingLogins = getCollection('pending_logins');

    // Remove existing pending logins for this user
    await pendingLogins.deleteMany({ email: normalizedEmail });

    const sessionTokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex');
    const expiresAt = new Date(Date.now() + LOGIN_2FA_TTL_MINUTES * 60 * 1000);

    await pendingLogins.insertOne({
      userId: user._id,
      email: normalizedEmail,
      sessionTokenHash,
      expiresAt,
      createdAt: new Date(),
      status: 'PENDING_OTP',
      ip,
      userAgent: req.headers['user-agent'],
    });

    // OTP will be sent via /otp/request endpoint called by frontend
    // This ensures consistent OTP derivation across all flows

    return res.json({
      ok: true,
      requiresOTP: true,
      sessionToken, // Return the same sessionToken for frontend to use
      message: 'Credentials verified. Please enter the OTP sent to your email.',
      email: normalizedEmail,
      ttlMinutes: LOGIN_2FA_TTL_MINUTES,
      expiresAt: expiresAt.toISOString(),
    });

  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/login/verify-2fa
 * Step 2: Complete login after OTP verification
 */
router.post('/login/verify-2fa', async (req, res, next) => {
  try {
    await connectToDatabase();
    const { email, sessionToken, otp } = req.body || {};

    if (!email || !sessionToken || !otp) {
      return res.status(400).json({ error: 'Email, session token and OTP are required.' });
    }

    if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ error: 'OTP must be 6 digits.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const sessionTokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex');

    // Find pending login
    const pendingLogins = getCollection('pending_logins');
    const pending = await pendingLogins.findOne({
      email: normalizedEmail,
      sessionTokenHash,
      status: 'PENDING_OTP',
      expiresAt: { $gt: new Date() },
    });

    if (!pending) {
      return res.status(400).json({
        error: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
        code: 'LOGIN_SESSION_EXPIRED'
      });
    }

    // Verify OTP using HMAC derivation (same algorithm as otp.js)
    const secretKey = process.env.OTP_SECRET_KEY || process.env.JWT_SECRET || 'default-otp-secret-key-change-me';

    // Derive OTP from sessionToken using same algorithm as otp.js
    const hmac = crypto.createHmac('sha256', secretKey);
    hmac.update(sessionToken);
    const hash = hmac.digest();
    const num = hash.readUInt32BE(0);
    const derivedOtp = (num % 1_000_000).toString().padStart(6, '0');

    if (otp !== derivedOtp) {
      // Track failed attempts
      const attempts = (pending.failedAttempts || 0) + 1;
      const maxAttempts = 5;

      if (attempts >= maxAttempts) {
        await pendingLogins.updateOne(
          { _id: pending._id },
          { $set: { status: 'FAILED', failedAt: new Date() } }
        );
        return res.status(400).json({
          error: 'Đã vượt quá số lần thử. Vui lòng đăng nhập lại.',
          code: 'MAX_ATTEMPTS_EXCEEDED'
        });
      }

      await pendingLogins.updateOne(
        { _id: pending._id },
        { $set: { failedAttempts: attempts } }
      );

      return res.status(400).json({
        error: `Mã OTP không đúng. Còn ${maxAttempts - attempts} lần thử.`,
        code: 'INVALID_OTP',
        remainingAttempts: maxAttempts - attempts
      });
    }

    // Get user
    const users = getCollection('users');
    const user = await users.findOne({ _id: pending.userId });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Complete login
    await pendingLogins.updateOne(
      { _id: pending._id },
      { $set: { status: 'COMPLETED', completedAt: new Date() } }
    );

    // Update last login
    await users.updateOne(
      { _id: user._id },
      { $set: { lastLoginAt: new Date(), updatedAt: new Date() } }
    );

    // Record successful login (clears lockout if any)
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || '';
    await recordLoginAttempt(normalizedEmail, ip, userAgent, true);

    const token = issueToken(user);

    res.json({
      ok: true,
      token,
      user: sanitizeUser(user),
      message: 'Đăng nhập thành công!',
    });

  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /auth/settings/2fa
 * Enable or disable 2FA for user account
 */
router.patch('/settings/2fa', authGuard, async (req, res, next) => {
  try {
    await connectToDatabase();
    const userId = req.user.id;
    const { enabled, password } = req.body || {};

    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be a boolean' });
    }

    // Require password confirmation to change 2FA settings
    if (!password) {
      return res.status(400).json({ error: 'Password confirmation required.' });
    }

    const users = getCollection('users');
    const user = await users.findOne({ _id: new ObjectId(userId) });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid password.' });
    }

    // Update 2FA setting
    await users.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          'security.twoFactorEnabled': enabled,
          'security.twoFactorUpdatedAt': new Date(),
          updatedAt: new Date(),
        }
      }
    );

    res.json({
      ok: true,
      message: enabled ? '2FA đã được bật thành công.' : '2FA đã được tắt.',
      twoFactorEnabled: enabled,
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /auth/settings/2fa
 * Get current 2FA status
 */
router.get('/settings/2fa', authGuard, async (req, res, next) => {
  try {
    await connectToDatabase();
    const userId = req.user.id;

    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const users = getCollection('users');
    const user = await users.findOne(
      { _id: new ObjectId(userId) },
      { projection: { 'security.twoFactorEnabled': 1 } }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json({
      twoFactorEnabled: user.security?.twoFactorEnabled === true,
    });

  } catch (error) {
    next(error);
  }
});

// ============ ORIGINAL ROUTES (kept for backward compatibility) ============

// ============ ORIGINAL ROUTES (kept for backward compatibility) ============

router.post('/register', async (req, res, next) => {
  try {
    await connectToDatabase();
    const { name, email, password } = req.body || {};

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const users = getCollection('users');

    const existing = await users.findOne({ email: normalizedEmail }, { projection: { _id: 1 } });
    if (existing) {
      return res.status(409).json({ error: 'User already exists.' });
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = {
      name: String(name),
      email: normalizedEmail,
      password: hashed,
      role: 'student',
      avatar: req.body.avatar || '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await users.insertOne(user);
    const token = issueToken({ _id: result.insertedId, role: user.role, email: user.email });

    // Send welcome email (non-blocking)
    sendWelcomeEmail(user.email, user.name);

    res.status(201).json({ token, user: sanitizeUser({ ...user, _id: result.insertedId }) });
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    await connectToDatabase();
    const { email, password } = req.body || {};
    const clientIp = getClientIp(req);

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const users = getCollection('users');
    const normalizedEmail = email.toLowerCase().trim();
    const user = await users.findOne({ email: normalizedEmail });

    if (!user) {
      // Log failed login attempt - user not found
      logAuditEvent({
        action: 'LOGIN_ATTEMPT',
        userEmail: normalizedEmail,
        target: 'System',
        status: 'Failed',
        details: 'Email không tồn tại trong hệ thống',
        ip: clientIp
      });
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      // Log failed login - wrong password
      logAuditEvent({
        action: 'LOGIN_ATTEMPT',
        userId: user._id.toString(),
        userEmail: user.email,
        userName: user.name,
        target: 'System',
        status: 'Failed',
        details: 'Sai mật khẩu',
        ip: clientIp
      });
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    // Log successful login
    logAuditEvent({
      action: 'LOGIN_SUCCESS',
      userId: user._id.toString(),
      userEmail: user.email,
      userName: user.name,
      target: 'System',
      status: 'Success',
      details: `Đăng nhập thành công (${user.role})`,
      ip: clientIp
    });

    const token = issueToken(user);
    res.json({ token, user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
});

router.get('/me', authGuard, async (req, res, next) => {
  try {
    await connectToDatabase();
    const userId = req.user.id;
    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const users = getCollection('users');
    const user = await users.findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
});

// POST /auth/forgot-password - Request password reset
router.post('/forgot-password', async (req, res, next) => {
  try {
    await connectToDatabase();
    const { email } = req.body || {};

    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const users = getCollection('users');
    const user = await users.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({ error: 'Email not found.' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Save reset token to database
    await users.updateOne(
      { _id: user._id },
      {
        $set: {
          resetPasswordToken: resetTokenHash,
          resetPasswordExpiry: resetTokenExpiry,
          updatedAt: new Date(),
        },
      }
    );

    // In production, send email here with reset link
    // For now, just log the token (development only)
    // eslint-disable-next-line no-console
    console.log(`[DEV] Password reset token for ${email}: ${resetToken}`);

    res.json({
      message: 'Password reset instructions sent to your email.',
      // Only for development - remove in production
      ...(process.env.NODE_ENV !== 'production' && { devToken: resetToken })
    });
  } catch (error) {
    next(error);
  }
});

// POST /auth/reset-password - Reset password with token
router.post('/reset-password', async (req, res, next) => {
  try {
    await connectToDatabase();
    const { token, password } = req.body || {};

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and new password are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const users = getCollection('users');

    const user = await users.findOne({
      resetPasswordToken: tokenHash,
      resetPasswordExpiry: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token.' });
    }

    // Hash new password and update user
    const hashedPassword = await bcrypt.hash(password, 12);
    await users.updateOne(
      { _id: user._id },
      {
        $set: {
          password: hashedPassword,
          updatedAt: new Date(),
        },
        $unset: {
          resetPasswordToken: '',
          resetPasswordExpiry: '',
        },
      }
    );

    res.json({ message: 'Password reset successful. You can now login with your new password.' });
  } catch (error) {
    next(error);
  }
});

function sanitizeUser(user) {
  return {
    id: user._id?.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export default router;

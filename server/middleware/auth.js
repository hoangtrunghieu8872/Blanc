import jwt from 'jsonwebtoken';
import { getClientIp } from '../lib/security.js';
import { getPlatformSettings } from '../lib/platformSettings.js';

const jwtSecret = process.env.JWT_SECRET;
const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'auth_token';
const CSRF_COOKIE_NAME = process.env.CSRF_COOKIE_NAME || 'csrf_token';

const TOKENS_INVALID_BEFORE_CACHE_TTL_MS = 30_000;
let tokensInvalidBeforeCache = {
  valueMs: 0,
  fetchedAtMs: 0,
};
let tokensInvalidBeforeInFlight = null;

async function getTokensInvalidBeforeMs() {
  const now = Date.now();
  if (now - tokensInvalidBeforeCache.fetchedAtMs < TOKENS_INVALID_BEFORE_CACHE_TTL_MS) {
    return tokensInvalidBeforeCache.valueMs;
  }

  if (tokensInvalidBeforeInFlight) {
    return tokensInvalidBeforeInFlight;
  }

  tokensInvalidBeforeInFlight = (async () => {
    try {
      const settings = await getPlatformSettings();
      const raw = settings?.security?.tokensInvalidBefore;
      const parsed = raw ? new Date(raw).getTime() : 0;
      const valueMs = Number.isFinite(parsed) ? parsed : 0;
      tokensInvalidBeforeCache = { valueMs, fetchedAtMs: now };
      return valueMs;
    } catch (err) {
      // Fail open on settings read issues to preserve availability.
      tokensInvalidBeforeCache.fetchedAtMs = now;
      return tokensInvalidBeforeCache.valueMs;
    } finally {
      tokensInvalidBeforeInFlight = null;
    }
  })();

  return tokensInvalidBeforeInFlight;
}

function parseCookies(cookieHeader = '') {
  const header = String(cookieHeader || '');
  if (!header) return {};
  return header.split(';').reduce((acc, part) => {
    const [rawKey, ...rest] = part.split('=');
    const key = rawKey?.trim();
    if (!key) return acc;
    const value = rest.join('=').trim();
    acc[key] = decodeURIComponent(value);
    return acc;
  }, {});
}

function isSafeMethod(method) {
  const m = String(method || '').toUpperCase();
  return m === 'GET' || m === 'HEAD' || m === 'OPTIONS';
}

/**
 * Middleware to guard protected routes with JWT authentication
 * Supports both Bearer token and cookie-based authentication
 */

export async function authGuard(req, res, next) {
  if (!jwtSecret) {
    console.error('[Auth] JWT_SECRET is not configured');
    return res.status(500).json({ error: 'Authentication service is not configured' });
  }

  const header = req.headers.authorization || '';
  let token = header.startsWith('Bearer ') ? header.slice(7) : null;
  let tokenFromCookie = false;
  let cookies = null;

  if (!token) {
    cookies = parseCookies(req.headers.cookie);
    const cookieToken = cookies[AUTH_COOKIE_NAME];
    if (cookieToken) {
      token = cookieToken;
      tokenFromCookie = true;
    }
  }

  if (!token) {
    // Log failed auth attempt
    const ip = getClientIp(req);
    console.warn(`[Auth] Unauthorized attempt from ${ip}: ${req.method} ${req.path}`);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // CSRF protection for cookie-based auth on state-changing requests
  if (tokenFromCookie && !isSafeMethod(req.method)) {
    cookies = cookies || parseCookies(req.headers.cookie);
    const csrfCookie = cookies[CSRF_COOKIE_NAME];
    const csrfHeaderRaw = req.headers['x-csrf-token'];
    const csrfHeader = Array.isArray(csrfHeaderRaw) ? csrfHeaderRaw[0] : csrfHeaderRaw;

    if (!csrfCookie || !csrfHeader || String(csrfCookie) !== String(csrfHeader)) {
      const ip = getClientIp(req);
      console.warn(`[Auth] CSRF token mismatch from ${ip}: ${req.method} ${req.path}`);
      return res.status(403).json({ error: 'CSRF token mismatch' });
    }
  }

  try {
    const payload = jwt.verify(token, jwtSecret);

    // Global session revocation (admin "reset sessions")
    const invalidBeforeMs = await getTokensInvalidBeforeMs();
    if (invalidBeforeMs > 0) {
      const issuedAtMs =
        payload && typeof payload === 'object' && typeof payload.iat === 'number'
          ? payload.iat * 1000
          : 0;

      if (!issuedAtMs || issuedAtMs < invalidBeforeMs) {
        const ip = getClientIp(req);
        console.warn(`[Auth] Token revoked by global reset from ${ip}: ${req.method} ${req.path}`);
        return res.status(401).json({ error: 'Session expired' });
      }
    }

    req.user = payload;
    req.clientIp = getClientIp(req);
    return next();
  } catch (err) {
    const ip = getClientIp(req);
    if (err.name === 'TokenExpiredError') {
      console.warn(`[Auth] Expired token from ${ip}: ${req.method} ${req.path}`);
      return res.status(401).json({ error: 'Token expired' });
    }
    if (err.name === 'JsonWebTokenError') {
      console.warn(`[Auth] Invalid token from ${ip}: ${req.method} ${req.path}`);
      return res.status(401).json({ error: 'Invalid token' });
    }
    console.error('[Auth] JWT verification error:', err.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userRole = req.user.role;
    const allowed = userRole === role || (role === 'admin' && userRole === 'super_admin');

    if (!allowed) {
      const ip = getClientIp(req);
      console.warn(`[Auth] Access denied for role ${userRole} to ${role} endpoint from ${ip}`);
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    return next();
  };
}

/**
 * Middleware to require admin or super_admin role
 */
export function requireAdmin() {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';
    if (!isAdmin) {
      const ip = getClientIp(req);
      console.warn(`[Auth] Admin access denied for user ${req.user.id} from ${ip}`);
      return res.status(403).json({ error: 'Admin access required' });
    }

    return next();
  };
}

export function issueToken(user) {
  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not configured');
  }
  const payload = {
    id: user._id?.toString() || user.id,
    role: user.role || 'student',
    email: user.email,
  };

  return jwt.sign(payload, jwtSecret, { expiresIn: '1d' });
}

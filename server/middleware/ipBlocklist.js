import { connectToDatabase, getCollection } from '../lib/db.js';
import { getClientIp } from '../lib/security.js';

const DEFAULT_CACHE_TTL_MS = 30_000;
const CACHE_TTL_MS = Math.max(
  1_000,
  Number.parseInt(process.env.BLOCKLIST_CACHE_TTL_MS || '', 10) || DEFAULT_CACHE_TTL_MS
);

const cache = new Map();

function shouldSkipIp(value) {
  const ip = String(value || '').trim();
  return !ip || ip === '-' || ip === 'unknown';
}

function pruneCache(nowMs) {
  for (const [key, entry] of cache.entries()) {
    if (!entry || entry.expiresAtMs <= nowMs) {
      cache.delete(key);
    }
  }
}

/**
 * Best-effort IP blocklist middleware (admin-managed via blocked_ips collection).
 * Fail-open if DB is unavailable to preserve availability.
 */
export async function ipBlocklist(req, res, next) {
  const ip = getClientIp(req);
  if (shouldSkipIp(ip)) return next();

  const nowMs = Date.now();
  const cached = cache.get(ip);
  if (cached && cached.expiresAtMs > nowMs) {
    if (cached.blocked) {
      return res.status(403).json({
        error: 'IP blocked',
        until: cached.until || null,
        reason: cached.reason || null,
      });
    }
    return next();
  }

  // Periodic prune to prevent unbounded growth.
  if (cache.size > 10_000) pruneCache(nowMs);

  try {
    await connectToDatabase();
    const blockedIps = getCollection('blocked_ips');

    const record = await blockedIps.findOne(
      { ip, expiresAt: { $gt: new Date() } },
      { projection: { reason: 1, expiresAt: 1 } }
    );

    if (record) {
      const until = record.expiresAt ? new Date(record.expiresAt).toISOString() : null;
      cache.set(ip, {
        blocked: true,
        expiresAtMs: nowMs + CACHE_TTL_MS,
        until,
        reason: record.reason || null,
      });

      return res.status(403).json({
        error: 'IP blocked',
        until,
        reason: record.reason || null,
      });
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[ip-blocklist] lookup failed:', err?.message || err);
  }

  cache.set(ip, { blocked: false, expiresAtMs: nowMs + CACHE_TTL_MS });
  return next();
}


const ILLEGAL_KEY_NAMES = new Set(['__proto__', 'prototype', 'constructor']);

function isPlainObject(value) {
  if (!value || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function hasIllegalKeys(value, depth = 0) {
  // Prevent deep recursion abuse
  if (depth > 50) return true;

  if (Array.isArray(value)) {
    for (const entry of value) {
      if (hasIllegalKeys(entry, depth + 1)) return true;
    }
    return false;
  }

  if (!isPlainObject(value)) return false;

  for (const key of Object.keys(value)) {
    if (ILLEGAL_KEY_NAMES.has(key)) return true;
    if (key.startsWith('$') || key.includes('.')) return true;
    if (hasIllegalKeys(value[key], depth + 1)) return true;
  }

  return false;
}

/**
 * Basic request sanitizer to reduce NoSQL injection / prototype pollution risk.
 * Rejects payloads that contain:
 * - keys starting with `$` (Mongo operators)
 * - keys containing `.` (Mongo dot notation)
 * - `__proto__` / `constructor` / `prototype`
 */
export function requestSanitizer(req, res, next) {
  try {
    if (hasIllegalKeys(req.body) || hasIllegalKeys(req.query)) {
      return res.status(400).json({ error: 'Invalid request payload' });
    }
    return next();
  } catch (err) {
    return res.status(400).json({ error: 'Invalid request payload' });
  }
}


import { sendTelegramMessage } from './telegram.js';

function parseNumberEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const n = Number.parseInt(String(raw), 10);
  return Number.isFinite(n) ? n : fallback;
}

function getIp(req) {
  return req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
}

function getUserAgent(req) {
  return (req.headers['user-agent'] || '').toString();
}

function buildKey(req) {
  const ip = getIp(req);
  const ua = getUserAgent(req).slice(0, 120);
  return `ip:${ip}|ua:${ua}`;
}

function formatDuration(ms) {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  return `${hours}h`;
}

export function createConcurrentUsersMonitor(options = {}) {
  const windowMs =
    options.windowMs ??
    parseNumberEnv('CONCURRENT_USER_WINDOW_MS', 5 * 60 * 1000);
  const threshold =
    options.threshold ??
    parseNumberEnv('CONCURRENT_USER_THRESHOLD', 500);
  const cooldownMs =
    options.cooldownMs ??
    parseNumberEnv('CONCURRENT_USER_NOTIFY_COOLDOWN_MS', 30 * 60 * 1000);
  const pruneIntervalMs =
    options.pruneIntervalMs ??
    parseNumberEnv('CONCURRENT_USER_PRUNE_INTERVAL_MS', 15 * 1000);
  const hysteresis =
    options.hysteresis ??
    parseNumberEnv('CONCURRENT_USER_HYSTERESIS', 25);

  const enabled =
    options.enabled ??
    (process.env.CONCURRENT_USER_ALERT_ENABLED
      ? process.env.CONCURRENT_USER_ALERT_ENABLED.toLowerCase() === 'true'
      : true);

  const notify =
    options.notify ??
    (async (payload) => {
      const now = new Date(payload.timestamp).toISOString();
      const msg = [
        `🚀 Người dùng online đồng thời vượt ${payload.threshold}`,
        `Hiện tại: ${payload.count} (đỉnh: ${payload.peak})`,
        `Cửa sổ: ${payload.window}`,
        `Thời gian: ${now}`,
      ].join('\n');
      await sendTelegramMessage(msg);
    });

  const active = new Map();
  let lastPruneAt = 0;
  let lastNotifiedAt = 0;
  let wasAbove = false;
  let peak = 0;

  function prune(now) {
    if (now - lastPruneAt < pruneIntervalMs) return;
    for (const [key, lastSeen] of active) {
      if (now - lastSeen > windowMs) active.delete(key);
    }
    lastPruneAt = now;
  }

  async function maybeNotify(now, count) {
    if (!enabled) return;
    if (count > peak) peak = count;

    const above = count > threshold;
    const canNotify = now - lastNotifiedAt >= cooldownMs;

    if (!wasAbove && above && canNotify) {
      lastNotifiedAt = now;
      wasAbove = true;
      try {
        await notify({
          count,
          peak,
          threshold,
          window: formatDuration(windowMs),
          timestamp: now,
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[concurrent-users] notify failed:', err?.message || err);
      }
      return;
    }

    if (wasAbove && count <= Math.max(0, threshold - hysteresis)) {
      wasAbove = false;
      peak = count;
    }
  }

  function track(req, nowMs = Date.now()) {
    prune(nowMs);
    const key = buildKey(req);
    active.set(key, nowMs);
    const count = active.size;
    void maybeNotify(nowMs, count);
    return { count };
  }

  function getCount(nowMs = Date.now()) {
    prune(nowMs);
    return active.size;
  }

  return { track, getCount };
}

const defaultMonitor = createConcurrentUsersMonitor();

export function trackConcurrentUsers(req) {
  return defaultMonitor.track(req);
}


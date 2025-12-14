export const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Get start of day in Vietnam (UTC+7), returned as a UTC Date.
 * Example: 2025-12-14 00:00 (VN) => 2025-12-13T17:00:00.000Z
 */
export function getVietnamStartOfDay(date = new Date()) {
  const vietnamTime = new Date(date.getTime() + VIETNAM_OFFSET_MS);
  vietnamTime.setUTCHours(0, 0, 0, 0);
  return new Date(vietnamTime.getTime() - VIETNAM_OFFSET_MS);
}


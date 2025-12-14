export const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;

export function getVietnamDate(nowMs: number = Date.now()): string {
  return new Date(nowMs + VIETNAM_OFFSET_MS).toISOString().slice(0, 10); // YYYY-MM-DD
}


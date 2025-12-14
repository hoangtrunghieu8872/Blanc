// @vitest-environment node

import { getVietnamStartOfDay } from '../../server/lib/time.js';

describe('getVietnamStartOfDay', () => {
  it('returns Vietnam midnight (UTC) for a time within that Vietnam day', () => {
    const date = new Date('2025-12-13T18:00:00.000Z'); // 2025-12-14 01:00 in VN
    expect(getVietnamStartOfDay(date).toISOString()).toBe('2025-12-13T17:00:00.000Z');
  });

  it('handles boundary around Vietnam midnight correctly', () => {
    const beforeMidnight = new Date('2025-12-13T16:59:59.000Z'); // 2025-12-13 23:59:59 in VN
    expect(getVietnamStartOfDay(beforeMidnight).toISOString()).toBe('2025-12-12T17:00:00.000Z');

    const atMidnight = new Date('2025-12-13T17:00:00.000Z'); // 2025-12-14 00:00 in VN
    expect(getVietnamStartOfDay(atMidnight).toISOString()).toBe('2025-12-13T17:00:00.000Z');
  });
});

import { getVietnamDate } from '../../services/streakTime';

describe('getVietnamDate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the correct Vietnam date at 01:00 (VN)', () => {
    vi.setSystemTime(new Date('2025-12-13T18:00:00.000Z')); // 2025-12-14 01:00 in VN
    expect(getVietnamDate()).toBe('2025-12-14');
  });

  it('rolls over at Vietnam midnight', () => {
    vi.setSystemTime(new Date('2025-12-14T16:59:59.000Z')); // 23:59:59 in VN
    expect(getVietnamDate()).toBe('2025-12-14');

    vi.setSystemTime(new Date('2025-12-14T17:00:00.000Z')); // 00:00:00 next day in VN
    expect(getVietnamDate()).toBe('2025-12-15');
  });
});


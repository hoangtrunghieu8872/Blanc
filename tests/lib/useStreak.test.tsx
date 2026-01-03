import React from 'react';
import { act, render } from '@testing-library/react';

import { useStreak } from '../../lib/hooks';
import { checkin } from '../../services/streakService';

vi.mock('../../services/streakService', () => ({
  checkin: vi.fn(),
  getStreak: vi.fn(),
  refreshStreak: vi.fn(),
  clearStreakCache: vi.fn(),
}));

function Harness({ userId }: { userId: string }) {
  useStreak({ autoCheckin: true, userId });
  return null;
}

describe('useStreak', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-12-13T18:00:00.000Z')); // 2025-12-14 in VN
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('auto-checkins again when Vietnam day changes on focus', async () => {
    const checkinMock = checkin as unknown as ReturnType<typeof vi.fn>;
    checkinMock.mockResolvedValue({
      currentStreak: 1,
      longestStreak: 1,
      lastActivityDate: null,
      todayCheckedIn: true,
      isNewStreak: false,
      message: 'ok',
    });

    const { unmount } = render(<Harness userId="user1" />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(checkinMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await Promise.resolve();
    });
    expect(checkinMock).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date('2025-12-14T18:00:00.000Z')); // 2025-12-15 in VN
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await Promise.resolve();
    });

    expect(checkinMock).toHaveBeenCalledTimes(2);

    unmount();
  });
});

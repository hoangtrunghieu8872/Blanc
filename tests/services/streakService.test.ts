vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

type MockedApi = {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

async function getApiMock(): Promise<MockedApi> {
  const mod = await import('@/lib/api');
  return mod.api as unknown as MockedApi;
}

describe('streakService', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-12-13T18:00:00.000Z')); // 2025-12-14 in VN
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('getStreak uses today cache and skips API', async () => {
    const api = await getApiMock();
    api.get.mockImplementation(() => {
      throw new Error('API should not be called when cache is valid');
    });

    localStorage.setItem(
      'user_streak_cache_user1',
      JSON.stringify({
        data: {
          currentStreak: 2,
          longestStreak: 5,
          lastActivityDate: null,
          todayCheckedIn: false,
        },
        date: '2025-12-14',
        userId: 'user1',
      })
    );

    const { getStreak } = await import('../../services/streakService');
    const data = await getStreak('user1');

    expect(data.currentStreak).toBe(2);
    expect(api.get).not.toHaveBeenCalled();
  });

  it('getStreak ignores legacy cache when userId is provided (prevents cross-account leak)', async () => {
    const api = await getApiMock();
    api.get.mockResolvedValue({
      currentStreak: 9,
      longestStreak: 9,
      lastActivityDate: null,
      todayCheckedIn: false,
    });

    localStorage.setItem(
      'user_streak_cache',
      JSON.stringify({
        data: {
          currentStreak: 2,
          longestStreak: 5,
          lastActivityDate: null,
          todayCheckedIn: false,
        },
        date: '2025-12-14',
      })
    );

    const { getStreak } = await import('../../services/streakService');
    const data = await getStreak('user1');

    expect(api.get).toHaveBeenCalledTimes(1);
    expect(data.currentStreak).toBe(9);
    expect(localStorage.getItem('user_streak_cache')).toBeNull();
    expect(localStorage.getItem('user_streak_cache_user1')).toBeTruthy();
  });

  it('getStreak migrates legacy cache when it is scoped to the same userId', async () => {
    const api = await getApiMock();
    api.get.mockImplementation(() => {
      throw new Error('API should not be called when scoped legacy cache is valid');
    });

    localStorage.setItem(
      'user_streak_cache',
      JSON.stringify({
        data: {
          currentStreak: 4,
          longestStreak: 10,
          lastActivityDate: null,
          todayCheckedIn: true,
        },
        date: '2025-12-14',
        userId: 'user1',
      })
    );

    const { getStreak } = await import('../../services/streakService');
    const data = await getStreak('user1');

    expect(api.get).not.toHaveBeenCalled();
    expect(data.currentStreak).toBe(4);
    expect(localStorage.getItem('user_streak_cache')).toBeNull();
    expect(localStorage.getItem('user_streak_cache_user1')).toBeTruthy();
  });

  it('getStreak invalidates stale cache and fetches API', async () => {
    const api = await getApiMock();
    api.get.mockResolvedValue({
      currentStreak: 10,
      longestStreak: 20,
      lastActivityDate: '2025-12-14T00:00:00.000Z',
      todayCheckedIn: true,
    });

    localStorage.setItem(
      'user_streak_cache_user1',
      JSON.stringify({
        data: {
          currentStreak: 2,
          longestStreak: 5,
          lastActivityDate: null,
          todayCheckedIn: false,
        },
        date: '2025-12-13',
        userId: 'user1',
      })
    );

    const { getStreak } = await import('../../services/streakService');
    const data = await getStreak('user1');

    expect(api.get).toHaveBeenCalledTimes(1);
    expect(data.currentStreak).toBe(10);

    const cached = JSON.parse(localStorage.getItem('user_streak_cache_user1') || 'null');
    expect(cached?.date).toBe('2025-12-14');
    expect(cached?.data?.currentStreak).toBe(10);
  });

  it('checkin skips API when already checked in today (local)', async () => {
    const api = await getApiMock();
    api.post.mockImplementation(() => {
      throw new Error('API should not be called when already checked in today');
    });

    localStorage.setItem('streak_last_checkin_user1', '2025-12-14');
    localStorage.setItem(
      'user_streak_cache_user1',
      JSON.stringify({
        data: {
          currentStreak: 3,
          longestStreak: 7,
          lastActivityDate: '2025-12-14T00:00:00.000Z',
          todayCheckedIn: true,
        },
        date: '2025-12-14',
        userId: 'user1',
      })
    );

    const { checkin } = await import('../../services/streakService');
    const response = await checkin('user1');

    expect(api.post).not.toHaveBeenCalled();
    expect(response.todayCheckedIn).toBe(true);
    expect(response.isNewStreak).toBe(false);
    expect(response.currentStreak).toBe(3);
  });

  it('checkin deduplicates concurrent requests', async () => {
    const api = await getApiMock();

    let resolvePost!: (value: unknown) => void;
    const postPromise = new Promise((resolve) => {
      resolvePost = resolve;
    });

    api.post.mockReturnValue(postPromise);

    const { checkin } = await import('../../services/streakService');

    const p1 = checkin('user1');
    const p2 = checkin('user1');

    expect(api.post).toHaveBeenCalledTimes(1);

    resolvePost({
      currentStreak: 4,
      longestStreak: 9,
      lastActivityDate: '2025-12-14T00:00:00.000Z',
      todayCheckedIn: true,
      isNewStreak: false,
      message: 'ok',
    });

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.currentStreak).toBe(4);
    expect(r2.currentStreak).toBe(4);
  });
});

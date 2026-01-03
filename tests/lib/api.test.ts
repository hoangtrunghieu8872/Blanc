import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function makeResponse<T>(payload: { ok: boolean; status: number; json?: () => Promise<T> }) {
  return {
    ok: payload.ok,
    status: payload.status,
    json: payload.json ?? (async () => ({} as T)),
  } satisfies Pick<Response, 'ok' | 'status' | 'json'>;
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('lib/api', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    document.cookie = 'csrf_token=; Max-Age=0; path=/';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('deduplicates concurrent GET requests to the same endpoint', async () => {
    vi.resetModules();

    const deferred = createDeferred<Pick<Response, 'ok' | 'status' | 'json'>>();
    const fetchMock = vi.fn().mockReturnValue(deferred.promise);
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const { api } = await import('../../lib/api');

    const p1 = api.get('/stats');
    const p2 = api.get('/stats');

    expect(fetchMock).toHaveBeenCalledTimes(1);

    deferred.resolve(
      makeResponse({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      })
    );

    await expect(p1).resolves.toEqual({ ok: true });
    await expect(p2).resolves.toEqual({ ok: true });
  });

  it('adds CSRF header for cookie-based POST requests when csrf_token cookie exists', async () => {
    vi.resetModules();

    document.cookie = 'csrf_token=abc123; path=/';

    const fetchMock = vi.fn().mockResolvedValue(
      makeResponse({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      })
    );
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const { api } = await import('../../lib/api');
    await api.post('/auth/login', { email: 'a@b.com' });

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(options.credentials).toBe('include');
    expect(options.method).toBe('POST');

    const headers = options.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['X-CSRF-Token']).toBe('abc123');
  });

  it('caches successful GET responses when useCache is enabled', async () => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));

    const fetchMock = vi.fn().mockResolvedValue(
      makeResponse({
        ok: true,
        status: 200,
        json: async () => ({ count: 123 }),
      })
    );
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const { cachedApi } = await import('../../lib/api');

    await expect(cachedApi.getStats()).resolves.toEqual({ count: 123 });
    await expect(cachedApi.getStats()).resolves.toEqual({ count: 123 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('throws server-provided error message when response is not ok', async () => {
    vi.resetModules();

    const fetchMock = vi.fn().mockResolvedValue(
      makeResponse({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Bad request' }),
      })
    );
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const { api } = await import('../../lib/api');
    await expect(api.get('/stats')).rejects.toThrow('Bad request');
  });
});


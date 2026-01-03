// @vitest-environment node

vi.mock('../../server/lib/platformSettings.js', () => ({
  getPlatformSettings: vi.fn(async () => ({ security: {} })),
}));

function makeRes() {
  let statusCode = null;
  let jsonBody = null;
  const res = {
    status(code) {
      statusCode = code;
      return res;
    },
    json(payload) {
      jsonBody = payload;
      return res;
    },
    get statusCode() {
      return statusCode;
    },
    get jsonBody() {
      return jsonBody;
    },
  };
  return res;
}

describe('auth middleware', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.JWT_SECRET = 'test-jwt-secret-32-characters-minimum!';
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
    delete process.env.AUTH_COOKIE_NAME;
    delete process.env.CSRF_COOKIE_NAME;
  });

  it('rejects when missing token', async () => {
    vi.resetModules();
    const { authGuard } = await import('../../server/middleware/auth.js');

    const req = { method: 'GET', path: '/api/admin/stats', headers: {} };
    const res = makeRes();
    let nextCalled = false;

    await authGuard(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(401);
    expect(res.jsonBody).toEqual({ error: 'Unauthorized' });
  });

  it('accepts Bearer token without CSRF header', async () => {
    vi.resetModules();
    const { authGuard, issueToken } = await import('../../server/middleware/auth.js');

    const token = issueToken({ id: 'user1', role: 'student', email: 'u@example.com' });
    const req = { method: 'POST', path: '/api/users/me/profile', headers: { authorization: `Bearer ${token}` } };
    const res = makeRes();
    let nextCalled = false;

    await authGuard(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
    expect(res.statusCode).toBe(null);
    expect(req.user?.id).toBe('user1');
  });

  it('rejects cookie auth for state-changing requests without CSRF header', async () => {
    vi.resetModules();
    const { authGuard, issueToken } = await import('../../server/middleware/auth.js');

    const token = issueToken({ id: 'user1', role: 'student', email: 'u@example.com' });
    const req = {
      method: 'POST',
      path: '/api/users/me/profile',
      headers: {
        cookie: `auth_token=${encodeURIComponent(token)}; csrf_token=abc`,
      },
    };
    const res = makeRes();
    let nextCalled = false;

    await authGuard(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(403);
    expect(res.jsonBody).toEqual({ error: 'CSRF token mismatch' });
  });

  it('accepts cookie auth when CSRF header matches csrf cookie', async () => {
    vi.resetModules();
    const { authGuard, issueToken } = await import('../../server/middleware/auth.js');

    const token = issueToken({ id: 'user1', role: 'student', email: 'u@example.com' });
    const req = {
      method: 'POST',
      path: '/api/users/me/profile',
      headers: {
        cookie: `auth_token=${encodeURIComponent(token)}; csrf_token=abc`,
        'x-csrf-token': 'abc',
      },
    };
    const res = makeRes();
    let nextCalled = false;

    await authGuard(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
    expect(res.statusCode).toBe(null);
    expect(req.user?.id).toBe('user1');
  });

  it('requireAdmin rejects non-admin users', async () => {
    vi.resetModules();
    const { requireAdmin } = await import('../../server/middleware/auth.js');
    const middleware = requireAdmin();

    const req = { user: { id: 'u1', role: 'student' }, headers: {}, ip: '1.1.1.1', method: 'GET', path: '/api/admin' };
    const res = makeRes();
    let nextCalled = false;

    middleware(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(403);
    expect(res.jsonBody).toEqual({ error: 'Admin access required' });
  });

  it('requireRole allows super_admin to access admin endpoints', async () => {
    vi.resetModules();
    const { requireRole } = await import('../../server/middleware/auth.js');
    const middleware = requireRole('admin');

    const req = { user: { id: 'u1', role: 'super_admin' }, headers: {}, ip: '1.1.1.1', method: 'GET', path: '/api/admin' };
    const res = makeRes();
    let nextCalled = false;

    middleware(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
    expect(res.statusCode).toBe(null);
  });
});

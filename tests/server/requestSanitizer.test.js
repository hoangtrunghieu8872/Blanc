// @vitest-environment node

import { requestSanitizer } from '../../server/middleware/requestSanitizer.js';

function run(body, query) {
  let statusCode = null;
  let jsonBody = null;
  let nextCalled = false;

  const req = { body, query };
  const res = {
    status(code) {
      statusCode = code;
      return res;
    },
    json(payload) {
      jsonBody = payload;
      return res;
    },
  };

  requestSanitizer(req, res, () => {
    nextCalled = true;
  });

  return { statusCode, jsonBody, nextCalled };
}

function makeDeepObject(depth) {
  let obj = {};
  for (let i = 0; i < depth; i++) {
    obj = { nested: obj };
  }
  return obj;
}

describe('requestSanitizer', () => {
  it('allows safe payloads', () => {
    const result = run({ name: 'ok', tags: ['a', 'b'], nested: { a: 1 } }, { page: '1' });
    expect(result.nextCalled).toBe(true);
    expect(result.statusCode).toBe(null);
  });

  it('rejects Mongo operator keys starting with $', () => {
    const result = run({ $where: 'return true' }, {});
    expect(result.nextCalled).toBe(false);
    expect(result.statusCode).toBe(400);
    expect(result.jsonBody).toEqual({ error: 'Invalid request payload' });
  });

  it('rejects keys containing dot notation', () => {
    const result = run({ 'profile.name': 'x' }, {});
    expect(result.nextCalled).toBe(false);
    expect(result.statusCode).toBe(400);
  });

  it('rejects prototype pollution keys', () => {
    const payload = { ['__proto__']: { polluted: true } };
    const result = run(payload, {});
    expect(result.nextCalled).toBe(false);
    expect(result.statusCode).toBe(400);
  });

  it('rejects deep recursion abuse', () => {
    const result = run(makeDeepObject(60), {});
    expect(result.nextCalled).toBe(false);
    expect(result.statusCode).toBe(400);
  });

  it('rejects illegal keys inside arrays', () => {
    const result = run({ items: [{ ok: 1 }, { $ne: 2 }] }, {});
    expect(result.nextCalled).toBe(false);
    expect(result.statusCode).toBe(400);
  });
});

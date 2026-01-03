// @vitest-environment node

import { callOpenRouterChat, parseChatModels } from '../../server/lib/openrouter.js';

function makeResponse({ ok, status, json, text }) {
  return {
    ok,
    status,
    json: json ?? (async () => ({})),
    text: text ?? (async () => ''),
  };
}

describe('openrouter', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parseChatModels returns defaults when empty', () => {
    const parsed = parseChatModels('');
    expect(parsed.length).toBeGreaterThan(0);
  });

  it('falls back to next model on 404', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        makeResponse({
          ok: false,
          status: 404,
          text: async () => '{"error":{"message":"Model not found"}}',
        })
      )
      .mockResolvedValueOnce(
        makeResponse({
          ok: true,
          status: 200,
          json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
        })
      );

    const result = await callOpenRouterChat({
      apiKey: 'test-key',
      models: ['bad/model', 'good/model'],
      messages: [{ role: 'user', content: 'hi' }],
      fetchFn,
    });

    expect(result.model).toBe('good/model');
    expect(result.content).toBe('ok');
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('falls back on 400 when body indicates model/provider issue', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        makeResponse({
          ok: false,
          status: 400,
          text: async () => 'Unsupported model',
        })
      )
      .mockResolvedValueOnce(
        makeResponse({
          ok: true,
          status: 200,
          json: async () => ({ choices: [{ message: { content: 'ok2' } }] }),
        })
      );

    const result = await callOpenRouterChat({
      apiKey: 'test-key',
      models: ['bad/model', 'good/model'],
      messages: [{ role: 'user', content: 'hi' }],
      fetchFn,
    });

    expect(result.model).toBe('good/model');
    expect(result.content).toBe('ok2');
  });

  it('does not fall back on 401', async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(
      makeResponse({
        ok: false,
        status: 401,
        text: async () => '{"error":{"message":"User not found","code":401}}',
      })
    );

    await expect(
      callOpenRouterChat({
        apiKey: 'bad-key',
        models: ['any/model', 'next/model'],
        messages: [{ role: 'user', content: 'hi' }],
        fetchFn,
      })
    ).rejects.toMatchObject({ status: 401, model: 'any/model' });

    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('throws 503 after exhausting models', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      makeResponse({
        ok: false,
        status: 429,
        text: async () => 'Rate limited',
      })
    );

    await expect(
      callOpenRouterChat({
        apiKey: 'test-key',
        models: ['m1', 'm2', 'm3'],
        messages: [{ role: 'user', content: 'hi' }],
        fetchFn,
      })
    ).rejects.toMatchObject({ status: 503 });

    expect(fetchFn).toHaveBeenCalledTimes(3);
  });
});


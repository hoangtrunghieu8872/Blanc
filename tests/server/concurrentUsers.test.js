// @vitest-environment node

import { createConcurrentUsersMonitor } from '../../server/lib/concurrentUsers.js';

function makeReq(ip, ua = 'ua') {
  return {
    ip,
    headers: { 'user-agent': ua },
    socket: { remoteAddress: ip },
  };
}

describe('createConcurrentUsersMonitor', () => {
  it('notifies once when crossing above threshold', () => {
    const notify = vi.fn(async () => {});
    const monitor = createConcurrentUsersMonitor({
      enabled: true,
      threshold: 2,
      hysteresis: 0,
      windowMs: 60_000,
      pruneIntervalMs: 0,
      cooldownMs: 0,
      notify,
    });

    monitor.track(makeReq('1.1.1.1'), 0);
    monitor.track(makeReq('2.2.2.2'), 0);
    expect(notify).toHaveBeenCalledTimes(0);

    monitor.track(makeReq('3.3.3.3'), 0);
    expect(notify).toHaveBeenCalledTimes(1);

    monitor.track(makeReq('4.4.4.4'), 0);
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('can notify again after dropping below threshold (via expiry)', () => {
    const notify = vi.fn(async () => {});
    const monitor = createConcurrentUsersMonitor({
      enabled: true,
      threshold: 2,
      hysteresis: 0,
      windowMs: 1000,
      pruneIntervalMs: 0,
      cooldownMs: 0,
      notify,
    });

    monitor.track(makeReq('1.1.1.1'), 0);
    monitor.track(makeReq('2.2.2.2'), 0);
    monitor.track(makeReq('3.3.3.3'), 0);
    expect(notify).toHaveBeenCalledTimes(1);

    // Expire all previous users, leaving only the new ping
    monitor.track(makeReq('9.9.9.9'), 2000);
    expect(monitor.getCount(2000)).toBe(1);

    monitor.track(makeReq('8.8.8.8'), 2000);
    monitor.track(makeReq('7.7.7.7'), 2000);
    expect(notify).toHaveBeenCalledTimes(2);
  });
});


import { describe, expect, it, beforeEach } from 'vitest';
import {
  computeNewMembershipFromPurchase,
  extractOrderCodeFromContent,
  getEffectiveTier,
  getMembershipEntitlements,
  normalizeTier,
} from '../../server/lib/membership.js';

describe('membership', () => {
  beforeEach(() => {
    process.env.MEMBERSHIP_ORDER_PREFIX = 'CHUB';
  });

  it('normalizes tiers safely', () => {
    expect(normalizeTier('PLUS')).toBe('plus');
    expect(normalizeTier('pro')).toBe('pro');
    expect(normalizeTier('Business')).toBe('business');
    expect(normalizeTier('unknown')).toBe('free');
    expect(normalizeTier(undefined)).toBe('free');
  });

  it('extracts orderCode from transfer content', () => {
    expect(extractOrderCodeFromContent('Thanh toan CHUB-ABC1234567')).toBe('CHUB-ABC1234567');
    expect(extractOrderCodeFromContent('no code here')).toBe(null);
  });

  it('prevents downgrade while higher tier active', () => {
    const now = new Date('2025-01-01T00:00:00Z');
    const current = {
      tier: 'pro',
      status: 'active',
      startedAt: new Date('2024-12-01T00:00:00Z'),
      expiresAt: new Date('2025-02-01T00:00:00Z'),
      updatedAt: new Date('2024-12-01T00:00:00Z'),
    };

    expect(() =>
      computeNewMembershipFromPurchase({
        currentMembership: current,
        purchasedTier: 'plus',
        durationDays: 30,
        now,
      })
    ).toThrow();
  });

  it('extends expiry from current expiry when active', () => {
    const now = new Date('2025-01-01T00:00:00Z');
    const currentExpiresAt = new Date('2025-01-10T00:00:00Z');
    const current = {
      tier: 'plus',
      status: 'active',
      startedAt: new Date('2024-12-01T00:00:00Z'),
      expiresAt: currentExpiresAt,
      updatedAt: new Date('2024-12-01T00:00:00Z'),
    };

    const next = computeNewMembershipFromPurchase({
      currentMembership: current,
      purchasedTier: 'plus',
      durationDays: 30,
      now,
    });

    expect(next.tier).toBe('plus');
    expect(next.expiresAt.toISOString()).toBe(new Date('2025-02-09T00:00:00.000Z').toISOString());
  });

  it('falls back to free when expired', () => {
    const membership = {
      tier: 'plus',
      status: 'active',
      startedAt: new Date('2024-12-01T00:00:00Z'),
      expiresAt: new Date('2024-12-15T00:00:00Z'),
      updatedAt: new Date('2024-12-01T00:00:00Z'),
    };

    expect(getEffectiveTier(membership, new Date('2025-01-01T00:00:00Z'))).toBe('free');
  });

  it('returns entitlements per tier', () => {
    expect(getMembershipEntitlements('free').reportsEnabled).toBe(true);
    expect(getMembershipEntitlements('plus').reportsEnabled).toBe(true);
    expect(getMembershipEntitlements('pro').chatMessagesPerHour).toBeGreaterThan(
      getMembershipEntitlements('plus').chatMessagesPerHour
    );
  });
});

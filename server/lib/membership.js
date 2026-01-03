import crypto from 'crypto';
import { ObjectId } from 'mongodb';
import { connectToDatabase, getCollection } from './db.js';

export const MEMBERSHIP_TIERS = /** @type {const} */ (['free', 'plus', 'pro', 'business']);

const TIER_RANK = {
    free: 0,
    plus: 1,
    pro: 2,
    business: 3,
};

const MEMBERSHIP_CACHE_TTL_MS = Math.max(
    5_000,
    Number.parseInt(process.env.MEMBERSHIP_CACHE_TTL_MS || '60000', 10) || 60_000
);

const membershipCache = new Map();

function normalizeDate(value) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date;
}

export function normalizeTier(value) {
    const tier = String(value || '').trim().toLowerCase();
    if (tier in TIER_RANK) return tier;
    return 'free';
}

export function isTierAtLeast(tier, requiredTier) {
    const a = TIER_RANK[normalizeTier(tier)] ?? 0;
    const b = TIER_RANK[normalizeTier(requiredTier)] ?? 0;
    return a >= b;
}

export function normalizeMembership(value) {
    const membership = value && typeof value === 'object' ? value : {};
    const tier = normalizeTier(membership.tier);

    const statusRaw = String(membership.status || '').toLowerCase();
    const status =
        statusRaw === 'canceled' || statusRaw === 'cancelled'
            ? 'canceled'
            : statusRaw === 'expired'
                ? 'expired'
                : 'active';

    const startedAt = normalizeDate(membership.startedAt);
    const expiresAt = normalizeDate(membership.expiresAt);
    const updatedAt = normalizeDate(membership.updatedAt);

    const orderIdRaw = membership.orderId || membership.lastOrderId;
    const orderId = orderIdRaw ? String(orderIdRaw) : null;

    const source = typeof membership.source === 'string' ? membership.source.slice(0, 40) : null;

    return {
        tier,
        status,
        startedAt,
        expiresAt,
        updatedAt,
        source,
        orderId,
    };
}

export function isMembershipActive(membership, now = new Date()) {
    const m = normalizeMembership(membership);
    if (m.status === 'canceled') return false;
    if (m.tier === 'free') return true;
    if (!m.expiresAt) return false;
    return m.expiresAt.getTime() > now.getTime();
}

export function getEffectiveTier(membership, now = new Date()) {
    const m = normalizeMembership(membership);
    return isMembershipActive(m, now) ? m.tier : 'free';
}

export function getMembershipSummary(membership, now = new Date()) {
    const m = normalizeMembership(membership);
    const active = isMembershipActive(m, now);
    return {
        tier: m.tier,
        effectiveTier: active ? m.tier : 'free',
        status: active ? 'active' : m.tier === 'free' ? 'active' : 'expired',
        startedAt: m.startedAt ? m.startedAt.toISOString() : null,
        expiresAt: m.expiresAt ? m.expiresAt.toISOString() : null,
        updatedAt: m.updatedAt ? m.updatedAt.toISOString() : null,
        source: m.source,
        orderId: m.orderId,
        active,
    };
}

export function getMembershipEntitlements(tier) {
    const t = normalizeTier(tier);
    switch (t) {
        case 'business':
            return {
                tier: t,
                reportsEnabled: true,
                chatMessagesPerHour: 1000,
            };
        case 'pro':
            return {
                tier: t,
                reportsEnabled: true,
                chatMessagesPerHour: 300,
            };
        case 'plus':
            return {
                tier: t,
                reportsEnabled: true,
                chatMessagesPerHour: 150,
            };
        case 'free':
        default:
            return {
                tier: 'free',
                reportsEnabled: true,
                chatMessagesPerHour: 50,
            };
    }
}

export function getMembershipPlans() {
    const plusPrice = Number.parseInt(process.env.MEMBERSHIP_PLUS_PRICE_VND || '49000', 10) || 49_000;
    const proPrice = Number.parseInt(process.env.MEMBERSHIP_PRO_PRICE_VND || '99000', 10) || 99_000;
    const businessPrice =
        Number.parseInt(process.env.MEMBERSHIP_BUSINESS_PRICE_VND || '199000', 10) || 199_000;

    const durationDays = Math.max(1, Number.parseInt(process.env.MEMBERSHIP_DURATION_DAYS || '30', 10) || 30);

    return [
        {
            id: 'plus',
            tier: 'plus',
            name: 'Plus',
            priceVnd: plusPrice,
            durationDays,
            highlights: ['Báo cáo (Reports)', 'Tăng giới hạn chat AI'],
        },
        {
            id: 'pro',
            tier: 'pro',
            name: 'Pro',
            priceVnd: proPrice,
            durationDays,
            highlights: ['Tất cả quyền lợi Plus', 'Giới hạn chat cao hơn'],
        },
        {
            id: 'business',
            tier: 'business',
            name: 'Business',
            priceVnd: businessPrice,
            durationDays,
            highlights: ['Tất cả quyền lợi Pro', 'Giới hạn chat rất cao'],
        },
    ];
}

export function generateOrderCode(prefix = process.env.MEMBERSHIP_ORDER_PREFIX || 'CHUB') {
    const safePrefix = String(prefix || 'CHUB')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 8) || 'CHUB';

    const randomHex = crypto.randomBytes(5).toString('hex').toUpperCase();
    return `${safePrefix}-${randomHex}`;
}

export function extractOrderCodeFromContent(content) {
    const text = String(content || '').toUpperCase();
    const prefix = String(process.env.MEMBERSHIP_ORDER_PREFIX || 'CHUB')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 8) || 'CHUB';

    const regex = new RegExp(`\\b${prefix}-[A-Z0-9]{6,20}\\b`, 'i');
    const match = text.match(regex);
    return match ? match[0].toUpperCase() : null;
}

export function buildVietQrUrl({ bankCode, accountNumber, accountName, amountVnd, addInfo }) {
    if (!bankCode || !accountNumber) return null;
    const amount = Math.max(0, Number(amountVnd) || 0);
    const info = String(addInfo || '').slice(0, 100);
    const name = String(accountName || '').slice(0, 100);

    const params = new URLSearchParams();
    if (amount > 0) params.set('amount', String(amount));
    if (info) params.set('addInfo', info);
    if (name) params.set('accountName', name);

    return `https://img.vietqr.io/image/${encodeURIComponent(bankCode)}-${encodeURIComponent(
        accountNumber
    )}-compact2.png?${params.toString()}`;
}

export async function getUserMembershipFromDb(userId) {
    await connectToDatabase();
    const users = getCollection('users');

    const filter = ObjectId.isValid(userId) ? { _id: new ObjectId(userId) } : { _id: userId };
    const user = await users.findOne(filter, { projection: { membership: 1 } });
    if (!user) {
        const err = new Error('User not found');
        err.status = 404;
        throw err;
    }

    return getMembershipSummary(user.membership);
}

export async function getCachedUserMembership(userId, { bypassCache = false } = {}) {
    const key = String(userId || '');
    if (!key) {
        const err = new Error('Missing userId');
        err.status = 400;
        throw err;
    }

    const now = Date.now();
    if (!bypassCache) {
        const cached = membershipCache.get(key);
        if (cached && cached.expiresAtMs > now) {
            return cached.value;
        }
    }

    const value = await getUserMembershipFromDb(key);
    membershipCache.set(key, { value, expiresAtMs: now + MEMBERSHIP_CACHE_TTL_MS });
    return value;
}

export function invalidateMembershipCache(userId) {
    if (!userId) return;
    membershipCache.delete(String(userId));
}

export function computeNewMembershipFromPurchase({
    currentMembership,
    purchasedTier,
    durationDays,
    now = new Date(),
}) {
    const tier = normalizeTier(purchasedTier);
    const d = Math.max(1, Number(durationDays) || 1);
    const current = normalizeMembership(currentMembership);

    const currentIsActive = isMembershipActive(current, now);
    const currentRank = TIER_RANK[current.tier] ?? 0;
    const purchasedRank = TIER_RANK[tier] ?? 0;

    if (currentIsActive && currentRank > purchasedRank) {
        const err = new Error('Cannot purchase a lower tier while a higher tier is active');
        err.status = 400;
        err.code = 'MEMBERSHIP_DOWNGRADE_NOT_ALLOWED';
        throw err;
    }

    const base = currentIsActive && current.expiresAt ? current.expiresAt : now;
    const expiresAt = new Date(base.getTime() + d * 24 * 60 * 60 * 1000);

    return {
        tier,
        status: 'active',
        startedAt: current.startedAt || now,
        expiresAt,
        updatedAt: now,
    };
}

export async function setUserMembership({
    userId,
    membership,
    source = 'system',
    orderId = null,
    actorUserId = null,
}) {
    await connectToDatabase();
    const users = getCollection('users');

    const filter = ObjectId.isValid(userId) ? { _id: new ObjectId(userId) } : { _id: userId };

    const patch = {
        tier: normalizeTier(membership?.tier),
        status: membership?.status === 'canceled' ? 'canceled' : 'active',
        startedAt: normalizeDate(membership?.startedAt) || new Date(),
        expiresAt: normalizeDate(membership?.expiresAt),
        updatedAt: normalizeDate(membership?.updatedAt) || new Date(),
        source: typeof source === 'string' ? source.slice(0, 40) : 'system',
        ...(orderId ? { orderId: String(orderId) } : {}),
        ...(actorUserId ? { updatedBy: String(actorUserId) } : {}),
    };

    const result = await users.findOneAndUpdate(
        filter,
        { $set: { membership: patch, updatedAt: new Date() } },
        { returnDocument: 'after' }
    );

    const updatedUser = result?.value ?? result;
    if (!updatedUser) {
        const err = new Error('User not found');
        err.status = 404;
        throw err;
    }

    invalidateMembershipCache(userId);

    return getMembershipSummary(updatedUser.membership);
}

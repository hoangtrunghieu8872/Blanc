import { getCachedUserMembership, getMembershipEntitlements, isTierAtLeast } from '../lib/membership.js';

export function requireTier(requiredTier) {
    return async (req, res, next) => {
        try {
            if (!req.user?.id) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const membership = await getCachedUserMembership(req.user.id);
            const effectiveTier = membership?.effectiveTier || 'free';

            if (!isTierAtLeast(effectiveTier, requiredTier)) {
                return res.status(403).json({
                    error: 'Bạn cần nâng cấp gói để sử dụng tính năng này.',
                    code: 'MEMBERSHIP_REQUIRED',
                    requiredTier,
                    currentTier: effectiveTier,
                });
            }

            req.membership = membership;
            req.entitlements = getMembershipEntitlements(effectiveTier);
            return next();
        } catch (err) {
            return next(err);
        }
    };
}

export function withMembership() {
    return async (req, _res, next) => {
        try {
            if (!req.user?.id) return next();
            const membership = await getCachedUserMembership(req.user.id);
            const effectiveTier = membership?.effectiveTier || 'free';
            req.membership = membership;
            req.entitlements = getMembershipEntitlements(effectiveTier);
            return next();
        } catch (err) {
            return next(err);
        }
    };
}


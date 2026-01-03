import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { connectToDatabase, getCollection } from '../lib/db.js';
import {
    buildVietQrUrl,
    computeNewMembershipFromPurchase,
    generateOrderCode,
    getCachedUserMembership,
    getMembershipEntitlements,
    getMembershipPlans,
    normalizeTier,
} from '../lib/membership.js';
import { getPlatformSettings } from '../lib/platformSettings.js';
import { authGuard } from '../middleware/auth.js';

const router = Router();

const ORDER_TTL_MINUTES = Math.max(
    5,
    Number.parseInt(process.env.MEMBERSHIP_ORDER_TTL_MINUTES || '30', 10) || 30
);

function getPaymentBankInfo() {
    return {
        bankCode: process.env.PAYMENT_BANK_CODE || process.env.BANK_CODE || '',
        accountNumber: process.env.PAYMENT_ACCOUNT_NUMBER || process.env.BANK_ACCOUNT_NUMBER || '',
        accountName: process.env.PAYMENT_ACCOUNT_NAME || process.env.BANK_ACCOUNT_NAME || '',
    };
}

function getClientMeta(req) {
    return {
        ip:
            req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
            req.headers['x-real-ip'] ||
            req.connection?.remoteAddress ||
            req.ip ||
            '-',
        userAgent: req.headers['user-agent'] || '',
    };
}

// GET /api/membership/plans (public)
router.get('/plans', (_req, res) => {
    const plans = getMembershipPlans().map((plan) => ({
        id: plan.id,
        tier: plan.tier,
        name: plan.name,
        priceVnd: plan.priceVnd,
        durationDays: plan.durationDays,
        highlights: plan.highlights,
        entitlements: getMembershipEntitlements(plan.tier),
    }));
    res.json({ plans });
});

// GET /api/membership/me
router.get('/me', authGuard, async (req, res, next) => {
    try {
        const membership = await getCachedUserMembership(req.user.id);
        const entitlements = getMembershipEntitlements(membership.effectiveTier);
        res.json({ membership, entitlements });
    } catch (err) {
        next(err);
    }
});

// POST /api/membership/checkout
router.post('/checkout', authGuard, async (req, res, next) => {
    try {
        const settings = await getPlatformSettings();
        if (!settings?.features?.paymentsEnabled) {
            return res.status(403).json({ error: 'Payments are currently disabled.' });
        }

        const { planId } = req.body || {};
        const planKey = normalizeTier(planId);
        const plan = getMembershipPlans().find((p) => p.id === planKey);
        if (!plan) {
            return res.status(400).json({ error: 'Invalid plan' });
        }

        await connectToDatabase();
        const users = getCollection('users');

        const userFilter = ObjectId.isValid(req.user.id) ? { _id: new ObjectId(req.user.id) } : { _id: req.user.id };
        const user = await users.findOne(userFilter, { projection: { membership: 1, email: 1, name: 1 } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Validate membership downgrade rule early
        computeNewMembershipFromPurchase({
            currentMembership: user.membership,
            purchasedTier: plan.tier,
            durationDays: plan.durationDays,
        });

        const now = new Date();
        const expiresAt = new Date(now.getTime() + ORDER_TTL_MINUTES * 60 * 1000);
        const orders = getCollection('payment_orders');
        const meta = getClientMeta(req);

        let inserted;
        let orderCode;
        for (let attempt = 0; attempt < 3; attempt++) {
            orderCode = generateOrderCode();
            try {
                inserted = await orders.insertOne({
                    type: 'membership',
                    provider: 'sepay',
                    status: 'pending',
                    userId: req.user.id,
                    userEmail: user.email || req.user.email,
                    userName: user.name || '',
                    planId: plan.id,
                    tier: plan.tier,
                    amountVnd: plan.priceVnd,
                    currency: 'VND',
                    orderCode,
                    createdAt: now,
                    expiresAt,
                    updatedAt: now,
                    meta,
                });
                break;
            } catch (err) {
                if (err?.code === 11000 && attempt < 2) {
                    continue;
                }
                throw err;
            }
        }

        if (!inserted?.insertedId) {
            return res.status(500).json({ error: 'Failed to create order' });
        }

        const bank = getPaymentBankInfo();
        const qrUrl = buildVietQrUrl({
            bankCode: bank.bankCode,
            accountNumber: bank.accountNumber,
            accountName: bank.accountName,
            amountVnd: plan.priceVnd,
            addInfo: orderCode,
        });

        res.status(201).json({
            order: {
                id: inserted.insertedId.toString(),
                status: 'pending',
                provider: 'sepay',
                plan: {
                    id: plan.id,
                    tier: plan.tier,
                    name: plan.name,
                    priceVnd: plan.priceVnd,
                    durationDays: plan.durationDays,
                },
                orderCode,
                amountVnd: plan.priceVnd,
                expiresAt: expiresAt.toISOString(),
            },
            payment: {
                bank,
                transferContent: orderCode,
                qrUrl,
            },
        });
    } catch (err) {
        next(err);
    }
});

// GET /api/membership/orders/:id
router.get('/orders/:id', authGuard, async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid order id' });
        }

        await connectToDatabase();
        const orders = getCollection('payment_orders');
        const order = await orders.findOne({ _id: new ObjectId(id) });
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        if (String(order.userId) !== String(req.user.id)) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        res.json({
            order: {
                id: order._id.toString(),
                status: order.status,
                provider: order.provider,
                planId: order.planId,
                tier: order.tier,
                amountVnd: order.amountVnd,
                currency: order.currency,
                orderCode: order.orderCode,
                createdAt: order.createdAt ? new Date(order.createdAt).toISOString() : null,
                expiresAt: order.expiresAt ? new Date(order.expiresAt).toISOString() : null,
                paidAt: order.paidAt ? new Date(order.paidAt).toISOString() : null,
            },
        });
    } catch (err) {
        next(err);
    }
});

export default router;


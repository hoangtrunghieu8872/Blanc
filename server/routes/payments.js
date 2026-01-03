import { Router } from 'express';
import crypto from 'crypto';
import { ObjectId } from 'mongodb';
import { connectToDatabase, getCollection } from '../lib/db.js';
import {
    extractOrderCodeFromContent,
    getMembershipPlans,
    setUserMembership,
    computeNewMembershipFromPurchase,
    normalizeMembership,
    normalizeTier,
} from '../lib/membership.js';

const router = Router();

function timingSafeEqual(a, b) {
    const aa = Buffer.from(String(a || ''));
    const bb = Buffer.from(String(b || ''));
    if (aa.length !== bb.length) return false;
    return crypto.timingSafeEqual(aa, bb);
}

function parseSepayApiKey(authorizationHeader) {
    const header = String(authorizationHeader || '').trim();
    if (!header) return null;
    const lower = header.toLowerCase();
    if (lower.startsWith('apikey ')) return header.slice(7).trim();
    if (lower.startsWith('bearer ')) return header.slice(7).trim();
    // Some clients may send the raw key without prefix
    return header;
}

function requireSepayAuth(req, res) {
    const configuredKey = process.env.SEPAY_API_KEY || '';
    if (!configuredKey) {
        res.status(500).json({ error: 'SEPAY_API_KEY is not configured' });
        return false;
    }

    const provided =
        parseSepayApiKey(req.headers.authorization) ||
        parseSepayApiKey(req.headers['x-api-key']) ||
        parseSepayApiKey(req.headers['x-sepay-api-key']);
    if (!provided || !timingSafeEqual(provided, configuredKey)) {
        res.status(401).json({ error: 'Unauthorized' });
        return false;
    }

    return true;
}

function normalizeSepayPayload(body) {
    const raw = body && typeof body === 'object' ? body : {};
    const providerTransactionId = raw.id ?? raw.transactionId ?? raw.transaction_id;
    return {
        providerTransactionId: providerTransactionId === undefined ? null : String(providerTransactionId),
        gateway: raw.gateway || null,
        transactionDate: raw.transactionDate || raw.transaction_date || null,
        accountNumber: raw.accountNumber || raw.account_number || null,
        code: raw.code || null,
        content: raw.content || '',
        transferType: raw.transferType || raw.transfer_type || null,
        transferAmount: Number(raw.transferAmount ?? raw.transfer_amount ?? 0),
        accumulated: raw.accumulated ?? null,
        subAccount: raw.subAccount ?? null,
        referenceCode: raw.referenceCode ?? null,
        description: raw.description ?? null,
        raw,
    };
}

const PAYMENT_AMOUNT_TOLERANCE_VND = Math.max(
    0,
    Number.parseInt(process.env.PAYMENT_AMOUNT_TOLERANCE_VND || '0', 10) || 0
);

// POST /api/payments/sepay/webhook
router.post('/sepay/webhook', async (req, res, next) => {
    try {
        if (!requireSepayAuth(req, res)) return;

        const payload = normalizeSepayPayload(req.body);
        if (!payload.providerTransactionId) {
            return res.status(200).json({ success: true, ignored: true, reason: 'missing_transaction_id' });
        }

        // Always log webhook events (best-effort, idempotent)
        await connectToDatabase();
        const webhookEvents = getCollection('payment_webhook_events');
        try {
            await webhookEvents.updateOne(
                { provider: 'sepay', providerEventId: payload.providerTransactionId },
                {
                    $setOnInsert: {
                        provider: 'sepay',
                        providerEventId: payload.providerTransactionId,
                        receivedAt: new Date(),
                        headers: {
                            authorization: req.headers.authorization ? '[REDACTED]' : null,
                            'x-forwarded-for': req.headers['x-forwarded-for'] || null,
                            'user-agent': req.headers['user-agent'] || null,
                        },
                        body: payload.raw,
                    },
                },
                { upsert: true }
            );
        } catch (err) {
            // eslint-disable-next-line no-console
            console.warn('[sepay] Failed to persist webhook event:', err?.message || err);
        }

        // Only process inbound transfers
        if (String(payload.transferType || '').toLowerCase() !== 'in') {
            return res.status(200).json({ success: true, ignored: true, reason: 'transferType_not_in' });
        }

        const rawCode = payload.code ? String(payload.code).trim() : '';
        const orderCode = rawCode || extractOrderCodeFromContent(payload.content);
        if (!orderCode) {
            await getCollection('payment_transactions').updateOne(
                { provider: 'sepay', providerTransactionId: payload.providerTransactionId },
                {
                    $setOnInsert: {
                        provider: 'sepay',
                        providerTransactionId: payload.providerTransactionId,
                        status: 'unmatched',
                        createdAt: new Date(),
                    },
                    $set: {
                        updatedAt: new Date(),
                        payload: payload.raw,
                        note: 'Missing payment code / orderCode',
                    },
                },
                { upsert: true }
            );
            return res.status(200).json({ success: true, unmatched: true });
        }

        const orders = getCollection('payment_orders');
        const order = await orders.findOne({ orderCode });

        if (!order) {
            await getCollection('payment_transactions').updateOne(
                { provider: 'sepay', providerTransactionId: payload.providerTransactionId },
                {
                    $setOnInsert: {
                        provider: 'sepay',
                        providerTransactionId: payload.providerTransactionId,
                        status: 'unmatched',
                        createdAt: new Date(),
                    },
                    $set: {
                        updatedAt: new Date(),
                        orderCode,
                        payload: payload.raw,
                        note: 'Order not found',
                    },
                },
                { upsert: true }
            );
            return res.status(200).json({ success: true, unmatched: true });
        }

        // If already paid, treat as idempotent success
        if (order.status === 'paid') {
            return res.status(200).json({ success: true, alreadyPaid: true });
        }

        // Validate amount for membership orders
        const expectedAmount = Number(order.amountVnd || 0);
        const actualAmount = Math.round(payload.transferAmount || 0);
        const diff = Math.abs(expectedAmount - actualAmount);
        const amountOk = expectedAmount > 0 && diff <= PAYMENT_AMOUNT_TOLERANCE_VND;

        // Persist transaction (idempotent)
        await getCollection('payment_transactions').updateOne(
            { provider: 'sepay', providerTransactionId: payload.providerTransactionId },
            {
                $setOnInsert: {
                    provider: 'sepay',
                    providerTransactionId: payload.providerTransactionId,
                    orderId: order._id?.toString(),
                    orderCode,
                    createdAt: new Date(),
                },
                $set: {
                    updatedAt: new Date(),
                    gateway: payload.gateway,
                    transactionDate: payload.transactionDate,
                    accountNumber: payload.accountNumber,
                    transferAmount: actualAmount,
                    transferType: payload.transferType,
                    content: payload.content,
                    payload: payload.raw,
                    status: amountOk ? 'received' : 'amount_mismatch',
                },
            },
            { upsert: true }
        );

        if (!amountOk) {
            await orders.updateOne(
                { _id: order._id },
                {
                    $set: {
                        status: 'needs_review',
                        updatedAt: new Date(),
                        reviewReason: 'amount_mismatch',
                        reviewMeta: { expectedAmount, actualAmount, tolerance: PAYMENT_AMOUNT_TOLERANCE_VND },
                    },
                }
            );

            return res.status(200).json({ success: true, needsReview: true });
        }

        // Atomically mark order as paid (idempotent)
        const paidAt = new Date();
        const paidUpdate = await orders.updateOne(
            { _id: order._id, status: { $ne: 'paid' } },
            {
                $set: {
                    status: 'paid',
                    paidAt,
                    updatedAt: paidAt,
                    providerTransactionId: payload.providerTransactionId,
                    payment: {
                        provider: 'sepay',
                        gateway: payload.gateway,
                        transactionDate: payload.transactionDate,
                        accountNumber: payload.accountNumber,
                        referenceCode: payload.referenceCode,
                        transferAmount: actualAmount,
                        content: payload.content,
                    },
                },
            }
        );

        if (paidUpdate.matchedCount === 0) {
            return res.status(200).json({ success: true, alreadyPaid: true });
        }

        // Apply membership (idempotent per order)
        const users = getCollection('users');
        const userId = String(order.userId || '');
        const userFilter = ObjectId.isValid(userId) ? { _id: new ObjectId(userId) } : { _id: userId };
        const user = await users.findOne(userFilter, { projection: { membership: 1 } });
        if (!user) {
            await orders.updateOne(
                { _id: order._id },
                { $set: { status: 'needs_review', reviewReason: 'user_not_found', updatedAt: new Date() } }
            );
            return res.status(200).json({ success: true, needsReview: true });
        }

        const currentMembership = normalizeMembership(user.membership);
        if (currentMembership.orderId && String(currentMembership.orderId) === String(order._id)) {
            return res.status(200).json({ success: true, membershipAlreadyApplied: true });
        }

        const planId = order.planId || order.tier;
        const plan = getMembershipPlans().find((p) => p.id === normalizeTier(planId));
        if (!plan) {
            await orders.updateOne(
                { _id: order._id },
                { $set: { status: 'needs_review', reviewReason: 'invalid_plan', updatedAt: new Date() } }
            );
            return res.status(200).json({ success: true, needsReview: true });
        }

        const newMembership = computeNewMembershipFromPurchase({
            currentMembership: user.membership,
            purchasedTier: plan.tier,
            durationDays: plan.durationDays,
            now: paidAt,
        });

        await setUserMembership({
            userId,
            membership: newMembership,
            source: 'sepay',
            orderId: order._id?.toString(),
        });

        return res.status(200).json({ success: true });
    } catch (err) {
        next(err);
    }
});

export default router;

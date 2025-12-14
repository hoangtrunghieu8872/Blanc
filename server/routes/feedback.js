import express from 'express';
import jwt from 'jsonwebtoken';
import { getCollection } from '../lib/db.js';
import { sendTelegramMessage } from '../lib/telegram.js';

const router = express.Router();
const jwtSecret = process.env.JWT_SECRET;
const collectionName = 'news_feedback';
let indexesEnsured = false;

const mapSuggestion = (doc) => ({
  id: doc._id?.toString(),
  idea: doc.idea,
  contact: doc.contact || null,
  userId: doc.userId || null,
  userEmail: doc.userEmail || null,
  createdAt: doc.createdAt,
});

const ensureIndexes = async () => {
  if (indexesEnsured) return;
  const collection = getCollection(collectionName);
  await collection.createIndex({ createdAt: -1 });
  indexesEnsured = true;
};

const getAuthUser = (req) => {
  if (!jwtSecret) return null;
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  try {
    return jwt.verify(token, jwtSecret);
  } catch {
    return null;
  }
};

router.get('/news', async (req, res, next) => {
  try {
    await ensureIndexes();
    const collection = getCollection(collectionName);
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
    const total = await collection.estimatedDocumentCount();

    const docs = await collection
      .find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    return res.json({ suggestions: docs.map(mapSuggestion), total });
  } catch (error) {
    return next(error);
  }
});

router.post('/news', async (req, res, next) => {
  try {
    await ensureIndexes();
    const { idea, contact } = req.body || {};
    const trimmedIdea = (idea || '').trim();
    const trimmedContact = (contact || '').trim();

    if (!trimmedIdea || trimmedIdea.length < 5) {
      return res.status(400).json({ error: 'Ý tưởng/góp ý cần ít nhất 5 ký tự.' });
    }
    if (trimmedIdea.length > 1000) {
      return res.status(400).json({ error: 'Ý tưởng/góp ý tối đa 1000 ký tự.' });
    }
    if (trimmedContact.length > 120) {
      return res.status(400).json({ error: 'Thông tin liên hệ tối đa 120 ký tự.' });
    }

    const authUser = getAuthUser(req);

    const doc = {
      idea: trimmedIdea,
      contact: trimmedContact || null,
      userId: authUser?.id || null,
      userEmail: authUser?.email || null,
      createdAt: new Date(),
      status: 'new',
      source: 'news',
    };

    const collection = getCollection(collectionName);
    const result = await collection.insertOne(doc);

    // Best-effort: notify admins about new feedback
    try {
      const notifications = getCollection('admin_notifications');
      const displaySender = doc.contact || doc.userEmail || 'Ẩn danh';
      const maxLength = 220;
      const excerpt =
        trimmedIdea.length > maxLength
          ? `${trimmedIdea.slice(0, Math.max(0, maxLength - 1))}…`
          : trimmedIdea;

      const metadata = {
        feedbackId: result.insertedId.toString(),
        source: doc.source,
        ...(doc.userId ? { userId: doc.userId } : {}),
        ...(doc.userEmail ? { userEmail: doc.userEmail } : {}),
        ...(doc.contact ? { contact: doc.contact } : {}),
      };

      await notifications.insertOne({
        title: 'Góp ý bản tin mới',
        message: `${displaySender}: ${excerpt}`,
        type: 'info',
        category: 'system',
        link: '/news',
        read: false,
        createdAt: doc.createdAt,
        metadata,
      });
    } catch (notifError) {
      // Don't block user feedback submission if notification fails
      console.error('[feedback] Failed to create admin notification:', notifError);
    }

    // Best-effort: Telegram alert
    try {
      const displaySender = doc.contact || doc.userEmail || '?n danh';
      const maxLength = 800;
      const excerpt =
        trimmedIdea.length > maxLength
          ? `${trimmedIdea.slice(0, Math.max(0, maxLength - 1))}…`
          : trimmedIdea;

      const feedbackId = result.insertedId.toString();
      const message = [
        '📝 Góp ý bản tin mới',
        `Người gửi: ${displaySender}`,
        `Nội dung: ${excerpt}`,
        `ID: ${feedbackId}`,
        `Thời gian: ${doc.createdAt.toISOString()}`,
      ].join('\n');

      void sendTelegramMessage(message);
    } catch (tgError) {
      console.error('[feedback] Failed to send Telegram message:', tgError);
    }

    return res.status(201).json({
      message: 'Đã ghi nhận góp ý.',
      suggestion: mapSuggestion({ ...doc, _id: result.insertedId }),
    });
  } catch (error) {
    return next(error);
  }
});

export default router;

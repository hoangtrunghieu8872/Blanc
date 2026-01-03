import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { connectToDatabase, getCollection } from '../lib/db.js';
import { authGuard } from '../middleware/auth.js';

const router = Router();

const allowedReviewStatuses = new Set(['draft', 'submitted', 'needs_changes', 'approved']);
let indexesEnsured = false;

const requireMentorOrAdmin = (req, res, next) => {
  const role = req.user?.role;
  if (!role || !['mentor', 'admin', 'super_admin'].includes(role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  return next();
};

function sanitizeString(value, maxLength = 200) {
  if (!value || typeof value !== 'string') return '';
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim().slice(0, maxLength);
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeReviewStatus(input) {
  const raw = sanitizeString(input, 40).toLowerCase();
  if (!raw) return null;
  if (raw === 'all') return 'all';
  return allowedReviewStatuses.has(raw) ? raw : null;
}

async function ensureIndexes() {
  if (indexesEnsured) return;
  indexesEnsured = true;
  try {
    await connectToDatabase();
    const reports = getCollection('reports');
    const feedback = getCollection('report_feedback');
    await Promise.all([
      reports.createIndex({ reviewStatus: 1, submittedAt: -1 }),
      reports.createIndex({ userId: 1, updatedAt: -1 }),
      feedback.createIndex({ reportId: 1, createdAt: 1 }),
    ]);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[review-reports] Failed to ensure indexes (continuing without them).', err);
  }
}

function mapReport(doc, owner, { includeContent = false } = {}) {
  return {
    id: doc._id?.toString(),
    title: doc.title,
    template: doc.template,
    status: doc.status,
    reviewStatus: doc.reviewStatus || 'draft',
    submittedAt: doc.submittedAt || null,
    reviewedAt: doc.reviewedAt || null,
    relatedType: doc.relatedType || null,
    relatedId: doc.relatedId || null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    ...(includeContent
      ? {
          content: doc.content || '',
          activities: doc.activities || [],
          evidence: doc.evidence || [],
        }
      : {}),
    user: owner
      ? {
          id: owner._id?.toString(),
          name: owner.name || '',
          email: owner.email || '',
          avatar: owner.avatar || null,
          role: owner.role || 'student',
        }
      : { id: doc.userId || null, name: '', email: '', avatar: null, role: 'student' },
  };
}

function mapFeedback(doc, author) {
  return {
    id: doc._id?.toString(),
    reportId: doc.reportId?.toString(),
    authorId: doc.authorId,
    authorRole: doc.authorRole,
    authorName: author?.name || null,
    authorAvatar: author?.avatar || null,
    message: doc.message,
    createdAt: doc.createdAt,
  };
}

// ============ REVIEW QUEUE ============ //

/**
 * GET /api/review/reports
 * Query:
 *  - status: draft|submitted|needs_changes|approved|all (default: submitted)
 *  - template
 *  - search (report title/content OR user name/email)
 *  - limit, skip
 */
router.get('/', authGuard, requireMentorOrAdmin, async (req, res, next) => {
  try {
    await ensureIndexes();
    const reports = getCollection('reports');
    const users = getCollection('users');

    const statusInput = normalizeReviewStatus(req.query.status);
    const template = sanitizeString(req.query.template, 200);
    const search = sanitizeString(req.query.search, 120);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = Math.max(0, parseInt(req.query.skip, 10) || 0);

    const query = {};

    // Default: show submitted reports
    if (!statusInput) {
      query.reviewStatus = 'submitted';
    } else if (statusInput !== 'all') {
      query.reviewStatus = statusInput;
    }

    if (template) query.template = template;

    if (search) {
      const escapedSearch = escapeRegex(search);
      const or = [
        { title: { $regex: escapedSearch, $options: 'i' } },
        { content: { $regex: escapedSearch, $options: 'i' } },
      ];

      // Optional: match by owner name/email
      const matchedUsers = await users
        .find(
          {
            $or: [
              { name: { $regex: escapedSearch, $options: 'i' } },
              { email: { $regex: escapedSearch, $options: 'i' } },
            ],
          },
          { projection: { _id: 1 } }
        )
        .limit(50)
        .toArray();

      const userIds = matchedUsers.map((u) => u._id?.toString()).filter(Boolean);
      if (userIds.length > 0) {
        or.push({ userId: { $in: userIds } });
      }

      query.$or = or;
    }

    const [items, total] = await Promise.all([
      reports
        .find(query)
        .sort({ submittedAt: -1, updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      reports.countDocuments(query),
    ]);

    const ownerIds = [...new Set(items.map((r) => r.userId).filter((id) => ObjectId.isValid(String(id))))].map(
      (id) => new ObjectId(String(id))
    );
    const owners = ownerIds.length
      ? await users
          .find({ _id: { $in: ownerIds } }, { projection: { name: 1, email: 1, avatar: 1, role: 1 } })
          .toArray()
      : [];
    const ownerMap = new Map(owners.map((u) => [u._id.toString(), u]));

    res.json({
      items: items.map((doc) => mapReport(doc, ownerMap.get(String(doc.userId)))),
      total,
      limit,
      skip,
      hasMore: skip + items.length < total,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/review/reports/:id
 * Returns report detail + feedback thread.
 */
router.get('/:id', authGuard, requireMentorOrAdmin, async (req, res, next) => {
  try {
    await ensureIndexes();
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid report id' });

    const reports = getCollection('reports');
    const users = getCollection('users');
    const feedback = getCollection('report_feedback');

    const report = await reports.findOne({ _id: new ObjectId(id) });
    if (!report) return res.status(404).json({ error: 'Report not found' });

    const owner = ObjectId.isValid(String(report.userId))
      ? await users.findOne({ _id: new ObjectId(String(report.userId)) })
      : null;

    const feedbackItems = await feedback
      .find({ reportId: new ObjectId(id) })
      .sort({ createdAt: 1 })
      .toArray();

    const authorIds = [
      ...new Set(feedbackItems.map((f) => f.authorId).filter((aid) => ObjectId.isValid(String(aid)))),
    ].map((aid) => new ObjectId(String(aid)));

    const authors = authorIds.length
      ? await users.find({ _id: { $in: authorIds } }, { projection: { name: 1, avatar: 1 } }).toArray()
      : [];
    const authorMap = new Map(authors.map((u) => [u._id.toString(), u]));

    res.json({
      report: mapReport(report, owner, { includeContent: true }),
      feedback: feedbackItems.map((f) => mapFeedback(f, authorMap.get(String(f.authorId)))),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/review/reports/:id/feedback
 * Create mentor/admin feedback message.
 */
router.post('/:id/feedback', authGuard, requireMentorOrAdmin, async (req, res, next) => {
  try {
    await ensureIndexes();
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid report id' });

    const message = sanitizeString(req.body?.message, 2000);
    if (!message) return res.status(400).json({ error: 'Message is required' });

    const reports = getCollection('reports');
    const feedback = getCollection('report_feedback');

    const report = await reports.findOne({ _id: new ObjectId(id) }, { projection: { userId: 1 } });
    if (!report) return res.status(404).json({ error: 'Report not found' });

    const now = new Date();
    const doc = {
      reportId: new ObjectId(id),
      reportOwnerId: report.userId || null,
      authorId: req.user.id,
      authorRole: req.user.role,
      message,
      createdAt: now,
    };

    const result = await feedback.insertOne(doc);

    res.status(201).json({
      feedback: mapFeedback({ ...doc, _id: result.insertedId }, null),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/review/reports/:id/status
 * Body: { reviewStatus: 'needs_changes' | 'approved' | 'submitted' }
 */
router.patch('/:id/status', authGuard, requireMentorOrAdmin, async (req, res, next) => {
  try {
    await ensureIndexes();
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid report id' });

    const nextStatus = normalizeReviewStatus(req.body?.reviewStatus);
    const allowed = new Set(['needs_changes', 'approved', 'submitted']);
    if (!nextStatus || nextStatus === 'all' || !allowed.has(nextStatus)) {
      return res.status(400).json({ error: 'Invalid reviewStatus' });
    }

    const reports = getCollection('reports');
    const now = new Date();

    const update = {
      reviewStatus: nextStatus,
      reviewStatusUpdatedAt: now,
      ...(nextStatus === 'approved'
        ? { reviewedAt: now, reviewedById: req.user.id }
        : { reviewedAt: null, reviewedById: null }),
      updatedAt: now,
    };

    const result = await reports.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: update },
      { returnDocument: 'after' }
    );

    const updated = result?.value ?? result;
    if (!updated) return res.status(404).json({ error: 'Report not found' });

    res.json({ ok: true, reportId: id, reviewStatus: updated.reviewStatus || nextStatus });
  } catch (error) {
    next(error);
  }
});

export default router;

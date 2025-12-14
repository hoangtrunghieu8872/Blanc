import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { connectToDatabase, getCollection } from '../lib/db.js';
import { authGuard } from '../middleware/auth.js';

const router = Router();
const collectionName = 'news';
const allowedStatuses = ['draft', 'published'];
const allowedTypes = ['announcement', 'minigame', 'update', 'event'];
let indexesEnsured = false;

const requireAdmin = (req, res, next) => {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'super_admin')) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  return next();
};

const sanitizeString = (value, maxLength = 255) => {
  if (!value || typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
};

const sanitizeBody = (value, maxLength = 20000) => {
  if (!value || typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
};

const sanitizeUrl = (value, maxLength = 500) => {
  const url = sanitizeString(value, maxLength);
  if (!url) return '';
  if (url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://')) return url;
  return '';
};

const sanitizeTags = (tags, maxItems = 10) => {
  if (!Array.isArray(tags)) return [];
  const unique = new Set();
  const sanitized = [];
  for (const tag of tags) {
    const t = sanitizeString(tag, 50);
    if (t && !unique.has(t.toLowerCase())) {
      unique.add(t.toLowerCase());
      sanitized.push(t);
    }
    if (sanitized.length >= maxItems) break;
  }
  return sanitized;
};

const normalizeStatus = (status) => (allowedStatuses.includes(status) ? status : 'draft');
const normalizeType = (type) => (allowedTypes.includes(type) ? type : 'announcement');

const normalizeDate = (input) => {
  if (!input) return null;
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
};

const slugify = (title) => {
  const base = sanitizeString(title || '', 200)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  return base || 'news';
};

const generateUniqueSlug = async (base, excludeId) => {
  const collection = getCollection(collectionName);
  let slug = base || 'news';
  let counter = 2;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await collection.findOne({ slug });
    if (!existing) break;
    if (excludeId && existing._id?.toString() === excludeId.toString()) break;
    slug = `${base}-${counter}`;
    counter += 1;
  }
  return slug;
};

const ensureIndexes = async () => {
  if (indexesEnsured) return;
  await connectToDatabase();
  const collection = getCollection(collectionName);
  await collection.createIndex({ slug: 1 }, { unique: true });
  await collection.createIndex({ status: 1, publishAt: -1 });
  await collection.createIndex({ status: 1, highlight: 1, publishAt: -1 });
  await collection.createIndex({ tags: 1 });
  indexesEnsured = true;
};

const formatDate = (value) => {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
};

const mapNews = (doc, { includeBody = false } = {}) => ({
  id: doc._id?.toString(),
  slug: doc.slug,
  title: doc.title,
  summary: doc.summary || '',
  tags: doc.tags || [],
  coverImage: doc.coverImage || '',
  type: doc.type || 'announcement',
  highlight: !!doc.highlight,
  actionLabel: doc.actionLabel || '',
  actionLink: doc.actionLink || '',
  status: doc.status || 'draft',
  publishAt: formatDate(doc.publishAt),
  publishedAt: formatDate(doc.publishedAt),
  author: doc.author || {
    id: doc.authorId || null,
    name: doc.authorName || null,
    email: doc.authorEmail || null,
  },
  createdAt: formatDate(doc.createdAt),
  updatedAt: formatDate(doc.updatedAt),
  ...(includeBody ? { body: doc.body || '' } : {}),
});

// -------------------- Admin endpoints --------------------

router.get('/admin', authGuard, requireAdmin, async (req, res, next) => {
  try {
    await ensureIndexes();
    const collection = getCollection(collectionName);

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const search = sanitizeString(req.query.search, 200);
    const status = normalizeStatus(req.query.status);
    const tag = sanitizeString(req.query.tag, 50);
    const from = normalizeDate(req.query.from);
    const to = normalizeDate(req.query.to);
    const highlightParam = sanitizeString(req.query.highlight, 10).toLowerCase();
    const sortBy = ['publishAt', 'createdAt', 'updatedAt', 'title'].includes(req.query.sortBy)
      ? req.query.sortBy
      : 'updatedAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    const query = {};
    if (req.query.status) query.status = status;
    if (highlightParam) {
      if (['1', 'true', 'yes'].includes(highlightParam)) query.highlight = true;
      if (['0', 'false', 'no'].includes(highlightParam)) query.highlight = false;
    }
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { summary: { $regex: search, $options: 'i' } },
      ];
    }
    if (tag) query.tags = tag;
    if (from || to) {
      query.publishAt = {};
      if (from) query.publishAt.$gte = from;
      if (to) query.publishAt.$lte = to;
    }

    const [total, items] = await Promise.all([
      collection.countDocuments(query),
      collection
        .find(query)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .toArray(),
    ]);

    res.json({ items: items.map((doc) => mapNews(doc)), page, limit, total });
  } catch (error) {
    next(error);
  }
});

router.get('/admin/:id', authGuard, requireAdmin, async (req, res, next) => {
  try {
    await ensureIndexes();
    const { id } = req.params;
    const collection = getCollection(collectionName);

    const query = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { slug: id };
    const doc = await collection.findOne(query);
    if (!doc) return res.status(404).json({ error: 'News item not found' });

    return res.json({ item: mapNews(doc, { includeBody: true }) });
  } catch (error) {
    return next(error);
  }
});

router.post('/', authGuard, requireAdmin, async (req, res, next) => {
  try {
    await ensureIndexes();
    const collection = getCollection(collectionName);

    const title = sanitizeString(req.body.title, 200);
    const summary = sanitizeString(req.body.summary, 500);
    const body = sanitizeBody(req.body.body);
    const coverImage = sanitizeString(req.body.coverImage, 500);
    const tags = sanitizeTags(req.body.tags);
    const type = normalizeType(req.body.type);
    const highlight = !!req.body.highlight;
    const actionLabel = sanitizeString(req.body.actionLabel, 80);
    const actionLink = sanitizeUrl(req.body.actionLink);
    const status = normalizeStatus(req.body.status);
    const publishAtInput = normalizeDate(req.body.publishAt);
    const publishAt = status === 'published' ? publishAtInput || new Date() : publishAtInput;
    const authorName = sanitizeString(req.body.authorName, 120);

    if (!title) return res.status(400).json({ error: 'Title is required' });
    if (!body) return res.status(400).json({ error: 'Body is required' });
    if (publishAtInput === null && req.body.publishAt) {
      return res.status(400).json({ error: 'Invalid publishAt' });
    }

    const baseSlug = slugify(title);
    const slug = await generateUniqueSlug(baseSlug);
    const now = new Date();

    const doc = {
      title,
      summary,
      body,
      tags,
      coverImage,
      type,
      highlight,
      actionLabel,
      actionLink,
      status,
      slug,
      publishAt,
      publishedAt: status === 'published' ? (publishAt || now) : null,
      author: {
        id: req.user?.id || null,
        email: req.user?.email || null,
        name: authorName || null,
      },
      createdAt: now,
      updatedAt: now,
    };

    const result = await collection.insertOne(doc);
    return res.status(201).json({ item: mapNews({ ...doc, _id: result.insertedId }) });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id', authGuard, requireAdmin, async (req, res, next) => {
  try {
    await ensureIndexes();
    const collection = getCollection(collectionName);
    const { id } = req.params;
    const query = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { slug: id };
    const existing = await collection.findOne(query);

    if (!existing) return res.status(404).json({ error: 'News item not found' });

    const updates = {};
    const now = new Date();

    if (req.body.title !== undefined) {
      const title = sanitizeString(req.body.title, 200);
      if (!title) return res.status(400).json({ error: 'Title cannot be empty' });
      updates.title = title;
      if (req.body.slug) {
        const newSlugBase = slugify(req.body.slug);
        updates.slug = await generateUniqueSlug(newSlugBase, existing._id);
      }
    }

    if (req.body.summary !== undefined) {
      updates.summary = sanitizeString(req.body.summary, 500);
    }
    if (req.body.body !== undefined) {
      const body = sanitizeBody(req.body.body);
      if (!body) return res.status(400).json({ error: 'Body cannot be empty' });
      updates.body = body;
    }
    if (req.body.coverImage !== undefined) {
      updates.coverImage = sanitizeString(req.body.coverImage, 500);
    }
    if (req.body.tags !== undefined) {
      updates.tags = sanitizeTags(req.body.tags);
    }
    if (req.body.type !== undefined) {
      updates.type = normalizeType(req.body.type);
    }
    if (req.body.highlight !== undefined) {
      updates.highlight = !!req.body.highlight;
    }
    if (req.body.actionLabel !== undefined) {
      updates.actionLabel = sanitizeString(req.body.actionLabel, 80);
    }
    if (req.body.actionLink !== undefined) {
      updates.actionLink = sanitizeUrl(req.body.actionLink);
    }
    if (req.body.authorName !== undefined) {
      const authorName = sanitizeString(req.body.authorName, 120);
      updates.author = {
        ...(existing.author || {}),
        id: existing.author?.id || req.user?.id || null,
        email: existing.author?.email || req.user?.email || null,
        name: authorName || null,
      };
    }

    let targetStatus = existing.status;
    if (req.body.status !== undefined) {
      const status = normalizeStatus(req.body.status);
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      targetStatus = status;
      updates.status = status;
    }

    let publishAt = existing.publishAt;
    if (req.body.publishAt !== undefined) {
      const parsed = normalizeDate(req.body.publishAt);
      if (parsed === null && req.body.publishAt) {
        return res.status(400).json({ error: 'Invalid publishAt' });
      }
      publishAt = parsed;
      updates.publishAt = parsed;
    }

    if (targetStatus === 'published') {
      const publishDate = publishAt || existing.publishAt || new Date();
      updates.publishAt = publishDate;
      updates.publishedAt = existing.publishedAt || publishDate;
    } else if (targetStatus === 'draft') {
      updates.publishedAt = null;
    }

    updates.updatedAt = now;

    const result = await collection.findOneAndUpdate(
      query,
      { $set: updates },
      { returnDocument: 'after' },
    );

    const updatedDoc = result?.value ?? result;
    if (!updatedDoc) return res.status(404).json({ error: 'News item not found' });

    return res.json({ item: mapNews(updatedDoc, { includeBody: true }) });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id/status', authGuard, requireAdmin, async (req, res, next) => {
  try {
    await ensureIndexes();
    const collection = getCollection(collectionName);
    const { id } = req.params;
    const status = normalizeStatus(req.body.status);
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const query = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { slug: id };
    const existing = await collection.findOne(query);
    if (!existing) return res.status(404).json({ error: 'News item not found' });

    const now = new Date();
    const publishDate = normalizeDate(req.body.publishAt) || existing.publishAt || now;

    const updates = {
      status,
      publishAt: status === 'published' ? publishDate : existing.publishAt || null,
      publishedAt: status === 'published' ? (existing.publishedAt || publishDate) : null,
      updatedAt: now,
    };

    const result = await collection.findOneAndUpdate(
      query,
      { $set: updates },
      { returnDocument: 'after' },
    );

    const updatedDoc = result?.value ?? result;
    if (!updatedDoc) return res.status(404).json({ error: 'News item not found' });

    return res.json({ item: mapNews(updatedDoc, { includeBody: true }) });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', authGuard, requireAdmin, async (req, res, next) => {
  try {
    await ensureIndexes();
    const collection = getCollection(collectionName);
    const { id } = req.params;
    const query = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { slug: id };

    const result = await collection.deleteOne(query);
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'News item not found' });
    }
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

// -------------------- Public endpoints --------------------

router.get('/tags', async (req, res, next) => {
  try {
    await ensureIndexes();
    const collection = getCollection(collectionName);
    const tags = await collection
      .aggregate([
        { $match: { status: 'published' } },
        { $unwind: '$tags' },
        { $group: { _id: '$tags', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ])
      .toArray();

    res.json({
      tags: tags.map((t) => t._id),
      tagsWithCount: tags.map((t) => ({ tag: t._id, count: t.count })),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    await ensureIndexes();
    const collection = getCollection(collectionName);

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const search = sanitizeString(req.query.search, 200);
    const tag = sanitizeString(req.query.tag, 50);
    const from = normalizeDate(req.query.from);
    const to = normalizeDate(req.query.to);
    const highlightParam = sanitizeString(req.query.highlight, 10).toLowerCase();
    const highlightOnly = ['1', 'true', 'yes'].includes(highlightParam);
    const now = new Date();

    const query = {
      status: 'published',
      publishAt: { $lte: now },
    };
    if (highlightOnly) query.highlight = true;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { summary: { $regex: search, $options: 'i' } },
      ];
    }
    if (tag) query.tags = tag;
    if (from || to) {
      query.publishAt = query.publishAt || {};
      if (from) query.publishAt.$gte = from;
      if (to) query.publishAt.$lte = to;
    }

    const [total, items] = await Promise.all([
      collection.countDocuments(query),
      collection
        .find(query, { projection: { body: 0 } })
        .sort({ publishAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
    ]);

    res.json({ items: items.map((doc) => mapNews(doc)), page, limit, total });
  } catch (error) {
    next(error);
  }
});

router.get('/:slugOrId', async (req, res, next) => {
  try {
    await ensureIndexes();
    const collection = getCollection(collectionName);
    const { slugOrId } = req.params;
    const now = new Date();

    const query = ObjectId.isValid(slugOrId)
      ? { _id: new ObjectId(slugOrId) }
      : { slug: slugOrId };

    const doc = await collection.findOne({
      ...query,
      status: 'published',
      publishAt: { $lte: now },
    });

    if (!doc) return res.status(404).json({ error: 'News item not found' });

    return res.json({ item: mapNews(doc, { includeBody: true }) });
  } catch (error) {
    return next(error);
  }
});

export default router;

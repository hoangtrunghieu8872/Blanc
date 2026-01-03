import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { connectToDatabase, getCollection } from '../lib/db.js';
import { authGuard } from '../middleware/auth.js';

const router = Router();

const MAX_SEARCH_LEN = 120;
const MAX_BANNER_LEN = 500;
const MAX_BODY_LEN = 20000;
const MAX_FIELD_LEN = 80;
const MAX_FIELDS = 8;
const FIELD_KEYWORDS = {
  it: ['it', 'tech', 'coding', 'programming', 'software', 'developer', 'engineer', 'ai', 'ml', 'frontend', 'backend', 'fullstack', 'devops'],
  data: ['data', 'analytics', 'analysis', 'data science', 'bi', 'sql', 'machine learning', 'ml', 'ai'],
  cyber: ['cyber', 'security', 'infosec', 'pentest', 'owasp', 'network security', 'soc', 'siem'],
  robotics: ['robot', 'robotics', 'iot', 'embedded', 'hardware', 'arduino', 'raspberry pi'],
  design: ['design', 'ui', 'ux', 'ui/ux', 'figma', 'graphic', 'visual', 'product design'],
  business: ['business', 'strategy', 'management', 'consulting', 'product', 'pm', 'operations'],
  startup: ['startup', 'innovation', 'entrepreneur', 'founder', 'pitch', 'mvp', 'venture'],
  marketing: ['marketing', 'growth', 'seo', 'ads', 'branding', 'content', 'social', 'performance'],
  finance: ['finance', 'fintech', 'investment', 'trading', 'bank', 'accounting', 'blockchain'],
  health: ['health', 'biotech', 'medical', 'medicine', 'pharma', 'clinical'],
  education: ['education', 'edtech', 'learning', 'teaching', 'training', 'curriculum'],
  sustainability: ['sustainability', 'environment', 'climate', 'esg', 'green', 'renewable'],
  gaming: ['gaming', 'esports', 'game', 'unity', 'unreal'],
  research: ['research', 'science', 'academic', 'paper', 'publication', 'lab'],
  other: [],
};
const ALLOWED_FIELDS = new Set(Object.keys(FIELD_KEYWORDS));
const FIELD_MATCH_KEYS = [
  'matchingProfile.primaryRole',
  'matchingProfile.secondaryRoles',
  'matchingProfile.skills',
  'matchingProfile.techStack',
];

const sanitizeString = (value, maxLength = 500) => {
  if (typeof value !== 'string') return '';
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim().slice(0, maxLength);
};

const sanitizeBody = (value, maxLength = MAX_BODY_LEN) => {
  if (typeof value !== 'string') return '';
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim().slice(0, maxLength);
};

const sanitizeUrl = (value, maxLength = MAX_BANNER_LEN) => {
  const url = sanitizeString(value, maxLength);
  if (!url) return '';
  if (url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://')) return url;
  return '';
};

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildSearchQuery = (search) => {
  if (!search) return null;
  const escaped = escapeRegex(search);
  const regex = new RegExp(escaped, 'i');
  return {
    $or: [
      { name: regex },
      { email: regex },
      { 'matchingProfile.primaryRole': regex },
      { 'matchingProfile.secondaryRoles': regex },
      { 'matchingProfile.skills': regex },
      { 'matchingProfile.techStack': regex },
    ],
  };
};

const normalizeField = (value) => {
  const normalized = sanitizeString(value, 32).toLowerCase();
  return ALLOWED_FIELDS.has(normalized) ? normalized : '';
};

const buildKeywordPattern = (token) => {
  const trimmed = String(token || '').trim();
  if (!trimmed) return '';
  const escaped = escapeRegex(trimmed);
  const isWord = /^[a-z0-9]+$/i.test(trimmed);
  if (isWord && trimmed.length <= 2) return `\\b${escaped}\\b`;
  return escaped;
};

const buildKeywordRegex = (keywords = []) => {
  const patterns = new Set();
  keywords.forEach((keyword) => {
    const pattern = buildKeywordPattern(keyword);
    if (pattern) patterns.add(pattern);
  });
  if (patterns.size === 0) return null;
  return new RegExp(Array.from(patterns).join('|'), 'i');
};

const buildFieldQuery = (field) => {
  if (!field) return null;
  if (field === 'other') {
    const regexes = Object.entries(FIELD_KEYWORDS)
      .filter(([key]) => key !== 'other')
      .map(([, keywords]) => buildKeywordRegex(keywords))
      .filter(Boolean);
    if (regexes.length === 0) return null;
    const nor = [];
    regexes.forEach((regex) => {
      FIELD_MATCH_KEYS.forEach((path) => nor.push({ [path]: regex }));
    });
    return { $nor: nor };
  }

  const regex = buildKeywordRegex(FIELD_KEYWORDS[field] || []);
  if (!regex) return null;
  return {
    $or: FIELD_MATCH_KEYS.map((path) => ({ [path]: regex })),
  };
};

const normalizeSort = (value) => {
  const normalized = sanitizeString(value, 32).toLowerCase();
  const allowed = new Set(['random', 'newest', 'oldest', 'name-asc', 'name-desc']);
  return allowed.has(normalized) ? normalized : 'random';
};

const collectMentorFields = (user) => {
  const fields = [];
  const seen = new Set();
  const addField = (value) => {
    const clean = sanitizeString(value, MAX_FIELD_LEN);
    if (!clean) return;
    const key = clean.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    fields.push(clean);
  };

  const profile = user?.matchingProfile || {};
  addField(profile.primaryRole);
  if (Array.isArray(profile.secondaryRoles)) profile.secondaryRoles.forEach(addField);
  if (Array.isArray(profile.skills)) profile.skills.forEach(addField);
  if (Array.isArray(profile.techStack)) profile.techStack.forEach(addField);

  return fields.slice(0, MAX_FIELDS);
};

const normalizeLimit = (value, fallback = 12, max = 48) => {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(1, parsed));
};

const normalizePage = (value) => {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, parsed);
};

const buildUserIdQuery = (id) => {
  const raw = String(id || '').trim();
  const or = [];

  if (ObjectId.isValid(raw)) {
    or.push({ _id: new ObjectId(raw) });
  }

  if (raw.startsWith('user_')) {
    const trimmed = raw.replace(/^user_/, '');
    if (ObjectId.isValid(trimmed)) {
      or.push({ _id: new ObjectId(trimmed) });
    }
    or.push({ _id: trimmed });
  }

  or.push({ _id: raw });
  or.push({ id: raw });

  const seen = new Set();
  const uniqueOr = [];
  for (const entry of or) {
    const key = JSON.stringify(entry);
    if (!seen.has(key)) {
      seen.add(key);
      uniqueOr.push(entry);
    }
  }

  return uniqueOr.length === 1 ? uniqueOr[0] : { $or: uniqueOr };
};

const isMentorBlogCompleted = (user) => {
  if (!user || user.role !== 'mentor') return false;
  const banner = String(user.mentorBlog?.bannerUrl || '').trim();
  const body = String(user.mentorBlog?.body || '').trim();
  if (banner && body) return true;
  if (typeof user.mentorBlogCompleted === 'boolean') return user.mentorBlogCompleted;
  return false;
};

const mapMentorSummary = (user) => ({
  id: user._id?.toString(),
  name: user.name || 'Mentor',
  avatar: user.avatar || null,
  bannerUrl: user.mentorBlog?.bannerUrl || '',
  joinedAt: user.createdAt || user.updatedAt || null,
  mentorBlogCompleted: isMentorBlogCompleted(user),
  fields: collectMentorFields(user),
});

const mapMentorDetail = (user) => ({
  id: user._id?.toString(),
  name: user.name || 'Mentor',
  avatar: user.avatar || null,
  bannerUrl: user.mentorBlog?.bannerUrl || '',
  joinedAt: user.createdAt || user.updatedAt || null,
  bio: user.bio || '',
  mentorBlog: {
    bannerUrl: user.mentorBlog?.bannerUrl || '',
    body: user.mentorBlog?.body || '',
    createdAt: user.mentorBlog?.createdAt || null,
    updatedAt: user.mentorBlog?.updatedAt || null,
  },
  mentorBlogCompleted: isMentorBlogCompleted(user),
  fields: collectMentorFields(user),
});

const requireAdmin = (req, res, next) => {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'super_admin')) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  return next();
};

const requireMentor = (req, res, next) => {
  if (!req.user || req.user.role !== 'mentor') {
    return res.status(403).json({ error: 'Mentor access required' });
  }
  return next();
};

router.get('/', async (req, res, next) => {
  try {
    await connectToDatabase();
    const users = getCollection('users');

    const page = normalizePage(req.query.page);
    const limit = normalizeLimit(req.query.limit, 12, 60);
    const skip = (page - 1) * limit;
    const search = sanitizeString(req.query.search, MAX_SEARCH_LEN);
    const sort = normalizeSort(req.query.sort);
    const field = normalizeField(req.query.field);

    const query = {
      role: 'mentor',
      status: { $nin: ['banned', 'inactive', 'deleted'] },
      'privacy.showProfile': { $ne: false },
    };

    const filters = [];
    const searchQuery = buildSearchQuery(search);
    if (searchQuery) {
      filters.push(searchQuery);
    }

    const fieldQuery = buildFieldQuery(field);
    if (fieldQuery) {
      filters.push(fieldQuery);
    }

    if (filters.length > 0) {
      query.$and = filters;
    }

    const projection = {
      name: 1,
      avatar: 1,
      createdAt: 1,
      updatedAt: 1,
      'mentorBlog.bannerUrl': 1,
      'matchingProfile.primaryRole': 1,
      'matchingProfile.secondaryRoles': 1,
      'matchingProfile.skills': 1,
      'matchingProfile.techStack': 1,
      mentorBlogCompleted: 1,
      role: 1,
    };

    const total = await users.countDocuments(query);

    const sortSpec = (() => {
      switch (sort) {
        case 'oldest':
          return { createdAt: 1 };
        case 'name-asc':
          return { name: 1 };
        case 'name-desc':
          return { name: -1 };
        case 'newest':
        case 'random':
        default:
          return { createdAt: -1 };
      }
    })();

    let cursor = users.find(query, { projection }).sort(sortSpec).skip(skip).limit(limit);
    if (sort === 'name-asc' || sort === 'name-desc') {
      cursor = cursor.collation({ locale: 'vi', strength: 2 });
    }
    const docs = await cursor.toArray();

    res.json({
      items: docs.map(mapMentorSummary),
      page,
      limit,
      total,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/me/blog', authGuard, requireMentor, async (req, res, next) => {
  try {
    await connectToDatabase();
    const userId = req.user.id;
    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const users = getCollection('users');
    const user = await users.findOne(
      { _id: new ObjectId(userId), role: 'mentor' },
      { projection: { mentorBlog: 1, role: 1 } }
    );

    if (!user) {
      return res.status(404).json({ error: 'Mentor not found' });
    }

    res.json({
      blog: {
        bannerUrl: user.mentorBlog?.bannerUrl || '',
        body: user.mentorBlog?.body || '',
        createdAt: user.mentorBlog?.createdAt || null,
        updatedAt: user.mentorBlog?.updatedAt || null,
      },
      mentorBlogCompleted: isMentorBlogCompleted(user),
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/me/blog', authGuard, requireMentor, async (req, res, next) => {
  try {
    await connectToDatabase();
    const userId = req.user.id;
    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const rawBanner = req.body?.bannerUrl;
    const rawBody = req.body?.body;
    const bannerUrl = sanitizeUrl(rawBanner, MAX_BANNER_LEN);
    const body = sanitizeBody(rawBody, MAX_BODY_LEN);

    if (rawBanner && !bannerUrl) {
      return res.status(400).json({ error: 'Invalid bannerUrl' });
    }

    const users = getCollection('users');
    const user = await users.findOne({ _id: new ObjectId(userId), role: 'mentor' }, { projection: { mentorBlog: 1, role: 1 } });
    if (!user) {
      return res.status(404).json({ error: 'Mentor not found' });
    }

    const now = new Date();
    const hasBanner = Boolean(bannerUrl);
    const hasBody = Boolean(body);
    const mentorBlogCompleted = hasBanner && hasBody;

    const update = {
      $set: {
        mentorBlogCompleted,
        updatedAt: now,
      },
      $unset: {},
    };

    if (hasBanner || hasBody) {
      update.$set.mentorBlog = {
        bannerUrl,
        body,
        createdAt: user.mentorBlog?.createdAt || now,
        updatedAt: now,
      };
    } else {
      update.$unset.mentorBlog = '';
    }

    if (Object.keys(update.$unset).length === 0) {
      delete update.$unset;
    }

    await users.updateOne({ _id: new ObjectId(userId) }, update);

    res.json({
      blog: {
        bannerUrl,
        body,
        createdAt: user.mentorBlog?.createdAt || (hasBanner || hasBody ? now : null),
        updatedAt: hasBanner || hasBody ? now : null,
      },
      mentorBlogCompleted,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/admin', authGuard, requireAdmin, async (req, res, next) => {
  try {
    await connectToDatabase();
    const users = getCollection('users');

    const page = normalizePage(req.query.page);
    const limit = normalizeLimit(req.query.limit, 12, 100);
    const skip = (page - 1) * limit;
    const search = sanitizeString(req.query.search, MAX_SEARCH_LEN);
    const completedParam = String(req.query.completed || '').toLowerCase();

    const query = { role: 'mentor' };

    if (search) {
      query.$text = { $search: search };
    }

    if (completedParam === 'true' || completedParam === 'false') {
      query.mentorBlogCompleted = completedParam === 'true';
    }

    const projection = {
      name: 1,
      email: 1,
      avatar: 1,
      role: 1,
      createdAt: 1,
      updatedAt: 1,
      'mentorBlog.bannerUrl': 1,
      'mentorBlog.createdAt': 1,
      'mentorBlog.updatedAt': 1,
      'matchingProfile.primaryRole': 1,
      'matchingProfile.secondaryRoles': 1,
      'matchingProfile.skills': 1,
      'matchingProfile.techStack': 1,
      mentorBlogCompleted: 1,
    };

    const sort = { createdAt: -1 };

    const [total, docs] = await Promise.all([
      users.countDocuments(query),
      users.find(query, { projection }).sort(sort).skip(skip).limit(limit).toArray(),
    ]);

    res.json({
      items: docs.map((doc) => ({
        id: doc._id?.toString(),
        name: doc.name || 'Mentor',
        email: doc.email || '',
        avatar: doc.avatar || null,
        joinedAt: doc.createdAt || doc.updatedAt || null,
        mentorBlog: {
          bannerUrl: doc.mentorBlog?.bannerUrl || '',
          createdAt: doc.mentorBlog?.createdAt || null,
          updatedAt: doc.mentorBlog?.updatedAt || null,
        },
        mentorBlogCompleted: isMentorBlogCompleted(doc),
      })),
      page,
      limit,
      total,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/admin/:id', authGuard, requireAdmin, async (req, res, next) => {
  try {
    await connectToDatabase();
    const { id } = req.params;
    const users = getCollection('users');

    const query = buildUserIdQuery(id);
    const mentor = await users.findOne(
      { ...query, role: 'mentor' },
      {
        projection: {
          name: 1,
          email: 1,
          avatar: 1,
          createdAt: 1,
          updatedAt: 1,
          mentorBlog: 1,
          role: 1,
          'matchingProfile.primaryRole': 1,
          'matchingProfile.secondaryRoles': 1,
          'matchingProfile.skills': 1,
          'matchingProfile.techStack': 1,
        },
      }
    );

    if (!mentor) {
      return res.status(404).json({ error: 'Mentor not found' });
    }

    res.json({
      mentor: mapMentorDetail(mentor),
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/admin/:id', authGuard, requireAdmin, async (req, res, next) => {
  try {
    await connectToDatabase();
    const { id } = req.params;
    const users = getCollection('users');

    const rawBanner = req.body?.bannerUrl;
    const rawBody = req.body?.body;
    const bannerUrl = sanitizeUrl(rawBanner, MAX_BANNER_LEN);
    const body = sanitizeBody(rawBody, MAX_BODY_LEN);

    if (rawBanner && !bannerUrl) {
      return res.status(400).json({ error: 'Invalid bannerUrl' });
    }

    const query = buildUserIdQuery(id);
    const mentor = await users.findOne(
      { ...query, role: 'mentor' },
      {
        projection: {
          mentorBlog: 1,
          role: 1,
          'matchingProfile.primaryRole': 1,
          'matchingProfile.secondaryRoles': 1,
          'matchingProfile.skills': 1,
          'matchingProfile.techStack': 1,
        },
      }
    );
    if (!mentor) {
      return res.status(404).json({ error: 'Mentor not found' });
    }

    const now = new Date();
    const hasBanner = Boolean(bannerUrl);
    const hasBody = Boolean(body);
    const mentorBlogCompleted = hasBanner && hasBody;

    const update = {
      $set: {
        mentorBlogCompleted,
        updatedAt: now,
      },
      $unset: {},
    };

    if (hasBanner || hasBody) {
      update.$set.mentorBlog = {
        bannerUrl,
        body,
        createdAt: mentor.mentorBlog?.createdAt || now,
        updatedAt: now,
      };
    } else {
      update.$unset.mentorBlog = '';
    }

    if (Object.keys(update.$unset).length === 0) {
      delete update.$unset;
    }

    await users.updateOne({ ...query, role: 'mentor' }, update);

    res.json({
      mentor: {
        ...mapMentorDetail({
          ...mentor,
          mentorBlog: {
            bannerUrl,
            body,
            createdAt: mentor.mentorBlog?.createdAt || (hasBanner || hasBody ? now : null),
            updatedAt: hasBanner || hasBody ? now : null,
          },
        }),
        mentorBlogCompleted,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    await connectToDatabase();
    const { id } = req.params;
    const users = getCollection('users');

    const query = buildUserIdQuery(id);
    const mentor = await users.findOne(
      { ...query, role: 'mentor', status: { $nin: ['banned', 'inactive', 'deleted'] }, 'privacy.showProfile': { $ne: false } },
      {
        projection: {
          name: 1,
          avatar: 1,
          bio: 1,
          createdAt: 1,
          updatedAt: 1,
          mentorBlog: 1,
          role: 1,
          'matchingProfile.primaryRole': 1,
          'matchingProfile.secondaryRoles': 1,
          'matchingProfile.skills': 1,
          'matchingProfile.techStack': 1,
        },
      }
    );

    if (!mentor) {
      return res.status(404).json({ error: 'Mentor not found' });
    }

    res.json({ mentor: mapMentorDetail(mentor) });
  } catch (error) {
    next(error);
  }
});

export default router;

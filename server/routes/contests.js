import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { connectToDatabase, getCollection } from '../lib/db.js';
import { getCached, invalidate } from '../lib/cache.js';
import { authGuard, requireRole } from '../middleware/auth.js';

const router = Router();

// Category normalization (map legacy values and new slugs to friendly labels)
const CATEGORY_MAP = {
  'it': 'IT & Tech',
  'it & tech': 'IT & Tech',
  'it & tech (hackathon, coding, ai/ml)': 'IT & Tech',
  'hackathon': 'IT & Tech',
  'coding': 'IT & Tech',
  'coding contest': 'IT & Tech',
  'ai/ml': 'IT & Tech',
  'ai': 'IT & Tech',
  'ml': 'IT & Tech',
  'programming': 'IT & Tech',
  'data': 'Data & Analytics',
  'data & analytics': 'Data & Analytics',
  'analytics': 'Data & Analytics',
  'data science': 'Data & Analytics',
  'cyber': 'Cybersecurity',
  'cybersecurity': 'Cybersecurity',
  'security': 'Cybersecurity',
  'infosec': 'Cybersecurity',
  'robotics': 'Robotics & IoT',
  'robot': 'Robotics & IoT',
  'iot': 'Robotics & IoT',
  'embedded': 'Robotics & IoT',
  'hardware': 'Robotics & IoT',
  'design': 'Design / UI-UX',
  'ui': 'Design / UI-UX',
  'ux': 'Design / UI-UX',
  'ui/ux': 'Design / UI-UX',
  'product design': 'Design / UI-UX',
  'business': 'Business & Strategy',
  'strategy': 'Business & Strategy',
  'case study': 'Business & Strategy',
  'management': 'Business & Strategy',
  'startup': 'Startup & Innovation',
  'innovation': 'Startup & Innovation',
  'pitch': 'Startup & Innovation',
  'entrepreneurship': 'Startup & Innovation',
  'marketing': 'Marketing & Growth',
  'growth': 'Marketing & Growth',
  'branding': 'Marketing & Growth',
  'brand': 'Marketing & Growth',
  'seo': 'Marketing & Growth',
  'ads': 'Marketing & Growth',
  'finance': 'Finance & Fintech',
  'fintech': 'Finance & Fintech',
  'investment': 'Finance & Fintech',
  'trading': 'Finance & Fintech',
  'health': 'Health & Biotech',
  'biotech': 'Health & Biotech',
  'medical': 'Health & Biotech',
  'med': 'Health & Biotech',
  'education': 'Education & EdTech',
  'edtech': 'Education & EdTech',
  'learning': 'Education & EdTech',
  'training': 'Education & EdTech',
  'sustainability': 'Sustainability & Environment',
  'environment': 'Sustainability & Environment',
  'green': 'Sustainability & Environment',
  'climate': 'Sustainability & Environment',
  'gaming': 'Gaming & Esports',
  'esports': 'Gaming & Esports',
  'game': 'Gaming & Esports',
  'research': 'Research & Science',
  'science': 'Research & Science',
  'other': 'Other'
};

function normalizeCategory(category = '') {
  const normalized = category.toString().toLowerCase().trim();
  if (!normalized) return '';
  if (CATEGORY_MAP[normalized]) return CATEGORY_MAP[normalized];

  // Fallback: partial match against known keys
  const hit = Object.entries(CATEGORY_MAP).find(([key]) => normalized.includes(key));
  if (hit) return hit[1];

  return category;
}

async function getActiveRegistrationCountMap(contestIds) {
  const registrations = getCollection('registrations');

  const normalizedIds = (contestIds || []).filter(Boolean);
  if (normalizedIds.length === 0) return new Map();

  // Handle legacy data where contestId may be stored as string instead of ObjectId
  const idStrings = normalizedIds.map((id) => id.toString());
  const inList = [...normalizedIds, ...idStrings];

  const rows = await registrations
    .aggregate([
      { $match: { status: 'active', contestId: { $in: inList } } },
      { $group: { _id: { $toString: '$contestId' }, count: { $sum: 1 } } },
    ])
    .toArray();

  const map = new Map();
  for (const row of rows) {
    map.set(row._id, row.count);
  }
  return map;
}

const contestFields = {
  projection: {
    title: 1,
    organizer: 1,
    dateStart: 1,
    deadline: 1,
    status: 1,
    fee: 1,
    tags: 1,
    image: 1,
    description: 1,
    // New fields for complete contest info
    location: 1,
    locationType: 1,
    category: 1,
    rules: 1,
    schedule: 1,
    prizes: 1,
    objectives: 1,
    eligibility: 1,
    organizerDetails: 1,
    maxParticipants: 1,
    registrationCount: 1,
    createdAt: 1,
    updatedAt: 1,
  },
};

// Get all unique tags from contests
router.get('/tags', async (req, res, next) => {
  try {
    await connectToDatabase();

    // Aggregate to get unique tags with count
    const tagsAggregation = await getCollection('contests').aggregate([
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1 } }, // Sort by popularity
      { $project: { tag: '$_id', count: 1, _id: 0 } }
    ]).toArray();

    res.json({
      tags: tagsAggregation.map(t => t.tag),
      tagsWithCount: tagsAggregation
    });
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    await connectToDatabase();
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const tag = typeof req.query.tag === 'string' ? req.query.tag : undefined;
    const query = tag ? { tags: tag } : {};

    // Cache key based on query params
    const cacheKey = `contests:list:${tag || 'all'}:${limit}`;

    const mapped = await getCached(
      cacheKey,
      async () => {
        const contests = await getCollection('contests')
          .find(query, contestFields)
          .sort({ createdAt: -1 })
          .limit(limit)
          .toArray();

        const countMap = await getActiveRegistrationCountMap(contests.map((c) => c._id));

        return contests.map((doc) => {
          const contest = mapContest(doc);
          contest.registrationCount = countMap.get(doc._id.toString()) ?? 0;
          return contest;
        });
      },
      600 // 10 minutes cache
    );

    res.json({ contests: mapped });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    await connectToDatabase();
    const id = req.params.id;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid contest id' });
    }

    const contestId = new ObjectId(id);
    const contest = await getCollection('contests').findOne({ _id: contestId }, contestFields);
    if (!contest) {
      return res.status(404).json({ error: 'Contest not found' });
    }

    const activeCount = await getCollection('registrations').countDocuments({
      status: 'active',
      $or: [{ contestId }, { contestId: id }],
    });

    const mapped = mapContest(contest);
    mapped.registrationCount = activeCount;

    res.json({ contest: mapped });
  } catch (error) {
    next(error);
  }
});

router.post('/', authGuard, requireRole('admin'), async (req, res, next) => {
  try {
    await connectToDatabase();
    const body = req.body || {};
    const required = ['title', 'organizer', 'dateStart', 'deadline'];
    const missing = required.filter((field) => !body[field]);
    if (missing.length) {
      return res.status(400).json({ error: `Missing fields: ${missing.join(', ')}` });
    }

    const payload = {
      title: String(body.title),
      organizer: String(body.organizer),
      dateStart: new Date(body.dateStart).toISOString(),
      deadline: new Date(body.deadline).toISOString(),
      status: body.status || 'OPEN',
      fee: Number(body.fee) || 0,
      tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
      image: body.image || '',
      description: body.description || '',
      // New fields
      location: body.location || '',
      locationType: body.locationType || 'online', // online, offline, hybrid
      category: normalizeCategory(body.category || ''), // Canonical category label
      rules: body.rules || '', // Rich text for contest rules
      schedule: Array.isArray(body.schedule) ? body.schedule : [], // Array of {date, title, description}
      prizes: Array.isArray(body.prizes) ? body.prizes : [], // Array of {rank, title, value, description}
      objectives: body.objectives || '', // Contest objectives
      eligibility: body.eligibility || '', // Eligibility requirements
      organizerDetails: body.organizerDetails || {}, // {name, school, logo, description, contact}
      maxParticipants: Number(body.maxParticipants) || 0,
      registrationCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: req.user?.id || null,
    };

    const result = await getCollection('contests').insertOne(payload);

    // Invalidate contests cache
    await invalidate('contests:*');

    res.status(201).json({ id: result.insertedId.toString() });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', authGuard, requireRole('admin'), async (req, res, next) => {
  try {
    await connectToDatabase();
    const id = req.params.id;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid contest id' });
    }

    const updates = { ...req.body, updatedAt: new Date() };
    const allowed = [
      'title', 'organizer', 'dateStart', 'deadline', 'status', 'fee', 'tags', 'image', 'description',
      // New fields
      'location', 'locationType', 'category', 'rules', 'schedule', 'prizes',
      'objectives', 'eligibility', 'organizerDetails', 'maxParticipants'
    ];
    const set = { updatedAt: new Date() };
    allowed.forEach((key) => {
      if (updates[key] !== undefined) {
        set[key] = key === 'category' ? normalizeCategory(updates[key]) : updates[key];
      }
    });

    const result = await getCollection('contests').updateOne(
      { _id: new ObjectId(id) },
      { $set: set }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Contest not found' });
    }

    res.json({ updated: true });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', authGuard, requireRole('admin'), async (req, res, next) => {
  try {
    await connectToDatabase();
    const id = req.params.id;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid contest id' });
    }

    const contestId = new ObjectId(id);
    const contests = getCollection('contests');
    const registrations = getCollection('registrations');
    const teamPosts = getCollection('team_posts');

    // Remove contest first
    const deleteResult = await contests.deleteOne({ _id: contestId });
    if (deleteResult.deletedCount === 0) {
      return res.status(404).json({ error: 'Contest not found' });
    }

    // Best-effort cleanup of related data
    const [registrationCleanup, teamPostsCleanup] = await Promise.allSettled([
      registrations.deleteMany({ contestId }),
      teamPosts.deleteMany({
        $or: [
          { contestId },
          { contestId: id }, // handle string-stored ids
        ]
      })
    ]);

    res.json({
      deleted: true,
      removedRegistrations: registrationCleanup.status === 'fulfilled'
        ? registrationCleanup.value.deletedCount
        : 0,
      removedTeamPosts: teamPostsCleanup.status === 'fulfilled'
        ? teamPostsCleanup.value.deletedCount
        : 0,
    });
  } catch (error) {
    next(error);
  }
});

function mapContest(doc) {
  const maxParticipants = Number(doc.maxParticipants) || 0;
  return {
    id: doc._id?.toString(),
    title: doc.title,
    organizer: doc.organizer,
    dateStart: doc.dateStart,
    deadline: doc.deadline,
    status: doc.status,
    fee: doc.fee,
    tags: doc.tags || [],
    image: doc.image,
    description: doc.description,
    // New fields
    location: doc.location || '',
    locationType: doc.locationType || 'online',
    category: doc.category || '',
    rules: doc.rules || '',
    schedule: doc.schedule || [],
    prizes: doc.prizes || [],
    objectives: doc.objectives || '',
    eligibility: doc.eligibility || '',
    organizerDetails: doc.organizerDetails || {},
    maxParticipants: maxParticipants > 0 ? maxParticipants : undefined,
    registrationCount: Number(doc.registrationCount) || 0,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export default router;

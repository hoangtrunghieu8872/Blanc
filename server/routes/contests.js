import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { connectToDatabase, getCollection } from '../lib/db.js';
import { authGuard, requireRole } from '../middleware/auth.js';

const router = Router();

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

    const contests = await getCollection('contests')
      .find(query, contestFields)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    res.json({ contests: contests.map(mapContest) });
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

    const contest = await getCollection('contests').findOne({ _id: new ObjectId(id) }, contestFields);
    if (!contest) {
      return res.status(404).json({ error: 'Contest not found' });
    }
    res.json({ contest: mapContest(contest) });
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
      category: body.category || '', // Hackathon, Design Challenge, Coding Contest, etc.
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
        set[key] = updates[key];
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

function mapContest(doc) {
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
    maxParticipants: doc.maxParticipants || 0,
    registrationCount: doc.registrationCount || 0,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export default router;

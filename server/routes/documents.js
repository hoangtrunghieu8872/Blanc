import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { connectToDatabase, getCollection } from '../lib/db.js';
import { authGuard, requireRole } from '../middleware/auth.js';

const router = Router();

const documentFields = {
    projection: {
        title: 1,
        author: 1,
        category: 1,
        link: 1,
        description: 1,
        isPublic: 1,
        thumbnail: 1,
        downloads: 1,
        createdAt: 1,
        updatedAt: 1,
    },
};

// Helper: Map document from DB to API response
function mapDocument(doc) {
    return {
        id: doc._id?.toString(),
        title: doc.title,
        author: doc.author,
        category: doc.category,
        link: doc.link,
        description: doc.description || '',
        isPublic: doc.isPublic !== false,
        thumbnail: doc.thumbnail || '',
        downloads: doc.downloads || 0,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    };
}

// GET /api/documents - Get all documents
router.get('/', async (req, res, next) => {
    try {
        await connectToDatabase();
        const limit = Math.min(Number(req.query.limit) || 50, 100);
        const page = Math.max(Number(req.query.page) || 1, 1);
        const skip = (page - 1) * limit;

        const category = typeof req.query.category === 'string' ? req.query.category : undefined;
        const search = typeof req.query.search === 'string' ? req.query.search : undefined;
        const isPublic = req.query.isPublic !== undefined ? req.query.isPublic === 'true' : undefined;

        // Build query
        const query = {};

        if (category) {
            query.category = category;
        }

        if (isPublic !== undefined) {
            query.isPublic = isPublic;
        }

        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { author: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
            ];
        }

        const collection = getCollection('documents');

        // Get total count for pagination
        const total = await collection.countDocuments(query);

        // Get documents with pagination
        const documents = await collection
            .find(query, documentFields)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .toArray();

        res.json({
            documents: documents.map(mapDocument),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/documents/:id - Get single document
router.get('/:id', async (req, res, next) => {
    try {
        await connectToDatabase();
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid document id' });
        }

        const document = await getCollection('documents').findOne(
            { _id: new ObjectId(id) },
            documentFields
        );

        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }

        res.json({ document: mapDocument(document) });
    } catch (error) {
        next(error);
    }
});

// POST /api/documents - Create document (admin only)
router.post('/', authGuard, requireRole('admin'), async (req, res, next) => {
    try {
        await connectToDatabase();
        const body = req.body || {};

        // Validate required fields
        const required = ['title', 'author', 'category', 'link'];
        const missing = required.filter((field) => !body[field]);
        if (missing.length) {
            return res.status(400).json({ error: `Missing fields: ${missing.join(', ')}` });
        }

        // Validate category
        const validCategories = ['Tutorial', 'Reference', 'Guide', 'Research'];
        if (!validCategories.includes(body.category)) {
            return res.status(400).json({ error: `Invalid category. Must be one of: ${validCategories.join(', ')}` });
        }

        // Validate URL format
        try {
            new URL(body.link);
        } catch {
            return res.status(400).json({ error: 'Invalid link URL format' });
        }

        const payload = {
            title: String(body.title).trim(),
            author: String(body.author).trim(),
            category: body.category,
            link: String(body.link).trim(),
            description: body.description ? String(body.description).trim() : '',
            isPublic: body.isPublic !== false,
            thumbnail: body.thumbnail ? String(body.thumbnail).trim() : '',
            downloads: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: req.user?.id || null,
        };

        const result = await getCollection('documents').insertOne(payload);

        res.status(201).json({
            id: result.insertedId.toString(),
            document: mapDocument({ ...payload, _id: result.insertedId })
        });
    } catch (error) {
        next(error);
    }
});

// PATCH /api/documents/:id - Update document (admin only)
router.patch('/:id', authGuard, requireRole('admin'), async (req, res, next) => {
    try {
        await connectToDatabase();
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid document id' });
        }

        const updates = { ...req.body, updatedAt: new Date() };

        // Validate category if provided
        if (updates.category) {
            const validCategories = ['Tutorial', 'Reference', 'Guide', 'Research'];
            if (!validCategories.includes(updates.category)) {
                return res.status(400).json({ error: `Invalid category. Must be one of: ${validCategories.join(', ')}` });
            }
        }

        // Validate URL if provided
        if (updates.link) {
            try {
                new URL(updates.link);
            } catch {
                return res.status(400).json({ error: 'Invalid link URL format' });
            }
        }

        const allowed = ['title', 'author', 'category', 'link', 'description', 'isPublic', 'thumbnail', 'updatedAt'];
        const set = {};
        allowed.forEach((key) => {
            if (updates[key] !== undefined) {
                set[key] = updates[key];
            }
        });

        const result = await getCollection('documents').findOneAndUpdate(
            { _id: new ObjectId(id) },
            { $set: set },
            { returnDocument: 'after' }
        );

        if (!result.value && !result) {
            return res.status(404).json({ error: 'Document not found' });
        }

        const updatedDoc = result.value || result;
        res.json({ updated: true, document: mapDocument(updatedDoc) });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/documents/:id - Delete document (admin only)
router.delete('/:id', authGuard, requireRole('admin'), async (req, res, next) => {
    try {
        await connectToDatabase();
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid document id' });
        }

        const result = await getCollection('documents').deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Document not found' });
        }

        res.json({ deleted: true });
    } catch (error) {
        next(error);
    }
});

// POST /api/documents/:id/download - Increment download count
router.post('/:id/download', async (req, res, next) => {
    try {
        await connectToDatabase();
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid document id' });
        }

        const result = await getCollection('documents').findOneAndUpdate(
            { _id: new ObjectId(id) },
            { $inc: { downloads: 1 } },
            { returnDocument: 'after' }
        );

        if (!result.value && !result) {
            return res.status(404).json({ error: 'Document not found' });
        }

        const doc = result.value || result;
        res.json({ downloads: doc.downloads });
    } catch (error) {
        next(error);
    }
});

export default router;

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

const ALLOWED_SORT_FIELDS = new Set(['createdAt', 'updatedAt', 'downloads', 'title', 'author']);
const ALLOWED_FIELDS = new Set([
    'it',
    'data',
    'cyber',
    'robotics',
    'design',
    'business',
    'startup',
    'marketing',
    'finance',
    'health',
    'education',
    'sustainability',
    'gaming',
    'research',
    'other',
]);

const FIELD_REGEX = {
    it: /\b(react|next\.?js|node\.?js|javascript|typescript|python|java\b|golang|go\b|c\+\+|cpp|c#|dotnet|\.net|php|ruby|swift|kotlin|android|ios|flutter|dart|html|css|web|frontend|back[- ]?end|full[- ]?stack|devops|docker|kubernetes|git|api|algorithm|coding|code|programming|lập\s*trình|phần\s*mềm|software)\b/i,
    data: /\b(data|analytics|analysis|bi|business intelligence|power\s*bi|tableau|sql|nosql|etl|warehouse|lakehouse|big\s*data|spark|hadoop|ml|ai|machine\s*learning|deep\s*learning|neural|nlp|llm|gen(erative)?\s*ai|computer\s*vision|cv\b|thị\s*giác\s*máy|trí\s*tuệ\s*nhân\s*tạo|dữ\s*liệu|phân\s*tích)\b/i,
    cyber: /\b(cyber|cybersecurity|security|infosec|pentest|penetration|vulnerability|exploit|malware|forensics|soc\b|siem|xdr|iam|owasp|zero\s*trust|bảo\s*mật|an\s*ninh\s*mạng|kiểm\s*thử\s*xâm\s*nhập)\b/i,
    robotics: /\b(robot|robotics|iot\b|internet\s*of\s*things|embedded|arduino|raspberry\s*pi|stm32|microcontroller|firmware|sensor|hardware|pcb|mạch|nhúng|phần\s*cứng)\b/i,
    design: /\b(ui|ux|ui\/ux|design|figma|sketch|adobe|photoshop|illustrator|after\s*effects|motion|animation|graphic|branding|typography|layout|thiết\s*kế|đồ\s*họa)\b/i,
    business: /\b(business|strategy|management|operations|product\s*management|product|pm\b|ba\b|business\s*analyst|case\s*study|consulting|leadership|sales|crm|kpi|okrs?|kinh\s*doanh|chiến\s*lược|quản\s*trị|quản\s*lý)\b/i,
    startup: /\b(startup|innovation|entrepreneur(ship)?|pitch|venture|mvp\b|incubator|accelerator|founder|go[- ]?to[- ]?market|gtm\b|khởi\s*nghiệp|đổi\s*mới)\b/i,
    marketing: /\b(marketing|growth|seo\b|sem\b|ads?|facebook\s*ads|google\s*ads|tiktok|content|social|brand(ing)?|pr\b|copywriting|email\s*marketing|crm|tiếp\s*thị|tăng\s*trưởng)\b/i,
    finance: /\b(finance|fintech|bank(ing)?|accounting|audit|investment|trading|stocks?|portfolio|risk|crypto|blockchain|defi|tài\s*chính|kế\s*toán|đầu\s*tư)\b/i,
    health: /\b(health|biotech|bio\b|medical|medicine|pharma|clinical|genomics?|proteomics?|lab|sức\s*khỏe|y\s*tế|sinh\s*học)\b/i,
    education: /\b(education|edtech|learning|teaching|training|course|curriculum|lms\b|giáo\s*dục|giảng\s*dạy|đào\s*tạo)\b/i,
    sustainability: /\b(sustainability|environment|climate|renewable|carbon|esg\b|green|recycle|circular|môi\s*trường|bền\s*vững|khí\s*hậu)\b/i,
    gaming: /\b(gaming|esports|game\s*dev|gameplay|unity|unreal|steam|trò\s*chơi|game)\b/i,
    research: /\b(research|science|scientific|paper|publication|journal|thesis|academic|study\b|nghiên\s*cứu|khoa\s*học)\b/i,
};

function escapeRegExp(value = '') {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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
        const field = typeof req.query.field === 'string' ? req.query.field : undefined;
        const search = typeof req.query.search === 'string' ? req.query.search : undefined;
        const author = typeof req.query.author === 'string' ? req.query.author : undefined;
        const isPublic = req.query.isPublic !== undefined ? req.query.isPublic === 'true' : undefined;
        const sortBy = typeof req.query.sortBy === 'string' ? req.query.sortBy : undefined;
        const sortOrderRaw = typeof req.query.sortOrder === 'string' ? req.query.sortOrder : undefined;

        // Build query
        const query = {};
        const and = [];

        if (category) {
            query.category = category;
        }

        if (isPublic !== undefined) {
            query.isPublic = isPublic;
        }

        if (author && author.trim()) {
            const safeAuthor = escapeRegExp(author.trim().slice(0, 100));
            query.author = { $regex: safeAuthor, $options: 'i' };
        }

        if (search && search.trim()) {
            const safeSearch = escapeRegExp(search.trim().slice(0, 200));
            and.push({ $or: [
                { title: { $regex: safeSearch, $options: 'i' } },
                { author: { $regex: safeSearch, $options: 'i' } },
                { description: { $regex: safeSearch, $options: 'i' } },
            ] });
        }

        const normalizedField = field ? field.toLowerCase().trim() : '';
        if (normalizedField && ALLOWED_FIELDS.has(normalizedField)) {
            const buildFieldClause = (key) => ({
                $or: [
                    { title: { $regex: FIELD_REGEX[key] } },
                    { author: { $regex: FIELD_REGEX[key] } },
                    { description: { $regex: FIELD_REGEX[key] } },
                ],
            });

            if (normalizedField === 'other') {
                const clauses = [...ALLOWED_FIELDS]
                    .filter((key) => key !== 'other')
                    .map((key) => buildFieldClause(key));
                and.push({ $nor: clauses });
            } else {
                const regex = FIELD_REGEX[normalizedField];
                if (regex) {
                    and.push(buildFieldClause(normalizedField));
                }
            }
        }

        if (and.length) {
            query.$and = and;
        }

        const sortOrder = sortOrderRaw === 'asc' ? 1 : -1;
        const sortField = sortBy && ALLOWED_SORT_FIELDS.has(sortBy) ? sortBy : 'createdAt';
        const sort = { [sortField]: sortOrder, _id: -1 };

        const collection = getCollection('documents');

        // Get total count for pagination
        const total = await collection.countDocuments(query);

        // Get documents with pagination
        const documents = await collection
            .find(query, documentFields)
            .sort(sort)
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

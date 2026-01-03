import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { getCollection } from '../lib/db.js';
import { authGuard } from '../middleware/auth.js';

const router = Router();

function sanitizeFeedbackMessage(value, maxLength = 2000) {
    if (!value || typeof value !== 'string') return '';
    return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim().slice(0, maxLength);
}

function sanitizeString(value, maxLength = 200) {
    if (!value || typeof value !== 'string') return '';
    return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim().slice(0, maxLength);
}

function normalizeIsoDate(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
}

function normalizeRelatedType(value) {
    const raw = sanitizeString(value, 40).toLowerCase();
    if (!raw) return null;
    if (raw === 'contest' || raw === 'course') return raw;
    return null;
}

const ALLOWED_EVIDENCE_MIME_TYPES = new Set([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp'
]);

function buildEvidenceUrl(fileId, mimeType) {
    const safeId = sanitizeString(fileId, 200);
    const safeMime = sanitizeString(mimeType, 120);
    if (!safeId) return '';

    if (safeMime.startsWith('image/')) {
        return `https://lh3.googleusercontent.com/d/${safeId}`;
    }

    return `https://drive.google.com/file/d/${safeId}/view`;
}

function sanitizeActivitiesInput(value) {
    if (value === undefined) return { provided: false };
    if (!Array.isArray(value)) return { provided: true, error: 'Invalid activities' };

    const items = value.map((raw) => {
        const title = sanitizeString(raw?.title, 120);
        if (!title) return { error: 'Activity title is required' };

        const occurredAtInput = raw?.occurredAt;
        const occurredAt = occurredAtInput ? normalizeIsoDate(occurredAtInput) : null;
        if (occurredAtInput && !occurredAt) return { error: 'Invalid activity occurredAt' };

        return {
            id: sanitizeString(raw?.id, 80) || new ObjectId().toString(),
            title,
            description: sanitizeString(raw?.description, 2000) || null,
            occurredAt
        };
    });

    const error = items.find((i) => i?.error)?.error;
    if (error) return { provided: true, error };

    return { provided: true, value: items };
}

function sanitizeEvidenceInput(value) {
    if (value === undefined) return { provided: false };
    if (!Array.isArray(value)) return { provided: true, error: 'Invalid evidence' };

    const items = value.map((raw) => {
        const fileId = sanitizeString(raw?.fileId, 200);
        const mimeType = sanitizeString(raw?.mimeType, 120);
        const fileName = sanitizeString(raw?.fileName, 200);
        const urlInput = sanitizeString(raw?.url, 1000);

        const uploadedAtInput = raw?.uploadedAt;
        const uploadedAt = uploadedAtInput ? normalizeIsoDate(uploadedAtInput) : new Date().toISOString();
        if (uploadedAtInput && !uploadedAt) return { error: 'Invalid evidence uploadedAt' };

        // Manual evidence: allow arbitrary URL input (http/https).
        if (urlInput) {
            if (!fileName) return { error: 'Evidence fileName is required' };
            if (!/^https?:\/\//i.test(urlInput)) return { error: 'Evidence url must be http(s)' };

            return {
                id: sanitizeString(raw?.id, 80) || new ObjectId().toString(),
                fileId: fileId || '',
                fileName,
                mimeType: mimeType || 'link',
                url: urlInput,
                uploadedAt
            };
        }

        // Drive evidence: validated uploads (images/PDF) stored as Google Drive fileId.
        if (!fileId) return { error: 'Evidence fileId is required' };
        if (!mimeType) return { error: 'Evidence mimeType is required' };
        if (!ALLOWED_EVIDENCE_MIME_TYPES.has(mimeType)) return { error: 'Unsupported evidence mimeType' };
        if (!fileName) return { error: 'Evidence fileName is required' };

        return {
            id: sanitizeString(raw?.id, 80) || new ObjectId().toString(),
            fileId,
            fileName,
            mimeType,
            url: buildEvidenceUrl(fileId, mimeType),
            uploadedAt
        };
    });

    const error = items.find((i) => i?.error)?.error;
    if (error) return { provided: true, error };

    return { provided: true, value: items };
}

// ============ GET ALL REPORTS (for current user) ============
router.get('/', authGuard, async (req, res) => {
    try {
        const userId = req.user.id;
        const { status, template, search, limit = 20, skip = 0 } = req.query;

        const reports = getCollection('reports');

        // Build query
        const query = { userId };

        if (status) {
            query.status = status;
        }

        if (template) {
            query.template = template;
        }

        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { content: { $regex: search, $options: 'i' } }
            ];
        }

        const [items, total] = await Promise.all([
            reports.find(query)
                .sort({ updatedAt: -1 })
                .skip(parseInt(skip))
                .limit(parseInt(limit))
                .toArray(),
            reports.countDocuments(query)
        ]);

        // Convert _id to id for frontend compatibility
        const formattedItems = items.map(item => ({
            id: item._id.toString(),
            title: item.title,
            template: item.template,
            status: item.status,
            reviewStatus: item.reviewStatus || 'draft',
            submittedAt: item.submittedAt || null,
            reviewedAt: item.reviewedAt || null,
            relatedType: item.relatedType || null,
            relatedId: item.relatedId || null,
            content: item.content,
            lastEdited: formatLastEdited(item.updatedAt),
            createdAt: item.createdAt,
            updatedAt: item.updatedAt
        }));

        res.json({
            reports: formattedItems,
            total,
            hasMore: skip + items.length < total
        });
    } catch (error) {
        console.error('[reports] Error fetching reports:', error);
        res.status(500).json({ error: 'Không thể tải danh sách báo cáo' });
    }
});

// ============ GET TEMPLATES (must be before /:id) ============
router.get('/templates/list', async (req, res) => {
    // Static templates - could be moved to database if needed
    const templates = [
        { id: '1', title: 'Báo cáo tiến độ tuần', description: 'Theo dõi tiến độ học tập và thi đấu hàng tuần.', category: 'Học tập', icon: 'BarChart' },
        { id: '2', title: 'Tổng kết cuộc thi', description: 'Ghi nhận kết quả và bài học từ cuộc thi.', category: 'Cuộc thi', icon: 'Trophy' },
        { id: '3', title: 'Báo cáo nhóm', description: 'Tổng hợp hoạt động và đóng góp của team.', category: 'Nhóm', icon: 'Users' },
        { id: '4', title: 'Đánh giá khóa học', description: 'Nhận xét và phản hồi về khóa học đã tham gia.', category: 'Khóa học', icon: 'GraduationCap' },
        { id: '5', title: 'Tổng kết học kỳ', description: 'Đánh giá tổng quan hoạt động trong học kỳ.', category: 'Học tập', icon: 'BookOpen' },
        { id: '6', title: 'Kế hoạch học tập', description: 'Lập kế hoạch và mục tiêu học tập.', category: 'Học tập', icon: 'Target' },
        { id: '7', title: 'Đề xuất tham gia', description: 'Đề xuất tham gia cuộc thi hoặc dự án mới.', category: 'Cuộc thi', icon: 'Lightbulb' },
        { id: '8', title: 'Phân tích đối thủ', description: 'Phân tích và đánh giá các đội thi khác.', category: 'Cuộc thi', icon: 'Search' },
        { id: '9', title: 'Đánh giá thành viên', description: 'Đánh giá đóng góp của thành viên trong nhóm.', category: 'Nhóm', icon: 'UserCheck' },
        { id: '10', title: 'Dự án cuối khóa', description: 'Báo cáo chi tiết về dự án cuối khóa.', category: 'Khóa học', icon: 'Folder' },
        { id: '11', title: 'Báo cáo tài chính', description: 'Theo dõi chi phí và ngân sách hoạt động.', category: 'Nhóm', icon: 'DollarSign' },
        { id: '12', title: 'Báo cáo tùy chỉnh', description: 'Tạo báo cáo theo nhu cầu riêng của bạn.', category: 'Khác', icon: 'FileText' },
    ];

    res.json(templates);
});

// ============ GET SINGLE REPORT ============
router.get('/:id', authGuard, async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'ID báo cáo không hợp lệ' });
        }

        const reports = getCollection('reports');
        const report = await reports.findOne({
            _id: new ObjectId(id),
            userId
        });

        if (!report) {
            return res.status(404).json({ error: 'Không tìm thấy báo cáo' });
        }

        res.json({
            id: report._id.toString(),
            title: report.title,
            template: report.template,
            status: report.status,
            reviewStatus: report.reviewStatus || 'draft',
            submittedAt: report.submittedAt || null,
            reviewedAt: report.reviewedAt || null,
            relatedType: report.relatedType || null,
            relatedId: report.relatedId || null,
            activities: report.activities || [],
            evidence: report.evidence || [],
            content: report.content,
            lastEdited: formatLastEdited(report.updatedAt),
            createdAt: report.createdAt,
            updatedAt: report.updatedAt
        });
    } catch (error) {
        console.error('[reports] Error fetching report:', error);
        res.status(500).json({ error: 'Không thể tải báo cáo' });
    }
});

// ============ CREATE NEW REPORT ============
router.post('/', authGuard, async (req, res) => {
    try {
        const userId = req.user.id;
        const { title, template, content, status = 'Draft', relatedType, relatedId } = req.body;

        if (!title || !template) {
            return res.status(400).json({ error: 'Tiêu đề và template là bắt buộc' });
        }

        const reports = getCollection('reports');
        const now = new Date();

        const normalizedRelatedType = normalizeRelatedType(relatedType);
        const normalizedRelatedId = sanitizeString(relatedId, 120) || null;

        const newReport = {
            userId,
            title,
            template,
            content: content || '',
            activities: [],
            evidence: [],
            status,
            relatedType: normalizedRelatedType,
            relatedId: normalizedRelatedType && normalizedRelatedId ? normalizedRelatedId : null,
            reviewStatus: 'draft',
            submittedAt: null,
            reviewedAt: null,
            reviewedById: null,
            reviewStatusUpdatedAt: now,
            createdAt: now,
            updatedAt: now
        };

        const result = await reports.insertOne(newReport);

        res.status(201).json({
            id: result.insertedId.toString(),
            title: newReport.title,
            template: newReport.template,
            status: newReport.status,
            reviewStatus: newReport.reviewStatus,
            submittedAt: newReport.submittedAt,
            reviewedAt: newReport.reviewedAt,
            activities: newReport.activities,
            evidence: newReport.evidence,
            relatedType: newReport.relatedType || null,
            relatedId: newReport.relatedId || null,
            content: newReport.content,
            lastEdited: 'Vừa xong',
            createdAt: newReport.createdAt,
            updatedAt: newReport.updatedAt
        });
    } catch (error) {
        console.error('[reports] Error creating report:', error);
        res.status(500).json({ error: 'Không thể tạo báo cáo' });
    }
});

// ============ UPDATE REPORT ============
router.put('/:id', authGuard, async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const { title, content, status, activities, evidence, relatedType, relatedId } = req.body;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'ID báo cáo không hợp lệ' });
        }

        const reports = getCollection('reports');

        // Check ownership
        const existing = await reports.findOne({
            _id: new ObjectId(id),
            userId
        });

        if (!existing) {
            return res.status(404).json({ error: 'Không tìm thấy báo cáo' });
        }

        const updateData = {
            updatedAt: new Date()
        };

        // If report was submitted/approved, editing content/title moves it back to draft.
        const isContentEdit =
            title !== undefined ||
            content !== undefined ||
            activities !== undefined ||
            evidence !== undefined ||
            relatedType !== undefined ||
            relatedId !== undefined;
        const existingReviewStatus = String(existing.reviewStatus || 'draft').toLowerCase();
        if (isContentEdit && (existingReviewStatus === 'submitted' || existingReviewStatus === 'approved')) {
            updateData.reviewStatus = 'draft';
            updateData.submittedAt = null;
            updateData.reviewedAt = null;
            updateData.reviewedById = null;
            updateData.reviewStatusUpdatedAt = updateData.updatedAt;
        }

        if (title !== undefined) updateData.title = title;
        if (content !== undefined) updateData.content = content;
        if (status !== undefined) updateData.status = status;

        if (relatedType !== undefined || relatedId !== undefined) {
            const normalizedRelatedType = normalizeRelatedType(relatedType);
            const normalizedRelatedId = sanitizeString(relatedId, 120) || null;
            updateData.relatedType = normalizedRelatedType;
            updateData.relatedId = normalizedRelatedType && normalizedRelatedId ? normalizedRelatedId : null;
        }

        const activitiesParsed = sanitizeActivitiesInput(activities);
        if (activitiesParsed.provided && activitiesParsed.error) {
            return res.status(400).json({ error: activitiesParsed.error });
        }
        if (activitiesParsed.provided) updateData.activities = activitiesParsed.value;

        const evidenceParsed = sanitizeEvidenceInput(evidence);
        if (evidenceParsed.provided && evidenceParsed.error) {
            return res.status(400).json({ error: evidenceParsed.error });
        }
        if (evidenceParsed.provided) updateData.evidence = evidenceParsed.value;

        await reports.updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );

        const updated = await reports.findOne({ _id: new ObjectId(id) });

        res.json({
            id: updated._id.toString(),
            title: updated.title,
            template: updated.template,
            status: updated.status,
            reviewStatus: updated.reviewStatus || 'draft',
            submittedAt: updated.submittedAt || null,
            reviewedAt: updated.reviewedAt || null,
            activities: updated.activities || [],
            evidence: updated.evidence || [],
            relatedType: updated.relatedType || null,
            relatedId: updated.relatedId || null,
            relatedType: updated.relatedType || null,
            relatedId: updated.relatedId || null,
            content: updated.content,
            lastEdited: formatLastEdited(updated.updatedAt),
            createdAt: updated.createdAt,
            updatedAt: updated.updatedAt
        });
    } catch (error) {
        console.error('[reports] Error updating report:', error);
        res.status(500).json({ error: 'Không thể cập nhật báo cáo' });
    }
});

// ============ DELETE REPORT ============
router.delete('/:id', authGuard, async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'ID báo cáo không hợp lệ' });
        }

        const reports = getCollection('reports');

        // Check ownership and delete
        const result = await reports.deleteOne({
            _id: new ObjectId(id),
            userId
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Không tìm thấy báo cáo' });
        }

        res.json({ success: true, message: 'Đã xóa báo cáo' });
    } catch (error) {
        console.error('[reports] Error deleting report:', error);
        res.status(500).json({ error: 'Không thể xóa báo cáo' });
    }
});

// ============ DUPLICATE REPORT ============
router.post('/:id/duplicate', authGuard, async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'ID báo cáo không hợp lệ' });
        }

        const reports = getCollection('reports');

        // Find original
        const original = await reports.findOne({
            _id: new ObjectId(id),
            userId
        });

        if (!original) {
            return res.status(404).json({ error: 'Không tìm thấy báo cáo' });
        }

        const now = new Date();
        const duplicated = {
            userId,
            title: `${original.title} (Bản sao)`,
            template: original.template,
            content: original.content,
            activities: Array.isArray(original.activities) ? original.activities : [],
            evidence: Array.isArray(original.evidence) ? original.evidence : [],
            status: 'Draft',
            relatedType: original.relatedType || null,
            relatedId: original.relatedId || null,
            reviewStatus: 'draft',
            submittedAt: null,
            reviewedAt: null,
            reviewedById: null,
            reviewStatusUpdatedAt: now,
            createdAt: now,
            updatedAt: now
        };

        const result = await reports.insertOne(duplicated);

        res.status(201).json({
            id: result.insertedId.toString(),
            title: duplicated.title,
            template: duplicated.template,
            status: duplicated.status,
            reviewStatus: duplicated.reviewStatus,
            submittedAt: duplicated.submittedAt,
            reviewedAt: duplicated.reviewedAt,
            activities: duplicated.activities,
            evidence: duplicated.evidence,
            relatedType: duplicated.relatedType || null,
            relatedId: duplicated.relatedId || null,
            content: duplicated.content,
            lastEdited: 'Vừa xong',
            createdAt: duplicated.createdAt,
            updatedAt: duplicated.updatedAt
        });
    } catch (error) {
        console.error('[reports] Error duplicating report:', error);
        res.status(500).json({ error: 'Không thể nhân bản báo cáo' });
    }
});

// ============ UPDATE STATUS ============
router.patch('/:id/status', authGuard, async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const { status } = req.body;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'ID báo cáo không hợp lệ' });
        }

        if (!['Draft', 'Ready', 'Sent'].includes(status)) {
            return res.status(400).json({ error: 'Trạng thái không hợp lệ' });
        }

        const reports = getCollection('reports');

        const result = await reports.updateOne(
            { _id: new ObjectId(id), userId },
            { $set: { status, updatedAt: new Date() } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Không tìm thấy báo cáo' });
        }

        res.json({ success: true, status });
    } catch (error) {
        console.error('[reports] Error updating status:', error);
        res.status(500).json({ error: 'Không thể cập nhật trạng thái' });
    }
});

// ============ SUBMIT FOR REVIEW ============
router.post('/:id/submit', authGuard, async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid report id' });
        }

        const reports = getCollection('reports');
        const now = new Date();

        const result = await reports.findOneAndUpdate(
            { _id: new ObjectId(id), userId },
            { $set: { reviewStatus: 'submitted', submittedAt: now, reviewStatusUpdatedAt: now, updatedAt: now } },
            { returnDocument: 'after' }
        );

        const updated = result?.value ?? result;
        if (!updated) {
            return res.status(404).json({ error: 'Report not found' });
        }

        res.json({
            id: updated._id.toString(),
            title: updated.title,
            template: updated.template,
            status: updated.status,
            reviewStatus: updated.reviewStatus || 'submitted',
            submittedAt: updated.submittedAt || now,
            reviewedAt: updated.reviewedAt || null,
            activities: updated.activities || [],
            evidence: updated.evidence || [],
            content: updated.content,
            lastEdited: formatLastEdited(updated.updatedAt),
            createdAt: updated.createdAt,
            updatedAt: updated.updatedAt
        });
    } catch (error) {
        console.error('[reports] Error submitting report:', error);
        res.status(500).json({ error: 'Unable to submit report' });
    }
});

// ============ FEEDBACK THREAD (for report owner) ============
router.get('/:id/feedback', authGuard, async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid report id' });
        }

        const reports = getCollection('reports');
        const report = await reports.findOne({ _id: new ObjectId(id), userId }, { projection: { _id: 1 } });

        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }

        const feedback = getCollection('report_feedback');
        const users = getCollection('users');

        const items = await feedback
            .find({ reportId: new ObjectId(id) })
            .sort({ createdAt: 1 })
            .toArray();

        const authorIds = [...new Set(items.map((f) => f.authorId).filter((aid) => ObjectId.isValid(String(aid))))].map(
            (aid) => new ObjectId(String(aid))
        );

        const authors = authorIds.length
            ? await users.find({ _id: { $in: authorIds } }, { projection: { name: 1, avatar: 1, role: 1 } }).toArray()
            : [];
        const authorMap = new Map(authors.map((u) => [u._id.toString(), u]));

        res.json({
            feedback: items.map((doc) => {
                const author = authorMap.get(String(doc.authorId));
                return {
                    id: doc._id?.toString(),
                    reportId: doc.reportId?.toString(),
                    authorId: doc.authorId,
                    authorRole: doc.authorRole,
                    authorName: author?.name || null,
                    authorAvatar: author?.avatar || null,
                    message: doc.message || '',
                    createdAt: doc.createdAt
                };
            })
        });
    } catch (error) {
        console.error('[reports] Error fetching feedback:', error);
        res.status(500).json({ error: 'Unable to fetch feedback' });
    }
});

router.post('/:id/feedback', authGuard, async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const message = sanitizeFeedbackMessage(req.body?.message);

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid report id' });
        }

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const reports = getCollection('reports');
        const report = await reports.findOne({ _id: new ObjectId(id), userId }, { projection: { _id: 1 } });

        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }

        const feedback = getCollection('report_feedback');
        const now = new Date();
        const doc = {
            reportId: new ObjectId(id),
            reportOwnerId: userId,
            authorId: userId,
            authorRole: req.user.role || 'student',
            message,
            createdAt: now
        };

        const result = await feedback.insertOne(doc);

        res.status(201).json({
            feedback: {
                id: result.insertedId.toString(),
                reportId: doc.reportId.toString(),
                authorId: doc.authorId,
                authorRole: doc.authorRole,
                authorName: null,
                authorAvatar: null,
                message: doc.message,
                createdAt: doc.createdAt
            }
        });
    } catch (error) {
        console.error('[reports] Error creating feedback:', error);
        res.status(500).json({ error: 'Unable to send feedback' });
    }
});

// ============ HELPER FUNCTIONS ============

function formatLastEdited(date) {
    if (!date) return 'Chưa rõ';

    const now = new Date();
    const diff = now - new Date(date);
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'Vừa xong';
    if (minutes < 60) return `${minutes} phút trước`;
    if (hours < 24) return `${hours} giờ trước`;
    if (days < 7) return `${days} ngày trước`;

    return new Date(date).toLocaleDateString('vi-VN');
}

export default router;

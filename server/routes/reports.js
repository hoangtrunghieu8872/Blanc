import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { getCollection } from '../lib/db.js';
import { authGuard } from '../middleware/auth.js';

const router = Router();

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
        const { title, template, content, status = 'Draft' } = req.body;

        if (!title || !template) {
            return res.status(400).json({ error: 'Tiêu đề và template là bắt buộc' });
        }

        const reports = getCollection('reports');
        const now = new Date();

        const newReport = {
            userId,
            title,
            template,
            content: content || '',
            status,
            createdAt: now,
            updatedAt: now
        };

        const result = await reports.insertOne(newReport);

        res.status(201).json({
            id: result.insertedId.toString(),
            title: newReport.title,
            template: newReport.template,
            status: newReport.status,
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
        const { title, content, status } = req.body;

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

        if (title !== undefined) updateData.title = title;
        if (content !== undefined) updateData.content = content;
        if (status !== undefined) updateData.status = status;

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
            status: 'Draft',
            createdAt: now,
            updatedAt: now
        };

        const result = await reports.insertOne(duplicated);

        res.status(201).json({
            id: result.insertedId.toString(),
            title: duplicated.title,
            template: duplicated.template,
            status: duplicated.status,
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

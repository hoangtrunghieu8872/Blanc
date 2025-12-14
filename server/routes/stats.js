import { Router } from 'express';
import { connectToDatabase, getCollection } from '../lib/db.js';

const router = Router();

// Cache stats for 5 minutes to reduce DB load
let statsCache = null;
let statsCacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// GET /api/stats - Lấy thống kê tổng quan
router.get('/', async (req, res, next) => {
    try {
        const now = Date.now();

        // Return cached data if still valid
        if (statsCache && (now - statsCacheTime) < CACHE_DURATION) {
            return res.json(statsCache);
        }

        await connectToDatabase();

        // Count documents in parallel for better performance
        const [usersCount, contestsCount, coursesCount] = await Promise.all([
            getCollection('users').countDocuments(),
            getCollection('contests').countDocuments(),
            getCollection('courses').countDocuments(),
        ]);

        const stats = {
            users: usersCount,
            contests: contestsCount,
            courses: coursesCount,
            // Format cho hiển thị
            formatted: {
                users: formatNumber(usersCount),
                contests: formatNumber(contestsCount),
                courses: formatNumber(coursesCount),
            },
        };

        // Update cache
        statsCache = stats;
        statsCacheTime = now;

        res.json(stats);
    } catch (error) {
        next(error);
    }
});

// GET /api/stats/contests - Thống kê cuộc thi theo status
router.get('/contests', async (req, res, next) => {
    try {
        await connectToDatabase();

        const statusStats = await getCollection('contests').aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]).toArray();

        const byStatus = {};
        statusStats.forEach((item) => {
            byStatus[item._id] = item.count;
        });

        res.json({
            total: Object.values(byStatus).reduce((a, b) => a + b, 0),
            byStatus,
        });
    } catch (error) {
        next(error);
    }
});

function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M+';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K+';
    }
    return num.toString() + '+';
}

export default router;

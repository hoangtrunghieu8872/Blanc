import { Router } from 'express';
import { getDb } from '../lib/db.js';
import { isAvailable as isRedisAvailable } from '../lib/cache.js';

const router = Router();

router.get('/', async (_req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      database: 'unknown',
      redis: 'unknown',
    },
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
    },
  };

  // Check database connectivity
  try {
    const db = getDb();
    await db.command({ ping: 1 });
    health.services.database = 'healthy';
  } catch (err) {
    health.services.database = 'unhealthy';
    health.status = 'degraded';
  }

  // Check Redis availability
  try {
    health.services.redis = isRedisAvailable() ? 'healthy' : 'unavailable';
  } catch (err) {
    health.services.redis = 'error';
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

export default router;

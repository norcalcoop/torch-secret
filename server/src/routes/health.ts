import { Router } from 'express';
import type { Redis } from 'ioredis';
import { pool } from '../db/connection.js';
import { createHealthLimiter } from '../middleware/rate-limit.js';

/**
 * Health check router factory.
 *
 * Returns a configured Router with a rate-limited health check endpoint.
 * Pass the shared Redis client so the limiter uses RedisStore in production
 * rather than per-instance MemoryStore.
 *
 * Returns service status including database connectivity, optional Redis
 * configuration, uptime, and timestamp. Used by Docker HEALTHCHECK,
 * Render.com health monitoring, and E2E test readiness checks.
 */
export function createHealthRouter(redisClient?: Redis): Router {
  const router = Router();

  router.get('/', createHealthLimiter(redisClient), async (_req, res) => {
    const health: {
      status: 'ok' | 'degraded';
      database: 'connected' | 'disconnected';
      redis: 'configured' | 'not configured';
      uptime: number;
      timestamp: string;
    } = {
      status: 'ok',
      database: 'connected',
      redis: redisClient ? 'configured' : 'not configured',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };

    try {
      await pool.query('SELECT 1');
    } catch {
      health.database = 'disconnected';
      health.status = 'degraded';
    }

    const statusCode = health.status === 'ok' ? 200 : 503;
    res.status(statusCode).json(health);
  });

  return router;
}

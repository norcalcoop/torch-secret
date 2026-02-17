import { Router } from 'express';
import { pool } from '../db/connection.js';
import { env } from '../config/env.js';

/**
 * Health check router.
 *
 * Returns service status including database connectivity, optional Redis
 * configuration, uptime, and timestamp. Used by Docker HEALTHCHECK,
 * Render.com health monitoring, and E2E test readiness checks.
 */
export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  const health: {
    status: 'ok' | 'degraded';
    database: 'connected' | 'disconnected';
    redis: 'configured' | 'not configured';
    uptime: number;
    timestamp: string;
  } = {
    status: 'ok',
    database: 'connected',
    redis: env.REDIS_URL ? 'configured' : 'not configured',
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

import { describe, test, expect, afterAll, vi } from 'vitest';
import request from 'supertest';
import type { Redis } from 'ioredis';
import { createHealthRouter } from '../../routes/health.js';
import { buildApp } from '../../app.js';
import { pool } from '../../db/connection.js';

const mockRedis = {
  call: vi.fn().mockImplementation((command: string) => {
    if (command === 'SCRIPT') return Promise.resolve('fakeSha1234567890');
    return Promise.resolve([1, Date.now() + 60_000]); // EVALSHA: [hitCount, resetTime]
  }),
} as unknown as Redis;

afterAll(async () => {
  await pool.end();
});

describe('createHealthRouter factory', () => {
  test('returns a Router when called with no arguments (no throw)', () => {
    const router = createHealthRouter();
    expect(router).toBeDefined();
  });

  test('returns a Router when called with mockRedis (no throw)', () => {
    const router = createHealthRouter(mockRedis);
    expect(router).toBeDefined();
  });
});

describe('GET /api/health', () => {
  test('returns 200 with correct response shape', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/health').expect(200);

    expect(res.body).toMatchObject({
      status: 'ok',
      database: 'connected',
      redis: 'not configured',
      uptime: expect.any(Number),
      timestamp: expect.any(String),
    });
  });

  test('redis field is "configured" when Redis client is injected', async () => {
    const app = buildApp(mockRedis);
    const res = await request(app).get('/api/health').expect(200);

    expect(res.body.redis).toBe('configured');
  });
});

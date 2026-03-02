/**
 * Integration tests for Stripe webhook handler security.
 *
 * Gap 1 (Critical): Stripe webhook signature verification — tampered/unsigned
 * webhook must return 400 and must NOT trigger any DB state change.
 *
 * Critical note: the webhook route uses express.raw() (not express.json()).
 * Supertest must send raw JSON string body with Content-Type: application/json.
 * buildApp() already mounts the route with express.raw() before express.json().
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Plan 04 test bodies use describe/test/expect/request/app
import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest';
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Plan 04 test bodies use request
import request from 'supertest';
import type { Express } from 'express';
import { buildApp } from '../../app.js';
import { db } from '../../db/connection.js';
import { pool } from '../../db/connection.js';
import { users } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Plan 04 test bodies read app
let app: Express;

beforeAll(() => {
  app = buildApp();
});

afterEach(async () => {
  // Clean up any test users created to verify no Pro upgrade occurred
  await db.delete(users).where(eq(users.email, 'webhook-test-user@test.secureshare.dev'));
});

afterAll(async () => {
  await pool.end();
});

// ---------------------------------------------------------------------------
// Gap 1 (Critical): Stripe webhook signature verification
// ---------------------------------------------------------------------------
describe('POST /api/webhooks/stripe — signature verification (Gap 1)', () => {
  test.todo('missing stripe-signature header returns 400');

  test.todo('invalid/tampered stripe-signature returns 400');

  test.todo('tampered checkout.session.completed webhook does NOT upgrade user to Pro');
});

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
import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { buildApp } from '../../app.js';
import { db } from '../../db/connection.js';
import { pool } from '../../db/connection.js';
import { users } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

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
  test('missing stripe-signature header returns 400', async () => {
    const res = await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      // No stripe-signature header
      .send(JSON.stringify({ type: 'checkout.session.completed' }))
      .expect(400);
    expect(res.text).toBeTruthy(); // handler sends plain text error
  });

  test('invalid/tampered stripe-signature returns 400', async () => {
    const res = await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'totally-invalid-signature')
      .send(JSON.stringify({ type: 'checkout.session.completed' }))
      .expect(400);
    expect(res.text).toContain('Webhook Error');
  });

  test('tampered checkout.session.completed webhook does NOT upgrade user to Pro', async () => {
    // Create a test user — their subscriptionTier starts at 'free'
    await request(app)
      .post('/api/auth/sign-up/email')
      .send({
        email: 'webhook-test-user@test.secureshare.dev',
        password: 'Webhook-Pass-99',
        name: 'Webhook Test',
      })
      .expect(200);

    // Send tampered webhook (valid JSON, invalid signature)
    await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'v1=tampered_signature_value')
      .send(
        JSON.stringify({
          type: 'checkout.session.completed',
          data: { object: { mode: 'subscription', customer: 'cus_fake123' } },
        }),
      )
      .expect(400);

    // Verify user is still on free tier (no DB mutation occurred)
    const [user] = await db
      .select({ subscriptionTier: users.subscriptionTier })
      .from(users)
      .where(eq(users.email, 'webhook-test-user@test.secureshare.dev'));
    expect(user?.subscriptionTier).toBe('free');
  });
});

/**
 * Integration tests for Stripe webhook handler security.
 *
 * Gap 1 (Critical): Stripe webhook signature verification — tampered/unsigned
 * webhook must return 400 and must NOT trigger any DB state change.
 *
 * Critical note: the webhook route uses express.raw() (not express.json()).
 * Supertest must send raw JSON string body with Content-Type: application/json.
 * buildApp() already mounts the route with express.raw() before express.json().
 *
 * BILL-01: invoice.payment_failed → sendDunningEmail
 * BILL-02: customer.subscription.updated → activatePro / deactivatePro / neither
 */
import { describe, test, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';

const { mockActivatePro, mockDeactivatePro } = vi.hoisted(() => ({
  mockActivatePro: vi.fn().mockResolvedValue(undefined),
  mockDeactivatePro: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/billing.service.js', () => ({
  activatePro: mockActivatePro,
  deactivatePro: mockDeactivatePro,
}));

const { mockSendDunningEmail } = vi.hoisted(() => ({
  mockSendDunningEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/notification.service.js', () => ({
  sendDunningEmail: mockSendDunningEmail,
}));
import request from 'supertest';
import type { Express } from 'express';
import { buildApp } from '../../app.js';
import { db } from '../../db/connection.js';
import { pool } from '../../db/connection.js';
import { users } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { env } from '../../config/env.js';
import { stripe } from '../../config/stripe.js';

let app: Express;

beforeAll(() => {
  app = buildApp();
});

afterEach(async () => {
  vi.clearAllMocks();
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
    expect(res.body).toEqual({ error: 'Missing stripe-signature header' });
  });

  test('invalid/tampered stripe-signature returns 400', async () => {
    const res = await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'totally-invalid-signature')
      .send(JSON.stringify({ type: 'checkout.session.completed' }))
      .expect(400);
    expect(res.body).toEqual({ error: 'Webhook signature verification failed' });
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

// ---------------------------------------------------------------------------
// TEST-02: Stripe webhook positive-path — valid HMAC signature accepted
// ---------------------------------------------------------------------------
describe('POST /api/webhooks/stripe — valid signature (positive path)', () => {
  test('valid checkout.session.completed webhook returns 200 { received: true }', async () => {
    const payload = JSON.stringify({
      type: 'checkout.session.completed',
      data: {
        object: { mode: 'subscription', customer: 'cus_test_positive_path' },
      },
    });

    const sig = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: env.STRIPE_WEBHOOK_SECRET,
    });

    const res = await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', sig)
      .send(payload)
      .expect(200);

    expect(res.body).toEqual({ received: true });
    expect(mockActivatePro).toHaveBeenCalledOnce();
    expect(mockActivatePro).toHaveBeenCalledWith('cus_test_positive_path');
  });
});

// ---------------------------------------------------------------------------
// BILL-01: invoice.payment_failed → sendDunningEmail
// ---------------------------------------------------------------------------
describe('POST /api/webhooks/stripe — invoice.payment_failed (BILL-01)', () => {
  test('null invoice.customer does NOT call sendDunningEmail (returns 200)', async () => {
    const payload = JSON.stringify({
      type: 'invoice.payment_failed',
      data: {
        object: { customer: null },
      },
    });

    const sig = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: env.STRIPE_WEBHOOK_SECRET,
    });

    const res = await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', sig)
      .send(payload)
      .expect(200);

    expect(res.body).toEqual({ received: true });
    expect(mockSendDunningEmail).not.toHaveBeenCalled();
  });

  test('valid string invoice.customer calls sendDunningEmail with customerId', async () => {
    const payload = JSON.stringify({
      type: 'invoice.payment_failed',
      data: {
        object: { customer: 'cus_dunning_test' },
      },
    });

    const sig = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: env.STRIPE_WEBHOOK_SECRET,
    });

    const res = await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', sig)
      .send(payload)
      .expect(200);

    expect(res.body).toEqual({ received: true });
    expect(mockSendDunningEmail).toHaveBeenCalledOnce();
    expect(mockSendDunningEmail).toHaveBeenCalledWith('cus_dunning_test');
  });
});

// ---------------------------------------------------------------------------
// BILL-02: customer.subscription.updated → activatePro / deactivatePro / neither
// ---------------------------------------------------------------------------
describe('POST /api/webhooks/stripe — customer.subscription.updated (BILL-02)', () => {
  test('status "active" calls activatePro and does NOT call deactivatePro', async () => {
    const payload = JSON.stringify({
      type: 'customer.subscription.updated',
      data: {
        object: { customer: 'cus_sub_updated', status: 'active' },
      },
    });

    const sig = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: env.STRIPE_WEBHOOK_SECRET,
    });

    const res = await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', sig)
      .send(payload)
      .expect(200);

    expect(res.body).toEqual({ received: true });
    expect(mockActivatePro).toHaveBeenCalledOnce();
    expect(mockActivatePro).toHaveBeenCalledWith('cus_sub_updated');
    expect(mockDeactivatePro).not.toHaveBeenCalled();
  });

  test('status "canceled" calls deactivatePro and does NOT call activatePro', async () => {
    const payload = JSON.stringify({
      type: 'customer.subscription.updated',
      data: {
        object: { customer: 'cus_sub_canceled', status: 'canceled' },
      },
    });

    const sig = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: env.STRIPE_WEBHOOK_SECRET,
    });

    const res = await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', sig)
      .send(payload)
      .expect(200);

    expect(res.body).toEqual({ received: true });
    expect(mockDeactivatePro).toHaveBeenCalledOnce();
    expect(mockDeactivatePro).toHaveBeenCalledWith('cus_sub_canceled');
    expect(mockActivatePro).not.toHaveBeenCalled();
  });

  test('status "unpaid" calls deactivatePro and does NOT call activatePro', async () => {
    const payload = JSON.stringify({
      type: 'customer.subscription.updated',
      data: {
        object: { customer: 'cus_sub_unpaid', status: 'unpaid' },
      },
    });

    const sig = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: env.STRIPE_WEBHOOK_SECRET,
    });

    const res = await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', sig)
      .send(payload)
      .expect(200);

    expect(res.body).toEqual({ received: true });
    expect(mockDeactivatePro).toHaveBeenCalledOnce();
    expect(mockDeactivatePro).toHaveBeenCalledWith('cus_sub_unpaid');
    expect(mockActivatePro).not.toHaveBeenCalled();
  });

  test('status "past_due" calls neither activatePro nor deactivatePro (returns 200)', async () => {
    const payload = JSON.stringify({
      type: 'customer.subscription.updated',
      data: {
        object: { customer: 'cus_sub_past_due', status: 'past_due' },
      },
    });

    const sig = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: env.STRIPE_WEBHOOK_SECRET,
    });

    const res = await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', sig)
      .send(payload)
      .expect(200);

    expect(res.body).toEqual({ received: true });
    expect(mockActivatePro).not.toHaveBeenCalled();
    expect(mockDeactivatePro).not.toHaveBeenCalled();
  });
});

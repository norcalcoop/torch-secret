import { describe, test, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { buildApp } from '../../app.js';
import { db } from '../../db/connection.js';
import { pool } from '../../db/connection.js';
import { marketingSubscribers } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Mock Resend to avoid real HTTP calls (same vi.mock pattern as secrets.test.ts)
// vi.mock is hoisted — factory must only use vi.fn() inline, not outer variables
// ---------------------------------------------------------------------------
vi.mock('../../services/email.js', () => ({
  resend: {
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: 'mock-email-id' }, error: null }),
    },
    contacts: {
      create: vi.fn().mockResolvedValue({ data: { id: 'mock-contact-id' }, error: null }),
    },
  },
}));

// ---------------------------------------------------------------------------
// Mock Loops to avoid real HTTP calls
// vi.mock is hoisted — factory must only use vi.fn() inline, not outer variables
// ---------------------------------------------------------------------------
vi.mock('../../config/loops.js', () => ({
  loops: {
    sendEvent: vi.fn().mockResolvedValue({ success: true }),
  },
}));

// Import the mocked modules AFTER vi.mock — vitest replaces with mock implementation
import { resend } from '../../services/email.js';
import { loops } from '../../config/loops.js';

// Typed helpers to access vi.fn() methods without @typescript-eslint/unbound-method
const emailSend = () => vi.mocked(resend.emails.send);
const contactsCreate = () => vi.mocked(resend.contacts.create);
const loopsSendEvent = () => vi.mocked(loops.sendEvent);

let app: Express;
beforeEach(async () => {
  app = buildApp();
  // Clean up between tests
  await db.delete(marketingSubscribers);
  vi.clearAllMocks();
});

afterAll(async () => {
  await pool.end();
});

// ---------------------------------------------------------------------------
// ECAP-01: POST /api/subscribers — valid email + consent returns 200
// ---------------------------------------------------------------------------
describe('POST /api/subscribers', () => {
  test('ECAP-01: valid email + consent=true returns 200 { ok: true }', async () => {
    const res = await request(app)
      .post('/api/subscribers')
      .send({ email: 'test@example.com', consent: true })
      .expect(200);

    expect(res.body).toEqual({ ok: true });
  });

  // ECAP-02: consent checkbox enforcement
  test('ECAP-02: consent=false returns 400', async () => {
    await request(app)
      .post('/api/subscribers')
      .send({ email: 'test@example.com', consent: false })
      .expect(400);
  });

  test('ECAP-02: missing consent field returns 400', async () => {
    await request(app).post('/api/subscribers').send({ email: 'test@example.com' }).expect(400);
  });

  test('ECAP-02: invalid email returns 400', async () => {
    await request(app)
      .post('/api/subscribers')
      .send({ email: 'not-an-email', consent: true })
      .expect(400);
  });

  // ECAP-03: sends confirmation email
  test('ECAP-03: sends confirmation email via Resend', async () => {
    await request(app)
      .post('/api/subscribers')
      .send({ email: 'confirm@example.com', consent: true })
      .expect(200);

    expect(emailSend()).toHaveBeenCalledOnce();
    const callArg = emailSend().mock.calls[0][0] as { to: string; html: string };
    expect(callArg.to).toBe('confirm@example.com');
    // Subject and HTML contain confirmation link
    expect(callArg.html).toContain('/confirm?token=');
  });

  // Edge case: already-confirmed email returns 200 (no state leakage)
  test('already-confirmed email returns 200 without downgrading status', async () => {
    // Insert a confirmed subscriber directly
    await db.insert(marketingSubscribers).values({
      email: 'existing@example.com',
      status: 'confirmed',
      confirmationToken: null,
      tokenExpiresAt: null,
      unsubscribeToken: 'existing-unsub-token',
      consentText: 'I agree',
      ipHash: 'somehash',
    });

    const res = await request(app)
      .post('/api/subscribers')
      .send({ email: 'existing@example.com', consent: true })
      .expect(200);

    expect(res.body).toEqual({ ok: true });

    // Confirmed row must NOT be downgraded to pending
    const [row] = await db
      .select()
      .from(marketingSubscribers)
      .where(eq(marketingSubscribers.email, 'existing@example.com'));
    expect(row.status).toBe('confirmed');

    // No new confirmation email sent (row unchanged)
    expect(emailSend()).not.toHaveBeenCalled();
  });

  // Edge case: pending email resends token
  test('pending email replaces token and resends confirmation', async () => {
    await request(app)
      .post('/api/subscribers')
      .send({ email: 'pending@example.com', consent: true })
      .expect(200);

    vi.clearAllMocks();

    // Re-submit same email (still pending)
    await request(app)
      .post('/api/subscribers')
      .send({ email: 'pending@example.com', consent: true })
      .expect(200);

    // New confirmation email should be sent
    expect(emailSend()).toHaveBeenCalledOnce();
  });

  // QUAL-02: Resend outage does not bubble up as 500
  test('Resend outage does not propagate — POST /api/subscribers still returns 200', async () => {
    // Simulate Resend API being down for this one call
    emailSend().mockRejectedValueOnce(new Error('Resend API down'));

    const res = await request(app)
      .post('/api/subscribers')
      .send({ email: 'resend-error@example.com', consent: true })
      .expect(200);

    expect(res.body).toEqual({ ok: true });
  });
});

// ---------------------------------------------------------------------------
// ECAP-03: GET /api/subscribers/confirm?token= — confirms pending subscriber
// ---------------------------------------------------------------------------
describe('GET /api/subscribers/confirm', () => {
  test('ECAP-03: valid token transitions status to confirmed', async () => {
    // Submit first to create pending subscriber with token
    await request(app)
      .post('/api/subscribers')
      .send({ email: 'toconfirm@example.com', consent: true })
      .expect(200);

    const [row] = await db
      .select()
      .from(marketingSubscribers)
      .where(eq(marketingSubscribers.email, 'toconfirm@example.com'));

    const token = row.confirmationToken!;
    expect(token).toBeDefined();

    const res = await request(app).get(`/api/subscribers/confirm?token=${token}`).expect(200);

    expect(res.body).toEqual({ ok: true });

    // Row now confirmed
    const [updated] = await db
      .select()
      .from(marketingSubscribers)
      .where(eq(marketingSubscribers.email, 'toconfirm@example.com'));
    expect(updated.status).toBe('confirmed');
    expect(updated.confirmationToken).toBeNull();
    // unsubscribeToken generated at confirmation time
    expect(updated.unsubscribeToken).toBeDefined();
    expect(typeof updated.unsubscribeToken).toBe('string');
  });

  test('ECAP-03: adds contact to Resend Audience on confirmation', async () => {
    await request(app)
      .post('/api/subscribers')
      .send({ email: 'audience@example.com', consent: true })
      .expect(200);

    const [row] = await db
      .select()
      .from(marketingSubscribers)
      .where(eq(marketingSubscribers.email, 'audience@example.com'));

    await request(app).get(`/api/subscribers/confirm?token=${row.confirmationToken!}`).expect(200);

    // Resend contacts.create called with unsubscribed: false
    expect(contactsCreate()).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'audience@example.com', unsubscribed: false }),
    );
  });

  test('expired token returns 410', async () => {
    // Insert row with expired token
    await db.insert(marketingSubscribers).values({
      email: 'expired@example.com',
      status: 'pending',
      confirmationToken: 'expiredtoken123456789',
      tokenExpiresAt: new Date(Date.now() - 1000), // already expired
      consentText: 'I agree',
      ipHash: 'somehash',
    });

    await request(app).get('/api/subscribers/confirm?token=expiredtoken123456789').expect(410);
  });

  test('missing token returns 400', async () => {
    await request(app).get('/api/subscribers/confirm').expect(400);
  });

  test('fires loops subscribed event on confirm', async () => {
    // Create a pending subscriber first
    await request(app).post('/api/subscribers').send({ email: 'loops@test.local', consent: true });
    const [row] = await db
      .select()
      .from(marketingSubscribers)
      .where(eq(marketingSubscribers.email, 'loops@test.local'));

    await request(app).get(`/api/subscribers/confirm?token=${row.confirmationToken!}`).expect(200);

    // Fire-and-forget: loops.sendEvent should have been called
    expect(loopsSendEvent()).toHaveBeenCalledOnce();
    expect(loopsSendEvent()).toHaveBeenCalledWith({
      email: 'loops@test.local',
      eventName: 'subscribed',
      contactProperties: { source: 'email-capture' },
    });
  });

  test('loops sendEvent rejection does not propagate — confirm still returns 200', async () => {
    // Make loops.sendEvent reject
    loopsSendEvent().mockRejectedValueOnce(new Error('Loops API down'));

    await request(app)
      .post('/api/subscribers')
      .send({ email: 'loops-err@test.local', consent: true });
    const [row] = await db
      .select()
      .from(marketingSubscribers)
      .where(eq(marketingSubscribers.email, 'loops-err@test.local'));

    // Should still return 200 — fire-and-forget error is swallowed
    await request(app).get(`/api/subscribers/confirm?token=${row.confirmationToken!}`).expect(200);
  });
});

// ---------------------------------------------------------------------------
// ECAP-04: GET /api/subscribers/unsubscribe?token= — idempotent unsubscribe
// ---------------------------------------------------------------------------
describe('GET /api/subscribers/unsubscribe', () => {
  test('ECAP-04: valid unsubscribe token transitions status to unsubscribed', async () => {
    // Create a confirmed subscriber with an unsubscribe token
    await db.insert(marketingSubscribers).values({
      email: 'unsub@example.com',
      status: 'confirmed',
      unsubscribeToken: 'validunsubtoken123456',
      consentText: 'I agree',
      ipHash: 'somehash',
    });

    const res = await request(app)
      .get('/api/subscribers/unsubscribe?token=validunsubtoken123456')
      .expect(200);

    expect(res.body).toEqual({ ok: true });

    const [row] = await db
      .select()
      .from(marketingSubscribers)
      .where(eq(marketingSubscribers.email, 'unsub@example.com'));
    expect(row.status).toBe('unsubscribed');
  });

  test('ECAP-04: invalid/unknown token still returns 200 (idempotent)', async () => {
    const res = await request(app)
      .get('/api/subscribers/unsubscribe?token=unknowntoken000000000')
      .expect(200);

    expect(res.body).toEqual({ ok: true });
  });

  test('ECAP-04: missing token returns 200 (idempotent)', async () => {
    const res = await request(app).get('/api/subscribers/unsubscribe').expect(200);

    expect(res.body).toEqual({ ok: true });
  });

  test('ECAP-04: updates Resend contact to unsubscribed=true', async () => {
    await db.insert(marketingSubscribers).values({
      email: 'resend-unsub@example.com',
      status: 'confirmed',
      unsubscribeToken: 'resendunsubtoken12345',
      consentText: 'I agree',
      ipHash: 'somehash',
    });

    await request(app).get('/api/subscribers/unsubscribe?token=resendunsubtoken12345').expect(200);

    expect(contactsCreate()).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'resend-unsub@example.com', unsubscribed: true }),
    );
  });
});

// ---------------------------------------------------------------------------
// ECAP-05: ip_hash, consent_text, consent_at stored; no plain IP
// ---------------------------------------------------------------------------
describe('ECAP-05: GDPR consent storage', () => {
  test('stores ip_hash as hex string (not plain IP), consent_text snapshot, consent_at', async () => {
    await request(app)
      .post('/api/subscribers')
      .send({ email: 'gdpr@example.com', consent: true })
      .expect(200);

    const [row] = await db
      .select()
      .from(marketingSubscribers)
      .where(eq(marketingSubscribers.email, 'gdpr@example.com'));

    // ip_hash must be a non-empty hex string (SHA-256 produces 64 hex chars)
    expect(row.ipHash).toBeDefined();
    expect(row.ipHash).toMatch(/^[0-9a-f]{64}$/);
    // Must not contain a raw IP address pattern
    expect(row.ipHash).not.toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);

    // consent_text is a snapshot of the consent language
    expect(row.consentText).toBeTruthy();
    expect(row.consentText.length).toBeGreaterThan(20);

    // consent_at is a timestamp
    expect(row.consentAt).toBeInstanceOf(Date);
  });
});

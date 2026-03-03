/**
 * Unit tests for GET /api/billing/verify-checkout (BILL-05).
 *
 * Covers: verify-checkout must call activatePro() when session.status === 'complete'
 * and session.customer is non-null; must NOT call activatePro() in error paths.
 *
 * All external dependencies are mocked via vi.hoisted() to avoid hoisting issues.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../../app.js';

// ---------------------------------------------------------------------------
// Mocks — all defined with vi.hoisted() before any imports execute
// ---------------------------------------------------------------------------

const { mockActivatePro, mockGetOrCreateStripeCustomer } = vi.hoisted(() => ({
  mockActivatePro: vi.fn().mockResolvedValue(undefined),
  mockGetOrCreateStripeCustomer: vi.fn().mockResolvedValue('cus_test123'),
}));

const { mockStripeCheckoutRetrieve } = vi.hoisted(() => ({
  mockStripeCheckoutRetrieve: vi.fn(),
}));

const { mockDbSelect } = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
}));

const { mockAuthGetSession } = vi.hoisted(() => ({
  mockAuthGetSession: vi.fn(),
}));

// Mock billing service
vi.mock('../../services/billing.service.js', () => ({
  activatePro: mockActivatePro,
  getOrCreateStripeCustomer: mockGetOrCreateStripeCustomer,
}));

// Mock Stripe singleton
vi.mock('../../config/stripe.js', () => ({
  stripe: {
    checkout: {
      sessions: {
        retrieve: mockStripeCheckoutRetrieve,
        create: vi.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/test' }),
      },
    },
    billingPortal: {
      sessions: {
        create: vi.fn().mockResolvedValue({ url: 'https://billing.stripe.com/test' }),
      },
    },
  },
}));

// Mock DB — billing route does: db.select().from(users).where(eq(users.id, user.id))
vi.mock('../../db/connection.js', () => ({
  db: { select: mockDbSelect },
  pool: { end: vi.fn() },
}));

// Mock auth — requireAuth middleware calls auth.api.getSession
vi.mock('../../auth.js', () => ({
  auth: {
    api: {
      getSession: mockAuthGetSession,
      signUpEmail: vi.fn(),
      signInEmail: vi.fn(),
      deleteUser: vi.fn(),
    },
    handler: vi.fn(),
  },
}));

// Mock Loops + Resend to prevent real HTTP calls during buildApp()
vi.mock('../../config/loops.js', () => ({
  loops: {
    updateContact: vi.fn().mockResolvedValue({ success: true }),
    sendEvent: vi.fn().mockResolvedValue({ success: true }),
    deleteContact: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('../../services/email.js', () => ({
  resend: {
    emails: { send: vi.fn().mockResolvedValue({ data: { id: 'mock-id' }, error: null }) },
    contacts: { create: vi.fn().mockResolvedValue({ data: { id: 'mock-id' }, error: null }) },
  },
}));

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

/** Authenticated user fixture matching AuthUser shape */
const MOCK_USER = {
  id: 'user_abc123',
  email: 'alice@example.com',
  name: 'Alice',
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  marketingConsent: false,
};

/** DB row returned by db.select().from(users).where() */
const MOCK_DB_USER = {
  id: 'user_abc123',
  email: 'alice@example.com',
  stripeCustomerId: 'cus_test123',
  subscriptionTier: 'free',
};

/** Valid Stripe checkout session — complete, subscription mode */
const MOCK_SESSION_COMPLETE = {
  id: 'cs_test_valid',
  status: 'complete',
  mode: 'subscription',
  customer: 'cus_test123',
};

// ---------------------------------------------------------------------------
// Setup helpers
// ---------------------------------------------------------------------------

/** Configure mocks for the authenticated happy-path scenario */
function setupAuthenticatedUser() {
  mockAuthGetSession.mockResolvedValue({
    user: MOCK_USER,
    session: { id: 'session_xyz', userId: MOCK_USER.id },
  });
  mockDbSelect.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([MOCK_DB_USER]),
    }),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/billing/verify-checkout — activatePro() wiring (BILL-05)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Test 1: Happy path — activatePro() MUST be called
  it('calls activatePro() when session.status === "complete" and session.customer is set', async () => {
    setupAuthenticatedUser();
    mockStripeCheckoutRetrieve.mockResolvedValue(MOCK_SESSION_COMPLETE);

    const app = buildApp();
    const res = await request(app)
      .get('/api/billing/verify-checkout?session_id=cs_test_valid')
      .expect(200);

    expect(res.body).toEqual({ status: 'active', tier: 'pro' });
    expect(mockActivatePro).toHaveBeenCalledOnce();
    expect(mockActivatePro).toHaveBeenCalledWith('cus_test123');
  });

  // Test 2: Incomplete payment — activatePro() must NOT be called
  it('does NOT call activatePro() when session.status !== "complete" (returns 402)', async () => {
    setupAuthenticatedUser();
    mockStripeCheckoutRetrieve.mockResolvedValue({
      ...MOCK_SESSION_COMPLETE,
      status: 'open',
    });

    const app = buildApp();
    const res = await request(app)
      .get('/api/billing/verify-checkout?session_id=cs_test_valid')
      .expect(402);

    expect(res.body).toEqual({ error: 'payment_incomplete' });
    expect(mockActivatePro).not.toHaveBeenCalled();
  });

  // Test 3: Null customer — activatePro() must NOT be called
  it('does NOT call activatePro() when session.customer is null', async () => {
    setupAuthenticatedUser();
    mockStripeCheckoutRetrieve.mockResolvedValue({
      ...MOCK_SESSION_COMPLETE,
      customer: null,
    });

    const app = buildApp();
    const res = await request(app)
      .get('/api/billing/verify-checkout?session_id=cs_test_valid')
      .expect(200);

    // Should still return success (status === 'complete'), just without activating Pro
    expect(res.body).toEqual({ status: 'active', tier: 'pro' });
    expect(mockActivatePro).not.toHaveBeenCalled();
  });

  // Test 4: Customer mismatch — activatePro() must NOT be called
  it('does NOT call activatePro() when session.customer mismatches dbUser.stripeCustomerId (returns 403)', async () => {
    setupAuthenticatedUser();
    mockStripeCheckoutRetrieve.mockResolvedValue({
      ...MOCK_SESSION_COMPLETE,
      customer: 'cus_DIFFERENT_CUSTOMER',
    });

    const app = buildApp();
    const res = await request(app)
      .get('/api/billing/verify-checkout?session_id=cs_test_valid')
      .expect(403);

    expect(res.body).toEqual({ error: 'session_mismatch' });
    expect(mockActivatePro).not.toHaveBeenCalled();
  });
});

/**
 * Tests for notification.service.ts
 *
 * Gap 5 (SR-012, I4): Automated ZK invariant check — verify no nanoid-pattern
 * secret ID appears in outgoing email body or subject.
 *
 * CONCERNS.md: console.error → logger.error replacement verification.
 *
 * BILL-01: sendDunningEmail ZK invariant + structured logging + unknown customer skip.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

const { mockLoggerError, mockLoggerWarn } = vi.hoisted(() => ({
  mockLoggerError: vi.fn(),
  mockLoggerWarn: vi.fn(),
}));

vi.mock('../../middleware/logger.js', () => ({
  logger: { error: mockLoggerError, warn: mockLoggerWarn },
}));

// Mock the email transport BEFORE importing the service under test
vi.mock('../email.js', () => ({
  resend: {
    emails: { send: vi.fn().mockResolvedValue({ error: null }) },
  },
}));

// Mock the DB — sendDunningEmail looks up a user by stripeCustomerId
const { mockDbSelect } = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
}));

vi.mock('../../db/connection.js', () => ({
  db: { select: mockDbSelect },
  pool: { end: vi.fn() },
}));

// Mock env — sendDunningEmail uses APP_URL for the dashboard link
vi.mock('../../config/env.js', () => ({
  env: {
    RESEND_FROM_EMAIL: 'noreply@torchsecret.com',
    APP_URL: 'https://torchsecret.com',
    NODE_ENV: 'test',
  },
}));

import { resend } from '../email.js';
import { sendSecretViewedNotification, sendDunningEmail } from '../notification.service.js';

/** Pro user row returned by the DB tier-check inside sendSecretViewedNotification */
const PRO_USER_ROW = { subscriptionTier: 'pro' as const };
const FREE_USER_ROW = { subscriptionTier: 'free' as const };

/** Helper: wire mockDbSelect to return a Pro tier row (sendSecretViewedNotification path) */
function setupProTierMock() {
  mockDbSelect.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([PRO_USER_ROW]),
      }),
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: Pro tier so ZK + logging tests can reach the resend.emails.send call
  setupProTierMock();
});

// ---------------------------------------------------------------------------
// Gap 5 / SR-012: ZK invariant — no secretId in notification email
// ---------------------------------------------------------------------------
describe('sendSecretViewedNotification — ZK invariant', () => {
  test('email subject does not contain a nanoid-pattern secret ID', async () => {
    await sendSecretViewedNotification(
      'user@example.com',
      new Date('2026-01-01T00:00:00Z'),
      'user-id-1',
    );
    const call = vi.mocked(resend.emails.send).mock.calls[0]?.[0];
    expect(call).toBeDefined();
    // nanoid default: 21 chars from [A-Za-z0-9_-]
    const nanoidPattern = /[A-Za-z0-9_-]{21}/;
    expect(call.subject).not.toMatch(nanoidPattern);
  });

  test('email body does not contain a nanoid-pattern secret ID', async () => {
    await sendSecretViewedNotification(
      'user@example.com',
      new Date('2026-01-01T00:00:00Z'),
      'user-id-1',
    );
    const call = vi.mocked(resend.emails.send).mock.calls[0]?.[0];
    expect(call).toBeDefined();
    const nanoidPattern = /[A-Za-z0-9_-]{21}/;
    expect(call.text).not.toMatch(nanoidPattern);
  });

  test('Resend send payload does not contain a secretId field', async () => {
    await sendSecretViewedNotification(
      'user@example.com',
      new Date('2026-01-01T00:00:00Z'),
      'user-id-1',
    );
    const call = vi.mocked(resend.emails.send).mock.calls[0]?.[0];
    expect(call).toBeDefined();
    expect(JSON.stringify(call)).not.toContain('secretId');
  });
});

// ---------------------------------------------------------------------------
// CONCERNS.md: console.error replacement — verified by Plan 05 implementation
// ---------------------------------------------------------------------------
describe('sendSecretViewedNotification — structured logging on error', () => {
  test('logs via logger.error (not console.error) when Resend send fails', async () => {
    vi.mocked(resend.emails.send).mockResolvedValueOnce({
      error: { message: 'Resend outage' },
    } as never);

    await sendSecretViewedNotification('user@example.com', new Date(), 'user-id-1');

    expect(mockLoggerError).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// C-2: Retroactive Pro gate — silently skips email for free-tier creators
// ---------------------------------------------------------------------------
describe('sendSecretViewedNotification — Pro tier gate', () => {
  test('does not send email when user is free tier', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([FREE_USER_ROW]),
        }),
      }),
    });

    await sendSecretViewedNotification('user@example.com', new Date(), 'user-id-free');

    expect(resend.emails.send).not.toHaveBeenCalled();
  });

  test('does not send email when user row is not found', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    await sendSecretViewedNotification('user@example.com', new Date(), 'user-id-missing');

    expect(resend.emails.send).not.toHaveBeenCalled();
  });

  test('sends email when user is Pro tier', async () => {
    await sendSecretViewedNotification('user@example.com', new Date(), 'user-id-pro');

    expect(resend.emails.send).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// BILL-01: sendDunningEmail — ZK invariant (no secretId in email body or subject)
// ---------------------------------------------------------------------------
describe('sendDunningEmail — ZK invariant', () => {
  const MOCK_USER_ROW = {
    email: 'alice@example.com',
    name: 'Alice',
  };

  beforeEach(() => {
    // db.select() returns a user row matching the stripeCustomerId
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([MOCK_USER_ROW]),
      }),
    });
  });

  test('email subject does not contain a nanoid-pattern secret ID', async () => {
    await sendDunningEmail('cus_dunning_test');
    const call = vi.mocked(resend.emails.send).mock.calls[0]?.[0];
    expect(call).toBeDefined();
    const nanoidPattern = /[A-Za-z0-9_-]{21}/;
    expect(call.subject).not.toMatch(nanoidPattern);
  });

  test('email body (text) does not contain a nanoid-pattern secret ID', async () => {
    await sendDunningEmail('cus_dunning_test');
    const call = vi.mocked(resend.emails.send).mock.calls[0]?.[0];
    expect(call).toBeDefined();
    const nanoidPattern = /[A-Za-z0-9_-]{21}/;
    expect(call.text).not.toMatch(nanoidPattern);
  });

  test('Resend send payload does not contain a secretId field', async () => {
    await sendDunningEmail('cus_dunning_test');
    const call = vi.mocked(resend.emails.send).mock.calls[0]?.[0];
    expect(call).toBeDefined();
    expect(JSON.stringify(call)).not.toContain('secretId');
  });
});

// ---------------------------------------------------------------------------
// BILL-01: sendDunningEmail — structured logging on send error
// ---------------------------------------------------------------------------
describe('sendDunningEmail — structured logging on error', () => {
  beforeEach(() => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ email: 'alice@example.com', name: 'Alice' }]),
      }),
    });
  });

  test('logs via logger.error (not console.error) when Resend send returns an error object', async () => {
    vi.mocked(resend.emails.send).mockResolvedValueOnce({
      error: { message: 'Resend outage' },
    } as never);

    await sendDunningEmail('cus_dunning_error');

    expect(mockLoggerError).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// BILL-01: sendDunningEmail — unknown customer skip
// ---------------------------------------------------------------------------
describe('sendDunningEmail — unknown customer skip', () => {
  test('logs via logger.warn when db returns empty array (no user for stripeCustomerId)', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });

    await sendDunningEmail('cus_unknown_customer');

    expect(mockLoggerWarn).toHaveBeenCalledOnce();
    // Must NOT send an email when the customer has no matching user
    expect(resend.emails.send).not.toHaveBeenCalled();
  });
});

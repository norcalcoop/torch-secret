/**
 * Tests for notification.service.ts
 *
 * Gap 5 (SR-012, I4): Automated ZK invariant check — verify no nanoid-pattern
 * secret ID appears in outgoing email body or subject.
 *
 * CONCERNS.md: console.error → logger.error replacement verification.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

const { mockLoggerError } = vi.hoisted(() => ({
  mockLoggerError: vi.fn(),
}));

vi.mock('../../middleware/logger.js', () => ({
  logger: { error: mockLoggerError },
}));

// Mock the email transport BEFORE importing the service under test
vi.mock('../email.js', () => ({
  resend: {
    emails: { send: vi.fn().mockResolvedValue({ error: null }) },
  },
}));

import { resend } from '../email.js';
import { sendSecretViewedNotification } from '../notification.service.js';

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Gap 5 / SR-012: ZK invariant — no secretId in notification email
// ---------------------------------------------------------------------------
describe('sendSecretViewedNotification — ZK invariant', () => {
  test('email subject does not contain a nanoid-pattern secret ID', async () => {
    await sendSecretViewedNotification('user@example.com', new Date('2026-01-01T00:00:00Z'));
    const call = vi.mocked(resend.emails.send).mock.calls[0]?.[0];
    expect(call).toBeDefined();
    // nanoid default: 21 chars from [A-Za-z0-9_-]
    const nanoidPattern = /[A-Za-z0-9_-]{21}/;
    expect(call.subject).not.toMatch(nanoidPattern);
  });

  test('email body does not contain a nanoid-pattern secret ID', async () => {
    await sendSecretViewedNotification('user@example.com', new Date('2026-01-01T00:00:00Z'));
    const call = vi.mocked(resend.emails.send).mock.calls[0]?.[0];
    expect(call).toBeDefined();
    const nanoidPattern = /[A-Za-z0-9_-]{21}/;
    expect(call.text).not.toMatch(nanoidPattern);
  });

  test('Resend send payload does not contain a secretId field', async () => {
    await sendSecretViewedNotification('user@example.com', new Date('2026-01-01T00:00:00Z'));
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

    await sendSecretViewedNotification('user@example.com', new Date());

    expect(mockLoggerError).toHaveBeenCalledOnce();
  });
});

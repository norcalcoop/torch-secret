import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to create the mock function before vi.mock hoisting.
// vi.mock factory is hoisted to the top of the file by Vitest, so any variables
// used inside the factory must also be hoisted.
const { mockSend, mockDbSelect } = vi.hoisted(() => ({
  mockSend: vi.fn().mockResolvedValue({ data: { id: 'test-email-id' }, error: null }),
  mockDbSelect: vi.fn(),
}));

// Mock the email singleton before importing notification.service.
// Path is relative to this test file (same directory as email.ts).
vi.mock('./email.js', () => ({
  resend: {
    emails: {
      send: mockSend,
    },
  },
}));

// Mock the DB — sendSecretViewedNotification looks up subscriptionTier by userId (C-2 Pro gate)
vi.mock('../db/connection.js', () => ({
  db: { select: mockDbSelect },
  pool: { end: vi.fn() },
}));

// Import after mock is set up
import { sendSecretViewedNotification } from './notification.service.js';

/** Pro user row returned by the Pro tier check */
const PRO_USER_ROW = { subscriptionTier: 'pro' as const };

function setupProTierMock() {
  mockDbSelect.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([PRO_USER_ROW]),
      }),
    }),
  });
}

describe('sendSecretViewedNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-set the default mock implementations after clearAllMocks
    mockSend.mockResolvedValue({ data: { id: 'test-email-id' }, error: null });
    // Default: Pro user so tests that check email sending can reach resend.emails.send
    setupProTierMock();
  });

  it('calls resend.emails.send with correct recipient and subject', async () => {
    const viewedAt = new Date('2026-02-21T12:00:00Z');
    await sendSecretViewedNotification('user@example.com', viewedAt, 'user-id-pro');

    expect(mockSend).toHaveBeenCalledOnce();
    const callArgs = mockSend.mock.calls[0][0] as {
      to: string;
      subject: string;
      text: string;
      from: string;
    };
    expect(callArgs.to).toBe('user@example.com');
    expect(callArgs.subject).toBe('Someone viewed your secret');
  });

  it('email body contains the viewedAt timestamp', async () => {
    const viewedAt = new Date('2026-02-21T12:00:00Z');
    await sendSecretViewedNotification('user@example.com', viewedAt, 'user-id-pro');

    const callArgs = mockSend.mock.calls[0][0] as { text: string };
    expect(callArgs.text).toContain(viewedAt.toUTCString());
  });

  it('email body does not contain secretId placeholder or label', async () => {
    // ZERO-KNOWLEDGE INVARIANT: email body must not include secretId or label
    const viewedAt = new Date('2026-02-21T12:00:00Z');
    await sendSecretViewedNotification('user@example.com', viewedAt, 'user-id-pro');

    const callArgs = mockSend.mock.calls[0][0] as { text: string };
    // The body must only contain the timestamp and generic message
    expect(callArgs.text).toContain('was viewed and permanently deleted');
    // Confirm no pattern that looks like a nanoid (21 alphanumeric chars) is present.
    // This is a structural check: the body is a fixed template with no interpolated IDs.
    expect(callArgs.text).not.toMatch(/[A-Za-z0-9_-]{21}/); // no nanoid-shaped string
  });

  it('does not throw when resend returns an error (best-effort)', async () => {
    mockSend.mockResolvedValueOnce({
      data: null,
      error: { name: 'resend_error', message: 'Delivery failed', statusCode: 500 },
    });

    // Should not throw — fire-and-forget, best-effort delivery
    await expect(
      sendSecretViewedNotification('user@example.com', new Date(), 'user-id-pro'),
    ).resolves.not.toThrow();
  });

  it('does not send email when user is free tier (C-2 retroactive gate)', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ subscriptionTier: 'free' }]),
        }),
      }),
    });

    await sendSecretViewedNotification('user@example.com', new Date(), 'user-id-free');

    expect(mockSend).not.toHaveBeenCalled();
  });
});

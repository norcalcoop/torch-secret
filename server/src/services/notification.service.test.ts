import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to create the mock function before vi.mock hoisting.
// vi.mock factory is hoisted to the top of the file by Vitest, so any variables
// used inside the factory must also be hoisted.
const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn().mockResolvedValue({ data: { id: 'test-email-id' }, error: null }),
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

// Import after mock is set up
import { sendSecretViewedNotification } from './notification.service.js';

describe('sendSecretViewedNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-set the default mock implementation after clearAllMocks
    mockSend.mockResolvedValue({ data: { id: 'test-email-id' }, error: null });
  });

  it('calls resend.emails.send with correct recipient and subject', async () => {
    const viewedAt = new Date('2026-02-21T12:00:00Z');
    await sendSecretViewedNotification('user@example.com', viewedAt);

    expect(mockSend).toHaveBeenCalledOnce();
    const callArgs = mockSend.mock.calls[0][0] as {
      to: string;
      subject: string;
      text: string;
      from: string;
    };
    expect(callArgs.to).toBe('user@example.com');
    expect(callArgs.subject).toBe('Your SecureShare secret was viewed');
  });

  it('email body contains the viewedAt timestamp', async () => {
    const viewedAt = new Date('2026-02-21T12:00:00Z');
    await sendSecretViewedNotification('user@example.com', viewedAt);

    const callArgs = mockSend.mock.calls[0][0] as { text: string };
    expect(callArgs.text).toContain(viewedAt.toUTCString());
  });

  it('email body does not contain secretId placeholder or label', async () => {
    // ZERO-KNOWLEDGE INVARIANT: email body must not include secretId or label
    const viewedAt = new Date('2026-02-21T12:00:00Z');
    await sendSecretViewedNotification('user@example.com', viewedAt);

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
      sendSecretViewedNotification('user@example.com', new Date()),
    ).resolves.not.toThrow();
  });
});

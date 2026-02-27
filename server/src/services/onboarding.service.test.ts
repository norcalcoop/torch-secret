import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSendEvent } = vi.hoisted(() => ({
  mockSendEvent: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('../config/loops.js', () => ({
  loops: { sendEvent: mockSendEvent },
}));

import { enrollInOnboardingSequence } from './onboarding.service.js';

describe('enrollInOnboardingSequence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendEvent.mockResolvedValue({ success: true });
  });

  it('calls loops.sendEvent with eventName "registered"', async () => {
    await enrollInOnboardingSequence({
      email: 'alice@example.com',
      name: 'Alice Smith',
      marketingConsent: true,
      subscriptionTier: 'free',
    });
    expect(mockSendEvent).toHaveBeenCalledOnce();
    const args = mockSendEvent.mock.calls[0][0] as { eventName: string };
    expect(args.eventName).toBe('registered');
  });

  it('passes email as contact identifier', async () => {
    await enrollInOnboardingSequence({
      email: 'alice@example.com',
      name: 'Alice Smith',
      marketingConsent: false,
      subscriptionTier: 'free',
    });
    const args = mockSendEvent.mock.calls[0][0] as { email: string };
    expect(args.email).toBe('alice@example.com');
  });

  it('passes marketingConsent: true in contactProperties when opted in', async () => {
    await enrollInOnboardingSequence({
      email: 'alice@example.com',
      name: 'Alice Smith',
      marketingConsent: true,
      subscriptionTier: 'free',
    });
    const args = mockSendEvent.mock.calls[0][0] as {
      contactProperties: { marketingConsent: boolean };
    };
    expect(args.contactProperties.marketingConsent).toBe(true);
  });

  it('passes marketingConsent: false in contactProperties when not opted in', async () => {
    await enrollInOnboardingSequence({
      email: 'alice@example.com',
      name: 'Alice Smith',
      marketingConsent: false,
      subscriptionTier: 'free',
    });
    const args = mockSendEvent.mock.calls[0][0] as {
      contactProperties: { marketingConsent: boolean };
    };
    expect(args.contactProperties.marketingConsent).toBe(false);
  });

  it('passes firstName derived from name in contactProperties', async () => {
    await enrollInOnboardingSequence({
      email: 'alice@example.com',
      name: 'Alice Smith',
      marketingConsent: false,
      subscriptionTier: 'free',
    });
    const args = mockSendEvent.mock.calls[0][0] as {
      contactProperties: { firstName: string };
    };
    expect(args.contactProperties.firstName).toBe('Alice');
  });

  it('fires even when marketingConsent is false (welcome email is unconditional — ESEQ-01)', async () => {
    await enrollInOnboardingSequence({
      email: 'nonconsent@example.com',
      name: 'Bob',
      marketingConsent: false,
      subscriptionTier: 'free',
    });
    expect(mockSendEvent).toHaveBeenCalledOnce();
  });
});

import { loops } from '../config/loops.js';

export interface OnboardingUser {
  email: string;
  name: string;
  marketingConsent: boolean;
  subscriptionTier: 'free' | 'pro';
}

/**
 * Enroll a newly registered user in the Loops onboarding sequence.
 *
 * Fires the "registered" event which triggers the Loops loop:
 *   - Welcome email: sends immediately (no consent required)
 *   - Day-3 key features email: requires marketingConsent === true
 *   - Day-7 upgrade prompt: requires marketingConsent === true AND subscriptionTier !== 'pro'
 *
 * Uses sendEvent() which creates/updates the contact atomically — no separate createContact call needed.
 *
 * ZERO-KNOWLEDGE: only email and non-identifying properties passed to Loops.
 * No userId, no secretId. See .planning/INVARIANTS.md.
 */
export async function enrollInOnboardingSequence(user: OnboardingUser): Promise<void> {
  const firstName = user.name.split(' ')[0] ?? user.name;

  await loops.sendEvent({
    email: user.email,
    eventName: 'registered',
    contactProperties: {
      firstName,
      marketingConsent: user.marketingConsent,
      subscriptionTier: user.subscriptionTier,
    },
  });
}

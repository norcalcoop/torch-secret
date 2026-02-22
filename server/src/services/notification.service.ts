import { resend } from './email.js';
import { env } from '../config/env.js';

/**
 * Sends a "secret viewed" notification email fire-and-forget.
 * Called with void from secrets.service.ts after the atomic destroy transaction resolves.
 *
 * ZERO-KNOWLEDGE INVARIANT:
 * - userEmail is the only identifier passed into this function.
 * - The email body contains ONLY a timestamp and a generic message.
 * - No secretId, no label, no ciphertext, no IP address may appear in the body.
 * - Resend delivery records log recipient email + subject — neither contains a secretId.
 *
 * Failure is silently swallowed (best-effort delivery, fire-and-forget pattern).
 * Do NOT log userEmail or any secret identifier in the error branch.
 */
export async function sendSecretViewedNotification(
  userEmail: string,
  viewedAt: Date,
): Promise<void> {
  const { error } = await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: userEmail,
    subject: 'Your Torch Secret secret was viewed',
    text: [
      'A secret you created on Torch Secret was viewed and permanently deleted.',
      '',
      `Viewed at: ${viewedAt.toUTCString()}`,
      '',
      'No further action is needed. The encrypted data has been destroyed and cannot be recovered.',
    ].join('\n'),
  });

  if (error) {
    // Log failure without any identifying fields (no userEmail, no secretId)
    console.error('Failed to send secret-viewed notification:', error.message);
  }
}

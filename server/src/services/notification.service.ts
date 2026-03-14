import { resend } from './email.js';
import { env } from '../config/env.js';
import { logger } from '../middleware/logger.js';
import { db } from '../db/connection.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

/**
 * Sends a "secret viewed" notification email fire-and-forget.
 * Called with void from secrets.service.ts after the atomic destroy transaction resolves.
 *
 * ZERO-KNOWLEDGE INVARIANT (covers sendSecretViewedNotification + sendDunningEmail):
 * - sendSecretViewedNotification: userEmail + userId are the only identifiers passed in.
 *   userId is used ONLY for a Pro tier lookup — it is never stored or logged alongside any secretId.
 *   The email body contains ONLY a timestamp and a generic message.
 *   No secretId, no label, no ciphertext, no IP address may appear in the body.
 *   Resend delivery records log recipient email + subject — neither contains a secretId.
 * - sendDunningEmail: stripeCustomerId is the only identifier; no userId in scope.
 *   The user email is resolved via DB lookup and used only as the recipient address.
 *   No userId, no secretId, no invoice ID appears in any log line or email body.
 *
 * Failure is silently swallowed (best-effort delivery, fire-and-forget pattern).
 * Do NOT log userEmail or any secret identifier in the error branch.
 */
export async function sendSecretViewedNotification(
  userEmail: string,
  viewedAt: Date,
  userId: string,
): Promise<void> {
  // Retroactive gate: only send if the creator is still Pro at the time of viewing.
  // A user may have downgraded since the secret was created — silently skip, no log.
  const [userRow] = await db
    .select({ subscriptionTier: users.subscriptionTier })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (userRow?.subscriptionTier !== 'pro') {
    return;
  }

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
    logger.error({ err: error.message }, 'notification_send_failed');
  }
}

/**
 * Sends a dunning email to a subscriber when Stripe reports a failed payment.
 * Called fire-and-forget from the invoice.payment_failed webhook case.
 *
 * ZERO-KNOWLEDGE INVARIANT:
 * - stripeCustomerId is the only lookup key — no userId in scope.
 * - The user email is resolved via DB lookup and used only as the recipient address.
 * - No userId, no secretId, no invoice ID appears in any log line or email body.
 */
export async function sendDunningEmail(stripeCustomerId: string): Promise<void> {
  const [user] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.stripeCustomerId, stripeCustomerId));

  if (!user) {
    logger.warn({ reason: 'unknown_stripe_customer' }, 'dunning_email_skipped');
    return;
  }

  const { error } = await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: user.email,
    subject: 'Action needed: update your payment method',
    text: [
      'We were unable to collect payment for your Torch Secret Pro subscription.',
      '',
      'Your Pro access will remain active while we retry, but will be cancelled if payment cannot be collected.',
      '',
      `To update your payment method, visit your dashboard:`,
      `${env.APP_URL}/dashboard`,
      '',
      '— Torch Secret',
    ].join('\n'),
  });

  if (error) {
    // Log failure without any identifying fields (no userEmail, no secretId)
    logger.error({ err: error.message }, 'dunning_email_send_failed');
  }
}

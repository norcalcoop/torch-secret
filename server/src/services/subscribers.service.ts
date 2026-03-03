/**
 * Marketing subscriber service — GDPR double opt-in email capture.
 *
 * ZERO-KNOWLEDGE INVARIANT (Phase 36):
 * - This service MUST NOT receive or store a userId or secretId.
 * - marketing_subscribers is a standalone GDPR record with no FK to users or secrets tables.
 * - ip_hash is SHA-256(IP_HASH_SALT + req.ip) — never plain IP.
 */

import { createHash } from 'node:crypto';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { marketingSubscribers } from '../db/schema.js';
import { resend } from './email.js';
import { loops } from '../config/loops.js';
import { env } from '../config/env.js';
import { logger } from '../middleware/logger.js';

/**
 * The exact consent text snapshot stored with each subscriber record.
 * If this copy changes in the UI, update this constant AND deploy — so
 * new DB records reflect what users actually consented to.
 */
export const CONSENT_TEXT =
  'I agree to receive product updates and marketing emails from Torch Secret. ' +
  'You can unsubscribe at any time. See our Privacy Policy.';

/**
 * SHA-256(IP_HASH_SALT + ip) — pseudonymous IP for GDPR consent record.
 * Salt prevents rainbow-table reversal of the small IPv4 space.
 * Returns 64-char lowercase hex string.
 */
export function hashIp(ip: string): string {
  return createHash('sha256')
    .update(env.IP_HASH_SALT + ip)
    .digest('hex');
}

/**
 * HTML email template for double opt-in confirmation.
 * Uses inline styles (email client compatibility).
 * Brand colors from Torch Secret design system (#f97316 accent, #0f172a bg).
 * Subject line optimized for clarity and deliverability.
 */
function buildConfirmationEmail(token: string): string {
  const confirmUrl = `${env.APP_URL}/confirm?token=${encodeURIComponent(token)}`;
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Confirm your Torch Secret subscription</title></head>
<body style="font-family:system-ui,-apple-system,sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:32px 16px">
  <div style="max-width:480px;margin:0 auto;background:#1e293b;border-radius:12px;padding:32px;border:1px solid #334155">
    <p style="font-size:22px;font-weight:700;margin:0 0 4px;color:#f1f5f9;letter-spacing:-0.3px">Torch Secret</p>
    <p style="color:#94a3b8;margin:0 0 24px;font-size:13px;text-transform:uppercase;letter-spacing:0.5px">Confirm your subscription</p>
    <p style="margin:0 0 16px;color:#e2e8f0;font-size:15px;line-height:1.6">One click to confirm your email and join the Torch Secret list. This link expires in 24 hours.</p>
    <a href="${confirmUrl}" style="display:inline-block;padding:12px 28px;background:#f97316;color:#ffffff;border-radius:8px;font-weight:600;font-size:15px;text-decoration:none;letter-spacing:0.1px">Confirm my email</a>
    <hr style="border:none;border-top:1px solid #334155;margin:28px 0">
    <p style="margin:0;font-size:12px;color:#64748b;line-height:1.5">If you did not sign up for Torch Secret, you can safely ignore this email.</p>
  </div>
</body>
</html>`;
}

/**
 * Create or refresh a pending subscriber.
 *
 * Three cases handled with one upsert:
 *   1. Fresh email: INSERT new pending row, send confirmation email.
 *   2. Pending email (token not yet clicked): replace token, resend confirmation email.
 *   3. Already-confirmed email: onConflictDoUpdate WHERE clause prevents overwrite — no email sent.
 *
 * Always returns without indicating which case occurred (no state leakage).
 */
export async function createSubscriber(email: string, ip: string): Promise<void> {
  const token = nanoid();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
  const ipHash = hashIp(ip);

  // Upsert: only update pending rows (confirmed rows are untouched by the WHERE clause)
  await db
    .insert(marketingSubscribers)
    .values({
      email,
      status: 'pending',
      confirmationToken: token,
      tokenExpiresAt: expiresAt,
      consentText: CONSENT_TEXT,
      consentAt: new Date(),
      ipHash,
    })
    .onConflictDoUpdate({
      target: marketingSubscribers.email,
      set: {
        status: 'pending',
        confirmationToken: token,
        tokenExpiresAt: expiresAt,
        consentAt: new Date(),
        ipHash,
      },
      // CRITICAL: only update pending rows — do NOT downgrade confirmed subscribers
      where: eq(marketingSubscribers.status, 'pending'),
    });

  // Check if token was actually set (i.e., the row is pending, not already confirmed)
  const [row] = await db
    .select({ confirmationToken: marketingSubscribers.confirmationToken })
    .from(marketingSubscribers)
    .where(eq(marketingSubscribers.email, email));

  // Only send confirmation email if we actually set the token (pending path)
  if (row?.confirmationToken === token) {
    await resend.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: email,
      subject: 'Confirm your Torch Secret subscription',
      html: buildConfirmationEmail(token),
    });
  }
}

/**
 * Confirm a subscriber via their confirmation token.
 *
 * Returns 'confirmed' on success, 'expired' if token is not found or past expiry.
 * On success: clears confirmation token, generates a permanent unsubscribe token,
 * transitions status to 'confirmed', and fire-and-forgets Resend Audience add.
 */
export async function confirmSubscriber(token: string): Promise<'confirmed' | 'expired'> {
  const [subscriber] = await db
    .select()
    .from(marketingSubscribers)
    .where(eq(marketingSubscribers.confirmationToken, token));

  if (!subscriber) return 'expired';
  if (subscriber.tokenExpiresAt && subscriber.tokenExpiresAt < new Date()) return 'expired';

  // Already confirmed (idempotent) — token matches but status is confirmed
  // This path should not normally occur (token is cleared on confirmation)
  // but handle it gracefully.
  if (subscriber.status === 'confirmed') return 'confirmed';

  const unsubscribeToken = nanoid(); // Permanent unsubscribe token

  await db
    .update(marketingSubscribers)
    .set({
      status: 'confirmed',
      confirmationToken: null,
      tokenExpiresAt: null,
      unsubscribeToken,
    })
    .where(eq(marketingSubscribers.confirmationToken, token));

  // Fire-and-forget Resend Audience sync (Resend is best-effort; local DB is source of truth)
  void resend.contacts
    .create({
      email: subscriber.email,
      unsubscribed: false,
      audienceId: env.RESEND_AUDIENCE_ID,
    })
    .catch((err: unknown) => {
      logger.error(
        { err: err instanceof Error ? err.message : String(err) },
        'resend_contacts_create_failed_on_confirm',
      );
    });

  // Fire-and-forget Loops subscribed event (alongside existing Resend Audience sync)
  // ZERO-KNOWLEDGE SAFE: only email + source property are sent — no userId, no secretId.
  void loops
    .sendEvent({
      email: subscriber.email,
      eventName: 'subscribed',
      contactProperties: { source: 'email-capture' },
    })
    .catch((err: unknown) => {
      logger.error(
        { err: err instanceof Error ? err.message : String(err) },
        'loops_subscribed_event_failed_on_confirm',
      );
    });

  return 'confirmed';
}

/**
 * Unsubscribe a subscriber via their permanent unsubscribe token.
 *
 * Idempotent — if token is unknown or subscriber already unsubscribed, silently succeeds.
 * Per CONTEXT.md: invalid token shows the same success page (no state leakage).
 */
export async function unsubscribeByToken(token: string): Promise<void> {
  const [subscriber] = await db
    .select()
    .from(marketingSubscribers)
    .where(eq(marketingSubscribers.unsubscribeToken, token));

  if (!subscriber) return; // Unknown token — idempotent success

  await db
    .update(marketingSubscribers)
    .set({ status: 'unsubscribed' })
    .where(eq(marketingSubscribers.unsubscribeToken, token));

  // Fire-and-forget Resend Audience sync
  void resend.contacts
    .create({
      email: subscriber.email,
      unsubscribed: true,
      audienceId: env.RESEND_AUDIENCE_ID,
    })
    .catch((err: unknown) => {
      logger.error(
        { err: err instanceof Error ? err.message : String(err) },
        'resend_contacts_create_failed_on_unsubscribe',
      );
    });
}

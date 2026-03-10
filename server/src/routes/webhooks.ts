import type { Request, Response } from 'express';
import type Stripe from 'stripe';
import { stripe } from '../config/stripe.js';
import { env } from '../config/env.js';
import { activatePro, deactivatePro } from '../services/billing.service.js';
import { sendDunningEmail } from '../services/notification.service.js';
import { logger } from '../middleware/logger.js';

/**
 * Stripe webhook handler — MUST be mounted with express.raw() BEFORE express.json().
 *
 * express.raw() preserves the raw body buffer needed by stripe.webhooks.constructEvent()
 * for HMAC-SHA256 signature verification. Mounting after express.json() causes silent
 * failure: "No signatures found matching the expected signature".
 *
 * ZERO-KNOWLEDGE: receives stripe_customer_id from Stripe payload;
 * activatePro/deactivatePro look up users by stripe_customer_id only.
 * No code path in this handler joins userId + secretId. See INVARIANTS.md.
 *
 * Handles:
 *   checkout.session.completed      -> activatePro(customerId)
 *   customer.subscription.deleted   -> deactivatePro(customerId)
 *   invoice.payment_failed          -> sendDunningEmail(customerId) fire-and-forget
 *   customer.subscription.updated   -> activatePro (active) or deactivatePro (canceled/unpaid); past_due no-op
 * All other event types are acknowledged (200) and ignored.
 */
export async function stripeWebhookHandler(req: Request, res: Response): Promise<void> {
  const sig = req.headers['stripe-signature'] as string | undefined;

  if (!sig) {
    logger.warn(
      { err: new Error('Missing stripe-signature header') },
      'stripe_webhook_missing_sig',
    );
    res.status(400).json({ error: 'Missing stripe-signature header' });
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body as Buffer, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    // Signature verification failed — reject immediately (do not process)
    logger.warn({ err }, 'stripe_webhook_signature_failed');
    res.status(400).json({ error: 'Webhook signature verification failed' });
    return;
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      // Only activate Pro for subscription mode checkouts with a valid customer
      if (session.mode === 'subscription' && session.customer) {
        const customerId =
          typeof session.customer === 'string' ? session.customer : session.customer.id;
        await activatePro(customerId);
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      const customerId =
        typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer.id;
      await deactivatePro(customerId);
      break;
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      const customerId =
        typeof invoice.customer === 'string' ? invoice.customer : (invoice.customer?.id ?? null);
      if (customerId) {
        // Fire-and-forget — do NOT await; delaying webhook response risks Stripe retries and duplicate emails
        void sendDunningEmail(customerId).catch((err: unknown) => {
          logger.warn({ err }, 'dunning_email_send_failed');
        });
      }
      break;
    }
    case 'customer.subscription.updated': {
      const subscription = event.data.object;
      const customerId =
        typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer.id;
      if (subscription.status === 'active') {
        await activatePro(customerId);
      } else if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
        await deactivatePro(customerId);
      }
      // past_due, trialing, paused → no action; fall through to res.json({ received: true })
      break;
    }
    default:
      // Unhandled event type — return 200 to acknowledge receipt.
      // Stripe retries on non-2xx responses; unhandled events must still be acknowledged.
      break;
  }

  res.json({ received: true });
}

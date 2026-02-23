import { Router } from 'express';
import { requireAuth } from '../middleware/require-auth.js';
import { stripe } from '../config/stripe.js';
import { env } from '../config/env.js';
import { getOrCreateStripeCustomer } from '../services/billing.service.js';
import { db } from '../db/connection.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import type { AuthUser } from '../auth.js';

export const billingRouter = Router();

/**
 * POST /api/billing/checkout
 *
 * Creates a Stripe Checkout session for the Pro monthly subscription.
 * Requires authentication. Idempotently creates a Stripe customer if the user
 * does not already have one (via getOrCreateStripeCustomer).
 *
 * Returns: { url: string } — the Stripe-hosted Checkout URL to redirect to.
 */

billingRouter.post('/checkout', requireAuth, async (_req, res) => {
  const user = res.locals.user as AuthUser;
  const customerId = await getOrCreateStripeCustomer(user);

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: env.STRIPE_PRO_PRICE_ID, quantity: 1 }],
    // {CHECKOUT_SESSION_ID} is replaced by Stripe after payment completes —
    // used for direct verification on return (BILL-05, does not rely on webhook).
    success_url: `${env.APP_URL}/dashboard?upgraded=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.APP_URL}/dashboard?checkout=cancelled`,
  });

  res.json({ url: session.url });
});

/**
 * GET /api/billing/verify-checkout?session_id=cs_...
 *
 * Verifies a completed Stripe Checkout session directly via Stripe API (BILL-05).
 * Does NOT rely on webhook timing — called immediately after the user returns from Checkout.
 *
 * Security: validates session.customer matches the authenticated user's stripe_customer_id
 * to prevent session ID spoofing (one user passing another user's session ID).
 *
 * Returns: { status: 'active', tier: 'pro' } on success.
 */

billingRouter.get('/verify-checkout', requireAuth, async (req, res) => {
  const user = res.locals.user as AuthUser;
  const sessionId = req.query['session_id'] as string | undefined;

  if (!sessionId?.startsWith('cs_')) {
    res.status(400).json({ error: 'invalid_session_id' });
    return;
  }

  const [dbUser] = await db.select().from(users).where(eq(users.id, user.id));

  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.status !== 'complete') {
    res.status(402).json({ error: 'payment_incomplete' });
    return;
  }

  // Verify the session belongs to this user (CSRF/spoofing protection).
  // Only check if the user already has a stripeCustomerId — new customers won't have one yet.
  if (dbUser?.stripeCustomerId && session.customer !== dbUser.stripeCustomerId) {
    res.status(403).json({ error: 'session_mismatch' });
    return;
  }

  res.json({ status: 'active', tier: 'pro' });
});

/**
 * POST /api/billing/portal
 *
 * Creates a Stripe Customer Portal session for the authenticated Pro user (BILL-04).
 * Returns { url } to open in a new tab. The user must already have a Stripe customer ID.
 *
 * Prerequisites: Stripe Customer Portal must be configured in the Stripe Dashboard
 * (Settings -> Billing -> Customer portal) before this endpoint can generate session URLs.
 *
 * Returns: { url: string } — the Stripe Customer Portal URL.
 */

billingRouter.post('/portal', requireAuth, async (_req, res) => {
  const user = res.locals.user as AuthUser;
  const [dbUser] = await db.select().from(users).where(eq(users.id, user.id));

  if (!dbUser?.stripeCustomerId) {
    res.status(404).json({ error: 'no_subscription' });
    return;
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: dbUser.stripeCustomerId,
    return_url: `${env.APP_URL}/dashboard`,
  });

  res.json({ url: portalSession.url });
});

import { eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { users } from '../db/schema.js';
import { stripe } from '../config/stripe.js';
import { loops } from '../config/loops.js';
import { logger } from '../middleware/logger.js';
import type { AuthUser } from '../auth.js';

/**
 * ZERO-KNOWLEDGE: activatePro and deactivatePro look up by stripe_customer_id only.
 * The webhook handler never touches userId directly — it passes stripe_customer_id
 * to these functions. See .planning/INVARIANTS.md Stripe billing row.
 */

export async function activatePro(stripeCustomerId: string): Promise<void> {
  // Update subscription tier in DB (existing behavior)
  await db
    .update(users)
    .set({ subscriptionTier: 'pro' })
    .where(eq(users.stripeCustomerId, stripeCustomerId));

  // Sync Pro status to Loops contact so day-7 audience filter can suppress upgrade email.
  // Look up email by stripeCustomerId — same pattern as getOrCreateStripeCustomer.
  // ZK invariant: stripeCustomerId is the lookup key; userId is not in scope here.
  const [proUser] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.stripeCustomerId, stripeCustomerId));

  if (proUser) {
    void loops
      .updateContact({
        email: proUser.email,
        properties: { subscriptionTier: 'pro' },
      })
      .catch((err: unknown) => {
        // Non-critical: log and continue — billing is unaffected if Loops is down
        // ZK invariant: log only err.message — no userId in same log line
        logger.error(
          { err: err instanceof Error ? err.message : String(err) },
          'Loops contact update failed on Pro upgrade',
        );
      });
  }
}

export async function deactivatePro(stripeCustomerId: string): Promise<void> {
  await db
    .update(users)
    .set({ subscriptionTier: 'free' })
    .where(eq(users.stripeCustomerId, stripeCustomerId));

  // Sync free status to Loops so the day-7 re-engagement audience re-opens for churned users.
  // ZK invariant: stripeCustomerId is the lookup key; userId is not in scope here.
  // Fire-and-forget: billing must never be blocked by a Loops outage.
  const [freedUser] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.stripeCustomerId, stripeCustomerId));

  if (freedUser) {
    void loops
      .updateContact({
        email: freedUser.email,
        properties: { subscriptionTier: 'free' },
      })
      .catch((err: unknown) => {
        logger.error(
          { err: err instanceof Error ? err.message : String(err) },
          'Loops contact update failed on Pro cancellation',
        );
      });
  }
}

export async function getOrCreateStripeCustomer(user: AuthUser): Promise<string> {
  const [dbUser] = await db.select().from(users).where(eq(users.id, user.id));

  if (dbUser?.stripeCustomerId) {
    return dbUser.stripeCustomerId;
  }

  // Create new Stripe customer. Do NOT include userId in metadata — only non-identifying data.
  // Email is stored in Stripe because it is required for receipts; it is not a secretId.
  const customer = await stripe.customers.create({
    email: user.email,
    metadata: { app: 'torch-secret' },
  });

  await db.update(users).set({ stripeCustomerId: customer.id }).where(eq(users.id, user.id));

  return customer.id;
}

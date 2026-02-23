import { eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { users } from '../db/schema.js';
import { stripe } from '../config/stripe.js';
import type { AuthUser } from '../auth.js';

/**
 * ZERO-KNOWLEDGE: activatePro and deactivatePro look up by stripe_customer_id only.
 * The webhook handler never touches userId directly — it passes stripe_customer_id
 * to these functions. See .planning/INVARIANTS.md Stripe billing row.
 */

export async function activatePro(stripeCustomerId: string): Promise<void> {
  await db
    .update(users)
    .set({ subscriptionTier: 'pro' })
    .where(eq(users.stripeCustomerId, stripeCustomerId));
}

export async function deactivatePro(stripeCustomerId: string): Promise<void> {
  await db
    .update(users)
    .set({ subscriptionTier: 'free' })
    .where(eq(users.stripeCustomerId, stripeCustomerId));
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

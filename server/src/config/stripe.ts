import Stripe from 'stripe';
import { env } from './env.js';

/**
 * Stripe SDK singleton.
 *
 * Initialized once at import time. Uses the validated STRIPE_SECRET_KEY from env.ts.
 * Import this singleton in routes and services; never create a new Stripe() elsewhere.
 */
export const stripe = new Stripe(env.STRIPE_SECRET_KEY);

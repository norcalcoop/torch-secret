/**
 * Subscriber routes — GDPR double opt-in email list capture.
 *
 * POST /api/subscribers           — subscribe (pending)
 * GET  /api/subscribers/confirm   — confirm via token
 * GET  /api/subscribers/unsubscribe — unsubscribe via token
 */

import { Router } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validate.js';
import {
  createSubscriber,
  confirmSubscriber,
  unsubscribeByToken,
} from '../services/subscribers.service.js';

export const subscribersRouter = Router();

const SubscribeSchema = z.object({
  email: z.string().email().max(254),
  // Must be literally true — z.literal(true) rejects false and undefined (ECAP-02)
  consent: z.literal(true),
});

/**
 * POST /api/subscribers
 *
 * Accepts { email, consent: true }. Returns 200 { ok: true } for all valid states
 * (fresh, pending, already-confirmed) to prevent enumeration of subscriber status.
 */
subscribersRouter.post('/', validateBody(SubscribeSchema), async (req, res, next) => {
  try {
    const { email } = req.body as { email: string; consent: true };
    // req.ip is set correctly because app.set('trust proxy', 1) is in app.ts
    await createSubscriber(email, req.ip ?? '127.0.0.1');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/subscribers/confirm?token=
 *
 * Validates confirmation token. Returns 200 on success, 400 if token missing,
 * 410 (Gone) if token expired or not found.
 */
subscribersRouter.get('/confirm', async (req, res, next) => {
  try {
    const token = req.query['token'];
    if (typeof token !== 'string' || !token) {
      res.status(400).json({ error: 'missing_token' });
      return;
    }

    const result = await confirmSubscriber(token);
    if (result === 'expired') {
      res.status(410).json({ error: 'token_expired' });
      return;
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/subscribers/unsubscribe?token=
 *
 * Always returns 200 { ok: true } — idempotent, no state leakage for invalid tokens.
 */
subscribersRouter.get('/unsubscribe', async (req, res, next) => {
  try {
    const token = req.query['token'];
    if (typeof token === 'string' && token) {
      await unsubscribeByToken(token);
    }
    // Always 200 — idempotent (CONTEXT.md: invalid token shows same success page)
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

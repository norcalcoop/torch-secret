import { Router } from 'express';
import { vsRouter } from './vs.js';
import { alternativesRouter } from './alternatives.js';

/**
 * SEO content pages router.
 *
 * Mounts server-rendered HTML routes for competitor comparison pages
 * and alternatives framing pages. These bypass the Vite SPA entirely
 * so their content is present in the initial HTTP response.
 *
 * Routes mounted here:
 *   /vs/:competitor         → vsRouter (onetimesecret, pwpush, privnote)
 *   /alternatives/:competitor → alternativesRouter (onetimesecret, pwpush, privnote)
 *
 * Planned in Plan 02:
 *   /use/:slug              → useRouter (use-case guide pages)
 *   /use/                   → hub page (card grid of all use cases)
 *
 * This router is mounted into app.ts in Plan 03, before the SPA catch-all,
 * so SSR routes take precedence over the SPA HTML fallback.
 */
export const seoRouter = Router();

seoRouter.use('/vs', vsRouter);
seoRouter.use('/alternatives', alternativesRouter);
// /use router added in Plan 02

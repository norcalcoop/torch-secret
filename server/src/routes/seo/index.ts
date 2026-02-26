import { Router } from 'express';
import { vsRouter } from './vs.js';
import { alternativesRouter } from './alternatives.js';
import { useRouter } from './use.js';

/**
 * SEO content pages router.
 *
 * Mounts server-rendered HTML routes for competitor comparison pages,
 * alternatives framing pages, and use-case guide pages. These bypass
 * the Vite SPA entirely so their content is present in the initial HTTP
 * response — visible to AI crawlers (GPTBot, ClaudeBot, PerplexityBot)
 * and Googlebot without JavaScript execution.
 *
 * Routes mounted here:
 *   /vs/:competitor           → vsRouter (onetimesecret, pwpush, privnote)
 *   /alternatives/:competitor → alternativesRouter (onetimesecret, pwpush, privnote)
 *   /use/                     → useRouter hub (card grid of all use cases)
 *   /use/:slug                → useRouter individual pages (8 use-case guides)
 *
 * This router is mounted into app.ts in Plan 03, before the SPA catch-all,
 * so SSR routes take precedence over the SPA HTML fallback.
 */
export const seoRouter = Router();

seoRouter.use('/vs', vsRouter);
seoRouter.use('/alternatives', alternativesRouter);
seoRouter.use('/use', useRouter);

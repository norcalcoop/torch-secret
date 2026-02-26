import { Router } from 'express';
import { renderLayout } from './templates/layout.js';
import { ALTERNATIVES_PAGES } from './templates/alternatives-pages.js';

/**
 * Alternatives framing router.
 *
 * Handles GET /alternatives/:competitor — serves a fully server-rendered HTML page
 * targeting "[Competitor] alternatives" search queries with persuasive narrative prose.
 * Content is present in the initial HTTP response so AI crawlers and Googlebot can
 * index it without executing JavaScript.
 *
 * Known competitors: onetimesecret, pwpush, privnote
 * Unknown slugs return 404.
 */
export const alternativesRouter = Router();

alternativesRouter.get('/:competitor', (req, res) => {
  const page = ALTERNATIVES_PAGES[req.params.competitor];
  if (!page) {
    res.status(404).json({ error: 'not_found' });
    return;
  }

  const nonce = res.locals.cspNonce as string;

  // Build FAQPage JSON-LD for <head> — structured data for search engines.
  // Not rendered as visible body content — JSON-LD only.
  const faqSchema = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: page.faqItems.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  });

  const html = renderLayout({
    ...page.meta,
    bodyHtml: page.bodyHtml,
    jsonLd: faqSchema,
    cspNonce: nonce,
  });

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

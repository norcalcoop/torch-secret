import { Router } from 'express';
import { renderLayout } from './templates/layout.js';
import { VS_PAGES } from './templates/vs-pages.js';

/**
 * VS competitor comparison router.
 *
 * Handles GET /vs/:competitor — serves a fully server-rendered HTML page
 * comparing Torch Secret against the specified competitor. Content is present
 * in the initial HTTP response so AI crawlers (GPTBot, ClaudeBot, PerplexityBot)
 * and Googlebot can index it without executing JavaScript.
 *
 * Known competitors: onetimesecret, pwpush, privnote
 * Unknown slugs return 404.
 */
export const vsRouter = Router();

vsRouter.get('/:competitor', (req, res) => {
  const page = VS_PAGES[req.params.competitor];
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

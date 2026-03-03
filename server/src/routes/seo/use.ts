import { Router } from 'express';
import { escHtml, renderLayout } from './templates/layout.js';
import { USE_CASE_HUB, USE_CASE_PAGES } from './templates/use-case-pages.js';

/**
 * Use-case guide pages router.
 *
 * Routes:
 *   GET /   → Hub page: card grid linking to all 8 use-case pages
 *   GET /:slug → Individual use-case guide page with HowTo + FAQPage JSON-LD
 *
 * Mounted at /use in seoRouter (index.ts).
 * Registration order matters: '/' BEFORE '/:slug' to prevent slug from
 * matching the trailing-slash hub request.
 */
export const useRouter = Router();

// Hub page: /use/
useRouter.get('/', (req, res) => {
  const nonce = res.locals.cspNonce as string;
  const hub = USE_CASE_HUB;

  const cardsHtml = hub.cards
    .map(
      (card) => `
      <a href="/use/${escHtml(card.slug)}" class="ssr-grid-card">
        <h2 class="ssr-grid-card-h2">${escHtml(card.title)}</h2>
        <p class="ssr-grid-card-p">${escHtml(card.description)}</p>
      </a>`,
    )
    .join('\n');

  const bodyHtml = `
    <div class="ssr-intro">
      <h1 class="ssr-h1">Credential Sharing — Done Correctly</h1>
      <p class="ssr-lead">
        Torch Secret is a zero-knowledge, one-time secret sharing tool built for the workflows where credentials actually move between people.
        Every secret is encrypted in your browser. The server stores only ciphertext. Each link destroys itself on first view.
      </p>
    </div>
    <div class="ssr-grid">
      ${cardsHtml}
    </div>
    <div class="ssr-section-footer">
      <h2>Also compare Torch Secret with alternatives</h2>
      <div class="ssr-links-row">
        <a href="/vs/onetimesecret">vs. OneTimeSecret</a>
        <a href="/vs/pwpush">vs. Password Pusher</a>
        <a href="/vs/privnote">vs. Privnote</a>
        <a href="/alternatives/onetimesecret">OneTimeSecret alternatives</a>
      </div>
    </div>`;

  const html = renderLayout({
    ...hub.meta,
    bodyHtml,
    jsonLd: '',
    cspNonce: nonce,
  });
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// Individual use-case page: /use/:slug
useRouter.get('/:slug', (req, res) => {
  const page = USE_CASE_PAGES[req.params.slug];
  if (!page) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  const nonce = res.locals.cspNonce as string;

  const howToSchema = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: page.h1,
    description: page.description,
    step: page.steps.map((s, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: s.name,
      text: s.text,
    })),
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: page.faqItems.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  };

  // Combine both schemas into a single JSON array for one <script> block
  const jsonLd = JSON.stringify([howToSchema, faqSchema]);

  const html = renderLayout({
    ...page.meta,
    bodyHtml: page.bodyHtml,
    jsonLd,
    cspNonce: nonce,
  });
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

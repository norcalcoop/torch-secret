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
      <a href="/use/${escHtml(card.slug)}" style="display:block;border-radius:0.75rem;border:1px solid var(--ds-color-border);background:var(--ds-color-surface);padding:1.5rem;text-decoration:none;transition:background 0.15s;" onmouseover="this.style.background='var(--ds-color-surface-raised)'" onmouseout="this.style.background='var(--ds-color-surface)'">
        <h2 style="font-size:1.125rem;font-weight:600;color:var(--ds-color-text-primary);margin-bottom:0.5rem;">${escHtml(card.title)}</h2>
        <p style="font-size:0.875rem;color:var(--ds-color-text-secondary);margin:0;">${escHtml(card.description)}</p>
      </a>`,
    )
    .join('\n');

  const bodyHtml = `
    <div style="margin-bottom:2.5rem;">
      <h1 style="font-size:1.875rem;font-weight:700;color:var(--ds-color-text-primary);margin-bottom:0.75rem;line-height:1.25;">Credential Sharing — Done Correctly</h1>
      <p style="color:var(--ds-color-text-secondary);font-size:1.125rem;line-height:1.7;">
        Torch Secret is a zero-knowledge, one-time secret sharing tool built for the workflows where credentials actually move between people.
        Every secret is encrypted in your browser. The server stores only ciphertext. Each link destroys itself on first view.
      </p>
    </div>
    <div style="display:grid;gap:1rem;grid-template-columns:repeat(auto-fill,minmax(18rem,1fr));margin-bottom:3rem;">
      ${cardsHtml}
    </div>
    <div style="border-top:1px solid var(--ds-color-border);padding-top:2rem;margin-top:1rem;">
      <h2 style="font-size:1.125rem;font-weight:600;color:var(--ds-color-text-primary);margin-bottom:1rem;">Also compare Torch Secret with alternatives</h2>
      <div style="display:flex;flex-wrap:wrap;gap:0.75rem;font-size:0.875rem;">
        <a href="/vs/onetimesecret" style="color:var(--ds-color-accent);">vs. OneTimeSecret</a>
        <a href="/vs/pwpush" style="color:var(--ds-color-accent);">vs. Password Pusher</a>
        <a href="/vs/privnote" style="color:var(--ds-color-accent);">vs. Privnote</a>
        <a href="/alternatives/onetimesecret" style="color:var(--ds-color-accent);">OneTimeSecret alternatives</a>
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

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * SSR Layout Template for SEO content pages (/vs/*, /alternatives/*, /use/*).
 *
 * These pages bypass the Vite SPA so their H1 and body copy are present in the
 * initial HTTP response — visible to AI crawlers (GPTBot, ClaudeBot, PerplexityBot)
 * and Googlebot without JavaScript execution.
 *
 * Design conventions:
 * - Full visual match with the SPA: same Tailwind v4 design tokens, glassmorphism surfaces
 * - Dark/light mode: CSS-only via @media (prefers-color-scheme: dark) — no JS toggle
 * - All <link>, <style>, and <script type="application/ld+json"> tags carry nonce="${cspNonce}"
 *   because Helmet's styleSrc and scriptSrc directives enforce nonces on ALL inline styles/scripts
 * - CSS hash changes on every build — parsed from client/dist/index.html at module load time
 */

/**
 * Parse the built CSS href from client/dist/index.html once at module load.
 * Returns '' during development when client/dist does not exist yet.
 * CSS filename includes a content hash that changes on every `npm run build:client`.
 */
function getBuiltCssHref(): string {
  const indexPath = resolve(import.meta.dirname, '../../../../client/dist/index.html');
  if (!existsSync(indexPath)) return '';
  const html = readFileSync(indexPath, 'utf-8');
  const match = html.match(/href="(\/assets\/index-[^"]+\.css)"/);
  return match?.[1] ?? '';
}

const BUILT_CSS_HREF = getBuiltCssHref();

export interface LayoutOptions {
  title: string;
  canonical: string;
  metaDesc: string;
  ogTitle: string;
  ogDesc: string;
  bodyHtml: string;
  /** Pre-serialized JSON-LD string, or '' if none. Injected into <head> with nonce. */
  jsonLd: string;
  /** Per-request CSP nonce from res.locals.cspNonce. Required on all inline resources. */
  cspNonce: string;
}

/**
 * HTML-escape user-interpolated data for safe injection into attribute values and text content.
 * Used to prevent XSS when embedding dynamic data (e.g. competitor slugs) into HTML.
 */
export function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderNav(): string {
  return `
  <header class="sticky top-0 z-50 border-b border-[var(--ds-color-border)] bg-[color:var(--ds-color-surface)]/80 backdrop-blur-md">
    <div class="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
      <a href="/" class="ssr-logo text-lg font-bold text-[color:var(--ds-color-text-primary)] no-underline">
        Torch Secret
      </a>
      <nav class="flex items-center gap-6 text-sm">
        <a href="/" class="text-[color:var(--ds-color-text-secondary)] no-underline transition-colors hover:text-[color:var(--ds-color-text-primary)]">Home</a>
        <a href="/create" class="text-[color:var(--ds-color-text-secondary)] no-underline transition-colors hover:text-[color:var(--ds-color-text-primary)]">Create</a>
        <a href="/pricing" class="text-[color:var(--ds-color-text-secondary)] no-underline transition-colors hover:text-[color:var(--ds-color-text-primary)]">Pricing</a>
        <a href="/dashboard" class="text-[color:var(--ds-color-text-secondary)] no-underline transition-colors hover:text-[color:var(--ds-color-text-primary)]">Dashboard</a>
      </nav>
    </div>
  </header>`;
}

function renderFooter(): string {
  return `
  <footer class="mt-auto border-t border-[var(--ds-color-border)] bg-[color:var(--ds-color-surface)] py-8">
    <div class="mx-auto max-w-5xl px-4">
      <div class="flex flex-col items-center gap-4 text-sm text-[color:var(--ds-color-text-muted)] sm:flex-row sm:justify-between">
        <p>&copy; ${new Date().getFullYear()} Torch Secret. Zero-knowledge secret sharing.</p>
        <nav class="flex gap-4">
          <a href="/privacy" class="transition-colors hover:text-[color:var(--ds-color-text-primary)]">Privacy</a>
          <a href="/terms" class="transition-colors hover:text-[color:var(--ds-color-text-primary)]">Terms</a>
          <a href="/pricing" class="transition-colors hover:text-[color:var(--ds-color-text-primary)]">Pricing</a>
        </nav>
      </div>
    </div>
  </footer>`;
}

/**
 * Render a complete HTML document for an SSR content page.
 *
 * - Injects the compiled Tailwind CSS link (with nonce, CSP-compliant)
 * - Injects a CSS-only dark mode override block (with nonce, CSP-compliant)
 * - Injects FAQPage or HowTo JSON-LD into <head> (with nonce, CSP-compliant)
 * - Renders shared nav and footer
 */
export function renderLayout(opts: LayoutOptions): string {
  // Link to the compiled Tailwind bundle. Nonce required by Helmet's styleSrc CSP directive.
  const cssLink = BUILT_CSS_HREF
    ? `<link rel="stylesheet" href="${escHtml(BUILT_CSS_HREF)}" nonce="${opts.cspNonce}" />`
    : '';

  // JSON-LD structured data in <head>. Nonce required by Helmet's scriptSrc CSP directive.
  const jsonLdBlock = opts.jsonLd
    ? `<script type="application/ld+json" nonce="${opts.cspNonce}">${opts.jsonLd}</script>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="referrer" content="no-referrer" />
  <meta name="description" content="${escHtml(opts.metaDesc)}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${escHtml(opts.canonical)}" />
  <title>${escHtml(opts.title)}</title>
  <meta property="og:title" content="${escHtml(opts.ogTitle)}" />
  <meta property="og:description" content="${escHtml(opts.ogDesc)}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${escHtml(opts.canonical)}" />
  <meta property="og:site_name" content="Torch Secret" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${escHtml(opts.ogTitle)}" />
  <meta name="twitter:description" content="${escHtml(opts.ogDesc)}" />
  <link rel="icon" href="/favicon.ico" sizes="32x32" />
  ${cssLink}
  <style nonce="${opts.cspNonce}">
    /*
     * CSS custom property definitions for SSR pages.
     * The SPA uses a .dark class toggle — SSR pages use @media (prefers-color-scheme: dark)
     * for CSS-only dark mode that works before any JS loads.
     * These values mirror client/src/styles.css exactly.
     */
    :root {
      --ds-color-bg: #f7f8fc;
      --ds-color-surface: #ffffff;
      --ds-color-surface-raised: #f4f5f9;
      --ds-color-surface-overlay: #e9ebf1;
      --ds-color-text-primary: #12161f;
      --ds-color-text-secondary: #353a48;
      --ds-color-text-tertiary: #5c6375;
      --ds-color-text-muted: #5d6372;
      --ds-color-accent: #154fac;
      --ds-color-accent-hover: #173796;
      --ds-color-border: #d5d7de;
      --ds-color-danger: #a9131f;
      --ds-color-success: #195c2e;
      --ds-color-warning: #7e4f04;
      --ds-color-icon: #5c6375;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --ds-color-bg: #1a1a2e;
        --ds-color-surface: #222240;
        --ds-color-surface-raised: #292a4a;
        --ds-color-surface-overlay: #343456;
        --ds-color-text-primary: #f0f0ff;
        --ds-color-text-secondary: #c8c8e0;
        --ds-color-text-tertiary: #9292b2;
        --ds-color-text-muted: #8b8baf;
        --ds-color-accent: #60a4f9;
        --ds-color-accent-hover: #3b81f5;
        --ds-color-border: #39395b;
        --ds-color-danger: #f04546;
        --ds-color-success: #1bc45e;
        --ds-color-warning: #f69e0b;
        --ds-color-icon: #9292b2;
      }
    }
    /* Base styles for SSR pages */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: var(--ds-color-bg);
      color: var(--ds-color-text-primary);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      line-height: 1.6;
    }
    a { color: var(--ds-color-accent); }
    a:hover { color: var(--ds-color-accent-hover); }
    table { border-collapse: collapse; width: 100%; }
    th, td {
      border: 1px solid var(--ds-color-border);
      padding: 0.625rem 1rem;
      text-align: left;
      color: var(--ds-color-text-secondary);
    }
    th { font-weight: 600; color: var(--ds-color-text-primary); background: var(--ds-color-surface-raised); }
    tr:nth-child(even) td { background: var(--ds-color-surface-raised); }
    /* SSR page utility classes — used by vs-pages, alternatives-pages, use-case-pages, use.ts */
    .ssr-logo { font-family: ui-monospace, 'JetBrains Mono Variable', monospace; }
    .ssr-main { flex: 1; max-width: 64rem; margin: 0 auto; width: 100%; padding: 3rem 1rem; }
    .ssr-card { border-radius: 0.75rem; border: 1px solid var(--ds-color-border); background: var(--ds-color-surface); padding: 2rem; margin-bottom: 2rem; }
    .ssr-h1 { font-size: 1.875rem; font-weight: 700; color: var(--ds-color-text-primary); margin-bottom: 1rem; line-height: 1.25; }
    .ssr-h2 { font-size: 1.25rem; font-weight: 600; color: var(--ds-color-text-primary); margin-top: 2.5rem; margin-bottom: 0.75rem; }
    .ssr-h3 { font-size: 1.125rem; font-weight: 600; color: var(--ds-color-text-primary); margin-top: 2rem; margin-bottom: 0.5rem; }
    .ssr-p { color: var(--ds-color-text-secondary); line-height: 1.7; margin-bottom: 1rem; }
    .ssr-lead { color: var(--ds-color-text-secondary); font-size: 1.125rem; line-height: 1.7; }
    .ssr-strong { color: var(--ds-color-text-primary); }
    .ssr-hr { border: none; border-top: 1px solid var(--ds-color-border); margin: 2rem 0; }
    .ssr-ul { list-style: disc; padding-left: 1.5rem; margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.25rem; }
    .ssr-ol { list-style: decimal; padding-left: 1.5rem; margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.75rem; }
    .ssr-li { color: var(--ds-color-text-secondary); }
    .ssr-cta { display: inline-block; margin-top: 2rem; border-radius: 0.5rem; background: var(--ds-color-accent); padding: 0.75rem 1.5rem; font-weight: 600; color: #fff; text-decoration: none; transition: background 0.15s; }
    .ssr-cta:hover { background: var(--ds-color-accent-hover); color: #fff; }
    .ssr-overflow { overflow-x: auto; margin-bottom: 1.5rem; }
    .ssr-link-inline { display: inline-block; margin-top: 1rem; margin-left: 1rem; color: var(--ds-color-accent); text-decoration: none; }
    .ssr-dl { margin: 0; }
    .ssr-dl-item { margin-bottom: 1.25rem; }
    .ssr-dt { font-weight: 600; color: var(--ds-color-text-primary); margin-bottom: 0.375rem; }
    .ssr-dd { color: var(--ds-color-text-secondary); line-height: 1.7; margin: 0; }
    .ssr-related { color: var(--ds-color-text-muted); font-size: 0.875rem; margin-top: 1rem; }
    .ssr-related a { color: var(--ds-color-accent); }
    .ssr-intro { margin-bottom: 2.5rem; }
    .ssr-grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr)); margin-bottom: 3rem; }
    .ssr-grid-card { display: block; border-radius: 0.75rem; border: 1px solid var(--ds-color-border); background: var(--ds-color-surface); padding: 1.5rem; text-decoration: none; transition: background 0.15s; }
    .ssr-grid-card:hover { background: var(--ds-color-surface-raised); }
    .ssr-grid-card-h2 { font-size: 1.125rem; font-weight: 600; color: var(--ds-color-text-primary); margin-bottom: 0.5rem; }
    .ssr-grid-card-p { font-size: 0.875rem; color: var(--ds-color-text-secondary); margin: 0; }
    .ssr-section-footer { border-top: 1px solid var(--ds-color-border); padding-top: 2rem; margin-top: 1rem; }
    .ssr-section-footer h2 { font-size: 1.125rem; font-weight: 600; color: var(--ds-color-text-primary); margin-bottom: 1rem; }
    .ssr-links-row { display: flex; flex-wrap: wrap; gap: 0.75rem; font-size: 0.875rem; }
    .ssr-links-row a { color: var(--ds-color-accent); text-decoration: none; }
  </style>
  ${jsonLdBlock}
</head>
<body>
  ${renderNav()}
  <main id="main-content" class="ssr-main">
    ${opts.bodyHtml}
  </main>
  ${renderFooter()}
</body>
</html>`;
}

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

/**
 * Parse the JetBrains Mono Latin woff2 path from the compiled CSS file.
 * Vite writes url(/assets/jetbrains-mono-latin-wght-normal-[hash].woff2) — no quotes.
 * Returns '' during development when dist/CSS does not exist.
 */
function getBuiltFontHref(): string {
  if (!BUILT_CSS_HREF) return '';
  const cssPath = resolve(
    import.meta.dirname,
    '../../../../client/dist',
    BUILT_CSS_HREF.replace(/^\//, ''),
  );
  if (!existsSync(cssPath)) return '';
  const css = readFileSync(cssPath, 'utf-8');
  const match = css.match(/url\((\/assets\/jetbrains-mono-latin-wght-normal-[^)]+\.woff2)\)/);
  return match?.[1] ?? '';
}

const BUILT_FONT_HREF = getBuiltFontHref();

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

/** Lucide Shield SVG — matches the icon used in the SPA brand mark. */
const SHIELD_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="ssr-icon-accent"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;

/** Lucide Moon SVG — theme toggle icon (static; JS applies .dark/.light class). */
const MOON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;

/** Lucide Sun SVG — theme dropdown Light option icon. */
const SUN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`;

/** Lucide Monitor SVG — theme dropdown System option icon. */
const MONITOR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8M12 17v4"/></svg>`;

/** Lucide GitHub SVG — matches the icon used in the SPA footer Open Source link. */
const GITHUB_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink:0"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>`;

/** Lucide tab bar icons — 20×20, matches SPA mobile nav. */
const ICON_HOME = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
const ICON_PEN_LINE = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;
const ICON_CREDIT_CARD = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>`;
const ICON_LAYOUT_DASHBOARD = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="11" rx="1"/><rect width="7" height="5" x="3" y="15" rx="1"/></svg>`;

function renderNav(): string {
  return `
  <header id="site-header" class="sticky top-0 z-40 backdrop-blur-md">
    <div class="ssr-header-inner">
      <a href="/" class="ssr-brand">
        ${SHIELD_SVG}
        <span class="ssr-brand-text">Torch Secret</span>
      </a>
      <div class="ssr-nav-right">
        <a href="/use/" class="ssr-nav-link">Use Cases</a>
        <a href="/pricing" class="ssr-nav-link">Pricing</a>
        <a href="/dashboard" class="ssr-nav-link">Dashboard</a>
        <a href="/create" class="ssr-cta-nav">Create a Secret</a>
        <details id="ssr-theme-details" class="ssr-theme-details">
          <summary class="ssr-theme-summary" aria-label="Change theme">
            <span class="ssr-theme-summary-icon" aria-hidden="true">${MOON_SVG}</span>
          </summary>
          <div class="ssr-theme-panel" role="menu" aria-label="Theme selector">
            <p class="ssr-theme-section-label" aria-hidden="true">Base Modes</p>
            <button class="ssr-theme-option" data-theme="light" role="menuitem" type="button">${SUN_SVG} Light</button>
            <button class="ssr-theme-option" data-theme="dark" role="menuitem" type="button">${MOON_SVG} Dark</button>
            <button class="ssr-theme-option" data-theme="system" role="menuitem" type="button">${MONITOR_SVG} System</button>
          </div>
        </details>
      </div>
    </div>
  </header>`;
}

function renderMobileNav(): string {
  const tabs = [
    { icon: ICON_HOME, label: 'Home', path: '/' },
    { icon: ICON_PEN_LINE, label: 'Create', path: '/create' },
    { icon: ICON_CREDIT_CARD, label: 'Pricing', path: '/pricing' },
    { icon: ICON_LAYOUT_DASHBOARD, label: 'Dashboard', path: '/dashboard' },
  ];

  const buttons = tabs
    .map(
      (t) => `
    <a href="${t.path}" class="ssr-tab-btn" data-path="${t.path}" aria-label="${t.label}">
      ${t.icon}
      <span class="ssr-tab-label">${t.label}</span>
    </a>`,
    )
    .join('');

  return `
  <nav id="ssr-mobile-nav" aria-label="Main navigation">
    <div class="ssr-tab-inner">${buttons}</div>
  </nav>`;
}

function renderFooter(cspNonce: string): string {
  // Submit handler uses textContent only — no innerHTML with user data (XSS-safe).
  const emailScript =
    `<script nonce="${cspNonce}">(function(){` +
    `var form=document.getElementById('ssr-email-form');` +
    `if(!form)return;` +
    `form.addEventListener('submit',function(e){` +
    `e.preventDefault();` +
    `var input=document.getElementById('ssr-email-input');` +
    `var consent=document.getElementById('ssr-email-consent');` +
    `var email=(input.value||'').trim();` +
    `var err=document.getElementById('ssr-email-error');` +
    `var btn=document.getElementById('ssr-email-btn');` +
    `err.classList.add('ssr-hidden');` +
    `if(!email){err.textContent='Please enter your email address.';err.classList.remove('ssr-hidden');return;}` +
    `if(!consent.checked){err.textContent='Please check the consent box to continue.';err.classList.remove('ssr-hidden');return;}` +
    `btn.disabled=true;btn.textContent='Joining...';` +
    `fetch('/api/subscribers',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email,consent:true})})` +
    `.then(function(r){` +
    `if(r.ok){` +
    `form.classList.add('ssr-hidden');` +
    `var body=document.getElementById('ssr-email-success-body');` +
    `body.textContent='We sent a confirmation link to '+email+'. Click it to join the list.';` +
    `document.getElementById('ssr-email-success').classList.remove('ssr-hidden');` +
    `}else{btn.disabled=false;btn.textContent='Join the list';err.textContent='Something went wrong. Please try again.';err.classList.remove('ssr-hidden');}` +
    `}).catch(function(){btn.disabled=false;btn.textContent='Join the list';err.textContent='Something went wrong. Please try again.';err.classList.remove('ssr-hidden');});` +
    `});` +
    `})();</script>`;

  return `
  <footer id="site-footer">
    <section class="ssr-email-capture" aria-labelledby="ssr-email-heading">
      <p id="ssr-email-heading" class="ssr-email-heading">Stay in the loop</p>
      <p class="ssr-email-sub">Join our early access list. No spam, unsubscribe any time.</p>
      <form id="ssr-email-form" novalidate class="ssr-email-form">
        <div class="ssr-email-row">
          <input type="email" id="ssr-email-input" name="email" placeholder="you@example.com" required autocomplete="email" class="ssr-email-input" />
          <button type="submit" id="ssr-email-btn" class="ssr-email-btn">Join the list</button>
        </div>
        <p id="ssr-email-error" class="ssr-email-error ssr-hidden" role="alert"></p>
        <div class="ssr-email-consent-row">
          <input type="checkbox" id="ssr-email-consent" name="consent" class="ssr-email-checkbox" />
          <label for="ssr-email-consent" class="ssr-email-consent-label">I agree to receive product updates and marketing emails from Torch Secret. You can unsubscribe at any time. See our <a href="/privacy" class="ssr-footer-link" style="text-decoration:underline">Privacy Policy</a>.</label>
        </div>
      </form>
      <div id="ssr-email-success" class="ssr-hidden">
        <p class="ssr-email-success-head">Check your inbox</p>
        <p id="ssr-email-success-body" class="ssr-email-success-body"></p>
      </div>
    </section>
    <div class="ssr-footer-inner">
      <span>Zero-knowledge encryption</span>
      <span>AES-256-GCM</span>
      <a href="https://github.com/norcalcoop/torch-secret" target="_blank" rel="noopener noreferrer" class="ssr-footer-github-link">${GITHUB_SVG}<span>Open Source</span></a>
      <a href="/privacy" class="ssr-footer-link">Privacy Policy</a>
      <a href="/terms" class="ssr-footer-link">Terms of Service</a>
    </div>
    <div class="ssr-footer-link-row">
      <a href="/use/share-api-keys" class="ssr-footer-link">Share API Keys</a>
      <a href="/use/share-database-credentials" class="ssr-footer-link">Share DB Credentials</a>
      <a href="/use/send-password-without-email" class="ssr-footer-link">Send Passwords Safely</a>
      <a href="/vs/onetimesecret" class="ssr-footer-link">vs. OneTimeSecret</a>
      <a href="/vs/bitwarden-send" class="ssr-footer-link">vs. Bitwarden Send</a>
    </div>
  </footer>
  ${emailScript}`;
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
  // Font preload: no nonce required — <link rel="preload"> is not a script or style.
  const fontPreload = BUILT_FONT_HREF
    ? `<link rel="preload" href="${escHtml(BUILT_FONT_HREF)}" as="font" type="font/woff2" crossorigin />`
    : '';

  // Link to the compiled Tailwind bundle. Nonce required by Helmet's styleSrc CSP directive.
  const cssLink = BUILT_CSS_HREF
    ? `<link rel="stylesheet" href="${escHtml(BUILT_CSS_HREF)}" nonce="${opts.cspNonce}" />`
    : '';

  // JSON-LD structured data in <head>. Nonce required by Helmet's scriptSrc CSP directive.
  const jsonLdBlock = opts.jsonLd
    ? `<script type="application/ld+json" nonce="${opts.cspNonce}">${opts.jsonLd}</script>`
    : '';

  // FOWT: apply stored theme class before first paint (mirrors client/index.html)
  const fowtScript = `<script nonce="${opts.cspNonce}">(function(){var t=localStorage.getItem('theme');var d=t==='dark'||(!t&&matchMedia('(prefers-color-scheme:dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.classList.toggle('light',!d&&t==='light');document.documentElement.style.colorScheme=d?'dark':'light';})()</script>`;

  // Theme dropdown: active state on load + click handlers + close-on-outside + close-on-Escape
  // Summary icon update uses setAttribute on the span so no unsafe DOM manipulation occurs.
  const themeDropdownScript =
    `<script nonce="${opts.cspNonce}">(function(){` +
    `var details=document.getElementById('ssr-theme-details');` +
    `if(!details)return;` +
    `var items=details.querySelectorAll('[data-theme]');` +
    // Mark active option on load
    `var stored=localStorage.getItem('theme')||'system';` +
    `items.forEach(function(o){o.classList.toggle('active',o.getAttribute('data-theme')===stored);});` +
    // Attach click handler to each option
    `items.forEach(function(o){o.addEventListener('click',function(){` +
    `var pref=o.getAttribute('data-theme');` +
    `if(pref==='system'){localStorage.removeItem('theme');}else{localStorage.setItem('theme',pref);}` +
    `var d=pref==='dark'||(!pref&&matchMedia('(prefers-color-scheme:dark)').matches);` +
    `document.documentElement.classList.toggle('dark',d);` +
    `document.documentElement.classList.toggle('light',!d&&pref==='light');` +
    `document.documentElement.style.colorScheme=d?'dark':'light';` +
    `items.forEach(function(x){x.classList.toggle('active',x===o);});` +
    `details.open=false;` +
    `});});` +
    // Close on click outside
    `document.addEventListener('click',function(e){if(details&&!details.contains(e.target))details.open=false;});` +
    // Close on Escape
    `document.addEventListener('keydown',function(e){if(e.key==='Escape')details.open=false;});` +
    `})()</script>`;

  return `<!doctype html>
<html lang="en">
<head>
  ${fowtScript}
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
  ${fontPreload}
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
      --ds-color-dot-grid: rgb(173 176 186 / 0.12);
      --ds-color-terminal-bg: #f2f6f4;
      --ds-color-terminal-text: #1d442c;
      --ds-color-terminal-header: #e7ede9;
      --font-heading: 'JetBrains Mono Variable', ui-monospace, monospace;
      --font-body: ui-sans-serif, system-ui, sans-serif;
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
        --ds-color-dot-grid: rgb(57 57 91 / 0.15);
        --ds-color-terminal-bg: #0e1913;
        --ds-color-terminal-text: #7ba488;
        --ds-color-terminal-header: #17251d;
      }
    }
    /* Explicit .dark class (set by localStorage theme toggle — mirrors SPA behaviour) */
    html.dark {
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
      --ds-color-dot-grid: rgb(57 57 91 / 0.15);
      --ds-color-terminal-bg: #0e1913;
      --ds-color-terminal-text: #7ba488;
      --ds-color-terminal-header: #17251d;
    }
    /* Explicit .light class overrides @media (prefers-color-scheme: dark) */
    html.light {
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
      --ds-color-dot-grid: rgb(173 176 186 / 0.12);
    }
    /* Base styles for SSR pages */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--font-body, ui-sans-serif, system-ui, sans-serif);
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
    /* Header structural classes */
    #site-header { background: color-mix(in srgb, var(--ds-color-bg) 80%, transparent); }
    .ssr-header-inner { max-width: 64rem; margin: 0 auto; padding: 0 1rem; height: 3.5rem; display: flex; align-items: center; justify-content: space-between; }
    .ssr-brand { display: flex; align-items: center; gap: 0.5rem; text-decoration: none; color: var(--ds-color-text-primary); }
    .ssr-brand:hover { color: var(--ds-color-text-primary); }
    .ssr-brand-text { font-family: var(--font-heading, 'JetBrains Mono Variable', ui-monospace, monospace); font-weight: 600; font-size: 1.125rem; }
    .ssr-nav-right { display: flex; align-items: center; gap: 1rem; }
    /* Header nav link classes */
    .ssr-nav-link { font-size: 0.875rem; color: var(--ds-color-text-secondary); text-decoration: none; transition: color 0.15s; }
    .ssr-nav-link:hover { color: var(--ds-color-accent); }
    .ssr-cta-nav { font-size: 0.875rem; padding: 0.375rem 0.75rem; border-radius: 0.5rem; background: var(--ds-color-accent); color: #fff; font-weight: 500; text-decoration: none; transition: background 0.15s; }
    .ssr-cta-nav:hover { background: var(--ds-color-accent-hover); color: #fff; }
    .ssr-theme-btn { display: flex; align-items: center; justify-content: center; width: 2rem; height: 2rem; border-radius: 0.375rem; border: none; background: transparent; color: var(--ds-color-text-muted); cursor: pointer; padding: 0; transition: color 0.15s; }
    .ssr-theme-btn:hover { color: var(--ds-color-text-primary); }
    /* ── Theme dropdown (replaces moon-button cycle) ───────────────────── */
    .ssr-theme-details { position: relative; }
    .ssr-theme-summary { display: flex; align-items: center; justify-content: center; width: 2.75rem; height: 2.75rem; border-radius: 0.375rem; background: transparent; color: var(--ds-color-text-muted); cursor: pointer; list-style: none; padding: 0; transition: color 0.15s; }
    .ssr-theme-summary:hover { color: var(--ds-color-text-primary); }
    .ssr-theme-summary::marker, .ssr-theme-summary::-webkit-details-marker { display: none; }
    .ssr-theme-summary-icon { display: flex; align-items: center; pointer-events: none; }
    .ssr-theme-panel { position: absolute; top: calc(100% + 0.25rem); right: 0; z-index: 50; background: color-mix(in srgb, var(--ds-color-surface) 90%, transparent); backdrop-filter: blur(12px); border: 1px solid var(--ds-color-border); border-radius: 0.75rem; box-shadow: 0 4px 16px rgb(0 0 0 / 0.12); width: 13rem; padding: 0.5rem 0; }
    .ssr-theme-section-label { padding: 0.25rem 0.75rem; font-size: 0.625rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ds-color-text-muted); }
    .ssr-theme-option { display: flex; align-items: center; gap: 0.625rem; width: 100%; padding: 0.375rem 0.75rem; font-size: 0.875rem; color: var(--ds-color-text-primary); background: transparent; border: none; cursor: pointer; text-align: left; transition: background 0.1s; }
    .ssr-theme-option:hover { background: var(--ds-color-surface-raised); }
    .ssr-theme-option.active { color: var(--ds-color-accent); font-weight: 500; }
    .ssr-icon-accent { color: var(--ds-color-accent); }
    /* Footer structural classes */
    #site-footer { border-top: 1px solid var(--ds-color-border); background: var(--ds-color-bg); padding: 1.5rem 0; }
    .ssr-footer-inner { max-width: 42rem; margin: 0 auto; padding: 0 1rem; display: flex; flex-wrap: wrap; justify-content: center; gap: 1.5rem; font-size: 0.75rem; color: var(--ds-color-text-muted); }
    /* Footer link classes */
    .ssr-footer-link { color: inherit; text-decoration: none; text-underline-offset: 0.125rem; transition: color 0.15s; }
    .ssr-footer-link:hover { color: var(--ds-color-text-secondary); text-decoration: underline; }
    /* SSR page utility classes — used by vs-pages, alternatives-pages, use-case-pages, use.ts */
    .ssr-logo { font-family: ui-monospace, 'JetBrains Mono Variable', monospace; }
    .ssr-main { flex: 1; max-width: 64rem; margin: 0 auto; width: 100%; padding: 3rem 1rem; position: relative; }
    .ssr-main::before { content: ''; position: absolute; inset: 0; background-image: radial-gradient(circle, var(--ds-color-dot-grid) 1px, transparent 1px); background-size: 44px 44px; pointer-events: none; z-index: -1; }
    .ssr-card { border-radius: 0.75rem; border: 1px solid var(--ds-color-border); background: color-mix(in srgb, var(--ds-color-surface) 80%, transparent); backdrop-filter: blur(12px); padding: 2rem; margin-bottom: 2rem; }
    .ssr-h1 { font-family: var(--font-heading, 'JetBrains Mono Variable', ui-monospace, monospace); font-size: 1.875rem; font-weight: 700; color: var(--ds-color-text-primary); margin-bottom: 1rem; line-height: 1.25; }
    .ssr-h2 { font-family: var(--font-heading, 'JetBrains Mono Variable', ui-monospace, monospace); font-size: 1.25rem; font-weight: 600; color: var(--ds-color-text-primary); margin-top: 2.5rem; margin-bottom: 0.75rem; }
    .ssr-h3 { font-family: var(--font-heading, 'JetBrains Mono Variable', ui-monospace, monospace); font-size: 1.125rem; font-weight: 600; color: var(--ds-color-text-primary); margin-top: 2rem; margin-bottom: 0.5rem; }
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

    /* ── Footer: email capture section ──────────────────────────────── */
    .ssr-email-capture { max-width: 42rem; margin: 0 auto; padding: 1.5rem 1rem; display: flex; flex-direction: column; gap: 0.75rem; }
    .ssr-email-heading { font-size: 0.875rem; font-weight: 600; color: var(--ds-color-text-primary); text-align: center; }
    .ssr-email-sub { font-size: 0.75rem; color: var(--ds-color-text-muted); text-align: center; }
    .ssr-email-form { display: flex; flex-direction: column; gap: 0.75rem; }
    .ssr-email-row { display: flex; gap: 0.5rem; align-items: flex-start; }
    .ssr-email-input { flex: 1; padding: 0.5rem 0.75rem; min-height: 2.75rem; border: 1px solid var(--ds-color-border); border-radius: 0.5rem; background: var(--ds-color-bg); color: var(--ds-color-text-primary); font-size: 0.875rem; outline: none; }
    .ssr-email-input:focus { box-shadow: 0 0 0 2px var(--ds-color-accent); }
    .ssr-email-btn { padding: 0.5rem 1rem; min-height: 2.75rem; border-radius: 0.5rem; background: var(--ds-color-accent); color: #fff; font-size: 0.875rem; font-weight: 500; border: none; cursor: pointer; white-space: nowrap; transition: background 0.15s; }
    .ssr-email-btn:hover { background: var(--ds-color-accent-hover); }
    .ssr-email-error { font-size: 0.75rem; color: var(--ds-color-danger); }
    .ssr-email-consent-row { display: flex; align-items: flex-start; gap: 0.75rem; }
    .ssr-email-checkbox { margin-top: 0.125rem; width: 1rem; height: 1rem; border-radius: 0.25rem; border: 1px solid var(--ds-color-border); accent-color: var(--ds-color-accent); cursor: pointer; flex-shrink: 0; }
    .ssr-email-consent-label { font-size: 0.75rem; color: var(--ds-color-text-muted); line-height: 1.5; cursor: pointer; }
    .ssr-email-success-head { font-size: 0.875rem; font-weight: 600; color: var(--ds-color-text-primary); text-align: center; }
    .ssr-email-success-body { font-size: 0.75rem; color: var(--ds-color-text-muted); text-align: center; }
    .ssr-hidden { display: none !important; }
    /* ── Footer: Open Source GitHub link ─────────────────────────────── */
    .ssr-footer-github-link { display: flex; align-items: center; gap: 0.25rem; color: inherit; text-decoration: none; transition: color 0.15s; }
    .ssr-footer-github-link:hover { color: var(--ds-color-text-secondary); }
    /* ── Footer: internal SEO links row ─────────────────────────────── */
    .ssr-footer-link-row { max-width: 42rem; margin: 0.5rem auto 0; padding: 0 1rem; display: flex; flex-wrap: wrap; justify-content: center; gap: 1rem; font-size: 0.75rem; color: var(--ds-color-text-muted); }

    /* ── Mobile bottom tab bar (mirrors SPA mobile-tab-bar) ─────────── */
    #ssr-mobile-nav {
      display: none; /* shown only on mobile via media query below */
      position: fixed; bottom: 0; left: 0; right: 0; z-index: 40;
      border-top: 1px solid var(--ds-color-border);
      background: color-mix(in srgb, var(--ds-color-bg) 95%, transparent);
      backdrop-filter: blur(12px);
      padding-bottom: env(safe-area-inset-bottom);
    }
    .ssr-tab-inner { display: flex; align-items: center; justify-content: space-around; height: 4rem; }
    .ssr-tab-btn {
      display: flex; flex-direction: column; align-items: center; gap: 0.125rem;
      min-width: 3.5rem; padding: 0.5rem 0.25rem;
      color: var(--ds-color-text-muted); text-decoration: none;
      transition: color 0.15s;
    }
    .ssr-tab-btn:hover { color: var(--ds-color-accent); }
    .ssr-tab-btn.ssr-tab-active { color: var(--ds-color-accent); }
    .ssr-tab-label { font-size: 0.625rem; font-weight: 500; line-height: 1; }

    /* ── Tables: enforce min-width so columns stay readable on scroll ─── */
    table { min-width: 480px; }
    .ssr-overflow { -webkit-overflow-scrolling: touch; }

    /* ── Mobile: ≤ 639px ─────────────────────────────────────────────── */
    @media (max-width: 639px) {
      /* Show bottom tab bar */
      #ssr-mobile-nav { display: block; }

      /* Body: pad bottom so tab bar doesn't cover last content */
      body { padding-bottom: 4rem; }

      /* Nav: Pricing + Dashboard links won't fit — hide them; keep brand + CTA + theme */
      .ssr-nav-link { display: none; }
      .ssr-nav-right { gap: 0.5rem; }
      .ssr-cta-nav { font-size: 0.8125rem; padding: 0.375rem 0.625rem; white-space: nowrap; }

      /* Layout: tighter spacing on small screens */
      .ssr-main { padding: 1.75rem 0.875rem; }
      .ssr-card { padding: 1.25rem; margin-bottom: 1.25rem; }

      /* Typography: scale headings down one notch */
      .ssr-h1 { font-size: 1.5rem; }
      .ssr-h2 { font-size: 1.125rem; margin-top: 2rem; }
      .ssr-h3 { font-size: 1rem; margin-top: 1.5rem; }
      .ssr-lead { font-size: 1rem; }

      /* Tables: reduce cell padding; min-width keeps columns legible via scroll */
      th, td { padding: 0.5rem 0.625rem; font-size: 0.875rem; }

      /* CTA: full-width block for easy tapping */
      .ssr-cta { display: block; text-align: center; }

      /* Section footer link row: stack vertically */
      .ssr-links-row { flex-direction: column; gap: 0.5rem; }

      /* Footer: tighter gap between items */
      .ssr-footer-inner { gap: 1rem; }
    }
  </style>
  ${jsonLdBlock}
</head>
<body>
  ${renderNav()}
  <main id="main-content" class="ssr-main">
    ${opts.bodyHtml}
  </main>
  ${renderFooter(opts.cspNonce)}
  ${renderMobileNav()}
  ${themeDropdownScript}
  <script nonce="${opts.cspNonce}">(function(){var p=window.location.pathname;var tabs=document.querySelectorAll('#ssr-mobile-nav .ssr-tab-btn');tabs.forEach(function(t){if(t.getAttribute('data-path')===p)t.classList.add('ssr-tab-active');});})()</script>
</body>
</html>`;
}

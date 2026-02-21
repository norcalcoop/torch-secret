/**
 * Client-side SPA router using History API.
 *
 * Path-based routing with dynamic imports for code splitting.
 * Each page is a separate chunk loaded only when its route matches.
 *
 * Accessibility: Updates document.title and announces route changes
 * via an aria-live region on every navigation. Moves focus to the
 * page heading after each render.
 */

import { capturePageview } from './analytics/posthog.js';

export type PageRenderer = (container: HTMLElement) => void | Promise<void>;

/**
 * Route-specific SEO metadata.
 *
 * Every SPA navigation updates the document head via `updatePageMeta()` to
 * set title, description, canonical URL, and robots directive. Secret and
 * error routes set `noindex: true` which also swaps OG/Twitter tags to
 * generic branding so no metadata leaks about secret existence.
 */
export interface PageMeta {
  title: string;
  description: string;
  /** Defaults to window.location.origin + window.location.pathname */
  canonical?: string;
  /** When true, adds <meta name="robots" content="noindex, nofollow"> and removes canonical */
  noindex?: boolean;
}

/**
 * Navigate to a new path using History API.
 * Updates the URL without a full page reload and renders the matching route.
 */
export function navigate(path: string): void {
  history.pushState(null, '', path);
  handleRoute();
}

/**
 * Initialize the router.
 * Renders the current route and listens for browser back/forward navigation.
 */
export function initRouter(): void {
  handleRoute();
  window.addEventListener('popstate', handleRoute);
}

/**
 * Update all SEO-related meta elements in the document head.
 *
 * This is the single source of truth for: document title, meta description,
 * canonical link, robots directive, and OG/Twitter tag values. Every call
 * fully updates all managed elements so no stale tags persist across
 * navigation.
 *
 * Uses a clear-then-set pattern with requestAnimationFrame to ensure
 * the aria-live region announces even when navigating to the same title
 * (e.g., pressing back then forward to the same page).
 *
 * @param meta - Route-specific SEO metadata
 */
export function updatePageMeta(meta: PageMeta): void {
  // 1. Document title
  document.title = `${meta.title} - SecureShare`;

  // 2. Meta description (create or update)
  let descEl = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (!descEl) {
    descEl = document.createElement('meta');
    descEl.name = 'description';
    document.head.appendChild(descEl);
  }
  descEl.content = meta.description;

  // 3. Canonical URL: remove for noindex pages (Pitfall 4), update otherwise
  let canonicalEl = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (meta.noindex) {
    canonicalEl?.remove();
  } else {
    if (!canonicalEl) {
      canonicalEl = document.createElement('link');
      canonicalEl.rel = 'canonical';
      document.head.appendChild(canonicalEl);
    }
    canonicalEl.href = meta.canonical ?? `${window.location.origin}${window.location.pathname}`;
  }

  // 4. Robots meta: add for noindex pages, remove otherwise
  let robotsEl = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
  if (meta.noindex) {
    if (!robotsEl) {
      robotsEl = document.createElement('meta');
      robotsEl.name = 'robots';
      document.head.appendChild(robotsEl);
    }
    robotsEl.content = 'noindex, nofollow';
  } else {
    robotsEl?.remove();
  }

  // 5. OG/Twitter tags: swap to generic branding for noindex pages
  updateOgTags(meta.noindex ?? false);

  // 6. Aria-live announcer (preserve existing behavior)
  const announcer = document.getElementById('route-announcer');
  if (announcer) {
    announcer.textContent = '';
    requestAnimationFrame(() => {
      announcer.textContent = meta.title;
    });
  }
}

/**
 * Swap OG and Twitter tag values between homepage branding and generic
 * branding. Noindex pages get generic values so no metadata leaks about
 * secret existence at a given URL.
 */
function updateOgTags(isNoindex: boolean): void {
  const ogTitle = document.querySelector<HTMLMetaElement>('meta[property="og:title"]');
  const ogDesc = document.querySelector<HTMLMetaElement>('meta[property="og:description"]');
  const ogUrl = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
  const twTitle = document.querySelector<HTMLMetaElement>('meta[name="twitter:title"]');
  const twDesc = document.querySelector<HTMLMetaElement>('meta[name="twitter:description"]');

  if (isNoindex) {
    // Generic branding -- no indication a secret exists at this URL
    if (ogTitle) ogTitle.content = 'SecureShare';
    if (ogDesc) ogDesc.content = 'Zero-knowledge secret sharing';
    if (ogUrl) ogUrl.content = `${window.location.origin}/`;
    if (twTitle) twTitle.content = 'SecureShare';
    if (twDesc) twDesc.content = 'Zero-knowledge secret sharing';
  } else {
    // Restore homepage OG values
    if (ogTitle) ogTitle.content = 'SecureShare - Zero-Knowledge Secret Sharing';
    if (ogDesc) ogDesc.content = 'End-to-end encrypted. One-time view. No accounts.';
    if (ogUrl) ogUrl.content = `${window.location.origin}/`;
    if (twTitle) twTitle.content = 'SecureShare - Zero-Knowledge Secret Sharing';
    if (twDesc) twDesc.content = 'End-to-end encrypted. One-time view. No accounts.';
  }
}

/**
 * Move focus to the page's h1 heading after render.
 *
 * Sets tabindex="-1" so the heading is programmatically focusable
 * without being added to the tab order, then calls .focus().
 */
export function focusPageHeading(): void {
  const h1 = document.querySelector('h1');
  if (h1) {
    h1.setAttribute('tabindex', '-1');
    h1.focus();
  }
}

/**
 * Internal route handler.
 * Matches the current pathname to a page module and renders it.
 */
function handleRoute(): void {
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  const container = document.getElementById('app')!;

  // Clear existing content
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  // Add page-enter animation (respects prefers-reduced-motion via motion-safe:)
  container.classList.remove('motion-safe:animate-fade-in-up');
  // Force reflow to restart animation on same-route navigations
  void container.offsetWidth;
  container.classList.add('motion-safe:animate-fade-in-up');

  if (path === '/') {
    updatePageMeta({
      title: 'Share a Secret',
      description:
        'Share secrets securely with zero-knowledge encryption. One-time view, no accounts, end-to-end encrypted in your browser.',
    });
    import('./pages/create.js')
      .then((mod) => mod.renderCreatePage(container))
      .then(() => focusPageHeading())
      .catch(() => showLoadError(container));
  } else if (path.startsWith('/secret/')) {
    updatePageMeta({
      title: "You've Received a Secret",
      description: 'Zero-knowledge secret sharing',
      noindex: true,
    });
    import('./pages/reveal.js')
      .then((mod) => mod.renderRevealPage(container))
      .then(() => focusPageHeading())
      .catch(() => showLoadError(container));
  } else if (path === '/login') {
    updatePageMeta({
      title: 'Sign In',
      description: 'Sign in to your SecureShare account.',
      noindex: true,
    });
    import('./pages/login.js')
      .then((mod) => mod.renderLoginPage(container))
      .then(() => focusPageHeading())
      .catch(() => showLoadError(container));
  } else if (path === '/register') {
    updatePageMeta({
      title: 'Create Account',
      description: 'Create a free SecureShare account.',
      noindex: true,
    });
    import('./pages/register.js')
      .then((mod) => mod.renderRegisterPage(container))
      .then(() => focusPageHeading())
      .catch(() => showLoadError(container));
  } else if (path === '/forgot-password') {
    updatePageMeta({
      title: 'Reset Password',
      description: 'Request a password reset for your SecureShare account.',
      noindex: true,
    });
    import('./pages/forgot-password.js')
      .then((mod) => mod.renderForgotPasswordPage(container))
      .then(() => focusPageHeading())
      .catch(() => showLoadError(container));
  } else if (path === '/reset-password') {
    updatePageMeta({
      title: 'Set New Password',
      description: 'Set a new password for your SecureShare account.',
      noindex: true,
    });
    import('./pages/reset-password.js')
      .then((mod) => mod.renderResetPasswordPage(container))
      .then(() => focusPageHeading())
      .catch(() => showLoadError(container));
  } else if (path === '/dashboard') {
    updatePageMeta({
      title: 'Dashboard',
      description: 'Your SecureShare dashboard.',
      noindex: true,
    });
    import('./pages/dashboard.js')
      .then((mod) => mod.renderDashboardPage(container))
      .then(() => focusPageHeading())
      .catch(() => showLoadError(container));
  } else {
    updatePageMeta({
      title: 'Page Not Found',
      description: 'Zero-knowledge secret sharing',
      noindex: true,
    });
    import('./pages/error.js')
      .then((mod) => mod.renderErrorPage(container, 'not_found'))
      .then(() => focusPageHeading())
      .catch(() => showLoadError(container));
  }

  // Capture SPA pageview (before_send in analytics module strips any URL fragment)
  capturePageview();
  // Notify layout shell (and any other listeners) of the route change.
  // Fires on every navigation: initial load, popstate, and programmatic.
  window.dispatchEvent(new CustomEvent('routechange', { detail: { path } }));
}

/**
 * Fallback error display when a page chunk fails to load.
 */
function showLoadError(container: HTMLElement): void {
  document.title = 'Error - SecureShare';
  container.textContent = 'Something went wrong. Please refresh the page.';
}

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

export type PageRenderer = (container: HTMLElement) => void | Promise<void>;

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
 * Update document.title and announce the new page title to screen readers.
 *
 * Uses a clear-then-set pattern with requestAnimationFrame to ensure
 * the aria-live region announces even when navigating to the same title
 * (e.g., pressing back then forward to the same page).
 *
 * @param title - The page title (without the " - SecureShare" suffix)
 */
export function updatePageMeta(title: string): void {
  document.title = `${title} - SecureShare`;

  const announcer = document.getElementById('route-announcer');
  if (announcer) {
    announcer.textContent = '';
    requestAnimationFrame(() => {
      announcer.textContent = title;
    });
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
  const path = window.location.pathname;
  const container = document.getElementById('app')!;

  // Clear existing content
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  if (path === '/') {
    updatePageMeta('Share a Secret');
    import('./pages/create.js')
      .then((mod) => mod.renderCreatePage(container))
      .then(() => focusPageHeading())
      .catch(() => showLoadError(container));
  } else if (path.startsWith('/secret/')) {
    updatePageMeta("You've Received a Secret");
    import('./pages/reveal.js')
      .then((mod) => mod.renderRevealPage(container))
      .then(() => focusPageHeading())
      .catch(() => showLoadError(container));
  } else {
    updatePageMeta('Page Not Found');
    import('./pages/error.js')
      .then((mod) => mod.renderErrorPage(container, 'not_found'))
      .then(() => focusPageHeading())
      .catch(() => showLoadError(container));
  }

  // Notify layout shell (and any other listeners) of the route change.
  // Fires on every navigation: initial load, popstate, and programmatic.
  window.dispatchEvent(
    new CustomEvent('routechange', { detail: { path } }),
  );
}

/**
 * Fallback error display when a page chunk fails to load.
 */
function showLoadError(container: HTMLElement): void {
  document.title = 'Error - SecureShare';
  container.textContent = 'Something went wrong. Please refresh the page.';
}

/**
 * Client-side SPA router using History API.
 *
 * Path-based routing with dynamic imports for code splitting.
 * Each page is a separate chunk loaded only when its route matches.
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
    import('./pages/create.js')
      .then((mod) => mod.renderCreatePage(container))
      .catch(() => showLoadError(container));
  } else if (path.startsWith('/secret/')) {
    import('./pages/reveal.js')
      .then((mod) => mod.renderRevealPage(container))
      .catch(() => showLoadError(container));
  } else {
    import('./pages/error.js')
      .then((mod) => mod.renderErrorPage(container, 'not_found'))
      .catch(() => showLoadError(container));
  }
}

/**
 * Fallback error display when a page chunk fails to load.
 */
function showLoadError(container: HTMLElement): void {
  container.textContent = 'Something went wrong. Please refresh the page.';
}

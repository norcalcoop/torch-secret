/**
 * Torch Secret application entry point.
 *
 * Initializes the layout shell (header, footer, dot-grid) then the
 * client-side router on DOM ready. Layout must init first so its
 * `routechange` listener is registered before the router dispatches.
 *
 * CSS is imported here so Vite includes it in the build.
 */

import './styles.css';
import { initAnalytics } from './analytics/posthog.js';
import { initThemeListener } from './theme.js';
import { createLayoutShell } from './components/layout.js';
import { initRouter } from './router.js';

document.addEventListener('DOMContentLoaded', () => {
  initAnalytics();
  initThemeListener();
  createLayoutShell();
  initRouter();
});

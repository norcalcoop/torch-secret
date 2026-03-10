/**
 * Torch Secret application entry point.
 *
 * Initializes the layout shell (header, footer, dot-grid) then the
 * client-side router on DOM ready. Layout must init first so its
 * `routechange` listener is registered before the router dispatches.
 *
 * CSS is imported here so Vite includes it in the build.
 *
 * Retro theme modules are dynamically imported inside a VITE_RETRO_ENABLED
 * guard. When that env var is unset (production default), Rollup dead-code-
 * eliminates the entire import block and all retro modules from the bundle.
 */

import './styles.css';
import { initAnalytics } from './analytics/posthog.js';
import { initThemeListener } from './theme.js';
import { createLayoutShell } from './components/layout.js';
import { initRouter } from './router.js';

document.addEventListener('DOMContentLoaded', () => {
  void (async () => {
    initAnalytics();
    initThemeListener();

    if (import.meta.env.VITE_RETRO_ENABLED === 'true') {
      const { initRetroThemeListener, getRetroTheme, applyRetroTheme } =
        await import('./retro-theme.js');
      initRetroThemeListener();
      const activeRetroTheme = getRetroTheme();
      if (activeRetroTheme) {
        applyRetroTheme(activeRetroTheme);
      }
    } else {
      // Clear any stale retro-theme key so no user loads with a retro-colored app
      localStorage.removeItem('retro-theme');
    }

    createLayoutShell();
    initRouter();
  })();
});

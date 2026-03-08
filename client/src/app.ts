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
import { initRetroThemeListener, getRetroTheme, applyRetroTheme } from './retro-theme.js';
import { createLayoutShell } from './components/layout.js';
import { initRouter } from './router.js';
import { RETRO_ENABLED } from './components/theme-toggle.js';

document.addEventListener('DOMContentLoaded', () => {
  initAnalytics();
  initThemeListener();
  if (RETRO_ENABLED) {
    initRetroThemeListener(); // Register cross-tab storage event listener (idempotent)
  }
  createLayoutShell();
  initRouter();

  if (RETRO_ENABLED) {
    // Restore active retro theme from localStorage on startup.
    // The FOWT script in index.html already applied the colors before JS loaded —
    // this call mounts the effects engine and font loader on top of those colors.
    const activeRetroTheme = getRetroTheme();
    if (activeRetroTheme) {
      applyRetroTheme(activeRetroTheme);
    }
  } else {
    // Clear any stale retro-theme key so no user loads with a retro-colored app
    localStorage.removeItem('retro-theme');
  }
});

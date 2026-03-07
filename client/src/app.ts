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

document.addEventListener('DOMContentLoaded', () => {
  initAnalytics();
  initThemeListener();
  initRetroThemeListener(); // Register cross-tab storage event listener (idempotent)
  createLayoutShell();
  initRouter();

  // Restore active retro theme from localStorage on startup.
  // The FOWT script in index.html already applied the colors before JS loaded —
  // this call mounts the effects engine and font loader on top of those colors.
  const activeRetroTheme = getRetroTheme();
  if (activeRetroTheme) {
    applyRetroTheme(activeRetroTheme);
  }
});

/**
 * SecureShare application entry point.
 *
 * Initializes the client-side router on DOM ready.
 * CSS is imported here so Vite includes it in the build.
 */

import './styles.css';
import { initRouter } from './router.js';

document.addEventListener('DOMContentLoaded', () => {
  initRouter();
});

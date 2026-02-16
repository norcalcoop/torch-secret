/**
 * Persistent layout shell: header, footer, and dot-grid background.
 *
 * Created once at DOMContentLoaded (before router init) and never
 * re-rendered. The header's "Create" nav link toggles visibility
 * via the `routechange` custom event dispatched by the router.
 *
 * DOM structure after initialization:
 *   <header id="site-header">  (inserted before <main>)
 *   <main id="main-content" class="dot-grid-bg flex-1 scroll-mt-16">
 *   <footer id="site-footer">  (inserted after <main>)
 */

import { Shield } from 'lucide';
import { createIcon } from './icons.js';
import { createThemeToggle } from './theme-toggle.js';
import { navigate } from '../router.js';

/**
 * Build and insert the persistent layout shell around <main>.
 *
 * Must be called before `initRouter()` so the header's routechange
 * listener is registered before the router dispatches its first event.
 */
export function createLayoutShell(): void {
  const main = document.getElementById('main-content');
  if (!main) return;

  // Insert header before <main>
  const header = createHeader();
  main.parentElement!.insertBefore(header, main);

  // Insert footer after <main>
  const footer = createFooter();
  main.parentElement!.insertBefore(footer, main.nextSibling);

  // Add dot-grid background and flex-1 for footer positioning to <main>
  main.classList.add('dot-grid-bg', 'flex-1', 'scroll-mt-16');
}

/**
 * Create the sticky glassmorphism header with brand mark and nav link.
 */
function createHeader(): HTMLElement {
  const header = document.createElement('header');
  header.id = 'site-header';
  header.className = 'sticky top-0 z-40 backdrop-blur-md bg-bg/80';

  const inner = document.createElement('div');
  inner.className =
    'max-w-2xl mx-auto px-4 h-14 flex items-center justify-between';

  // Brand mark: shield icon + "SecureShare" wordmark
  const brand = document.createElement('a');
  brand.href = '/';
  brand.className = 'flex items-center gap-2 text-text-primary no-underline';
  brand.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/');
  });

  const shieldIcon = createIcon(Shield, { size: 'sm', class: 'text-accent' });
  const wordmark = document.createElement('span');
  wordmark.className = 'font-heading font-semibold text-lg';
  wordmark.textContent = 'SecureShare';

  brand.appendChild(shieldIcon);
  brand.appendChild(wordmark);
  inner.appendChild(brand);

  // Right-side container: theme toggle + nav link
  const rightSide = document.createElement('div');
  rightSide.className = 'flex items-center gap-3';

  // Theme toggle button
  const themeToggle = createThemeToggle();
  rightSide.appendChild(themeToggle);

  // "Create" nav link (hidden on create page)
  const createLink = document.createElement('a');
  createLink.href = '/';
  createLink.id = 'nav-create-link';
  createLink.className =
    'text-sm text-text-secondary hover:text-accent transition-colors';
  createLink.textContent = 'Create';
  createLink.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/');
  });
  rightSide.appendChild(createLink);

  inner.appendChild(rightSide);

  header.appendChild(inner);

  // Route-aware visibility: toggle "Create" link based on pathname
  function updateCreateLink(): void {
    const isCreatePage = window.location.pathname === '/';
    createLink.classList.toggle('hidden', isCreatePage);
  }

  window.addEventListener('routechange', updateCreateLink);
  updateCreateLink(); // Initial check

  return header;
}

/**
 * Create the footer with trust signal spans.
 */
function createFooter(): HTMLElement {
  const footer = document.createElement('footer');
  footer.id = 'site-footer';
  footer.className = 'border-t border-border bg-bg py-6';

  const inner = document.createElement('div');
  inner.className =
    'max-w-2xl mx-auto px-4 flex flex-wrap justify-center gap-6 text-xs text-text-muted';

  const signals = [
    'Zero-knowledge encryption',
    'AES-256-GCM',
    'Open Source',
  ];

  for (const text of signals) {
    const span = document.createElement('span');
    span.textContent = text;
    inner.appendChild(span);
  }

  footer.appendChild(inner);
  return footer;
}

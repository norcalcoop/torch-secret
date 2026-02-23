/**
 * Persistent layout shell: header, footer, dot-grid background, and mobile tab bar.
 *
 * Created once at DOMContentLoaded (before router init) and never
 * re-rendered. The header's "Create a Secret" nav link toggles visibility
 * via the `routechange` custom event dispatched by the router. The mobile
 * bottom tab bar is mounted to document.body and highlights the active
 * tab on every routechange event.
 *
 * DOM structure after initialization:
 *   <header id="site-header">  (inserted before <main>)
 *   <main id="main-content" class="dot-grid-bg flex-1 scroll-mt-16">
 *   <footer id="site-footer">  (inserted after <main>)
 *   <nav id="mobile-tab-bar">  (appended to document.body — fixed position)
 */

import { Shield, Home, PenLine, CreditCard, LayoutDashboard } from 'lucide';
import { authClient } from '../api/auth-client.js';
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

  // Mobile bottom tab bar — mounted to body (fixed position, outside flex column)
  const mobileNav = createMobileNav();
  document.body.appendChild(mobileNav);

  // Bottom padding on #app to prevent mobile tab bar from clipping content
  const appEl = document.getElementById('app');
  if (appEl) {
    appEl.classList.add('pb-16', 'sm:pb-0');
  }
}

/**
 * Create the sticky glassmorphism header with brand mark and full nav.
 *
 * Right-side nav order (left to right): Pricing | Dashboard/Login | Create a Secret | ThemeToggle
 */
function createHeader(): HTMLElement {
  const header = document.createElement('header');
  header.id = 'site-header';
  header.className = 'sticky top-0 z-40 backdrop-blur-md bg-bg/80';

  const inner = document.createElement('div');
  inner.className = 'max-w-5xl mx-auto px-4 h-14 flex items-center justify-between';

  // Brand mark: shield icon + "Torch Secret" wordmark
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
  wordmark.textContent = 'Torch Secret';

  brand.appendChild(shieldIcon);
  brand.appendChild(wordmark);
  inner.appendChild(brand);

  // Right-side container: Pricing | Dashboard/Login | Create a Secret | ThemeToggle
  const rightSide = document.createElement('div');
  rightSide.className = 'flex items-center gap-4';

  // 1. Pricing link (desktop only — hidden on mobile where tab bar handles it)
  const pricingLink = document.createElement('a');
  pricingLink.href = '/pricing';
  pricingLink.className =
    'hidden sm:block text-sm text-text-secondary hover:text-accent transition-colors';
  pricingLink.textContent = 'Pricing';
  pricingLink.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/pricing');
  });
  rightSide.appendChild(pricingLink);

  // 2. Dashboard / Login link — swaps text+destination based on auth state
  const authLink = document.createElement('a');
  authLink.href = '/login';
  authLink.id = 'nav-auth-link';
  authLink.className =
    'hidden sm:block text-sm text-text-secondary hover:text-accent transition-colors';
  authLink.textContent = 'Login'; // safe default before session resolves
  authLink.addEventListener('click', (e) => {
    e.preventDefault();
    navigate(authLink.href);
  });
  rightSide.appendChild(authLink);

  // 3. "Create a Secret" CTA link — hidden on /create route, shown everywhere else
  const createLink = document.createElement('a');
  createLink.href = '/create';
  createLink.id = 'nav-create-link';
  createLink.className =
    'hidden sm:block text-sm px-3 py-1.5 rounded-lg bg-accent text-white font-medium hover:bg-accent/90 focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg focus:outline-hidden transition-colors';
  createLink.textContent = 'Create a Secret';
  createLink.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/create');
  });
  rightSide.appendChild(createLink);

  // 4. Theme toggle (rightmost)
  const themeToggle = createThemeToggle();
  rightSide.appendChild(themeToggle);

  inner.appendChild(rightSide);
  header.appendChild(inner);

  // Route-aware visibility: hide "Create a Secret" on /create page
  function updateCreateLink(): void {
    const isCreatePage = window.location.pathname === '/create';
    createLink.classList.toggle('hidden', isCreatePage);
    // Restore sm:block only when not hidden
    if (!isCreatePage) {
      createLink.classList.add('sm:block');
    } else {
      createLink.classList.remove('sm:block');
    }
  }

  // Auth-reactive: update Dashboard/Login link text and destination
  async function updateAuthLink(): Promise<void> {
    try {
      const result = await authClient.getSession();
      // Better Auth getSession() returns `any`; use a type guard per CLAUDE.md convention
      const isAuthenticated =
        result !== null &&
        typeof result === 'object' &&
        'data' in result &&
        result.data !== null &&
        typeof result.data === 'object' &&
        'session' in result.data &&
        (result.data as Record<string, unknown>)['session'] !== null;

      if (isAuthenticated) {
        authLink.textContent = 'Dashboard';
        authLink.href = '/dashboard';
        authLink.onclick = (e: MouseEvent) => {
          e.preventDefault();
          navigate('/dashboard');
        };
      } else {
        authLink.textContent = 'Login';
        authLink.href = '/login';
        authLink.onclick = (e: MouseEvent) => {
          e.preventDefault();
          navigate('/login');
        };
      }
    } catch {
      authLink.textContent = 'Login';
      authLink.href = '/login';
      authLink.onclick = (e: MouseEvent) => {
        e.preventDefault();
        navigate('/login');
      };
    }
  }

  window.addEventListener('routechange', updateCreateLink);
  window.addEventListener('routechange', () => {
    void updateAuthLink();
  });
  updateCreateLink(); // synchronous — runs immediately
  void updateAuthLink(); // async — fires and resolves without blocking render

  return header;
}

/**
 * Create the iOS-style fixed bottom tab bar for mobile viewports.
 *
 * Mounted to document.body (outside the flex column) so fixed positioning
 * works correctly. Hidden on sm+ breakpoints via sm:hidden.
 * Listens to the `routechange` event to highlight the active tab.
 */
function createMobileNav(): HTMLElement {
  const nav = document.createElement('nav');
  nav.id = 'mobile-tab-bar';
  nav.setAttribute('aria-label', 'Main navigation');
  nav.className =
    'fixed bottom-0 inset-x-0 z-40 sm:hidden border-t border-border bg-bg/95 backdrop-blur-md';
  nav.style.paddingBottom = 'env(safe-area-inset-bottom)';

  const inner = document.createElement('div');
  inner.className = 'flex items-center justify-around h-16';
  nav.appendChild(inner);

  const tabs = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: PenLine, label: 'Create', path: '/create' },
    { icon: CreditCard, label: 'Pricing', path: '/pricing' },
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  ] as const;

  const tabButtons: HTMLButtonElement[] = [];

  for (const tab of tabs) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', tab.label);
    btn.className =
      'flex flex-col items-center gap-0.5 min-w-[56px] py-2 text-text-muted hover:text-accent transition-colors';
    btn.dataset['path'] = tab.path;

    btn.appendChild(createIcon(tab.icon, { size: 'sm' }));

    const labelEl = document.createElement('span');
    labelEl.className = 'text-[10px] font-medium';
    labelEl.textContent = tab.label;
    btn.appendChild(labelEl);

    btn.addEventListener('click', () => {
      navigate(tab.path);
    });

    inner.appendChild(btn);
    tabButtons.push(btn);
  }

  function updateActiveTabs(): void {
    const currentPath = window.location.pathname;
    for (const btn of tabButtons) {
      const btnPath = btn.dataset['path'] ?? '';
      const isActive = btnPath === currentPath || (btnPath === '/' && currentPath === '/');
      // Visual active state: accent color for active, muted for inactive
      if (isActive) {
        btn.classList.remove('text-text-muted');
        btn.classList.add('text-accent');
      } else {
        btn.classList.add('text-text-muted');
        btn.classList.remove('text-accent');
      }
    }
  }

  window.addEventListener('routechange', updateActiveTabs);
  updateActiveTabs(); // initial state

  return nav;
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

  const signals = ['Zero-knowledge encryption', 'AES-256-GCM', 'Open Source'];

  for (const text of signals) {
    const span = document.createElement('span');
    span.textContent = text;
    inner.appendChild(span);
  }

  // Legal links
  const legalLinks = [
    { text: 'Privacy Policy', path: '/privacy' },
    { text: 'Terms of Service', path: '/terms' },
  ];

  for (const { text, path } of legalLinks) {
    const a = document.createElement('a');
    a.href = path;
    a.textContent = text;
    a.className = 'hover:text-text-secondary transition-colors underline-offset-2 hover:underline';
    a.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(path);
    });
    inner.appendChild(a);
  }

  footer.appendChild(inner);
  return footer;
}

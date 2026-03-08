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

import { Shield, Home, PenLine, CreditCard, LayoutDashboard, Github } from 'lucide';
import { authClient } from '../api/auth-client.js';
import { createIcon, createPixelIcon } from './icons.js';
import { createThemeDropdown } from './theme-toggle.js';
import { navigate } from '../router.js';
import { THEMES } from '../retro-data.js';

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
  footer.classList.add('mb-16', 'sm:mb-0'); // space for mobile tab bar
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

  let brandIcon: Element = createIcon(Shield, { size: 'sm', class: 'text-accent' });
  const wordmark = document.createElement('span');
  wordmark.className = 'font-heading font-semibold text-lg';
  wordmark.textContent = 'Torch Secret';

  brand.appendChild(brandIcon);
  brand.appendChild(wordmark);

  // Swap header brand icon when retro theme activates — use nav[4] (the theme's special icon)
  window.addEventListener('retrothemechange', (e: Event) => {
    const { themeId } = (e as CustomEvent<{ themeId: string | null }>).detail;
    const retroNav = themeId ? THEMES[themeId]?.nav[4] : null;
    const newIcon = retroNav
      ? createPixelIcon(retroNav.i, 16)
      : createIcon(Shield, { size: 'sm', class: 'text-accent' });
    brand.replaceChild(newIcon, brandIcon);
    brandIcon = newIcon;
  });
  inner.appendChild(brand);

  // Right-side container: Pricing | Dashboard/Login | Create a Secret | ThemeToggle
  const rightSide = document.createElement('div');
  rightSide.className = 'flex items-center gap-4';

  // 1a. Use Cases link (desktop only — SSR route, plain <a href>, no navigate())
  const useCasesLink = document.createElement('a');
  useCasesLink.href = '/use/';
  useCasesLink.className =
    'hidden sm:block text-sm text-text-secondary hover:text-accent transition-colors';
  useCasesLink.textContent = 'Use Cases';
  // NO navigate() handler — /use/ is an SSR route, not an SPA route
  rightSide.appendChild(useCasesLink);

  // 1b. Pricing link (desktop only — hidden on mobile where tab bar handles it)
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

  // 4. Theme dropdown (rightmost)
  const themeToggle = createThemeDropdown();
  rightSide.appendChild(themeToggle);

  inner.appendChild(rightSide);
  header.appendChild(inner);

  // Route-aware visibility: hide "Create a Secret" on /create page.
  // The link uses `hidden sm:block` as its base — hidden on mobile always (tab bar handles it),
  // visible on sm+ when NOT on /create. When on /create, we remove sm:block so hidden dominates
  // all breakpoints (media query wins only if sm:block is present).
  function updateCreateLink(): void {
    const isCreatePage = window.location.pathname === '/create';
    if (isCreatePage) {
      // Hide completely: remove sm:block so `hidden` dominates all viewports
      createLink.classList.remove('sm:block');
    } else {
      // Show on desktop only: sm:block overrides `hidden` on sm+ via media query
      createLink.classList.add('sm:block');
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
      } else {
        authLink.textContent = 'Login';
        authLink.href = '/login';
      }
    } catch {
      authLink.textContent = 'Login';
      authLink.href = '/login';
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

  // Lucide icon data for each tab (used when reverting from retro theme)
  const LUCIDE_TAB_ICONS = [Home, PenLine, CreditCard, LayoutDashboard] as const;

  window.addEventListener('retrothemechange', (e: Event) => {
    const { themeId } = (e as CustomEvent<{ themeId: string | null }>).detail;
    const theme = themeId ? THEMES[themeId] : null;

    tabButtons.forEach((btn, i) => {
      // Remove existing icon (first child element)
      const existingIcon = btn.firstElementChild;
      if (existingIcon) existingIcon.remove();

      const navEntry = theme?.nav[i]; // use nav[0..3] only — nav has 5 entries, we have 4 tabs
      const newIcon = navEntry
        ? createPixelIcon(navEntry.i, 16)
        : createIcon(LUCIDE_TAB_ICONS[i], { size: 'sm' });

      btn.insertBefore(newIcon, btn.firstChild);

      // Update label text — truncate to 10 chars to prevent overflow
      const labelEl = btn.querySelector('span');
      if (labelEl) {
        labelEl.textContent = navEntry ? navEntry.l.substring(0, 10) : tabs[i].label;
      }
    });
  });

  return nav;
}

/**
 * Email capture section for the footer.
 *
 * GDPR-compliant: consent checkbox is required and unchecked by default.
 * On success, the form is replaced with a confirmation message.
 * POSTs to /api/subscribers — same endpoint as the old homepage form.
 */
function createEmailCaptureSection(): HTMLElement {
  const section = document.createElement('section');
  section.setAttribute('aria-labelledby', 'email-capture-heading');
  section.className = 'max-w-2xl mx-auto px-4 py-6 space-y-4';

  const heading = document.createElement('h2');
  heading.id = 'email-capture-heading';
  heading.className = 'text-sm font-semibold text-text-primary text-center';
  heading.textContent = 'Stay in the loop';
  section.appendChild(heading);

  const subtext = document.createElement('p');
  subtext.className = 'text-xs text-text-muted text-center';
  subtext.textContent = 'Join our early access list. No spam, unsubscribe any time.';
  section.appendChild(subtext);

  const form = document.createElement('form');
  form.noValidate = true;
  form.className = 'space-y-3';

  const emailRow = document.createElement('div');
  emailRow.className = 'flex gap-2 items-start';

  const emailInput = document.createElement('input');
  emailInput.type = 'email';
  emailInput.id = 'footer-email-capture';
  emailInput.name = 'email';
  emailInput.placeholder = 'you@example.com';
  emailInput.required = true;
  emailInput.autocomplete = 'email';
  emailInput.className =
    'flex-1 px-3 py-2 min-h-[44px] border border-border rounded-lg bg-bg text-text-primary ' +
    'placeholder:text-text-muted focus:outline-hidden focus:ring-2 focus:ring-accent text-sm';

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className =
    'px-4 py-2 min-h-[44px] rounded-lg bg-accent text-white font-medium text-sm ' +
    'hover:bg-accent-hover focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg ' +
    'focus:outline-hidden transition-colors whitespace-nowrap cursor-pointer';
  submitBtn.textContent = 'Join the list';

  emailRow.appendChild(emailInput);
  emailRow.appendChild(submitBtn);
  form.appendChild(emailRow);

  const errorEl = document.createElement('p');
  errorEl.setAttribute('role', 'alert');
  errorEl.className = 'text-xs text-danger hidden';
  form.appendChild(errorEl);

  const consentRow = document.createElement('div');
  consentRow.className = 'flex items-start gap-3';

  const consentCheckbox = document.createElement('input');
  consentCheckbox.type = 'checkbox';
  consentCheckbox.id = 'footer-email-consent';
  consentCheckbox.name = 'consent';
  consentCheckbox.required = true;
  consentCheckbox.checked = false;
  consentCheckbox.className = 'mt-0.5 h-4 w-4 rounded border-border accent-accent cursor-pointer';

  const consentLabel = document.createElement('label');
  consentLabel.htmlFor = 'footer-email-consent';
  consentLabel.className = 'text-xs text-text-muted cursor-pointer leading-relaxed';

  const consentText = document.createTextNode(
    'I agree to receive product updates and marketing emails from Torch Secret. ' +
      'You can unsubscribe at any time. See our ',
  );
  const privacyLink = document.createElement('a');
  privacyLink.href = '/privacy';
  privacyLink.className =
    'underline hover:text-text-secondary focus:outline-hidden focus:ring-2 focus:ring-accent rounded';
  privacyLink.textContent = 'Privacy Policy';
  privacyLink.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/privacy');
  });
  consentLabel.appendChild(consentText);
  consentLabel.appendChild(privacyLink);
  consentLabel.appendChild(document.createTextNode('.'));

  consentRow.appendChild(consentCheckbox);
  consentRow.appendChild(consentLabel);
  form.appendChild(consentRow);

  async function handleSubmit(): Promise<void> {
    const email = (emailInput.value ?? '').trim();
    errorEl.classList.add('hidden');
    errorEl.textContent = '';

    if (!email) {
      errorEl.textContent = 'Please enter your email address.';
      errorEl.classList.remove('hidden');
      emailInput.focus();
      return;
    }
    if (!consentCheckbox.checked) {
      errorEl.textContent = 'Please check the consent box to continue.';
      errorEl.classList.remove('hidden');
      consentCheckbox.focus();
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Joining...';

    try {
      const res = await fetch('/api/subscribers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, consent: true }),
      });
      if (res.ok) {
        while (section.firstChild) section.removeChild(section.firstChild);
        const successHeading = document.createElement('p');
        successHeading.className = 'text-sm font-semibold text-text-primary text-center';
        successHeading.textContent = 'Check your inbox';
        const successMsg = document.createElement('p');
        successMsg.className = 'text-xs text-text-muted text-center';
        successMsg.textContent = `We sent a confirmation link to ${email}. Click it to join the list.`;
        section.appendChild(successHeading);
        section.appendChild(successMsg);
      } else {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Join the list';
        errorEl.textContent = 'Something went wrong. Please try again.';
        errorEl.classList.remove('hidden');
      }
    } catch {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Join the list';
      errorEl.textContent = 'Something went wrong. Please try again.';
      errorEl.classList.remove('hidden');
    }
  }

  form.addEventListener('submit', (e: Event) => {
    e.preventDefault();
    void handleSubmit();
  });

  section.appendChild(form);
  return section;
}

/**
 * Create the footer with email capture, trust signals, and internal links.
 */
function createFooter(): HTMLElement {
  const footer = document.createElement('footer');
  footer.id = 'site-footer';
  footer.className = 'border-t border-border bg-bg py-6';

  const inner = document.createElement('div');
  inner.className =
    'max-w-2xl mx-auto px-4 flex flex-wrap justify-center gap-6 text-xs text-text-muted';

  // Trust signals: plain spans except "Open Source" which links to GitHub (QW6)
  const plainSignals = ['Zero-knowledge encryption', 'AES-256-GCM'];
  for (const text of plainSignals) {
    const span = document.createElement('span');
    span.textContent = text;
    inner.appendChild(span);
  }

  // QW6 — Open Source as anchor linking to GitHub repo
  const openSourceLink = document.createElement('a');
  openSourceLink.href = 'https://github.com/norcalcoop/torch-secret';
  openSourceLink.target = '_blank';
  openSourceLink.rel = 'noopener noreferrer';
  openSourceLink.className = 'flex items-center gap-1 hover:text-text-secondary transition-colors';
  openSourceLink.appendChild(createIcon(Github, { size: 'sm', class: 'flex-shrink-0' }));
  const osText = document.createElement('span');
  osText.textContent = 'Open Source';
  openSourceLink.appendChild(osText);
  inner.appendChild(openSourceLink);

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

  // S4 — Internal links to /use/ and /vs/ SSR pages (plain <a href> — no navigate())
  const linkRow = document.createElement('div');
  linkRow.className = 'flex flex-wrap justify-center gap-4 text-xs text-text-muted mt-2 w-full';

  const internalLinks = [
    { text: 'Share API Keys', href: '/use/share-api-keys' },
    { text: 'Share DB Credentials', href: '/use/share-database-credentials' },
    { text: 'Send Passwords Safely', href: '/use/send-password-without-email' },
    { text: 'vs. OneTimeSecret', href: '/vs/onetimesecret' },
    { text: 'vs. Bitwarden Send', href: '/vs/bitwarden-send' },
  ];

  for (const { text, href } of internalLinks) {
    const a = document.createElement('a');
    a.href = href;
    a.textContent = text;
    a.className = 'hover:text-text-secondary transition-colors';
    // Plain <a href> — /use/* and /vs/* are SSR routes, NOT SPA routes
    linkRow.appendChild(a);
  }

  // Append link row to the footer wrapper (inside footer element, after inner)
  const linkRowWrapper = document.createElement('div');
  linkRowWrapper.className = 'w-full flex justify-center';
  linkRowWrapper.appendChild(linkRow);

  footer.appendChild(createEmailCaptureSection());
  footer.appendChild(inner);
  footer.appendChild(linkRowWrapper);
  return footer;
}

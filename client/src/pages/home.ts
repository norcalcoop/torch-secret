/**
 * Marketing homepage page module.
 *
 * Four sections rendered in order:
 *   1. Hero — headline, subhead, CTA to /create
 *   2. Trust strip — zero-knowledge proof points (AES-256-GCM, ZK, one-time view)
 *   3. Security Architecture — 3-column explainer (Client-Side Encryption, One-Time Destruction, ZK Proof)
 *   4. Use Cases — three glassmorphism cards with job-aware scenarios and /use/ links
 *
 * Follows the vanilla TS DOM-construction pattern used throughout the codebase.
 * No DOM-unsafe APIs. No third-party UI frameworks. Semantic design tokens throughout.
 */

import { KeyRound, Flame, StickyNote, ShieldCheck, Lock, Zap, Shield } from 'lucide';
import { createIcon } from '../components/icons.js';
import { navigate } from '../router.js';

/**
 * Render the marketing homepage into the given container.
 *
 * @param container - The #app container element from the router
 */
export function renderHomePage(container: HTMLElement): void {
  const wrapper = document.createElement('div');
  wrapper.className = 'space-y-12 pb-20 sm:pb-8';

  wrapper.appendChild(createHeroSection());
  wrapper.appendChild(createTrustStrip());
  wrapper.appendChild(createSecurityArchSection());
  wrapper.appendChild(createUseCasesSection());

  container.appendChild(wrapper);
}

// ---------------------------------------------------------------------------
// Section builders
// ---------------------------------------------------------------------------

/**
 * Hero section: H1 headline, subhead, and primary CTA button.
 */
function createHeroSection(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'py-12 sm:py-16 text-center space-y-6';

  // H1 — QW1: two-line block spans for zero-knowledge value prop
  const heading = document.createElement('h1');
  heading.className =
    'text-3xl sm:text-4xl font-heading font-semibold text-text-primary leading-tight';
  const line1 = document.createElement('span');
  line1.className = 'block';
  line1.textContent = "We can't read your secrets.";
  const line2 = document.createElement('span');
  line2.className = 'block';
  line2.textContent = 'Not even under subpoena.';
  heading.appendChild(line1);
  heading.appendChild(line2);
  section.appendChild(heading);

  // Subhead — QW1: zero-knowledge framing
  const subhead = document.createElement('p');
  subhead.className = 'text-lg text-text-secondary max-w-md mx-auto leading-relaxed';
  subhead.textContent =
    'Zero-knowledge secret sharing — your encryption key never leaves your browser.';
  section.appendChild(subhead);

  // CTA button
  const cta = document.createElement('a');
  cta.href = '/create';
  cta.className =
    'inline-flex items-center gap-2 px-6 py-3 min-h-[44px] rounded-lg bg-accent text-white font-semibold ' +
    'hover:bg-accent-hover focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg ' +
    'focus:outline-hidden transition-all motion-safe:hover:scale-[1.02] cursor-pointer';
  cta.textContent = 'Create a Secret';
  cta.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/create');
  });
  section.appendChild(cta);

  return section;
}

/**
 * Trust strip: three zero-knowledge proof points with icons.
 */
function createTrustStrip(): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'p-4 rounded-lg border border-border bg-surface/50 backdrop-blur-sm';

  const inner = document.createElement('div');
  inner.className = 'flex flex-wrap justify-center gap-6';
  wrapper.appendChild(inner);

  const proofPoints: Array<{ icon: Parameters<typeof createIcon>[0]; label: string }> = [
    { icon: Lock, label: 'AES-256-GCM Encryption' },
    { icon: ShieldCheck, label: 'Zero-Knowledge — server never sees plaintext' },
    { icon: Zap, label: 'Self-Destructs After One View' },
  ];

  for (const point of proofPoints) {
    const item = document.createElement('div');
    item.className = 'flex items-center gap-2 text-sm text-text-muted';

    const icon = createIcon(point.icon, { size: 'sm', class: 'text-accent flex-shrink-0' });
    const label = document.createElement('span');
    label.textContent = point.label;

    item.appendChild(icon);
    item.appendChild(label);
    inner.appendChild(item);
  }

  return wrapper;
}

/**
 * Security Architecture section: 3-column explainer — S2 audit item.
 *
 * Placed between the trust strip and use cases section.
 * Three columns: Client-Side Encryption, One-Time Destruction, Zero-Knowledge Proof.
 */
function createSecurityArchSection(): HTMLElement {
  const section = document.createElement('section');
  section.setAttribute('aria-labelledby', 'security-arch-heading');

  const heading = document.createElement('h2');
  heading.id = 'security-arch-heading';
  heading.className = 'text-xl font-heading font-semibold text-text-primary text-center mb-6';
  heading.textContent = 'How the security works';
  section.appendChild(heading);

  const container = document.createElement('div');
  container.className = 'max-w-3xl mx-auto';
  section.appendChild(container);

  const grid = document.createElement('div');
  grid.className = 'grid grid-cols-1 sm:grid-cols-3 gap-4';
  container.appendChild(grid);

  const columns: Array<{
    icon: Parameters<typeof createIcon>[0];
    title: string;
    body: string;
  }> = [
    {
      icon: Lock,
      title: 'Client-Side Encryption',
      body: 'Encrypted in your browser before leaving your device. The server receives only ciphertext.',
    },
    {
      icon: Flame,
      title: 'One-Time Destruction',
      body: 'Secret destroyed after the first view. Always.',
    },
    {
      icon: Shield,
      title: 'Zero-Knowledge Proof',
      body: 'Even a full server breach reveals nothing. The key never left your browser.',
    },
  ];

  for (const col of columns) {
    const card = document.createElement('div');
    card.className =
      'bg-surface/60 backdrop-blur border border-border/40 rounded-xl p-6 space-y-2 text-center';

    const iconWrapper = document.createElement('div');
    iconWrapper.className =
      'w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center mx-auto';
    iconWrapper.setAttribute('aria-hidden', 'true');
    iconWrapper.appendChild(createIcon(col.icon, { size: 'sm', class: 'text-accent' }));
    card.appendChild(iconWrapper);

    const colHeading = document.createElement('h3');
    colHeading.className = 'font-medium text-text-primary';
    colHeading.textContent = col.title;
    card.appendChild(colHeading);

    const colBody = document.createElement('p');
    colBody.className = 'text-sm text-text-secondary leading-relaxed';
    colBody.textContent = col.body;
    card.appendChild(colBody);

    grid.appendChild(card);
  }

  return section;
}

/**
 * Use Cases section: three glassmorphism cards with job-aware scenarios.
 */
function createUseCasesSection(): HTMLElement {
  const section = document.createElement('section');
  section.setAttribute('aria-labelledby', 'use-cases-heading');

  const heading = document.createElement('h2');
  heading.id = 'use-cases-heading';
  heading.className = 'text-xl font-heading font-semibold text-text-primary text-center mb-6';
  heading.textContent = 'Built for every team';
  section.appendChild(heading);

  const grid = document.createElement('div');
  grid.className = 'grid grid-cols-1 sm:grid-cols-3 gap-4';
  section.appendChild(grid);

  const cards: Array<{
    icon: Parameters<typeof createIcon>[0];
    title: string;
    scenario: string;
    description: string;
    useLink?: string;
  }> = [
    {
      icon: KeyRound,
      title: 'Passwords',
      scenario: 'Sharing a database password',
      description: 'Send credentials to a teammate once. No Slack DMs, no email trails.',
      useLink: '/use/share-database-credentials',
    },
    {
      icon: Flame,
      title: 'API Keys',
      scenario: 'Handing off an API key',
      description:
        "Share a token that disappears the moment it's read. Audit-friendly and zero-trace.",
      useLink: '/use/share-api-keys',
    },
    {
      icon: StickyNote,
      title: 'Sensitive Notes',
      scenario: 'Confidential information',
      description:
        "Legal docs, SSNs, or anything you'd rather not have sitting in an inbox forever.",
    },
  ];

  for (const card of cards) {
    grid.appendChild(createUseCaseCard(card));
  }

  return section;
}

/**
 * Build a single use-case glassmorphism card.
 * If `useLink` is provided, wraps the title in a plain <a href> (SSR route — no navigate()).
 */
function createUseCaseCard(card: {
  icon: Parameters<typeof createIcon>[0];
  title: string;
  scenario: string;
  description: string;
  useLink?: string;
}): HTMLElement {
  const el = document.createElement('div');
  el.className =
    'p-6 rounded-lg border border-border bg-surface/80 backdrop-blur-md shadow-lg space-y-3';

  // Icon wrapper
  const iconWrapper = document.createElement('div');
  iconWrapper.className = 'w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center';
  iconWrapper.setAttribute('aria-hidden', 'true');
  const icon = createIcon(card.icon, { size: 'sm', class: 'text-accent' });
  iconWrapper.appendChild(icon);
  el.appendChild(iconWrapper);

  // Title — wrap in <a href> for /use/ SSR routes when link is provided
  const title = document.createElement('h3');
  title.className = 'font-medium text-text-primary';
  if (card.useLink) {
    const link = document.createElement('a');
    link.href = card.useLink;
    link.className =
      'hover:text-accent transition-colors focus:outline-hidden focus:ring-2 focus:ring-accent rounded';
    link.textContent = card.title;
    // Plain <a href> — no navigate() — /use/* routes are SSR (not SPA)
    title.appendChild(link);
  } else {
    title.textContent = card.title;
  }
  el.appendChild(title);

  // Scenario label
  const scenario = document.createElement('p');
  scenario.className = 'text-xs text-text-muted font-mono';
  scenario.textContent = card.scenario;
  el.appendChild(scenario);

  // Description
  const desc = document.createElement('p');
  desc.className = 'text-sm text-text-secondary leading-relaxed';
  desc.textContent = card.description;
  el.appendChild(desc);

  return el;
}

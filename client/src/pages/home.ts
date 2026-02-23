/**
 * Marketing homepage page module.
 *
 * Three sections rendered in order:
 *   1. Hero — headline, subhead, CTA to /create
 *   2. Trust strip — zero-knowledge proof points (AES-256-GCM, ZK, one-time view)
 *   3. Use Cases — three glassmorphism cards with job-aware scenarios
 *   4. Email Capture — GDPR-compliant form (backend wired in Phase 36)
 *
 * Follows the vanilla TS DOM-construction pattern used throughout the codebase.
 * No innerHTML. No third-party UI frameworks. Semantic design tokens throughout.
 */

import { KeyRound, Flame, StickyNote, ShieldCheck, Lock, Zap } from 'lucide';
import { createIcon } from '../components/icons.js';
import { navigate } from '../router.js';
import { showToast } from '../components/toast.js';

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
  wrapper.appendChild(createUseCasesSection());
  wrapper.appendChild(createEmailCaptureSection());

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

  // H1
  const heading = document.createElement('h1');
  heading.className =
    'text-3xl sm:text-4xl font-heading font-semibold text-text-primary leading-tight';
  heading.textContent = 'Share sensitive info in seconds';
  section.appendChild(heading);

  // Subhead
  const subhead = document.createElement('p');
  subhead.className = 'text-lg text-text-secondary max-w-md mx-auto leading-relaxed';
  subhead.textContent = 'No account needed. End-to-end encrypted. Self-destructs after one view.';
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
  }> = [
    {
      icon: KeyRound,
      title: 'Passwords',
      scenario: 'Sharing a database password',
      description: 'Send credentials to a teammate once. No Slack DMs, no email trails.',
    },
    {
      icon: Flame,
      title: 'API Keys',
      scenario: 'Handing off an API key',
      description:
        "Share a token that disappears the moment it's read. Audit-friendly and zero-trace.",
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
 */
function createUseCaseCard(card: {
  icon: Parameters<typeof createIcon>[0];
  title: string;
  scenario: string;
  description: string;
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

  // Title
  const title = document.createElement('h3');
  title.className = 'font-medium text-text-primary';
  title.textContent = card.title;
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

// ---------------------------------------------------------------------------
// Email capture section
// ---------------------------------------------------------------------------

/**
 * Email capture section: GDPR-compliant form with toast on success.
 *
 * Backend wiring deferred to Phase 36. For now, valid submissions show a
 * toast and reset the form — data is silently dropped.
 *
 * GDPR invariants:
 *   - Consent checkbox is unchecked by default (hard requirement)
 *   - Consent is explicitly re-checked in the submit handler (noValidate = true)
 *   - Inline error shown for unchecked consent (not just blocked)
 */
function createEmailCaptureSection(): HTMLElement {
  const section = document.createElement('section');
  section.setAttribute('aria-labelledby', 'email-capture-heading');
  section.className =
    'p-6 rounded-lg border border-border bg-surface/80 backdrop-blur-md shadow-lg space-y-4';

  // Heading
  const heading = document.createElement('h2');
  heading.id = 'email-capture-heading';
  heading.className = 'text-xl font-heading font-semibold text-text-primary';
  heading.textContent = 'Stay in the loop';
  section.appendChild(heading);

  // Subtext
  const subtext = document.createElement('p');
  subtext.className = 'text-sm text-text-secondary';
  subtext.textContent = 'Join our early access list. No spam, unsubscribe any time.';
  section.appendChild(subtext);

  // Form
  const form = document.createElement('form');
  form.noValidate = true;
  form.className = 'space-y-3';

  // Email input row
  const emailRow = document.createElement('div');
  emailRow.className = 'flex gap-2 items-start';

  const emailInput = document.createElement('input');
  emailInput.type = 'email';
  emailInput.id = 'email-capture';
  emailInput.name = 'email';
  emailInput.placeholder = 'you@example.com';
  emailInput.required = true;
  emailInput.autocomplete = 'email';
  emailInput.className =
    'flex-1 px-3 py-2 min-h-[44px] border border-border rounded-lg bg-bg text-text-primary ' +
    'placeholder:text-text-muted focus:outline-hidden focus:ring-2 focus:ring-accent';

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className =
    'px-4 py-2 min-h-[44px] rounded-lg bg-accent text-white font-medium ' +
    'hover:bg-accent-hover focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg ' +
    'focus:outline-hidden transition-colors whitespace-nowrap cursor-pointer';
  submitBtn.textContent = 'Notify Me';

  emailRow.appendChild(emailInput);
  emailRow.appendChild(submitBtn);
  form.appendChild(emailRow);

  // Inline error element
  const errorEl = document.createElement('p');
  errorEl.id = 'email-error';
  errorEl.setAttribute('role', 'alert');
  errorEl.className = 'text-sm text-danger hidden';
  form.appendChild(errorEl);

  // GDPR consent row
  const consentRow = document.createElement('div');
  consentRow.className = 'flex items-start gap-3';

  const consentCheckbox = document.createElement('input');
  consentCheckbox.type = 'checkbox';
  consentCheckbox.id = 'email-consent';
  consentCheckbox.name = 'consent';
  consentCheckbox.required = true;
  consentCheckbox.checked = false; // GDPR: must be unchecked by default
  consentCheckbox.className = 'mt-0.5 h-4 w-4 rounded border-border accent-accent cursor-pointer';

  const consentLabel = document.createElement('label');
  consentLabel.htmlFor = 'email-consent';
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
  const periodText = document.createTextNode('.');

  consentLabel.appendChild(consentText);
  consentLabel.appendChild(privacyLink);
  consentLabel.appendChild(periodText);

  consentRow.appendChild(consentCheckbox);
  consentRow.appendChild(consentLabel);
  form.appendChild(consentRow);

  // Submit handler — validate email + consent; show toast on success; Phase 36 wires backend
  form.addEventListener('submit', (e: Event) => {
    e.preventDefault();
    const email = (emailInput.value ?? '').trim();

    // Clear previous error
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

    // Phase 36 wires the backend. For now: show success and reset.
    showToast("You're on the list! We'll be in touch.");
    form.reset();
  });

  section.appendChild(form);
  return section;
}

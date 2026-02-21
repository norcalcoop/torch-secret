/**
 * Create secret page.
 *
 * Renders the complete secret creation form: textarea with character counter,
 * expiration selector, auto-generated EFF diceware passphrase section (Phase 24),
 * and submit button that encrypts in the browser and posts to the API.
 *
 * After successful creation, renders the confirmation page in the same container
 * (state-based transition, not URL-based).
 *
 * Progressive enhancement: for authenticated users, an optional collapsible
 * "Add label" field is appended after the form renders (non-blocking async auth
 * check). Anonymous users see no label field -- it is absent from the DOM.
 *
 * Phase 24: The "Advanced options" password field has been replaced with an
 * auto-generated EFF diceware passphrase displayed in a monospace block with
 * Regenerate and Copy buttons. Every secret is now password-protected by default.
 */

import { encrypt, generatePassphrase } from '../crypto/index.js';
import { createSecret } from '../api/client.js';
import { authClient } from '../api/auth-client.js';
import { captureSecretCreated } from '../analytics/posthog.js';
import { createExpirationSelect } from '../components/expiration-select.js';
import { createCopyButton } from '../components/copy-button.js';
import { renderConfirmationPage } from './confirmation.js';
import {
  ClipboardPaste,
  LockKeyhole,
  Share2,
  Flame,
  EyeOff,
  Code,
  UserX,
  ShieldCheck,
  RefreshCw,
} from 'lucide';
import { createIcon } from '../components/icons.js';

const MAX_LENGTH = 10_000;

/**
 * Shape of a Better Auth session user.
 * Typed explicitly to avoid unsafe `any` member access on the library return value.
 */
interface SessionUser {
  name?: string | null;
  email: string;
}

/**
 * Shape of the session object returned by getSession().
 */
interface Session {
  user: SessionUser;
}

/**
 * Type guard: verify that a value matches the Session shape.
 */
function isSession(value: unknown): value is Session {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (typeof obj['user'] !== 'object' || obj['user'] === null) return false;
  const user = obj['user'] as Record<string, unknown>;
  return typeof user['email'] === 'string';
}

/**
 * Creates the collapsible label field for authenticated users.
 * Uses details/summary pattern.
 */
function createLabelField(): HTMLElement {
  const details = document.createElement('details');
  details.className = 'border border-border rounded-lg bg-surface/80 backdrop-blur-md';

  const summary = document.createElement('summary');
  summary.className =
    'px-4 py-3 min-h-[44px] text-sm font-medium text-text-tertiary cursor-pointer select-none focus:ring-2 focus:ring-accent focus:outline-hidden rounded-lg';
  summary.textContent = 'Add label';

  const content = document.createElement('div');
  content.className = 'px-4 pb-4 space-y-1';

  const label = document.createElement('label');
  label.htmlFor = 'secret-label';
  label.className = 'block text-sm font-medium text-text-secondary';
  label.textContent = 'Label';

  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'secret-label';
  input.name = 'secret-label';
  input.placeholder = 'e.g. "AWS keys for staging"';
  input.maxLength = 100;
  input.className =
    'w-full px-3 py-2 min-h-[44px] border border-border rounded-lg bg-surface text-text-primary placeholder-text-muted focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg focus:outline-hidden';

  const hint = document.createElement('p');
  hint.className = 'text-xs text-text-muted mt-1';
  hint.textContent = 'Only visible to you in your dashboard.';

  content.appendChild(label);
  content.appendChild(input);
  content.appendChild(hint);
  details.appendChild(summary);
  details.appendChild(content);
  return details;
}

/**
 * Render the create page into the given container.
 *
 * Returns void synchronously -- the auth check for progressive label enhancement
 * runs as a fire-and-forget IIFE (void async pattern) after the form is painted.
 * PageRenderer in router.ts accepts void | Promise<void> so this is compatible.
 */
export function renderCreatePage(container: HTMLElement): void {
  // -- Passphrase state (Phase 24) --
  // Initialized on mount; updated on each Regenerate click.
  // Always synced with hidden passwordInput.value.
  let currentPassphrase = generatePassphrase();

  // -- Page wrapper --
  const wrapper = document.createElement('div');
  wrapper.className = 'space-y-6';

  // -- Header --
  const header = document.createElement('header');
  header.className = 'text-center space-y-2';

  const heading = document.createElement('h1');
  heading.className = 'text-2xl sm:text-3xl font-heading font-semibold text-text-primary';
  heading.textContent = 'Share a Secret';

  const subtext = document.createElement('p');
  subtext.className = 'text-text-muted';
  subtext.textContent = 'End-to-end encrypted. One-time view. No accounts.';

  header.appendChild(heading);
  header.appendChild(subtext);
  wrapper.appendChild(header);

  // -- Form --
  const form = document.createElement('form');
  form.className = 'space-y-6';
  form.noValidate = true;

  // -- Textarea section --
  const textareaGroup = document.createElement('div');
  textareaGroup.className = 'space-y-1';

  const textareaLabel = document.createElement('label');
  textareaLabel.htmlFor = 'secret-text';
  textareaLabel.className = 'block text-sm font-medium text-text-secondary';
  textareaLabel.textContent = 'Your secret';

  const textarea = document.createElement('textarea');
  textarea.id = 'secret-text';
  textarea.maxLength = MAX_LENGTH;
  textarea.placeholder = 'Paste your secret here...';
  textarea.rows = 6;
  textarea.required = true;
  textarea.className =
    'w-full px-3 py-2 border border-border rounded-lg bg-surface text-text-primary placeholder-text-muted focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg focus:outline-hidden resize-y';

  const counter = document.createElement('div');
  counter.className = 'text-right text-sm text-text-muted';
  counter.textContent = `0 / ${MAX_LENGTH.toLocaleString()}`;

  // -- Encryption indicator (visible when textarea has content) --
  const indicator = document.createElement('div');
  indicator.className = 'hidden flex items-center gap-1.5 text-xs text-text-muted mt-1';
  const lockIcon = createIcon(LockKeyhole, { size: 'sm', class: 'text-success' });
  const indicatorLabel = document.createElement('span');
  indicatorLabel.textContent = 'Encrypted in your browser';
  indicator.appendChild(lockIcon);
  indicator.appendChild(indicatorLabel);

  textarea.addEventListener('input', () => {
    const len = textarea.value.length;
    counter.textContent = `${len.toLocaleString()} / ${MAX_LENGTH.toLocaleString()}`;
    if (len >= MAX_LENGTH) {
      counter.classList.add('text-danger');
    } else {
      counter.classList.remove('text-danger');
    }
    indicator.classList.toggle('hidden', !textarea.value.length);
  });

  textareaGroup.appendChild(textareaLabel);
  textareaGroup.appendChild(textarea);
  textareaGroup.appendChild(counter);
  textareaGroup.appendChild(indicator);
  form.appendChild(textareaGroup);

  // -- Expiration section --
  const expirationGroup = document.createElement('div');
  expirationGroup.className = 'space-y-1';

  const expirationLabel = document.createElement('label');
  expirationLabel.htmlFor = 'expiration';
  expirationLabel.className = 'block text-sm font-medium text-text-secondary';
  expirationLabel.textContent = 'Expires after';

  const expirationSelect = createExpirationSelect();

  expirationGroup.appendChild(expirationLabel);
  expirationGroup.appendChild(expirationSelect);
  form.appendChild(expirationGroup);

  // -- Passphrase section (Phase 24) --
  // The "Advanced options" password field has been replaced with an auto-generated
  // EFF diceware passphrase. Every secret is now password-protected by default.
  // PASS-02 invariant: Regenerate ONLY updates currentPassphrase, passphraseDisplay,
  // and passwordInput. It NEVER touches textarea, expirationSelect, or labelInput.
  const passphraseGroup = document.createElement('div');
  passphraseGroup.className = 'space-y-2';

  const passphraseSectionLabel = document.createElement('label');
  passphraseSectionLabel.htmlFor = 'passphrase-display';
  passphraseSectionLabel.className = 'block text-sm font-medium text-text-secondary';
  passphraseSectionLabel.textContent = 'Access passphrase';

  const passphraseDisplay = document.createElement('div');
  passphraseDisplay.id = 'passphrase-display';
  passphraseDisplay.className =
    'w-full px-3 py-3 rounded-lg bg-surface-raised text-text-primary font-mono text-sm select-all border border-border';
  passphraseDisplay.setAttribute('aria-live', 'polite');
  passphraseDisplay.setAttribute('aria-label', 'Generated passphrase');
  passphraseDisplay.textContent = currentPassphrase; // textContent only — never innerHTML

  const passphraseHint = document.createElement('p');
  passphraseHint.className = 'text-xs text-text-muted';
  passphraseHint.textContent =
    'Auto-generated passphrase. Recipients will need this to view your secret.';

  // Button row: Regenerate + Copy
  const passphraseButtonRow = document.createElement('div');
  passphraseButtonRow.className = 'flex items-center gap-3 flex-wrap';

  // Regenerate button
  const regenerateBtn = document.createElement('button');
  regenerateBtn.type = 'button';
  regenerateBtn.className =
    'inline-flex items-center gap-2 px-3 py-2 min-h-[44px] rounded-lg border border-border bg-surface text-text-secondary text-sm hover:bg-surface-raised hover:text-text-primary focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg focus:outline-hidden transition-colors cursor-pointer';
  regenerateBtn.setAttribute('aria-label', 'Generate a new passphrase');
  const regenIcon = createIcon(RefreshCw, { size: 'sm' });
  const regenLabel = document.createElement('span');
  regenLabel.textContent = 'New passphrase';
  regenerateBtn.appendChild(regenIcon);
  regenerateBtn.appendChild(regenLabel);

  // Copy passphrase button
  const copyPassphraseBtn = createCopyButton(() => currentPassphrase, 'Copy');

  // Regenerate click handler
  // CRITICAL: ONLY update currentPassphrase, passphraseDisplay, and passwordInput.
  // NEVER touch textarea.value, expirationSelect.value, or labelInput — PASS-02 invariant.
  regenerateBtn.addEventListener('click', () => {
    currentPassphrase = generatePassphrase();
    passphraseDisplay.textContent = currentPassphrase;
    passwordInput.value = currentPassphrase;
  });

  passphraseButtonRow.appendChild(regenerateBtn);
  passphraseButtonRow.appendChild(copyPassphraseBtn);

  passphraseGroup.appendChild(passphraseSectionLabel);
  passphraseGroup.appendChild(passphraseDisplay);
  passphraseGroup.appendChild(passphraseHint);
  passphraseGroup.appendChild(passphraseButtonRow);
  form.appendChild(passphraseGroup);

  // -- Hidden password input (synced with currentPassphrase at all times) --
  // Replaces the old visible password input from "Advanced options".
  // The submit handler reads passwordInput.value — always set to currentPassphrase.
  const passwordInput = document.createElement('input');
  passwordInput.type = 'hidden';
  passwordInput.value = currentPassphrase; // Sync on init
  form.appendChild(passwordInput);

  // -- Error display area --
  const errorArea = document.createElement('div');
  errorArea.className = 'hidden px-4 py-3 rounded-lg bg-danger/10 text-danger text-sm';
  errorArea.setAttribute('role', 'alert');
  form.appendChild(errorArea);

  // -- Submit button --
  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.className =
    'w-full min-h-[44px] py-3 rounded-lg bg-accent text-white font-semibold hover:bg-accent-hover focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg focus:outline-hidden transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.98]';
  submitButton.textContent = 'Create Secure Link';
  form.appendChild(submitButton);

  // -- Label field reference (set async by progressive enhancement below) --
  let labelInput: HTMLInputElement | null = null;

  // -- Submit handler --
  form.addEventListener('submit', (e) => {
    void (async () => {
      e.preventDefault();

      // Hide previous errors
      errorArea.classList.add('hidden');
      errorArea.textContent = '';

      // Validate non-empty
      const text = textarea.value.trim();
      if (!text) {
        showError(errorArea, 'Please enter a secret to share.');
        return;
      }

      // Get expiration
      const expiresIn = expirationSelect.value as '1h' | '24h' | '7d' | '30d';

      // Get password (always the current passphrase — never undefined after Phase 24)
      const password = passwordInput.value || undefined;

      // Get optional label (only present for authenticated users)
      const label = labelInput?.value.trim() || undefined;

      // Disable form during submission
      submitButton.disabled = true;
      textarea.disabled = true;
      expirationSelect.disabled = true;
      if (labelInput) {
        labelInput.disabled = true;
      }

      try {
        // Step 1: Encrypt in the browser
        submitButton.textContent = 'Encrypting...';
        const result = await encrypt(text);

        // Step 2: Send to API (include optional fields only if provided)
        submitButton.textContent = 'Sending...';
        const response = await createSecret(result.payload.ciphertext, expiresIn, password, label);

        // Step 3: Build share URL with key in fragment
        const shareUrl = `${window.location.origin}/secret/${response.id}#${result.keyBase64Url}`;

        // Step 4: Render confirmation page (state-based, not URL-based)
        // currentPassphrase is passed as the fifth argument (Phase 24)
        renderConfirmationPage(container, shareUrl, response.expiresAt, label, currentPassphrase);
        captureSecretCreated(expiresIn, !!password);
      } catch (err) {
        // Restore form state
        submitButton.disabled = false;
        textarea.disabled = false;
        expirationSelect.disabled = false;
        if (labelInput) {
          labelInput.disabled = false;
        }
        submitButton.textContent = 'Create Secure Link';

        const message =
          err instanceof Error ? err.message : 'Something went wrong. Please try again.';
        showError(errorArea, message);
      }
    })();
  });

  wrapper.appendChild(form);

  // Render the page immediately (anonymous user experience is unchanged)
  wrapper.appendChild(createHowItWorksSection());
  wrapper.appendChild(createWhyTrustUsSection());
  container.appendChild(wrapper);

  // Progressive enhancement: add label field if authenticated (non-blocking)
  // This runs after the form is in the DOM so anonymous users see no delay.
  void (async () => {
    try {
      const result = await authClient.getSession();
      // result.data is typed as `any` by better-auth's fully-generic client;
      // assign to unknown before type-narrowing to avoid no-unsafe-assignment.
      const data: unknown = result.data as unknown;
      if (isSession(data)) {
        const labelField = createLabelField();
        // Insert label field before the error area (stable anchor regardless of Advanced options removal)
        form.insertBefore(labelField, errorArea);
        labelInput = labelField.querySelector('#secret-label') as HTMLInputElement;
      }
    } catch {
      // Auth check failure: label field simply not shown (silent degradation)
    }
  })();
}

/**
 * Display an error message in the error area.
 */
function showError(errorArea: HTMLElement, message: string): void {
  errorArea.textContent = message;
  errorArea.classList.remove('hidden');
}

/**
 * Build the "How It Works" trust section with 4 icon-based steps.
 *
 * Steps: Paste, Encrypt, Share, Destroy -- each with a Lucide icon in an
 * accent-tinted circle. Placed below the form to build user confidence.
 */
function createHowItWorksSection(): HTMLElement {
  const section = document.createElement('section');
  section.setAttribute('aria-labelledby', 'how-it-works-heading');
  section.className = 'mt-12 pt-8 border-t border-border';

  const heading = document.createElement('h2');
  heading.id = 'how-it-works-heading';
  heading.className =
    'text-xl sm:text-2xl font-heading font-semibold text-text-primary text-center mb-8';
  heading.textContent = 'How It Works';
  section.appendChild(heading);

  const grid = document.createElement('div');
  grid.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6';

  const steps = [
    {
      icon: ClipboardPaste,
      title: 'Paste',
      description:
        'Type or paste your secret into the form. It never leaves your browser unencrypted.',
    },
    {
      icon: LockKeyhole,
      title: 'Encrypt',
      description:
        'AES-256-GCM encryption happens entirely in your browser. The key stays with you.',
    },
    {
      icon: Share2,
      title: 'Share',
      description:
        'Send the generated link to your recipient. The encryption key is embedded in the URL fragment.',
    },
    {
      icon: Flame,
      title: 'Destroy',
      description:
        'After one view, the encrypted data is permanently deleted from our servers. No traces remain.',
    },
  ];

  for (const step of steps) {
    const card = document.createElement('div');
    card.className = 'text-center space-y-2';

    const iconContainer = document.createElement('div');
    iconContainer.className =
      'w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto';
    iconContainer.appendChild(createIcon(step.icon, { size: 'lg', class: 'text-accent' }));
    iconContainer.setAttribute('aria-hidden', 'true');

    const title = document.createElement('h3');
    title.className = 'font-semibold text-text-primary';
    title.textContent = step.title;

    const description = document.createElement('p');
    description.className = 'text-sm text-text-tertiary leading-relaxed';
    description.textContent = step.description;

    card.appendChild(iconContainer);
    card.appendChild(title);
    card.appendChild(description);
    grid.appendChild(card);
  }

  const glassContainer = document.createElement('div');
  glassContainer.className =
    'p-6 rounded-lg border border-border bg-surface/80 backdrop-blur-md shadow-lg';
  glassContainer.appendChild(grid);
  section.appendChild(glassContainer);
  return section;
}

/**
 * Build the "Why Trust Us?" section with a 4-card grid.
 *
 * Cards: Zero Knowledge, Open Source, No Accounts, AES-256-GCM.
 * Each card displays a Lucide icon, label heading, and brief description.
 */
function createWhyTrustUsSection(): HTMLElement {
  const section = document.createElement('section');
  section.setAttribute('aria-labelledby', 'why-trust-us-heading');
  section.className = 'mt-8';

  const heading = document.createElement('h2');
  heading.id = 'why-trust-us-heading';
  heading.className =
    'text-xl sm:text-2xl font-heading font-semibold text-text-primary text-center mb-8';
  heading.textContent = 'Why Trust Us?';
  section.appendChild(heading);

  const grid = document.createElement('div');
  grid.className = 'grid grid-cols-1 sm:grid-cols-2 gap-4';

  const cards = [
    {
      icon: EyeOff,
      label: 'Zero Knowledge',
      description:
        'Your secrets are encrypted before reaching our servers. We never see your data.',
    },
    {
      icon: Code,
      label: 'Open Source',
      description: 'Our code is publicly auditable. Verify the security claims yourself.',
    },
    {
      icon: UserX,
      label: 'No Accounts',
      description: 'No sign-up, no email, no tracking. Just share and go.',
    },
    {
      icon: ShieldCheck,
      label: 'AES-256-GCM',
      description:
        'Military-grade authenticated encryption. The same standard used by governments worldwide.',
    },
  ];

  for (const card of cards) {
    const cardEl = document.createElement('div');
    cardEl.className =
      'p-4 rounded-lg border border-border bg-surface/80 backdrop-blur-md shadow-lg space-y-2';

    const iconEl = createIcon(card.icon, { size: 'md', class: 'text-accent' });

    const label = document.createElement('h3');
    label.className = 'font-semibold text-text-primary text-sm';
    label.textContent = card.label;

    const desc = document.createElement('p');
    desc.className = 'text-xs text-text-tertiary leading-relaxed';
    desc.textContent = card.description;

    cardEl.appendChild(iconEl);
    cardEl.appendChild(label);
    cardEl.appendChild(desc);
    grid.appendChild(cardEl);
  }

  section.appendChild(grid);
  return section;
}

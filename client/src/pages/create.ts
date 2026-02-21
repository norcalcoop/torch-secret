/**
 * Create secret page.
 *
 * Renders the complete secret creation form: textarea with character counter,
 * expiration selector, optional collapsible protection panel (Phase 28), and
 * submit button that encrypts in the browser and posts to the API.
 *
 * After successful creation, renders the confirmation page in the same container
 * (state-based transition, not URL-based).
 *
 * Progressive enhancement: for authenticated users, an optional collapsible
 * "Add label" field is appended after the form renders (non-blocking async auth
 * check). Anonymous users see no label field -- it is absent from the DOM.
 * Additionally, a per-secret notification toggle ('Email me when this secret is
 * viewed') is injected for authenticated users -- off by default.
 *
 * Phase 28: protection is opt-in via 4 radio options (No protection / Generate
 * password / Custom password / Passphrase). When "No protection" is selected
 * (default), no password is sent to the API. "Generate password" mode shows a
 * full 1Password/Bitwarden-style generator: tier selector (Low/Medium/High/Max),
 * charset checkboxes (Uppercase/Numbers/Symbols), filter checkboxes (Easy to
 * say/Easy to read/Omit similar), entropy + brute-force estimate, Regenerate,
 * Copy, and "Use this password" to commit. "Custom password" mode shows a simple
 * masked input with eye toggle. "Passphrase" mode shows the auto-generated EFF
 * diceware passphrase in a masked input with eye toggle, Regenerate, and Copy.
 */

import { encrypt, generatePassphrase, generatePassword } from '../crypto/index.js';
import { createSecret, ApiError } from '../api/client.js';
import { authClient } from '../api/auth-client.js';
import {
  captureSecretCreated,
  captureConversionPromptShown,
  captureConversionPromptClicked,
} from '../analytics/posthog.js';
import {
  createExpirationSelect,
  type ExpirationSelectResult,
} from '../components/expiration-select.js';
import { createCopyButton } from '../components/copy-button.js';
import { renderConfirmationPage } from './confirmation.js';
import { navigate } from '../router.js';
import {
  ClipboardPaste,
  LockKeyhole,
  Share2,
  Flame,
  Eye,
  EyeOff,
  Code,
  UserX,
  ShieldCheck,
  Dices,
  Copy,
  Check,
} from 'lucide';
import { createIcon } from '../components/icons.js';
import { showToast } from '../components/toast.js';

const MAX_LENGTH = 10_000;

// Session-scoped anonymous creation counter.
// Triggers conversion prompts at count 1 (after 1st secret) and count 3.
// Resets on full page refresh — same lifecycle as the dismissed state.
let anonymousSecretCount = 0;

// Session-level auth flag: set to true when auth IIFE resolves a valid session.
// Authenticated users never see conversion prompts on the confirmation page.
let isAuthenticated = false;

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
 * Creates the email notification checkbox for authenticated users.
 * Only injected into the DOM for logged-in users (progressive enhancement).
 * Returns element and a getValue() accessor bound to the checkbox state.
 */
function createNotifyToggle(): { element: HTMLElement; getValue: () => boolean } {
  const wrapper = document.createElement('div');
  wrapper.className =
    'flex items-center gap-3 border border-border rounded-lg bg-surface/80 backdrop-blur-md px-4 py-3';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.id = 'notify-on-view';
  checkbox.name = 'notify-on-view';
  checkbox.className = 'w-4 h-4 accent-accent cursor-pointer';

  const label = document.createElement('label');
  label.htmlFor = 'notify-on-view';
  label.className = 'text-sm text-text-secondary cursor-pointer select-none';
  label.textContent = 'Email me when this secret is viewed';

  wrapper.appendChild(checkbox);
  wrapper.appendChild(label);

  return { element: wrapper, getValue: () => checkbox.checked };
}

/**
 * Show an inline rate-limit upsell card when POST /api/secrets returns 429.
 *
 * Replaces generic red error text with a branded, informational card that
 * shows the reset countdown, benefit line, and 'Sign up — it's free' CTA.
 * Fires captureConversionPromptShown('rate_limit') after rendering.
 *
 * @param container - The error area element to convert to the upsell card.
 * @param resetTimestamp - Delta in seconds (time remaining) from RateLimit-Reset draft-6 header.
 */
function showRateLimitUpsell(container: HTMLElement, resetTimestamp: number | undefined): void {
  container.classList.remove('hidden');
  // Clear any previous content
  while (container.firstChild) container.removeChild(container.firstChild);

  // Replace danger styling with neutral/informational styling
  container.className = 'px-4 py-4 rounded-lg border border-border bg-surface/80 text-sm space-y-3';
  container.setAttribute('role', 'alert');

  const headline = document.createElement('p');
  headline.className = 'font-semibold text-text-primary';
  headline.textContent = "You've reached the free limit for anonymous sharing.";
  container.appendChild(headline);

  if (resetTimestamp && resetTimestamp > 0) {
    const minutesUntilReset = Math.ceil(resetTimestamp / 60);
    const resetText =
      minutesUntilReset > 0
        ? `Limit resets in ${minutesUntilReset} minute${minutesUntilReset === 1 ? '' : 's'}.`
        : 'Limit resets soon.';
    const resetLine = document.createElement('p');
    resetLine.className = 'text-text-secondary';
    resetLine.textContent = resetText;
    container.appendChild(resetLine);
  }

  const benefitLine = document.createElement('p');
  benefitLine.className = 'text-text-secondary';
  benefitLine.textContent = 'Create a free account for 20 secrets/day and up to 7-day expiration.';
  container.appendChild(benefitLine);

  const cta = document.createElement('a');
  cta.href = '/register';
  cta.className =
    'inline-block min-h-[36px] px-4 py-1.5 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-hover focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg focus:outline-hidden transition-all cursor-pointer';
  cta.textContent = "Sign up \u2014 it's free";
  cta.addEventListener('click', (e) => {
    e.preventDefault();
    captureConversionPromptClicked('rate_limit');
    navigate('/register');
  });
  container.appendChild(cta);

  captureConversionPromptShown('rate_limit');
}

// ---------------------------------------------------------------------------
// Protection panel
// ---------------------------------------------------------------------------

/**
 * Creates the protection panel with 4 radio options:
 *   1. No protection (default)
 *   2. Generate password — full 1Password-style generator UI
 *   3. Custom password — masked text input with eye toggle
 *   4. Passphrase — EFF diceware passphrase with masked input, eye toggle
 *
 * Returns the panel element and two accessors:
 *   - getPassword(): string | undefined — the value to send to the API
 *   - getPassphrase(): string | undefined — the passphrase to display on the
 *     confirmation card (only truthy when passphrase mode is active)
 *
 * Phase 28 (refactored per UAT feedback): 4 radio options replace the
 * collapsible panel + segmented control.
 */
function createProtectionPanel(): {
  element: HTMLElement;
  getPassword: () => string | undefined;
  getPassphrase: () => string | undefined;
} {
  // ---- Closure state ----
  type ProtectionMode = 'none' | 'generate' | 'custom' | 'passphrase';
  let protectionMode: ProtectionMode = 'none';
  let currentPassphrase: string = generatePassphrase();
  let appliedPassword: string = ''; // the APPLIED password (after "Use this password" clicked)
  let previewPassword: string = ''; // the PREVIEW from the generator (not yet applied)

  type PasswordTierLocal = 'low' | 'medium' | 'high' | 'max';
  let activeTier: PasswordTierLocal = 'high';

  // ---- Helper: create a labelled checkbox ----
  function createCheckbox(
    id: string,
    labelText: string,
    checked: boolean,
  ): { element: HTMLElement; input: HTMLInputElement } {
    const wrapper = document.createElement('div');
    wrapper.className = 'flex items-center gap-2';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = id;
    checkbox.checked = checked;
    checkbox.className = 'w-4 h-4 accent-accent cursor-pointer';
    const label = document.createElement('label');
    label.htmlFor = id;
    label.className = 'text-sm text-text-secondary cursor-pointer select-none';
    label.textContent = labelText;
    wrapper.appendChild(checkbox);
    wrapper.appendChild(label);
    return { element: wrapper, input: checkbox };
  }

  // ---- Root container ----
  const root = document.createElement('div');
  root.className = 'border border-border rounded-lg bg-surface/80 backdrop-blur-md overflow-hidden';

  // ---- Fieldset with 4 radio options ----
  const fieldset = document.createElement('fieldset');
  fieldset.className = 'divide-y divide-white/5 border-0 p-0 m-0';

  const legend = document.createElement('legend');
  legend.className = 'sr-only';
  legend.textContent = 'Protection mode';
  fieldset.appendChild(legend);

  // Radio option definitions
  const options: Array<{ value: ProtectionMode; label: string; sub: string }> = [
    { value: 'none', label: 'No protection', sub: 'Fastest sharing' },
    { value: 'generate', label: 'Generate password', sub: 'Secure random password with options' },
    { value: 'custom', label: 'Custom password', sub: 'Type your own password' },
    { value: 'passphrase', label: 'Passphrase', sub: 'Memorable EFF diceware phrase' },
  ];

  const radioInputs: Record<ProtectionMode, HTMLInputElement> = {} as Record<
    ProtectionMode,
    HTMLInputElement
  >;

  for (const opt of options) {
    const labelEl = document.createElement('label');
    labelEl.className =
      'flex items-center gap-3 px-4 py-3 cursor-pointer border-l-2 border-transparent select-none hover:bg-white/[0.03] has-[input:checked]:border-accent has-[input:checked]:bg-white/5 transition-colors';

    const radioInput = document.createElement('input');
    radioInput.type = 'radio';
    radioInput.name = 'protection-mode';
    radioInput.value = opt.value;
    radioInput.className = 'sr-only';
    if (opt.value === 'none') radioInput.checked = true;
    radioInputs[opt.value] = radioInput;

    const radioDot = document.createElement('span');
    radioDot.setAttribute('aria-hidden', 'true');
    radioDot.className =
      'w-4 h-4 rounded-full border border-white/30 flex-shrink-0 flex items-center justify-center';

    const optionText = document.createElement('span');
    optionText.className = 'flex flex-col';

    const optionLabel = document.createElement('span');
    optionLabel.className =
      'font-mono text-sm font-medium text-[color-mix(in_oklch,white_90%,transparent)]';
    optionLabel.textContent = opt.label;

    const optionSub = document.createElement('span');
    optionSub.className =
      'font-mono text-xs text-[color-mix(in_oklch,white_40%,transparent)] mt-0.5 block';
    optionSub.textContent = opt.sub;

    optionText.appendChild(optionLabel);
    optionText.appendChild(optionSub);
    labelEl.appendChild(radioInput);
    labelEl.appendChild(radioDot);
    labelEl.appendChild(optionText);
    fieldset.appendChild(labelEl);
  }

  root.appendChild(fieldset);

  // ---- Sub-panels container (sits below fieldset, separated by thin rule) ----
  const subPanelsContainer = document.createElement('div');
  subPanelsContainer.className = 'border-t border-white/10';
  root.appendChild(subPanelsContainer);

  // ---- Generate password section ----
  const generateSection = document.createElement('div');
  generateSection.className = 'hidden px-4 py-4 space-y-4';
  subPanelsContainer.appendChild(generateSection);

  // a) Preview row
  const previewRow = document.createElement('div');
  previewRow.className = 'space-y-1';
  generateSection.appendChild(previewRow);

  const previewLabel = document.createElement('p');
  previewLabel.className = 'text-xs text-text-muted';
  previewLabel.textContent = 'Generated password';
  previewRow.appendChild(previewLabel);

  const previewContainer = document.createElement('div');
  previewContainer.className = 'relative';
  previewRow.appendChild(previewContainer);

  const previewField = document.createElement('div');
  previewField.setAttribute('role', 'status');
  previewField.setAttribute('aria-live', 'polite');
  previewField.setAttribute('aria-label', 'Generated password');
  previewField.className =
    'w-full px-3 py-2 pr-10 min-h-[44px] border border-border rounded-lg bg-surface/60 text-text-primary font-mono text-sm flex items-center break-all';
  previewField.addEventListener('click', () => {
    const selection = window.getSelection();
    if (selection && previewField.firstChild) {
      const range = document.createRange();
      range.selectNodeContents(previewField);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  });
  previewContainer.appendChild(previewField);

  // Copy preview button (absolutely positioned inside container)
  const copyPreviewBtn = document.createElement('button');
  copyPreviewBtn.type = 'button';
  copyPreviewBtn.setAttribute('aria-label', 'Copy generated password');
  copyPreviewBtn.className =
    'absolute inset-y-0 right-0 flex items-center px-3 text-text-muted hover:text-text-secondary focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset focus:outline-none rounded-r-lg transition-colors cursor-pointer';
  const copyPreviewIconSpan = document.createElement('span');
  copyPreviewIconSpan.className = 'inline-flex';
  copyPreviewIconSpan.appendChild(createIcon(Copy, { size: 'sm', class: 'pointer-events-none' }));
  copyPreviewBtn.appendChild(copyPreviewIconSpan);
  copyPreviewBtn.addEventListener('click', () => {
    if (!previewPassword) return;
    void (async () => {
      try {
        await navigator.clipboard.writeText(previewPassword);
        showToast('Copied to clipboard');
        // Flash check icon
        while (copyPreviewIconSpan.firstChild)
          copyPreviewIconSpan.removeChild(copyPreviewIconSpan.firstChild);
        copyPreviewIconSpan.appendChild(
          createIcon(Check, { size: 'sm', class: 'pointer-events-none' }),
        );
        setTimeout(() => {
          while (copyPreviewIconSpan.firstChild)
            copyPreviewIconSpan.removeChild(copyPreviewIconSpan.firstChild);
          copyPreviewIconSpan.appendChild(
            createIcon(Copy, { size: 'sm', class: 'pointer-events-none' }),
          );
        }, 1500);
      } catch {
        showToast('Failed to copy');
      }
    })();
  });
  previewContainer.appendChild(copyPreviewBtn);

  // Entropy/brute force line
  const entropyLine = document.createElement('p');
  entropyLine.className = 'text-xs text-text-muted';
  entropyLine.setAttribute('aria-live', 'polite');
  previewRow.appendChild(entropyLine);

  // b) Tier selector
  const tierRow = document.createElement('div');
  tierRow.className = 'space-y-1';
  generateSection.appendChild(tierRow);

  const tierLabel = document.createElement('p');
  tierLabel.className = 'text-xs font-medium text-text-secondary';
  tierLabel.textContent = 'Strength';
  tierRow.appendChild(tierLabel);

  const tierControl = document.createElement('div');
  tierControl.setAttribute('role', 'group');
  tierControl.setAttribute('aria-label', 'Password strength');
  tierControl.className = 'flex gap-1 p-1 rounded-lg bg-surface-raised border border-border';
  tierRow.appendChild(tierControl);

  const tierActiveCls =
    'flex-1 px-2 py-1.5 min-h-[32px] rounded-md bg-accent text-white text-xs font-semibold transition-colors cursor-pointer';
  const tierInactiveCls =
    'flex-1 px-2 py-1.5 min-h-[32px] rounded-md text-text-secondary text-xs hover:text-text-primary transition-colors cursor-pointer';

  const tierButtons: Record<PasswordTierLocal, HTMLButtonElement> = {
    low: document.createElement('button'),
    medium: document.createElement('button'),
    high: document.createElement('button'),
    max: document.createElement('button'),
  };

  const tierNames: PasswordTierLocal[] = ['low', 'medium', 'high', 'max'];
  const tierLabels: Record<PasswordTierLocal, string> = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    max: 'Max',
  };

  for (const tier of tierNames) {
    const btn = tierButtons[tier];
    btn.type = 'button';
    btn.textContent = tierLabels[tier];
    btn.className = tier === 'high' ? tierActiveCls : tierInactiveCls;
    btn.setAttribute('aria-pressed', tier === 'high' ? 'true' : 'false');
    tierControl.appendChild(btn);
  }

  // c) Charset checkboxes
  const charsetRow = document.createElement('div');
  charsetRow.className = 'space-y-1';
  generateSection.appendChild(charsetRow);

  const charsetLabel = document.createElement('p');
  charsetLabel.className = 'text-xs font-medium text-text-secondary';
  charsetLabel.textContent = 'Character set';
  charsetRow.appendChild(charsetLabel);

  const charsetBoxes = document.createElement('div');
  charsetBoxes.className = 'flex flex-wrap gap-x-6 gap-y-2';
  charsetRow.appendChild(charsetBoxes);

  const uppercaseCb = createCheckbox('gen-uppercase', 'Uppercase', true); // high tier default
  const numbersCb = createCheckbox('gen-numbers', 'Numbers', true);
  const symbolsCb = createCheckbox('gen-symbols', 'Symbols', true);
  charsetBoxes.appendChild(uppercaseCb.element);
  charsetBoxes.appendChild(numbersCb.element);
  charsetBoxes.appendChild(symbolsCb.element);

  // d) Filter checkboxes
  const filterRow = document.createElement('div');
  filterRow.className = 'space-y-1';
  generateSection.appendChild(filterRow);

  const filterLabel = document.createElement('p');
  filterLabel.className = 'text-xs font-medium text-text-secondary';
  filterLabel.textContent = 'Filters';
  filterRow.appendChild(filterLabel);

  const filterBoxes = document.createElement('div');
  filterBoxes.className = 'flex flex-wrap gap-x-6 gap-y-2';
  filterRow.appendChild(filterBoxes);

  const easyToSayCb = createCheckbox('gen-easy-to-say', 'Easy to say', false);
  const easyToReadCb = createCheckbox('gen-easy-to-read', 'Easy to read', false);
  const omitSimilarCb = createCheckbox('gen-omit-similar', 'Omit similar', false);
  filterBoxes.appendChild(easyToSayCb.element);
  filterBoxes.appendChild(easyToReadCb.element);
  filterBoxes.appendChild(omitSimilarCb.element);

  // e) Error line
  const genError = document.createElement('p');
  genError.className = 'hidden text-xs text-danger';
  genError.setAttribute('role', 'alert');
  genError.id = 'gen-error';
  genError.textContent =
    'These filter settings are incompatible \u2014 please adjust your settings.';
  generateSection.appendChild(genError);

  // f) Action row
  const passwordActionRow = document.createElement('div');
  passwordActionRow.className = 'flex items-center justify-between gap-3 flex-wrap';
  generateSection.appendChild(passwordActionRow);

  const regenerateBtn = document.createElement('button');
  regenerateBtn.type = 'button';
  regenerateBtn.setAttribute('aria-label', 'Generate a new password');
  regenerateBtn.className =
    'inline-flex items-center gap-2 px-3 py-2 min-h-[44px] rounded-lg border border-border bg-surface text-text-secondary text-sm hover:bg-surface-raised hover:text-text-primary focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg focus:outline-hidden transition-colors cursor-pointer';
  regenerateBtn.appendChild(createIcon(Dices, { size: 'sm' }));
  const regenLabelSpan = document.createElement('span');
  regenLabelSpan.textContent = 'Regenerate';
  regenerateBtn.appendChild(regenLabelSpan);
  passwordActionRow.appendChild(regenerateBtn);

  const usePasswordBtn = document.createElement('button');
  usePasswordBtn.type = 'button';
  usePasswordBtn.className =
    'inline-flex items-center gap-2 px-3 py-2 min-h-[44px] rounded-lg border border-border bg-surface text-text-secondary text-sm hover:bg-surface-raised hover:text-text-primary focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg focus:outline-hidden transition-colors cursor-pointer';
  usePasswordBtn.appendChild(createIcon(Check, { size: 'sm' }));
  const usePasswordLabel = document.createElement('span');
  usePasswordLabel.textContent = 'Use this password';
  usePasswordBtn.appendChild(usePasswordLabel);
  passwordActionRow.appendChild(usePasswordBtn);

  // g) Applied password field (hidden until "Use this password" clicked)
  const appliedPasswordGroup = document.createElement('div');
  appliedPasswordGroup.className = 'hidden space-y-1';
  generateSection.appendChild(appliedPasswordGroup);

  const appliedPasswordLabel = document.createElement('label');
  appliedPasswordLabel.htmlFor = 'applied-password';
  appliedPasswordLabel.className = 'block text-sm font-medium text-text-secondary';
  appliedPasswordLabel.textContent = 'Password';
  appliedPasswordGroup.appendChild(appliedPasswordLabel);

  const appliedPasswordWrapper = document.createElement('div');
  appliedPasswordWrapper.className = 'relative';
  appliedPasswordGroup.appendChild(appliedPasswordWrapper);

  const appliedPasswordInput = document.createElement('input');
  appliedPasswordInput.type = 'password';
  appliedPasswordInput.id = 'applied-password';
  appliedPasswordInput.readOnly = true;
  appliedPasswordInput.className =
    'w-full px-3 py-2 pr-10 min-h-[44px] border border-border rounded-lg bg-surface text-text-primary placeholder-text-muted focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg focus:outline-hidden font-mono text-sm';
  appliedPasswordWrapper.appendChild(appliedPasswordInput);

  const appliedRevealToggle = document.createElement('button');
  appliedRevealToggle.type = 'button';
  appliedRevealToggle.setAttribute('aria-label', 'Show password');
  appliedRevealToggle.className =
    'absolute inset-y-0 right-0 flex items-center px-3 text-text-muted hover:text-text-secondary focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset focus:outline-none rounded-r-lg transition-colors cursor-pointer';
  const appliedEyeEl = createIcon(Eye, { size: 'sm', class: 'pointer-events-none' });
  const appliedEyeOffEl = createIcon(EyeOff, {
    size: 'sm',
    class: 'pointer-events-none hidden',
  });
  appliedRevealToggle.appendChild(appliedEyeEl);
  appliedRevealToggle.appendChild(appliedEyeOffEl);
  let appliedPasswordVisible = false;
  appliedRevealToggle.addEventListener('click', () => {
    appliedPasswordVisible = !appliedPasswordVisible;
    appliedPasswordInput.type = appliedPasswordVisible ? 'text' : 'password';
    appliedRevealToggle.setAttribute(
      'aria-label',
      appliedPasswordVisible ? 'Hide password' : 'Show password',
    );
    appliedEyeEl.classList.toggle('hidden', appliedPasswordVisible);
    appliedEyeOffEl.classList.toggle('hidden', !appliedPasswordVisible);
  });
  appliedPasswordWrapper.appendChild(appliedRevealToggle);

  // ---- Custom password section (hidden by default) ----
  const customSection = document.createElement('div');
  customSection.className = 'hidden px-4 py-4 space-y-2';
  subPanelsContainer.appendChild(customSection);

  const customPasswordLabel = document.createElement('label');
  customPasswordLabel.htmlFor = 'custom-password';
  customPasswordLabel.className = 'block text-sm font-medium text-text-secondary';
  customPasswordLabel.textContent = 'Password';
  customSection.appendChild(customPasswordLabel);

  const customPasswordWrapper = document.createElement('div');
  customPasswordWrapper.className = 'relative';
  customSection.appendChild(customPasswordWrapper);

  const customPasswordInput = document.createElement('input');
  customPasswordInput.type = 'password';
  customPasswordInput.id = 'custom-password';
  customPasswordInput.placeholder = 'Enter your password';
  customPasswordInput.className =
    'w-full px-3 py-2 pr-10 min-h-[44px] border border-border rounded-lg bg-surface text-text-primary placeholder-text-muted focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg focus:outline-hidden font-mono text-sm';
  customPasswordWrapper.appendChild(customPasswordInput);

  const customRevealToggle = document.createElement('button');
  customRevealToggle.type = 'button';
  customRevealToggle.setAttribute('aria-label', 'Show password');
  customRevealToggle.className =
    'absolute inset-y-0 right-0 flex items-center px-3 text-text-muted hover:text-text-secondary focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset focus:outline-none rounded-r-lg transition-colors cursor-pointer';
  const customEyeEl = createIcon(Eye, { size: 'sm', class: 'pointer-events-none' });
  const customEyeOffEl = createIcon(EyeOff, {
    size: 'sm',
    class: 'pointer-events-none hidden',
  });
  customRevealToggle.appendChild(customEyeEl);
  customRevealToggle.appendChild(customEyeOffEl);
  let customPasswordVisible = false;
  customRevealToggle.addEventListener('click', () => {
    customPasswordVisible = !customPasswordVisible;
    customPasswordInput.type = customPasswordVisible ? 'text' : 'password';
    customRevealToggle.setAttribute(
      'aria-label',
      customPasswordVisible ? 'Hide password' : 'Show password',
    );
    customEyeEl.classList.toggle('hidden', customPasswordVisible);
    customEyeOffEl.classList.toggle('hidden', !customPasswordVisible);
  });
  customPasswordWrapper.appendChild(customRevealToggle);

  // ---- Passphrase section (hidden by default) ----
  const passphraseSection = document.createElement('div');
  passphraseSection.className = 'hidden px-4 py-4 space-y-3';
  subPanelsContainer.appendChild(passphraseSection);

  const passphraseSectionLabel = document.createElement('p');
  passphraseSectionLabel.className = 'text-xs font-medium text-text-secondary';
  passphraseSectionLabel.textContent = 'Passphrase';
  passphraseSection.appendChild(passphraseSectionLabel);

  const passphraseHint = document.createElement('p');
  passphraseHint.className = 'text-xs text-text-muted';
  passphraseHint.textContent = 'Auto-generated. Recipients will need this to view your secret.';
  passphraseSection.appendChild(passphraseHint);

  const passphraseWrapper = document.createElement('div');
  passphraseWrapper.className = 'relative';
  passphraseSection.appendChild(passphraseWrapper);

  const passphraseInput = document.createElement('input');
  passphraseInput.type = 'password';
  passphraseInput.setAttribute('aria-label', 'Passphrase');
  passphraseInput.value = currentPassphrase;
  passphraseInput.readOnly = false;
  passphraseInput.className =
    'w-full px-3 py-2 pr-10 min-h-[44px] border border-border rounded-lg bg-surface text-text-primary placeholder-text-muted focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg focus:outline-hidden font-mono text-sm';
  passphraseInput.addEventListener('input', () => {
    currentPassphrase = passphraseInput.value;
  });
  passphraseWrapper.appendChild(passphraseInput);

  const passphraseRevealToggle = document.createElement('button');
  passphraseRevealToggle.type = 'button';
  passphraseRevealToggle.setAttribute('aria-label', 'Show passphrase');
  passphraseRevealToggle.className =
    'absolute inset-y-0 right-0 flex items-center px-3 text-text-muted hover:text-text-secondary focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset focus:outline-none rounded-r-lg transition-colors cursor-pointer';
  const passphraseEyeEl = createIcon(Eye, { size: 'sm', class: 'pointer-events-none' });
  const passphraseEyeOffEl = createIcon(EyeOff, {
    size: 'sm',
    class: 'pointer-events-none hidden',
  });
  passphraseRevealToggle.appendChild(passphraseEyeEl);
  passphraseRevealToggle.appendChild(passphraseEyeOffEl);
  let passphraseVisible = false;
  passphraseRevealToggle.addEventListener('click', () => {
    passphraseVisible = !passphraseVisible;
    passphraseInput.type = passphraseVisible ? 'text' : 'password';
    passphraseRevealToggle.setAttribute(
      'aria-label',
      passphraseVisible ? 'Hide passphrase' : 'Show passphrase',
    );
    passphraseEyeEl.classList.toggle('hidden', passphraseVisible);
    passphraseEyeOffEl.classList.toggle('hidden', !passphraseVisible);
  });
  passphraseWrapper.appendChild(passphraseRevealToggle);

  const passphraseActionRow = document.createElement('div');
  passphraseActionRow.className = 'flex items-center gap-3 flex-wrap';
  passphraseSection.appendChild(passphraseActionRow);

  const newPassphraseBtn = document.createElement('button');
  newPassphraseBtn.type = 'button';
  newPassphraseBtn.setAttribute('aria-label', 'Generate a new passphrase');
  newPassphraseBtn.className =
    'inline-flex items-center gap-2 px-3 py-2 min-h-[44px] rounded-lg border border-border bg-surface text-text-secondary text-sm hover:bg-surface-raised hover:text-text-primary focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg focus:outline-hidden transition-colors cursor-pointer';
  newPassphraseBtn.appendChild(createIcon(Dices, { size: 'sm' }));
  const newPassphraseLabelSpan = document.createElement('span');
  newPassphraseLabelSpan.textContent = 'New passphrase';
  newPassphraseBtn.appendChild(newPassphraseLabelSpan);
  passphraseActionRow.appendChild(newPassphraseBtn);

  const copyPassphraseBtn = createCopyButton(() => currentPassphrase, 'Copy');
  passphraseActionRow.appendChild(copyPassphraseBtn);

  // ---- Internal: helpers for tier default checkboxes ----
  function applyTierDefaults(tier: PasswordTierLocal): void {
    switch (tier) {
      case 'low':
        uppercaseCb.input.checked = false;
        numbersCb.input.checked = false;
        symbolsCb.input.checked = false;
        break;
      case 'medium':
        uppercaseCb.input.checked = true;
        numbersCb.input.checked = true;
        symbolsCb.input.checked = false;
        break;
      case 'high':
      case 'max':
        uppercaseCb.input.checked = true;
        numbersCb.input.checked = true;
        symbolsCb.input.checked = true;
        break;
    }
  }

  // ---- Regenerate function ----
  function regenerate(): void {
    try {
      const result = generatePassword({
        tier: activeTier,
        uppercase: uppercaseCb.input.checked,
        numbers: numbersCb.input.checked,
        symbols: symbolsCb.input.checked,
        easyToSay: easyToSayCb.input.checked,
        easyToRead: easyToReadCb.input.checked,
        omitSimilar: omitSimilarCb.input.checked,
      });
      previewPassword = result.password;
      previewField.textContent = previewPassword;
      const tierLabelStr = activeTier.charAt(0).toUpperCase() + activeTier.slice(1);
      entropyLine.textContent = `${tierLabelStr} \u00b7 ~${Math.round(result.entropyBits)} bits \u00b7 ${result.bruteForceEstimate}`;
      genError.classList.add('hidden');
    } catch {
      genError.classList.remove('hidden');
      previewField.textContent = '';
      previewPassword = '';
      entropyLine.textContent = '';
    }
  }

  // ---- Apply password ----
  function applyPassword(): void {
    if (!previewPassword) return;
    appliedPassword = previewPassword;
    appliedPasswordInput.value = appliedPassword;
    appliedPasswordGroup.classList.remove('hidden');
  }

  // ---- Wire tier buttons ----
  for (const tier of tierNames) {
    tierButtons[tier].addEventListener('click', () => {
      if (activeTier === tier) return;
      activeTier = tier;
      for (const t of tierNames) {
        tierButtons[t].className = t === tier ? tierActiveCls : tierInactiveCls;
        tierButtons[t].setAttribute('aria-pressed', t === tier ? 'true' : 'false');
      }
      applyTierDefaults(tier);
      regenerate();
    });
  }

  // ---- Wire charset/filter checkboxes ----
  for (const cb of [uppercaseCb, numbersCb, symbolsCb]) {
    cb.input.addEventListener('change', regenerate);
  }

  easyToSayCb.input.addEventListener('change', () => {
    if (easyToSayCb.input.checked) {
      // easyToSay overrides charset — visually disable and uncheck Uppercase/Numbers/Symbols
      uppercaseCb.input.checked = false;
      uppercaseCb.input.disabled = true;
      numbersCb.input.checked = false;
      numbersCb.input.disabled = true;
      symbolsCb.input.checked = false;
      symbolsCb.input.disabled = true;
    } else {
      uppercaseCb.input.disabled = false;
      numbersCb.input.disabled = false;
      symbolsCb.input.disabled = false;
      // Restore tier defaults on uncheck
      applyTierDefaults(activeTier);
    }
    regenerate();
  });

  easyToReadCb.input.addEventListener('change', regenerate);
  omitSimilarCb.input.addEventListener('change', regenerate);

  // ---- Wire action buttons ----
  regenerateBtn.addEventListener('click', regenerate);
  usePasswordBtn.addEventListener('click', applyPassword);

  newPassphraseBtn.addEventListener('click', () => {
    currentPassphrase = generatePassphrase();
    passphraseInput.value = currentPassphrase;
  });

  // ---- Show/hide sub-panels based on mode ----
  function showSubPanel(mode: ProtectionMode): void {
    generateSection.classList.toggle('hidden', mode !== 'generate');
    customSection.classList.toggle('hidden', mode !== 'custom');
    passphraseSection.classList.toggle('hidden', mode !== 'passphrase');
    // Show the sub-panels container only when a mode with sub-panel is active
    subPanelsContainer.classList.toggle('hidden', mode === 'none');
  }

  // ---- Wire radio change handlers ----
  for (const opt of options) {
    radioInputs[opt.value].addEventListener('change', () => {
      const previousMode = protectionMode;
      protectionMode = opt.value;

      // Clear cross-mode state on switch
      if (previousMode === 'generate' && opt.value !== 'generate') {
        appliedPassword = '';
        appliedPasswordInput.value = '';
        appliedPasswordGroup.classList.add('hidden');
      }
      if (previousMode === 'passphrase' && opt.value !== 'passphrase') {
        currentPassphrase = generatePassphrase();
        passphraseInput.value = currentPassphrase;
      }

      // Trigger regenerate when switching TO generate mode
      if (opt.value === 'generate') {
        regenerate();
      }

      showSubPanel(opt.value);
    });
  }

  // Initialize sub-panel visibility (none selected by default)
  showSubPanel('none');

  // ---- Accessors ----
  return {
    element: root,
    getPassword: (): string | undefined => {
      if (protectionMode === 'generate') return appliedPassword || undefined;
      if (protectionMode === 'custom') return customPasswordInput.value || undefined;
      if (protectionMode === 'passphrase') return currentPassphrase || undefined;
      return undefined;
    },
    getPassphrase: (): string | undefined => {
      if (protectionMode === 'passphrase') return currentPassphrase || undefined;
      return undefined;
    },
  };
}

// ---------------------------------------------------------------------------
// Main page renderer
// ---------------------------------------------------------------------------

/**
 * Render the create page into the given container.
 *
 * Returns void synchronously -- the auth check for progressive label enhancement
 * runs as a fire-and-forget IIFE (void async pattern) after the form is painted.
 * PageRenderer in router.ts accepts void | Promise<void> so this is compatible.
 *
 * Phase 28: protection is opt-in via 4 radio options (No protection default).
 * Submit handler reads from protectionPanel.getPassword() (undefined when no
 * protection selected). renderConfirmationPage receives
 * protectionPanel.getPassphrase() as the 5th argument (undefined when password
 * mode or no protection).
 */
export function renderCreatePage(container: HTMLElement): void {
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
  // Start with anonymous mode (locked "1 hour" display).
  // Auth IIFE upgrades to authenticated select when session resolves.
  const expirationGroup = document.createElement('div');
  expirationGroup.className = 'space-y-1';

  const expirationLabel = document.createElement('label');
  expirationLabel.htmlFor = 'expiration';
  expirationLabel.className = 'block text-sm font-medium text-text-secondary';
  expirationLabel.textContent = 'Expires after';

  let expirationSelectResult: ExpirationSelectResult = createExpirationSelect(false);

  expirationGroup.appendChild(expirationLabel);
  expirationGroup.appendChild(expirationSelectResult.element);
  form.appendChild(expirationGroup);

  // -- Protection panel (Phase 28) --
  // 4 radio options: No protection (default) / Generate password / Custom password / Passphrase.
  // DOM order: textarea → expiration → [label — injected by auth IIFE] →
  //   [notify toggle — injected by auth IIFE] → protection panel → error area → submit.
  const protectionPanel = createProtectionPanel();
  form.appendChild(protectionPanel.element);

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

  // -- Notify toggle getValue accessor (set async by progressive enhancement) --
  let getNotifyEnabled: () => boolean = () => false;

  // -- Submit handler --
  form.addEventListener('submit', (e) => {
    void (async () => {
      e.preventDefault();

      // Reset error area to default danger styling (may have been replaced by upsell card)
      errorArea.className = 'hidden px-4 py-3 rounded-lg bg-danger/10 text-danger text-sm';
      errorArea.setAttribute('role', 'alert');
      errorArea.textContent = '';

      // Validate non-empty
      const text = textarea.value.trim();
      if (!text) {
        showError(errorArea, 'Please enter a secret to share.');
        return;
      }

      // Get expiration from the current select result (anonymous or authenticated)
      const expiresIn = expirationSelectResult.getValue() as '1h' | '24h' | '7d' | '30d';

      // Get password from protection panel (undefined when no protection selected)
      const password = protectionPanel.getPassword();

      // Get optional label (only present for authenticated users)
      const label = labelInput?.value.trim() || undefined;

      // Disable form during submission
      submitButton.disabled = true;
      textarea.disabled = true;
      if (labelInput) {
        labelInput.disabled = true;
      }

      try {
        // Step 1: Encrypt in the browser
        submitButton.textContent = 'Encrypting...';
        const result = await encrypt(text);

        // Step 2: Send to API (include optional fields only if provided)
        submitButton.textContent = 'Sending...';
        const response = await createSecret(
          result.payload.ciphertext,
          expiresIn,
          password,
          label,
          getNotifyEnabled(),
        );

        // Step 3: Build share URL with key in fragment
        const shareUrl = `${window.location.origin}/secret/${response.id}#${result.keyBase64Url}`;

        // Step 4: Fire analytics before navigating away from create context
        captureSecretCreated(expiresIn, !!password);

        // Step 5: Determine conversion prompt number for anonymous users.
        // Authenticated users never see conversion prompts.
        let promptNumber: 1 | 3 | null = null;
        if (!isAuthenticated) {
          anonymousSecretCount++;
          if (anonymousSecretCount === 1) promptNumber = 1;
          else if (anonymousSecretCount === 3) promptNumber = 3;
        }

        // Step 6: Render confirmation page (state-based, not URL-based).
        // protectionPanel.getPassphrase() returns the passphrase only when passphrase
        // mode is active — undefined for password mode or no protection (Phase 28).
        renderConfirmationPage(
          container,
          shareUrl,
          response.expiresAt,
          label,
          protectionPanel.getPassphrase(),
          promptNumber,
        );
      } catch (err) {
        // Restore form state
        submitButton.disabled = false;
        textarea.disabled = false;
        if (labelInput) {
          labelInput.disabled = false;
        }
        submitButton.textContent = 'Create Secure Link';

        // 429 rate-limit: show inline upsell card instead of generic error text
        if (err instanceof ApiError && err.status === 429) {
          showRateLimitUpsell(errorArea, err.rateLimitReset);
          return;
        }

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
  // Also upgrades the expiration select from anonymous to authenticated mode.
  // This runs after the form is in the DOM so anonymous users see no delay.
  // Label and notify toggle are inserted before errorArea (stable anchor).
  void (async () => {
    try {
      const result = await authClient.getSession();
      // result.data is typed as `any` by better-auth's fully-generic client;
      // assign to unknown before type-narrowing to avoid no-unsafe-assignment.
      const data: unknown = result.data as unknown;
      if (isSession(data)) {
        // Mark authenticated for prompt suppression in submit handler
        isAuthenticated = true;

        // Upgrade expiration select to authenticated mode (1h/24h/7d options)
        expirationSelectResult.element.remove();
        expirationSelectResult = createExpirationSelect(true);
        expirationGroup.appendChild(expirationSelectResult.element);

        const labelField = createLabelField();
        // Insert label field before the protection panel (stable anchor)
        form.insertBefore(labelField, protectionPanel.element);
        labelInput = labelField.querySelector('#secret-label') as HTMLInputElement;
        const notifyToggle = createNotifyToggle();
        form.insertBefore(notifyToggle.element, protectionPanel.element);
        getNotifyEnabled = notifyToggle.getValue;
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

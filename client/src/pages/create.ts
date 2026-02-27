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
 * Phase 28: protection is opt-in via a horizontal 4-tab design (No protection /
 * Generate password / Custom password / Passphrase). When "No protection" is
 * selected (default), no password is sent to the API. "Generate password" tab
 * shows a full 1Password/Bitwarden-style generator: tier selector
 * (Low/Medium/High/Max), charset checkboxes (Uppercase/Numbers/Symbols), filter
 * checkboxes (Easy to say/Easy to read/Omit similar), entropy + brute-force
 * estimate, Regenerate, and "Use this password" to confirm into a combined
 * masked input. "Custom password" tab shows a simple masked input with eye
 * toggle. "Passphrase" tab shows the auto-generated EFF diceware passphrase in
 * a masked input with eye toggle and New passphrase button.
 */

import { encrypt, generatePassphrase, generatePassword } from '../crypto/index.js';
import { createSecret, ApiError, getMe } from '../api/client.js';
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
  RefreshCw,
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
 * Creates the protection panel with a horizontal 4-tab design:
 *   1. No protection (default active)
 *   2. Generate password — full 1Password-style generator UI
 *   3. Custom password — masked text input with eye toggle
 *   4. Passphrase — EFF diceware passphrase with masked input, eye toggle
 *
 * Accepts tier parameters to lock tabs based on the user's authentication
 * and subscription status. Locked tabs show a tier badge and inline popover
 * with a CTA to upgrade, without changing the active selection.
 *
 * Returns the panel element and accessors:
 *   - getPassword(): string | undefined — the value to send to the API
 *   - getPassphrase(): string | undefined — the passphrase to display on the
 *     confirmation card (only truthy when passphrase mode is active)
 *   - getProtectionType(): 'none' | 'passphrase' | 'password' — the protection
 *     type to send as protection_type in the API request body
 *
 * Phase 28 (refactored per second UAT iteration): horizontal tab strip with
 * ARIA tablist/tab/tabpanel pattern replaces the radio button vertical list.
 * Phase 34.1: tier-aware lock states with inline popovers.
 */
function createProtectionPanel(
  opts: { isAuthenticated: boolean; isPro: boolean } = { isAuthenticated: false, isPro: false },
): {
  element: HTMLElement;
  getPassword: () => string | undefined;
  getPassphrase: () => string | undefined;
  getProtectionType: () => 'none' | 'passphrase' | 'password';
} {
  const { isAuthenticated, isPro } = opts;

  // ---- Lock level helper ----
  type LockLevel = 'none' | 'free' | 'pro';

  function getLockLevel(tabId: ActiveTab): LockLevel {
    if (tabId === 'none') return 'none';
    if (tabId === 'passphrase') return isAuthenticated ? 'none' : 'free';
    // 'generate' and 'custom' are password-class: require Pro
    return isPro ? 'none' : 'pro';
  }

  // ---- Closure state ----
  type ActiveTab = 'none' | 'generate' | 'custom' | 'passphrase';
  let activeTab: ActiveTab = 'none';
  let currentPassphrase: string = '';
  type GenerateState = 'preview' | 'confirmed';
  let generateState: GenerateState = 'preview';
  let generatedPassword = '';
  let confirmedPassword = '';

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
    label.className = 'text-xs font-mono text-text-secondary cursor-pointer select-none';
    label.textContent = labelText;
    wrapper.appendChild(checkbox);
    wrapper.appendChild(label);
    return { element: wrapper, input: checkbox };
  }

  // ---- Root container ----
  const root = document.createElement('div');
  root.className = 'border border-border rounded-lg bg-surface/80 backdrop-blur-md';

  // Inner wrapper clips the tab strip and panels with rounded corners.
  // overflow-hidden lives here (not on root) so absolutely-positioned popovers
  // appended to root are not clipped when they extend below the tab strip.
  const inner = document.createElement('div');
  inner.className = 'overflow-hidden rounded-lg';
  root.appendChild(inner);

  // ---- Tab strip ----
  const tabList = document.createElement('div');
  tabList.setAttribute('role', 'tablist');
  tabList.setAttribute('aria-label', 'Protection mode');
  tabList.className = 'flex border-b border-border';
  inner.appendChild(tabList);

  const tabDefs: Array<{ id: ActiveTab; label: string }> = [
    { id: 'none', label: 'No protection' },
    { id: 'generate', label: 'Generate password' },
    { id: 'custom', label: 'Custom password' },
    { id: 'passphrase', label: 'Passphrase' },
  ];

  const tabInactiveCls =
    'flex-1 px-2 py-2.5 text-xs font-mono font-medium text-text-muted border-b-2 border-transparent -mb-px transition-colors duration-150 cursor-pointer hover:text-text-secondary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent';
  const tabActiveCls =
    'flex-1 px-2 py-2.5 text-xs font-mono font-medium text-text-primary border-b-2 border-b-accent -mb-px transition-colors duration-150 cursor-pointer hover:text-text-secondary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent';

  const tabButtons: Record<ActiveTab, HTMLButtonElement> = {} as Record<
    ActiveTab,
    HTMLButtonElement
  >;

  // Popovers for locked tabs — collected during the loop and appended to root
  // after the tablist. This avoids ARIA violations: tablist must only own tab
  // elements; tab elements must not contain interactive descendants.
  // Root must be position:relative so absolute popovers anchor correctly.
  root.style.position = 'relative';
  const lockedPopovers: HTMLElement[] = [];

  for (const def of tabDefs) {
    const lockLevel = getLockLevel(def.id);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.role = 'tab';
    btn.id = `tab-btn-${def.id}`;
    btn.setAttribute('aria-controls', `tab-${def.id}`);

    if (lockLevel === 'none') {
      // Unlocked tab — standard interactive tab
      btn.setAttribute('aria-selected', def.id === 'none' ? 'true' : 'false');
      btn.className = def.id === 'none' ? tabActiveCls : tabInactiveCls;
      btn.textContent = def.label;
    } else {
      // Locked tab — the button sits directly in the tablist (required by ARIA tablist
      // ownership rules). The popover is positioned relative to the root container and
      // appended AFTER the tablist to avoid nested-interactive and aria-required-children
      // violations (axe 4.11: tablist children must be tab elements only; tab elements
      // must not contain interactive descendants).
      btn.setAttribute('aria-disabled', 'true');
      btn.setAttribute('aria-selected', 'false');
      btn.className = tabInactiveCls;

      const labelSpan = document.createElement('span');
      labelSpan.textContent = def.label;
      btn.appendChild(labelSpan);

      const badge = document.createElement('span');
      badge.className =
        'ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded ' +
        'bg-surface-raised text-text-muted border border-border';
      badge.textContent = lockLevel === 'free' ? 'Free' : 'Pro';
      btn.appendChild(badge);

      // Popover — appended to `root` (outside the tablist) after setup.
      // Uses `position: absolute` relative to the root container (position: relative).
      const popoverId = `lock-popover-${def.id}`;
      const popover = document.createElement('div');
      popover.id = popoverId;
      popover.hidden = true;
      popover.className =
        'absolute z-50 mt-1 w-56 rounded-lg border border-border ' +
        'bg-surface shadow-lg p-3 space-y-2 text-left';

      const desc = document.createElement('p');
      desc.className = 'text-xs text-text-secondary';
      desc.textContent =
        lockLevel === 'free'
          ? 'Create a free account to generate secure passphrases.'
          : 'Upgrade to Pro to set custom passwords.';
      popover.appendChild(desc);

      const ctaLink = document.createElement('a');
      ctaLink.href = lockLevel === 'free' ? '/register' : '/pricing';
      ctaLink.className = 'inline-block text-xs font-medium text-accent hover:underline';
      ctaLink.textContent = lockLevel === 'free' ? 'Sign up free \u2192' : 'Upgrade \u2192';
      ctaLink.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(lockLevel === 'free' ? '/register' : '/pricing');
      });
      popover.appendChild(ctaLink);

      // Position popover below the locked tab button on open.
      // Uses getBoundingClientRect relative to the root container's position.
      function positionPopover(): void {
        const btnRect = btn.getBoundingClientRect();
        const rootRect = root.getBoundingClientRect();
        popover.style.top = `${btnRect.bottom - rootRect.top}px`;
        popover.style.left = `${btnRect.left - rootRect.left}px`;
      }

      // Toggle popover on locked tab click; stop propagation to avoid immediate close
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = !popover.hidden;
        if (!isOpen) positionPopover();
        popover.hidden = isOpen;
      });

      // Close popover on outside click (capture phase, same pattern as expiration-select.ts)
      document.addEventListener(
        'click',
        () => {
          if (!popover.hidden) popover.hidden = true;
        },
        { capture: true },
      );

      // Append popover to root AFTER tablist is built (deferred via closure reference).
      // We collect popovers here and append them after the loop.
      lockedPopovers.push(popover);
    }

    tabButtons[def.id] = btn;
    tabList.appendChild(btn);
  }

  // Append locked tab popovers to root (outside the tablist, for ARIA compliance)
  for (const p of lockedPopovers) {
    root.appendChild(p);
  }

  // Arrow key navigation between tabs (skips locked tabs)
  tabList.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    // Only navigate among unlocked tabs
    const allTabs: ActiveTab[] = ['none', 'generate', 'custom', 'passphrase'];
    const unlockedTabs = allTabs.filter((id) => getLockLevel(id) === 'none');
    if (unlockedTabs.length === 0) return;
    const currentIndex = unlockedTabs.indexOf(activeTab);
    const safeIndex = currentIndex === -1 ? 0 : currentIndex;
    const nextIndex =
      e.key === 'ArrowRight'
        ? (safeIndex + 1) % unlockedTabs.length
        : (safeIndex - 1 + unlockedTabs.length) % unlockedTabs.length;
    const nextTab = unlockedTabs[nextIndex];
    if (nextTab) {
      activateTab(nextTab);
      tabButtons[nextTab].focus();
    }
  });

  // ---- Tab panels ----
  const panelsContainer = document.createElement('div');
  inner.appendChild(panelsContainer);

  // Helper: create a tabpanel wrapper
  function createTabPanel(id: ActiveTab): HTMLDivElement {
    const panel = document.createElement('div');
    panel.setAttribute('role', 'tabpanel');
    panel.id = `tab-${id}`;
    panel.setAttribute('aria-labelledby', `tab-btn-${id}`);
    panel.className = 'px-4 py-4 space-y-3';
    if (id !== 'none') panel.hidden = true;
    return panel;
  }

  // ---- Panel 1: No protection ----
  const nonePanel = createTabPanel('none');
  const noneNote = document.createElement('p');
  noneNote.className = 'text-xs font-mono text-text-muted';
  noneNote.textContent = 'Secret will be accessible to anyone with the link.';
  nonePanel.appendChild(noneNote);
  panelsContainer.appendChild(nonePanel);

  // ---- Panel 2: Generate password ----
  const generatePanel = createTabPanel('generate');
  panelsContainer.appendChild(generatePanel);

  // a) Tier selector
  const tierRow = document.createElement('div');
  tierRow.className = 'space-y-1';
  generatePanel.appendChild(tierRow);

  const tierLabel = document.createElement('p');
  tierLabel.className = 'text-xs font-medium text-text-secondary';
  tierLabel.textContent = 'Strength';
  tierRow.appendChild(tierLabel);

  const tierControl = document.createElement('div');
  tierControl.setAttribute('role', 'group');
  tierControl.setAttribute('aria-label', 'Password strength');
  tierControl.className = 'flex gap-1 p-1 rounded-lg bg-surface-raised border border-border';
  tierRow.appendChild(tierControl);

  const tierActiveBtnCls =
    'flex-1 px-2 py-1.5 min-h-[32px] rounded-md bg-accent text-white text-xs font-semibold transition-colors cursor-pointer';
  const tierInactiveBtnCls =
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
    btn.className = tier === 'high' ? tierActiveBtnCls : tierInactiveBtnCls;
    btn.setAttribute('aria-pressed', tier === 'high' ? 'true' : 'false');
    tierControl.appendChild(btn);
  }

  // b) Charset checkboxes
  const charsetBoxes = document.createElement('div');
  charsetBoxes.className = 'flex flex-wrap gap-x-6 gap-y-2';
  generatePanel.appendChild(charsetBoxes);

  const uppercaseCb = createCheckbox('gen-uppercase', 'Uppercase', true);
  const numbersCb = createCheckbox('gen-numbers', 'Numbers', true);
  const symbolsCb = createCheckbox('gen-symbols', 'Symbols', true);
  charsetBoxes.appendChild(uppercaseCb.element);
  charsetBoxes.appendChild(numbersCb.element);
  charsetBoxes.appendChild(symbolsCb.element);

  // c) Filter checkboxes
  const filterBoxes = document.createElement('div');
  filterBoxes.className = 'flex flex-wrap gap-x-6 gap-y-2';
  generatePanel.appendChild(filterBoxes);

  const easyToSayCb = createCheckbox('gen-easy-to-say', 'Easy to say', false);
  const easyToReadCb = createCheckbox('gen-easy-to-read', 'Easy to read', false);
  const omitSimilarCb = createCheckbox('gen-omit-similar', 'Omit similar', false);
  filterBoxes.appendChild(easyToSayCb.element);
  filterBoxes.appendChild(easyToReadCb.element);
  filterBoxes.appendChild(omitSimilarCb.element);

  // d) Entropy line
  const entropyLine = document.createElement('p');
  entropyLine.className = 'text-xs font-mono text-text-muted';
  entropyLine.setAttribute('aria-live', 'polite');
  generatePanel.appendChild(entropyLine);

  // e) Error line
  const genError = document.createElement('p');
  genError.className = 'hidden text-xs text-danger';
  genError.setAttribute('role', 'alert');
  genError.id = 'gen-error';
  genError.textContent =
    'These filter settings are incompatible \u2014 please adjust your settings.';
  generatePanel.appendChild(genError);

  // f) Action row: Regenerate + Use this password
  const genActionRow = document.createElement('div');
  genActionRow.className = 'flex gap-2';
  generatePanel.appendChild(genActionRow);

  const regenerateBtn = document.createElement('button');
  regenerateBtn.type = 'button';
  regenerateBtn.setAttribute('aria-label', 'Generate a new password');
  regenerateBtn.className =
    'inline-flex items-center gap-2 px-3 py-2 min-h-[44px] rounded-lg border border-border bg-surface text-text-secondary text-sm hover:bg-surface-raised hover:text-text-primary focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg focus:outline-hidden transition-colors cursor-pointer';
  regenerateBtn.appendChild(createIcon(Dices, { size: 'sm' }));
  const regenLabelSpan = document.createElement('span');
  regenLabelSpan.textContent = 'Regenerate';
  regenerateBtn.appendChild(regenLabelSpan);
  genActionRow.appendChild(regenerateBtn);

  const usePasswordBtn = document.createElement('button');
  usePasswordBtn.type = 'button';
  usePasswordBtn.className =
    'inline-flex items-center gap-2 px-3 py-2 min-h-[44px] rounded-lg border border-border bg-surface text-text-secondary text-sm hover:bg-surface-raised hover:text-text-primary focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg focus:outline-hidden transition-colors cursor-pointer';
  usePasswordBtn.appendChild(createIcon(Check, { size: 'sm' }));
  const usePasswordLabelSpan = document.createElement('span');
  usePasswordLabelSpan.textContent = 'Use this password';
  usePasswordBtn.appendChild(usePasswordLabelSpan);
  genActionRow.appendChild(usePasswordBtn);

  // g) Combined password field (preview + confirmed state)
  const combinedFieldGroup = document.createElement('div');
  combinedFieldGroup.className = 'space-y-1';
  generatePanel.appendChild(combinedFieldGroup);

  const combinedFieldLabel = document.createElement('label');
  combinedFieldLabel.htmlFor = 'gen-combined-password';
  combinedFieldLabel.className = 'block text-sm font-medium text-text-secondary';
  combinedFieldLabel.textContent = 'Password';
  combinedFieldGroup.appendChild(combinedFieldLabel);

  const combinedPasswordWrapper = document.createElement('div');
  combinedPasswordWrapper.className = 'relative';
  combinedFieldGroup.appendChild(combinedPasswordWrapper);

  const combinedPasswordInput = document.createElement('input');
  combinedPasswordInput.type = 'password';
  combinedPasswordInput.id = 'gen-combined-password';
  combinedPasswordInput.readOnly = true;
  combinedPasswordInput.className =
    'w-full px-3 py-2 pr-16 min-h-[44px] border border-border rounded-lg bg-surface text-text-primary font-mono text-sm focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg focus:outline-hidden';
  combinedPasswordWrapper.appendChild(combinedPasswordInput);

  // Eye/EyeOff toggle — absolute right-8
  const genRevealToggle = document.createElement('button');
  genRevealToggle.type = 'button';
  genRevealToggle.setAttribute('aria-label', 'Show password');
  genRevealToggle.className =
    'absolute inset-y-0 right-8 flex items-center px-2 text-text-muted hover:text-text-secondary focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset focus:outline-none transition-colors cursor-pointer';
  const genEyeEl = createIcon(Eye, { size: 'sm', class: 'pointer-events-none' });
  const genEyeOffEl = createIcon(EyeOff, { size: 'sm', class: 'pointer-events-none hidden' });
  genRevealToggle.appendChild(genEyeEl);
  genRevealToggle.appendChild(genEyeOffEl);
  let genPasswordVisible = false;
  genRevealToggle.addEventListener('click', () => {
    genPasswordVisible = !genPasswordVisible;
    combinedPasswordInput.type = genPasswordVisible ? 'text' : 'password';
    genRevealToggle.setAttribute(
      'aria-label',
      genPasswordVisible ? 'Hide password' : 'Show password',
    );
    genEyeEl.classList.toggle('hidden', genPasswordVisible);
    genEyeOffEl.classList.toggle('hidden', !genPasswordVisible);
  });
  combinedPasswordWrapper.appendChild(genRevealToggle);

  // Copy button — absolute right-2
  const genCopyIconSpan = document.createElement('span');
  genCopyIconSpan.className = 'inline-flex';
  genCopyIconSpan.appendChild(createIcon(Copy, { size: 'sm', class: 'pointer-events-none' }));

  const genCopyBtn = document.createElement('button');
  genCopyBtn.type = 'button';
  genCopyBtn.setAttribute('aria-label', 'Copy password');
  genCopyBtn.className =
    'absolute inset-y-0 right-0 flex items-center px-2 text-text-muted hover:text-text-secondary focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset focus:outline-none rounded-r-lg transition-colors cursor-pointer';
  genCopyBtn.appendChild(genCopyIconSpan);
  genCopyBtn.addEventListener('click', () => {
    const val = combinedPasswordInput.value;
    if (!val) return;
    void (async () => {
      try {
        await navigator.clipboard.writeText(val);
        showToast('Copied to clipboard');
        while (genCopyIconSpan.firstChild) genCopyIconSpan.removeChild(genCopyIconSpan.firstChild);
        genCopyIconSpan.appendChild(
          createIcon(Check, { size: 'sm', class: 'pointer-events-none' }),
        );
        setTimeout(() => {
          while (genCopyIconSpan.firstChild)
            genCopyIconSpan.removeChild(genCopyIconSpan.firstChild);
          genCopyIconSpan.appendChild(
            createIcon(Copy, { size: 'sm', class: 'pointer-events-none' }),
          );
        }, 1500);
      } catch {
        showToast('Failed to copy');
      }
    })();
  });
  combinedPasswordWrapper.appendChild(genCopyBtn);

  // State label below field
  const genStateLabel = document.createElement('p');
  genStateLabel.className = 'text-xs font-mono text-text-muted mt-1';
  genStateLabel.textContent = 'Preview \u2014 click \u201cUse this password\u201d to confirm';
  combinedFieldGroup.appendChild(genStateLabel);

  // ---- Panel 3: Custom password ----
  const customPanel = createTabPanel('custom');
  panelsContainer.appendChild(customPanel);

  const customPasswordLabel = document.createElement('label');
  customPasswordLabel.htmlFor = 'custom-password';
  customPasswordLabel.className = 'block text-sm font-medium text-text-secondary';
  customPasswordLabel.textContent = 'Password';
  customPanel.appendChild(customPasswordLabel);

  const customPasswordWrapper = document.createElement('div');
  customPasswordWrapper.className = 'relative';
  customPanel.appendChild(customPasswordWrapper);

  const customPasswordInput = document.createElement('input');
  customPasswordInput.type = 'password';
  customPasswordInput.id = 'custom-password';
  customPasswordInput.placeholder = 'Enter your password';
  customPasswordInput.className =
    'w-full px-3 py-2 pr-16 min-h-[44px] border border-border rounded-lg bg-surface text-text-primary placeholder-text-muted focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg focus:outline-hidden font-mono text-sm';
  customPasswordWrapper.appendChild(customPasswordInput);

  const customRevealToggle = document.createElement('button');
  customRevealToggle.type = 'button';
  customRevealToggle.setAttribute('aria-label', 'Show password');
  customRevealToggle.className =
    'absolute inset-y-0 right-8 flex items-center px-2 text-text-muted hover:text-text-secondary focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset focus:outline-none transition-colors cursor-pointer';
  const customEyeEl = createIcon(Eye, { size: 'sm', class: 'pointer-events-none' });
  const customEyeOffEl = createIcon(EyeOff, { size: 'sm', class: 'pointer-events-none hidden' });
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

  // Custom copy button
  const customCopyIconSpan = document.createElement('span');
  customCopyIconSpan.className = 'inline-flex';
  customCopyIconSpan.appendChild(createIcon(Copy, { size: 'sm', class: 'pointer-events-none' }));
  const customCopyBtn = document.createElement('button');
  customCopyBtn.type = 'button';
  customCopyBtn.setAttribute('aria-label', 'Copy password');
  customCopyBtn.className =
    'absolute inset-y-0 right-0 flex items-center px-2 text-text-muted hover:text-text-secondary focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset focus:outline-none rounded-r-lg transition-colors cursor-pointer';
  customCopyBtn.appendChild(customCopyIconSpan);
  customCopyBtn.addEventListener('click', () => {
    const val = customPasswordInput.value;
    if (!val) return;
    void (async () => {
      try {
        await navigator.clipboard.writeText(val);
        showToast('Copied to clipboard');
        while (customCopyIconSpan.firstChild)
          customCopyIconSpan.removeChild(customCopyIconSpan.firstChild);
        customCopyIconSpan.appendChild(
          createIcon(Check, { size: 'sm', class: 'pointer-events-none' }),
        );
        setTimeout(() => {
          while (customCopyIconSpan.firstChild)
            customCopyIconSpan.removeChild(customCopyIconSpan.firstChild);
          customCopyIconSpan.appendChild(
            createIcon(Copy, { size: 'sm', class: 'pointer-events-none' }),
          );
        }, 1500);
      } catch {
        showToast('Failed to copy');
      }
    })();
  });
  customPasswordWrapper.appendChild(customCopyBtn);

  // ---- Panel 4: Passphrase ----
  const passphrasePanel = createTabPanel('passphrase');
  panelsContainer.appendChild(passphrasePanel);

  const passphraseLabelEl = document.createElement('label');
  passphraseLabelEl.htmlFor = 'passphrase-input';
  passphraseLabelEl.className = 'block text-sm font-medium text-text-secondary';
  passphraseLabelEl.textContent = 'Passphrase';
  passphrasePanel.appendChild(passphraseLabelEl);

  const passphraseWrapper = document.createElement('div');
  passphraseWrapper.className = 'relative';
  passphrasePanel.appendChild(passphraseWrapper);

  const passphraseInput = document.createElement('input');
  passphraseInput.type = 'password';
  passphraseInput.id = 'passphrase-input';
  passphraseInput.readOnly = false;
  passphraseInput.className =
    'w-full px-3 py-2 pr-16 min-h-[44px] border border-border rounded-lg bg-surface text-text-primary placeholder-text-muted focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg focus:outline-hidden font-mono text-sm';
  passphraseInput.addEventListener('input', () => {
    currentPassphrase = passphraseInput.value;
  });
  passphraseWrapper.appendChild(passphraseInput);

  const passphraseRevealToggle = document.createElement('button');
  passphraseRevealToggle.type = 'button';
  passphraseRevealToggle.setAttribute('aria-label', 'Show passphrase');
  passphraseRevealToggle.className =
    'absolute inset-y-0 right-8 flex items-center px-2 text-text-muted hover:text-text-secondary focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset focus:outline-none transition-colors cursor-pointer';
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

  // Passphrase copy button
  const passphraseCopyIconSpan = document.createElement('span');
  passphraseCopyIconSpan.className = 'inline-flex';
  passphraseCopyIconSpan.appendChild(
    createIcon(Copy, { size: 'sm', class: 'pointer-events-none' }),
  );
  const passphraseCopyBtn = document.createElement('button');
  passphraseCopyBtn.type = 'button';
  passphraseCopyBtn.setAttribute('aria-label', 'Copy passphrase');
  passphraseCopyBtn.className =
    'absolute inset-y-0 right-0 flex items-center px-2 text-text-muted hover:text-text-secondary focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset focus:outline-none rounded-r-lg transition-colors cursor-pointer';
  passphraseCopyBtn.appendChild(passphraseCopyIconSpan);
  passphraseCopyBtn.addEventListener('click', () => {
    const val = passphraseInput.value;
    if (!val) return;
    void (async () => {
      try {
        await navigator.clipboard.writeText(val);
        showToast('Copied to clipboard');
        while (passphraseCopyIconSpan.firstChild)
          passphraseCopyIconSpan.removeChild(passphraseCopyIconSpan.firstChild);
        passphraseCopyIconSpan.appendChild(
          createIcon(Check, { size: 'sm', class: 'pointer-events-none' }),
        );
        setTimeout(() => {
          while (passphraseCopyIconSpan.firstChild)
            passphraseCopyIconSpan.removeChild(passphraseCopyIconSpan.firstChild);
          passphraseCopyIconSpan.appendChild(
            createIcon(Copy, { size: 'sm', class: 'pointer-events-none' }),
          );
        }, 1500);
      } catch {
        showToast('Failed to copy');
      }
    })();
  });
  passphraseWrapper.appendChild(passphraseCopyBtn);

  // New passphrase button row
  const passphraseActionRow = document.createElement('div');
  passphraseActionRow.className = 'flex items-center gap-2';
  passphrasePanel.appendChild(passphraseActionRow);

  const newPassphraseBtn = document.createElement('button');
  newPassphraseBtn.type = 'button';
  newPassphraseBtn.setAttribute('aria-label', 'Generate a new passphrase');
  newPassphraseBtn.className =
    'inline-flex items-center gap-2 px-3 py-2 min-h-[44px] rounded-lg border border-border bg-surface text-text-secondary text-sm hover:bg-surface-raised hover:text-text-primary focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg focus:outline-hidden transition-colors cursor-pointer';
  newPassphraseBtn.appendChild(createIcon(RefreshCw, { size: 'sm' }));
  const newPassphraseLabelSpan = document.createElement('span');
  newPassphraseLabelSpan.textContent = 'New passphrase';
  newPassphraseBtn.appendChild(newPassphraseLabelSpan);
  passphraseActionRow.appendChild(newPassphraseBtn);

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

  // ---- Refresh combined field display (generate tab) ----
  function refreshCombinedField(): void {
    const displayValue = generateState === 'confirmed' ? confirmedPassword : generatedPassword;
    combinedPasswordInput.value = displayValue;
    if (generateState === 'confirmed') {
      genStateLabel.textContent = '\u2713 Confirmed';
      genStateLabel.className = 'text-xs font-mono text-accent mt-1';
      combinedPasswordWrapper.classList.add('ring-1', 'ring-accent/50');
    } else {
      genStateLabel.textContent = 'Preview \u2014 click \u201cUse this password\u201d to confirm';
      genStateLabel.className = 'text-xs font-mono text-text-muted mt-1';
      combinedPasswordWrapper.classList.remove('ring-1', 'ring-accent/50');
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
      generatedPassword = result.password;
      const tierLabelStr = activeTier.charAt(0).toUpperCase() + activeTier.slice(1);
      entropyLine.textContent = `${tierLabelStr} \u00b7 ${Math.round(result.entropyBits)} bits \u00b7 ${result.bruteForceEstimate}`;
      genError.classList.add('hidden');
      // Reset to preview state on regenerate
      generateState = 'preview';
      confirmedPassword = '';
      refreshCombinedField();
    } catch {
      genError.classList.remove('hidden');
      generatedPassword = '';
      entropyLine.textContent = '';
      generateState = 'preview';
      confirmedPassword = '';
      refreshCombinedField();
    }
  }

  // ---- Wire tier buttons ----
  for (const tier of tierNames) {
    tierButtons[tier].addEventListener('click', () => {
      if (activeTier === tier) return;
      activeTier = tier;
      for (const t of tierNames) {
        tierButtons[t].className = t === tier ? tierActiveBtnCls : tierInactiveBtnCls;
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
      applyTierDefaults(activeTier);
    }
    regenerate();
  });

  easyToReadCb.input.addEventListener('change', regenerate);
  omitSimilarCb.input.addEventListener('change', regenerate);

  // ---- Wire action buttons ----
  regenerateBtn.addEventListener('click', () => {
    generateState = 'preview';
    confirmedPassword = '';
    regenerate();
  });

  usePasswordBtn.addEventListener('click', () => {
    if (!generatedPassword) return;
    generateState = 'confirmed';
    confirmedPassword = generatedPassword;
    refreshCombinedField();
  });

  newPassphraseBtn.addEventListener('click', () => {
    currentPassphrase = generatePassphrase();
    passphraseInput.value = currentPassphrase;
  });

  // ---- Tab activation ----
  function activateTab(tab: ActiveTab): void {
    if (getLockLevel(tab) !== 'none') return; // locked tab — ignore
    const previousTab = activeTab;
    activeTab = tab;

    // Update tab button ARIA + styling
    for (const def of tabDefs) {
      const isActive = def.id === tab;
      tabButtons[def.id].setAttribute('aria-selected', isActive ? 'true' : 'false');
      tabButtons[def.id].className = isActive ? tabActiveCls : tabInactiveCls;
    }

    // Show/hide panels
    nonePanel.hidden = tab !== 'none';
    generatePanel.hidden = tab !== 'generate';
    customPanel.hidden = tab !== 'custom';
    passphrasePanel.hidden = tab !== 'passphrase';

    // State resets on tab switch
    if (previousTab === 'generate' && tab !== 'generate') {
      generateState = 'preview';
      confirmedPassword = '';
      refreshCombinedField();
    }
    if (previousTab === 'passphrase' && tab !== 'passphrase') {
      currentPassphrase = '';
    }

    // Initialise data on switch TO a tab
    if (tab === 'generate') {
      regenerate();
    }
    if (tab === 'passphrase' && !currentPassphrase) {
      currentPassphrase = generatePassphrase();
      passphraseInput.value = currentPassphrase;
    }
  }

  // ---- Wire tab button clicks ----
  for (const def of tabDefs) {
    tabButtons[def.id].addEventListener('click', () => {
      activateTab(def.id);
    });
  }

  // ---- Accessors ----

  // getPassword() intentionally returns undefined when the passphrase tab is active.
  //
  // Design intent (two-channel model): the passphrase tab is a communication aid —
  // the EFF Diceware passphrase is displayed on the confirmation page so the sender
  // can share it with the recipient via a separate channel (e.g. SMS vs. encrypted email).
  // The passphrase is NOT used as the Argon2id server-side password and is NOT sent to
  // the API. Only getPassphrase() surfaces it, for the confirmation page UI only.
  //
  // This is correct per PROT-04: "Passphrase" tab → passphrase card on confirmation;
  // no password hash is stored server-side; the passphrase is out-of-band security guidance.
  function getPassword(): string | undefined {
    if (activeTab === 'generate') return confirmedPassword || undefined;
    if (activeTab === 'custom') return customPasswordInput.value.trim() || undefined;
    return undefined;
  }

  function getPassphrase(): string | undefined {
    return activeTab === 'passphrase' ? currentPassphrase || undefined : undefined;
  }

  function getProtectionType(): 'none' | 'passphrase' | 'password' {
    if (activeTab === 'passphrase') return 'passphrase';
    if (activeTab === 'generate' || activeTab === 'custom') return 'password';
    return 'none';
  }

  return {
    element: root,
    getPassword,
    getPassphrase,
    getProtectionType,
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
 * Phase 28: protection is opt-in via a horizontal 4-tab design (No protection
 * default). Submit handler reads from protectionPanel.getPassword() (undefined
 * when no protection selected). renderConfirmationPage receives
 * protectionPanel.getPassphrase() as the 5th argument (undefined when password
 * mode or no protection).
 */
/**
 * Export for testing only — allows accessibility and integration tests to render
 * a tier-aware protection panel in isolation (e.g. with isPro=true to test
 * generate-tab UI without going through the auth IIFE in renderCreatePage).
 *
 * @internal
 */
export { createProtectionPanel };

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

  // -- Protection panel (Phase 28 / Phase 34.1) --
  // 4 radio options: No protection (default) / Generate password / Custom password / Passphrase.
  // DOM order: textarea → expiration → [label — injected by auth IIFE] →
  //   [notify toggle — injected by auth IIFE] → protection panel → error area → submit.
  // Declared `let` (not `const`) so the auth IIFE can replace it with a tier-aware version.
  let protectionPanel = createProtectionPanel();
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

      // Get protection type from active tab (sent as protection_type in API request body)
      const protectionType = protectionPanel.getProtectionType();

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
          protectionType,
        );

        // Step 3: Build share URL with key in fragment
        const shareUrl = `${window.location.origin}/secret/${response.id}#${result.keyBase64Url}`;

        // Step 4: Fire analytics before navigating away from create context
        captureSecretCreated(expiresIn, !!password, protectionType);

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

        // Fetch full profile to determine subscription tier
        // (subscriptionTier is not on the Better Auth session object)
        let isPro = false;
        try {
          const meData = await getMe();
          isPro = meData.user.subscriptionTier === 'pro';
        } catch {
          // Fallback: treat as free tier on API error (safe degradation)
          isPro = false;
        }

        // Upgrade expiration select to authenticated mode with Pro awareness
        expirationSelectResult.element.remove();
        expirationSelectResult = createExpirationSelect(true, isPro);
        expirationGroup.appendChild(expirationSelectResult.element);

        // Replace protection panel with tier-aware version (Phase 34.1)
        const oldPanel = protectionPanel.element;
        protectionPanel = createProtectionPanel({ isAuthenticated: true, isPro });
        oldPanel.parentElement?.insertBefore(protectionPanel.element, oldPanel);
        oldPanel.remove();

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

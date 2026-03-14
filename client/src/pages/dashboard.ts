/**
 * Dashboard page — authenticated user's secret history.
 *
 * Shows a table of all secrets the user has created while logged in,
 * with status badge, tab filter, delete modal, and empty state.
 *
 * Session guard: redirects to /login on mount if there is no active session.
 */

import { Circle, CheckCircle2, Clock, Trash2, Lock, Bell, TriangleAlert } from 'lucide';
import { authClient, isSession } from '../api/auth-client.js';
import type { Session } from '../api/auth-client.js';
import {
  fetchDashboardSecrets,
  deleteDashboardSecret,
  getMe,
  initiateCheckout,
  createPortalSession,
  verifyCheckoutSession,
} from '../api/client.js';
import { createIcon } from '../components/icons.js';
import { showToast } from '../components/toast.js';
import { navigate } from '../router.js';
import {
  identifyUser,
  resetAnalyticsIdentity,
  captureUserLoggedIn,
  captureUserRegistered,
  captureDashboardViewed,
  captureCheckoutInitiated,
  captureSubscriptionActivated,
} from '../analytics/posthog.js';
import type { DashboardSecretItem } from '../../../shared/types/api.js';

// ---------------------------------------------------------------------------
// Status configuration
// ---------------------------------------------------------------------------

const STATUS_CONFIG = {
  active: { label: 'Active', icon: Circle, colorClass: 'text-success' },
  viewed: { label: 'Viewed', icon: CheckCircle2, colorClass: 'text-text-muted' },
  expired: { label: 'Expired', icon: Clock, colorClass: 'text-warning' },
  deleted: { label: 'Deleted', icon: Trash2, colorClass: 'text-danger' },
} as const;

type StatusKey = keyof typeof STATUS_CONFIG;

/**
 * Create a status badge: flex container with icon (aria-hidden) + visible text label.
 * Both use the status color class to satisfy "not color alone" accessibility rule.
 */
function createStatusBadge(status: string): HTMLElement {
  const span = document.createElement('span');
  span.className = 'inline-flex items-center gap-1.5';

  const config = STATUS_CONFIG[status as StatusKey];
  if (!config) {
    span.textContent = status;
    return span;
  }

  const iconEl = createIcon(config.icon, {
    size: 'sm',
    class: config.colorClass,
  });
  span.appendChild(iconEl);

  const textEl = document.createElement('span');
  textEl.className = `text-sm font-medium ${config.colorClass}`;
  textEl.textContent = config.label;
  span.appendChild(textEl);

  return span;
}

// ---------------------------------------------------------------------------
// Date formatting
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr));
}

// ---------------------------------------------------------------------------
// Reshare helpers
// ---------------------------------------------------------------------------

/**
 * Rounds the duration (expiresAt - createdAt) to the nearest supported expiry option.
 * Used by the reshare button to pre-fill the create form's expiry select.
 */
export function roundToNearestExpiry(createdAt: string, expiresAt: string): string {
  const durationMs = new Date(expiresAt).getTime() - new Date(createdAt).getTime();
  const hours = durationMs / (1000 * 60 * 60);
  if (hours < 2) return '1h';
  if (hours < 48) return '24h';
  if (hours <= 168) return '7d';
  return '30d';
}

// ---------------------------------------------------------------------------
// Confirmation modal
// ---------------------------------------------------------------------------

/**
 * Build an accessible confirmation modal.
 *
 * Mounts to document.body; caller is responsible for removing on resolve.
 * Focus is placed on the Cancel button (safe default).
 * ESC key triggers cancel.
 * Focus returns to triggerEl on close.
 */
function createConfirmModal(
  secretLabel: string | null,
  triggerEl: HTMLElement,
  onConfirm: () => void,
  onCancel: () => void,
): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className =
    'fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'modal-title');

  const panel = document.createElement('div');
  panel.className =
    'bg-surface border border-border rounded-xl p-6 max-w-sm w-full mx-4 space-y-4 shadow-xl';

  const heading = document.createElement('h2');
  heading.id = 'modal-title';
  heading.className = 'text-lg font-semibold text-text-primary';
  heading.textContent = 'Delete this secret?';
  panel.appendChild(heading);

  const body = document.createElement('p');
  body.className = 'text-sm text-text-secondary';
  body.textContent =
    'This will permanently destroy the secret. The recipient\u2019s link will stop working immediately.';
  panel.appendChild(body);

  if (secretLabel) {
    const labelInfo = document.createElement('p');
    labelInfo.className = 'text-sm text-text-muted';
    labelInfo.textContent = `Label: ${secretLabel}`;
    panel.appendChild(labelInfo);
  }

  const buttonRow = document.createElement('div');
  buttonRow.className = 'flex justify-end gap-3 pt-2';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className =
    'px-4 py-2 rounded-lg border border-border text-text-secondary text-sm font-medium hover:bg-surface-raised hover:text-text-primary focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface focus:outline-hidden transition-all cursor-pointer';
  cancelBtn.textContent = 'Cancel';

  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.className =
    'px-4 py-2 rounded-lg bg-danger text-white text-sm font-medium hover:bg-danger/90 focus:ring-2 focus:ring-danger focus:ring-offset-2 focus:ring-offset-surface focus:outline-hidden transition-all cursor-pointer';
  confirmBtn.textContent = 'Yes, delete';

  buttonRow.appendChild(cancelBtn);
  buttonRow.appendChild(confirmBtn);
  panel.appendChild(buttonRow);
  overlay.appendChild(panel);

  // ESC key handler
  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      close();
      onCancel();
    }
  }

  function close(): void {
    document.removeEventListener('keydown', handleKeydown);
    overlay.remove();
    triggerEl.focus();
  }

  document.addEventListener('keydown', handleKeydown, { once: true });

  cancelBtn.addEventListener('click', () => {
    close();
    onCancel();
  });

  confirmBtn.addEventListener('click', () => {
    close();
    onConfirm();
  });

  // Focus Cancel button on mount (safe default)
  requestAnimationFrame(() => {
    cancelBtn.focus();
  });

  return overlay;
}

// ---------------------------------------------------------------------------
// Account deletion
// ---------------------------------------------------------------------------

/**
 * Call DELETE /api/me. On success: show toast, navigate to home.
 * On failure: show error toast and let the caller restore UI state.
 */
async function deleteAccount(): Promise<boolean> {
  try {
    const res = await fetch('/api/me', { method: 'DELETE' });
    if (res.ok) {
      showToast('Your account has been deleted');
      navigate('/');
      return true;
    }
    showToast('Failed to delete account. Please try again.');
    return false;
  } catch {
    showToast('Failed to delete account. Please try again.');
    return false;
  }
}

/**
 * Build an accessible account deletion confirmation modal.
 *
 * The confirm button remains disabled until the user types exactly "delete"
 * into the confirmation input. Cancel and Escape dismiss without side effects.
 * Focus is trapped inside the modal while open; returns to triggerEl on close.
 *
 * @param triggerEl - The element that opened the modal (receives focus on close)
 */
function createDeleteAccountModal(triggerEl: HTMLElement): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className =
    'fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm motion-safe:animate-[fade-in-up_200ms_ease-out]';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'delete-account-modal-title');

  const panel = document.createElement('div');
  panel.className =
    'bg-surface border border-border rounded-xl p-6 max-w-sm w-full mx-4 space-y-4 shadow-xl';

  // --- Header ---
  const headerRow = document.createElement('div');
  headerRow.className = 'flex items-start gap-3';

  const dangerIconWrap = document.createElement('div');
  dangerIconWrap.className =
    'flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-danger/10';
  const dangerIcon = createIcon(TriangleAlert, { size: 'sm', class: 'text-danger' });
  dangerIconWrap.appendChild(dangerIcon);
  headerRow.appendChild(dangerIconWrap);

  const headerText = document.createElement('div');

  const heading = document.createElement('h2');
  heading.id = 'delete-account-modal-title';
  heading.className = 'text-lg font-semibold text-text-primary';
  heading.textContent = 'Delete account';
  headerText.appendChild(heading);

  const subtext = document.createElement('p');
  subtext.className = 'mt-0.5 text-sm text-text-secondary';
  subtext.textContent =
    'This action is permanent and cannot be undone. All your data will be deleted.';
  headerText.appendChild(subtext);

  headerRow.appendChild(headerText);
  panel.appendChild(headerRow);

  // --- Confirmation input ---
  const inputGroup = document.createElement('div');
  inputGroup.className = 'space-y-1.5';

  const inputLabel = document.createElement('label');
  inputLabel.htmlFor = 'delete-account-confirm-input';
  inputLabel.className = 'block text-sm text-text-secondary';

  const labelSpan = document.createElement('span');
  labelSpan.textContent = 'Type ';
  inputLabel.appendChild(labelSpan);

  const codeSpan = document.createElement('code');
  codeSpan.className =
    'px-1 py-0.5 rounded text-xs bg-surface-raised text-danger font-mono border border-border';
  codeSpan.textContent = 'delete';
  inputLabel.appendChild(codeSpan);

  const labelEnd = document.createElement('span');
  labelEnd.textContent = ' to confirm';
  inputLabel.appendChild(labelEnd);

  inputGroup.appendChild(inputLabel);

  const confirmInput = document.createElement('input');
  confirmInput.type = 'text';
  confirmInput.id = 'delete-account-confirm-input';
  confirmInput.className =
    'w-full px-3 py-2 rounded-lg border border-border bg-surface text-text-primary text-sm placeholder:text-text-muted focus:outline-hidden focus:ring-2 focus:ring-danger focus:border-danger transition-colors';
  confirmInput.setAttribute('autocomplete', 'off');
  confirmInput.setAttribute('autocorrect', 'off');
  confirmInput.setAttribute('spellcheck', 'false');
  confirmInput.placeholder = 'delete';
  inputGroup.appendChild(confirmInput);

  panel.appendChild(inputGroup);

  // --- Buttons ---
  const buttonRow = document.createElement('div');
  buttonRow.className = 'flex justify-end gap-3 pt-1';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className =
    'px-4 py-2 rounded-lg border border-border text-text-secondary text-sm font-medium hover:bg-surface-raised hover:text-text-primary focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface focus:outline-hidden transition-all cursor-pointer';
  cancelBtn.textContent = 'Cancel';

  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.disabled = true;
  confirmBtn.className =
    'px-4 py-2 rounded-lg bg-danger text-white text-sm font-medium hover:bg-danger/90 focus:ring-2 focus:ring-danger focus:ring-offset-2 focus:ring-offset-surface focus:outline-hidden transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
  confirmBtn.textContent = 'Delete account';

  buttonRow.appendChild(cancelBtn);
  buttonRow.appendChild(confirmBtn);
  panel.appendChild(buttonRow);

  overlay.appendChild(panel);

  // --- Close helpers ---
  function closeModal(): void {
    document.removeEventListener('keydown', handleKeydown);
    overlay.remove();
    triggerEl.focus();
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      closeModal();
    }
  }

  // --- Enable confirm button only when "delete" is typed ---
  confirmInput.addEventListener('input', () => {
    const isValid = confirmInput.value === 'delete';
    confirmBtn.disabled = !isValid;
  });

  // --- Button event handlers ---
  cancelBtn.addEventListener('click', () => {
    closeModal();
  });

  confirmBtn.addEventListener('click', () => {
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Deleting\u2026';

    // Show inline spinner in button
    const spinner = document.createElement('span');
    spinner.className =
      'inline-block w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin mr-2 align-middle';
    spinner.setAttribute('aria-hidden', 'true');
    confirmBtn.prepend(spinner);

    void (async () => {
      const success = await deleteAccount();
      if (!success) {
        // Restore button so user can retry
        spinner.remove();
        confirmBtn.textContent = 'Delete account';
        // Re-evaluate disabled state from input value
        confirmBtn.disabled = confirmInput.value !== 'delete';
      }
      // On success, deleteAccount() calls navigate('/') which tears down the page
    })();
  });

  document.addEventListener('keydown', handleKeydown);

  // Focus the input after mount so user can start typing immediately
  requestAnimationFrame(() => {
    confirmInput.focus();
  });

  return overlay;
}

// ---------------------------------------------------------------------------
// Table rendering
// ---------------------------------------------------------------------------

type TabValue = 'all' | 'active' | 'viewed' | 'expired' | 'deleted';

/**
 * Re-render the tbody with the filtered list of secrets.
 * Handles delete button interaction for each Active row.
 */
function renderTableBody(
  tbody: HTMLTableSectionElement,
  items: DashboardSecretItem[],
  onDelete: (id: string, triggerEl: HTMLElement) => void,
): void {
  while (tbody.firstChild) {
    tbody.removeChild(tbody.firstChild);
  }

  for (const item of items) {
    const row = document.createElement('tr');
    row.className = 'border-t border-border hover:bg-surface-raised/50 transition-colors';

    // Label
    const labelCell = document.createElement('td');
    labelCell.className = 'px-4 py-3 text-text-primary text-sm';
    labelCell.textContent = item.label ?? '\u2014';
    row.appendChild(labelCell);

    // Created
    const createdCell = document.createElement('td');
    createdCell.className = 'px-4 py-3 text-text-secondary text-sm whitespace-nowrap';
    createdCell.textContent = formatDate(item.createdAt);
    row.appendChild(createdCell);

    // Expires
    const expiresCell = document.createElement('td');
    expiresCell.className = 'px-4 py-3 text-text-secondary text-sm whitespace-nowrap';
    expiresCell.textContent = formatDate(item.expiresAt);
    row.appendChild(expiresCell);

    // Status
    const statusCell = document.createElement('td');
    statusCell.className = 'px-4 py-3';
    statusCell.appendChild(createStatusBadge(item.status));
    row.appendChild(statusCell);

    // Notification
    const notifyCell = document.createElement('td');
    notifyCell.className = 'px-4 py-3 text-text-muted text-sm';
    if (item.notify) {
      const notifyWrap = document.createElement('span');
      notifyWrap.className = 'inline-flex items-center gap-1.5';
      const bellIcon = createIcon(Bell, { size: 'sm', class: 'text-accent' });
      notifyWrap.appendChild(bellIcon);
      const onText = document.createElement('span');
      onText.textContent = 'On';
      notifyWrap.appendChild(onText);
      notifyCell.appendChild(notifyWrap);
    } else {
      notifyCell.textContent = '\u2014';
    }
    row.appendChild(notifyCell);

    // Delete button
    const deleteCell = document.createElement('td');
    deleteCell.className = 'px-4 py-3';

    const isActive = item.status === 'active';
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.setAttribute('aria-label', item.label ? `Delete ${item.label}` : 'Delete secret');

    if (isActive) {
      deleteBtn.className =
        'text-text-muted hover:text-danger focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg focus:outline-hidden rounded transition-colors cursor-pointer';
      deleteBtn.addEventListener('click', () => {
        onDelete(item.id, deleteBtn);
      });
    } else {
      deleteBtn.className = 'text-text-muted opacity-40 cursor-not-allowed';
      deleteBtn.disabled = true;
      deleteBtn.setAttribute('aria-disabled', 'true');
    }

    const trashIcon = createIcon(Trash2, { size: 'sm' });
    deleteBtn.appendChild(trashIcon);

    // Reshare button — only for viewed/expired rows (active has live link; deleted is intentional)
    const showReshare = item.status === 'viewed' || item.status === 'expired';
    if (showReshare) {
      const reshareBtn = document.createElement('button');
      reshareBtn.type = 'button';
      reshareBtn.setAttribute(
        'aria-label',
        item.label ? `Reshare ${item.label}` : 'Reshare secret',
      );
      reshareBtn.className =
        'mr-2 text-text-muted hover:text-accent focus:ring-2 focus:ring-accent focus:ring-offset-2 ' +
        'focus:ring-offset-bg focus:outline-hidden rounded transition-colors cursor-pointer text-sm font-medium';
      reshareBtn.textContent = 'Reshare';

      reshareBtn.addEventListener('click', () => {
        const params = new URLSearchParams();
        if (item.label) params.set('label', item.label);
        params.set('expiry', roundToNearestExpiry(item.createdAt, item.expiresAt));
        if (item.notify) params.set('notify', '1');
        navigate(`/create?${params.toString()}`);
      });

      deleteCell.appendChild(reshareBtn);
    }

    deleteCell.appendChild(deleteBtn);
    row.appendChild(deleteCell);

    tbody.appendChild(row);
  }
}

// ---------------------------------------------------------------------------
// Main page renderer
// ---------------------------------------------------------------------------

/**
 * Render the dashboard page into the given container.
 *
 * 1. Shows loading state
 * 2. Checks session — redirects to /login if unauthenticated
 * 3. Fetches dashboard secrets
 * 4. If empty: shows empty state with "Create a Secret" CTA
 * 5. If has secrets: shows "My Secrets" heading + status tab bar + secrets table
 * 6. Logout button preserved below the secrets section
 */
export async function renderDashboardPage(container: HTMLElement): Promise<void> {
  // Loading state: prevent flash of unauthenticated content
  const loadingEl = document.createElement('p');
  loadingEl.className = 'text-text-muted text-center py-12';
  loadingEl.textContent = 'Loading\u2026';
  container.appendChild(loadingEl);

  // --- Session check ---
  let session: Session | null = null;

  try {
    const result = await authClient.getSession();
    // result.data is typed as `any` by better-auth's fully-generic client;
    // assign to unknown before type-narrowing to avoid no-unsafe-assignment.
    const data: unknown = result.data as unknown;
    if (isSession(data)) {
      session = data;
    }
  } catch {
    navigate('/login');
    return;
  }

  container.removeChild(loadingEl);

  if (!session) {
    navigate('/login');
    return;
  }

  // Fetch Pro status (subscriptionTier not on Better Auth session)
  let subscriptionTier: 'free' | 'pro' = 'free';
  let registeredAt: string | undefined;
  try {
    const meData = await getMe();
    subscriptionTier = meData.user.subscriptionTier;
    registeredAt = meData.user.createdAt;
  } catch {
    // Safe degradation: treat as free on error
  }
  const isPro = subscriptionTier === 'pro';

  // Handle post-checkout return URL params
  const urlParams = new URLSearchParams(window.location.search);
  const isUpgraded = urlParams.get('upgraded') === 'true';
  const checkoutSessionId = urlParams.get('session_id');
  const isCancelled = urlParams.get('checkout') === 'cancelled';

  // Clean up URL params without triggering navigation
  window.history.replaceState({}, '', '/dashboard');

  // Identify the authenticated user in PostHog by internal DB user ID only — ANLT-03.
  // Called on every dashboard load: covers email login returns AND OAuth callbacks
  // (callbackURL: '/dashboard'). PostHog deduplicates when distinct ID is unchanged.
  // Never pass email, name, or secretId — zero-knowledge invariant.
  identifyUser(session.user.id, subscriptionTier, registeredAt);
  captureDashboardViewed();

  // OAuth analytics: detect post-OAuth landing and fire the correct event.
  //
  // OAuth uses a full-page redirect — the browser navigates away from /login or /register
  // before any callback can fire. login.ts and register.ts set a sessionStorage flag
  // immediately before triggering authClient.signIn.social(). dashboard.ts reads the
  // flag here (on the first dashboard render after the redirect) and fires the analytics
  // event. The flag is deleted immediately after reading to prevent it from firing
  // again on subsequent dashboard visits (e.g. page refresh, SPA navigation back).
  //
  // ZERO-KNOWLEDGE INVARIANT: provider string ('google'/'github') only — no userId, no email.
  const oauthLoginProvider = sessionStorage.getItem('oauth_login_provider') as
    | 'google'
    | 'github'
    | null;
  if (oauthLoginProvider === 'google' || oauthLoginProvider === 'github') {
    sessionStorage.removeItem('oauth_login_provider');
    captureUserLoggedIn(oauthLoginProvider);
  }

  const oauthRegisterProvider = sessionStorage.getItem('oauth_register_provider') as
    | 'google'
    | 'github'
    | null;
  if (oauthRegisterProvider === 'google' || oauthRegisterProvider === 'github') {
    sessionStorage.removeItem('oauth_register_provider');
    captureUserRegistered(oauthRegisterProvider);
  }

  // --- Page wrapper ---
  const wrapper = document.createElement('div');
  wrapper.className = 'space-y-6';

  // --- Page header ---
  const pageHeader = document.createElement('header');
  pageHeader.className = 'space-y-1';

  const heading = document.createElement('h1');
  heading.className = 'text-2xl sm:text-3xl font-heading font-semibold text-text-primary';
  heading.textContent = 'My Secrets';

  const subheading = document.createElement('p');
  subheading.className = 'text-text-muted text-sm';
  subheading.textContent = 'Your secret history \u2014 only you can see this.';

  pageHeader.appendChild(heading);
  pageHeader.appendChild(subheading);
  wrapper.appendChild(pageHeader);

  // --- Secrets section (will be populated after fetch) ---
  const secretsSection = document.createElement('div');
  secretsSection.className = 'space-y-4';
  wrapper.appendChild(secretsSection);

  // --- Logout card ---
  const logoutCard = document.createElement('div');
  logoutCard.className = 'bg-surface border border-surface-border rounded-xl p-4 shadow-sm';

  const logoutTopRow = document.createElement('div');
  logoutTopRow.className = 'flex items-center justify-between';

  const logoutInfo = document.createElement('div');
  logoutInfo.className = 'text-sm text-text-secondary';
  logoutInfo.textContent = `Signed in as ${session.user.email}`;

  if (isPro) {
    const proBadge = document.createElement('span');
    proBadge.className =
      'inline-flex items-center gap-1 ml-2 px-2 py-0.5 rounded-full bg-accent/15 text-accent text-xs font-semibold';
    proBadge.textContent = 'Pro';
    proBadge.setAttribute('aria-label', 'Pro subscriber');
    logoutInfo.appendChild(proBadge);
  }

  logoutTopRow.appendChild(logoutInfo);

  const logoutButton = document.createElement('button');
  logoutButton.type = 'button';
  logoutButton.className =
    'px-4 py-2 rounded-lg border border-border text-text-secondary text-sm font-medium hover:bg-surface hover:text-text-primary focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg focus:outline-hidden transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
  logoutButton.textContent = 'Log out';

  logoutButton.addEventListener('click', () => {
    void (async () => {
      logoutButton.disabled = true;
      logoutButton.textContent = 'Logging out\u2026';

      await authClient.signOut();
      // Reset PostHog identity so the next anonymous session gets a fresh distinct ID.
      // Must be called after signOut() resolves to ensure the identified session ends first.
      resetAnalyticsIdentity();
      // Hide the nav link immediately — Better Auth's client cache may not
      // reflect the cleared session until the next getSession() round-trip.
      document.getElementById('nav-dashboard-link')?.classList.add('hidden');
      navigate('/');
    })();
  });

  logoutTopRow.appendChild(logoutButton);
  logoutCard.appendChild(logoutTopRow);

  // Billing action: upgrade CTA for free users, Manage Subscription for Pro
  const billingRow = document.createElement('div');
  billingRow.className = 'mt-3 pt-3 border-t border-border';

  if (isPro) {
    // Pro: show Manage Subscription link
    const manageBtn = document.createElement('button');
    manageBtn.type = 'button';
    manageBtn.className =
      'text-sm text-accent hover:text-accent-hover underline-offset-2 hover:underline focus:ring-2 focus:ring-accent focus:outline-hidden rounded transition-colors cursor-pointer';
    manageBtn.textContent = 'Manage Subscription';
    manageBtn.addEventListener('click', () => {
      void (async () => {
        manageBtn.disabled = true;
        manageBtn.textContent = 'Opening\u2026';
        try {
          const { url } = await createPortalSession();
          window.open(url, '_blank');
        } catch {
          showToast('Could not open subscription portal. Please try again.');
        } finally {
          manageBtn.disabled = false;
          manageBtn.textContent = 'Manage Subscription';
        }
      })();
    });
    billingRow.appendChild(manageBtn);
  } else {
    // Free: show upgrade CTA
    const upgradeBtn = document.createElement('button');
    upgradeBtn.type = 'button';
    upgradeBtn.className =
      'w-full px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-hover focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg focus:outline-hidden transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
    upgradeBtn.textContent = 'Upgrade to Pro \u2014 $7/mo';

    upgradeBtn.addEventListener('click', () => {
      void (async () => {
        upgradeBtn.disabled = true;
        upgradeBtn.textContent = 'Redirecting to Stripe\u2026';
        try {
          const { url } = await initiateCheckout();
          captureCheckoutInitiated('dashboard');
          window.location.href = url;
        } catch {
          showToast('Could not start checkout. Please try again.');
          upgradeBtn.disabled = false;
          upgradeBtn.textContent = 'Upgrade to Pro \u2014 $7/mo';
        }
      })();
    });
    billingRow.appendChild(upgradeBtn);

    // Sub-note under upgrade button
    const upgradeNote = document.createElement('p');
    upgradeNote.className = 'mt-1.5 text-xs text-text-muted text-center';
    upgradeNote.textContent = 'or $5.42/mo billed annually \u00b7 Cancel anytime';
    billingRow.appendChild(upgradeNote);
  }

  logoutCard.appendChild(billingRow);

  // Danger zone: account deletion
  const dangerRow = document.createElement('div');
  dangerRow.className = 'mt-3 pt-3 border-t border-border flex items-center justify-between';

  const dangerLabel = document.createElement('div');
  dangerLabel.className = 'text-sm text-text-muted';
  dangerLabel.textContent = 'Danger zone';

  const deleteAccountBtn = document.createElement('button');
  deleteAccountBtn.type = 'button';
  deleteAccountBtn.className =
    'px-3 py-1.5 rounded-lg border border-danger/40 text-danger text-sm font-medium hover:bg-danger/10 hover:border-danger focus:ring-2 focus:ring-danger focus:ring-offset-2 focus:ring-offset-surface focus:outline-hidden transition-all cursor-pointer';
  deleteAccountBtn.textContent = 'Delete account';

  deleteAccountBtn.addEventListener('click', () => {
    const modal = createDeleteAccountModal(deleteAccountBtn);
    document.body.appendChild(modal);
  });

  dangerRow.appendChild(dangerLabel);
  dangerRow.appendChild(deleteAccountBtn);
  logoutCard.appendChild(dangerRow);

  wrapper.appendChild(logoutCard);
  container.appendChild(wrapper);

  // Post-checkout: verify session or show cancellation toast
  if (isUpgraded && checkoutSessionId) {
    void (async () => {
      // Show inline verification banner with spinner
      const banner = document.createElement('div');
      banner.className =
        'mt-4 p-4 rounded-xl bg-surface border border-border flex items-center gap-3';

      const spinner = document.createElement('span');
      spinner.className =
        'block w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin';
      spinner.setAttribute('aria-hidden', 'true');

      const bannerText = document.createElement('span');
      bannerText.className = 'text-sm text-text-secondary';
      bannerText.textContent = 'Verifying your subscription\u2026';

      banner.appendChild(spinner);
      banner.appendChild(bannerText);
      // Insert banner at the top of the wrapper, before the page header
      wrapper.insertBefore(banner, wrapper.firstChild);

      try {
        await verifyCheckoutSession(checkoutSessionId);
        captureSubscriptionActivated(); // fires only on verified Stripe success
        // Success: replace spinner with success message
        spinner.remove();
        banner.className =
          'mt-4 p-4 rounded-xl bg-success/10 border border-success/30 flex items-center gap-3';
        bannerText.className = 'text-sm text-success font-medium';
        bannerText.textContent = '\u2713 You\u2019re now Pro \u2014 30-day secrets unlocked';
      } catch {
        // Verification failed: show error banner
        spinner.remove();
        banner.className =
          'mt-4 p-4 rounded-xl bg-warning/10 border border-warning/30 flex items-center gap-3';
        bannerText.className = 'text-sm text-warning';
        bannerText.textContent =
          'Subscription verifying \u2014 refresh in a moment if Pro features aren\u2019t active yet.';
      }
    })();
  } else if (isCancelled) {
    showToast('Checkout cancelled \u2014 you can upgrade anytime');
  }

  // --- Fetch dashboard secrets ---
  try {
    const response = await fetchDashboardSecrets();
    if (response.secrets.length === 0 && !response.nextCursor) {
      renderEmptyState(secretsSection);
      return;
    }
    renderSecretsTable(secretsSection, response.secrets, response.nextCursor);
  } catch {
    showToast('Failed to load secrets. Please refresh.');
    renderEmptyState(secretsSection);
    return;
  }
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function renderEmptyState(container: HTMLElement): void {
  const emptyState = document.createElement('div');
  emptyState.className = 'py-16 text-center space-y-4';

  const iconWrap = document.createElement('div');
  iconWrap.className = 'flex justify-center';
  const lockIcon = createIcon(Lock, { size: 48, class: 'text-accent opacity-50' });
  iconWrap.appendChild(lockIcon);
  emptyState.appendChild(iconWrap);

  const emptyHeading = document.createElement('h2');
  emptyHeading.className = 'text-lg font-semibold text-text-primary';
  emptyHeading.textContent = 'No secrets yet';
  emptyState.appendChild(emptyHeading);

  const emptyBody = document.createElement('p');
  emptyBody.className = 'text-sm text-text-secondary';
  emptyBody.textContent = 'Secrets you create while logged in will appear here.';
  emptyState.appendChild(emptyBody);

  const ctaBtn = document.createElement('button');
  ctaBtn.type = 'button';
  ctaBtn.className =
    'mt-2 px-6 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg focus:outline-hidden transition-all cursor-pointer';
  ctaBtn.textContent = 'Create a Secret';
  ctaBtn.addEventListener('click', () => {
    navigate('/create');
  });
  emptyState.appendChild(ctaBtn);

  container.appendChild(emptyState);
}

// ---------------------------------------------------------------------------
// Secrets table with tab filter
// ---------------------------------------------------------------------------

export function renderSecretsTable(
  container: HTMLElement,
  initialSecrets: DashboardSecretItem[],
  initialNextCursor: string | null,
): void {
  // Module-level state for this table instance
  let currentCursor: string | null = initialNextCursor;
  let currentStatus: TabValue = 'all';
  let isLoadingMore = false;
  // Per-page rows accumulator (used for delete handler — does not grow unboundedly, only current page)
  let pageRows: DashboardSecretItem[] = [...initialSecrets];

  // --- Tab bar (same structure as before) ---
  const tabNav = document.createElement('nav');
  tabNav.setAttribute('role', 'tablist');
  tabNav.setAttribute('aria-label', 'Filter by status');
  tabNav.className = 'flex gap-1 flex-wrap';

  const tabs: TabValue[] = ['all', 'active', 'viewed', 'expired', 'deleted'];
  const tabLabels: Record<TabValue, string> = {
    all: 'All',
    active: 'Active',
    viewed: 'Viewed',
    expired: 'Expired',
    deleted: 'Deleted',
  };

  const tabButtons: Map<TabValue, HTMLButtonElement> = new Map();

  for (const tab of tabs) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', tab === currentStatus ? 'true' : 'false');
    btn.className = getTabClass(tab === currentStatus);
    btn.textContent = tabLabels[tab];
    tabButtons.set(tab, btn);
    tabNav.appendChild(btn);
  }

  container.appendChild(tabNav);

  // --- Table wrapper ---
  const tableWrapper = document.createElement('div');
  tableWrapper.className =
    'overflow-x-auto bg-surface border border-surface-border rounded-xl shadow-sm';

  const table = document.createElement('table');
  table.className = 'min-w-full';
  table.setAttribute('aria-label', 'Your secrets');

  const thead = document.createElement('thead');
  thead.className = 'bg-surface-raised/50';
  const headerRow = document.createElement('tr');
  const columns = ['Label', 'Created', 'Expires', 'Status', 'Notification', 'Delete'];
  for (const col of columns) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.className =
      'px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider whitespace-nowrap';
    th.textContent = col;
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  table.appendChild(tbody);
  tableWrapper.appendChild(table);
  container.appendChild(tableWrapper);

  // --- Load More button (hidden initially if no nextCursor) ---
  const loadMoreWrapper = document.createElement('div');
  loadMoreWrapper.className = 'flex justify-center pt-2';

  const loadMoreBtn = document.createElement('button');
  loadMoreBtn.type = 'button';
  loadMoreBtn.textContent = 'Load more';
  loadMoreBtn.className =
    'px-4 py-2 rounded-lg border border-border text-text-secondary text-sm font-medium ' +
    'hover:bg-surface-raised hover:text-text-primary focus:ring-2 focus:ring-accent ' +
    'focus:ring-offset-2 focus:ring-offset-surface focus:outline-hidden transition-all ' +
    'cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
  loadMoreBtn.style.display = currentCursor ? '' : 'none';

  loadMoreWrapper.appendChild(loadMoreBtn);
  container.appendChild(loadMoreWrapper);

  // --- Aria-live status region for accessibility ---
  const statusRegion = document.createElement('div');
  statusRegion.setAttribute('aria-live', 'polite');
  statusRegion.className = 'sr-only';
  container.appendChild(statusRegion);

  // --- Delete handler ---
  function handleDelete(id: string, triggerEl: HTMLElement): void {
    const item = pageRows.find((s) => s.id === id);
    if (!item) return;

    const modal = createConfirmModal(
      item.label,
      triggerEl,
      () => {
        void (async () => {
          triggerEl.setAttribute('disabled', '');
          try {
            await deleteDashboardSecret(id);
            // Update status in pageRows (do not re-fetch — preserve cursor state)
            const target = pageRows.find((s) => s.id === id);
            if (target) {
              target.status = 'deleted';
            }
            // Re-render current page rows only (server-driven — no filterSecrets)
            renderTableBody(tbody, pageRows, handleDelete);
            showToast('Secret deleted.');
          } catch {
            triggerEl.removeAttribute('disabled');
            showToast('Failed to delete. Please try again.');
          }
        })();
      },
      () => {
        /* cancel — no action needed */
      },
    );
    document.body.appendChild(modal);
  }

  // --- fetchPage: fetch one page and append/replace rows ---
  async function fetchPage(): Promise<void> {
    const isFirstPage = currentCursor === null && pageRows.length === 0;
    try {
      const response = await fetchDashboardSecrets({
        cursor: currentCursor ?? undefined,
        status: currentStatus,
      });

      // On first page fetch (tab switch cleared pageRows): set tbody
      // On Load More: APPEND rows
      if (isFirstPage || pageRows.length === 0) {
        pageRows = [...response.secrets];
        renderTableBody(tbody, pageRows, handleDelete);
      } else {
        // Append new rows to pageRows accumulator
        const newItems = response.secrets;
        pageRows = [...pageRows, ...newItems];
        // Append only the new rows to tbody (avoid full re-render)
        for (const item of newItems) {
          const tempTbody = document.createElement('tbody');
          renderTableBody(tempTbody, [item], handleDelete);
          while (tempTbody.firstChild) {
            tbody.appendChild(tempTbody.firstChild);
          }
        }
      }

      currentCursor = response.nextCursor;
      loadMoreBtn.style.display = currentCursor ? '' : 'none';

      if (response.secrets.length > 0) {
        statusRegion.textContent = `${response.secrets.length.toString()} more secrets loaded`;
      }
    } catch {
      showToast('Failed to load secrets. Please try again.');
    } finally {
      isLoadingMore = false;
      // Restore Load More button state
      const spinner = loadMoreBtn.querySelector('span[aria-hidden]');
      if (spinner) spinner.remove();
      loadMoreBtn.textContent = 'Load more';
      loadMoreBtn.disabled = false;
    }
  }

  // --- Load More click handler ---
  loadMoreBtn.addEventListener('click', () => {
    if (isLoadingMore || !currentCursor) return;
    isLoadingMore = true;
    loadMoreBtn.disabled = true;

    // Show spinner
    loadMoreBtn.textContent = 'Loading\u2026';
    const spinner = document.createElement('span');
    spinner.className =
      'inline-block w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin mr-2 align-middle';
    spinner.setAttribute('aria-hidden', 'true');
    loadMoreBtn.prepend(spinner);

    void fetchPage();
  });

  // --- Tab click handlers ---
  for (const [tab, btn] of tabButtons) {
    btn.addEventListener('click', () => {
      if (tab === currentStatus) return; // no-op if already on this tab
      // Update selected state
      for (const [t, b] of tabButtons) {
        b.setAttribute('aria-selected', t === tab ? 'true' : 'false');
        b.className = getTabClass(t === tab);
      }
      currentStatus = tab;
      currentCursor = null;
      isLoadingMore = false;
      pageRows = [];
      // Clear tbody
      while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
      loadMoreBtn.style.display = 'none';
      void fetchPage();
    });
  }

  // Initial render using the already-fetched first page
  renderTableBody(tbody, pageRows, handleDelete);
}

function getTabClass(isActive: boolean): string {
  const base =
    'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:ring-2 focus:ring-accent focus:outline-hidden cursor-pointer';
  return isActive
    ? `${base} bg-accent/10 text-accent`
    : `${base} text-text-muted hover:text-text-secondary`;
}

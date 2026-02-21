/**
 * Dashboard page — authenticated user's secret history.
 *
 * Shows a table of all secrets the user has created while logged in,
 * with status badge, tab filter, delete modal, and empty state.
 *
 * Session guard: redirects to /login on mount if there is no active session.
 */

import { Circle, CheckCircle2, Clock, Trash2, Lock, Bell } from 'lucide';
import { authClient } from '../api/auth-client.js';
import { fetchDashboardSecrets, deleteDashboardSecret } from '../api/client.js';
import { createIcon } from '../components/icons.js';
import { showToast } from '../components/toast.js';
import { navigate } from '../router.js';
import { identifyUser, resetAnalyticsIdentity } from '../analytics/posthog.js';
import type { DashboardSecretItem } from '../../../shared/types/api.js';

// ---------------------------------------------------------------------------
// Auth session types + guard (same pattern as Phase 22)
// ---------------------------------------------------------------------------

/**
 * Shape of a Better Auth session user.
 * Typed explicitly to avoid unsafe `any` member access on the library return value.
 */
interface SessionUser {
  id: string;
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
  return typeof user['id'] === 'string' && typeof user['email'] === 'string';
}

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
// Table rendering
// ---------------------------------------------------------------------------

type TabValue = 'all' | 'active' | 'viewed' | 'expired' | 'deleted';

function filterSecrets(allSecrets: DashboardSecretItem[], tab: TabValue): DashboardSecretItem[] {
  if (tab === 'all') return allSecrets;
  return allSecrets.filter((s) => s.status === tab);
}

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

  // Identify the authenticated user in PostHog by internal DB user ID only — ANLT-03.
  // Called on every dashboard load: covers email login returns AND OAuth callbacks
  // (callbackURL: '/dashboard'). PostHog deduplicates when distinct ID is unchanged.
  // Never pass email, name, or secretId — zero-knowledge invariant.
  identifyUser(session.user.id);

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
  logoutCard.className =
    'bg-surface border border-surface-border rounded-xl p-4 shadow-sm flex items-center justify-between';

  const logoutInfo = document.createElement('div');
  logoutInfo.className = 'text-sm text-text-secondary';
  logoutInfo.textContent = `Signed in as ${session.user.email}`;
  logoutCard.appendChild(logoutInfo);

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

  logoutCard.appendChild(logoutButton);
  wrapper.appendChild(logoutCard);
  container.appendChild(wrapper);

  // --- Fetch dashboard secrets ---
  let allSecrets: DashboardSecretItem[];

  try {
    const response = await fetchDashboardSecrets();
    allSecrets = response.secrets;
  } catch {
    showToast('Failed to load secrets. Please refresh.');
    renderEmptyState(secretsSection);
    return;
  }

  // --- Render content based on secrets count ---
  if (allSecrets.length === 0) {
    renderEmptyState(secretsSection);
    return;
  }

  renderSecretsTable(secretsSection, allSecrets);
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
    navigate('/');
  });
  emptyState.appendChild(ctaBtn);

  container.appendChild(emptyState);
}

// ---------------------------------------------------------------------------
// Secrets table with tab filter
// ---------------------------------------------------------------------------

function renderSecretsTable(container: HTMLElement, initialSecrets: DashboardSecretItem[]): void {
  // Module-level state for this table instance
  const allSecrets: DashboardSecretItem[] = [...initialSecrets];
  let currentTab: TabValue = 'all';

  // --- Tab bar ---
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
    btn.setAttribute('aria-selected', tab === currentTab ? 'true' : 'false');
    btn.className = getTabClass(tab === currentTab);
    btn.textContent = tabLabels[tab];
    tabButtons.set(tab, btn);
    tabNav.appendChild(btn);
  }

  container.appendChild(tabNav);

  // --- Table wrapper (horizontally scrollable for mobile) ---
  const tableWrapper = document.createElement('div');
  tableWrapper.className =
    'overflow-x-auto bg-surface border border-surface-border rounded-xl shadow-sm';

  const table = document.createElement('table');
  table.className = 'min-w-full';
  table.setAttribute('aria-label', 'Your secrets');

  // thead
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

  // tbody
  const tbody = document.createElement('tbody');
  table.appendChild(tbody);
  tableWrapper.appendChild(table);
  container.appendChild(tableWrapper);

  // --- Delete handler ---
  function handleDelete(id: string, triggerEl: HTMLElement): void {
    const item = allSecrets.find((s) => s.id === id);
    if (!item) return;

    const modal = createConfirmModal(
      item.label,
      triggerEl,
      () => {
        // On confirm
        void (async () => {
          triggerEl.setAttribute('disabled', '');
          try {
            await deleteDashboardSecret(id);
            // Update status in place
            const target = allSecrets.find((s) => s.id === id);
            if (target) {
              target.status = 'deleted';
            }
            renderTableBody(tbody, filterSecrets(allSecrets, currentTab), handleDelete);
            showToast('Secret deleted.');
          } catch {
            triggerEl.removeAttribute('disabled');
            showToast('Failed to delete. Please try again.');
          }
        })();
      },
      () => {
        // On cancel — nothing extra needed; close() in modal returns focus to triggerEl
      },
    );

    document.body.appendChild(modal);
  }

  // Initial render
  renderTableBody(tbody, filterSecrets(allSecrets, currentTab), handleDelete);

  // --- Tab click handlers ---
  for (const [tab, btn] of tabButtons) {
    btn.addEventListener('click', () => {
      // Update selected state
      for (const [t, b] of tabButtons) {
        b.setAttribute('aria-selected', t === tab ? 'true' : 'false');
        b.className = getTabClass(t === tab);
      }
      currentTab = tab;
      renderTableBody(tbody, filterSecrets(allSecrets, currentTab), handleDelete);
    });
  }
}

function getTabClass(isActive: boolean): string {
  const base =
    'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:ring-2 focus:ring-accent focus:outline-hidden cursor-pointer';
  return isActive
    ? `${base} bg-accent/10 text-accent`
    : `${base} text-text-muted hover:text-text-secondary`;
}

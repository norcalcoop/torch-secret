/**
 * Dashboard stub page.
 *
 * Minimal authenticated dashboard for Phase 22 auth validation.
 * Shows the logged-in user's name and email, and provides a logout button.
 *
 * If there is no active session, redirects to /login immediately.
 * Full dashboard (secret history, labels, deletion) is Phase 23.
 */

import { authClient } from '../api/auth-client.js';
import { navigate } from '../router.js';

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
 * Render the dashboard page into the given container.
 *
 * Checks session on mount. Redirects to /login if unauthenticated.
 * Renders user name + email and a logout button when authenticated.
 */
export async function renderDashboardPage(container: HTMLElement): Promise<void> {
  // Loading state: prevent flash of unauthenticated content
  const loadingEl = document.createElement('p');
  loadingEl.className = 'text-text-muted text-center py-12';
  loadingEl.textContent = 'Loading...';
  container.appendChild(loadingEl);

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

  // Remove loading state
  container.removeChild(loadingEl);

  if (!session) {
    navigate('/login');
    return;
  }

  const { user } = session;

  // -- Page wrapper --
  const wrapper = document.createElement('div');
  wrapper.className = 'space-y-6';

  // -- Header --
  const header = document.createElement('header');
  header.className = 'text-center space-y-2';

  const heading = document.createElement('h1');
  heading.className = 'text-2xl sm:text-3xl font-heading font-semibold text-text-primary';
  heading.textContent = 'Dashboard';

  const subtext = document.createElement('p');
  subtext.className = 'text-text-muted';
  subtext.textContent = 'Manage your account and shared secrets.';

  header.appendChild(heading);
  header.appendChild(subtext);
  wrapper.appendChild(header);

  // -- User info card --
  const card = document.createElement('div');
  card.className = 'bg-surface border border-surface-border rounded-xl p-6 space-y-4 shadow-sm';

  const userInfoSection = document.createElement('div');
  userInfoSection.className = 'space-y-1';

  const nameLabel = document.createElement('p');
  nameLabel.className = 'text-xs font-medium text-text-muted uppercase tracking-wide';
  nameLabel.textContent = 'Name';

  const nameValue = document.createElement('p');
  nameValue.className = 'text-text-primary font-medium';
  nameValue.textContent = user.name ?? '';

  const emailLabel = document.createElement('p');
  emailLabel.className = 'text-xs font-medium text-text-muted uppercase tracking-wide mt-3';
  emailLabel.textContent = 'Email';

  const emailValue = document.createElement('p');
  emailValue.className = 'text-text-primary';
  emailValue.textContent = user.email;

  userInfoSection.appendChild(nameLabel);
  userInfoSection.appendChild(nameValue);
  userInfoSection.appendChild(emailLabel);
  userInfoSection.appendChild(emailValue);
  card.appendChild(userInfoSection);

  // -- Logout button --
  const logoutButton = document.createElement('button');
  logoutButton.type = 'button';
  logoutButton.className =
    'w-full min-h-[44px] py-3 rounded-lg border border-border text-text-secondary font-medium hover:bg-surface hover:text-text-primary focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg focus:outline-hidden transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
  logoutButton.textContent = 'Log out';

  logoutButton.addEventListener('click', () => {
    void (async () => {
      logoutButton.disabled = true;
      logoutButton.textContent = 'Logging out...';

      const result = await authClient.signOut();
      if (!result.error) {
        navigate('/');
      } else {
        // Navigate home regardless — session may already be gone
        navigate('/');
      }
    })();
  });

  card.appendChild(logoutButton);
  wrapper.appendChild(card);
  container.appendChild(wrapper);
}

/**
 * Login page.
 *
 * Renders an email/password sign-in form plus Google and GitHub OAuth buttons.
 * Handles three states: idle, loading (submit disabled + spinner), and error
 * (inline alert below the form). On success, navigates to /dashboard.
 *
 * On mount, checks for an active session and redirects to /dashboard immediately
 * if the user is already authenticated.
 *
 * Also checks for ?error=oauth in the URL (set by the OAuth error callback) and
 * shows an inline error if present.
 */

import { authClient, isSession } from '../api/auth-client.js';
import { navigate } from '../router.js';
import { Github, Eye, EyeOff } from 'lucide';
import { createIcon } from '../components/icons.js';
import { identifyUser, captureUserLoggedIn } from '../analytics/posthog.js';

/**
 * Render the login page into the given container.
 */
export async function renderLoginPage(container: HTMLElement): Promise<void> {
  // Already-authenticated redirect: check session before rendering the form
  try {
    const result = await authClient.getSession();
    const data: unknown = result.data as unknown;
    if (isSession(data)) {
      navigate('/dashboard');
      return;
    }
  } catch {
    // Session check failed — fall through and render the form
  }

  // -- Page wrapper --
  const wrapper = document.createElement('div');
  wrapper.className = 'space-y-6';

  // -- Header --
  const header = document.createElement('header');
  header.className = 'text-center space-y-2';

  const heading = document.createElement('h1');
  heading.className = 'text-2xl sm:text-3xl font-heading font-semibold text-text-primary';
  heading.textContent = 'Sign In';

  const subtext = document.createElement('p');
  subtext.className = 'text-text-muted';
  subtext.textContent = 'Welcome back';

  header.appendChild(heading);
  header.appendChild(subtext);
  wrapper.appendChild(header);

  // -- Card (glassmorphism surface) --
  const card = document.createElement('div');
  card.className = 'bg-surface border border-surface-border rounded-xl p-6 space-y-4 shadow-sm';

  // -- Email/password form --
  const form = document.createElement('form');
  form.className = 'space-y-4';
  form.noValidate = true;

  // Email field
  const emailGroup = document.createElement('div');
  emailGroup.className = 'space-y-1';

  const emailLabel = document.createElement('label');
  emailLabel.htmlFor = 'login-email';
  emailLabel.className = 'block text-sm font-medium text-text-secondary';
  emailLabel.textContent = 'Email';

  const emailInput = document.createElement('input');
  emailInput.type = 'email';
  emailInput.id = 'login-email';
  emailInput.name = 'email';
  emailInput.autocomplete = 'email';
  emailInput.required = true;
  emailInput.placeholder = 'you@example.com';
  emailInput.className =
    'w-full px-3 py-2 min-h-[44px] border border-border rounded-lg bg-surface text-text-primary placeholder-text-muted focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg focus:outline-hidden';

  emailGroup.appendChild(emailLabel);
  emailGroup.appendChild(emailInput);
  form.appendChild(emailGroup);

  // Password field
  const passwordGroup = document.createElement('div');
  passwordGroup.className = 'space-y-1';

  const passwordLabel = document.createElement('label');
  passwordLabel.htmlFor = 'login-password';
  passwordLabel.className = 'block text-sm font-medium text-text-secondary';
  passwordLabel.textContent = 'Password';

  const passwordInput = document.createElement('input');
  passwordInput.type = 'password';
  passwordInput.id = 'login-password';
  passwordInput.name = 'password';
  passwordInput.autocomplete = 'current-password';
  passwordInput.required = true;
  passwordInput.className =
    'w-full px-3 py-2 pr-10 min-h-[44px] border border-border rounded-lg bg-surface text-text-primary placeholder-text-muted focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg focus:outline-hidden';

  const passwordWrapper = document.createElement('div');
  passwordWrapper.className = 'relative';
  passwordWrapper.appendChild(passwordInput);

  const revealToggle = document.createElement('button');
  revealToggle.type = 'button';
  revealToggle.setAttribute('aria-label', 'Show password');
  revealToggle.className =
    'absolute inset-y-0 right-0 flex items-center px-3 text-text-muted hover:text-text-secondary focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset focus:outline-none rounded-r-lg transition-colors cursor-pointer';

  const eyeEl = createIcon(Eye, { size: 'sm', class: 'pointer-events-none' });
  const eyeOffEl = createIcon(EyeOff, { size: 'sm', class: 'pointer-events-none hidden' });
  revealToggle.appendChild(eyeEl);
  revealToggle.appendChild(eyeOffEl);

  let passwordVisible = false;
  revealToggle.addEventListener('click', () => {
    passwordVisible = !passwordVisible;
    passwordInput.type = passwordVisible ? 'text' : 'password';
    revealToggle.setAttribute('aria-label', passwordVisible ? 'Hide password' : 'Show password');
    eyeEl.classList.toggle('hidden', passwordVisible);
    eyeOffEl.classList.toggle('hidden', !passwordVisible);
  });

  passwordWrapper.appendChild(revealToggle);

  passwordGroup.appendChild(passwordLabel);
  passwordGroup.appendChild(passwordWrapper);
  form.appendChild(passwordGroup);

  // Error message area
  const errorArea = document.createElement('div');
  errorArea.className = 'hidden px-4 py-3 rounded-lg bg-danger/10 text-danger text-sm';
  errorArea.setAttribute('role', 'alert');
  form.appendChild(errorArea);

  // Check for OAuth error in URL (?error=oauth)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('error') === 'oauth') {
    showError(errorArea, 'OAuth sign-in failed. Please try again or use email and password.');
  }

  // Submit button
  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.className =
    'w-full min-h-[44px] py-3 rounded-lg bg-accent text-white font-semibold hover:bg-accent-hover focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg focus:outline-hidden transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.98]';
  submitButton.textContent = 'Sign In';
  form.appendChild(submitButton);

  // Submit handler
  form.addEventListener('submit', (e) => {
    void (async () => {
      e.preventDefault();

      // Clear previous errors
      hideError(errorArea);

      const email = emailInput.value.trim();
      const password = passwordInput.value;

      if (!email || !password) {
        showError(errorArea, 'Please enter your email and password.');
        return;
      }

      // Loading state
      setFormLoading(true, submitButton, emailInput, passwordInput);

      try {
        const { data, error } = await authClient.signIn.email({
          email,
          password,
          callbackURL: '/dashboard',
        });

        if (error) {
          const code = (error as { code?: string }).code ?? '';
          const msg = (error as { message?: string }).message ?? '';
          if (
            code === 'invalid_credentials' ||
            code === 'INVALID_EMAIL_OR_PASSWORD' ||
            msg.toLowerCase().includes('invalid') ||
            msg.toLowerCase().includes('password')
          ) {
            showError(errorArea, 'Invalid email or password.');
          } else if (
            code === 'email_not_verified' ||
            code === 'EMAIL_NOT_VERIFIED' ||
            msg.toLowerCase().includes('verif')
          ) {
            showError(errorArea, 'Please verify your email before signing in. Check your inbox.');
          } else {
            showError(errorArea, msg || 'Sign-in failed. Please try again.');
          }
          setFormLoading(false, submitButton, emailInput, passwordInput);
          return;
        }

        if (data !== null && data !== undefined) {
          // Identify user in PostHog by internal ID (not email) — ANLT-03
          try {
            const sessionResult = await authClient.getSession();
            const sessionData: unknown = sessionResult.data as unknown;
            if (isSession(sessionData)) {
              identifyUser(sessionData.user.id);
            }
          } catch {
            // Session retrieval failure: analytics identify skipped silently
          }
          captureUserLoggedIn('email');
          navigate('/dashboard');
        } else {
          showError(errorArea, 'Sign-in failed. Please try again.');
          setFormLoading(false, submitButton, emailInput, passwordInput);
        }
      } catch {
        showError(errorArea, 'Something went wrong. Please try again.');
        setFormLoading(false, submitButton, emailInput, passwordInput);
      }
    })();
  });

  card.appendChild(form);

  // -- OAuth divider --
  const divider = createOAuthDivider();
  card.appendChild(divider);

  // -- OAuth buttons --
  const oauthContainer = document.createElement('div');
  oauthContainer.className = 'space-y-3';

  const googleButton = createOAuthButton('google', 'Continue with Google', 'Sign in with Google');
  const githubButton = createOAuthButton('github', 'Continue with GitHub', 'Sign in with GitHub');

  oauthContainer.appendChild(googleButton);
  oauthContainer.appendChild(githubButton);
  card.appendChild(oauthContainer);

  wrapper.appendChild(card);

  // -- Footer link --
  const footer = document.createElement('p');
  footer.className = 'text-center text-sm text-text-muted';

  const footerText = document.createTextNode("Don't have an account? ");
  const signupLink = document.createElement('a');
  signupLink.href = '/register';
  signupLink.className =
    'text-accent font-medium hover:underline focus:outline-hidden focus:ring-2 focus:ring-accent rounded';
  signupLink.textContent = 'Sign up';
  signupLink.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/register');
  });

  footer.appendChild(footerText);
  footer.appendChild(signupLink);
  wrapper.appendChild(footer);

  container.appendChild(wrapper);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Show an error message in the error area.
 */
function showError(errorArea: HTMLElement, message: string): void {
  errorArea.textContent = message;
  errorArea.classList.remove('hidden');
}

/**
 * Hide the error area.
 */
function hideError(errorArea: HTMLElement): void {
  errorArea.textContent = '';
  errorArea.classList.add('hidden');
}

/**
 * Toggle the loading state on the form controls and submit button.
 */
function setFormLoading(
  loading: boolean,
  submitButton: HTMLButtonElement,
  emailInput: HTMLInputElement,
  passwordInput: HTMLInputElement,
): void {
  submitButton.disabled = loading;
  emailInput.disabled = loading;
  passwordInput.disabled = loading;
  submitButton.textContent = loading ? 'Signing in...' : 'Sign In';
}

/**
 * Create the "or continue with" divider between the form and OAuth buttons.
 */
function createOAuthDivider(): HTMLElement {
  const divider = document.createElement('div');
  divider.className = 'flex items-center gap-3 my-2';
  divider.setAttribute('aria-hidden', 'true');

  const lineLeft = document.createElement('div');
  lineLeft.className = 'flex-1 h-px bg-border';

  const label = document.createElement('span');
  label.className = 'text-xs text-text-muted whitespace-nowrap';
  label.textContent = 'or continue with';

  const lineRight = document.createElement('div');
  lineRight.className = 'flex-1 h-px bg-border';

  divider.appendChild(lineLeft);
  divider.appendChild(label);
  divider.appendChild(lineRight);
  return divider;
}

/**
 * Create an OAuth sign-in button for Google or GitHub.
 *
 * Clicking the button triggers a full redirect via authClient.signIn.social().
 * No return value handling is needed — the browser navigates away.
 */
function createOAuthButton(
  provider: 'google' | 'github',
  label: string,
  ariaLabel: string,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('aria-label', ariaLabel);
  button.className =
    'w-full min-h-[44px] py-2.5 px-4 rounded-lg border border-border bg-surface text-text-primary font-medium text-sm flex items-center justify-center gap-2.5 hover:bg-surface-raised focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg focus:outline-hidden transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

  // Provider icon
  let iconEl: SVGSVGElement;
  if (provider === 'github') {
    iconEl = createIcon(Github, { size: 'sm', class: 'text-text-primary' });
  } else {
    // Google — inline SVG built via DOM (Lucide does not ship brand icons)
    iconEl = createGoogleIconSvg();
  }
  iconEl.setAttribute('aria-hidden', 'true');

  const labelEl = document.createElement('span');
  labelEl.textContent = label;

  button.appendChild(iconEl);
  button.appendChild(labelEl);

  button.addEventListener('click', () => {
    void (async () => {
      // Set a flag before the OAuth redirect so dashboard.ts can fire the
      // captureUserLoggedIn analytics event after the full-page redirect completes.
      // sessionStorage survives the same-origin redirect but is cleared by dashboard.ts
      // immediately after reading, preventing stale flags on subsequent dashboard visits.
      sessionStorage.setItem('oauth_login_provider', provider);

      const { error } = await authClient.signIn.social({
        provider,
        callbackURL: '/dashboard',
        errorCallbackURL: '/login?error=oauth',
      });

      // If the initiation call itself fails (e.g. provider not configured on the server,
      // network error), the redirectPlugin never fires — navigate to the error URL manually
      // so the user sees a visible error instead of a silent no-op.
      if (error) {
        sessionStorage.removeItem('oauth_login_provider');
        window.location.href = '/login?error=oauth';
      }
    })();
  });

  return button;
}

/**
 * Build the Google "G" multicolor SVG icon using DOM APIs (no innerHTML).
 * Lucide does not include brand icons, so this is constructed manually.
 */
function createGoogleIconSvg(): SVGSVGElement {
  const NS = 'http://www.w3.org/2000/svg';

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'flex-shrink-0');

  // Blue segment (top-right)
  const blueG = document.createElementNS(NS, 'path');
  blueG.setAttribute('fill', '#4285F4');
  blueG.setAttribute(
    'd',
    'M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z',
  );

  // Green segment (bottom-right)
  const greenG = document.createElementNS(NS, 'path');
  greenG.setAttribute('fill', '#34A853');
  greenG.setAttribute(
    'd',
    'M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z',
  );

  // Yellow segment (bottom-left)
  const yellowG = document.createElementNS(NS, 'path');
  yellowG.setAttribute('fill', '#FBBC05');
  yellowG.setAttribute(
    'd',
    'M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z',
  );

  // Red segment (top-left)
  const redG = document.createElementNS(NS, 'path');
  redG.setAttribute('fill', '#EA4335');
  redG.setAttribute(
    'd',
    'M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z',
  );

  svg.appendChild(blueG);
  svg.appendChild(greenG);
  svg.appendChild(yellowG);
  svg.appendChild(redG);

  return svg;
}

/**
 * Register page.
 *
 * Renders a name/email/password sign-up form plus Google and GitHub OAuth buttons.
 * Handles four states: idle, loading, error (inline alert), and success (email
 * verification notice replaces the form).
 *
 * On success, shows a "Check your email" state instead of navigating to /dashboard
 * because requireEmailVerification is enabled — an unverified user cannot log in.
 *
 * On mount, checks for an active session and redirects to /dashboard immediately
 * if the user is already authenticated.
 */

import { authClient, isSession } from '../api/auth-client.js';
import { navigate } from '../router.js';
import { Github, Mail, Flame } from 'lucide';
import { createIcon } from '../components/icons.js';
import { captureUserRegistered } from '../analytics/posthog.js';

/**
 * Render the register page into the given container.
 */
export async function renderRegisterPage(container: HTMLElement): Promise<void> {
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

  // QW2 — Check for ?plan=pro URL param to conditionally render the Pro upgrade banner
  const params = new URLSearchParams(window.location.search);
  const isPlanPro = params.get('plan') === 'pro';

  // -- Page wrapper --
  const wrapper = document.createElement('div');
  wrapper.className = 'space-y-6';

  // QW2 — Pro upgrade banner (rendered BEFORE the header, above the form)
  if (isPlanPro) {
    wrapper.appendChild(createProUpgradeBanner());
  }

  // -- Header --
  const header = document.createElement('header');
  header.className = 'text-center space-y-2';

  const heading = document.createElement('h1');
  heading.className = 'text-2xl sm:text-3xl font-heading font-semibold text-text-primary';
  heading.textContent = 'Create Account';

  const subtext = document.createElement('p');
  subtext.className = 'text-text-muted';
  subtext.textContent = 'Start sharing secrets securely';

  header.appendChild(heading);
  header.appendChild(subtext);
  wrapper.appendChild(header);

  // -- Card (glassmorphism surface) --
  const card = document.createElement('div');
  card.className = 'bg-surface border border-surface-border rounded-xl p-6 space-y-4 shadow-sm';

  // -- Registration form --
  const form = document.createElement('form');
  form.className = 'space-y-4';
  form.noValidate = true;

  // Name field
  const nameGroup = document.createElement('div');
  nameGroup.className = 'space-y-1';

  const nameLabel = document.createElement('label');
  nameLabel.htmlFor = 'register-name';
  nameLabel.className = 'block text-sm font-medium text-text-secondary';
  nameLabel.textContent = 'Name';

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.id = 'register-name';
  nameInput.name = 'name';
  nameInput.autocomplete = 'name';
  nameInput.required = true;
  nameInput.placeholder = 'Your name';
  nameInput.className =
    'w-full px-3 py-2 min-h-[44px] border border-border rounded-lg bg-surface text-text-primary placeholder-text-muted focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg focus:outline-hidden';

  nameGroup.appendChild(nameLabel);
  nameGroup.appendChild(nameInput);
  form.appendChild(nameGroup);

  // Email field
  const emailGroup = document.createElement('div');
  emailGroup.className = 'space-y-1';

  const emailLabel = document.createElement('label');
  emailLabel.htmlFor = 'register-email';
  emailLabel.className = 'block text-sm font-medium text-text-secondary';
  emailLabel.textContent = 'Email';

  const emailInput = document.createElement('input');
  emailInput.type = 'email';
  emailInput.id = 'register-email';
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
  passwordLabel.htmlFor = 'register-password';
  passwordLabel.className = 'block text-sm font-medium text-text-secondary';
  passwordLabel.textContent = 'Password';

  const passwordInput = document.createElement('input');
  passwordInput.type = 'password';
  passwordInput.id = 'register-password';
  passwordInput.name = 'password';
  passwordInput.autocomplete = 'new-password';
  passwordInput.required = true;
  passwordInput.minLength = 8;
  passwordInput.className =
    'w-full px-3 py-2 min-h-[44px] border border-border rounded-lg bg-surface text-text-primary placeholder-text-muted focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg focus:outline-hidden';

  const passwordHint = document.createElement('p');
  passwordHint.className = 'text-xs text-text-muted mt-1';
  passwordHint.textContent = 'At least 8 characters';

  passwordGroup.appendChild(passwordLabel);
  passwordGroup.appendChild(passwordInput);
  passwordGroup.appendChild(passwordHint);
  form.appendChild(passwordGroup);

  // Error message area
  const errorArea = document.createElement('div');
  errorArea.className = 'hidden px-4 py-3 rounded-lg bg-danger/10 text-danger text-sm';
  errorArea.setAttribute('role', 'alert');
  form.appendChild(errorArea);

  // Submit button
  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.className =
    'w-full min-h-[44px] py-3 rounded-lg bg-accent text-white font-semibold hover:bg-accent-hover focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg focus:outline-hidden transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.98]';
  submitButton.textContent = 'Create Account';
  form.appendChild(submitButton);

  // Marketing consent checkbox — unchecked by default (GDPR, ESEQ-04)
  const marketingConsentGroup = document.createElement('div');
  marketingConsentGroup.className = 'flex items-start gap-2.5 pt-1';

  const marketingConsentCheckbox = document.createElement('input');
  marketingConsentCheckbox.type = 'checkbox';
  marketingConsentCheckbox.id = 'marketing-consent';
  marketingConsentCheckbox.name = 'marketing-consent';
  marketingConsentCheckbox.checked = false; // unchecked by default — GDPR (ESEQ-04)
  marketingConsentCheckbox.className =
    'mt-0.5 h-4 w-4 accent-accent rounded border-border cursor-pointer';

  const marketingConsentLabel = document.createElement('label');
  marketingConsentLabel.htmlFor = 'marketing-consent';
  marketingConsentLabel.className =
    'text-sm text-text-secondary leading-tight cursor-pointer select-none';
  marketingConsentLabel.textContent = 'Send me product tips and updates';

  marketingConsentGroup.appendChild(marketingConsentCheckbox);
  marketingConsentGroup.appendChild(marketingConsentLabel);

  // Consent line (LEGAL-01, LEGAL-02) — inserted after marketing consent checkbox
  const consentLine = document.createElement('p');
  consentLine.className = 'text-xs text-text-muted text-center';

  const consentPrefix = document.createTextNode('By creating an account, you agree to our ');

  const termsLink = document.createElement('a');
  termsLink.href = '/terms';
  termsLink.className =
    'underline hover:text-text-secondary focus:outline-hidden focus:ring-2 focus:ring-accent rounded';
  termsLink.textContent = 'Terms of Service';
  termsLink.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/terms');
  });

  const andText = document.createTextNode(' and ');

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

  consentLine.appendChild(consentPrefix);
  consentLine.appendChild(termsLink);
  consentLine.appendChild(andText);
  consentLine.appendChild(privacyLink);
  consentLine.appendChild(periodText);
  form.appendChild(consentLine);
  // Insert marketing consent checkbox before consent line
  form.insertBefore(marketingConsentGroup, consentLine);

  // Submit handler
  form.addEventListener('submit', (e) => {
    void (async () => {
      e.preventDefault();

      // Clear previous errors
      hideError(errorArea);

      const name = nameInput.value.trim();
      const email = emailInput.value.trim();
      const password = passwordInput.value;

      // Client-side validation (no API call on validation failures)
      if (!name) {
        showError(errorArea, 'Name is required.');
        nameInput.focus();
        return;
      }
      if (password.length < 8) {
        showError(errorArea, 'Password must be at least 8 characters.');
        passwordInput.focus();
        return;
      }

      // Loading state
      setFormLoading(
        true,
        submitButton,
        nameInput,
        emailInput,
        passwordInput,
        marketingConsentCheckbox,
      );

      try {
        const { data, error } = await authClient.signUp.email({
          email,
          password,
          name,
          callbackURL: '/dashboard',
          marketingConsent: marketingConsentCheckbox.checked,
        } as Parameters<typeof authClient.signUp.email>[0]);

        if (error) {
          const code = (error as { code?: string }).code ?? '';
          const msg = (error as { message?: string }).message ?? '';
          if (
            code === 'user_already_exists' ||
            code === 'USER_ALREADY_EXISTS' ||
            msg.toLowerCase().includes('already exists') ||
            msg.toLowerCase().includes('already registered')
          ) {
            showError(errorArea, 'An account with this email already exists. Sign in instead.');
          } else {
            showError(errorArea, msg || 'Registration failed. Please try again.');
          }
          setFormLoading(
            false,
            submitButton,
            nameInput,
            emailInput,
            passwordInput,
            marketingConsentCheckbox,
          );
          return;
        }

        if (data !== null && data !== undefined) {
          // Email verification required — show success state instead of redirecting.
          // Capture registration event before showing verification UI — ANLT-03.
          // identifyUser is NOT called here: the user cannot log in until email is verified.
          captureUserRegistered('email');
          showEmailVerificationState(card, email);
        } else {
          showError(errorArea, 'Registration failed. Please try again.');
          setFormLoading(
            false,
            submitButton,
            nameInput,
            emailInput,
            passwordInput,
            marketingConsentCheckbox,
          );
        }
      } catch {
        showError(errorArea, 'Something went wrong. Please try again.');
        setFormLoading(
          false,
          submitButton,
          nameInput,
          emailInput,
          passwordInput,
          marketingConsentCheckbox,
        );
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

  const googleButton = createOAuthButton('google', 'Continue with Google', 'Sign up with Google');
  const githubButton = createOAuthButton('github', 'Continue with GitHub', 'Sign up with GitHub');

  oauthContainer.appendChild(googleButton);
  oauthContainer.appendChild(githubButton);
  card.appendChild(oauthContainer);

  wrapper.appendChild(card);

  // -- Footer link --
  const footer = document.createElement('p');
  footer.className = 'text-center text-sm text-text-muted';

  const footerText = document.createTextNode('Already have an account? ');
  const signinLink = document.createElement('a');
  signinLink.href = '/login';
  signinLink.className =
    'text-accent font-medium hover:underline focus:outline-hidden focus:ring-2 focus:ring-accent rounded';
  signinLink.textContent = 'Sign in';
  signinLink.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/login');
  });

  footer.appendChild(footerText);
  footer.appendChild(signinLink);
  wrapper.appendChild(footer);

  container.appendChild(wrapper);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Replace the form card contents with an email verification success state.
 *
 * Called after successful sign-up. The user must verify their email before
 * they can log in, so we do NOT navigate to /dashboard.
 */
function showEmailVerificationState(card: HTMLElement, email: string): void {
  // Clear the card and replace with success content
  while (card.firstChild) {
    card.removeChild(card.firstChild);
  }

  const successContainer = document.createElement('div');
  successContainer.className = 'text-center space-y-4 py-4';

  // Mail icon using Lucide
  const iconWrapper = document.createElement('div');
  iconWrapper.className =
    'w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto';
  iconWrapper.setAttribute('aria-hidden', 'true');

  const mailIcon = createIcon(Mail, { size: 'lg', class: 'text-accent' });
  iconWrapper.appendChild(mailIcon);
  successContainer.appendChild(iconWrapper);

  // Heading
  const successHeading = document.createElement('h2');
  successHeading.className = 'text-lg font-heading font-semibold text-text-primary';
  successHeading.textContent = 'Check your email';
  successContainer.appendChild(successHeading);

  // Description
  const description = document.createElement('p');
  description.className = 'text-sm text-text-secondary leading-relaxed';
  description.textContent = `We sent a verification link to ${email}. You must verify your email before you can sign in.`;
  successContainer.appendChild(description);

  // Spam note
  const spamNote = document.createElement('p');
  spamNote.className = 'text-xs text-text-muted';
  spamNote.textContent = "Didn't receive it? Check your spam folder.";
  successContainer.appendChild(spamNote);

  // Link back to sign in
  const signInLink = document.createElement('a');
  signInLink.href = '/login';
  signInLink.className =
    'inline-block mt-2 text-sm text-accent font-medium hover:underline focus:outline-hidden focus:ring-2 focus:ring-accent rounded';
  signInLink.textContent = 'Back to sign in';
  signInLink.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/login');
  });
  successContainer.appendChild(signInLink);

  card.appendChild(successContainer);
}

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
  nameInput: HTMLInputElement,
  emailInput: HTMLInputElement,
  passwordInput: HTMLInputElement,
  marketingConsentCheckbox: HTMLInputElement,
): void {
  submitButton.disabled = loading;
  nameInput.disabled = loading;
  emailInput.disabled = loading;
  passwordInput.disabled = loading;
  marketingConsentCheckbox.disabled = loading;
  submitButton.textContent = loading ? 'Creating account...' : 'Create Account';
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
 * Create an OAuth sign-up button for Google or GitHub.
 *
 * Social sign-in does not require email verification — Better Auth
 * creates a verified account automatically for OAuth providers.
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
    // Set a flag before the OAuth redirect so dashboard.ts can fire the
    // captureUserRegistered analytics event after the full-page redirect completes.
    // OAuth new users arrive at /dashboard directly (no email verification required).
    // dashboard.ts reads and clears this flag to determine if this is a first registration.
    sessionStorage.setItem('oauth_register_provider', provider);
    void authClient.signIn.social({
      provider,
      callbackURL: '/dashboard',
      errorCallbackURL: '/register?error=oauth',
    });
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

/**
 * Create the Pro upgrade banner shown above the registration form when ?plan=pro is in the URL.
 *
 * QW2 — Surfaces the Pro value proposition at the moment the user is choosing to register.
 * URL param only (no sessionStorage) per RESEARCH.md Pitfall 5 — sessionStorage does not
 * survive OAuth redirects back to /dashboard.
 */
function createProUpgradeBanner(): HTMLElement {
  const banner = document.createElement('div');
  banner.className = 'bg-surface/60 backdrop-blur border border-border/40 rounded-xl p-4 space-y-2';

  // Row 1: Flame icon + heading
  const headingRow = document.createElement('div');
  headingRow.className = 'flex items-center gap-2';
  const flameIcon = createIcon(Flame, { size: 'sm', class: 'text-accent flex-shrink-0' });
  flameIcon.setAttribute('aria-hidden', 'true');
  const heading = document.createElement('h2');
  heading.className = 'text-base font-heading font-semibold text-text-primary';
  heading.textContent = 'Upgrading to Pro';
  headingRow.appendChild(flameIcon);
  headingRow.appendChild(heading);
  banner.appendChild(headingRow);

  // Row 2: price
  const price = document.createElement('p');
  price.className = 'text-sm text-text-secondary';
  price.textContent = '$65/year \u00b7 $5.42/mo equivalent';
  banner.appendChild(price);

  // Row 3: guarantee
  const guarantee = document.createElement('p');
  guarantee.className = 'text-xs text-text-muted';
  guarantee.textContent = '7-day money-back guarantee';
  banner.appendChild(guarantee);

  // Row 4: feature bullets
  const features = document.createElement('ul');
  features.className = 'text-sm text-text-secondary space-y-1 list-none mt-1';

  const featureItems = [
    '30-day secret expiration (vs. 7-day free)',
    'Secret dashboard and history',
    'Email notification when your secret is viewed',
  ];
  for (const text of featureItems) {
    const li = document.createElement('li');
    li.className = 'flex items-start gap-1.5';
    const bullet = document.createElement('span');
    bullet.className = 'text-accent flex-shrink-0';
    bullet.textContent = '\u2713';
    bullet.setAttribute('aria-hidden', 'true');
    const labelEl = document.createElement('span');
    labelEl.textContent = text;
    li.appendChild(bullet);
    li.appendChild(labelEl);
    features.appendChild(li);
  }
  banner.appendChild(features);

  return banner;
}

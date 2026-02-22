/**
 * Forgot password page.
 *
 * Renders a simple email form that triggers a password reset email via Better Auth.
 * After submission (success or not-found), shows a generic success state to prevent
 * email enumeration — the message is identical whether or not an account exists.
 *
 * Uses authClient.requestPasswordReset() (NOT forgotPassword — renamed in Better Auth 1.4).
 */

import { authClient } from '../api/auth-client.js';
import { navigate } from '../router.js';

/**
 * Render the forgot password page into the given container.
 */
export function renderForgotPasswordPage(container: HTMLElement): void {
  // -- Page wrapper --
  const wrapper = document.createElement('div');
  wrapper.className = 'space-y-6';

  // -- Header --
  const header = document.createElement('header');
  header.className = 'text-center space-y-2';

  const heading = document.createElement('h1');
  heading.className = 'text-2xl sm:text-3xl font-heading font-semibold text-text-primary';
  heading.textContent = 'Reset Password';

  const subtext = document.createElement('p');
  subtext.className = 'text-text-muted';
  subtext.textContent = 'Enter your email to receive a reset link';

  header.appendChild(heading);
  header.appendChild(subtext);
  wrapper.appendChild(header);

  // -- Card (glassmorphism surface) --
  const card = document.createElement('div');
  card.className = 'bg-surface border border-surface-border rounded-xl p-6 space-y-4 shadow-sm';

  // -- Email form --
  const form = document.createElement('form');
  form.className = 'space-y-4';
  form.noValidate = true;

  // Email field
  const emailGroup = document.createElement('div');
  emailGroup.className = 'space-y-1';

  const emailLabel = document.createElement('label');
  emailLabel.htmlFor = 'forgot-email';
  emailLabel.className = 'block text-sm font-medium text-text-secondary';
  emailLabel.textContent = 'Email';

  const emailInput = document.createElement('input');
  emailInput.type = 'email';
  emailInput.id = 'forgot-email';
  emailInput.name = 'email';
  emailInput.autocomplete = 'email';
  emailInput.required = true;
  emailInput.placeholder = 'you@example.com';
  emailInput.className =
    'w-full px-3 py-2 min-h-[44px] border border-border rounded-lg bg-surface text-text-primary placeholder-text-muted focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg focus:outline-hidden';

  emailGroup.appendChild(emailLabel);
  emailGroup.appendChild(emailInput);
  form.appendChild(emailGroup);

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
  submitButton.textContent = 'Send Reset Link';
  form.appendChild(submitButton);

  // Submit handler
  form.addEventListener('submit', (e) => {
    void (async () => {
      e.preventDefault();

      // Clear previous errors
      hideError(errorArea);

      const email = emailInput.value.trim();

      if (!email) {
        showError(errorArea, 'Please enter your email address.');
        return;
      }

      // Loading state
      submitButton.disabled = true;
      emailInput.disabled = true;
      submitButton.textContent = 'Sending...';

      try {
        const { error } = await authClient.requestPasswordReset({
          email,
          redirectTo: '/reset-password',
        });

        if (error) {
          const msg = (error as { message?: string }).message ?? '';
          showError(errorArea, msg || 'Failed to send reset email. Please try again.');
          submitButton.disabled = false;
          emailInput.disabled = false;
          submitButton.textContent = 'Send Reset Link';
          return;
        }

        // Success — show generic message regardless of whether account exists
        // (prevents email enumeration attacks)
        showSuccessState(card, email);
      } catch {
        showError(errorArea, 'Failed to send reset email. Please try again.');
        submitButton.disabled = false;
        emailInput.disabled = false;
        submitButton.textContent = 'Send Reset Link';
      }
    })();
  });

  card.appendChild(form);
  wrapper.appendChild(card);

  // -- Back link --
  const footer = document.createElement('p');
  footer.className = 'text-center text-sm text-text-muted';

  const backLink = document.createElement('a');
  backLink.href = '/login';
  backLink.className =
    'text-accent font-medium hover:underline focus:outline-hidden focus:ring-2 focus:ring-accent rounded';
  backLink.textContent = 'Back to sign in';
  backLink.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/login');
  });

  footer.appendChild(backLink);
  wrapper.appendChild(footer);

  container.appendChild(wrapper);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Replace the card contents with a generic success state.
 *
 * The message is intentionally identical whether or not an account exists for
 * the provided email — this prevents email enumeration.
 */
function showSuccessState(card: HTMLElement, email: string): void {
  // Clear the card and replace with success content
  while (card.firstChild) {
    card.removeChild(card.firstChild);
  }

  const successContainer = document.createElement('div');
  successContainer.className = 'text-center space-y-4 py-4';
  successContainer.setAttribute('role', 'alert');

  // Mail icon visual indicator
  const iconWrapper = document.createElement('div');
  iconWrapper.className =
    'w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto';
  iconWrapper.setAttribute('aria-hidden', 'true');

  // Envelope SVG icon using DOM APIs (no innerHTML)
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', '28');
  svg.setAttribute('height', '28');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('class', 'text-accent');
  svg.setAttribute('aria-hidden', 'true');

  const rect = document.createElementNS(NS, 'rect');
  rect.setAttribute('width', '20');
  rect.setAttribute('height', '16');
  rect.setAttribute('x', '2');
  rect.setAttribute('y', '4');
  rect.setAttribute('rx', '2');

  const polyline = document.createElementNS(NS, 'polyline');
  polyline.setAttribute('points', '2,4 12,13 22,4');

  svg.appendChild(rect);
  svg.appendChild(polyline);
  iconWrapper.appendChild(svg);
  successContainer.appendChild(iconWrapper);

  // Heading
  const successHeading = document.createElement('h2');
  successHeading.className = 'text-lg font-heading font-semibold text-text-primary';
  successHeading.textContent = 'Check your email';
  successContainer.appendChild(successHeading);

  // Description (generic to prevent enumeration)
  const description = document.createElement('p');
  description.className = 'text-sm text-text-secondary leading-relaxed';
  description.textContent = `If an account exists for ${email}, you'll receive a password reset link shortly.`;
  successContainer.appendChild(description);

  // Spam note
  const spamNote = document.createElement('p');
  spamNote.className = 'text-xs text-text-muted';
  spamNote.textContent = "Didn't receive it? Check your spam folder or try again.";
  successContainer.appendChild(spamNote);

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

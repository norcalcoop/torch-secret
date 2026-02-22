/**
 * Reset password page.
 *
 * Renders a new password / confirm password form. Extracts the reset token from
 * the URL query parameter (?token=) placed there by Better Auth when the user
 * clicks the link from their email (requestPasswordReset was called with
 * redirectTo: '/reset-password').
 *
 * If the token is missing, renders an error card with a link back to /forgot-password.
 * On success, shows a success state with a link to /login.
 */

import { authClient } from '../api/auth-client.js';
import { navigate } from '../router.js';

/**
 * Render the reset password page into the given container.
 */
export function renderResetPasswordPage(container: HTMLElement): void {
  // Extract token from URL query param — Better Auth appends ?token=<token>
  const token = new URLSearchParams(window.location.search).get('token');

  // -- Page wrapper --
  const wrapper = document.createElement('div');
  wrapper.className = 'space-y-6';

  // -- Header --
  const header = document.createElement('header');
  header.className = 'text-center space-y-2';

  const heading = document.createElement('h1');
  heading.className = 'text-2xl sm:text-3xl font-heading font-semibold text-text-primary';
  heading.textContent = 'Set New Password';

  const subtext = document.createElement('p');
  subtext.className = 'text-text-muted';
  subtext.textContent = 'Enter your new password below';

  header.appendChild(heading);
  header.appendChild(subtext);
  wrapper.appendChild(header);

  // -- Card (glassmorphism surface) --
  const card = document.createElement('div');
  card.className = 'bg-surface border border-surface-border rounded-xl p-6 space-y-4 shadow-sm';

  // If token is missing, show invalid-link error immediately
  if (!token) {
    showInvalidTokenState(card);
    wrapper.appendChild(card);
    container.appendChild(wrapper);
    return;
  }

  // -- New password form --
  const form = document.createElement('form');
  form.className = 'space-y-4';
  form.noValidate = true;

  // New password field
  const passwordGroup = document.createElement('div');
  passwordGroup.className = 'space-y-1';

  const passwordLabel = document.createElement('label');
  passwordLabel.htmlFor = 'new-password';
  passwordLabel.className = 'block text-sm font-medium text-text-secondary';
  passwordLabel.textContent = 'New password';

  const passwordInput = document.createElement('input');
  passwordInput.type = 'password';
  passwordInput.id = 'new-password';
  passwordInput.name = 'new-password';
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

  // Confirm password field
  const confirmGroup = document.createElement('div');
  confirmGroup.className = 'space-y-1';

  const confirmLabel = document.createElement('label');
  confirmLabel.htmlFor = 'confirm-password';
  confirmLabel.className = 'block text-sm font-medium text-text-secondary';
  confirmLabel.textContent = 'Confirm password';

  const confirmInput = document.createElement('input');
  confirmInput.type = 'password';
  confirmInput.id = 'confirm-password';
  confirmInput.name = 'confirm-password';
  confirmInput.autocomplete = 'new-password';
  confirmInput.required = true;
  confirmInput.className =
    'w-full px-3 py-2 min-h-[44px] border border-border rounded-lg bg-surface text-text-primary placeholder-text-muted focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg focus:outline-hidden';

  confirmGroup.appendChild(confirmLabel);
  confirmGroup.appendChild(confirmInput);
  form.appendChild(confirmGroup);

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
  submitButton.textContent = 'Reset Password';
  form.appendChild(submitButton);

  // Submit handler
  form.addEventListener('submit', (e) => {
    void (async () => {
      e.preventDefault();

      // Clear previous errors
      hideError(errorArea);

      const newPassword = passwordInput.value;
      const confirmPassword = confirmInput.value;

      // Client-side validation
      if (newPassword.length < 8) {
        showError(errorArea, 'Password must be at least 8 characters.');
        passwordInput.focus();
        return;
      }

      if (newPassword !== confirmPassword) {
        showError(errorArea, 'Passwords do not match. Please try again.');
        confirmInput.focus();
        return;
      }

      // Loading state
      submitButton.disabled = true;
      passwordInput.disabled = true;
      confirmInput.disabled = true;
      submitButton.textContent = 'Resetting...';

      try {
        const { error } = await authClient.resetPassword({
          newPassword,
          token,
        });

        if (error) {
          const msg = (error as { message?: string }).message ?? '';
          showError(errorArea, msg || 'Failed to reset password. The link may have expired.');
          submitButton.disabled = false;
          passwordInput.disabled = false;
          confirmInput.disabled = false;
          submitButton.textContent = 'Reset Password';
          return;
        }

        // Success — replace card with success state
        showSuccessState(card);
      } catch {
        showError(errorArea, 'Failed to reset password. The link may have expired.');
        submitButton.disabled = false;
        passwordInput.disabled = false;
        confirmInput.disabled = false;
        submitButton.textContent = 'Reset Password';
      }
    })();
  });

  card.appendChild(form);
  wrapper.appendChild(card);
  container.appendChild(wrapper);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Replace card contents with an invalid/missing token error state.
 * Shown when the page is loaded without a ?token= query parameter.
 */
function showInvalidTokenState(card: HTMLElement): void {
  while (card.firstChild) {
    card.removeChild(card.firstChild);
  }

  const errorContainer = document.createElement('div');
  errorContainer.className = 'text-center space-y-4 py-4';
  errorContainer.setAttribute('role', 'alert');

  const message = document.createElement('p');
  message.className = 'text-sm text-text-secondary';
  message.textContent = 'This reset link is invalid or has expired.';
  errorContainer.appendChild(message);

  const requestNewLink = document.createElement('a');
  requestNewLink.href = '/forgot-password';
  requestNewLink.className =
    'inline-block text-sm text-accent font-medium hover:underline focus:outline-hidden focus:ring-2 focus:ring-accent rounded';
  requestNewLink.textContent = 'Request a new one.';
  requestNewLink.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/forgot-password');
  });

  errorContainer.appendChild(document.createTextNode(' '));
  errorContainer.appendChild(requestNewLink);
  card.appendChild(errorContainer);
}

/**
 * Replace the form card contents with a success state.
 * Shown after a successful password reset — user can now sign in.
 */
function showSuccessState(card: HTMLElement): void {
  while (card.firstChild) {
    card.removeChild(card.firstChild);
  }

  const successContainer = document.createElement('div');
  successContainer.className = 'text-center space-y-4 py-4';
  successContainer.setAttribute('role', 'alert');

  // Heading
  const successHeading = document.createElement('h2');
  successHeading.className = 'text-lg font-heading font-semibold text-text-primary';
  successHeading.textContent = 'Password reset successfully';
  successContainer.appendChild(successHeading);

  // Description
  const description = document.createElement('p');
  description.className = 'text-sm text-text-secondary leading-relaxed';
  description.textContent = 'You can now sign in with your new password.';
  successContainer.appendChild(description);

  // Link to /login
  const signInLink = document.createElement('a');
  signInLink.href = '/login';
  signInLink.className =
    'inline-block mt-2 text-sm text-accent font-medium hover:underline focus:outline-hidden focus:ring-2 focus:ring-accent rounded';
  signInLink.textContent = 'Sign in';
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

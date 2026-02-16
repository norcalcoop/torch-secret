/**
 * Reveal secret page - two-step reveal flow with password protection.
 *
 * SECURITY-CRITICAL: This page implements the anti-bot/anti-prefetch
 * interstitial pattern. The API is NEVER called until the user explicitly
 * clicks "Reveal Secret". The URL fragment (#key) is stripped from the
 * browser address bar immediately after extraction.
 *
 * Flow:
 *   1. Extract key from URL fragment, strip fragment immediately
 *   2. Validate inputs (key present, ID valid)
 *   3. Check metadata to determine if password is required
 *   4a. If password required: show password entry form with attempt counter
 *   4b. If no password: show interstitial with "Reveal Secret" button (NO API call)
 *   5. On action: fetch/verify ciphertext, decrypt client-side, display plaintext
 *   6. On error: show appropriate error page
 */

import { decrypt } from '../crypto/index.js';
import {
  getSecret,
  getSecretMeta,
  verifySecretPassword,
  ApiError,
} from '../api/client.js';
import { createCopyButton } from '../components/copy-button.js';
import { Shield, Lock } from 'lucide';
import { createIcon } from '../components/icons.js';
import { createLoadingSpinner } from '../components/loading-spinner.js';
import { renderErrorPage } from './error.js';
import { navigate } from '../router.js';

/** Expected length of a nanoid-generated secret ID. */
const SECRET_ID_LENGTH = 21;

/**
 * Render the reveal page with the two-step interstitial flow.
 *
 * SECURITY: The URL fragment is read and stripped before any rendering.
 * The API call only happens after explicit user interaction (button click).
 *
 * @param container - The DOM element to render into
 */
export async function renderRevealPage(
  container: HTMLElement,
): Promise<void> {
  // Step A: Extract key from URL fragment IMMEDIATELY
  let key: string | null = window.location.hash.slice(1);

  // Step A (cont): Strip fragment from URL bar -- key exists only in memory now
  history.replaceState(
    null,
    '',
    window.location.pathname + window.location.search,
  );

  // Step B: Extract secret ID from path
  const segments = window.location.pathname.split('/');
  const id = segments[segments.length - 1];

  // Step C: Validate inputs (client-side checks can show distinct errors)
  if (!key) {
    renderErrorPage(container, 'no_key');
    return;
  }

  if (!id || id.length !== SECRET_ID_LENGTH) {
    renderErrorPage(container, 'not_available');
    return;
  }

  // Step C2: Show loading spinner while checking metadata
  clearContainer(container);
  container.appendChild(createLoadingSpinner('Checking secret...'));

  // Step C3: Call getSecretMeta to determine if password is required
  try {
    const meta = await getSecretMeta(id);

    // Step C5: If password required, show password entry form
    if (meta.requiresPassword) {
      renderPasswordEntry(container, id, key, meta.passwordAttemptsRemaining);
    } else {
      // Step C6: No password required, show existing interstitial
      renderInterstitial(container, id, key);
    }
  } catch {
    // Step C4: If error (404 or any), show not available
    renderErrorPage(container, 'not_available');
    return;
  }

  /**
   * Handle the reveal action when the user clicks "Reveal Secret".
   * This is the ONLY place where the non-password API is called.
   */
  async function handleReveal(): Promise<void> {
    // Clear container and show loading spinner
    clearContainer(container);
    container.appendChild(
      createLoadingSpinner('Decrypting your secret...'),
    );

    try {
      // Fetch ciphertext from API (triggers atomic delete on server)
      const { ciphertext } = await getSecret(id);

      // Decrypt client-side using Phase 1 crypto module
      const plaintext = await decrypt(ciphertext, key!);

      // Render the revealed secret
      renderRevealedSecret(container, plaintext);

      // Best-effort memory cleanup: clear key reference
      key = null;
    } catch (err) {
      // Determine error type for appropriate user messaging
      if (err instanceof ApiError && (err.status === 404 || err.status === 410)) {
        // Generic "not available" message for API errors (anti-enumeration)
        renderErrorPage(container, 'not_available');
      } else if (
        err instanceof Error &&
        err.message.includes('Decryption failed')
      ) {
        renderErrorPage(container, 'decrypt_failed');
      } else {
        // Unknown errors: show generic "not available" (don't leak details)
        renderErrorPage(container, 'not_available');
      }
    }
  }

  /**
   * Render the interstitial "Click to Reveal" screen.
   * CRITICAL: No API call is made here. The page is completely inert
   * until the user explicitly clicks the button.
   */
  function renderInterstitial(
    target: HTMLElement,
    _id: string,
    _key: string,
  ): void {
    clearContainer(target);

    const wrapper = document.createElement('div');
    wrapper.className =
      'flex flex-col items-center justify-center text-center py-16 px-4';

    // Shield icon (decorative, hidden from screen readers)
    const icon = createIcon(Shield, {
      size: 48,
      class: 'text-accent',
    });
    icon.classList.add('mb-6');

    // Heading
    const heading = document.createElement('h1');
    heading.className = 'text-2xl sm:text-3xl font-heading font-semibold text-text-primary mb-3';
    heading.textContent = "You've received a secret";

    // Subtext
    const subtext = document.createElement('p');
    subtext.className = 'text-text-muted mb-8 max-w-md';
    subtext.textContent =
      'This secret can only be viewed once. Once revealed, it will be permanently destroyed.';

    // Reveal button
    const button = document.createElement('button');
    button.type = 'button';
    button.className =
      'bg-accent text-white px-8 py-3 min-h-[44px] rounded-lg font-semibold text-lg hover:bg-accent-hover focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg focus:outline-hidden transition-colors cursor-pointer';
    button.textContent = 'Reveal Secret';
    button.addEventListener('click', handleReveal);

    wrapper.appendChild(icon);
    wrapper.appendChild(heading);
    wrapper.appendChild(subtext);
    wrapper.appendChild(button);
    target.appendChild(wrapper);
  }

  /**
   * Render the password entry form for password-protected secrets.
   *
   * SECURITY: The encryption key stays in closure scope and is nulled
   * after successful decryption, same as the handleReveal pattern.
   * Uses verifySecretPassword exclusively (never getSecret for password-protected secrets).
   */
  function renderPasswordEntry(
    target: HTMLElement,
    secretId: string,
    encryptionKey: string,
    attemptsRemaining: number,
  ): void {
    clearContainer(target);

    const wrapper = document.createElement('div');
    wrapper.className =
      'flex flex-col items-center justify-center text-center py-16 px-4';

    // Lock icon (matching interstitial style, decorative)
    const icon = createIcon(Lock, {
      size: 48,
      class: 'text-accent',
    });
    icon.classList.add('mb-6');

    // Heading
    const heading = document.createElement('h1');
    heading.className = 'text-2xl sm:text-3xl font-heading font-semibold text-text-primary mb-3';
    heading.textContent = 'Password Required';

    // Subtext
    const subtext = document.createElement('p');
    subtext.className = 'text-text-muted mb-6 max-w-md';
    subtext.textContent =
      'This secret is password protected. Enter the password to reveal it.';

    // Attempt counter
    const attemptText = document.createElement('p');
    attemptText.className = `text-sm font-medium mb-6 ${attemptsRemaining <= 1 ? 'text-danger' : 'text-warning'}`;
    attemptText.textContent = attemptsRemaining === 1
      ? '1 attempt remaining'
      : `${attemptsRemaining} attempts remaining`;

    // Form container (max width for readability)
    const form = document.createElement('form');
    form.className = 'w-full max-w-sm space-y-4';
    form.noValidate = true;

    // Password input group
    const inputGroup = document.createElement('div');
    inputGroup.className = 'space-y-1 text-left';

    const passwordLabel = document.createElement('label');
    passwordLabel.htmlFor = 'reveal-password';
    passwordLabel.className = 'block text-sm font-medium text-text-secondary';
    passwordLabel.textContent = 'Password';

    const passwordInput = document.createElement('input');
    passwordInput.type = 'password';
    passwordInput.id = 'reveal-password';
    passwordInput.placeholder = 'Enter password';
    passwordInput.maxLength = 128;
    passwordInput.required = true;
    passwordInput.autocomplete = 'current-password';
    passwordInput.className =
      'w-full px-3 py-2 min-h-[44px] border border-border rounded-lg bg-surface text-text-primary placeholder-text-muted focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg focus:outline-hidden';

    inputGroup.appendChild(passwordLabel);
    inputGroup.appendChild(passwordInput);
    form.appendChild(inputGroup);

    // Error message area (hidden initially)
    const errorArea = document.createElement('div');
    errorArea.className =
      'hidden px-4 py-3 rounded-lg bg-danger/10 text-danger text-sm';
    errorArea.setAttribute('role', 'alert');
    form.appendChild(errorArea);

    // Submit button
    const submitButton = document.createElement('button');
    submitButton.type = 'submit';
    submitButton.className =
      'w-full bg-accent text-white px-8 py-3 min-h-[44px] rounded-lg font-semibold text-lg hover:bg-accent-hover focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg focus:outline-hidden transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
    submitButton.textContent = 'Verify Password';
    form.appendChild(submitButton);

    // Form submit handler
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Hide previous errors
      errorArea.classList.add('hidden');
      errorArea.textContent = '';

      const passwordValue = passwordInput.value;
      if (!passwordValue) {
        errorArea.textContent = 'Please enter a password.';
        errorArea.classList.remove('hidden');
        return;
      }

      // Disable form during verification
      passwordInput.disabled = true;
      submitButton.disabled = true;
      submitButton.textContent = 'Verifying...';

      try {
        // Call verify endpoint (atomically destroys on success)
        const { ciphertext } = await verifySecretPassword(secretId, passwordValue);

        // Decrypt client-side
        const plaintext = await decrypt(ciphertext, encryptionKey);

        // Render the revealed secret
        renderRevealedSecret(container, plaintext);

        // Best-effort memory cleanup
        key = null;
      } catch (err) {
        if (err instanceof ApiError && err.status === 403) {
          // Wrong password -- parse remaining attempts from error body
          const body = err.body as { attemptsRemaining?: number };
          const remaining = body.attemptsRemaining ?? 0;

          if (remaining === 0) {
            // Secret was auto-destroyed after max wrong attempts
            renderErrorPage(container, 'destroyed');
            return;
          }

          // Update attempt counter text and style
          attemptText.textContent = remaining === 1
            ? '1 attempt remaining'
            : `${remaining} attempts remaining`;
          attemptText.className = `text-sm font-medium mb-6 ${remaining <= 1 ? 'text-danger' : 'text-warning'}`;

          // Show error message
          errorArea.textContent = remaining === 1
            ? `Wrong password. 1 attempt remaining.`
            : `Wrong password. ${remaining} attempts remaining.`;
          errorArea.classList.remove('hidden');

          // Re-enable form
          passwordInput.disabled = false;
          submitButton.disabled = false;
          submitButton.textContent = 'Verify Password';
          passwordInput.value = '';
          passwordInput.focus();
        } else if (err instanceof ApiError && err.status === 404) {
          // Secret gone (concurrent destroy or expired)
          renderErrorPage(container, 'not_available');
        } else if (
          err instanceof Error &&
          err.message.includes('Decryption failed')
        ) {
          renderErrorPage(container, 'decrypt_failed');
        } else {
          // Unknown error -- show generic message
          renderErrorPage(container, 'not_available');
        }
      }
    });

    wrapper.appendChild(icon);
    wrapper.appendChild(heading);
    wrapper.appendChild(subtext);
    wrapper.appendChild(attemptText);
    wrapper.appendChild(form);
    target.appendChild(wrapper);
  }
}

/**
 * Render the decrypted secret with copy button and destruction notice.
 * Secret text is set via textContent (NEVER innerHTML) to prevent XSS.
 */
function renderRevealedSecret(
  container: HTMLElement,
  plaintext: string,
): void {
  clearContainer(container);

  const wrapper = document.createElement('div');
  wrapper.className = 'py-8 px-4';

  // Heading
  const heading = document.createElement('h1');
  heading.className = 'text-2xl sm:text-3xl font-heading font-semibold text-text-primary mb-3';
  heading.textContent = 'Secret Revealed';

  // Destruction notice
  const notice = document.createElement('p');
  notice.className = 'text-text-muted mb-6';
  notice.textContent =
    'This secret has been permanently destroyed from our servers.';

  // Secret display area -- uses textContent for XSS prevention
  const pre = document.createElement('pre');
  pre.className =
    'whitespace-pre-wrap break-words overflow-x-hidden bg-surface border border-border rounded-lg p-4 text-sm font-mono max-h-96 overflow-y-auto mb-6';
  pre.textContent = plaintext; // NEVER use innerHTML

  // Copy button
  const copyButton = createCopyButton(() => plaintext, 'Copy Secret');

  // Actions row
  const actions = document.createElement('div');
  actions.className = 'flex flex-col sm:flex-row items-center gap-4';
  actions.appendChild(copyButton);

  // "Create a New Secret" link
  const newSecretLink = document.createElement('a');
  newSecretLink.href = '/';
  newSecretLink.className =
    'inline-block min-h-[44px] py-2 text-accent hover:text-accent-hover focus:ring-2 focus:ring-accent focus:outline-hidden rounded font-medium transition-colors';
  newSecretLink.textContent = 'Create a New Secret';
  newSecretLink.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/');
  });
  actions.appendChild(newSecretLink);

  wrapper.appendChild(heading);
  wrapper.appendChild(notice);
  wrapper.appendChild(pre);
  wrapper.appendChild(actions);
  container.appendChild(wrapper);
}

/**
 * Clear all children from a container element.
 */
function clearContainer(container: HTMLElement): void {
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
}

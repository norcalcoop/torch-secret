/**
 * Reveal secret page - two-step reveal flow.
 *
 * SECURITY-CRITICAL: This page implements the anti-bot/anti-prefetch
 * interstitial pattern. The API is NEVER called until the user explicitly
 * clicks "Reveal Secret". The URL fragment (#key) is stripped from the
 * browser address bar immediately after extraction.
 *
 * Flow:
 *   1. Extract key from URL fragment, strip fragment immediately
 *   2. Validate inputs (key present, ID valid)
 *   3. Show interstitial with "Reveal Secret" button (NO API call)
 *   4. On click: fetch ciphertext, decrypt client-side, display plaintext
 *   5. On error: show appropriate error page
 */

import { decrypt } from '../crypto/index.js';
import { getSecret, ApiError } from '../api/client.js';
import { createCopyButton } from '../components/copy-button.js';
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

  // Step D: Render interstitial -- NO API call happens here
  renderInterstitial(container, id, key);

  /**
   * Handle the reveal action when the user clicks "Reveal Secret".
   * This is the ONLY place where the API is called.
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

    // Shield/lock icon
    const icon = document.createElement('div');
    icon.className = 'text-6xl mb-6';
    icon.textContent = '\u{1F6E1}\u{FE0F}'; // Shield

    // Heading
    const heading = document.createElement('h1');
    heading.className = 'text-2xl font-bold text-gray-800 mb-3';
    heading.textContent = "You've received a secret";

    // Subtext
    const subtext = document.createElement('p');
    subtext.className = 'text-gray-500 mb-8 max-w-md';
    subtext.textContent =
      'This secret can only be viewed once. Once revealed, it will be permanently destroyed.';

    // Reveal button
    const button = document.createElement('button');
    button.type = 'button';
    button.className =
      'bg-primary-600 text-white px-8 py-3 rounded-lg font-semibold text-lg hover:bg-primary-700 transition-colors cursor-pointer';
    button.textContent = 'Reveal Secret';
    button.addEventListener('click', handleReveal);

    wrapper.appendChild(icon);
    wrapper.appendChild(heading);
    wrapper.appendChild(subtext);
    wrapper.appendChild(button);
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
  heading.className = 'text-2xl font-bold text-gray-800 mb-3';
  heading.textContent = 'Secret Revealed';

  // Destruction notice
  const notice = document.createElement('p');
  notice.className = 'text-gray-500 mb-6';
  notice.textContent =
    'This secret has been permanently destroyed from our servers.';

  // Secret display area -- uses textContent for XSS prevention
  const pre = document.createElement('pre');
  pre.className =
    'whitespace-pre-wrap break-words bg-white border border-gray-200 rounded-lg p-4 text-sm font-mono max-h-96 overflow-y-auto mb-6';
  pre.textContent = plaintext; // NEVER use innerHTML

  // Copy button
  const copyButton = createCopyButton(() => plaintext, 'Copy Secret');

  // Actions row
  const actions = document.createElement('div');
  actions.className = 'flex items-center gap-4';
  actions.appendChild(copyButton);

  // "Create a New Secret" link
  const newSecretLink = document.createElement('a');
  newSecretLink.href = '/';
  newSecretLink.className =
    'text-primary-600 hover:text-primary-700 font-medium transition-colors';
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

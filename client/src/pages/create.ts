/**
 * Create secret page.
 *
 * Renders the complete secret creation form: textarea with character counter,
 * expiration selector, disabled password field (Phase 5 placeholder), and submit
 * button that encrypts in the browser and posts to the API.
 *
 * After successful creation, renders the confirmation page in the same container
 * (state-based transition, not URL-based).
 */

import { encrypt } from '../crypto/index.js';
import { createSecret } from '../api/client.js';
import { createExpirationSelect } from '../components/expiration-select.js';
import { renderConfirmationPage } from './confirmation.js';

const MAX_LENGTH = 10_000;

/**
 * Render the create page into the given container.
 */
export async function renderCreatePage(
  container: HTMLElement,
): Promise<void> {
  // -- Page wrapper --
  const wrapper = document.createElement('div');
  wrapper.className = 'space-y-6';

  // -- Header --
  const header = document.createElement('header');
  header.className = 'text-center space-y-2';

  const heading = document.createElement('h1');
  heading.className = 'text-3xl font-bold text-gray-900';
  heading.textContent = 'Share a Secret';

  const subtext = document.createElement('p');
  subtext.className = 'text-gray-500';
  subtext.textContent =
    'End-to-end encrypted. One-time view. No accounts.';

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
  textareaLabel.className = 'block text-sm font-medium text-gray-700';
  textareaLabel.textContent = 'Your secret';

  const textarea = document.createElement('textarea');
  textarea.id = 'secret-text';
  textarea.maxLength = MAX_LENGTH;
  textarea.placeholder = 'Paste your secret here...';
  textarea.rows = 6;
  textarea.required = true;
  textarea.className =
    'w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:outline-none resize-y';

  const counter = document.createElement('div');
  counter.className = 'text-right text-sm text-gray-400';
  counter.textContent = `0 / ${MAX_LENGTH.toLocaleString()}`;

  textarea.addEventListener('input', () => {
    const len = textarea.value.length;
    counter.textContent = `${len.toLocaleString()} / ${MAX_LENGTH.toLocaleString()}`;
    if (len >= MAX_LENGTH) {
      counter.classList.add('text-danger-500');
    } else {
      counter.classList.remove('text-danger-500');
    }
  });

  textareaGroup.appendChild(textareaLabel);
  textareaGroup.appendChild(textarea);
  textareaGroup.appendChild(counter);
  form.appendChild(textareaGroup);

  // -- Expiration section --
  const expirationGroup = document.createElement('div');
  expirationGroup.className = 'space-y-1';

  const expirationLabel = document.createElement('label');
  expirationLabel.htmlFor = 'expiration';
  expirationLabel.className = 'block text-sm font-medium text-gray-700';
  expirationLabel.textContent = 'Expires after';

  const expirationSelect = createExpirationSelect();

  expirationGroup.appendChild(expirationLabel);
  expirationGroup.appendChild(expirationSelect);
  form.appendChild(expirationGroup);

  // -- Advanced options (password placeholder for Phase 5) --
  const details = document.createElement('details');
  details.className = 'border border-gray-200 rounded-lg';

  const summary = document.createElement('summary');
  summary.className =
    'px-4 py-3 text-sm font-medium text-gray-600 cursor-pointer select-none';
  summary.textContent = 'Advanced options';

  const detailsContent = document.createElement('div');
  detailsContent.className = 'px-4 pb-4 space-y-1';

  const passwordLabel = document.createElement('label');
  passwordLabel.htmlFor = 'password';
  passwordLabel.className = 'block text-sm font-medium text-gray-400';
  passwordLabel.textContent = 'Password protection';

  const passwordInput = document.createElement('input');
  passwordInput.type = 'password';
  passwordInput.id = 'password';
  passwordInput.disabled = true;
  passwordInput.placeholder = 'Password protection (coming soon)';
  passwordInput.className =
    'w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-400 placeholder-gray-300 cursor-not-allowed';

  detailsContent.appendChild(passwordLabel);
  detailsContent.appendChild(passwordInput);
  details.appendChild(summary);
  details.appendChild(detailsContent);
  form.appendChild(details);

  // -- Error display area --
  const errorArea = document.createElement('div');
  errorArea.className =
    'hidden px-4 py-3 rounded-lg bg-danger-500/10 text-danger-500 text-sm';
  errorArea.setAttribute('role', 'alert');
  form.appendChild(errorArea);

  // -- Submit button --
  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.className =
    'w-full py-3 rounded-lg bg-primary-600 text-white font-semibold hover:bg-primary-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
  submitButton.textContent = 'Create Secure Link';
  form.appendChild(submitButton);

  // -- Submit handler --
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Hide previous errors
    errorArea.classList.add('hidden');
    errorArea.textContent = '';

    // Validate non-empty
    const text = textarea.value.trim();
    if (!text) {
      showError(errorArea, 'Please enter a secret to share.');
      return;
    }

    // Get expiration
    const expiresIn = expirationSelect.value as
      | '1h'
      | '24h'
      | '7d'
      | '30d';

    // Disable form during submission
    submitButton.disabled = true;
    textarea.disabled = true;
    expirationSelect.disabled = true;

    try {
      // Step 1: Encrypt in the browser
      submitButton.textContent = 'Encrypting...';
      const result = await encrypt(text);

      // Step 2: Send to API
      submitButton.textContent = 'Sending...';
      const response = await createSecret(
        result.payload.ciphertext,
        expiresIn,
      );

      // Step 3: Build share URL with key in fragment
      const shareUrl = `${window.location.origin}/secret/${response.id}#${result.keyBase64Url}`;

      // Step 4: Render confirmation page (state-based, not URL-based)
      renderConfirmationPage(container, shareUrl, response.expiresAt);
    } catch (err) {
      // Restore form state
      submitButton.disabled = false;
      textarea.disabled = false;
      expirationSelect.disabled = false;
      submitButton.textContent = 'Create Secure Link';

      const message =
        err instanceof Error
          ? err.message
          : 'Something went wrong. Please try again.';
      showError(errorArea, message);
    }
  });

  wrapper.appendChild(form);
  container.appendChild(wrapper);
}

/**
 * Display an error message in the error area.
 */
function showError(errorArea: HTMLElement, message: string): void {
  errorArea.textContent = message;
  errorArea.classList.remove('hidden');
}

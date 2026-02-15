/**
 * Create secret page.
 *
 * Renders the complete secret creation form: textarea with character counter,
 * expiration selector, optional password field, and submit button that encrypts
 * in the browser and posts to the API.
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
  heading.className = 'text-2xl sm:text-3xl font-bold text-gray-900';
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
    'w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:outline-hidden resize-y';

  const counter = document.createElement('div');
  counter.className = 'text-right text-sm text-gray-500';
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

  // -- Advanced options (password protection) --
  const details = document.createElement('details');
  details.className = 'border border-gray-200 rounded-lg';

  const summary = document.createElement('summary');
  summary.className =
    'px-4 py-3 min-h-[44px] text-sm font-medium text-gray-600 cursor-pointer select-none focus:ring-2 focus:ring-primary-500 focus:outline-hidden rounded-lg';
  summary.textContent = 'Advanced options';

  const detailsContent = document.createElement('div');
  detailsContent.className = 'px-4 pb-4 space-y-1';

  const passwordLabel = document.createElement('label');
  passwordLabel.htmlFor = 'password';
  passwordLabel.className = 'block text-sm font-medium text-gray-700';
  passwordLabel.textContent = 'Password protection';

  const passwordInput = document.createElement('input');
  passwordInput.type = 'password';
  passwordInput.id = 'password';
  passwordInput.placeholder = 'Optional password';
  passwordInput.maxLength = 128;
  passwordInput.autocomplete = 'new-password';
  passwordInput.className =
    'w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:outline-hidden';

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
    'w-full min-h-[44px] py-3 rounded-lg bg-primary-600 text-white font-semibold hover:bg-primary-700 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:outline-hidden transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
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

    // Get optional password
    const password = passwordInput.value || undefined;

    // Disable form during submission
    submitButton.disabled = true;
    textarea.disabled = true;
    expirationSelect.disabled = true;
    passwordInput.disabled = true;

    try {
      // Step 1: Encrypt in the browser
      submitButton.textContent = 'Encrypting...';
      const result = await encrypt(text);

      // Step 2: Send to API (include password only if provided)
      submitButton.textContent = 'Sending...';
      const response = await createSecret(
        result.payload.ciphertext,
        expiresIn,
        password,
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
      passwordInput.disabled = false;
      submitButton.textContent = 'Create Secure Link';

      const message =
        err instanceof Error
          ? err.message
          : 'Something went wrong. Please try again.';
      showError(errorArea, message);
    }
  });

  wrapper.appendChild(form);
  wrapper.appendChild(createHowItWorksSection());
  container.appendChild(wrapper);
}

/**
 * Display an error message in the error area.
 */
function showError(errorArea: HTMLElement, message: string): void {
  errorArea.textContent = message;
  errorArea.classList.remove('hidden');
}

/**
 * Build the "How It Works" trust section explaining zero-knowledge encryption.
 *
 * Three steps: browser encryption, encrypted storage, one-time destruction.
 * Placed below the form to build user confidence before they share a secret.
 */
function createHowItWorksSection(): HTMLElement {
  const section = document.createElement('section');
  section.setAttribute('aria-labelledby', 'how-it-works-heading');
  section.className = 'mt-12 pt-8 border-t border-gray-200';

  const heading = document.createElement('h2');
  heading.id = 'how-it-works-heading';
  heading.className =
    'text-xl sm:text-2xl font-bold text-gray-900 text-center mb-8';
  heading.textContent = 'How It Works';
  section.appendChild(heading);

  const grid = document.createElement('div');
  grid.className = 'grid grid-cols-1 sm:grid-cols-3 gap-6';

  const steps: Array<{ number: string; title: string; description: string }> = [
    {
      number: '1',
      title: 'Encrypted in Your Browser',
      description:
        'Your secret is encrypted on your device before anything is sent. The encryption key stays in your browser and never reaches our server.',
    },
    {
      number: '2',
      title: 'Stored Encrypted',
      description:
        'Our server only sees scrambled data it cannot read. Even a complete database breach would reveal nothing.',
    },
    {
      number: '3',
      title: 'View Once, Then Destroyed',
      description:
        'The recipient decrypts the secret in their browser using the key in the link. After viewing, the encrypted data is permanently deleted.',
    },
  ];

  for (const step of steps) {
    const card = document.createElement('div');
    card.className = 'text-center space-y-2';

    const circle = document.createElement('div');
    circle.className =
      'w-10 h-10 rounded-full bg-primary-100 text-primary-700 font-bold flex items-center justify-center mx-auto text-lg';
    circle.textContent = step.number;
    circle.setAttribute('aria-hidden', 'true');

    const title = document.createElement('h3');
    title.className = 'font-semibold text-gray-900';
    title.textContent = step.title;

    const description = document.createElement('p');
    description.className = 'text-sm text-gray-600 leading-relaxed';
    description.textContent = step.description;

    card.appendChild(circle);
    card.appendChild(title);
    card.appendChild(description);
    grid.appendChild(card);
  }

  section.appendChild(grid);
  return section;
}

/**
 * Error page for various failure states.
 *
 * Renders appropriate error messages for not-found routes, unavailable secrets,
 * missing encryption keys, and decryption failures. API error messages are
 * intentionally generic to prevent secret enumeration.
 */

import { navigate } from '../router.js';

export type ErrorType =
  | 'not_found'
  | 'not_available'
  | 'no_key'
  | 'decrypt_failed';

/**
 * Error message configuration by type.
 * API-originating errors use generic wording to prevent enumeration.
 */
const ERROR_CONFIG: Record<
  ErrorType,
  { heading: string; message: string; icon: string }
> = {
  not_available: {
    heading: 'Secret Not Available',
    message:
      'This secret is no longer available. It may have already been viewed, expired, or the link is invalid.',
    icon: '\u{1F512}', // Lock
  },
  no_key: {
    heading: 'Invalid Link',
    message:
      'The decryption key is missing from the URL. Please ask the sender for a new link.',
    icon: '\u{1F511}', // Key
  },
  decrypt_failed: {
    heading: 'Decryption Failed',
    message:
      'Unable to decrypt this secret. The link may be corrupted. Please ask the sender for a new link.',
    icon: '\u{26A0}\u{FE0F}', // Warning
  },
  not_found: {
    heading: 'Page Not Found',
    message: 'The page you are looking for does not exist.',
    icon: '\u{1F50D}', // Magnifying glass
  },
};

/**
 * Render an error page for the given error type.
 *
 * Clears the container and displays a centered error message with an icon,
 * heading, description, and a link back to the home page.
 *
 * @param container - The DOM element to render into
 * @param type - The error type determining which message to display
 */
export function renderErrorPage(
  container: HTMLElement,
  type: ErrorType,
): void {
  // Clear existing content
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  const config = ERROR_CONFIG[type];

  // Outer wrapper: centered content with vertical spacing
  const wrapper = document.createElement('div');
  wrapper.className =
    'flex flex-col items-center justify-center text-center py-16 px-4';

  // Icon
  const icon = document.createElement('div');
  icon.className = 'text-5xl mb-4';
  icon.textContent = config.icon;

  // Heading
  const heading = document.createElement('h1');
  heading.className = 'text-2xl font-bold text-gray-800 mb-3';
  heading.textContent = config.heading;

  // Description
  const message = document.createElement('p');
  message.className = 'text-gray-500 mb-8 max-w-md';
  message.textContent = config.message;

  // Back link
  const link = document.createElement('a');
  link.href = '/';
  link.className =
    'inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors font-medium';
  link.textContent = 'Create a New Secret';
  link.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/');
  });

  wrapper.appendChild(icon);
  wrapper.appendChild(heading);
  wrapper.appendChild(message);
  wrapper.appendChild(link);
  container.appendChild(wrapper);
}

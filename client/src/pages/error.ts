/**
 * Error page for various failure states.
 *
 * Renders appropriate error messages for not-found routes, unavailable secrets,
 * missing encryption keys, and decryption failures. API error messages are
 * intentionally generic to prevent secret enumeration.
 */

import { Lock, KeyRound, TriangleAlert, Search, Bomb, CircleCheck } from 'lucide';
import { createIcon, type IconNode } from '../components/icons.js';
import { navigate } from '../router.js';

export type ErrorType =
  | 'not_found'
  | 'not_available'
  | 'no_key'
  | 'decrypt_failed'
  | 'destroyed'
  | 'already_viewed';

/**
 * Error message configuration by type.
 * API-originating errors use generic wording to prevent enumeration.
 */
const ERROR_CONFIG: Record<
  ErrorType,
  { heading: string; message: string; icon: IconNode; iconClass: string }
> = {
  not_available: {
    heading: 'Secret Not Available',
    message:
      'This secret is no longer available. It may have already been viewed, expired, or the link is invalid.',
    icon: Lock,
    iconClass: 'text-danger',
  },
  no_key: {
    heading: 'Invalid Link',
    message:
      'The decryption key is missing from the URL. Please ask the sender for a new link.',
    icon: KeyRound,
    iconClass: 'text-warning',
  },
  decrypt_failed: {
    heading: 'Decryption Failed',
    message:
      'Unable to decrypt this secret. The link may be corrupted. Please ask the sender for a new link.',
    icon: TriangleAlert,
    iconClass: 'text-warning',
  },
  not_found: {
    heading: 'Page Not Found',
    message: 'The page you are looking for does not exist.',
    icon: Search,
    iconClass: 'text-text-muted',
  },
  destroyed: {
    heading: 'Secret Destroyed',
    message:
      'This secret has been permanently destroyed due to too many incorrect password attempts.',
    icon: Bomb,
    iconClass: 'text-danger',
  },
  already_viewed: {
    heading: 'Secret Already Viewed',
    message:
      'This secret has already been viewed and destroyed. Secrets can only be viewed once.',
    icon: CircleCheck,
    iconClass: 'text-text-muted',
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

  // Icon (decorative, hidden from screen readers -- heading conveys meaning)
  const icon = createIcon(config.icon, {
    size: 40,
    class: config.iconClass,
  });
  icon.classList.add('mb-4');

  // Heading
  const heading = document.createElement('h1');
  heading.className = 'text-2xl sm:text-3xl font-heading font-semibold text-text-primary mb-3';
  heading.textContent = config.heading;

  // Description
  const message = document.createElement('p');
  message.className = 'text-text-muted mb-8 max-w-md';
  message.textContent = config.message;

  // Back link
  const link = document.createElement('a');
  link.href = '/';
  link.className =
    'inline-flex items-center gap-2 px-6 py-3 min-h-[44px] rounded-lg bg-accent text-white hover:bg-accent-hover focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg focus:outline-hidden transition-colors font-medium';
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

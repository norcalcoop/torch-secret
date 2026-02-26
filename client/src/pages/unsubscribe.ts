/**
 * Unsubscribe page — /unsubscribe?token=
 *
 * Reads ?token from query string, calls GET /api/subscribers/unsubscribe,
 * and renders confirmation. Idempotent — always shows success regardless
 * of token validity (no state leakage).
 * No nav, no footer — minimal centered card.
 */

import { CircleCheck } from 'lucide';
import { createIcon } from '../components/icons.js';
import { navigate } from '../router.js';

export async function renderUnsubscribePage(container: HTMLElement): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');

  // Call API immediately on load (no "Are you sure?" step)
  if (token) {
    try {
      await fetch(`/api/subscribers/unsubscribe?token=${encodeURIComponent(token)}`);
    } catch {
      // Ignore errors — always show success (idempotent)
    }
  }

  // Always render success — no state leakage for invalid tokens
  while (container.firstChild) container.removeChild(container.firstChild);

  const wrapper = document.createElement('div');
  wrapper.className = 'flex flex-col items-center justify-center text-center py-16 px-4';

  const icon = createIcon(CircleCheck, { size: 40, class: 'text-text-muted mb-4' });

  const heading = document.createElement('h1');
  heading.className = 'text-2xl sm:text-3xl font-heading font-semibold text-text-primary mb-3';
  heading.textContent = "You've been unsubscribed";

  const message = document.createElement('p');
  message.className = 'text-text-muted mb-8 max-w-md';
  message.textContent = "You won't receive any more emails from Torch Secret.";

  const link = document.createElement('a');
  link.href = '/';
  link.className =
    'inline-flex items-center gap-2 px-6 py-3 min-h-[44px] rounded-lg bg-accent text-white ' +
    'hover:bg-accent-hover focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg ' +
    'focus:outline-hidden transition-colors font-medium';
  link.textContent = 'Back to homepage';
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

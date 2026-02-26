/**
 * Email confirmation page — /confirm?token=
 *
 * Reads ?token from query string, calls GET /api/subscribers/confirm,
 * and renders the result. No nav, no footer — minimal centered card.
 *
 * States:
 *   loading — spinner shown while API call is in-flight
 *   success — "You're on the list!" with Try Torch Secret CTA
 *   expired — "Confirmation link expired" with Back to homepage link
 */

import { CheckCircle2, MailX } from 'lucide';
import { createIcon } from '../components/icons.js';
import { navigate } from '../router.js';

export async function renderConfirmPage(container: HTMLElement): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');

  if (!token) {
    renderExpiredState(container);
    return;
  }

  // Show loading state while API call is in-flight
  renderLoadingState(container);

  try {
    const res = await fetch(`/api/subscribers/confirm?token=${encodeURIComponent(token)}`);
    if (res.ok) {
      renderSuccessState(container);
    } else {
      // 410 token_expired or any other error
      renderExpiredState(container);
    }
  } catch {
    renderExpiredState(container);
  }
}

function renderLoadingState(container: HTMLElement): void {
  while (container.firstChild) container.removeChild(container.firstChild);

  const wrapper = document.createElement('div');
  wrapper.className = 'flex flex-col items-center justify-center text-center py-16 px-4';

  const spinner = document.createElement('div');
  spinner.className =
    'w-10 h-10 rounded-full border-4 border-border border-t-accent animate-spin mb-4';
  spinner.setAttribute('role', 'status');
  spinner.setAttribute('aria-label', 'Verifying your email\u2026');

  const msg = document.createElement('p');
  msg.className = 'text-text-muted';
  msg.textContent = 'Verifying your email\u2026';

  wrapper.appendChild(spinner);
  wrapper.appendChild(msg);
  container.appendChild(wrapper);
}

function renderSuccessState(container: HTMLElement): void {
  while (container.firstChild) container.removeChild(container.firstChild);

  const wrapper = document.createElement('div');
  wrapper.className = 'flex flex-col items-center justify-center text-center py-16 px-4';

  const icon = createIcon(CheckCircle2, { size: 40, class: 'text-accent mb-4' });

  const heading = document.createElement('h1');
  heading.className = 'text-2xl sm:text-3xl font-heading font-semibold text-text-primary mb-3';
  heading.textContent = "You're on the list!";

  const message = document.createElement('p');
  message.className = 'text-text-muted mb-8 max-w-md';
  message.textContent = "Thanks for confirming. You're now subscribed to Torch Secret updates.";

  // CTA: "Try Torch Secret" → /create (warm moment to convert)
  const cta = document.createElement('a');
  cta.href = '/create';
  cta.className =
    'inline-flex items-center gap-2 px-6 py-3 min-h-[44px] rounded-lg bg-accent text-white ' +
    'hover:bg-accent-hover focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg ' +
    'focus:outline-hidden transition-colors font-medium';
  cta.textContent = 'Try Torch Secret';
  cta.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/create');
  });

  wrapper.appendChild(icon);
  wrapper.appendChild(heading);
  wrapper.appendChild(message);
  wrapper.appendChild(cta);
  container.appendChild(wrapper);
}

function renderExpiredState(container: HTMLElement): void {
  while (container.firstChild) container.removeChild(container.firstChild);

  const wrapper = document.createElement('div');
  wrapper.className = 'flex flex-col items-center justify-center text-center py-16 px-4';

  const icon = createIcon(MailX, { size: 40, class: 'text-danger mb-4' });

  const heading = document.createElement('h1');
  heading.className = 'text-2xl sm:text-3xl font-heading font-semibold text-text-primary mb-3';
  heading.textContent = 'Confirmation link expired';

  const message = document.createElement('p');
  message.className = 'text-text-muted mb-8 max-w-md';
  message.textContent =
    'This confirmation link has expired or already been used. Go back and enter your email again.';

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

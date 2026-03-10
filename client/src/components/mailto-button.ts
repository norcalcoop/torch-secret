/**
 * Mailto button component.
 *
 * Returns a styled anchor element that opens the system mail client with
 * a pre-composed email containing the secret share URL and a one-time-view
 * warning.
 *
 * Uses encodeURIComponent (not encodeURI) to correctly encode & and = in
 * the mailto query string, and to encode the #fragment as %23 so that
 * email clients preserve and decode it correctly.
 */

import { Mail } from 'lucide';
import { createIcon } from './icons.js';

function buildMailtoHref(shareUrl: string): string {
  const subject = encodeURIComponent('Secure message for you');
  const body = encodeURIComponent(
    `${shareUrl}\n\nThis link can only be viewed once.\nOpen it in a browser to reveal the secret.`,
  );
  return `mailto:?subject=${subject}&body=${body}`;
}

export function createMailtoButton(shareUrl: string): HTMLAnchorElement {
  const anchor = document.createElement('a');
  anchor.href = buildMailtoHref(shareUrl);
  anchor.className =
    'inline-flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-lg border border-border ' +
    'text-text-primary hover:bg-surface-raised focus:ring-2 focus:ring-accent ' +
    'focus:ring-offset-2 focus:ring-offset-bg focus:outline-hidden transition-colors cursor-pointer';

  anchor.appendChild(createIcon(Mail, { size: 'sm' }));
  anchor.appendChild(document.createTextNode('Email'));

  return anchor;
}

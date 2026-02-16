/**
 * Web Share API button with progressive enhancement.
 *
 * Returns `null` when the Web Share API is unsupported (e.g. Firefox
 * desktop, older browsers), allowing callers to simply not render
 * the button. On supported devices, clicking invokes the native OS
 * share sheet.
 */

import { Share2 } from 'lucide';
import { createIcon } from './icons.js';
import { showToast } from './toast.js';

/**
 * Create a share button that invokes the native OS share sheet.
 *
 * Returns `null` if the Web Share API is not available, so callers
 * can conditionally render the button.
 *
 * @param url - The URL to share
 * @param title - The title for the share dialog
 * @returns A styled button element, or null if unsupported
 */
export function createShareButton(
  url: string,
  title: string,
): HTMLButtonElement | null {
  // Feature detection: return null if Web Share API is unavailable
  if (
    typeof navigator === 'undefined' ||
    typeof navigator.share !== 'function'
  ) {
    return null;
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.className =
    'inline-flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-lg border border-border text-text-primary hover:bg-surface-raised focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg focus:outline-hidden transition-colors cursor-pointer';

  // Share2 icon (16px, decorative)
  const icon = createIcon(Share2, { size: 'sm' });
  button.appendChild(icon);

  // Label text
  const labelText = document.createTextNode('Share');
  button.appendChild(labelText);

  button.addEventListener('click', async () => {
    try {
      await navigator.share({ title, url });
    } catch (err: unknown) {
      // User cancelled the share dialog -- this is normal, not an error
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      showToast('Sharing failed. Try copying the link instead.');
    }
  });

  return button;
}

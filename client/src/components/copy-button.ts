/**
 * Reusable copy-to-clipboard button with toast feedback.
 *
 * Uses the Clipboard API with a textarea fallback for older browsers.
 * Success/failure feedback is shown via the shared toast notification
 * system instead of inline button text changes.
 */

import { showToast } from './toast.js';

/**
 * Create a copy button that copies text to the clipboard on click.
 *
 * @param getText - Function that returns the text to copy (called on each click)
 * @param label - Button label (defaults to "Copy")
 * @returns A styled button element
 */
export function createCopyButton(
  getText: () => string,
  label?: string,
): HTMLButtonElement {
  const button = document.createElement('button');
  const defaultLabel = label ?? 'Copy';
  button.textContent = defaultLabel;
  button.type = 'button';
  button.className =
    'inline-flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-lg bg-accent text-white hover:bg-accent-hover focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg focus:outline-hidden transition-colors cursor-pointer';

  button.addEventListener('click', async () => {
    const text = getText();

    try {
      await navigator.clipboard.writeText(text);
      showToast('Copied to clipboard');
    } catch {
      // Fallback for older browsers or insecure contexts
      try {
        fallbackCopy(text);
        showToast('Copied to clipboard');
      } catch {
        showToast('Failed to copy');
      }
    }
  });

  return button;
}

/**
 * Textarea-based fallback for clipboard copy in environments
 * where navigator.clipboard is unavailable.
 */
function fallbackCopy(text: string): void {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  // Move off-screen to avoid flash of content
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

/**
 * Reusable copy-to-clipboard button with visual feedback.
 *
 * Uses the Clipboard API with a textarea fallback for older browsers.
 */

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
    'inline-flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-lg bg-primary-600 text-white hover:bg-primary-700 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:outline-none transition-colors cursor-pointer';

  button.addEventListener('click', async () => {
    const text = getText();

    try {
      await navigator.clipboard.writeText(text);
      showSuccess(button, defaultLabel);
    } catch {
      // Fallback for older browsers or insecure contexts
      try {
        fallbackCopy(text);
        showSuccess(button, defaultLabel);
      } catch {
        button.textContent = 'Failed to copy';
        setTimeout(() => {
          button.textContent = defaultLabel;
        }, 2000);
      }
    }
  });

  return button;
}

/**
 * Show "Copied!" feedback on the button, then restore after 2 seconds.
 */
function showSuccess(button: HTMLButtonElement, defaultLabel: string): void {
  button.textContent = 'Copied!';
  button.classList.add('text-success-500');
  setTimeout(() => {
    button.textContent = defaultLabel;
    button.classList.remove('text-success-500');
  }, 2000);
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

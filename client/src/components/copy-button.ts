/**
 * Reusable copy-to-clipboard button with toast feedback and icon swap.
 *
 * Uses the Clipboard API with a textarea fallback for older browsers.
 * Success/failure feedback is shown via the shared toast notification
 * system. On success, the Copy icon swaps to a Check icon for 1.5s
 * with a subtle scale animation (respects prefers-reduced-motion).
 *
 * When `options.autoClearMs` is provided, the button label shows a live
 * countdown after copying and clears the clipboard with an empty string
 * when the countdown reaches zero. Under prefers-reduced-motion the label
 * is not updated, but the clipboard is still cleared.
 */

import { Copy, Check } from 'lucide';
import { createIcon } from './icons.js';
import { showToast } from './toast.js';

/**
 * Swap the copy icon to a check icon with optional scale animation.
 * Reverts back to the copy icon after 1.5 seconds.
 *
 * @param iconSpan - The span element containing the current icon
 */
function swapToCheckIcon(iconSpan: HTMLElement): void {
  // Respect reduced motion preference
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Replace icon
  while (iconSpan.firstChild) iconSpan.removeChild(iconSpan.firstChild);
  iconSpan.appendChild(createIcon(Check, { size: 'sm', class: 'text-white' }));

  // Add subtle scale animation if motion is allowed
  if (!prefersReduced) {
    iconSpan.classList.add('transition-transform', 'duration-150');
    iconSpan.classList.add('scale-110');
    setTimeout(() => iconSpan.classList.remove('scale-110'), 150);
  }

  // Revert to Copy icon after 1.5 seconds
  setTimeout(() => {
    while (iconSpan.firstChild) iconSpan.removeChild(iconSpan.firstChild);
    iconSpan.appendChild(createIcon(Copy, { size: 'sm', class: 'text-white' }));
  }, 1500);
}

/**
 * Create a copy button that copies text to the clipboard on click.
 *
 * Shows a Copy icon that swaps to a Check icon on success (reverts
 * after 1.5s). Toast notification provides additional feedback.
 *
 * When `options.autoClearMs` is provided, the button label shows a live
 * countdown after copying and clears the clipboard with an empty string
 * when the countdown reaches zero. Re-copying resets the countdown.
 *
 * @param getText - Function that returns the text to copy (called on each click)
 * @param label - Button label (defaults to "Copy")
 * @param options - Optional settings; `autoClearMs` enables clipboard auto-clear countdown
 * @returns A styled button element
 */
export function createCopyButton(
  getText: () => string,
  label?: string,
  options?: { autoClearMs?: number },
): HTMLButtonElement {
  const button = document.createElement('button');
  const defaultLabel = label ?? 'Copy';
  button.type = 'button';
  button.className =
    'inline-flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-lg bg-accent text-white hover:bg-accent-hover focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg focus:outline-hidden transition-colors cursor-pointer';

  // Build button content: icon + label
  const iconSpan = document.createElement('span');
  iconSpan.className = 'inline-flex';
  iconSpan.appendChild(createIcon(Copy, { size: 'sm', class: 'text-white' }));
  button.appendChild(iconSpan);

  const labelSpan = document.createElement('span');
  labelSpan.textContent = defaultLabel;
  button.appendChild(labelSpan);

  // Countdown state — stored in closure so re-copy clears the previous interval
  let countdownInterval: ReturnType<typeof setInterval> | null = null;
  // Focus-deferred clear handler — non-null when a clear is pending focus return
  let pendingFocusHandler: (() => void) | null = null;

  function clearClipboard(): void {
    if (document.hasFocus()) {
      void navigator.clipboard.writeText('').catch(() => {});
    } else {
      // Document is unfocused — Clipboard API will be rejected silently.
      // Register a one-shot focus listener to clear when the user returns.
      const handler = () => {
        pendingFocusHandler = null;
        void navigator.clipboard.writeText('').catch(() => {});
      };
      pendingFocusHandler = handler;
      window.addEventListener('focus', handler, { once: true });
    }
  }

  function startCountdown(): void {
    if (!options?.autoClearMs) return;
    if (countdownInterval !== null) clearInterval(countdownInterval);
    // Remove any stale pending focus handler from a previous countdown
    if (pendingFocusHandler !== null) {
      window.removeEventListener('focus', pendingFocusHandler);
      pendingFocusHandler = null;
    }
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let remaining = Math.floor(options.autoClearMs / 1_000);
    if (!prefersReduced) {
      labelSpan.textContent = `Copied \u2014 clears in ${remaining}s`;
    }
    countdownInterval = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(countdownInterval!);
        countdownInterval = null;
        clearClipboard();
        labelSpan.textContent = defaultLabel;
      } else if (!prefersReduced) {
        labelSpan.textContent = `Copied \u2014 clears in ${remaining}s`;
      }
    }, 1_000);
  }

  button.addEventListener('click', () => {
    void (async () => {
      const text = getText();

      try {
        await navigator.clipboard.writeText(text);
        showToast('Copied to clipboard');
        swapToCheckIcon(iconSpan);
        startCountdown();
      } catch {
        // Fallback for older browsers or insecure contexts
        try {
          fallbackCopy(text);
          showToast('Copied to clipboard');
          swapToCheckIcon(iconSpan);
          startCountdown();
        } catch {
          showToast('Failed to copy');
        }
      }
    })();
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

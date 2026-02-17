/**
 * Singleton toast notification utility.
 *
 * Displays auto-dismissing notifications at the bottom-center of the
 * viewport. Uses a replace strategy (no stacking) -- showing a new
 * toast removes any existing one. The container uses `aria-live="polite"`
 * so screen readers announce toast messages automatically.
 */

/** Lazy-initialized singleton container element. */
let container: HTMLDivElement | null = null;

/**
 * Ensure the singleton toast container exists in the DOM.
 * Created once on first call and reused for all subsequent toasts.
 */
function getContainer(): HTMLDivElement {
  if (container && document.body.contains(container)) {
    return container;
  }

  container = document.createElement('div');
  container.id = 'toast-container';
  container.setAttribute('aria-live', 'polite');
  container.setAttribute('aria-atomic', 'true');
  container.className =
    'fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none flex flex-col items-center';
  document.body.appendChild(container);
  return container;
}

/**
 * Show a toast notification at the bottom-center of the viewport.
 *
 * Replaces any existing toast (no stacking). Auto-dismisses after
 * the specified duration with a fade-out transition.
 *
 * @param message - Text to display (set via textContent, never innerHTML)
 * @param durationMs - Time in ms before auto-dismiss (default 3000)
 */
export function showToast(message: string, durationMs: number = 3000): void {
  const root = getContainer();

  // Replace strategy: remove any existing toast before adding new one
  while (root.firstChild) {
    root.removeChild(root.firstChild);
  }

  const toast = document.createElement('div');
  toast.className =
    'px-4 py-2 rounded-lg bg-surface-raised text-text-primary text-sm shadow-lg border border-border pointer-events-auto motion-safe:animate-[toast-in_200ms_ease-out]';
  toast.textContent = message;

  root.appendChild(toast);

  // Auto-dismiss after duration
  setTimeout(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      // Instant removal for reduced motion users
      toast.remove();
    } else {
      toast.classList.add('opacity-0', 'transition-opacity', 'duration-200');
      toast.addEventListener(
        'transitionend',
        () => {
          toast.remove();
        },
        { once: true },
      );
    }
  }, durationMs);
}

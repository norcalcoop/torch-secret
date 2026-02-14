/**
 * Loading spinner component with optional message text.
 *
 * Creates a centered spinner animation using Tailwind CSS utilities.
 * Used during fetch and decrypt operations on the reveal page.
 */

/**
 * Create a loading spinner with an optional message displayed below.
 *
 * @param message - Text to display below the spinner (default: "Loading...")
 * @returns A styled div element containing the spinner and message
 */
export function createLoadingSpinner(message?: string): HTMLDivElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'flex flex-col items-center justify-center gap-3 py-12';

  // Spinner: a spinning border-based circle
  const spinner = document.createElement('div');
  spinner.className =
    'h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600';

  // Message text below the spinner
  const text = document.createElement('p');
  text.className = 'text-sm text-gray-500';
  text.textContent = message ?? 'Loading...';

  wrapper.appendChild(spinner);
  wrapper.appendChild(text);

  return wrapper;
}

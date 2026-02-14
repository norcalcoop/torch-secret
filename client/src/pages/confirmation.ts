/**
 * Confirmation page - placeholder for Task 1 build verification.
 *
 * Full implementation in Task 2.
 */

/**
 * Render the confirmation page after successful secret creation.
 */
export function renderConfirmationPage(
  container: HTMLElement,
  _shareUrl: string,
  _expiresAt: string,
): void {
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  const heading = document.createElement('h1');
  heading.textContent = 'Link created';
  container.appendChild(heading);
}

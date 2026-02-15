/**
 * Confirmation page displayed after successful secret creation.
 *
 * Shows the shareable URL with a copy button, expiration timestamp,
 * and a warning about one-time viewing. This page is rendered
 * programmatically (state-based, not URL-based) -- refreshing the
 * browser returns to the create page since the key is gone from memory.
 */

import { createCopyButton } from '../components/copy-button.js';
import { navigate, updatePageMeta, focusPageHeading } from '../router.js';

/**
 * Render the confirmation page after successful secret creation.
 *
 * Replaces the container content with the share URL, copy button,
 * expiration info, one-time-view warning, and "Create Another" button.
 *
 * @param container - The DOM element to render into
 * @param shareUrl - The full shareable URL including the encryption key fragment
 * @param expiresAt - ISO 8601 timestamp string for when the secret expires
 */
export function renderConfirmationPage(
  container: HTMLElement,
  shareUrl: string,
  expiresAt: string,
): void {
  // Update page title and announce to screen readers
  updatePageMeta('Your Secure Link is Ready');

  // Clear existing content
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  // -- Page wrapper --
  const wrapper = document.createElement('div');
  wrapper.className = 'space-y-6 text-center';

  // -- Success icon --
  const iconContainer = document.createElement('div');
  iconContainer.className = 'flex justify-center';

  const icon = document.createElement('div');
  icon.className =
    'w-16 h-16 rounded-full bg-success/10 flex items-center justify-center';

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('w-8', 'h-8', 'text-success');

  // Shield with checkmark path
  const shieldPath = document.createElementNS(
    'http://www.w3.org/2000/svg',
    'path',
  );
  shieldPath.setAttribute(
    'd',
    'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  );
  svg.appendChild(shieldPath);

  const checkPath = document.createElementNS(
    'http://www.w3.org/2000/svg',
    'path',
  );
  checkPath.setAttribute('d', 'M9 12l2 2 4-4');
  svg.appendChild(checkPath);

  icon.appendChild(svg);
  iconContainer.appendChild(icon);
  wrapper.appendChild(iconContainer);

  // -- Heading --
  const heading = document.createElement('h1');
  heading.className = 'text-2xl sm:text-3xl font-heading font-semibold text-text-primary';
  heading.textContent = 'Your Secure Link is Ready';
  wrapper.appendChild(heading);

  // -- Share URL section --
  const urlSection = document.createElement('div');
  urlSection.className = 'space-y-3';

  const urlLabel = document.createElement('label');
  urlLabel.htmlFor = 'share-url';
  urlLabel.className = 'block text-sm text-text-muted';
  urlLabel.textContent = 'Share this link with your recipient:';
  urlSection.appendChild(urlLabel);

  const urlDisplay = document.createElement('div');
  urlDisplay.className =
    'flex items-stretch gap-0 rounded-lg border border-border overflow-hidden';

  const urlInput = document.createElement('input');
  urlInput.id = 'share-url';
  urlInput.type = 'text';
  urlInput.readOnly = true;
  urlInput.value = shareUrl;
  urlInput.className =
    'flex-1 min-w-0 px-3 py-2 min-h-[44px] bg-surface text-text-secondary text-sm font-mono border-none focus:outline-hidden select-all';

  // Select all text on focus for easy manual copying
  urlInput.addEventListener('focus', () => {
    urlInput.select();
  });

  urlDisplay.appendChild(urlInput);
  urlSection.appendChild(urlDisplay);

  // -- Copy button --
  const copyButtonContainer = document.createElement('div');
  copyButtonContainer.className = 'flex justify-center';

  const copyButton = createCopyButton(() => shareUrl, 'Copy Link');
  copyButtonContainer.appendChild(copyButton);
  urlSection.appendChild(copyButtonContainer);

  wrapper.appendChild(urlSection);

  // -- Expiration notice --
  const expiresDate = new Date(expiresAt);
  const expirationNotice = document.createElement('p');
  expirationNotice.className = 'text-sm text-text-muted';
  expirationNotice.textContent = `This link expires on ${expiresDate.toLocaleString()}`;
  wrapper.appendChild(expirationNotice);

  // -- Warning text --
  const warning = document.createElement('div');
  warning.className =
    'px-4 py-3 rounded-lg bg-accent/10 text-accent text-sm';
  warning.textContent =
    'This link can only be viewed once. Once opened, the secret is permanently destroyed.';
  wrapper.appendChild(warning);

  // -- Create another button --
  const createAnotherButton = document.createElement('button');
  createAnotherButton.type = 'button';
  createAnotherButton.className =
    'inline-block min-h-[44px] py-2 text-accent hover:text-accent-hover focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg focus:outline-hidden rounded font-medium transition-colors cursor-pointer';
  createAnotherButton.textContent = 'Create Another Secret';
  createAnotherButton.addEventListener('click', () => {
    navigate('/');
  });
  wrapper.appendChild(createAnotherButton);

  container.appendChild(wrapper);

  // Move focus to heading for screen reader users
  focusPageHeading();
}

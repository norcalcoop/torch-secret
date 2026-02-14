/**
 * Reveal secret page - placeholder.
 *
 * Will be implemented in a later plan with decryption and display UI.
 */

import type { PageRenderer } from '../router.js';

export const renderRevealPage: PageRenderer = (container) => {
  const heading = document.createElement('h1');
  heading.className = 'text-2xl font-bold mb-4';
  heading.textContent = 'View Secret';

  const placeholder = document.createElement('p');
  placeholder.className = 'text-gray-500';
  placeholder.textContent = 'Reveal page coming soon.';

  container.appendChild(heading);
  container.appendChild(placeholder);
};

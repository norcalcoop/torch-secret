/**
 * Create secret page - placeholder.
 *
 * Will be implemented in a later plan with the full form UI.
 */

import type { PageRenderer } from '../router.js';

export const renderCreatePage: PageRenderer = (container) => {
  const heading = document.createElement('h1');
  heading.className = 'text-2xl font-bold mb-4';
  heading.textContent = 'Share a Secret';

  const placeholder = document.createElement('p');
  placeholder.className = 'text-gray-500';
  placeholder.textContent = 'Create page coming soon.';

  container.appendChild(heading);
  container.appendChild(placeholder);
};

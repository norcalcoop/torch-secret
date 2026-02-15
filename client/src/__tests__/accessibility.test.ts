// @vitest-environment happy-dom

/**
 * Automated accessibility tests using vitest-axe (axe-core).
 *
 * Validates structural ARIA compliance for all pages and components.
 * Color contrast is disabled (happy-dom cannot compute styles) and
 * verified manually in a separate checkpoint.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';

expect.extend({ toHaveNoViolations });

let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement('div');
  container.id = 'app';
  document.body.appendChild(container);
});

afterEach(() => {
  document.body.removeChild(container);
});

describe('Create page accessibility', () => {
  it('has no accessibility violations', async () => {
    const { renderCreatePage } = await import('../pages/create.js');
    await renderCreatePage(container);

    const results = await axe(container, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(results).toHaveNoViolations();
  });

  it('"How It Works" section has proper heading hierarchy', async () => {
    const { renderCreatePage } = await import('../pages/create.js');
    await renderCreatePage(container);

    // h1 exists (page heading)
    expect(container.querySelector('h1')).not.toBeNull();

    // h2 for "How It Works"
    const h2 = container.querySelector('h2#how-it-works-heading');
    expect(h2).not.toBeNull();
    expect(h2!.textContent).toBe('How It Works');

    // Three h3 step headings
    const h3s = container.querySelectorAll('h3');
    expect(h3s.length).toBe(3);
  });

  it('"How It Works" section is labeled by its heading', async () => {
    const { renderCreatePage } = await import('../pages/create.js');
    await renderCreatePage(container);

    const section = container.querySelector(
      'section[aria-labelledby="how-it-works-heading"]',
    );
    expect(section).not.toBeNull();
  });
});

describe('Error page accessibility', () => {
  it('has no accessibility violations', async () => {
    const { renderErrorPage } = await import('../pages/error.js');
    renderErrorPage(container, 'not_available');

    const results = await axe(container, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(results).toHaveNoViolations();
  });
});

describe('Component accessibility', () => {
  it('loading spinner has role=status', async () => {
    const { createLoadingSpinner } = await import(
      '../components/loading-spinner.js'
    );
    const spinner = createLoadingSpinner('Testing...');

    expect(spinner.getAttribute('role')).toBe('status');
    expect(spinner.getAttribute('aria-live')).toBe('polite');
  });

  it('copy button has no accessibility violations', async () => {
    const { createCopyButton } = await import('../components/copy-button.js');
    const button = createCopyButton(() => 'test');
    container.appendChild(button);

    const results = await axe(container, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(results).toHaveNoViolations();
  });
});

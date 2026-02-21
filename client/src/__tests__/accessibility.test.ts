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
import * as matchers from 'vitest-axe/matchers';

expect.extend(matchers);

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
    renderCreatePage(container);

    const results = await axe(container, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(results).toHaveNoViolations();
  });

  it('"How It Works" section has proper heading hierarchy', async () => {
    const { renderCreatePage } = await import('../pages/create.js');
    renderCreatePage(container);

    // h1 exists (page heading)
    expect(container.querySelector('h1')).not.toBeNull();

    // h2 for "How It Works"
    const h2 = container.querySelector('h2#how-it-works-heading');
    expect(h2).not.toBeNull();
    expect(h2!.textContent).toBe('How It Works');

    // Four h3 step headings (was 3, now 4: Paste, Encrypt, Share, Destroy)
    const section = container.querySelector('section[aria-labelledby="how-it-works-heading"]');
    const h3s = section!.querySelectorAll('h3');
    expect(h3s.length).toBe(4);
  });

  it('"How It Works" section is labeled by its heading', async () => {
    const { renderCreatePage } = await import('../pages/create.js');
    renderCreatePage(container);

    const section = container.querySelector('section[aria-labelledby="how-it-works-heading"]');
    expect(section).not.toBeNull();
  });

  it('"Why Trust Us?" section has proper heading hierarchy', async () => {
    const { renderCreatePage } = await import('../pages/create.js');
    renderCreatePage(container);

    // h2 for "Why Trust Us?"
    const h2 = container.querySelector('h2#why-trust-us-heading');
    expect(h2).not.toBeNull();
    expect(h2!.textContent).toBe('Why Trust Us?');

    // Section labeled by its heading
    const section = container.querySelector('section[aria-labelledby="why-trust-us-heading"]');
    expect(section).not.toBeNull();

    // 4 trust cards with h3 headings
    const trustH3s = section!.querySelectorAll('h3');
    expect(trustH3s.length).toBe(4);
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

describe('Protection panel accessibility', () => {
  it('tab strip has correct structure and default selection', async () => {
    const { renderCreatePage } = await import('../pages/create.js');
    renderCreatePage(container);

    // The protection panel uses a tablist with aria-label
    const tabList = container.querySelector('[role="tablist"]');
    expect(tabList).not.toBeNull();
    expect(tabList!.getAttribute('aria-label')).toBe('Protection mode');

    // 4 tab buttons: none, generate, custom, passphrase
    const tabs = tabList!.querySelectorAll('[role="tab"]');
    expect(tabs.length).toBe(4);

    // "No protection" tab is selected by default
    const noneTab = container.querySelector<HTMLButtonElement>('#tab-btn-none');
    expect(noneTab).not.toBeNull();
    expect(noneTab!.getAttribute('aria-selected')).toBe('true');

    // All other tabs are not selected by default
    const generateTab = container.querySelector<HTMLButtonElement>('#tab-btn-generate');
    expect(generateTab!.getAttribute('aria-selected')).toBe('false');

    const customTab = container.querySelector<HTMLButtonElement>('#tab-btn-custom');
    expect(customTab!.getAttribute('aria-selected')).toBe('false');

    const passphraseTab = container.querySelector<HTMLButtonElement>('#tab-btn-passphrase');
    expect(passphraseTab!.getAttribute('aria-selected')).toBe('false');
  });

  it('tab panels have correct ARIA linkage', async () => {
    const { renderCreatePage } = await import('../pages/create.js');
    renderCreatePage(container);

    // Each tabpanel is labelled by its corresponding tab button
    const tabIds: string[] = ['none', 'generate', 'custom', 'passphrase'];
    for (const id of tabIds) {
      const panel = container.querySelector(`[role="tabpanel"]#tab-${id}`);
      expect(panel).not.toBeNull();
      expect(panel!.getAttribute('aria-labelledby')).toBe(`tab-btn-${id}`);
    }

    // Only the "none" panel is visible by default
    const nonePanel = container.querySelector('#tab-none');
    expect((nonePanel as HTMLElement).hidden).toBe(false);

    const generatePanel = container.querySelector('#tab-generate');
    expect((generatePanel as HTMLElement).hidden).toBe(true);
  });

  it('protection panel has no accessibility violations', async () => {
    const { renderCreatePage } = await import('../pages/create.js');
    renderCreatePage(container);

    const results = await axe(container, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(results).toHaveNoViolations();
  });
});

describe('Component accessibility', () => {
  it('loading spinner has role=status', async () => {
    const { createLoadingSpinner } = await import('../components/loading-spinner.js');
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

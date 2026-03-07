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

  it('incompatible filter error state has no accessibility violations', async () => {
    // Use a Pro-mode panel so the generate tab is unlocked and clickable.
    // In anonymous mode (renderCreatePage default), generate and custom tabs are
    // Pro-locked and cannot be activated — this test verifies generate-tab UI.
    const { createProtectionPanel } = await import('../pages/create.js');
    const panel = createProtectionPanel({ isAuthenticated: true, isPro: true });
    container.appendChild(panel.element);

    // Activate the Generate password tab by clicking it
    const generateTab = container.querySelector<HTMLButtonElement>('#tab-btn-generate');
    expect(generateTab).not.toBeNull();
    generateTab!.click();

    // Trigger the incompatible filter combination: easyToSay + omitSimilar
    // Both checkboxes must be checked simultaneously — the guard in password-generator.ts
    // throws when easyToSay + omitSimilar are both active (no chars available).
    // The UI in create.ts renders an error message in #gen-error when generatePassword throws.
    const easyToSayCheckbox = container.querySelector<HTMLInputElement>('#gen-easy-to-say');
    const omitSimilarCheckbox = container.querySelector<HTMLInputElement>('#gen-omit-similar');
    expect(easyToSayCheckbox).not.toBeNull();
    expect(omitSimilarCheckbox).not.toBeNull();

    // Check easyToSay first — this disables charset checkboxes (triggering a regenerate)
    easyToSayCheckbox!.checked = true;
    easyToSayCheckbox!.dispatchEvent(new Event('change', { bubbles: true }));

    // Now check omitSimilar — this triggers another regenerate with both flags active,
    // which throws 'No characters available with current filter combination'
    omitSimilarCheckbox!.checked = true;
    omitSimilarCheckbox!.dispatchEvent(new Event('change', { bubbles: true }));

    // Verify the error element is now visible (hidden class removed)
    const errorEl = container.querySelector('#gen-error');
    expect(errorEl).not.toBeNull();
    expect((errorEl as HTMLElement).classList.contains('hidden')).toBe(false);

    // Verify the error state has no axe violations
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

describe('Theme dropdown', () => {
  it('has no accessibility violations in closed state', async () => {
    const { createThemeDropdown } = await import('../components/theme-toggle.js');
    const dropdown = createThemeDropdown();
    container.appendChild(dropdown);

    const results = await axe(container, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(results).toHaveNoViolations();
  });

  it('has no accessibility violations in open state', async () => {
    const { createThemeDropdown } = await import('../components/theme-toggle.js');
    const dropdown = createThemeDropdown();
    container.appendChild(dropdown);

    // Open the dropdown panel
    const toggleBtn = dropdown.querySelector<HTMLButtonElement>('#theme-dropdown-btn');
    expect(toggleBtn).not.toBeNull();
    toggleBtn!.click();

    const results = await axe(container, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(results).toHaveNoViolations();
  });

  it('toggle button has aria-expanded attribute', async () => {
    const { createThemeDropdown } = await import('../components/theme-toggle.js');
    const dropdown = createThemeDropdown();
    container.appendChild(dropdown);

    const toggleBtn = dropdown.querySelector<HTMLButtonElement>('#theme-dropdown-btn');
    expect(toggleBtn).not.toBeNull();
    expect(toggleBtn!.hasAttribute('aria-expanded')).toBe(true);
    expect(toggleBtn!.getAttribute('aria-expanded')).toBe('false');
  });

  it('toggle button has aria-label attribute', async () => {
    const { createThemeDropdown } = await import('../components/theme-toggle.js');
    const dropdown = createThemeDropdown();
    container.appendChild(dropdown);

    const toggleBtn = dropdown.querySelector<HTMLButtonElement>('#theme-dropdown-btn');
    expect(toggleBtn).not.toBeNull();
    expect(toggleBtn!.getAttribute('aria-label')).toBe('Change theme');
  });

  it('retro theme buttons have role="menuitem"', async () => {
    const { createThemeDropdown } = await import('../components/theme-toggle.js');
    const dropdown = createThemeDropdown();
    container.appendChild(dropdown);

    // Open the panel to render menu items
    const toggleBtn = dropdown.querySelector<HTMLButtonElement>('#theme-dropdown-btn');
    toggleBtn!.click();

    const retroGroup = dropdown.querySelector('[aria-label="Retro Pro themes"]');
    expect(retroGroup).not.toBeNull();

    const menuItems = retroGroup!.querySelectorAll('[role="menuitem"]');
    expect(menuItems.length).toBeGreaterThan(0);
    menuItems.forEach((item) => {
      expect(item.getAttribute('role')).toBe('menuitem');
    });
  });
});

describe('PROT-02 brute-force label integration', () => {
  it('high tier yields centuries or eons brute-force estimate', async () => {
    const { generatePassword } = await import('../crypto/password-generator.js');

    // High tier: 16 chars, uppercase+numbers+symbols enabled
    // Expected entropy: 16 * log2(94) ~= 104 bits → "~centuries at 10B guesses/sec"
    const result = generatePassword({
      tier: 'high',
      uppercase: true,
      numbers: true,
      symbols: true,
      easyToSay: false,
      easyToRead: false,
      omitSimilar: false,
    });

    expect(result.password).toHaveLength(16);
    expect(result.entropyBits).toBeGreaterThan(100);
    // High tier should map to '~centuries' or '~eons' label
    expect(result.bruteForceEstimate).toMatch(/~(centuries|eons) at 10B guesses\/sec/);
  });

  it('max tier yields eons brute-force estimate', async () => {
    const { generatePassword } = await import('../crypto/password-generator.js');

    // Max tier: 24 chars, all charsets
    // Expected entropy: 24 * log2(94) ~= 157 bits → "~eons at 10B guesses/sec"
    const result = generatePassword({
      tier: 'max',
      uppercase: true,
      numbers: true,
      symbols: true,
      easyToSay: false,
      easyToRead: false,
      omitSimilar: false,
    });

    expect(result.password).toHaveLength(24);
    expect(result.entropyBits).toBeGreaterThan(150);
    expect(result.bruteForceEstimate).toBe('~eons at 10B guesses/sec');
  });

  it('low tier yields instantly or seconds brute-force estimate', async () => {
    const { generatePassword } = await import('../crypto/password-generator.js');

    // Low tier: 8 chars, lowercase only
    // Expected entropy: 8 * log2(26) ~= 37.6 bits → "~seconds" or "~minutes" at 10B/sec
    const result = generatePassword({
      tier: 'low',
      uppercase: false,
      numbers: false,
      symbols: false,
      easyToSay: false,
      easyToRead: false,
      omitSimilar: false,
    });

    expect(result.password).toHaveLength(8);
    expect(result.entropyBits).toBeLessThan(50);
    expect(result.bruteForceEstimate).toMatch(/~(seconds|minutes) at 10B guesses\/sec/);
  });

  it('brute-force label is visible in the generate tab DOM after generation', async () => {
    // Use a Pro-mode panel so the generate tab is unlocked and clickable.
    // In anonymous mode, the generate tab is Pro-locked and cannot be activated.
    const { createProtectionPanel } = await import('../pages/create.js');
    const panel = createProtectionPanel({ isAuthenticated: true, isPro: true });
    container.appendChild(panel.element);

    // Activate the Generate password tab
    const generateTab = container.querySelector<HTMLButtonElement>('#tab-btn-generate');
    expect(generateTab).not.toBeNull();
    generateTab!.click();

    // The entropy line renders as a <p> with aria-live="polite" (see create.ts)
    // After tab activation, regenerate() fires and populates the entropy line.
    const entropyLine = container.querySelector<HTMLElement>('p[aria-live="polite"]');
    expect(entropyLine).not.toBeNull();

    // The entropy line should contain a brute-force estimate label
    // Format from create.ts: "{Tier} · {N} bits · {bruteForceEstimate}"
    const text = entropyLine!.textContent ?? '';
    expect(text).toMatch(/\d+(\.\d+)? bits/);
    expect(text).toMatch(/at 10B guesses\/sec/);
  });
});

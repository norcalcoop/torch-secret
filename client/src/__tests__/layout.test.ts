// @vitest-environment happy-dom

/**
 * Tests for layout component audit fixes: QW6, S4.
 *
 * QW6: Open Source footer item is an anchor with the GitHub repo href,
 *      target="_blank", rel="noopener noreferrer"
 * S4: Footer contains /use/ and /vs/ internal links; header contains 'Use Cases' link to /use/
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../router.js', () => ({
  navigate: vi.fn(),
  initRouter: vi.fn(),
  updatePageMeta: vi.fn(),
  focusPageHeading: vi.fn(),
}));

// Mock authClient — createLayoutShell calls authClient.getSession()
vi.mock('../api/auth-client.js', () => ({
  authClient: {
    getSession: vi.fn().mockResolvedValue({ data: null }),
  },
}));

// Mock retro-data.js
vi.mock('../retro-data.js', () => ({
  THEMES: {},
}));

vi.mock('../components/theme-toggle.js', () => ({
  createThemeDropdown: vi.fn(() => {
    const btn = document.createElement('button');
    btn.id = 'theme-dropdown-btn';
    btn.textContent = 'Theme';
    return btn;
  }),
}));

let mainEl: HTMLElement;
let appEl: HTMLElement;

beforeEach(() => {
  // Set up DOM structure that createLayoutShell expects
  mainEl = document.createElement('main');
  mainEl.id = 'main-content';
  document.body.appendChild(mainEl);

  appEl = document.createElement('div');
  appEl.id = 'app';
  document.body.appendChild(appEl);

  // Mock window.location
  Object.defineProperty(window, 'location', {
    value: { pathname: '/', href: 'http://localhost/', search: '' },
    writable: true,
  });
});

afterEach(() => {
  // Remove all added elements
  while (document.body.firstChild) {
    document.body.removeChild(document.body.firstChild);
  }
  vi.clearAllMocks();
});

describe('QW6 — Open Source footer anchor', () => {
  it('footer contains an anchor with the GitHub repo href', async () => {
    const { createLayoutShell } = await import('../components/layout.js');
    createLayoutShell();

    const footer = document.getElementById('site-footer');
    expect(footer).not.toBeNull();

    const openSourceLink = footer!.querySelector<HTMLAnchorElement>(
      'a[href="https://github.com/norcalcoop/torch-secret"]',
    );
    expect(openSourceLink).not.toBeNull();
  });

  it('Open Source anchor has target="_blank"', async () => {
    const { createLayoutShell } = await import('../components/layout.js');
    createLayoutShell();

    const footer = document.getElementById('site-footer');
    const link = footer!.querySelector<HTMLAnchorElement>(
      'a[href="https://github.com/norcalcoop/torch-secret"]',
    );
    expect(link?.target).toBe('_blank');
  });

  it('Open Source anchor has rel containing "noopener"', async () => {
    const { createLayoutShell } = await import('../components/layout.js');
    createLayoutShell();

    const footer = document.getElementById('site-footer');
    const link = footer!.querySelector<HTMLAnchorElement>(
      'a[href="https://github.com/norcalcoop/torch-secret"]',
    );
    expect(link?.rel).toContain('noopener');
  });
});

describe('S4 — Footer internal /use/ and /vs/ links', () => {
  it('footer contains at least one anchor with href="/use/share-api-keys"', async () => {
    const { createLayoutShell } = await import('../components/layout.js');
    createLayoutShell();

    const footer = document.getElementById('site-footer');
    const link = footer!.querySelector<HTMLAnchorElement>('a[href="/use/share-api-keys"]');
    expect(link).not.toBeNull();
  });

  it('footer contains at least one anchor with href="/vs/onetimesecret"', async () => {
    const { createLayoutShell } = await import('../components/layout.js');
    createLayoutShell();

    const footer = document.getElementById('site-footer');
    const link = footer!.querySelector<HTMLAnchorElement>('a[href="/vs/onetimesecret"]');
    expect(link).not.toBeNull();
  });
});

describe('S4 — Header Use Cases link', () => {
  it('header contains an element with textContent "Use Cases"', async () => {
    const { createLayoutShell } = await import('../components/layout.js');
    createLayoutShell();

    const header = document.getElementById('site-header');
    expect(header).not.toBeNull();

    const useCasesEl = Array.from(header!.querySelectorAll('a, button, span')).find(
      (el) => el.textContent?.trim() === 'Use Cases',
    );
    expect(useCasesEl).not.toBeUndefined();
  });

  it('Use Cases link points to /use/', async () => {
    const { createLayoutShell } = await import('../components/layout.js');
    createLayoutShell();

    const header = document.getElementById('site-header');
    const useCasesLink = header!.querySelector<HTMLAnchorElement>('a[href="/use/"]');
    expect(useCasesLink).not.toBeNull();
    expect(useCasesLink?.textContent?.trim()).toBe('Use Cases');
  });
});

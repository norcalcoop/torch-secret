// @vitest-environment happy-dom

/**
 * Tests for reveal page audit fix: QW4.
 *
 * QW4: Viral CTA block with heading 'Create your own secret' and
 *      button 'Create a Free Secret →' replacing the plain 'Create a New Secret' link.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../router.js', () => ({
  navigate: vi.fn(),
  initRouter: vi.fn(),
  updatePageMeta: vi.fn(),
  focusPageHeading: vi.fn(),
}));

// Mock analytics
vi.mock('../analytics/posthog.js', () => ({
  captureSecretViewed: vi.fn(),
  capturePageview: vi.fn(),
}));

// Mock the terminal block component
vi.mock('../components/terminal-block.js', () => ({
  createTerminalBlock: vi.fn((text: string) => {
    const div = document.createElement('div');
    div.className = 'terminal-block mb-6';
    div.textContent = text;
    return div;
  }),
}));

// Mock feedback link
vi.mock('../components/feedback-link.js', () => ({
  createFeedbackLink: vi.fn(() => {
    const a = document.createElement('a');
    a.href = '#feedback';
    a.textContent = 'Give Feedback';
    return a;
  }),
  TALLY_FEEDBACK_URL: 'https://tally.so/feedback',
}));

let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement('div');
  container.id = 'app';
  document.body.appendChild(container);

  // Mock window.location for reveal page
  Object.defineProperty(window, 'location', {
    value: {
      hash: '#testkey123',
      pathname: '/secret/abcdefghijklmnopqrstu',
      search: '',
      href: 'http://localhost/secret/abcdefghijklmnopqrstu#testkey123',
    },
    writable: true,
  });

  // Mock history.replaceState
  vi.spyOn(history, 'replaceState').mockImplementation(() => undefined);

  // Mock window.matchMedia for burn timer
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockReturnValue({
      matches: false,
      addListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
});

afterEach(() => {
  document.body.removeChild(container);
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('QW4 — Viral CTA block in revealed secret', () => {
  it('renderRevealedSecret shows heading "Create your own secret"', async () => {
    const { renderRevealedSecret } = await import('../pages/reveal.js');
    renderRevealedSecret(container, 'test secret text');

    const allText = container.textContent ?? '';
    expect(allText).toContain('Create your own secret');
  });

  it('renderRevealedSecret shows button/link with text containing "Create a Free Secret"', async () => {
    const { renderRevealedSecret } = await import('../pages/reveal.js');
    renderRevealedSecret(container, 'test secret text');

    // Find a button or link with the CTA text
    const ctaEl = Array.from(container.querySelectorAll('a, button')).find((el) =>
      el.textContent?.includes('Create a Free Secret'),
    );
    expect(ctaEl).not.toBeUndefined();
  });

  it('renderRevealedSecret does NOT contain old "Create a New Secret" link text', async () => {
    const { renderRevealedSecret } = await import('../pages/reveal.js');
    renderRevealedSecret(container, 'test secret text');

    const allText = container.textContent ?? '';
    expect(allText).not.toContain('Create a New Secret');
  });
});

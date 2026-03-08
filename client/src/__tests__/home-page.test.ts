// @vitest-environment happy-dom

/**
 * Tests for marketing homepage audit fixes: QW1, QW8, S2, S4.
 *
 * QW1: H1 two-line block-span copy ("We can't read your secrets." / "Not even under subpoena.")
 * QW8: Email capture section removed from homepage
 * S2: Security Architecture section with 3 columns
 * S4: /use/ links in homepage body
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../router.js', () => ({
  navigate: vi.fn(),
  initRouter: vi.fn(),
  updatePageMeta: vi.fn(),
  focusPageHeading: vi.fn(),
}));

let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement('div');
  container.id = 'app';
  document.body.appendChild(container);
});

afterEach(() => {
  document.body.removeChild(container);
  vi.clearAllMocks();
});

describe('QW1 — Homepage H1 two-line block spans', () => {
  it('h1 has two block-span children', async () => {
    const { renderHomePage } = await import('../pages/home.js');
    renderHomePage(container);

    const h1 = container.querySelector('h1');
    expect(h1).not.toBeNull();

    const spans = h1!.querySelectorAll('span.block');
    expect(spans.length).toBeGreaterThanOrEqual(2);
  });

  it('first span has correct text', async () => {
    const { renderHomePage } = await import('../pages/home.js');
    renderHomePage(container);

    const h1 = container.querySelector('h1');
    const spans = h1!.querySelectorAll('span.block');
    expect(spans[0]?.textContent).toBe("We can't read your secrets.");
  });

  it('second span has correct text', async () => {
    const { renderHomePage } = await import('../pages/home.js');
    renderHomePage(container);

    const h1 = container.querySelector('h1');
    const spans = h1!.querySelectorAll('span.block');
    expect(spans[1]?.textContent).toBe('Not even under subpoena.');
  });

  it('subheadline includes zero-knowledge framing', async () => {
    const { renderHomePage } = await import('../pages/home.js');
    renderHomePage(container);

    const allText = container.textContent ?? '';
    expect(allText).toContain('Zero-knowledge');
  });
});

describe('QW8 — Email capture section removed', () => {
  it('container has no element with aria-labelledby="email-capture-heading"', async () => {
    const { renderHomePage } = await import('../pages/home.js');
    renderHomePage(container);

    const emailSection = container.querySelector('[aria-labelledby="email-capture-heading"]');
    expect(emailSection).toBeNull();
  });
});

describe('S2 — Security Architecture section', () => {
  it('container has an element containing "Client-Side Encryption"', async () => {
    const { renderHomePage } = await import('../pages/home.js');
    renderHomePage(container);

    const allText = container.textContent ?? '';
    expect(allText).toContain('Client-Side Encryption');
  });

  it('security section contains "One-Time Destruction"', async () => {
    const { renderHomePage } = await import('../pages/home.js');
    renderHomePage(container);

    const allText = container.textContent ?? '';
    expect(allText).toContain('One-Time Destruction');
  });

  it('security section contains "Zero-Knowledge Proof"', async () => {
    const { renderHomePage } = await import('../pages/home.js');
    renderHomePage(container);

    const allText = container.textContent ?? '';
    expect(allText).toContain('Zero-Knowledge Proof');
  });
});

describe('S4 — Homepage body /use/ links', () => {
  it('container has an <a> with href containing "/use/share-api-keys"', async () => {
    const { renderHomePage } = await import('../pages/home.js');
    renderHomePage(container);

    const link = container.querySelector<HTMLAnchorElement>('a[href*="/use/share-api-keys"]');
    expect(link).not.toBeNull();
  });
});

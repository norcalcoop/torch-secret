// @vitest-environment happy-dom

/**
 * Tests for pricing page audit fix: QW3.
 *
 * QW3: '7-day money-back guarantee — no questions asked' text below Get Pro CTA button.
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

describe('QW3 — Guarantee badge below Get Pro CTA', () => {
  it('container has an element with text containing "7-day money-back guarantee"', async () => {
    const { renderPricingPage } = await import('../pages/pricing.js');
    renderPricingPage(container);

    const allText = container.textContent ?? '';
    expect(allText).toContain('7-day money-back guarantee');
  });

  it('guarantee text contains "no questions asked"', async () => {
    const { renderPricingPage } = await import('../pages/pricing.js');
    renderPricingPage(container);

    const allText = container.textContent ?? '';
    expect(allText).toContain('no questions asked');
  });

  it('guarantee element appears after the Get Pro CTA button in document order', async () => {
    const { renderPricingPage } = await import('../pages/pricing.js');
    renderPricingPage(container);

    // Find the Get Pro CTA link
    const getProLink = Array.from(container.querySelectorAll('a')).find(
      (a) => a.textContent?.trim() === 'Get Pro',
    );
    expect(getProLink).not.toBeUndefined();

    // Find the guarantee element
    const guaranteeEl = Array.from(container.querySelectorAll('p, span, div')).find((el) =>
      el.textContent?.includes('7-day money-back guarantee'),
    );
    expect(guaranteeEl).not.toBeUndefined();

    // Verify document order: guarantee must come after Get Pro
    const order = getProLink!.compareDocumentPosition(guaranteeEl!);
    // Node.DOCUMENT_POSITION_FOLLOWING = 4 — guaranteeEl follows getProLink
    expect(order & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

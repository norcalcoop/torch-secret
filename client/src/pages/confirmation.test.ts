import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mocks must appear before imports that depend on them.
vi.mock('../router.js', () => ({
  navigate: vi.fn(),
  updatePageMeta: vi.fn(),
  focusPageHeading: vi.fn(),
}));
vi.mock('../analytics/posthog.js', () => ({
  captureConversionPromptShown: vi.fn(),
  captureConversionPromptClicked: vi.fn(),
}));
vi.mock('../components/icons.js', () => ({
  createIcon: vi.fn(() => document.createElement('span')),
}));
vi.mock('../components/copy-button.js', () => ({
  createCopyButton: vi.fn(() => document.createElement('button')),
}));
vi.mock('../components/share-button.js', () => ({
  createShareButton: vi.fn(() => null),
}));

import { renderConfirmationPage } from './confirmation.js';

describe('confirmation page — feedback link (FBCK-01)', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('renders an anchor linking to tally.so', () => {
    renderConfirmationPage(
      container,
      'https://example.com/secret#key',
      new Date(Date.now() + 3600000).toISOString(),
    );
    const anchor = container.querySelector('a[href*="tally.so"]');
    expect(anchor).not.toBeNull();
  });

  it('opens in a new tab', () => {
    renderConfirmationPage(
      container,
      'https://example.com/secret#key',
      new Date(Date.now() + 3600000).toISOString(),
    );
    const anchor = container.querySelector<HTMLAnchorElement>('a[href*="tally.so"]');
    expect(anchor?.target).toBe('_blank');
  });

  it('has rel=noopener noreferrer', () => {
    renderConfirmationPage(
      container,
      'https://example.com/secret#key',
      new Date(Date.now() + 3600000).toISOString(),
    );
    const anchor = container.querySelector<HTMLAnchorElement>('a[href*="tally.so"]');
    expect(anchor?.rel).toBe('noopener noreferrer');
  });

  it('has text content "Share feedback"', () => {
    renderConfirmationPage(
      container,
      'https://example.com/secret#key',
      new Date(Date.now() + 3600000).toISOString(),
    );
    const anchor = container.querySelector('a[href*="tally.so"]');
    expect(anchor?.textContent).toBe('Share feedback');
  });
});

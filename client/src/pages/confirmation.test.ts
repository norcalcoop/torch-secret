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
vi.mock('../components/qr-code-panel.js', () => ({
  createQrCodePanel: vi.fn(() => ({
    toggleButton: (() => {
      const btn = document.createElement('button');
      btn.setAttribute('aria-label', 'Show QR code');
      return btn;
    })(),
    panel: document.createElement('div'),
  })),
}));
vi.mock('../components/mailto-button.js', () => ({
  createMailtoButton: vi.fn((url: string) => {
    const a = document.createElement('a');
    a.href = `mailto:?subject=test&body=${encodeURIComponent(url)}`;
    return a;
  }),
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

describe('confirmation page — phase 58.2 integrations', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('renders a mailto anchor in the button row', () => {
    renderConfirmationPage(
      container,
      'https://torchsecret.com/s/abc#key',
      new Date(Date.now() + 3600000).toISOString(),
    );
    const mailto = container.querySelector('a[href^="mailto:"]');
    expect(mailto).not.toBeNull();
  });

  it('calls createCopyButton with autoClearMs: 60_000 for Copy Link', async () => {
    const { createCopyButton } = await import('../components/copy-button.js');
    renderConfirmationPage(
      container,
      'https://torchsecret.com/s/abc#key',
      new Date(Date.now() + 3600000).toISOString(),
    );
    expect(createCopyButton).toHaveBeenCalledWith(
      expect.any(Function),
      'Copy Link',
      expect.objectContaining({ autoClearMs: 60_000 }),
    );
  });

  it('calls createCopyButton with autoClearMs: 60_000 for Copy Passphrase', async () => {
    const { createCopyButton } = await import('../components/copy-button.js');
    renderConfirmationPage(
      container,
      'https://torchsecret.com/s/abc#key',
      new Date(Date.now() + 3600000).toISOString(),
      undefined,
      'word-word-word',
    );
    expect(createCopyButton).toHaveBeenCalledWith(
      expect.any(Function),
      'Copy Passphrase',
      expect.objectContaining({ autoClearMs: 60_000 }),
    );
  });

  it('renders QR toggle button with aria-label containing "QR"', () => {
    renderConfirmationPage(
      container,
      'https://torchsecret.com/s/abc#key',
      new Date(Date.now() + 3600000).toISOString(),
    );
    const qrBtn = container.querySelector('button[aria-label*="QR"], button[aria-label*="qr"]');
    expect(qrBtn).not.toBeNull();
  });
});

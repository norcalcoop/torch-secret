import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mocks must appear before imports that depend on them.
vi.mock('../api/client.js', () => ({
  getSecret: vi.fn(),
  getSecretMeta: vi.fn(),
  verifySecretPassword: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    body: unknown;
    constructor(message: string, status: number, body?: unknown) {
      super(message);
      this.status = status;
      this.body = body;
    }
  },
}));
vi.mock('../analytics/posthog.js', () => ({
  captureSecretViewed: vi.fn(),
}));
vi.mock('../components/terminal-block.js', () => ({
  createTerminalBlock: vi.fn(() => document.createElement('div')),
}));
vi.mock('../components/icons.js', () => ({
  createIcon: vi.fn(() => document.createElement('span')),
}));
vi.mock('../components/loading-spinner.js', () => ({
  createLoadingSpinner: vi.fn(() => document.createElement('div')),
}));
vi.mock('./error.js', () => ({
  renderErrorPage: vi.fn(),
}));
vi.mock('../router.js', () => ({
  navigate: vi.fn(),
}));
vi.mock('../crypto/index.js', () => ({
  decrypt: vi.fn(),
}));

import { renderRevealedSecret } from './reveal.js';

describe('reveal page — feedback link (FBCK-02)', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('renders an anchor linking to tally.so', () => {
    renderRevealedSecret(container, 'hello world');
    const anchor = container.querySelector('a[href*="tally.so"]');
    expect(anchor).not.toBeNull();
  });

  it('opens in a new tab', () => {
    renderRevealedSecret(container, 'hello world');
    const anchor = container.querySelector<HTMLAnchorElement>('a[href*="tally.so"]');
    expect(anchor?.target).toBe('_blank');
  });

  it('has rel=noopener noreferrer', () => {
    renderRevealedSecret(container, 'hello world');
    const anchor = container.querySelector<HTMLAnchorElement>('a[href*="tally.so"]');
    expect(anchor?.rel).toBe('noopener noreferrer');
  });

  it('has text content "Share feedback"', () => {
    renderRevealedSecret(container, 'hello world');
    const anchor = container.querySelector('a[href*="tally.so"]');
    expect(anchor?.textContent).toBe('Share feedback');
  });
});

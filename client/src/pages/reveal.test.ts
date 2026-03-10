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

// ---------------------------------------------------------------------------
// Burn timer tests (RED — Plan 04 will implement the ?burn= feature)
// ---------------------------------------------------------------------------

describe('reveal page — burn timer (?burn= URL param)', () => {
  let container: HTMLElement;
  let originalLocation: Location;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);

    // Preserve original location so we can restore it in afterEach
    originalLocation = window.location;
  });

  afterEach(() => {
    document.body.removeChild(container);

    // Restore window.location if it was stubbed
    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    });

    vi.restoreAllMocks();
  });

  it('shows a burn-timer status line when ?burn=30 is present in search params', () => {
    // Stub window.location.search to simulate ?burn=30
    Object.defineProperty(window, 'location', {
      writable: true,
      value: {
        ...window.location,
        search: '?burn=30',
        href: 'http://localhost/s/abc123abc123abc123abc?burn=30',
      },
    });

    renderRevealedSecret(container, 'top secret data');

    // Plan 04 will render a status line matching "Content hides in 30s"
    const allText = container.textContent ?? '';
    expect(allText).toMatch(/Content hides in \d+s/);
  });

  it('does NOT show countdown text under prefers-reduced-motion', () => {
    // Stub window.location.search to simulate ?burn=30
    Object.defineProperty(window, 'location', {
      writable: true,
      value: {
        ...window.location,
        search: '?burn=30',
        href: 'http://localhost/s/abc123abc123abc123abc?burn=30',
      },
    });

    // Stub window.matchMedia to return prefers-reduced-motion: reduce
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    renderRevealedSecret(container, 'top secret data');

    // Under reduced motion, countdown text should NOT appear (timer still fires but no visible countdown)
    const allText = container.textContent ?? '';
    expect(allText).not.toMatch(/Content hides in \d+s/);
  });
});

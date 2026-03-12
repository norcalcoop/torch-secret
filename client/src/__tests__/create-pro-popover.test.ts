// @vitest-environment happy-dom

/**
 * Tests for create page Pro popover audit fix: QW7.
 *
 * QW7: Pro-locked tab popover includes '$5.42/mo' in the copy.
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
  captureSecretCreated: vi.fn(),
  captureConversionPromptShown: vi.fn(),
  captureConversionPromptClicked: vi.fn(),
}));

// Mock API client
vi.mock('../api/client.js', () => ({
  createSecret: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    body: unknown;
    constructor(message: string, status: number, body?: unknown) {
      super(message);
      this.status = status;
      this.body = body;
    }
  },
  getMe: vi.fn().mockResolvedValue({ id: null }),
}));

// Mock authClient
vi.mock('../api/auth-client.js', () => ({
  authClient: {
    getSession: vi.fn().mockResolvedValue({ data: null }),
  },
}));

// Mock expiration-select component
vi.mock('../components/expiration-select.js', () => ({
  createExpirationSelect: vi.fn(() => ({
    element: document.createElement('select'),
    getValue: vi.fn().mockReturnValue('24h'),
    disable: vi.fn(),
    enable: vi.fn(),
  })),
}));

// Mock toast
vi.mock('../components/toast.js', () => ({
  showToast: vi.fn(),
}));

// Mock terminal block
vi.mock('../components/terminal-block.js', () => ({
  createTerminalBlock: vi.fn((text: string) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div;
  }),
}));

// Mock crypto
vi.mock('../crypto/index.js', () => ({
  encrypt: vi.fn().mockResolvedValue('encrypted'),
  generatePassphrase: vi.fn().mockReturnValue('word-word-word-word-word'),
  generatePassword: vi.fn().mockReturnValue({
    password: 'Test1234!',
    entropyBits: 52,
    bruteForceEstimate: '~hours at 10B guesses/sec',
  }),
}));

vi.mock('../crypto/word-lists.js', () => ({
  TECH_WORDS: ['alpha', 'beta', 'gamma'],
  NATURE_WORDS: ['oak', 'elm', 'ash'],
  SHORT_WORDS: ['cat', 'dog', 'fox'],
}));

let container: HTMLDivElement;

beforeEach(() => {
  vi.resetModules();
  vi.doMock('../crypto/passphrase.js', () => ({
    EFF_WORDS: ['abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb'],
    generatePassphrase: vi.fn().mockReturnValue('word-word-word-word-word'),
  }));

  container = document.createElement('div');
  container.id = 'app';
  document.body.appendChild(container);

  // Mock window.location
  Object.defineProperty(window, 'location', {
    value: { search: '', href: 'http://localhost/create', pathname: '/create' },
    writable: true,
  });
});

afterEach(() => {
  document.body.removeChild(container);
  vi.clearAllMocks();
});

describe('QW7 — Pro popover includes $5.42/mo', () => {
  it('Pro-locked custom password tab popover contains "$5.42/mo"', async () => {
    // Use createProtectionPanel directly with free user (no Pro) to get the Pro-locked popover
    const { createProtectionPanel } = await import('../pages/create.js');
    const panel = createProtectionPanel({ isAuthenticated: false, isPro: false });
    container.appendChild(panel.element);

    // Click the custom password tab (Pro-locked for free users)
    const customTab = container.querySelector<HTMLButtonElement>('#tab-btn-custom');
    expect(customTab).not.toBeNull();
    customTab!.click();

    // The popover should now be visible
    const popover = container.querySelector('#lock-popover-custom');
    expect(popover).not.toBeNull();

    const popoverText = popover?.textContent ?? '';
    expect(popoverText).toContain('$5.42/mo');
  });

  it('Pro-locked passphrase tab popover does NOT contain "$5.42/mo" (free-account lock)', async () => {
    // The passphrase tab is locked with a different message (free account required, not Pro)
    const { createProtectionPanel } = await import('../pages/create.js');
    const panel = createProtectionPanel({ isAuthenticated: false, isPro: false });
    container.appendChild(panel.element);

    // Click the passphrase tab (free-account locked)
    const passphraseTab = container.querySelector<HTMLButtonElement>('#tab-btn-passphrase');
    expect(passphraseTab).not.toBeNull();
    passphraseTab!.click();

    const popover = container.querySelector('#lock-popover-passphrase');
    // This popover should NOT have $5.42/mo — it is a free-account lock, not Pro lock
    const popoverText = popover?.textContent ?? '';
    expect(popoverText).not.toContain('$5.42/mo');
  });
});

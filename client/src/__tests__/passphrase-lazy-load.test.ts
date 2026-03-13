// @vitest-environment happy-dom

/**
 * Tests for BNDL-02: passphrase panel lazy-load behaviors.
 * Verifies that EFF_WORDS is loaded only on demand via getPassphraseModule().
 *
 * Strategy: use vi.doMock + vi.resetModules() so each test gets a fresh module
 * instance with a controlled passphrase.js mock.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// All static dependencies of create.ts must be mocked before dynamic import.
// These are registered with vi.mock (hoisted) so they apply to every test.
vi.mock('../router.js', () => ({
  navigate: vi.fn(),
  initRouter: vi.fn(),
  updatePageMeta: vi.fn(),
  focusPageHeading: vi.fn(),
}));

vi.mock('../analytics/posthog.js', () => ({
  captureSecretCreated: vi.fn(),
  captureConversionPromptShown: vi.fn(),
  captureConversionPromptClicked: vi.fn(),
}));

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

vi.mock('../api/auth-client.js', () => ({
  authClient: {
    getSession: vi.fn().mockResolvedValue({ data: null }),
  },
  isSession: vi.fn().mockReturnValue(false),
}));

vi.mock('../components/expiration-select.js', () => ({
  createExpirationSelect: vi.fn(() => ({
    element: document.createElement('select'),
    getValue: vi.fn().mockReturnValue('24h'),
    disable: vi.fn(),
    enable: vi.fn(),
  })),
}));

vi.mock('../components/toast.js', () => ({
  showToast: vi.fn(),
}));

vi.mock('../components/terminal-block.js', () => ({
  createTerminalBlock: vi.fn((text: string) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div;
  }),
}));

// crypto/index.js — keep generatePassphrase in mock since index.ts still re-exports it
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

vi.mock('../components/loading-spinner.js', () => ({
  createLoadingSpinner: vi.fn((message?: string) => {
    const div = document.createElement('div');
    div.setAttribute('role', 'status');
    div.setAttribute('aria-live', 'polite');
    const text = document.createElement('p');
    text.textContent = message ?? 'Loading...';
    div.appendChild(text);
    return div;
  }),
}));

// pages/confirmation.js — needed because create.ts imports it
vi.mock('../pages/confirmation.js', () => ({
  renderConfirmationPage: vi.fn(),
}));

// ---- Helpers ----

let container: HTMLDivElement;

beforeEach(() => {
  vi.resetModules();
  container = document.createElement('div');
  container.id = 'app';
  document.body.appendChild(container);

  Object.defineProperty(window, 'location', {
    value: { search: '', href: 'http://localhost/create', pathname: '/create' },
    writable: true,
  });
});

afterEach(() => {
  document.body.removeChild(container);
  vi.clearAllMocks();
});

describe('passphrase lazy-load (BNDL-02)', () => {
  it('shows loading spinner on first passphrase tab activation', { timeout: 8000 }, async () => {
    // Arrange: a passphrase mock that stays pending until we resolve it manually
    let resolvePassphraseModule!: (value: unknown) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePassphraseModule = resolve;
    });

    vi.doMock('../crypto/passphrase.js', () => pendingPromise);

    const { createProtectionPanel } = await import('../pages/create.js');

    // Render the panel with an authenticated user (passphrase tab unlocked)
    const panel = createProtectionPanel({ isAuthenticated: true, isPro: false });
    container.appendChild(panel.element);

    // Act: click the passphrase tab
    const passphraseTab = container.querySelector<HTMLButtonElement>('#tab-btn-passphrase');
    expect(passphraseTab).not.toBeNull();
    passphraseTab!.click();

    // Assert: loading spinner or 'Generating...' text is visible BEFORE module resolves
    const spinnerOrText =
      container.querySelector('[role=status]') ??
      Array.from(container.querySelectorAll('p, span, div')).find((el) =>
        el.textContent?.includes('Generating'),
      );
    expect(spinnerOrText).not.toBeNull();

    // Cleanup: resolve so no unhandled promise
    resolvePassphraseModule({
      EFF_WORDS: ['abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb'],
      generatePassphrase: vi.fn().mockReturnValue('word-word-word-word-word'),
    });
    await pendingPromise;
    await Promise.resolve(); // flush microtasks
  });

  it('replaces spinner with passphrase input after module resolves', async () => {
    // Arrange: a passphrase mock that resolves immediately
    vi.doMock('../crypto/passphrase.js', () => ({
      EFF_WORDS: ['abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb'],
      generatePassphrase: vi.fn().mockReturnValue('word-word-word-word-word'),
    }));

    const { createProtectionPanel } = await import('../pages/create.js');
    const panel = createProtectionPanel({ isAuthenticated: true, isPro: false });
    container.appendChild(panel.element);

    // Act: click the passphrase tab and wait for module to resolve
    const passphraseTab = container.querySelector<HTMLButtonElement>('#tab-btn-passphrase');
    expect(passphraseTab).not.toBeNull();
    passphraseTab!.click();

    // Wait for the dynamic import to settle and initPassphrasePanel() to update the DOM.
    // vi.waitFor polls until the assertion passes, avoiding the timing race of a fixed setTimeout.
    await vi.waitFor(() => {
      expect(container.querySelector('#passphrase-input')).not.toBeNull();
    });

    // Assert: spinner (role=status from loading-spinner) is gone
    const spinner = container.querySelector('[role=status]');
    expect(spinner).toBeNull();
  });

  it('shows error state with Retry button when dynamic import fails', async () => {
    // Arrange: passphrase.js factory that returns a rejected promise.
    // When create.ts no longer statically imports passphrase.js (after Task 2),
    // this rejection will propagate from getPassphraseModule() to initPassphrasePanel()'s
    // catch block, which renders the error UI.
    vi.doMock('../crypto/passphrase.js', () => {
      return new Promise<never>((_, reject) => {
        reject(new Error('Network error'));
      });
    });

    const { createProtectionPanel } = await import('../pages/create.js');
    const panel = createProtectionPanel({ isAuthenticated: true, isPro: false });
    container.appendChild(panel.element);

    // Act: click passphrase tab — triggers initPassphrasePanel()
    const passphraseTab = container.querySelector<HTMLButtonElement>('#tab-btn-passphrase');
    expect(passphraseTab).not.toBeNull();
    passphraseTab!.click();

    // Flush microtasks so the catch block runs and renders error DOM
    await new Promise((r) => setTimeout(r, 0));

    // Assert: error message contains "Failed to load"
    const errorText = container.querySelector('.text-error');
    expect(errorText).not.toBeNull();
    expect(errorText!.textContent).toContain('Failed to load');

    // Assert: Retry button exists
    const retryBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Retry'),
    );
    expect(retryBtn).not.toBeNull();
  });

  it('retry resets module cache and re-attempts import', async () => {
    // Arrange: first call rejects, second call resolves
    // After Task 2, create.ts uses dynamic import inside getPassphraseModule().
    // vi.resetModules() in beforeEach ensures each test gets a fresh module.
    let callCount = 0;
    vi.doMock('../crypto/passphrase.js', () => {
      callCount++;
      if (callCount === 1) {
        return new Promise<never>((_, reject) => {
          reject(new Error('First attempt fails'));
        });
      }
      return Promise.resolve({
        EFF_WORDS: ['abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb'],
        generatePassphrase: vi.fn().mockReturnValue('word-word-word-word-word'),
      });
    });

    const { createProtectionPanel } = await import('../pages/create.js');
    const panel = createProtectionPanel({ isAuthenticated: true, isPro: false });
    container.appendChild(panel.element);

    // First activation — triggers error
    const passphraseTab = container.querySelector<HTMLButtonElement>('#tab-btn-passphrase');
    passphraseTab!.click();
    await new Promise((r) => setTimeout(r, 0));

    // Confirm error state
    const retryBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Retry'),
    );
    expect(retryBtn).not.toBeNull();

    // Act: click Retry — should reset cache and re-attempt
    retryBtn!.click();
    await new Promise((r) => setTimeout(r, 0));

    // Assert: a second import attempt was made (callCount incremented)
    expect(callCount).toBeGreaterThanOrEqual(2);
  });

  it('New passphrase button uses cached module on subsequent calls', async () => {
    // Arrange: track how many times the module is "imported" (i.e. the factory is called)
    let importCallCount = 0;
    vi.doMock('../crypto/passphrase.js', () => {
      importCallCount++;
      return {
        EFF_WORDS: ['abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb'],
        generatePassphrase: vi.fn().mockReturnValue('word-word-word-word-word'),
      };
    });

    const { createProtectionPanel } = await import('../pages/create.js');
    const panel = createProtectionPanel({ isAuthenticated: true, isPro: false });
    container.appendChild(panel.element);

    // Activate passphrase tab — first import
    const passphraseTab = container.querySelector<HTMLButtonElement>('#tab-btn-passphrase');
    passphraseTab!.click();
    await new Promise((r) => setTimeout(r, 0));

    const beforeCount = importCallCount;

    // Act: click "New passphrase" — should use cached module, not re-import
    const newPassphraseBtn = Array.from(container.querySelectorAll('button')).find(
      (b) =>
        b.getAttribute('aria-label')?.includes('new passphrase') ||
        b.textContent?.includes('New passphrase'),
    );
    expect(newPassphraseBtn).not.toBeNull();
    newPassphraseBtn!.click();
    await new Promise((r) => setTimeout(r, 0));

    // Assert: no additional import calls after first successful load
    expect(importCallCount).toBe(beforeCount);
  });
});

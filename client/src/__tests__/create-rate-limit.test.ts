// @vitest-environment happy-dom

/**
 * Unit tests for showRateLimitUpsell() in client/src/pages/create.ts.
 *
 * showRateLimitUpsell() is module-private. These tests exercise it by
 * rendering the create page, mocking createSecret() to throw a 429 ApiError,
 * and submitting the form — then asserting the DOM output.
 *
 * This provides the alternative coverage referenced in the skip comment of
 * e2e/specs/rate-limits.spec.ts (lines 7-9), which is permanently skipped
 * because playwright.config.ts hardcodes E2E_TEST=true.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the crypto module (Web Crypto encrypt is not available in happy-dom)
vi.mock('../crypto/index.js', () => ({
  encrypt: vi.fn().mockResolvedValue({
    payload: { ciphertext: 'dGVzdA==' },
    keyBase64Url: 'testkey',
  }),
  generatePassphrase: vi.fn().mockReturnValue('word-word-word-word'),
  generatePassword: vi.fn().mockReturnValue({
    password: 'TestPass1!',
    entropyBits: 52,
    bruteForceEstimate: '~centuries at 10B guesses/sec',
  }),
}));

// Mock PostHog analytics (no network calls in unit tests)
vi.mock('../analytics/posthog.js', () => ({
  captureSecretCreated: vi.fn(),
  captureConversionPromptShown: vi.fn(),
  captureConversionPromptClicked: vi.fn(),
}));

// Mock the auth client (prevents network call; anonymous user = no session)
vi.mock('../api/auth-client.js', () => ({
  authClient: {
    getSession: vi.fn().mockResolvedValue({ data: null }),
  },
}));

// Mock router navigate (prevents navigation side-effects)
vi.mock('../router.js', () => ({
  navigate: vi.fn(),
}));

// Mock createSecret to simulate 429 responses with configurable rateLimitReset.
// Use the factory form (importOriginal) to preserve the real ApiError class while
// replacing only createSecret — required because create.ts uses instanceof ApiError.
const mockCreateSecret = vi.fn();
vi.mock('../api/client.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../api/client.js')>();
  return {
    ...original,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    createSecret: (...args: unknown[]) => mockCreateSecret(...args),
  };
});

// Import ApiError after vi.mock() declarations so it resolves from the mocked module
// (which spreads the original, preserving the real class).
import { ApiError } from '../api/client.js';

let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement('div');
  container.id = 'app';
  document.body.appendChild(container);
  vi.clearAllMocks();
});

afterEach(() => {
  document.body.removeChild(container);
});

/**
 * Helper: render the create page, fill in the textarea, and submit the form.
 * createSecret is expected to be mocked to throw before this is called.
 *
 * Returns the form's main errorArea element (direct child of <form> with
 * role="alert"), which showRateLimitUpsell() mutates into the upsell card.
 * Using "form > [role='alert']" is required because the protection panel also
 * contains a nested [role="alert"] (#gen-error) that precedes errorArea in
 * DOM order — querySelector('[role="alert"]') would return the wrong element.
 */
async function submitCreateForm(): Promise<HTMLElement> {
  const { renderCreatePage } = await import('../pages/create.js');
  renderCreatePage(container);

  const textarea = container.querySelector<HTMLTextAreaElement>('#secret-text');
  expect(textarea).not.toBeNull();
  textarea!.value = 'test secret content';
  // Trigger the input event so the form considers the field non-empty
  textarea!.dispatchEvent(new Event('input'));

  const form = container.querySelector<HTMLFormElement>('form');
  expect(form).not.toBeNull();

  // Capture the form-level errorArea before submit (direct child of form with role="alert")
  // so we have a reference to the correct element post-mutation.
  const errorArea = form!.querySelector<HTMLElement>(':scope > [role="alert"]');
  expect(errorArea).not.toBeNull();

  form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

  // Wait for the async submit handler (void IIFE) to resolve
  await new Promise((resolve) => setTimeout(resolve, 50));

  return errorArea!;
}

describe('showRateLimitUpsell() — countdown rendering', () => {
  it('renders "Limit resets in 60 minutes." when resetTimestamp is 3600', async () => {
    // 3600 seconds → Math.ceil(3600 / 60) = 60 minutes
    mockCreateSecret.mockRejectedValue(new ApiError(429, { error: 'Rate limit exceeded' }, 3600));

    const errorArea = await submitCreateForm();

    expect(errorArea.textContent).toContain("You've reached the free limit for anonymous sharing.");

    // 60 minutes — plural
    const countdownEl = Array.from(errorArea.querySelectorAll('p')).find((p) =>
      p.textContent?.includes('Limit resets in 60 minutes.'),
    );
    expect(countdownEl).not.toBeNull();
  });

  it('renders "Limit resets in 1 minute." (singular) when resetTimestamp is 45', async () => {
    // 45 seconds → Math.ceil(45 / 60) = 1 minute → singular
    mockCreateSecret.mockRejectedValue(new ApiError(429, { error: 'Rate limit exceeded' }, 45));

    const errorArea = await submitCreateForm();

    const countdownEl = Array.from(errorArea.querySelectorAll('p')).find((p) =>
      p.textContent?.includes('Limit resets in 1 minute.'),
    );
    expect(countdownEl).not.toBeNull();
  });

  it('renders "Limit resets in 30 minutes." when resetTimestamp is 1800', async () => {
    // 1800 seconds → Math.ceil(1800 / 60) = 30 minutes
    mockCreateSecret.mockRejectedValue(new ApiError(429, { error: 'Rate limit exceeded' }, 1800));

    const errorArea = await submitCreateForm();

    const countdownEl = Array.from(errorArea.querySelectorAll('p')).find((p) =>
      p.textContent?.includes('Limit resets in 30 minutes.'),
    );
    expect(countdownEl).not.toBeNull();
  });

  it('renders no countdown paragraph when resetTimestamp is undefined', async () => {
    // No rateLimitReset — the "if (resetTimestamp && resetTimestamp > 0)" branch is skipped
    mockCreateSecret.mockRejectedValue(new ApiError(429, { error: 'Rate limit exceeded' }));

    const errorArea = await submitCreateForm();

    expect(errorArea.textContent).toContain("You've reached the free limit for anonymous sharing.");

    // No "Limit resets" paragraph should be present
    const countdownEl = Array.from(errorArea.querySelectorAll('p')).find((p) =>
      p.textContent?.match(/Limit resets/),
    );
    expect(countdownEl).toBeUndefined();
  });

  it('renders "Sign up" CTA link pointing to /register', async () => {
    mockCreateSecret.mockRejectedValue(new ApiError(429, { error: 'Rate limit exceeded' }, 3600));

    const errorArea = await submitCreateForm();

    const ctaLink = errorArea.querySelector<HTMLAnchorElement>('a[href="/register"]');
    expect(ctaLink).not.toBeNull();
    expect(ctaLink!.textContent).toContain('Sign up');
  });
});

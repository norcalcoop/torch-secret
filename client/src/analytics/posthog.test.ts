// @vitest-environment happy-dom

/**
 * Unit tests for posthog.ts analytics module.
 *
 * Covers all new and extended functions added in Phase 37.1:
 * - captureSecretCreated (extended: new protectionType parameter)
 * - captureCheckoutInitiated (new)
 * - captureSubscriptionActivated (new)
 * - captureDashboardViewed (new)
 * - identifyUser (extended: new optional tier + registeredAt parameters)
 *
 * No-op tests use vi.resetModules() + dynamic re-import to get a fresh
 * module with _initialized = false, isolating them from the initialized state
 * used by the positive-path tests.
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('posthog-js', () => ({
  default: {
    init: vi.fn(),
    capture: vi.fn(),
    identify: vi.fn(),
    setPersonProperties: vi.fn(),
    reset: vi.fn(),
  },
}));

import posthog from 'posthog-js';
import {
  initAnalytics,
  captureSecretCreated,
  captureCheckoutInitiated,
  captureSubscriptionActivated,
  captureDashboardViewed,
  identifyUser,
} from './posthog.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Initialize analytics with a fake PostHog key.
 * Sets import.meta.env.VITE_POSTHOG_KEY so initAnalytics() passes the guard.
 */
function initializeAnalytics(): void {
  // Provide a fake key via import.meta.env (set by Vite / test env shim)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (import.meta.env as any)['VITE_POSTHOG_KEY'] = 'phc_test_key';
  initAnalytics();
}

// ---------------------------------------------------------------------------
// Initialize analytics once for all positive-path tests
// ---------------------------------------------------------------------------

beforeAll(() => {
  initializeAnalytics();
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// captureSecretCreated
// ---------------------------------------------------------------------------

describe('captureSecretCreated', () => {
  it('fires secret_created with expires_in, has_password, and protection_type', () => {
    captureSecretCreated('24h', true, 'passphrase');

    expect(posthog.capture).toHaveBeenCalledWith('secret_created', {
      expires_in: '24h',
      has_password: true,
      protection_type: 'passphrase',
    });
  });

  it("passes protection_type 'none' through correctly", () => {
    captureSecretCreated('1h', false, 'none');

    expect(posthog.capture).toHaveBeenCalledWith('secret_created', {
      expires_in: '1h',
      has_password: false,
      protection_type: 'none',
    });
  });

  it("passes protection_type 'generated' through correctly (distinct from 'password')", () => {
    captureSecretCreated('7d', true, 'generated');

    expect(posthog.capture).toHaveBeenCalledWith('secret_created', {
      expires_in: '7d',
      has_password: true,
      protection_type: 'generated',
    });
  });

  it('is a no-op when not initialized', async () => {
    vi.resetModules();
    // Re-mock posthog-js for the fresh module import
    vi.mock('posthog-js', () => ({
      default: {
        init: vi.fn(),
        capture: vi.fn(),
        identify: vi.fn(),
        setPersonProperties: vi.fn(),
        reset: vi.fn(),
      },
    }));
    const { captureSecretCreated: captureSecretCreatedFresh } = await import('./posthog.js');

    captureSecretCreatedFresh('1h', false, 'none');

    expect(posthog.capture).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// captureCheckoutInitiated
// ---------------------------------------------------------------------------

describe('captureCheckoutInitiated', () => {
  it("fires checkout_initiated with { source: 'dashboard' }", () => {
    captureCheckoutInitiated('dashboard');

    expect(posthog.capture).toHaveBeenCalledWith('checkout_initiated', { source: 'dashboard' });
  });

  it("fires checkout_initiated with { source: 'pricing_page' }", () => {
    captureCheckoutInitiated('pricing_page');

    expect(posthog.capture).toHaveBeenCalledWith('checkout_initiated', {
      source: 'pricing_page',
    });
  });

  it('is a no-op when not initialized', async () => {
    vi.resetModules();
    vi.mock('posthog-js', () => ({
      default: {
        init: vi.fn(),
        capture: vi.fn(),
        identify: vi.fn(),
        setPersonProperties: vi.fn(),
        reset: vi.fn(),
      },
    }));
    const { captureCheckoutInitiated: captureCheckoutInitiatedFresh } =
      await import('./posthog.js');

    captureCheckoutInitiatedFresh('dashboard');

    expect(posthog.capture).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// captureSubscriptionActivated
// ---------------------------------------------------------------------------

describe('captureSubscriptionActivated', () => {
  it('fires the subscription_activated event', () => {
    captureSubscriptionActivated();

    expect(posthog.capture).toHaveBeenCalledWith('subscription_activated');
  });

  it("calls posthog.setPersonProperties({ tier: 'pro' }) in the same call", () => {
    captureSubscriptionActivated();

    expect(posthog.setPersonProperties).toHaveBeenCalledWith({ tier: 'pro' });
  });

  it('fires both capture and setPersonProperties in the same function call', () => {
    captureSubscriptionActivated();

    expect(posthog.capture).toHaveBeenCalledTimes(1);
    expect(posthog.setPersonProperties).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when not initialized', async () => {
    vi.resetModules();
    vi.mock('posthog-js', () => ({
      default: {
        init: vi.fn(),
        capture: vi.fn(),
        identify: vi.fn(),
        setPersonProperties: vi.fn(),
        reset: vi.fn(),
      },
    }));
    const { captureSubscriptionActivated: captureSubscriptionActivatedFresh } =
      await import('./posthog.js');

    captureSubscriptionActivatedFresh();

    expect(posthog.capture).not.toHaveBeenCalled();
    expect(posthog.setPersonProperties).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// captureDashboardViewed
// ---------------------------------------------------------------------------

describe('captureDashboardViewed', () => {
  it('fires the dashboard_viewed event with no additional properties', () => {
    captureDashboardViewed();

    expect(posthog.capture).toHaveBeenCalledWith('dashboard_viewed');
    expect(posthog.capture).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when not initialized', async () => {
    vi.resetModules();
    vi.mock('posthog-js', () => ({
      default: {
        init: vi.fn(),
        capture: vi.fn(),
        identify: vi.fn(),
        setPersonProperties: vi.fn(),
        reset: vi.fn(),
      },
    }));
    const { captureDashboardViewed: captureDashboardViewedFresh } = await import('./posthog.js');

    captureDashboardViewedFresh();

    expect(posthog.capture).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// identifyUser
// ---------------------------------------------------------------------------

describe('identifyUser', () => {
  it('calls posthog.identify(userId) when called with userId only (backwards-compatible)', () => {
    identifyUser('user-123');

    expect(posthog.identify).toHaveBeenCalledWith('user-123');
  });

  it('does NOT call setPersonProperties when called with userId only', () => {
    identifyUser('user-456');

    expect(posthog.setPersonProperties).not.toHaveBeenCalled();
  });

  it('calls setPersonProperties with { tier, registered_at } when both optional params provided', () => {
    identifyUser('user-789', 'pro', '2025-01-15T10:00:00Z');

    expect(posthog.identify).toHaveBeenCalledWith('user-789');
    expect(posthog.setPersonProperties).toHaveBeenCalledWith({
      tier: 'pro',
      registered_at: '2025-01-15T10:00:00Z',
    });
  });

  it('calls setPersonProperties with only tier when registeredAt is omitted', () => {
    identifyUser('user-101', 'free');

    expect(posthog.setPersonProperties).toHaveBeenCalledWith({ tier: 'free' });
  });

  it('calls setPersonProperties with only registered_at when tier is omitted', () => {
    identifyUser('user-102', undefined, '2025-06-01T00:00:00Z');

    expect(posthog.setPersonProperties).toHaveBeenCalledWith({
      registered_at: '2025-06-01T00:00:00Z',
    });
  });

  it('is a no-op when not initialized', async () => {
    vi.resetModules();
    vi.mock('posthog-js', () => ({
      default: {
        init: vi.fn(),
        capture: vi.fn(),
        identify: vi.fn(),
        setPersonProperties: vi.fn(),
        reset: vi.fn(),
      },
    }));
    const { identifyUser: identifyUserFresh } = await import('./posthog.js');

    identifyUserFresh('user-noop', 'pro', '2025-01-01T00:00:00Z');

    expect(posthog.identify).not.toHaveBeenCalled();
    expect(posthog.setPersonProperties).not.toHaveBeenCalled();
  });
});

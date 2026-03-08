// @vitest-environment happy-dom

/**
 * Tests for register page audit fix: QW2.
 *
 * QW2: Pro upgrade banner above form when ?plan=pro is in the URL.
 *      No banner when the param is absent.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../router.js', () => ({
  navigate: vi.fn(),
  initRouter: vi.fn(),
  updatePageMeta: vi.fn(),
  focusPageHeading: vi.fn(),
}));

// Mock authClient — renderRegisterPage calls authClient.getSession() first
vi.mock('../api/auth-client.js', () => ({
  authClient: {
    getSession: vi.fn().mockResolvedValue({ data: null }),
    signUp: {
      email: vi.fn(),
    },
    signIn: {
      social: vi.fn(),
    },
  },
}));

// Mock PostHog analytics
vi.mock('../analytics/posthog.js', () => ({
  captureUserRegistered: vi.fn(),
}));

let container: HTMLDivElement;
let originalLocation: Location;

beforeEach(() => {
  container = document.createElement('div');
  container.id = 'app';
  document.body.appendChild(container);
  originalLocation = window.location;
});

afterEach(() => {
  document.body.removeChild(container);
  vi.clearAllMocks();
  // Restore location
  Object.defineProperty(window, 'location', {
    value: originalLocation,
    writable: true,
  });
});

describe('QW2 — Pro banner conditional on ?plan=pro', () => {
  it('shows "Upgrading to Pro" banner when ?plan=pro is in the URL', async () => {
    Object.defineProperty(window, 'location', {
      value: {
        search: '?plan=pro',
        href: 'http://localhost/register?plan=pro',
        pathname: '/register',
      },
      writable: true,
    });

    const { renderRegisterPage } = await import('../pages/register.js');
    await renderRegisterPage(container);

    const allText = container.textContent ?? '';
    expect(allText).toContain('Upgrading to Pro');
  });

  it('shows "$5.42/mo" in the banner when ?plan=pro is in the URL', async () => {
    Object.defineProperty(window, 'location', {
      value: {
        search: '?plan=pro',
        href: 'http://localhost/register?plan=pro',
        pathname: '/register',
      },
      writable: true,
    });

    const { renderRegisterPage } = await import('../pages/register.js');
    await renderRegisterPage(container);

    const allText = container.textContent ?? '';
    expect(allText).toContain('$5.42/mo');
  });

  it('does NOT show the Pro banner when ?plan=pro is absent', async () => {
    Object.defineProperty(window, 'location', {
      value: { search: '', href: 'http://localhost/register', pathname: '/register' },
      writable: true,
    });

    const { renderRegisterPage } = await import('../pages/register.js');
    await renderRegisterPage(container);

    const allText = container.textContent ?? '';
    expect(allText).not.toContain('Upgrading to Pro');
  });
});

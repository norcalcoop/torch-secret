import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the auth client and navigation
vi.mock('../api/auth-client.js', () => ({
  authClient: {
    getSession: vi.fn().mockResolvedValue({ data: null, error: null }),
    signUp: {
      email: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
  },
}));
vi.mock('../router.js', () => ({ navigate: vi.fn() }));
vi.mock('../analytics/posthog.js', () => ({ captureUserRegistered: vi.fn() }));

import { renderRegisterPage } from './register.js';

describe('register page — marketing consent checkbox (ESEQ-04)', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('renders a checkbox with id="marketing-consent"', async () => {
    await renderRegisterPage(container);
    const checkbox = container.querySelector('#marketing-consent');
    expect(checkbox).not.toBeNull();
    expect(checkbox?.type).toBe('checkbox');
  });

  it('checkbox is unchecked by default', async () => {
    await renderRegisterPage(container);
    const checkbox = container.querySelector('#marketing-consent');
    expect(checkbox?.checked).toBe(false);
  });

  it('label text is "Send me product tips and updates"', async () => {
    await renderRegisterPage(container);
    const label = container.querySelector('label[for="marketing-consent"]');
    expect(label?.textContent).toBe('Send me product tips and updates');
  });
});

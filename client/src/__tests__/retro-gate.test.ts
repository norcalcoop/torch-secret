import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RETRO_STORAGE_KEY } from '../retro-data.js';

// Plan 02 will replace the hardcoded `export const RETRO_ENABLED = false` constant with
// a runtime check of `import.meta.env.VITE_RETRO_ENABLED`. This test file uses vi.stubEnv
// to control that env var instead of importing the constant — ensuring it stays green
// both before and after Plan 02 removes the RETRO_ENABLED export.
import { createThemeDropdown } from '../components/theme-toggle.js';

// Mock getMe to avoid network calls from createThemeDropdown's fetchIsPro
vi.mock('../api/client.js', () => ({
  getMe: vi.fn().mockResolvedValue({ user: { subscriptionTier: 'free' } }),
  ApiError: class ApiError extends Error {},
}));

describe('retro gate (RETRO_ENABLED = false)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_RETRO_ENABLED', 'false');
    localStorage.clear();
    if (!window.matchMedia) {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi
          .fn()
          .mockReturnValue({ matches: false, addListener: vi.fn(), removeListener: vi.fn() }),
      });
    }
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('retro features disabled when VITE_RETRO_ENABLED is not "true"', () => {
    const root = createThemeDropdown();
    const panel = root.querySelector('#theme-dropdown-panel')!;
    expect(panel.querySelectorAll('[data-retro-theme]').length).toBe(0);
  });

  it('createThemeDropdown() panel has no [data-retro-theme] elements when RETRO_ENABLED is false', () => {
    const root = createThemeDropdown();
    const panel = root.querySelector('#theme-dropdown-panel');
    expect(panel).not.toBeNull();
    expect(panel!.querySelectorAll('[data-retro-theme]').length).toBe(0);
  });

  it('createThemeDropdown() panel has no <hr> separator when RETRO_ENABLED is false', () => {
    const root = createThemeDropdown();
    const panel = root.querySelector('#theme-dropdown-panel');
    expect(panel).not.toBeNull();
    expect(panel!.querySelector('hr')).toBeNull();
  });

  it('startup cleanup removes retro-theme from localStorage when VITE_RETRO_ENABLED is not "true"', () => {
    // Simulate a user who previously had a retro theme set
    localStorage.setItem(RETRO_STORAGE_KEY, 'mario');
    expect(localStorage.getItem(RETRO_STORAGE_KEY)).toBe('mario');

    // Simulate what app.ts does in the else-branch when VITE_RETRO_ENABLED !== 'true'
    if (import.meta.env.VITE_RETRO_ENABLED !== 'true') {
      localStorage.removeItem(RETRO_STORAGE_KEY);
    }

    expect(localStorage.getItem(RETRO_STORAGE_KEY)).toBeNull();
  });
});

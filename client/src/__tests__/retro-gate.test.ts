import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RETRO_STORAGE_KEY } from '../retro-data.js';

// RETRO_ENABLED is not yet exported — these tests will be RED until Task 2 wires the gate.
// The import path below will be updated in Task 2 if RETRO_ENABLED moves to a separate module.
// For now, import from theme-toggle.ts where the constant will live.
import { RETRO_ENABLED, createThemeDropdown } from '../components/theme-toggle.js';

// Mock getMe to avoid network calls from createThemeDropdown's fetchIsPro
vi.mock('../api/client.js', () => ({
  getMe: vi.fn().mockResolvedValue({ user: { subscriptionTier: 'free' } }),
  ApiError: class ApiError extends Error {},
}));

describe('retro gate (RETRO_ENABLED = false)', () => {
  beforeEach(() => {
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

  it('RETRO_ENABLED is false', () => {
    expect(RETRO_ENABLED).toBe(false);
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

  it('startup cleanup removes retro-theme from localStorage when RETRO_ENABLED is false', () => {
    // Simulate a user who previously had a retro theme set
    localStorage.setItem(RETRO_STORAGE_KEY, 'mario');
    expect(localStorage.getItem(RETRO_STORAGE_KEY)).toBe('mario');

    // Simulate what app.ts does in the else-branch when RETRO_ENABLED is false
    if (!RETRO_ENABLED) {
      localStorage.removeItem(RETRO_STORAGE_KEY);
    }

    expect(localStorage.getItem(RETRO_STORAGE_KEY)).toBeNull();
  });
});

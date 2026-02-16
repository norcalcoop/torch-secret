/**
 * Theme manager: light/dark/system preference with localStorage persistence.
 *
 * Works alongside the inline FOWT prevention script in index.html to ensure
 * the correct theme is applied before the first paint. This module provides
 * the runtime API for reading, setting, and reacting to theme changes.
 *
 * Three modes:
 * - 'light'  — always light, stored in localStorage
 * - 'dark'   — always dark, stored in localStorage
 * - 'system' — follows OS preference, localStorage key removed
 */

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'theme';
const DARK_MQ = '(prefers-color-scheme: dark)';

/**
 * Read the persisted theme preference from localStorage.
 * Returns 'system' when no explicit preference is stored.
 */
export function getThemePreference(): ThemePreference {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return 'system';
}

/**
 * Persist a theme preference and apply it immediately.
 * 'system' removes the localStorage key so the FOWT script
 * falls through to the OS media query on next load.
 */
export function setThemePreference(pref: ThemePreference): void {
  if (pref === 'system') {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, pref);
  }
  applyTheme();
}

/**
 * Apply the current theme preference to the document.
 * Toggles the `.dark` class on `<html>` and sets the
 * `color-scheme` property for native form control theming.
 */
export function applyTheme(): void {
  const pref = getThemePreference();
  const isDark =
    pref === 'dark' ||
    (pref === 'system' && matchMedia(DARK_MQ).matches);

  document.documentElement.classList.toggle('dark', isDark);
  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
}

/**
 * Listen for OS-level theme changes and re-apply when in 'system' mode.
 * Call once at app startup. Safe to call multiple times (idempotent via
 * module-level guard).
 */
let listenerRegistered = false;

export function initThemeListener(): void {
  if (listenerRegistered) return;
  listenerRegistered = true;

  matchMedia(DARK_MQ).addEventListener('change', () => {
    if (getThemePreference() === 'system') {
      applyTheme();
    }
  });
}

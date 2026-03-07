/**
 * Retro theme engine.
 *
 * Provides get/set/apply/clear functions for the retro theme system.
 * Mirrors the API pattern from theme.ts (light/dark).
 *
 * Token mapping: retro theme fields → CSS custom properties on :root
 * (documentElement inline style overrides the :root values from styles.css).
 */

import { THEMES, RETRO_STORAGE_KEY, type RetroTheme } from './retro-data.js';
import { applyTheme } from './theme.js';
import { mountRetroEffects, unmountRetroEffects } from './retro-effects.js';
import { captureRetroThemeActivated } from './analytics/posthog.js';

// Module-level flag: have we loaded the Press Start 2P font yet?
let retroFontLoaded = false;

async function loadRetroFont(theme: RetroTheme): Promise<void> {
  if (theme.font.includes('Press Start 2P')) {
    if (!retroFontLoaded) {
      retroFontLoaded = true;
      // Vite emits this as an async CSS chunk; woff2 files are hashed and self-hosted
      await import('@fontsource/press-start-2p/index.css');
    }
  }
  // Apply font-family AFTER import resolves (or immediately for system fonts)
  document.documentElement.style.fontFamily = theme.font;
}

export function clearRetroFont(): void {
  document.documentElement.style.removeProperty('font-family');
}

/**
 * Read the currently persisted retro theme ID from localStorage.
 * Returns null when no retro theme is active.
 */
export function getRetroTheme(): string | null {
  return localStorage.getItem(RETRO_STORAGE_KEY);
}

/**
 * Persist a retro theme and apply it immediately.
 * Pass null to clear the retro theme and restore the light/dark base theme.
 *
 * Dispatches a 'retrothemechange' CustomEvent on window so other modules
 * (nav, effects, font loader) can react without tight coupling.
 */
export function setRetroTheme(id: string | null): void {
  if (id === null) {
    localStorage.removeItem(RETRO_STORAGE_KEY);
    clearRetroTheme();
  } else {
    localStorage.setItem(RETRO_STORAGE_KEY, id);
    applyRetroTheme(id);
  }
  window.dispatchEvent(new CustomEvent('retrothemechange', { detail: { themeId: id } }));
}

/**
 * Apply retro CSS custom properties for a given theme config.
 *
 * This function is stateless — it only writes inline CSS vars to documentElement.
 * It does NOT write localStorage (caller decides persistence).
 * The preview flag is reserved for caller semantics: pass true to signal hover-preview
 * intent (this function behaves identically either way — the distinction is for callers
 * that want to avoid calling setRetroTheme while still showing the preview).
 */
export function applyRetroColors(theme: RetroTheme, preview = false): void {
  // preview param is caller-semantic only — this function is always stateless
  void preview;

  const el = document.documentElement;

  // Core semantic color tokens
  el.style.setProperty('--ds-color-bg', theme.bg);
  el.style.setProperty('--ds-color-text-primary', theme.text);
  el.style.setProperty('--ds-color-text-secondary', theme.text);
  el.style.setProperty('--ds-color-text-tertiary', theme.text);
  el.style.setProperty('--ds-color-text-muted', theme.text);
  el.style.setProperty('--ds-color-accent', theme.primary);
  el.style.setProperty('--ds-color-accent-hover', theme.accent);
  el.style.setProperty('--ds-color-surface', theme.cardBg);
  el.style.setProperty('--ds-color-surface-raised', theme.navBg);

  // cardBorder may be "2px solid #hexcolor" — extract color portion
  const borderColor =
    theme.cardBorder.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)/)?.[0] ?? theme.cardBorder;
  el.style.setProperty('--ds-color-border', borderColor);

  // Retro-specific button tokens (used by [data-retro-theme] CSS selectors in styles.css)
  if (theme.btnBg) el.style.setProperty('--retro-btn-bg', theme.btnBg);
  if (theme.btnShadow) el.style.setProperty('--retro-btn-shadow', theme.btnShadow);
  if (theme.btnBorder) el.style.setProperty('--retro-btn-border', theme.btnBorder);
}

/**
 * Remove all retro CSS custom property overrides from documentElement.
 * Restores :root values from styles.css (light/dark theme tokens).
 */
export function clearRetroColors(): void {
  const el = document.documentElement;
  const PROPS = [
    '--ds-color-bg',
    '--ds-color-text-primary',
    '--ds-color-text-secondary',
    '--ds-color-text-tertiary',
    '--ds-color-text-muted',
    '--ds-color-accent',
    '--ds-color-accent-hover',
    '--ds-color-surface',
    '--ds-color-surface-raised',
    '--ds-color-border',
    '--retro-btn-bg',
    '--retro-btn-shadow',
    '--retro-btn-border',
  ];
  for (const prop of PROPS) el.style.removeProperty(prop);
}

/**
 * Apply a retro theme by ID: sets CSS vars, bgImg on body, data-retro-theme attribute,
 * mounts retro effects, lazy-loads the font, and fires analytics.
 */
export function applyRetroTheme(id: string): void {
  const theme = THEMES[id];
  if (!theme) return;

  // 1. Apply CSS color tokens
  applyRetroColors(theme);

  // 2. Apply background image on body (decorative gradient / pattern)
  if (theme.bgImg && theme.bgImg !== 'none') {
    document.body.style.backgroundImage = theme.bgImg;
    document.body.style.backgroundSize = 'cover';
  } else {
    document.body.style.removeProperty('background-image');
    document.body.style.removeProperty('background-size');
  }

  // 3. Mark element for CSS [data-retro-theme] selectors
  document.documentElement.setAttribute('data-retro-theme', id);

  // 4. Mount effects engine (unmounts any previous effects first)
  mountRetroEffects(id, theme);

  // 5. Lazy-load font and apply (fire-and-forget; colors are already correct)
  void loadRetroFont(theme);

  // 6. Fire analytics event — theme_id only, NO userId or secretId (ZK invariant)
  captureRetroThemeActivated(id);
}

/**
 * Clear the active retro theme completely:
 * - Unmounts all retro effects (cleanup timers/DOM nodes)
 * - Removes all CSS var overrides
 * - Restores default font
 * - Removes body background overrides
 * - Removes data-retro-theme attribute
 * - Re-applies the base light/dark theme
 */
export function clearRetroTheme(): void {
  // Unmount effects before removing DOM/CSS (prevents dangling references)
  unmountRetroEffects();

  clearRetroColors();
  clearRetroFont();
  document.body.style.removeProperty('background-image');
  document.body.style.removeProperty('background-size');
  document.documentElement.removeAttribute('data-retro-theme');

  // Re-apply light/dark theme after clearing retro overrides
  applyTheme();
}

/**
 * Listen for localStorage changes from other tabs and sync retro theme.
 * Call once at app startup. Safe to call multiple times (idempotent via
 * module-level guard).
 */
let listenerRegistered = false;

export function initRetroThemeListener(): void {
  if (listenerRegistered) return;
  listenerRegistered = true;

  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key === RETRO_STORAGE_KEY) {
      const newId = e.newValue;
      if (newId) applyRetroTheme(newId);
      else clearRetroTheme();
    }
  });
}

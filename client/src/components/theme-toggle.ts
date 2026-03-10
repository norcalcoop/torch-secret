/**
 * Theme dropdown panel component.
 *
 * Replaces the three-way cycle button with a dropdown showing:
 *   - Section 1: Base modes (Light / Dark / System)
 *   - Section 2: Retro Pro themes (21 themes from retro-data.ts)
 *
 * Interaction model:
 *   - Hover over a retro theme → 50ms debounced preview (no localStorage write)
 *   - Mouse-out → reverts to committed retro theme or clears colors
 *   - Click retro theme (Pro user) → commits theme, closes panel
 *   - Click retro theme (free user) → navigates to /pricing, closes panel
 *   - Escape / click-outside → closes panel
 *   - Arrow-key navigation across menu items
 *
 * Pro status is cached in a module-level variable and refreshed on
 * the 'retrothemechange' event to avoid repeated /api/me fetches.
 *
 * Retro theme modules (retro-data.js, retro-theme.js) are dynamically
 * imported inside a VITE_RETRO_ENABLED guard. When that env var is unset
 * (production default), Rollup dead-code-eliminates the entire import block
 * and all retro modules from the bundle.
 */

import { Sun, Moon, Monitor, Palette, Lock, type IconNode } from 'lucide';
import { createIcon, createPixelIcon } from './icons.js';
import { getThemePreference, setThemePreference, type ThemePreference } from '../theme.js';
import { navigate } from '../router.js';
import { getMe } from '../api/client.js';
import { ApiError } from '../api/client.js';

// ─── Module-level retro data cache ───────────────────────────────────────────

/**
 * Holds the THEMES object after the async retro-data import resolves.
 * Null when retro is disabled or not yet loaded.
 */
let loadedThemes: Record<string, { id: string; name: string; nav: Array<{ i: number[] }> }> | null =
  null;

/**
 * Retro theme module API — populated alongside loadedThemes when retro loads.
 * Null when retro is disabled.
 */
let retroApi: {
  getRetroTheme: () => string | null;
  setRetroTheme: (id: string | null) => void;
  applyRetroColors: (
    theme: { id: string; name: string; nav: Array<{ i: number[] }> },
    preview?: boolean,
  ) => void;
  clearRetroColors: () => void;
} | null = null;

// ─── Module-level Pro cache ────────────────────────────────────────────────

/** Cached Pro status: null = not yet fetched, true/false = known. */
let cachedIsPro: boolean | null = null;

async function fetchIsPro(): Promise<boolean> {
  if (cachedIsPro !== null) return cachedIsPro;
  try {
    const { user } = await getMe();
    cachedIsPro = user.subscriptionTier === 'pro';
    return cachedIsPro;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      cachedIsPro = false;
      return false;
    }
    // Network error — assume free to avoid unlocking
    cachedIsPro = false;
    return false;
  }
}

// Invalidate Pro cache when retro theme changes (e.g. after login/upgrade)
window.addEventListener('retrothemechange', () => {
  cachedIsPro = null;
});

// ─── Base-mode constants ──────────────────────────────────────────────────

const BASE_MODE_ICONS: Record<ThemePreference, IconNode> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

const BASE_MODE_LABELS: Record<ThemePreference, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

const BASE_MODES: ThemePreference[] = ['light', 'dark', 'system'];

// ─── Hover debounce ───────────────────────────────────────────────────────

let hoverTimer: ReturnType<typeof setTimeout> | null = null;

// ─── createThemeDropdown ─────────────────────────────────────────────────

/**
 * Create the theme dropdown component for the site header.
 *
 * Returns a container div wrapping the toggle button and the dropdown panel.
 * Call this once in createHeader(); it self-manages all event listeners.
 */
export function createThemeDropdown(): HTMLDivElement {
  // ── Root container ─────────────────────────────────────────────────────
  const root = document.createElement('div');
  root.id = 'theme-dropdown-root';
  root.className = 'relative';

  // ── Toggle button ──────────────────────────────────────────────────────
  const btn = document.createElement('button');
  btn.id = 'theme-dropdown-btn';
  btn.type = 'button';
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-haspopup', 'true');
  btn.setAttribute('aria-label', 'Change theme');
  btn.className =
    'p-2 rounded-lg text-text-secondary hover:text-text-primary ' +
    'hover:bg-surface-raised transition-colors cursor-pointer ' +
    'focus:ring-2 focus:ring-accent focus:outline-hidden';

  // ── Panel ─────────────────────────────────────────────────────────────
  const panel = document.createElement('div');
  panel.id = 'theme-dropdown-panel';
  panel.setAttribute('role', 'menu');
  panel.setAttribute('aria-label', 'Theme selector');
  panel.className =
    'hidden absolute top-full right-0 mt-1 z-50 ' +
    'bg-surface/90 backdrop-blur-md border border-border rounded-xl shadow-lg ' +
    'w-52 max-h-96 overflow-y-auto py-2';

  // ── Section 1: Base modes ──────────────────────────────────────────────
  const baseSectionLabel = document.createElement('p');
  baseSectionLabel.className =
    'px-3 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted';
  baseSectionLabel.setAttribute('aria-hidden', 'true');
  baseSectionLabel.textContent = 'Base Modes';
  panel.appendChild(baseSectionLabel);

  const baseGroup = document.createElement('div');
  baseGroup.setAttribute('role', 'group');
  baseGroup.setAttribute('aria-label', 'Base modes');
  panel.appendChild(baseGroup);

  for (const pref of BASE_MODES) {
    const item = document.createElement('button');
    item.type = 'button';
    item.setAttribute('role', 'menuitem');
    item.dataset['theme'] = pref;
    item.className =
      'w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-text-primary ' +
      'hover:bg-surface-raised transition-colors cursor-pointer';

    const modeIcon = createIcon(BASE_MODE_ICONS[pref], {
      size: 'sm',
      class: 'text-text-secondary',
    });
    item.appendChild(modeIcon);

    const label = document.createElement('span');
    label.textContent = BASE_MODE_LABELS[pref];
    item.appendChild(label);

    item.addEventListener('click', () => {
      setThemePreference(pref);
      // Clearing a base mode click should also clear any active retro theme
      // Only available if retro modules are loaded (VITE_RETRO_ENABLED is 'true')
      retroApi?.setRetroTheme(null);
      closePanel();
      renderToggleIcon();
    });

    baseGroup.appendChild(item);
  }

  if (import.meta.env.VITE_RETRO_ENABLED === 'true') {
    void (async () => {
      const { THEMES } = await import('../retro-data.js');
      const retro = await import('../retro-theme.js');
      const { getRetroTheme, setRetroTheme, applyRetroColors, clearRetroColors } = retro;
      loadedThemes = THEMES;
      retroApi = { getRetroTheme, setRetroTheme, applyRetroColors, clearRetroColors };

      // Separator
      const hr = document.createElement('hr');
      hr.setAttribute('aria-hidden', 'true');
      hr.className = 'border-border my-1.5';
      panel.appendChild(hr);

      // ── Section 2: Retro Pro themes ──────────────────────────────────────
      const retroSectionLabel = document.createElement('p');
      retroSectionLabel.className =
        'px-3 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted';
      retroSectionLabel.setAttribute('aria-hidden', 'true');
      retroSectionLabel.textContent = 'Retro Pro — upgrade to unlock';
      panel.appendChild(retroSectionLabel);

      const retroGroup = document.createElement('div');
      retroGroup.setAttribute('role', 'group');
      retroGroup.setAttribute('aria-label', 'Retro Pro themes');
      panel.appendChild(retroGroup);

      // Build one button per theme in THEMES
      for (const theme of Object.values(THEMES)) {
        const item = document.createElement('button');
        item.type = 'button';
        item.setAttribute('role', 'menuitem');
        item.dataset['retroTheme'] = theme.id;
        item.className =
          'w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-text-primary ' +
          'hover:bg-surface-raised transition-colors cursor-pointer';

        // Lock icon placeholder — shown when free user
        const lockWrapper = document.createElement('span');
        lockWrapper.className = 'lock-icon text-text-muted flex-shrink-0';
        lockWrapper.appendChild(createIcon(Lock, { size: 'sm' }));
        item.appendChild(lockWrapper);

        const nameSpan = document.createElement('span');
        nameSpan.className = 'flex-1 text-left truncate';
        nameSpan.textContent = theme.name;
        item.appendChild(nameSpan);

        // Hover preview with 50ms debounce on forward-apply; immediate revert on mouseleave
        item.addEventListener('mouseenter', () => {
          if (hoverTimer !== null) clearTimeout(hoverTimer);
          hoverTimer = setTimeout(() => {
            applyRetroColors(theme, true);
          }, 50);
        });

        item.addEventListener('mouseleave', () => {
          if (hoverTimer !== null) {
            clearTimeout(hoverTimer);
            hoverTimer = null;
          }
          // Revert immediately to committed state
          const committed = getRetroTheme();
          if (committed !== null && THEMES[committed]) {
            applyRetroColors(THEMES[committed]);
          } else {
            clearRetroColors();
          }
        });

        item.addEventListener('click', () => {
          void (async () => {
            const isPro = await fetchIsPro();
            if (isPro) {
              setRetroTheme(theme.id);
              closePanel();
              renderToggleIcon();
              updateRetroActiveStates();
            } else {
              closePanel();
              navigate('/pricing');
            }
          })();
        });

        retroGroup.appendChild(item);
      }

      updateRetroActiveStates();
    })();
  }

  // ── Assemble root ──────────────────────────────────────────────────────
  root.appendChild(btn);
  root.appendChild(panel);

  // ── Helpers ────────────────────────────────────────────────────────────

  function openPanel(): void {
    panel.classList.remove('hidden');
    btn.setAttribute('aria-expanded', 'true');

    // Refresh lock icon visibility and active state when opening
    void updateLockIcons();
    updateRetroActiveStates();
    updateBaseModeActiveStates();
  }

  function closePanel(): void {
    panel.classList.add('hidden');
    btn.setAttribute('aria-expanded', 'false');
    // Clear any in-flight hover timer
    if (hoverTimer !== null) {
      clearTimeout(hoverTimer);
      hoverTimer = null;
    }
    // Revert to committed state in case of interrupted hover
    // Only attempt if retro modules are loaded (loadedThemes is populated)
    if (retroApi !== null && loadedThemes !== null) {
      const committed = retroApi.getRetroTheme();
      if (committed !== null && loadedThemes[committed]) {
        retroApi.applyRetroColors(loadedThemes[committed]);
      } else {
        retroApi.clearRetroColors();
      }
    }
  }

  function isPanelOpen(): boolean {
    return !panel.classList.contains('hidden');
  }

  function renderToggleIcon(): void {
    btn.textContent = '';
    // Only attempt retro icon if retro modules are loaded
    if (retroApi !== null && loadedThemes !== null) {
      const retroId = retroApi.getRetroTheme();
      if (retroId !== null) {
        const theme = loadedThemes[retroId];
        // Show the theme's first nav pixel icon to indicate which retro theme is active
        if (theme?.nav[0]) {
          btn.appendChild(createPixelIcon(theme.nav[0].i, 16));
          return;
        }
        // Fallback if theme data is missing
        btn.appendChild(createIcon(Palette, { size: 'sm', class: 'text-text-secondary' }));
        return;
      }
    }
    const pref = getThemePreference();
    btn.appendChild(
      createIcon(BASE_MODE_ICONS[pref], { size: 'sm', class: 'text-text-secondary' }),
    );
  }

  async function updateLockIcons(): Promise<void> {
    const isPro = await fetchIsPro();
    const lockIcons = panel.querySelectorAll<HTMLElement>('.lock-icon');
    lockIcons.forEach((el) => {
      el.classList.toggle('hidden', isPro);
    });
  }

  function updateRetroActiveStates(): void {
    if (retroApi === null) return;
    const committed = retroApi.getRetroTheme();
    const items = panel.querySelectorAll<HTMLButtonElement>('[data-retro-theme]');
    items.forEach((item) => {
      const isActive = item.dataset['retroTheme'] === committed;
      // aria-pressed is not allowed on role="menuitem" — use data-active + CSS classes
      item.dataset['active'] = isActive ? 'true' : 'false';
      if (isActive) {
        item.classList.add('text-accent', 'font-medium');
      } else {
        item.classList.remove('text-accent', 'font-medium');
      }
    });
  }

  function updateBaseModeActiveStates(): void {
    const pref = getThemePreference();
    const items = baseGroup.querySelectorAll<HTMLButtonElement>('[data-theme]');
    items.forEach((item) => {
      const isActive =
        item.dataset['theme'] === pref && (retroApi?.getRetroTheme() ?? null) === null;
      // aria-pressed is not allowed on role="menuitem" — use data-active + CSS classes
      item.dataset['active'] = isActive ? 'true' : 'false';
      if (isActive) {
        item.classList.add('text-accent', 'font-medium');
      } else {
        item.classList.remove('text-accent', 'font-medium');
      }
    });
  }

  // ── Toggle button click ───────────────────────────────────────────────
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isPanelOpen()) {
      closePanel();
    } else {
      openPanel();
    }
  });

  // ── Close on Escape ───────────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isPanelOpen()) {
      closePanel();
      btn.focus();
    }
  });

  // ── Close on click outside ────────────────────────────────────────────
  document.addEventListener('click', (e) => {
    if (isPanelOpen() && !root.contains(e.target as Node)) {
      closePanel();
    }
  });

  // ── Arrow-key navigation ──────────────────────────────────────────────
  panel.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();

    const items = Array.from(panel.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
    const active = document.activeElement as HTMLElement;
    const idx = items.indexOf(active as HTMLButtonElement);

    if (e.key === 'ArrowDown') {
      const next = items[idx + 1] ?? items[0];
      next?.focus();
    } else {
      const prev = items[idx - 1] ?? items[items.length - 1];
      prev?.focus();
    }
  });

  // ── Sync on retrothemechange (cross-tab + commit) ─────────────────────
  window.addEventListener('retrothemechange', () => {
    renderToggleIcon();
    if (isPanelOpen()) {
      updateRetroActiveStates();
    }
  });

  // ── Initial render ────────────────────────────────────────────────────
  renderToggleIcon();

  return root;
}

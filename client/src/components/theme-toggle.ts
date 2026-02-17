/**
 * Three-way theme toggle button: light -> dark -> system.
 *
 * Displays the icon for the CURRENT theme state (Sun for light,
 * Moon for dark, Monitor for system). The aria-label describes
 * what the NEXT click will do, per UX convention.
 */

import { Sun, Moon, Monitor, type IconNode } from 'lucide';
import { createIcon } from './icons.js';
import { getThemePreference, setThemePreference, type ThemePreference } from '../theme.js';

/** Cycle order: light -> dark -> system -> light ... */
const CYCLE: ThemePreference[] = ['light', 'dark', 'system'];

/** Icon for each preference state. */
const ICONS: Record<ThemePreference, IconNode> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

/** Aria-label describes what the NEXT click does. */
const LABELS: Record<ThemePreference, string> = {
  light: 'Switch to dark mode',
  dark: 'Switch to system theme',
  system: 'Switch to light mode',
};

/**
 * Create a theme toggle button element.
 *
 * Cycles through light/dark/system on each click, updating the
 * icon and persisting the preference via the theme manager.
 */
export function createThemeToggle(): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className =
    'p-2 rounded-lg text-text-secondary hover:text-text-primary ' +
    'hover:bg-surface-raised transition-colors cursor-pointer ' +
    'focus:ring-2 focus:ring-accent focus:outline-hidden';

  function render(): void {
    const pref = getThemePreference();

    // Clear existing children
    btn.textContent = '';

    // Append the matching icon
    const icon = createIcon(ICONS[pref], {
      size: 'sm',
      class: 'text-text-secondary',
    });
    btn.appendChild(icon);

    // Accessible label describes next action
    btn.setAttribute('aria-label', LABELS[pref]);
  }

  btn.addEventListener('click', () => {
    const current = getThemePreference();
    const idx = CYCLE.indexOf(current);
    const next = CYCLE[(idx + 1) % CYCLE.length];
    setThemePreference(next);
    render();
  });

  // Initial render
  render();

  return btn;
}

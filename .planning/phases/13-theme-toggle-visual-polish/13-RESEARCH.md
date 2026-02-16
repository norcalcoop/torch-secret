# Phase 13: Theme Toggle + Visual Polish - Research

**Researched:** 2026-02-16
**Domain:** CSS theming (dark/light/system), Tailwind CSS 4.x custom variants, glassmorphism, micro-interactions, prefers-reduced-motion
**Confidence:** HIGH

## Summary

This phase adds a three-way theme toggle (dark/light/system), glassmorphism card surfaces, page transition animations, button micro-interactions, and a copy-button icon swap -- all with prefers-reduced-motion respect. The existing codebase already uses semantic OKLCH tokens in CSS custom properties (`--ds-color-*`) mapped to Tailwind via `@theme inline`, which is the ideal architecture for theme switching. The dark values in `:root` become the dark theme; a new `.dark`-absent selector provides light theme values.

Tailwind CSS 4.x supports overriding the `dark:` variant via `@custom-variant dark (&:where(.dark, .dark *))`, which activates class-based dark mode. The app already uses `backdrop-blur-md` in the header and has a `toast-in` keyframe animation, so the animation infrastructure is proven. Lucide provides `Sun`, `Moon`, and `Monitor` icons (all verified present in v0.564.0). The main complexity is the light theme color palette (choosing OKLCH values that match the dark palette's feel) and preventing flash-of-wrong-theme (FOWT) on page load via an inline `<script>` in `<head>`.

**Primary recommendation:** Use Tailwind's `@custom-variant dark` with a `.dark` class on `<html>`, store preference in `localStorage.theme`, apply the class via an inline blocking script in `<head>` before CSS loads, define light theme tokens via `:root` (default) and dark tokens via `.dark`, and wrap all new animations in `motion-safe:` variants.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tailwind CSS | 4.1.18 | Utility CSS with `@custom-variant dark`, `motion-safe:`, `backdrop-blur-*` | Already installed; native dark mode variant support |
| Lucide | 0.564.0 | Sun, Moon, Monitor icons for theme toggle | Already installed; icon utility module exists |
| localStorage API | Built-in | Persist theme preference across sessions | Zero dependencies, works offline, synchronous read in `<head>` |
| matchMedia API | Built-in | Detect system `prefers-color-scheme` preference | Required for "system" option in three-way toggle |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| CSS `color-scheme` property | Native | Tell browser to render form controls in correct theme | Set on `<html>` alongside `.dark` class toggle |
| CSS `@keyframes` | Native | Define fade-in-up, icon-swap animations | Used within Tailwind's `@theme` block for custom animations |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `.dark` class strategy | `data-theme="dark"` attribute | Either works; `.dark` class is the Tailwind docs canonical example and more widely tested |
| `localStorage` | Cookie-based persistence | Cookies are readable server-side (useful for SSR) but this is a client-rendered SPA -- localStorage is simpler and synchronous |
| CSS `light-dark()` function | Manual `:root` / `.dark` variable overrides | `light-dark()` has good support (since May 2024) but Tailwind's `dark:` variant approach is more idiomatic and the codebase already uses Tailwind utilities extensively |

**Installation:**
```bash
# No new packages needed -- all dependencies already installed
```

## Architecture Patterns

### Recommended File Structure
```
client/
├── index.html              # Inline <script> for FOWT prevention (MODIFIED)
├── src/
│   ├── styles.css           # @custom-variant dark, light/dark token sets, animations (MODIFIED)
│   ├── components/
│   │   ├── theme-toggle.ts  # NEW: Three-way toggle component
│   │   ├── layout.ts        # MODIFIED: Mount theme toggle in header
│   │   ├── copy-button.ts   # MODIFIED: Icon swap animation on copy success
│   │   └── toast.ts         # MODIFIED: motion-safe animation
│   ├── theme.ts             # NEW: Theme manager (read/write/apply/listen)
│   ├── app.ts               # MODIFIED: Initialize theme manager
│   └── pages/*.ts           # MODIFIED: Add glassmorphism classes, page enter animation
```

### Pattern 1: Theme Token Architecture (Two-Layer Variables)
**What:** `:root` holds light theme values as default; `.dark` selector overrides with dark values. The `@theme inline` block references `--ds-color-*` variables which automatically resolve to the correct theme.
**When to use:** Always -- this is the foundation of the entire theme system.
**Example:**
```css
/* Source: Tailwind CSS v4 dark mode docs + existing codebase pattern */
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

:root {
  color-scheme: light;

  /* Light theme values (NEW -- these become the default) */
  --ds-color-bg:              oklch(0.98 0.005 270);
  --ds-color-surface:         oklch(1.00 0 0);
  --ds-color-surface-raised:  oklch(0.97 0.005 270);
  --ds-color-surface-overlay: oklch(0.95 0.008 270);
  --ds-color-text-primary:    oklch(0.20 0.020 270);
  --ds-color-text-secondary:  oklch(0.35 0.025 270);
  --ds-color-text-tertiary:   oklch(0.50 0.030 270);
  --ds-color-text-muted:      oklch(0.55 0.025 270);
  --ds-color-accent:          oklch(0.55 0.200 255);
  --ds-color-accent-hover:    oklch(0.48 0.220 260);
  --ds-color-border:          oklch(0.88 0.010 270);
  /* ... etc */
}

.dark {
  color-scheme: dark;

  /* Dark theme values (MOVED from current :root) */
  --ds-color-bg:              oklch(0.23 0.038 283);
  --ds-color-surface:         oklch(0.27 0.055 282);
  /* ... all existing dark values ... */
}
```

### Pattern 2: FOWT Prevention (Blocking Inline Script)
**What:** A synchronous `<script>` in `<head>` that reads `localStorage.theme` and applies/removes `.dark` class BEFORE the browser paints.
**When to use:** Always -- must be the first script in `<head>`, before any CSS loads.
**Example:**
```html
<!-- Source: Tailwind CSS official dark mode docs -->
<head>
  <script>
    // Blocking script: runs before first paint to prevent FOWT
    (function() {
      var theme = localStorage.getItem('theme');
      var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      var isDark = theme === 'dark' || (!theme && prefersDark);
      document.documentElement.classList.toggle('dark', isDark);
    })();
  </script>
  <link rel="stylesheet" href="/src/styles.css" />
</head>
```

### Pattern 3: Three-Way Theme Manager Module
**What:** A singleton module that manages theme state (light/dark/system), persists to localStorage, listens for system preference changes, and dispatches events.
**When to use:** Imported by theme-toggle component and app.ts initialization.
**Example:**
```typescript
// Source: Standard pattern from Tailwind docs + community best practice
export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'theme';

export function getThemePreference(): ThemePreference {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return 'system';
}

export function setThemePreference(pref: ThemePreference): void {
  if (pref === 'system') {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, pref);
  }
  applyTheme();
}

export function applyTheme(): void {
  const pref = getThemePreference();
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = pref === 'dark' || (pref === 'system' && prefersDark);
  document.documentElement.classList.toggle('dark', isDark);
  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
}

export function initThemeListener(): void {
  // React to OS theme changes when preference is "system"
  window.matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => {
      if (getThemePreference() === 'system') {
        applyTheme();
      }
    });
}
```

### Pattern 4: Theme Toggle Component (Cyclic State)
**What:** A button in the header that cycles through light -> dark -> system on each click, showing the appropriate Lucide icon.
**When to use:** Mounted once in the layout header, between the brand mark and the nav link.
**Example:**
```typescript
// Source: Standard pattern, Lucide icons verified in v0.564.0
import { Sun, Moon, Monitor } from 'lucide';
import { createIcon } from './icons.js';
import { getThemePreference, setThemePreference, type ThemePreference } from '../theme.js';

const CYCLE: ThemePreference[] = ['light', 'dark', 'system'];
const ICONS = { light: Sun, dark: Moon, system: Monitor } as const;
const LABELS = { light: 'Light mode', dark: 'Dark mode', system: 'System theme' } as const;

export function createThemeToggle(): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = '...'; // styling classes
  button.setAttribute('aria-label', LABELS[getThemePreference()]);

  function render(): void {
    const pref = getThemePreference();
    button.setAttribute('aria-label', LABELS[pref]);
    // Clear existing icon, insert new one
    while (button.firstChild) button.removeChild(button.firstChild);
    button.appendChild(createIcon(ICONS[pref], { size: 'sm', class: 'text-text-secondary' }));
  }

  button.addEventListener('click', () => {
    const current = getThemePreference();
    const next = CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length];
    setThemePreference(next);
    render();
  });

  render();
  return button;
}
```

### Pattern 5: Page Enter Animation with motion-safe
**What:** Each page container gets a fade-in-up animation via a CSS class, gated behind `motion-safe:`.
**When to use:** Applied by the router after mounting new page content.
**Example:**
```css
/* In styles.css @theme block */
@theme {
  --animate-fade-in-up: fade-in-up 200ms ease-out;

  @keyframes fade-in-up {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
}
```
```typescript
// In router.ts after page render:
container.classList.add('motion-safe:animate-fade-in-up');
```

### Pattern 6: Glassmorphism Card Surfaces
**What:** Cards use translucent backgrounds with backdrop-blur for a frosted glass effect.
**When to use:** Primary content cards (URL card, form containers, trust cards).
**Example:**
```html
<!-- Dark theme: translucent dark surface -->
<!-- Light theme: translucent white surface -->
<div class="rounded-lg border border-border bg-surface/80 backdrop-blur-md shadow-lg">
  <!-- card content -->
</div>
```
Note: The `bg-surface` token resolves to different OKLCH values per theme, and the `/80` opacity modifier creates the translucency. The dot-grid background shows through, creating the glass effect.

### Pattern 7: Copy Button Icon Swap Animation
**What:** On successful copy, the Copy icon transitions to a Check icon with a brief scale animation, then reverts.
**When to use:** All copy buttons (standalone and terminal block header).
**Example:**
```typescript
import { Copy, Check } from 'lucide';
import { createIcon } from './icons.js';

// On copy success:
function animateIconSwap(button: HTMLButtonElement): void {
  const iconContainer = button.querySelector('svg');
  if (!iconContainer) return;

  // Replace with Check icon
  const checkIcon = createIcon(Check, { size: 'sm', class: 'text-white' });
  iconContainer.replaceWith(checkIcon);

  // Revert after 1.5 seconds
  setTimeout(() => {
    const originalIcon = createIcon(Copy, { size: 'sm', class: 'text-white' });
    checkIcon.replaceWith(originalIcon);
  }, 1500);
}
```

### Anti-Patterns to Avoid
- **Setting `dark:` classes on every element:** Use CSS custom properties for colors so `dark:` prefix is only needed for non-token values (opacity changes, specific overrides). The token system handles 95% of theme switching automatically.
- **Async theme initialization:** Never load theme preference asynchronously (e.g., from an API). The blocking `<script>` in `<head>` must be synchronous to prevent FOWT.
- **Hardcoding animation durations in JS:** Keep all animation timing in CSS (keyframes, transition durations). JS only adds/removes classes.
- **Using `transform` or `opacity` without `motion-safe:`:** Every visual animation must be gated behind `motion-safe:` or paired with a `motion-reduce:` override.
- **Re-rendering layout shell on theme change:** The theme toggle changes CSS custom properties via the `.dark` class. The layout shell never needs to re-render -- CSS handles it automatically.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| System theme detection | Custom `matchMedia` polling | `window.matchMedia('(prefers-color-scheme: dark)')` with `addEventListener('change', ...)` | Browser API handles this natively; change event fires on OS theme switch |
| Reduced motion detection | JS-based motion preference check | Tailwind's `motion-safe:` and `motion-reduce:` variants | CSS media query `prefers-reduced-motion` is already handled by Tailwind utilities |
| Theme toggle icons | Custom SVG sprites or icon font | Lucide `Sun`, `Moon`, `Monitor` via existing `createIcon()` utility | Already installed, consistent with rest of app |
| Backdrop blur effects | Custom CSS filter chains | Tailwind's `backdrop-blur-md` class | Already used in header, well-tested browser support |
| Color opacity for glassmorphism | Manual `rgba()` or `oklch(... / alpha)` | Tailwind's `/80` opacity modifier (e.g., `bg-surface/80`) | Works with CSS variable-based colors in Tailwind v4 |

**Key insight:** Because the codebase already uses semantic CSS custom property tokens (`--ds-color-*`) mapped to Tailwind utilities via `@theme inline`, theme switching is primarily a CSS-only concern. The only JS needed is: (1) reading/writing localStorage, (2) toggling `.dark` class on `<html>`, and (3) the toggle UI component itself.

## Common Pitfalls

### Pitfall 1: Flash of Wrong Theme (FOWT)
**What goes wrong:** Page loads with the wrong theme briefly before JS applies the correct one, causing a visible flash.
**Why it happens:** Theme detection script is loaded as a module or deferred script, so it runs after the first paint.
**How to avoid:** Place a synchronous inline `<script>` in `<head>` BEFORE the stylesheet `<link>`. It must read `localStorage.theme`, check `matchMedia`, and toggle `.dark` on `<html>` synchronously.
**Warning signs:** Any flash of white/dark on page load, especially when the user's preference differs from the default.

### Pitfall 2: Light Theme OKLCH Values Too Saturated or Wrong Contrast
**What goes wrong:** Light theme text is unreadable, accent colors look garish against white, or borders are invisible.
**Why it happens:** Simply inverting lightness values from the dark palette produces poor results. OKLCH lightness is perceptual but chroma must also be adjusted.
**How to avoid:** For light theme: backgrounds L=0.95-1.0 with near-zero chroma; text L=0.15-0.50 with low chroma; borders L=0.85-0.90; accents need LOWER lightness (L=0.45-0.55) to maintain contrast against light backgrounds.
**Warning signs:** WCAG contrast ratio failures (check with browser DevTools), colors looking "washed out" or "neon."

### Pitfall 3: Glassmorphism Looking Bad in Light Mode
**What goes wrong:** Backdrop-blur cards look muddy, borders disappear, or the glass effect is invisible against a light background.
**Why it happens:** Glassmorphism relies on contrast between the blurred background and the card surface. In light mode, white-on-white has no visible glass effect.
**How to avoid:** Light mode glassmorphism needs a slightly tinted (cool gray or blue-tinted) translucent surface with a visible border. The dot-grid background provides the texture that makes the blur visible.
**Warning signs:** Cards looking flat/identical to the background in light mode.

### Pitfall 4: Animations Not Respecting prefers-reduced-motion
**What goes wrong:** Users with motion sensitivity see jarring animations, causing discomfort or accessibility failures.
**Why it happens:** Animations added with JS class manipulation or inline styles bypass Tailwind's `motion-safe:` variants.
**How to avoid:** Every animation class must use `motion-safe:` prefix. For JS-driven animations (icon swap), check `window.matchMedia('(prefers-reduced-motion: reduce)').matches` before animating. The existing loading spinner already uses `motion-reduce:animate-none` as a reference pattern.
**Warning signs:** Any `animate-*`, `transition-*`, or `transform` class without a `motion-safe:` or `motion-reduce:` counterpart.

### Pitfall 5: System Theme Preference Not Updating Live
**What goes wrong:** User changes OS dark mode setting while app is open, but the app doesn't react.
**Why it happens:** Forgetting to listen for `change` events on the `matchMedia` query.
**How to avoid:** Register `matchMedia('(prefers-color-scheme: dark)').addEventListener('change', callback)` and re-apply theme when the preference is "system."
**Warning signs:** Theme only updates on page refresh when set to "system."

### Pitfall 6: Toast Animation Missing motion-safe Gate
**What goes wrong:** The existing `animate-[toast-in_200ms_ease-out]` on toast plays even when user prefers reduced motion.
**Why it happens:** The toast was written before motion-safe was a requirement. It uses a raw `animate-[...]` without a `motion-safe:` prefix.
**How to avoid:** Update toast class to `motion-safe:animate-[toast-in_200ms_ease-out]` and add `motion-reduce:animate-none` as a fallback. Same for the opacity transition on dismiss.
**Warning signs:** Toast slides in for users who have enabled "Reduce motion" in OS settings.

### Pitfall 7: Color Opacity Modifier Not Working With CSS Variables
**What goes wrong:** `bg-surface/80` produces no opacity -- the color is fully opaque.
**Why it happens:** In Tailwind CSS 4, the `/80` opacity modifier works with `@theme inline` variables but ONLY if the underlying CSS variable value is a color (not wrapped in another function). OKLCH values in `--ds-color-*` should work correctly since they are bare color values.
**How to avoid:** Verify that `bg-surface/80` outputs the correct CSS. The existing `bg-bg/80` in the header already works (confirmed in layout.ts), so this pattern is proven.
**Warning signs:** Glassmorphism cards appearing fully opaque despite `/80` modifier.

## Code Examples

Verified patterns from official sources and the existing codebase:

### CSS: Complete @custom-variant + Token Architecture
```css
/* Source: Tailwind CSS v4 dark mode docs + existing styles.css pattern */
@import "tailwindcss";
@import "@fontsource-variable/jetbrains-mono";

@custom-variant dark (&:where(.dark, .dark *));

/* =============================================
 * Light theme (default)
 * ============================================= */
:root {
  color-scheme: light;

  --ds-color-bg:              oklch(0.98 0.005 270);
  --ds-color-surface:         oklch(1.00 0 0);
  --ds-color-surface-raised:  oklch(0.97 0.005 270);
  --ds-color-surface-overlay: oklch(0.94 0.008 270);
  --ds-color-text-primary:    oklch(0.20 0.020 270);
  --ds-color-text-secondary:  oklch(0.35 0.025 270);
  --ds-color-text-tertiary:   oklch(0.50 0.030 270);
  --ds-color-text-muted:      oklch(0.55 0.025 270);
  --ds-color-accent:          oklch(0.55 0.200 255);
  --ds-color-accent-hover:    oklch(0.48 0.220 260);
  --ds-color-border:          oklch(0.88 0.010 270);
  --ds-color-danger:          oklch(0.55 0.220 25);
  --ds-color-success:         oklch(0.52 0.180 150);
  --ds-color-warning:         oklch(0.60 0.180 70);
  --ds-color-icon:            oklch(0.50 0.030 270);
  --ds-color-dot-grid:        oklch(0.70 0.010 270 / 0.12);
  --ds-color-terminal-bg:     oklch(0.97 0.005 160);
  --ds-color-terminal-text:   oklch(0.35 0.060 155);
  --ds-color-terminal-header: oklch(0.94 0.008 160);
}

/* =============================================
 * Dark theme
 * ============================================= */
.dark {
  color-scheme: dark;

  --ds-color-bg:              oklch(0.23 0.038 283);
  --ds-color-surface:         oklch(0.27 0.055 282);
  --ds-color-surface-raised:  oklch(0.30 0.057 282);
  --ds-color-surface-overlay: oklch(0.34 0.059 283);
  --ds-color-text-primary:    oklch(0.96 0.020 286);
  --ds-color-text-secondary:  oklch(0.84 0.033 286);
  --ds-color-text-tertiary:   oklch(0.67 0.047 285);
  --ds-color-text-muted:      oklch(0.65 0.053 285);
  --ds-color-accent:          oklch(0.71 0.143 255);
  --ds-color-accent-hover:    oklch(0.62 0.188 260);
  --ds-color-border:          oklch(0.36 0.058 283);
  --ds-color-danger:          oklch(0.64 0.208 25);
  --ds-color-success:         oklch(0.72 0.192 150);
  --ds-color-warning:         oklch(0.77 0.165 70);
  --ds-color-icon:            oklch(0.67 0.047 285);
  --ds-color-dot-grid:        oklch(0.36 0.058 283 / 0.15);
  --ds-color-terminal-bg:     oklch(0.20 0.020 160);
  --ds-color-terminal-text:   oklch(0.68 0.060 155);
  --ds-color-terminal-header: oklch(0.25 0.025 160);
}
```

### HTML: FOWT Prevention Inline Script
```html
<!-- Source: Tailwind CSS v4 official dark mode docs -->
<head>
  <meta charset="UTF-8" />
  <script>
    // Synchronous: executes before first paint
    (function() {
      var t = localStorage.getItem('theme');
      var d = t === 'dark' || (!t && matchMedia('(prefers-color-scheme:dark)').matches);
      document.documentElement.classList.toggle('dark', d);
      document.documentElement.style.colorScheme = d ? 'dark' : 'light';
    })();
  </script>
  <!-- CSS loads after theme class is set -->
  <link rel="stylesheet" href="/src/styles.css" />
</head>
```

### CSS: Custom Animations in @theme
```css
/* Source: Tailwind CSS v4 animation docs */
@theme {
  --animate-fade-in-up: fade-in-up 200ms ease-out;

  @keyframes fade-in-up {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
}
```
Used in markup as: `motion-safe:animate-fade-in-up`

### TypeScript: Checking Reduced Motion in JS
```typescript
// Source: Web API standard, MDN docs
function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Use before JS-driven animations (e.g., icon swap)
if (!prefersReducedMotion()) {
  // Animate icon swap with scale transition
} else {
  // Instant swap, no animation
}
```

### CSS: Glassmorphism Card Class Pattern
```html
<!-- Source: Tailwind CSS backdrop-blur docs + existing codebase pattern -->
<!-- The bg-surface token changes per theme, /80 adds translucency -->
<div class="rounded-lg border border-border bg-surface/80 backdrop-blur-md shadow-lg p-6">
  <!-- glass card content -->
</div>
```

### CSS: Button Hover Micro-Interactions
```html
<!-- Source: Tailwind CSS transition + transform utilities -->
<!-- motion-safe gates the transform; transition-colors already exists on buttons -->
<button class="... transition-all motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.98]">
  Create Secure Link
</button>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `darkMode: 'class'` in `tailwind.config.js` (v3) | `@custom-variant dark` in CSS (v4) | Tailwind CSS v4.0 (Jan 2025) | Config-free, CSS-native dark mode |
| `bg-opacity-*` utility classes (v3) | `bg-color/opacity` modifier syntax (v4) | Tailwind CSS v4.0 | Simpler syntax, works with CSS variables |
| `@apply` for custom animations | `@theme { --animate-*: ...; @keyframes { ... } }` (v4) | Tailwind CSS v4.0 | Custom animations via CSS theme block |
| Manual `@media (prefers-reduced-motion)` | `motion-safe:` / `motion-reduce:` variants | Tailwind CSS v3.1+ | Built-in utility variants |

**Deprecated/outdated:**
- `tailwind.config.js` `darkMode: 'class'` -- replaced by `@custom-variant dark` in v4
- `bg-opacity-*` standalone utilities -- replaced by `/N` modifier syntax
- `@variants` directive -- replaced by `@custom-variant` in v4

## Open Questions

1. **Light theme OKLCH values need visual tuning**
   - What we know: Dark theme values are established and tested. Light theme needs inverted lightness with adjusted chroma.
   - What's unclear: Exact OKLCH values that produce good contrast ratios and aesthetic coherence.
   - Recommendation: Start with the values in the code example above (based on standard OKLCH light palette patterns), then visually verify in browser. The planner should include a visual verification step for contrast ratios.

2. **Glassmorphism visibility on both themes**
   - What we know: `backdrop-blur-md` + `bg-surface/80` works well in dark mode (header already demonstrates this).
   - What's unclear: Whether the same opacity value (80%) works for both themes or if light mode needs a different opacity.
   - Recommendation: Use the same pattern for both; if light mode looks flat, adjust the surface opacity in light theme tokens (e.g., make light `--ds-color-surface` slightly tinted rather than pure white).

3. **Scope of glassmorphism application**
   - What we know: Requirements say "primary content areas (cards, panels)."
   - What's unclear: Exactly which elements should get glassmorphism vs staying opaque.
   - Recommendation: Apply to: URL card (confirmation page), form container (create page), trust cards, and the "How It Works" section cards. Keep terminal block opaque (it already has a distinct visual style). Keep error page cards opaque for clarity.

## Sources

### Primary (HIGH confidence)
- [Tailwind CSS v4 Dark Mode Docs](https://tailwindcss.com/docs/dark-mode) - `@custom-variant dark` syntax, three-way toggle JS, FOWT prevention
- [Tailwind CSS v4 Animation Docs](https://tailwindcss.com/docs/animation) - `@theme` keyframes, custom animation variables
- [Tailwind CSS v4 Backdrop Blur Docs](https://tailwindcss.com/docs/backdrop-filter-blur) - `backdrop-blur-*` utility classes and values
- [Tailwind CSS v4 Hover/State Docs](https://tailwindcss.com/docs/hover-focus-and-other-states) - `motion-safe:` and `motion-reduce:` variants
- Lucide icon verification: [Sun](https://lucide.dev/icons/sun), [Moon](https://lucide.dev/icons/moon), [Monitor](https://lucide.dev/icons/monitor) - confirmed in v0.564.0
- Existing codebase: `client/src/styles.css`, `client/src/components/layout.ts`, `client/src/components/icons.ts`

### Secondary (MEDIUM confidence)
- [Tailwind CSS GitHub Discussion #16925](https://github.com/tailwindlabs/tailwindcss/discussions/16925) - Community patterns for v4 dark/light toggle
- [Epic Web Dev: Glassmorphism with Tailwind](https://www.epicweb.dev/tips/creating-glassmorphism-effects-with-tailwind-css) - Glass effect recipe

### Tertiary (LOW confidence)
- Light theme OKLCH values: Derived from standard OKLCH color theory principles; not from a specific verified source. Values should be treated as starting points and visually validated.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed, Tailwind v4 dark mode docs verified directly
- Architecture: HIGH - Token system is already designed for theme switching (comments in styles.css reference Phase 13), patterns verified against official docs
- Pitfalls: HIGH - FOWT prevention pattern well-documented, motion-safe usage verified, existing codebase patterns confirm approach
- Light theme values: MEDIUM - Values are reasonable OKLCH estimates but need visual verification

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (stable domain, Tailwind v4 API is settled)

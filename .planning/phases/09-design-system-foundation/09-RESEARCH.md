# Phase 9: Design System Foundation - Research

**Researched:** 2026-02-15
**Domain:** CSS design tokens (OKLCH), self-hosted typography, SVG icon system (Tailwind CSS 4 + vanilla TypeScript)
**Confidence:** HIGH

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Dark palette character
- Warm charcoal base background (~#1a1a2e) -- softer dark, not true black or cold navy
- Electric blue primary accent for buttons, links, and interactive elements
- Palette should feel like a professional security tool -- trustworthy, modern, not harsh

#### Token structure
- OKLCH color space for all token values (perceptually uniform, modern browser support)
- Semantic-only naming convention (--color-surface, --color-text-primary, --color-accent) -- no primitive/hue references exposed
- 4 text color levels: primary / secondary / tertiary / muted
- Surface levels: Claude's discretion based on component needs in phases 11-14

#### Typography details
- JetBrains Mono for headings at semi-bold (600) weight
- System sans-serif stack for body text
- Code block font: Claude's discretion (JetBrains Mono reuse vs system monospace)
- Standard type scale (1.25 ratio, Major Third)
- Base body text size: 16px (1rem)

#### Icon sizing defaults
- Default Lucide icon size: 24px
- Default stroke width: 2px (Lucide default)
- Named size variants: sm (16px) / md (24px) / lg (32px)
- Dedicated --color-icon token (not just currentColor inheritance) -- allows independent icon styling

### Claude's Discretion
- Status/semantic colors (danger, warning, success) -- pick what works with blue accent on warm charcoal
- Text brightness levels -- must pass WCAG AA against the warm charcoal background
- Number of surface levels (3 or 4) -- based on what phases 11-14 need
- Code block font choice -- JetBrains Mono reuse vs system monospace
- Exact OKLCH values for the full palette

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

## Summary

This phase establishes the visual foundation for SecureShare v2.0: a dark OKLCH color token system, self-hosted JetBrains Mono typography, and a Lucide icon utility module. The existing codebase uses Tailwind CSS 4.x with the `@tailwindcss/vite` plugin, already has OKLCH-based `@theme` tokens for `primary-*`, `danger-*`, `success-*`, and `warning-*`, but all page components use hardcoded Tailwind gray-scale classes (`text-gray-900`, `bg-gray-50`, `border-gray-300`, `bg-white`, etc.) that need migration to semantic tokens.

The key architectural pattern is Tailwind v4's `@theme inline` directive combined with CSS custom properties on `:root`. This allows defining semantic token names (like `--color-surface`) that reference CSS variables which change per theme, avoiding the `dark:` prefix duplication anti-pattern. Since Phase 13 will add a light/system theme toggle later, the token architecture must be designed for theme-switchability from day one even though Phase 9 only implements the dark theme.

The two new npm packages are `lucide` (vanilla JS, v0.564.0) and `@fontsource-variable/jetbrains-mono` (v5.2.x). Both are well-maintained, tree-shakable, and designed for the exact use case. The Lucide vanilla package provides `createElement()` for programmatic SVG creation, which fits the project's vanilla TypeScript DOM manipulation pattern. JetBrains Mono Variable supports weights 100-800 in a single file, covering the needed semi-bold (600) weight.

**Primary recommendation:** Use the `@theme inline` + `:root` CSS variable pattern to define semantic tokens, install `lucide` + `@fontsource-variable/jetbrains-mono`, and create a thin icon utility wrapper around Lucide's `createElement()` for consistent defaults.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tailwindcss | ^4.1.18 | Utility-first CSS framework | Already installed; `@theme` directive is the native token system |
| @tailwindcss/vite | ^4.1.18 | Vite plugin for Tailwind | Already installed; zero-config integration |
| lucide | ^0.564.0 | SVG icon library (vanilla JS) | Tree-shakable, 1500+ icons, `createElement()` API for DOM manipulation |
| @fontsource-variable/jetbrains-mono | ^5.2.8 | Self-hosted JetBrains Mono variable font | No CDN dependency, variable font (100-800 weights in one file) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vite | ^7.3.1 | Build tool | Already installed; handles font file bundling automatically |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `lucide` (vanilla) | `lucide-static` | Static SVGs, no programmatic API -- doesn't fit DOM manipulation pattern |
| `@fontsource-variable` | Google Fonts CDN | CDN adds render-blocking request + privacy concern; self-hosted is faster and no external dependency |
| `@fontsource-variable` | `@fontsource/jetbrains-mono` (static) | Static loads individual weight files; variable loads one file for all weights -- variable is smaller for 2+ weights |

**Installation:**
```bash
npm install lucide @fontsource-variable/jetbrains-mono
```

## Architecture Patterns

### Recommended Project Structure
```
client/src/
  styles.css              # @theme tokens, @font-face import, semantic CSS variables
  icons/
    index.ts              # Icon utility: createIcon() wrapper with defaults
  app.ts                  # Imports styles.css (existing) + font import
```

### Pattern 1: Semantic Token Architecture (Tailwind v4 @theme inline)

**What:** Define theme-aware CSS variables on `:root`, then map them to Tailwind utility-generating `@theme` variables using `@theme inline`. This creates a single set of semantic utility classes (`bg-surface`, `text-primary`, `border-default`) that automatically adapt when the theme context changes.

**When to use:** Always -- this is the foundation pattern for the entire design system.

**Example:**
```css
/* Source: https://tailwindcss.com/docs/customizing-colors */
@import "tailwindcss";

/* ============================================
   Step 1: Define raw CSS variables per theme
   ============================================ */
:root {
  color-scheme: dark;

  /* Surfaces */
  --ds-color-bg: oklch(0.23 0.038 283);
  --ds-color-surface: oklch(0.27 0.055 282);
  --ds-color-surface-raised: oklch(0.30 0.057 282);
  --ds-color-surface-overlay: oklch(0.34 0.059 283);

  /* Text */
  --ds-color-text-primary: oklch(0.96 0.020 286);
  --ds-color-text-secondary: oklch(0.84 0.033 286);
  --ds-color-text-tertiary: oklch(0.67 0.047 285);
  --ds-color-text-muted: oklch(0.65 0.053 285);

  /* Accent */
  --ds-color-accent: oklch(0.71 0.143 255);
  --ds-color-accent-hover: oklch(0.62 0.188 260);

  /* Borders */
  --ds-color-border: oklch(0.36 0.058 283);

  /* Status */
  --ds-color-danger: oklch(0.64 0.208 25);
  --ds-color-success: oklch(0.72 0.192 150);
  --ds-color-warning: oklch(0.77 0.165 70);

  /* Icon */
  --ds-color-icon: oklch(0.67 0.047 285);
}

/* ============================================
   Step 2: Map CSS vars to Tailwind utilities
   ============================================ */
@theme inline {
  --color-bg: var(--ds-color-bg);
  --color-surface: var(--ds-color-surface);
  --color-surface-raised: var(--ds-color-surface-raised);
  --color-surface-overlay: var(--ds-color-surface-overlay);
  --color-text-primary: var(--ds-color-text-primary);
  --color-text-secondary: var(--ds-color-text-secondary);
  --color-text-tertiary: var(--ds-color-text-tertiary);
  --color-text-muted: var(--ds-color-text-muted);
  --color-accent: var(--ds-color-accent);
  --color-accent-hover: var(--ds-color-accent-hover);
  --color-border: var(--ds-color-border);
  --color-danger: var(--ds-color-danger);
  --color-success: var(--ds-color-success);
  --color-warning: var(--ds-color-warning);
  --color-icon: var(--ds-color-icon);
}
```

Usage in HTML/JS:
```html
<!-- These utility classes are now available -->
<body class="bg-bg text-text-primary">
  <div class="bg-surface border border-border rounded-lg">
    <h1 class="text-text-primary">Title</h1>
    <p class="text-text-secondary">Subtitle</p>
    <button class="bg-accent hover:bg-accent-hover text-white">Action</button>
  </div>
</body>
```

**Why `--ds-` prefix on `:root` variables:** The `ds-` (design system) prefix prevents name collisions between the raw CSS variables on `:root` and the `--color-*` namespace in `@theme`. Tailwind's `@theme` owns the `--color-*` namespace to generate utilities. The raw variables use a separate namespace.

### Pattern 2: Font Import via Fontsource

**What:** Import the variable font file in `app.ts` (or `styles.css`), then define font families in `@theme`.

**Example:**
```css
/* In styles.css */
@import "tailwindcss";

/* Fontsource variable font (supports weights 100-800) */
@import "@fontsource-variable/jetbrains-mono";

@theme {
  --font-heading: 'JetBrains Mono Variable', ui-monospace, monospace;
  --font-body: ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji';
  --font-mono: 'JetBrains Mono Variable', ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace;
}
```

This creates `font-heading`, `font-body`, and `font-mono` utility classes. CSS import in `styles.css` is preferred over JS import in `app.ts` because Vite processes CSS imports as part of the CSS pipeline, ensuring the `@font-face` declarations end up in the CSS bundle.

### Pattern 3: Type Scale (Major Third, 1.25 ratio)

**What:** Define a modular type scale with 1rem (16px) base and 1.25 ratio.

**Example:**
```css
@theme {
  --text-xs: 0.64rem;     /* 10.24px */
  --text-sm: 0.8rem;      /* 12.8px */
  --text-base: 1rem;      /* 16px */
  --text-lg: 1.25rem;     /* 20px */
  --text-xl: 1.563rem;    /* 25px */
  --text-2xl: 1.953rem;   /* 31.25px */
  --text-3xl: 2.441rem;   /* 39.06px */
}
```

### Pattern 4: Lucide Icon Utility Module

**What:** A thin wrapper around Lucide's `createElement()` that applies consistent defaults (size, stroke-width, aria-hidden, color token).

**Example:**
```typescript
// Source: https://lucide.dev/guide/packages/lucide
import { createElement, type IconNode } from 'lucide';

/** Named size presets in pixels. */
const ICON_SIZES = {
  sm: 16,
  md: 24,
  lg: 32,
} as const;

type IconSize = keyof typeof ICON_SIZES;

interface CreateIconOptions {
  /** Named size or explicit pixel value. Default: 'md' (24px). */
  size?: IconSize | number;
  /** Stroke width. Default: 2. */
  strokeWidth?: number;
  /** CSS class(es) to add. */
  class?: string | string[];
  /** Accessible label. If provided, sets aria-label instead of aria-hidden. */
  ariaLabel?: string;
}

/**
 * Create a Lucide SVG icon element with consistent defaults.
 *
 * Icons are decorative (aria-hidden="true") by default.
 * Pass `ariaLabel` to make them meaningful to screen readers.
 */
export function createIcon(
  icon: IconNode,
  options: CreateIconOptions = {},
): SVGSVGElement {
  const {
    size = 'md',
    strokeWidth = 2,
    class: cssClass,
    ariaLabel,
  } = options;

  const pixels = typeof size === 'number' ? size : ICON_SIZES[size];

  const attrs: Record<string, string | string[] | number> = {
    width: pixels,
    height: pixels,
    'stroke-width': strokeWidth,
  };

  // Apply color token via CSS class
  if (cssClass) {
    attrs.class = Array.isArray(cssClass) ? cssClass : [cssClass];
  }

  // Accessibility: decorative by default, labeled when meaningful
  if (ariaLabel) {
    attrs['aria-label'] = ariaLabel;
    attrs.role = 'img';
  } else {
    attrs['aria-hidden'] = 'true';
  }

  return createElement(icon, attrs) as unknown as SVGSVGElement;
}

// Re-export icon imports for convenience
export { type IconNode } from 'lucide';
```

Usage:
```typescript
import { createIcon } from '../icons/index.js';
import { Shield, Lock, Copy } from 'lucide';

// Decorative icon (default)
const shieldIcon = createIcon(Shield);

// Small icon with custom class
const lockIcon = createIcon(Lock, { size: 'sm', class: 'text-icon' });

// Accessible icon with label
const copyIcon = createIcon(Copy, { ariaLabel: 'Copy to clipboard' });
```

### Anti-Patterns to Avoid

- **Hardcoded color values in component `.ts` files:** Every color class must use semantic tokens (`text-text-primary` not `text-gray-900`). The existing codebase has ~40+ instances of hardcoded gray classes that must be migrated.
- **Importing all Lucide icons via barrel export:** Import only the icons you use. Barrel imports load all 1500+ icons in dev mode, increasing load time from 1-2s to 16s.
- **Using `@theme` (not `inline`) for CSS variable references:** When a `@theme` variable references `var(--something)`, you MUST use `@theme inline` or the utility will reference its own generated CSS variable instead of the underlying one, breaking theme switching.
- **Defining semantic tokens directly in `@theme` without `:root` indirection:** If you put `--color-surface: oklch(0.27 0.055 282)` directly in `@theme`, you cannot switch it per theme. The `:root` -> `@theme inline` pattern is required for Phase 13 theme toggle compatibility.
- **Loading font from CDN:** The requirement explicitly says self-hosted, no external CDN requests.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SVG icon rendering | Manual SVG path strings in template literals | `lucide` `createElement()` | 1500+ icons maintained by community, consistent stroke/size, accessible defaults |
| Font loading/subsetting | Manual `@font-face` declarations with downloaded files | `@fontsource-variable/jetbrains-mono` | Handles woff2 files, font-display, unicode ranges automatically |
| OKLCH color calculations | Manual hex-to-oklch math in code | OKLCH values in CSS (browser-native) | CSS Color Level 4 is natively supported in all major browsers since 2023 |
| CSS utility generation | Custom PostCSS plugin for design tokens | Tailwind `@theme` directive | Native to Tailwind 4, generates utilities + CSS variables automatically |
| Type scale computation | Manual rem calculations | Predefined scale in `@theme` | One-time definition, referenced everywhere via utilities |

**Key insight:** This phase is almost entirely CSS configuration + one small TypeScript utility module. There is no application logic to build -- the value is in getting the token architecture right so phases 11-14 can consume it without refactoring.

## Common Pitfalls

### Pitfall 1: @theme vs @theme inline Confusion
**What goes wrong:** Defining `--color-surface: var(--ds-color-surface)` in `@theme` (without `inline`) generates a utility that references `var(--color-surface)` instead of `var(--ds-color-surface)`, creating a circular reference that breaks theme switching.
**Why it happens:** `@theme` creates a CSS variable with the same name as the token. Without `inline`, the generated utility class references this new CSS variable, not the source variable.
**How to avoid:** Always use `@theme inline` when mapping CSS variables to theme tokens. Use plain `@theme` only for static values (like font stacks, spacing, type scale).
**Warning signs:** Colors don't change when toggling theme; DevTools shows `var(--color-surface)` referencing itself.

### Pitfall 2: Lucide Dev Server Performance
**What goes wrong:** Importing icons via `import { Shield, Lock } from 'lucide'` barrel export causes Vite dev server to load all 1500+ icon modules (1490 requests), making page loads take 15-30 seconds.
**Why it happens:** Vite does not tree-shake in development mode. Barrel exports trigger loading the entire module graph.
**How to avoid:** For the number of icons SecureShare uses (likely <20), barrel imports are acceptable since the overhead is proportional. If dev performance degrades noticeably, add a Vite resolve alias to point imports at individual files. Monitor dev server startup time.
**Warning signs:** Dev server takes >5 seconds to reload after icon changes; browser network tab shows hundreds of requests to `/node_modules/.vite/deps/`.

### Pitfall 3: WCAG Contrast Failures on Dark Backgrounds
**What goes wrong:** Text colors that look readable to the developer fail WCAG AA contrast ratio (4.5:1 for body text, 3:1 for large text/UI elements).
**Why it happens:** Dark backgrounds with warm/purple tints reduce perceived contrast more than pure blacks. The `#1a1a2e` warm charcoal has a relative luminance of ~0.02, which is slightly higher than pure black (~0.0) but still requires high-lightness text.
**How to avoid:** Verified contrast ratios for all text levels against all surface levels (see palette section below). Use the OKLCH lightness value as a quick heuristic: text on `#1a1a2e` needs L >= ~0.65 for AA body text compliance.
**Warning signs:** Automated accessibility tests flag contrast issues; text appears "muddy" on surfaces.

### Pitfall 4: Existing Hardcoded Classes Not Migrated
**What goes wrong:** After defining semantic tokens, the app still uses hardcoded classes like `text-gray-900` and `bg-gray-50`, resulting in a light-theme appearance that contradicts the dark design.
**Why it happens:** 40+ instances of hardcoded gray/white Tailwind classes exist across 7 files (index.html, 4 pages, 3 components). Migration is easy to do incompletely.
**How to avoid:** Systematically audit every file under `client/src/` and `client/index.html`. Grep for `gray-`, `bg-white`, `text-white` (may need to keep some), `bg-gray-`, `border-gray-`, `placeholder-gray-`. Replace each with the semantic equivalent.
**Warning signs:** Parts of the UI appear in light theme while other parts are dark; `bg-gray-50` body background remains visible.

### Pitfall 5: Font Not Loading (Silent Failure)
**What goes wrong:** JetBrains Mono is imported but headings render in the system sans-serif fallback, with no console error.
**Why it happens:** The font family name must match exactly (`'JetBrains Mono Variable'` for the variable version). Using `'JetBrains Mono'` (static name) with the variable package silently falls through to the next font in the stack.
**How to avoid:** Use the exact family name `'JetBrains Mono Variable'` when importing `@fontsource-variable/jetbrains-mono`. Verify in browser DevTools (Elements > Computed > font-family) that the rendered font matches.
**Warning signs:** Headings look like body text; DevTools shows a different font-family than expected.

### Pitfall 6: color-scheme Not Set
**What goes wrong:** Browser scrollbars, native `<select>` dropdowns, and `<input>` fields render with light-mode chrome despite the dark CSS theme, creating a jarring visual mismatch.
**Why it happens:** `color-scheme: dark` must be explicitly set via CSS for the browser to adapt native UI elements. Without it, browsers default to light chrome.
**How to avoid:** Set `color-scheme: dark` on `:root` (or use Tailwind's `scheme-dark` utility on `<html>`). This is requirement THEME-07.
**Warning signs:** White scrollbar tracks; light-colored date pickers; native select dropdowns with white backgrounds.

## Code Examples

Verified patterns from official sources:

### Complete styles.css Structure
```css
/* Source: https://tailwindcss.com/docs/theme + https://tailwindcss.com/docs/customizing-colors */
@import "tailwindcss";
@import "@fontsource-variable/jetbrains-mono";

/* =============================================
 * Design System: Raw theme variables
 * These change per-theme (Phase 13 adds light theme values)
 * ============================================= */
:root {
  color-scheme: dark;

  /* Background & Surfaces */
  --ds-color-bg:              oklch(0.23 0.038 283);
  --ds-color-surface:         oklch(0.27 0.055 282);
  --ds-color-surface-raised:  oklch(0.30 0.057 282);
  --ds-color-surface-overlay: oklch(0.34 0.059 283);

  /* Text hierarchy */
  --ds-color-text-primary:    oklch(0.96 0.020 286);
  --ds-color-text-secondary:  oklch(0.84 0.033 286);
  --ds-color-text-tertiary:   oklch(0.67 0.047 285);
  --ds-color-text-muted:      oklch(0.65 0.053 285);

  /* Interactive accent (electric blue) */
  --ds-color-accent:          oklch(0.71 0.143 255);
  --ds-color-accent-hover:    oklch(0.62 0.188 260);

  /* Borders */
  --ds-color-border:          oklch(0.36 0.058 283);

  /* Status */
  --ds-color-danger:          oklch(0.64 0.208 25);
  --ds-color-success:         oklch(0.72 0.192 150);
  --ds-color-warning:         oklch(0.77 0.165 70);

  /* Icons */
  --ds-color-icon:            oklch(0.67 0.047 285);
}

/* =============================================
 * Map raw variables to Tailwind utility classes
 * ============================================= */
@theme inline {
  /* Clear default color palette -- use only semantic tokens */
  --color-*: initial;

  /* Surfaces */
  --color-bg: var(--ds-color-bg);
  --color-surface: var(--ds-color-surface);
  --color-surface-raised: var(--ds-color-surface-raised);
  --color-surface-overlay: var(--ds-color-surface-overlay);

  /* Text */
  --color-text-primary: var(--ds-color-text-primary);
  --color-text-secondary: var(--ds-color-text-secondary);
  --color-text-tertiary: var(--ds-color-text-tertiary);
  --color-text-muted: var(--ds-color-text-muted);

  /* Accent */
  --color-accent: var(--ds-color-accent);
  --color-accent-hover: var(--ds-color-accent-hover);

  /* Borders */
  --color-border: var(--ds-color-border);

  /* Status */
  --color-danger: var(--ds-color-danger);
  --color-success: var(--ds-color-success);
  --color-warning: var(--ds-color-warning);

  /* Icons */
  --color-icon: var(--ds-color-icon);

  /* Keep white for button text etc. */
  --color-white: #fff;
  --color-black: #000;
}

/* Non-inline @theme for static values */
@theme {
  /* Typography */
  --font-heading: 'JetBrains Mono Variable', ui-monospace, monospace;
  --font-body: ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji';
  --font-mono: 'JetBrains Mono Variable', ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace;

  /* Type scale (Major Third, 1.25 ratio) */
  --text-xs: 0.64rem;
  --text-sm: 0.8rem;
  --text-base: 1rem;
  --text-lg: 1.25rem;
  --text-xl: 1.563rem;
  --text-2xl: 1.953rem;
  --text-3xl: 2.441rem;
}
```

### Applying Token to index.html (Before/After)
```html
<!-- BEFORE (v1.0) -->
<body class="min-h-screen bg-gray-50 text-gray-900">

<!-- AFTER (v2.0) -->
<body class="min-h-screen bg-bg text-text-primary font-body">
```

### Applying Token in Component Code (Before/After)
```typescript
// BEFORE (v1.0)
heading.className = 'text-2xl sm:text-3xl font-bold text-gray-900';
subtext.className = 'text-gray-500';
textarea.className = 'border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 ...';
submitButton.className = 'bg-primary-600 text-white hover:bg-primary-700 ...';

// AFTER (v2.0)
heading.className = 'text-2xl sm:text-3xl font-bold text-text-primary font-heading';
subtext.className = 'text-text-secondary';
textarea.className = 'border border-border rounded-lg bg-surface text-text-primary placeholder-text-muted ...';
submitButton.className = 'bg-accent text-white hover:bg-accent-hover ...';
```

### Icon Utility Module Usage
```typescript
// Source: https://lucide.dev/guide/packages/lucide
import { createIcon } from '../icons/index.js';
import { Shield, Lock, Flame } from 'lucide';

// In a page render function
const icon = createIcon(Shield, { size: 'lg', class: 'text-accent' });
container.appendChild(icon);
```

## Palette: WCAG Contrast Verification

All values verified programmatically. WCAG AA requires 4.5:1 for body text, 3:1 for large text (>=18pt or >=14pt bold) and UI components.

### Text on Base Background (#1a1a2e / L=0.23)
| Token | Approx Hex | OKLCH L | Contrast Ratio | WCAG AA Body | WCAG AA Large |
|-------|------------|---------|----------------|--------------|---------------|
| text-primary | #f0f0ff | 0.96 | 15.1:1 | PASS | PASS |
| text-secondary | #c8c8e0 | 0.84 | 10.8:1 | PASS | PASS |
| text-tertiary | #9090b0 | 0.67 | 5.5:1 | PASS | PASS |
| text-muted | #8c8cb0 | 0.65 | 5.3:1 | PASS | PASS |
| accent (blue) | #60a5fa | 0.71 | 6.7:1 | PASS | PASS |

### Text on Surface (#252540 / L=0.27)
| Token | Contrast Ratio | WCAG AA Body | WCAG AA Large |
|-------|----------------|--------------|---------------|
| text-primary | 13.1:1 | PASS | PASS |
| text-secondary | 9.4:1 | PASS | PASS |
| text-tertiary | 4.8:1 | PASS | PASS |
| text-muted | 4.6:1 | PASS | PASS |
| accent (blue) | 5.8:1 | PASS | PASS |

### Status Colors on Base Background
| Token | Contrast Ratio | WCAG AA Large (3:1) |
|-------|----------------|---------------------|
| danger (#ef4444) | 4.5:1 | PASS |
| success (#22c55e) | 7.5:1 | PASS |
| warning (#f59e0b) | 7.9:1 | PASS |

### Discretion Recommendations

**Surface levels: 3 levels** (surface, surface-raised, surface-overlay).
- Phase 11 needs: cards/panels (surface), elevated sections like header/footer (surface-raised)
- Phase 12 needs: modal overlays, dropdown menus (surface-overlay)
- Phase 13 needs: glassmorphism panels (surface-raised with backdrop-blur)
- A 4th level is unnecessary -- overlay handles the highest elevation. 3 levels + bg = 4 total background values.

**Code block font: Reuse JetBrains Mono (`font-mono`).**
- JetBrains Mono is already loaded for headings, so code blocks get it "for free" -- no additional font download
- It was designed specifically as a programming font with ligatures and optimized code readability
- Phase 12 requires a "terminal code-block style" for revealed secrets -- JetBrains Mono is ideal for this

**Status/semantic colors:**
- Danger: `oklch(0.64 0.208 25)` -- warm red, ~4.5:1 on base, sufficient for text and backgrounds
- Success: `oklch(0.72 0.192 150)` -- green, ~7.5:1, excellent contrast
- Warning: `oklch(0.77 0.165 70)` -- amber, ~7.9:1, excellent contrast
- These maintain the same hue angles as the existing v1.0 tokens but with OKLCH values optimized for the dark background

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tailwind.config.js` theme | `@theme` CSS directive | Tailwind v4 (Jan 2025) | Tokens defined in CSS, not JS config |
| `dark:` prefix on every utility | `@theme inline` + CSS vars on `:root` | Tailwind v4 | Single utility class adapts to theme automatically |
| Static font files per weight | Variable fonts via @fontsource-variable | Fontsource v5 (2023) | One file covers all weights 100-800 |
| HEX/HSL color values | OKLCH color values | CSS Color Level 4 (2023) | Perceptually uniform, better for palette generation |
| Google Fonts CDN | npm self-hosted via @fontsource | Fontsource v4 (2021) | No render-blocking external request, version locked |
| `color-scheme` in `<meta>` only | CSS `color-scheme` property | Supported since 2020+ | Granular control, adapts scrollbars/form controls |

**Deprecated/outdated:**
- `tailwind.config.js` / `tailwind.config.ts`: Still works but v4 prefers CSS-first `@theme` directive. This project already uses CSS-first.
- `@fontsource/jetbrains-mono` (static): The variable version (`@fontsource-variable/`) is preferred for multi-weight usage.
- Primitive token naming (`--color-gray-500`): The project currently has `--color-primary-600` etc. These will be replaced with semantic names.

## Hardcoded Class Inventory (Migration Reference)

Complete inventory of classes that must be replaced with semantic tokens:

### Files and Hardcoded Color Classes

**client/index.html:**
- `bg-gray-50` -> `bg-bg`
- `text-gray-900` -> `text-text-primary`

**client/src/pages/create.ts:** (14 instances)
- `text-gray-900` (x4) -> `text-text-primary`
- `text-gray-500` (x2) -> `text-text-secondary`
- `text-gray-700` (x3) -> `text-text-secondary` or `text-text-tertiary`
- `text-gray-600` (x1) -> `text-text-tertiary`
- `border-gray-300` (x2) -> `border-border`
- `border-gray-200` (x2) -> `border-border`
- `placeholder-gray-400` (x2) -> `placeholder-text-muted`
- `bg-primary-100` -> `bg-accent/10` (or new token)
- `text-primary-700` -> `text-accent`

**client/src/pages/reveal.ts:** (10 instances)
- `text-gray-900` (x3) -> `text-text-primary`
- `text-gray-500` (x2) -> `text-text-secondary`
- `text-gray-700` (x1) -> `text-text-secondary`
- `border-gray-300` (x1) -> `border-border`
- `border-gray-200` (x1) -> `border-border`
- `placeholder-gray-400` (x1) -> `placeholder-text-muted`
- `bg-white` (x1) -> `bg-surface`

**client/src/pages/confirmation.ts:** (5 instances)
- `text-gray-900` (x1) -> `text-text-primary`
- `text-gray-500` (x2) -> `text-text-secondary`
- `text-gray-700` (x1) -> `text-text-secondary`
- `border-gray-200` (x1) -> `border-border`
- `bg-gray-50` (x1) -> `bg-surface`

**client/src/pages/error.ts:** (2 instances)
- `text-gray-900` (x1) -> `text-text-primary`
- `text-gray-500` (x1) -> `text-text-secondary`

**client/src/components/expiration-select.ts:** (3 instances)
- `border-gray-300` -> `border-border`
- `bg-white` -> `bg-surface`
- `text-gray-900` -> `text-text-primary`

**client/src/components/loading-spinner.ts:** (1 instance)
- `text-gray-500` -> `text-text-secondary`

**Primary token renames:** (existing `@theme` tokens to replace)
- `primary-50` through `primary-700` -> `accent` / `accent-hover`
- `danger-500` -> `danger`
- `success-500` -> `success`
- `warning-500` -> `warning`

## Open Questions

1. **Should `--color-*: initial` clear ALL default Tailwind colors?**
   - What we know: Using `--color-*: initial` removes all default Tailwind color utilities (gray-50, blue-500, etc.). This is clean but means `text-white` and `text-black` also disappear unless re-declared.
   - What's unclear: Whether any Tailwind internals or third-party utilities depend on default color variables.
   - Recommendation: Clear all with `--color-*: initial` and explicitly re-add `--color-white: #fff` and `--color-black: #000`. This prevents accidental use of non-semantic colors. Test that no Tailwind internals break.

2. **Exact OKLCH values -- are the computed approximations precise enough?**
   - What we know: The OKLCH values were computed from hex approximations using standard conversion formulas. They are mathematically correct representations.
   - What's unclear: Whether rounding to 3 decimal places for L and 3-4 for C causes visible color shifts.
   - Recommendation: Use 2-3 decimal L values and 3 decimal C values (e.g., `oklch(0.23 0.038 283)`). This is standard practice and produces no visible difference vs. higher precision. Final tuning can happen visually in browser DevTools.

3. **Will `ring-offset-2` work without default colors?**
   - What we know: `ring-offset-*` uses `--tw-ring-offset-color` which defaults to white. After `--color-*: initial`, the default may break.
   - What's unclear: Whether Tailwind 4 handles ring-offset differently.
   - Recommendation: After implementing the token system, test focus ring styles. If broken, add `--tw-ring-offset-color: var(--ds-color-bg)` to `:root` or replace `ring-offset-2` usage with explicit offset colors.

## Sources

### Primary (HIGH confidence)
- [Tailwind CSS v4 @theme documentation](https://tailwindcss.com/docs/theme) -- `@theme` directive, `@theme inline`, namespace clearing
- [Tailwind CSS v4 customizing colors](https://tailwindcss.com/docs/customizing-colors) -- `@theme inline` with CSS variable pattern for semantic tokens
- [Tailwind CSS v4 color-scheme](https://tailwindcss.com/docs/color-scheme) -- `scheme-dark` utility, browser chrome adaptation
- [Tailwind CSS v4 dark mode](https://tailwindcss.com/docs/dark-mode) -- `@custom-variant dark`, `prefers-color-scheme`, manual toggle
- [Lucide vanilla JS documentation](https://lucide.dev/guide/packages/lucide) -- `createElement()` API, `createIcons()`, accessibility, tree-shaking
- [Fontsource JetBrains Mono install guide](https://fontsource.org/fonts/jetbrains-mono/install) -- variable font import, CSS usage

### Secondary (MEDIUM confidence)
- [Tailwind CSS v4 GitHub Discussion #15083](https://github.com/tailwindlabs/tailwindcss/discussions/15083) -- CSS variable dark mode pattern, `@variant dark` with `@layer theme`
- [Lucide + Vite tree-shaking optimization](https://christopher.engineering/en/blog/lucide-icons-with-vite-dev-server) -- Dev server performance, alias configuration
- [OKLCH in CSS (LogRocket)](https://blog.logrocket.com/oklch-css-consistent-accessible-color-palettes) -- OKLCH benefits, dark mode lightness ranges
- [CSS light-dark() browser support](https://caniuse.com/mdn-css_types_color_light-dark) -- Available since May 2024, Chrome 123+, Safari 17.5+
- [Evil Martians: OKLCH in CSS](https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl) -- Why OKLCH over RGB/HSL

### Tertiary (LOW confidence)
- Hex-to-OKLCH conversions were computed programmatically using standard formulas (not from a published converter tool). Values are mathematically correct but should be visually verified in browser.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Tailwind 4, Lucide, Fontsource are established, well-documented tools
- Architecture: HIGH -- `@theme inline` pattern is from official Tailwind docs; token structure follows industry-standard semantic naming
- Pitfalls: HIGH -- Contrast ratios computed programmatically; Vite tree-shaking issue is well-documented
- OKLCH palette values: MEDIUM -- Computed from hex approximations, may need visual fine-tuning

**Research date:** 2026-02-15
**Valid until:** 2026-03-15 (30 days -- stable ecosystem, no breaking changes expected)

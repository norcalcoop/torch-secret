# Phase 11: Layout Shell + Component Migration - Research

**Researched:** 2026-02-15
**Domain:** SPA layout shell, SVG icon migration, CSS background patterns
**Confidence:** HIGH

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Header design
- Compact logo-style: shield icon tight next to "SecureShare" wordmark as a single brand mark
- Sticky header: always visible at top on scroll
- Glassmorphism treatment: backdrop-blur with translucent background, modern floating feel (no solid border)
- "Create" nav link appears on non-create pages; no active route indicator needed (presence/absence is the indicator)
- Header rendered outside #app container so it persists across SPA route changes

#### Footer content & layout
- Trust signals only: "Zero-knowledge encryption" / "AES-256-GCM" / "Open Source" -- no GitHub link or external links
- Content-bottom positioning: footer sits below page content, not sticky to viewport
- Subtle top border using --color-border for visual separation from content
- Footer rendered outside #app container so it persists across SPA route changes

#### Dot-grid background
- Wide spacing (40-48px) -- sparse dots, barely-there texture
- Very faint opacity -- much lower than borders, more felt than seen
- Content area only -- dots appear between header and footer, not behind them
- CSS radial-gradient implementation -- no SVG, no extra files
- Linear-style aesthetic reference -- clean, engineering-grade background
- Static -- no animation or pulse

#### Emoji-to-icon migration
- Inline sizing: Lucide icons match text flow, same visual weight as the emojis they replace
- Color-coded error icons: warning = amber, error = red, info = blue -- severity immediately clear
- Reveal page shield icon uses --color-accent -- branded security signal at a key moment
- "How It Works" icon swap stays in Phase 12 per roadmap
- 7 emojis to replace across 2 files (reveal.ts: shield + lock; error.ts: lock, key, warning, search, explosion)

### Claude's Discretion
- Exact Lucide icon choices for each emoji replacement
- Footer trust signal arrangement (horizontal row vs icon+label badges)
- Navigation link visual treatment (active route indicator approach)
- Dot-grid fade/vignette behavior near content cards
- Dot-grid visibility in future light theme (Phase 13 concern)
- Dot animation decision (static vs subtle pulse) -- user leaned static but left flexibility

### Deferred Ideas (OUT OF SCOPE)
- "How It Works" section icon swap (numbered circles to descriptive SVG icons) -- Phase 12
- GitHub repo link in footer -- decided against for now, could revisit

</user_constraints>

## Summary

Phase 11 transforms the app from page-only rendering into a persistent layout shell with header, footer, dot-grid background, and all emojis replaced with Lucide SVG icons. The core technical challenge is rendering persistent layout elements outside the `#app` container (which the SPA router clears on every navigation) while keeping the header's "Create" nav link aware of the current route.

The existing `createIcon` utility (from Phase 9) already wraps Lucide's `createElement` with consistent defaults. The 7 emoji replacements span 2 files (`reveal.ts` and `error.ts`) and require swapping text-content-based emoji divs with `createIcon()` calls that produce CSP-safe SVG elements using only presentation attributes (no inline styles). The dot-grid background uses a single CSS `radial-gradient` rule on the content area wrapper, and the header's glassmorphism effect uses Tailwind's `backdrop-blur-md` with a translucent background color.

The DOM structure change is the most architecturally significant: `index.html` currently has `<main><div id="app">` as the only content area. The new structure needs `<header>`, `<main>` (with dot-grid), and `<footer>` as siblings, with `#app` nested inside `<main>`. The layout shell (header + footer) is created once in `app.ts` at DOMContentLoaded, then the router continues to operate on `#app` as before.

**Primary recommendation:** Create the layout shell in `app.ts` by programmatically building the header and footer and restructuring the DOM, then swap emojis in `error.ts` and `reveal.ts` using the existing `createIcon` utility with color-coded semantic classes.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| lucide | 0.564.0 | SVG icon data (IconNode) | Already installed; createIcon utility wraps it |
| tailwindcss | 4.1.18 | Utility classes for layout, blur, positioning | Already in use; provides backdrop-blur-*, sticky, z-* |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @fontsource-variable/jetbrains-mono | 5.2.8 | Heading font for wordmark | Already installed; used by font-heading token |

### No New Dependencies Required
This phase requires zero new npm packages. Everything needed is already installed:
- `lucide` 0.564.0 for icon data
- Tailwind CSS 4.1.18 for all layout/blur/positioning utilities
- The `createIcon` utility in `client/src/components/icons.ts`

## Architecture Patterns

### Current DOM Structure (index.html)
```html
<body>
  <a href="#main-content" class="sr-only ...">Skip to main content</a>
  <div id="route-announcer" ...></div>
  <main id="main-content">
    <div id="app" class="max-w-2xl mx-auto px-4 py-8">
      <noscript>...</noscript>
    </div>
  </main>
  <script type="module" src="/src/app.ts"></script>
</body>
```

### Target DOM Structure (after Phase 11)
```html
<body>
  <a href="#main-content" class="sr-only ...">Skip to main content</a>
  <div id="route-announcer" ...></div>
  <header id="site-header" class="sticky top-0 z-40 ...">
    <!-- Shield icon + "SecureShare" wordmark + optional "Create" link -->
  </header>
  <main id="main-content" class="dot-grid-bg ...">
    <div id="app" class="max-w-2xl mx-auto px-4 py-8">
      <noscript>...</noscript>
    </div>
  </main>
  <footer id="site-footer" class="border-t border-border ...">
    <!-- Trust signals -->
  </footer>
  <script type="module" src="/src/app.ts"></script>
</body>
```

**Key structural decisions:**
1. `<header>` and `<footer>` are siblings of `<main>`, not inside `#app`
2. `<main>` retains `id="main-content"` for the skip link target
3. `#app` remains inside `<main>` -- router behavior unchanged
4. Header is `position: sticky` so it scrolls with page but stays at top
5. Dot-grid background goes on `<main>` (between header and footer)

### Pattern 1: Layout Shell Initialization in app.ts

**What:** Create header/footer elements programmatically in app.ts at DOMContentLoaded, before the router initializes.
**When to use:** SPA apps where persistent layout must survive route changes.

```typescript
// client/src/app.ts
import './styles.css';
import { initRouter } from './router.js';
import { createLayoutShell } from './components/layout.js';

document.addEventListener('DOMContentLoaded', () => {
  createLayoutShell();
  initRouter();
});
```

The `createLayoutShell()` function:
1. Finds `<main id="main-content">` in the existing DOM
2. Creates `<header>` element with sticky positioning, inserts before `<main>`
3. Creates `<footer>` element, inserts after `<main>`
4. Adds dot-grid CSS class to `<main>`

**Why programmatic instead of static HTML:** The header contains a Lucide SVG icon (created via `createIcon`) and a dynamic "Create" link that toggles based on route. Static HTML cannot use `createIcon`.

### Pattern 2: Route-Aware Navigation Link

**What:** The header's "Create" link visibility depends on the current route. Show on non-create pages, hide on create page (/).
**When to use:** When navigation elements need to respond to SPA route changes.

**Approach:** Listen for route changes via a lightweight mechanism. Two options:

**Option A -- Check pathname on route change (recommended):**
The router already calls `handleRoute()` on every navigation. Add a custom event or a callback:

```typescript
// In router.ts, after rendering:
window.dispatchEvent(new CustomEvent('routechange', {
  detail: { path: window.location.pathname }
}));

// In layout.ts, the header listens:
window.addEventListener('routechange', (e: CustomEvent) => {
  const isCreate = e.detail.path === '/';
  createLink.classList.toggle('hidden', isCreate);
});
```

**Option B -- Direct pathname check on popstate + custom event:**
Simpler but less extensible. The header checks `window.location.pathname` on every `popstate` event and on initial load.

**Recommendation:** Option A. It gives a clean contract: the router announces changes, the layout reacts. The existing router code in `handleRoute()` already runs on every navigation (both `pushState` via `navigate()` and `popstate`).

### Pattern 3: Sticky Glassmorphism Header

**What:** A sticky header with backdrop-blur and translucent background that stays at the top.
**Tailwind classes:**

```
sticky top-0 z-40 backdrop-blur-md bg-bg/80
```

- `sticky top-0` -- sticks to top on scroll
- `z-40` -- above page content but below modals (if any)
- `backdrop-blur-md` -- 12px blur (Tailwind 4 default)
- `bg-bg/80` -- 80% opacity of the background color token

**No border** (glassmorphism decision from CONTEXT.md): The blur itself provides visual separation. If the user scrolls content under the header, the blur makes the header distinguishable.

### Pattern 4: CSS Dot-Grid Background

**What:** A sparse dot pattern using CSS radial-gradient on the content area.
**Implementation in styles.css:**

```css
.dot-grid-bg {
  background-image: radial-gradient(
    circle,
    var(--ds-color-border) 1px,
    transparent 1px
  );
  background-size: 44px 44px;
  opacity: 1; /* dots get opacity from the color itself */
}
```

**Note on opacity approach:** Rather than using CSS `opacity` on the entire main element (which would affect content too), use the dot color at very low opacity. Since the dots use `var(--ds-color-border)`, create a dedicated dot color variable with very low alpha:

```css
:root {
  --ds-color-dot-grid: oklch(0.36 0.058 283 / 0.15);
}
```

Then reference it in the radial-gradient. This makes dots "barely there" without affecting content opacity.

**Spacing:** 44px (within the 40-48px range specified in decisions). This provides sparse, engineering-grade texture.

**Content area only:** Applied to `<main>` which sits between header and footer. Header has its own opaque/blur background. Footer has its own background.

### Pattern 5: Emoji-to-SVG Icon Replacement

**What:** Replace emoji text content with Lucide SVG icons via `createIcon()`.
**Before (emoji):**
```typescript
const icon = document.createElement('div');
icon.className = 'text-6xl mb-6';
icon.textContent = '\u{1F6E1}\u{FE0F}'; // Shield emoji
icon.setAttribute('aria-hidden', 'true');
```

**After (Lucide SVG):**
```typescript
import { Shield } from 'lucide';
import { createIcon } from '../components/icons.js';

const icon = createIcon(Shield, {
  size: 48,
  class: 'text-accent',
  ariaLabel: undefined // decorative, aria-hidden by default
});
icon.classList.add('mb-6');
```

Key differences:
- No wrapper `<div>` needed -- `createIcon` returns an `<svg>` element directly
- Size is in pixels (not text-6xl) -- use 48px for large page icons to match visual weight of text-6xl emojis
- Color via Tailwind class override -- `text-accent` for branded icons, `text-danger` for error, `text-warning` for warning, etc.
- The `text-icon` default class is always present (from createIcon), but can be visually overridden by a more specific color class

### Anti-Patterns to Avoid

- **Rendering header/footer inside #app:** The router clears `#app` children on every route change. Layout elements inside `#app` would be destroyed and recreated on every navigation. They MUST be outside `#app`.

- **Using innerHTML for SVG icons:** Violates CSP (script-src is nonce-based). Always use Lucide's `createElement` via the `createIcon` utility which uses `document.createElementNS`.

- **Using CSS opacity on main element for dot-grid:** This would make ALL content semi-transparent. Use the dot color's alpha channel instead.

- **Hardcoding colors in icon creation:** Use semantic Tailwind classes (`text-accent`, `text-danger`, `text-warning`) not raw color values. These adapt when themes change in Phase 13.

- **Re-rendering header/footer on route change:** They should be created once and updated via class toggles (showing/hiding the Create link), not destroyed and recreated.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SVG icons | Manual SVG path strings | `createIcon(IconNode)` from icons.ts | Consistent sizing, a11y, color, CSP-safe |
| Backdrop blur | CSS filter hacks | Tailwind `backdrop-blur-md` | Cross-browser, tested, correct syntax |
| Sticky positioning | scroll event listeners | CSS `position: sticky` | Native, performant, no JS needed |
| Icon color coding | Custom CSS classes per icon | Semantic token classes (text-danger, text-warning, text-accent) | Already defined in design system |

**Key insight:** The existing icon utility and design token system from Phase 9 already solve the hard problems. Phase 11 is integration work -- wiring existing tools into new layout structures and replacing emojis with the utility that was purpose-built for this.

## Common Pitfalls

### Pitfall 1: Skip Link Target Mismatch
**What goes wrong:** If the header is inserted before `<main>`, the skip link (`href="#main-content"`) might not scroll past the sticky header correctly.
**Why it happens:** Sticky elements occupy space in the layout but stay at the viewport top, so `scrollIntoView` may leave content hidden behind the header.
**How to avoid:** Add `scroll-margin-top` to `#main-content` equal to the header height (approximately 56-64px). CSS: `scroll-mt-16` (Tailwind, 4rem = 64px).
**Warning signs:** Skip link appears to do nothing, or content starts behind the header.

### Pitfall 2: Dot-Grid Showing Through Header/Footer
**What goes wrong:** The dot-grid on `<main>` bleeds visually into the header or footer area.
**Why it happens:** If header/footer backgrounds are not opaque enough, dots from `<main>` are visible through backdrop-blur.
**How to avoid:** The header uses `backdrop-blur-md` which naturally obscures dots behind it. The footer uses a solid `bg-bg` background. Test by scrolling content under the header.
**Warning signs:** Dots visible in the header area when page content scrolls underneath.

### Pitfall 3: Route Change Event Timing
**What goes wrong:** The header's "Create" link doesn't update when navigating via `navigate()` (programmatic pushState).
**Why it happens:** `popstate` only fires on browser back/forward, not on `history.pushState()`. If the layout only listens to `popstate`, programmatic navigation won't trigger the update.
**How to avoid:** Dispatch a custom `routechange` event from the router on EVERY navigation (both `popstate` and `navigate()`). The layout listens for this custom event.
**Warning signs:** "Create" link visible on the create page after clicking "Create a New Secret" link from another page.

### Pitfall 4: CSP Violation from Inline Styles on SVG
**What goes wrong:** SVG icons don't render; console shows CSP violation for inline styles.
**Why it happens:** Some SVG creation methods use `element.style.x = ...` which CSP blocks. Lucide's `createElement` does NOT do this (uses `setAttribute` only), but custom wrapper code might accidentally introduce inline styles.
**How to avoid:** Never add `element.style.*` to SVG icons. Use CSS classes exclusively. The existing `createIcon` utility is already CSP-safe. Verify by checking that no `style` attribute appears on SVG elements.
**Warning signs:** Icons render in dev (no CSP) but fail in production (strict CSP).

### Pitfall 5: Icon Size Mismatch After Emoji Removal
**What goes wrong:** Lucide SVG icons look too small or too large compared to the emojis they replace.
**Why it happens:** Emojis at `text-5xl` (3rem = 48px) or `text-6xl` (3.75rem = 60px) have different visual weight than SVG icons at the same pixel size because emoji rendering includes built-in padding and color.
**How to avoid:** Use 48px for large page-hero icons (replacing text-6xl emojis). For error page icons (text-5xl), use 40px or `size: 'lg'` (32px) with testing. The exact size may need visual tuning.
**Warning signs:** Icons feel disproportionately small or large on the page.

### Pitfall 6: Footer Not Pushed to Bottom on Short Pages
**What goes wrong:** On pages with very little content (e.g., error page), the footer floats in the middle of the viewport instead of at the bottom.
**Why it happens:** The body/main don't expand to fill the viewport height.
**How to avoid:** Use `min-h-screen` on the body (already set) and flexbox on the body to push footer to the bottom: `flex flex-col` on body, `flex-1` on main. This makes main expand to fill available space.
**Warning signs:** Footer visible in the middle of the viewport on short-content pages.

## Code Examples

### Layout Shell Component

```typescript
// client/src/components/layout.ts
import { Shield } from 'lucide';
import { createIcon } from './icons.js';
import { navigate } from '../router.js';

export function createLayoutShell(): void {
  const main = document.getElementById('main-content')!;

  // Create header
  const header = createHeader();
  main.parentElement!.insertBefore(header, main);

  // Create footer
  const footer = createFooter();
  main.parentElement!.insertBefore(footer, main.nextSibling);

  // Add dot-grid class to main
  main.classList.add('dot-grid-bg', 'flex-1');
}

function createHeader(): HTMLElement {
  const header = document.createElement('header');
  header.id = 'site-header';
  header.className = 'sticky top-0 z-40 backdrop-blur-md bg-bg/80';

  const inner = document.createElement('div');
  inner.className = 'max-w-2xl mx-auto px-4 h-14 flex items-center justify-between';

  // Brand mark: shield icon + wordmark
  const brand = document.createElement('a');
  brand.href = '/';
  brand.className = 'flex items-center gap-2 text-text-primary no-underline';
  brand.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/');
  });

  const shieldIcon = createIcon(Shield, { size: 'sm', class: 'text-accent' });
  const wordmark = document.createElement('span');
  wordmark.className = 'font-heading font-semibold text-lg';
  wordmark.textContent = 'SecureShare';

  brand.appendChild(shieldIcon);
  brand.appendChild(wordmark);
  inner.appendChild(brand);

  // "Create" nav link (hidden on create page)
  const createLink = document.createElement('a');
  createLink.href = '/';
  createLink.className = 'text-sm text-text-secondary hover:text-accent transition-colors';
  createLink.textContent = 'Create';
  createLink.id = 'nav-create-link';
  createLink.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/');
  });
  inner.appendChild(createLink);

  header.appendChild(inner);

  // Route-aware visibility
  function updateCreateLink(): void {
    const isCreatePage = window.location.pathname === '/';
    createLink.classList.toggle('hidden', isCreatePage);
  }

  window.addEventListener('routechange', updateCreateLink);
  updateCreateLink(); // Initial check

  return header;
}
```

### Route Change Event Dispatch (router.ts modification)

```typescript
// Add at end of handleRoute() in router.ts:
window.dispatchEvent(new CustomEvent('routechange', {
  detail: { path: window.location.pathname }
}));
```

### Dot-Grid CSS (styles.css addition)

```css
/* Dot-grid background for content area */
:root {
  --ds-color-dot-grid: oklch(0.36 0.058 283 / 0.15);
}

.dot-grid-bg {
  background-image: radial-gradient(
    circle,
    var(--ds-color-dot-grid) 1px,
    transparent 1px
  );
  background-size: 44px 44px;
}
```

### Error Page Icon Migration (error.ts)

```typescript
// Before: emoji-based ERROR_CONFIG
const ERROR_CONFIG: Record<ErrorType, { heading: string; message: string; icon: string }> = {
  not_available: { heading: '...', message: '...', icon: '\u{1F512}' },
  // ...
};

// After: Lucide icon-based ERROR_CONFIG
import { Lock, KeyRound, TriangleAlert, Search, Bomb } from 'lucide';
import { createIcon, type IconNode } from '../components/icons.js';

interface ErrorConfig {
  heading: string;
  message: string;
  icon: IconNode;
  iconClass: string; // Color class: text-danger, text-warning, etc.
}

const ERROR_CONFIG: Record<ErrorType, ErrorConfig> = {
  not_available: {
    heading: 'Secret Not Available',
    message: '...',
    icon: Lock,
    iconClass: 'text-danger',
  },
  no_key: {
    heading: 'Invalid Link',
    message: '...',
    icon: KeyRound,
    iconClass: 'text-warning',
  },
  decrypt_failed: {
    heading: 'Decryption Failed',
    message: '...',
    icon: TriangleAlert,
    iconClass: 'text-warning',
  },
  not_found: {
    heading: 'Page Not Found',
    message: '...',
    icon: Search,
    iconClass: 'text-text-muted',
  },
  destroyed: {
    heading: 'Secret Destroyed',
    message: '...',
    icon: Bomb,
    iconClass: 'text-danger',
  },
};
```

Then in `renderErrorPage`:
```typescript
// Replace:
const icon = document.createElement('div');
icon.className = 'text-5xl mb-4';
icon.textContent = config.icon;
icon.setAttribute('aria-hidden', 'true');

// With:
const icon = createIcon(config.icon, {
  size: 40,
  class: config.iconClass,
});
icon.classList.add('mb-4');
```

### Emoji-to-Lucide Icon Mapping

| Location | Emoji | Unicode | Lucide Icon | Import Name | Color Class |
|----------|-------|---------|-------------|-------------|-------------|
| reveal.ts interstitial | Shield | `\u{1F6E1}\u{FE0F}` | Shield | `Shield` | `text-accent` |
| reveal.ts password | Lock | `\u{1F512}` | Lock | `Lock` | `text-accent` |
| error.ts not_available | Lock | `\u{1F512}` | Lock | `Lock` | `text-danger` |
| error.ts no_key | Key | `\u{1F511}` | KeyRound | `KeyRound` | `text-warning` |
| error.ts decrypt_failed | Warning | `\u{26A0}\u{FE0F}` | TriangleAlert | `TriangleAlert` | `text-warning` |
| error.ts not_found | Magnifying glass | `\u{1F50D}` | Search | `Search` | `text-text-muted` |
| error.ts destroyed | Explosion | `\u{1F4A5}` | Bomb | `Bomb` | `text-danger` |

**Icon choice rationale:**
- **Shield** for the reveal interstitial: Direct match to the shield emoji, branded accent color
- **Lock** for password entry and "not available": Security/locked state
- **KeyRound** over `Key`: More visually distinct at small sizes, the rounded key head reads better
- **TriangleAlert** (not `AlertTriangle`): The canonical name in Lucide -- `AlertTriangle` is a deprecated alias
- **Search** for "not found": Magnifying glass maps directly
- **Bomb** for "destroyed": Closest match to the explosion/collision emoji; communicates permanent destruction

### Footer Trust Signals

```typescript
function createFooter(): HTMLElement {
  const footer = document.createElement('footer');
  footer.id = 'site-footer';
  footer.className = 'border-t border-border bg-bg py-6';

  const inner = document.createElement('div');
  inner.className = 'max-w-2xl mx-auto px-4 flex flex-wrap justify-center gap-6 text-xs text-text-muted';

  const signals = [
    'Zero-knowledge encryption',
    'AES-256-GCM',
    'Open Source',
  ];

  for (const text of signals) {
    const span = document.createElement('span');
    span.textContent = text;
    inner.appendChild(span);
  }

  footer.appendChild(inner);
  return footer;
}
```

**Recommendation for trust signal arrangement:** Horizontal row of text spans with `gap-6` spacing. No icons needed in the footer -- the trust signals are concise text labels that read cleanly. Using icon+label badges would add visual noise to what should be a quiet footer.

### Body Flexbox for Footer Positioning

```html
<!-- index.html body change -->
<body class="min-h-screen flex flex-col bg-bg text-text-primary font-body">
```

This ensures the footer is pushed to the bottom on short-content pages.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Emoji icons in UI | Lucide SVG icons via createIcon | Phase 9/11 | Consistent sizing, CSP-safe, semantic colors |
| Pages only (no shell) | Persistent header/footer layout | Phase 11 | Brand consistency, navigation, trust signals |
| Scroll to top behavior | position: sticky header | CSS standard | No JS needed for sticky behavior |
| JavaScript scroll listeners | CSS position: sticky | Widely supported since 2020 | Better performance, simpler code |
| opacity on container for faint patterns | Color alpha channel (oklch with / 0.15) | Modern CSS | Doesn't affect child element opacity |

**Deprecated/outdated:**
- Lucide export `AlertTriangle`: Renamed to `TriangleAlert`. The old name still works as alias but prefer the canonical name.

## Open Questions

1. **Exact header height for scroll-margin-top**
   - What we know: Header inner container is `h-14` (56px). With padding or borders it could vary.
   - What's unclear: Whether 56px is the final rendered height or if glassmorphism adds visual space.
   - Recommendation: Use `scroll-mt-16` (64px) as a safe value with buffer, then visually verify the skip link behavior.

2. **Dot-grid opacity value**
   - What we know: Must be "very faint, more felt than seen." Border token is oklch(0.36 0.058 283).
   - What's unclear: The exact alpha value (0.10? 0.15? 0.20?) needs visual tuning in a real browser.
   - Recommendation: Start with `oklch(0.36 0.058 283 / 0.15)` and adjust. This is a visual judgment call that can only be finalized in-browser.

3. **Dot-grid fade/vignette near content cards**
   - What we know: Context says this is Claude's discretion. A radial mask-image can fade dots near center.
   - What's unclear: Whether a vignette adds to the aesthetic or is unnecessary complexity.
   - Recommendation: Skip the vignette initially. The sparse dots at low opacity are already subtle. Add vignette only if the dots feel too prominent near content. KISS principle.

## Sources

### Primary (HIGH confidence)
- **Codebase inspection** -- Read all relevant source files: router.ts, app.ts, index.html, styles.css, icons.ts, reveal.ts, error.ts, create.ts, confirmation.ts, security.ts
- **Lucide source code** (`node_modules/lucide/dist/cjs/lucide.js`) -- Verified createElement uses `document.createElementNS` + `setAttribute` only (CSP-safe, no inline styles)
- **Lucide icon verification** -- Node.js runtime check confirmed all 7 target icons exist: Shield, Lock, KeyRound, TriangleAlert, Search, Bomb + ShieldCheck, LockKeyhole as alternates

### Secondary (MEDIUM confidence)
- [Tailwind CSS backdrop-filter-blur docs](https://tailwindcss.com/docs/backdrop-filter-blur) -- Verified class names: backdrop-blur-md = 12px
- [CSS dot grid backgrounds guide](https://ibelick.com/blog/create-grid-and-dot-backgrounds-with-css-tailwind-css) -- Verified radial-gradient dot pattern technique
- [MDN radial-gradient()](https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/radial-gradient) -- CSS spec reference

### Tertiary (LOW confidence)
- None -- all findings verified against primary or secondary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and verified
- Architecture: HIGH -- DOM structure changes verified against existing codebase, router behavior confirmed by reading source
- Pitfalls: HIGH -- all pitfalls derive from direct code inspection (CSP middleware, router event handling, DOM structure)
- Icon mapping: HIGH -- all 7 Lucide icon exports verified via Node.js runtime check
- Dot-grid CSS: MEDIUM -- technique is well-established but exact opacity needs visual tuning

**Research date:** 2026-02-15
**Valid until:** 2026-03-15 (stable patterns, no fast-moving dependencies)

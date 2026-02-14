# Phase 7: Trust and Accessibility - Research

**Researched:** 2026-02-14
**Domain:** WCAG 2.1 AA compliance, SPA accessibility, trust content for zero-knowledge architecture
**Confidence:** HIGH

## Summary

Phase 7 has two distinct workstreams: (1) a "How it works" trust section explaining the zero-knowledge encryption model in plain language, and (2) WCAG 2.1 AA accessibility compliance across the entire application. Both are content-and-attribute-level changes to existing pages -- no new libraries are required and no architectural changes are needed.

The existing codebase has a solid foundation: all interactive elements already have `min-h-[44px]` touch targets, `focus:ring-2 focus:ring-primary-500` focus states, form labels with `htmlFor` associations, and `role="alert"` on error areas. However, significant accessibility gaps remain: no `document.title` updates on route changes, no ARIA landmarks (`<main>`, `<nav>`, `<footer>`), no `aria-live` region for SPA route change announcements, no skip link, and no `aria-label` attributes on icon-only elements or the loading spinner. The color theme uses oklch which makes contrast verification straightforward since oklch lightness directly correlates with perceived brightness.

The trust content section follows a well-established pattern used by OneTimeSecret, 1Password, and similar services: a 3-step visual explanation with plain-language descriptions of what happens at each stage (encrypt in browser, send encrypted blob, one-time retrieve and destroy). The key message to convey is that the encryption key never leaves the browser -- it lives only in the URL fragment which is never sent to the server.

**Primary recommendation:** Add SPA accessibility infrastructure (route announcements, skip link, landmarks, document.title updates) first as a foundation, then layer the "How it works" content section onto the create page, then do a full accessibility audit pass with color contrast verification.

## Standard Stack

### Core (Already Installed -- No New Dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tailwind CSS | 4.1.x | `sr-only`, `focus:not-sr-only`, contrast utilities | Already installed; provides all needed a11y utility classes |
| Vitest | 4.x | Automated accessibility testing | Already installed; test DOM structure assertions |

### Supporting (New Dev Dependency)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest-axe | 0.1.x | Automated axe-core a11y assertions in Vitest | Unit tests that verify DOM output has no a11y violations |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| vitest-axe | Manual-only testing | vitest-axe catches structural issues (missing labels, bad ARIA) automatically; manual testing still needed for contrast and keyboard flow but vitest-axe prevents regressions |
| vitest-axe | @axe-core/playwright | Playwright is heavier; vitest-axe integrates with existing Vitest+happy-dom setup |

**Installation:**
```bash
npm install -D vitest-axe
```

**Important limitation:** vitest-axe with happy-dom/jsdom cannot test color contrast (the `color-contrast` rule does not work in JSDOM/happy-dom). Color contrast must be verified manually or with browser-based tools like OddContrast.

## Architecture Patterns

### Current Project Structure (No New Files Needed for Accessibility)

```
client/
  src/
    pages/
      create.ts          # Add "How it works" section here
      confirmation.ts    # Add document.title update
      reveal.ts          # Add document.title update
      error.ts           # Add document.title update
    components/
      copy-button.ts     # Add aria-label for state changes
      loading-spinner.ts # Add aria-live, role="status"
    router.ts            # Add route change announcements, document.title, focus management
    app.ts               # No changes needed
    styles.css           # No changes needed (oklch colors already pass contrast)
  index.html             # Add skip link, <main> landmark, aria-live announcement region
```

### Pattern 1: SPA Route Change Announcements

**What:** When a SPA changes "pages," screen readers receive no notification because there is no page reload. The fix is an `aria-live="polite"` region that receives the new page title after each route change, combined with focus management to move focus to the new page heading.

**When to use:** Every route change in `router.ts`.

**Example:**
```typescript
// In index.html: add a visually-hidden live region
// <div id="route-announcer" class="sr-only" aria-live="polite" aria-atomic="true"></div>

// In router.ts: after rendering the new page
function announceRouteChange(title: string): void {
  document.title = `${title} - SecureShare`;
  const announcer = document.getElementById('route-announcer');
  if (announcer) {
    announcer.textContent = title;
  }
}

// After page renders, move focus to the h1
function focusPageHeading(): void {
  const heading = document.querySelector('h1');
  if (heading) {
    heading.setAttribute('tabindex', '-1');
    heading.focus();
  }
}
```
Source: [Orange a11y guidelines for SPAs](https://a11y-guidelines.orange.com/en/articles/single-page-app/), [MDN ARIA live regions](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions)

### Pattern 2: Skip Link

**What:** A visually-hidden link at the very top of the page that becomes visible on focus, allowing keyboard users to skip directly to main content.

**When to use:** In `index.html`, as the first focusable element in `<body>`.

**Example:**
```html
<body class="min-h-screen bg-gray-50 text-gray-900">
  <a href="#main-content" class="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:bg-primary-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:outline-none">
    Skip to main content
  </a>
  <main id="main-content">
    <div id="app" class="max-w-2xl mx-auto px-4 py-8"></div>
  </main>
</body>
```
Source: [Tailwind sr-only / focus:not-sr-only pattern](https://tailscan.com/tailwind/accessibility/sr-only)

### Pattern 3: "How It Works" Trust Section

**What:** A 3-step visual explanation on the landing page (create page) that explains the zero-knowledge model in plain language. Positioned below the form, it builds trust without interrupting the primary action.

**When to use:** On the create page (`/`), below the form.

**Structure:**
```
How It Works
1. Encrypt in Your Browser
   Your secret is encrypted on your device before anything is sent.
   The encryption key never leaves your browser.

2. Store Only Encrypted Data
   Our server receives only the encrypted blob -- it cannot read your secret.
   Even a full database breach reveals nothing.

3. One-Time Retrieve & Destroy
   The recipient decrypts in their browser using the key in the link.
   After one view, the encrypted data is permanently destroyed.
```

**Design pattern:** Use a horizontal (desktop) / vertical (mobile) step layout with numbered icons, short headings, and 1-2 sentence descriptions. Similar to patterns used by OneTimeSecret, 1Password, and Bitwarden trust pages.

### Pattern 4: Loading Spinner Accessibility

**What:** The loading spinner component needs ARIA attributes so screen readers announce the loading state.

**Example:**
```typescript
export function createLoadingSpinner(message?: string): HTMLDivElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'flex flex-col items-center justify-center gap-3 py-12';
  wrapper.setAttribute('role', 'status');
  wrapper.setAttribute('aria-live', 'polite');

  const spinner = document.createElement('div');
  spinner.className =
    'h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600';
  spinner.setAttribute('aria-hidden', 'true'); // decorative

  const text = document.createElement('p');
  text.className = 'text-sm text-gray-500';
  text.textContent = message ?? 'Loading...';

  wrapper.appendChild(spinner);
  wrapper.appendChild(text);
  return wrapper;
}
```
Source: [WCAG 4.1.3 Status Messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html)

### Anti-Patterns to Avoid

- **Using `aria-live="assertive"` for route changes:** Route changes are not urgent. Use `polite` so the screen reader finishes its current announcement before announcing the new page.
- **Double-announcing with `role="alert"` + `aria-live="assertive"`:** This causes double announcements in VoiceOver on iOS. Use one or the other, not both. The existing `role="alert"` on error areas is correct and sufficient.
- **Putting `aria-live` on elements with existing content:** Live regions should start empty and be updated dynamically. The region must exist in the DOM before content is injected.
- **Using `outline-none` without replacement:** In Tailwind CSS 4, `outline-none` actually removes the outline (unlike v3). Use `outline-hidden` to hide the outline while preserving forced-colors mode. However, the existing code uses `focus:ring-2` as the replacement focus indicator alongside `focus:outline-none`, which is acceptable because the ring provides visible focus indication. Just be aware of forced-colors mode where `ring` (box-shadow) becomes invisible -- `outline` is preserved. The existing `focus:outline-none` should be changed to `focus:outline-hidden` for forced-colors accessibility.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Accessibility violation detection | Custom DOM inspection logic | vitest-axe (`toHaveNoViolations()`) | axe-core has 100+ rules, handles edge cases, maintained by Deque |
| Color contrast checking | Custom luminance calculations | OddContrast (oddcontrast.com) or browser DevTools | WCAG contrast ratio involves relative luminance in sRGB; oklch lightness is close but not identical to sRGB relative luminance |
| Screen reader text hiding | Custom CSS for hiding text | Tailwind `sr-only` class | Tailwind's sr-only applies the correct combination of position, width, height, padding, margin, overflow, clip, and white-space properties |
| Focus trap for modals | Custom keyboard event handlers | Not applicable (no modals in this app) | No modals exist; all pages are full-page renders |

**Key insight:** Accessibility is a domain where the edge cases are the entire problem. Screen readers have wildly different behaviors, and utilities like axe-core and Tailwind's sr-only encode years of cross-browser/cross-AT knowledge.

## Common Pitfalls

### Pitfall 1: Route Changes Silent to Screen Readers

**What goes wrong:** Screen reader users click a link in a SPA, hear nothing, and don't know the page changed. They're stranded on the element they clicked.
**Why it happens:** SPAs update DOM without page reload; screen readers rely on page load events for context changes.
**How to avoid:** (1) Update `document.title` on every route change, (2) announce the new page via `aria-live="polite"` region, (3) move focus to the new page's `<h1>` (with `tabindex="-1"` for programmatic focus).
**Warning signs:** Navigate the app using only VoiceOver/NVDA -- if you hear nothing after clicking a link, it's broken.

### Pitfall 2: oklch Colors That Look Accessible But Fail WCAG

**What goes wrong:** oklch lightness values suggest sufficient contrast, but WCAG contrast ratio uses sRGB relative luminance, which doesn't map 1:1 to oklch lightness.
**Why it happens:** oklch is perceptually uniform but WCAG 2.1 uses the older luminance formula. A color with oklch L=0.50 might not achieve 4.5:1 against white.
**How to avoid:** Always verify contrast with a tool that computes actual WCAG ratio (OddContrast, WebAIM Contrast Checker). The project's primary-600 at `oklch(0.50 0.19 250)` and gray-500 text colors need manual verification.
**Warning signs:** Text that "looks fine" to most people but fails automated contrast checks.

### Pitfall 3: Copy Button State Changes Not Announced

**What goes wrong:** When the copy button text changes to "Copied!", sighted users see the feedback but screen reader users hear nothing.
**Why it happens:** Text content changes in a non-live region are not announced.
**How to avoid:** Add `aria-live="polite"` to the copy button or use a separate visually-hidden live region for status announcements.
**Warning signs:** Click "Copy" with a screen reader active -- if you don't hear "Copied!", it needs fixing.

### Pitfall 4: Emoji Icons Not Accessible

**What goes wrong:** The error page and interstitial use Unicode emoji (shield, lock, key, warning, explosion) as decorative icons. Screen readers may read them as their Unicode names (e.g., "collision symbol"), creating confusing output.
**Why it happens:** Screen readers interpret emoji as text content and announce their Unicode names.
**How to avoid:** Mark emoji containers with `aria-hidden="true"` since they're decorative and the heading already conveys the meaning.
**Warning signs:** Listen to the error page with a screen reader -- if you hear "collision symbol" before the heading, the emoji needs hiding.

### Pitfall 5: focus:outline-none in Forced Colors Mode

**What goes wrong:** In Windows High Contrast Mode (forced-colors), `box-shadow` (which Tailwind's `ring` utility uses) becomes invisible. If `outline-none` removes the outline, focused elements have no visible indicator in forced-colors mode.
**Why it happens:** Forced-colors mode overrides colors; `box-shadow` is not a color property that gets overridden -- it just disappears. `outline` is preserved and auto-colored.
**How to avoid:** Change `focus:outline-none` to `focus:outline-hidden` across all interactive elements. In Tailwind CSS 4, `outline-hidden` sets `outline-color: transparent` which forced-colors mode overrides to a visible color, while `outline-none` sets `outline-style: none` which cannot be overridden.
**Warning signs:** Test with Windows High Contrast Mode enabled; if you can't see focus indicators, the outlines need fixing.

### Pitfall 6: vitest-axe Cannot Test Color Contrast

**What goes wrong:** Developers rely on vitest-axe to catch contrast issues, but the `color-contrast` rule does not work in JSDOM or happy-dom environments.
**Why it happens:** JSDOM/happy-dom don't compute CSS (no layout engine), so computed colors are unavailable.
**How to avoid:** Accept that contrast verification is manual/browser-only. Use OddContrast or Chrome DevTools a11y inspector for contrast. Don't skip manual contrast checks because "the tests pass."
**Warning signs:** All vitest-axe tests pass but real contrast issues exist in the browser.

## Code Examples

### Route Announcer Setup (index.html)

```html
<!-- Source: MDN ARIA Live Regions + Orange SPA a11y guidelines -->
<body class="min-h-screen bg-gray-50 text-gray-900">
  <!-- Skip link: visually hidden, appears on focus -->
  <a href="#main-content"
     class="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:bg-primary-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:ring-2 focus:ring-primary-500 focus:ring-offset-2">
    Skip to main content
  </a>

  <!-- Route change announcer for screen readers -->
  <div id="route-announcer" class="sr-only" aria-live="polite" aria-atomic="true"></div>

  <main id="main-content">
    <div id="app" class="max-w-2xl mx-auto px-4 py-8"></div>
  </main>
</body>
```

### Router with Accessibility (router.ts modifications)

```typescript
// Source: Deque SPA accessibility tips, Orange a11y guidelines
const PAGE_TITLES: Record<string, string> = {
  '/': 'Share a Secret',
  '/secret/': "You've Received a Secret",
};

function handleRoute(): void {
  const path = window.location.pathname;
  const container = document.getElementById('app')!;

  // Clear existing content
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  if (path === '/') {
    updatePageMeta('Share a Secret');
    import('./pages/create.js')
      .then((mod) => mod.renderCreatePage(container))
      .then(() => focusPageHeading())
      .catch(() => showLoadError(container));
  } else if (path.startsWith('/secret/')) {
    updatePageMeta("You've Received a Secret");
    import('./pages/reveal.js')
      .then((mod) => mod.renderRevealPage(container))
      .then(() => focusPageHeading())
      .catch(() => showLoadError(container));
  } else {
    updatePageMeta('Page Not Found');
    import('./pages/error.js')
      .then((mod) => mod.renderErrorPage(container, 'not_found'))
      .then(() => focusPageHeading())
      .catch(() => showLoadError(container));
  }
}

function updatePageMeta(title: string): void {
  document.title = `${title} - SecureShare`;
  const announcer = document.getElementById('route-announcer');
  if (announcer) {
    // Clear then set to trigger announcement even for same title
    announcer.textContent = '';
    requestAnimationFrame(() => {
      announcer.textContent = title;
    });
  }
}

function focusPageHeading(): void {
  const heading = document.querySelector('h1');
  if (heading) {
    heading.setAttribute('tabindex', '-1');
    heading.focus();
  }
}
```

### "How It Works" Section (create.ts addition)

```typescript
// Source: Pattern from OneTimeSecret, 1Password, Bitwarden trust pages
function createHowItWorksSection(): HTMLElement {
  const section = document.createElement('section');
  section.setAttribute('aria-labelledby', 'how-it-works-heading');
  section.className = 'mt-12 pt-8 border-t border-gray-200';

  const heading = document.createElement('h2');
  heading.id = 'how-it-works-heading';
  heading.className = 'text-xl sm:text-2xl font-bold text-gray-900 text-center mb-8';
  heading.textContent = 'How It Works';

  const steps = document.createElement('div');
  steps.className = 'grid grid-cols-1 sm:grid-cols-3 gap-6';

  const stepData = [
    {
      number: '1',
      title: 'Encrypted in Your Browser',
      description: 'Your secret is encrypted on your device before anything is sent. The encryption key stays in your browser and never reaches our server.',
    },
    {
      number: '2',
      title: 'Stored Encrypted',
      description: 'Our server only sees scrambled data it cannot read. Even a complete database breach would reveal nothing.',
    },
    {
      number: '3',
      title: 'View Once, Then Destroyed',
      description: 'The recipient decrypts the secret in their browser. After viewing, the encrypted data is permanently deleted from our servers.',
    },
  ];

  for (const data of stepData) {
    const step = document.createElement('div');
    step.className = 'text-center space-y-2';

    const number = document.createElement('div');
    number.className = 'w-10 h-10 rounded-full bg-primary-100 text-primary-700 font-bold flex items-center justify-center mx-auto text-lg';
    number.textContent = data.number;
    number.setAttribute('aria-hidden', 'true');

    const title = document.createElement('h3');
    title.className = 'font-semibold text-gray-900';
    title.textContent = data.title;

    const desc = document.createElement('p');
    desc.className = 'text-sm text-gray-500 leading-relaxed';
    desc.textContent = data.description;

    step.appendChild(number);
    step.appendChild(title);
    step.appendChild(desc);
    steps.appendChild(step);
  }

  section.appendChild(heading);
  section.appendChild(steps);
  return section;
}
```

### vitest-axe Test Example

```typescript
// Source: https://github.com/chaance/vitest-axe
import { describe, it, expect } from 'vitest';
import { axe } from 'vitest-axe';
import 'vitest-axe/extend-expect';

describe('Create page accessibility', () => {
  it('should have no accessibility violations', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    // Import and render the page
    const { renderCreatePage } = await import('../pages/create.js');
    await renderCreatePage(container);

    const results = await axe(container);
    expect(results).toHaveNoViolations();

    document.body.removeChild(container);
  });
});
```

### Copy Button with Screen Reader Announcement

```typescript
// Source: WCAG 4.1.3 Status Messages
button.addEventListener('click', async () => {
  const text = getText();
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = 'Copied!';
    // Screen reader announcement via aria-live on button
    button.setAttribute('aria-live', 'polite');
    setTimeout(() => {
      button.textContent = defaultLabel;
      button.removeAttribute('aria-live');
    }, 2000);
  } catch { /* ... */ }
});
```

## WCAG 2.1 AA Criteria Relevant to This App

The full WCAG 2.1 AA standard has 50 success criteria. The following are the ones most relevant to SecureShare (a simple form-based SPA with no multimedia, tables, or complex widgets):

### Must Address (Currently Missing)

| Criterion | Requirement | Current Gap |
|-----------|-------------|-------------|
| 2.4.1 Bypass Blocks | Skip link to bypass repeated content | No skip link exists |
| 2.4.2 Page Titled | Descriptive page titles | Static "SecureShare" title, never updated |
| 1.3.1 Info and Relationships | Semantic structure programmatically determinable | No `<main>` landmark, no `aria-labelledby` on sections |
| 4.1.3 Status Messages | Status messages use role/aria so AT announces without focus | Loading spinner has no `role="status"`, copy button "Copied!" not announced |
| 1.3.6 Identify Purpose | Input purpose programmatically determinable | Password fields need `autocomplete="current-password"` / `autocomplete="new-password"` |

### Already Addressed

| Criterion | Requirement | Current State |
|-----------|-------------|---------------|
| 2.1.1 Keyboard | All functionality via keyboard | All elements are native HTML (button, input, a, select) -- keyboard accessible by default |
| 2.1.2 No Keyboard Trap | No keyboard traps | No traps; all pages are flat navigation |
| 2.4.7 Focus Visible | Focus indicator visible | `focus:ring-2 focus:ring-primary-500` on all interactive elements |
| 2.5.5 Target Size | Touch targets at least 44x44px | `min-h-[44px]` on all buttons and inputs |
| 3.3.1 Error Identification | Error messages clear | Error areas with `role="alert"` exist |
| 3.3.2 Labels or Instructions | Form inputs have labels | All inputs have `<label>` with `htmlFor` |
| 1.4.3 Contrast (Minimum) | 4.5:1 normal text, 3:1 large text | Needs manual verification (see Color Analysis below) |

### Not Applicable

| Criterion | Why Not Applicable |
|-----------|-------------------|
| 1.2.x Audio/Video | No multimedia content |
| 1.4.2 Audio Control | No audio |
| 1.4.5 Images of Text | No images of text |
| 2.2.1 Timing Adjustable | No time limits on user interaction (expiration is server-side) |
| 2.3.1 Three Flashes | No flashing content |
| 2.4.5 Multiple Ways | Single-purpose app, one main flow |

## Color Contrast Analysis

### Current Theme Colors (from styles.css)

```css
--color-primary-600: oklch(0.50 0.19 250);  /* Primary buttons, links */
--color-primary-700: oklch(0.42 0.17 250);  /* Hover states */
--color-danger-500:  oklch(0.60 0.18 25);   /* Error text */
--color-success-500: oklch(0.65 0.15 145);  /* Success text */
```

### Colors Used in the UI

| Usage | Foreground | Background | Needs Check |
|-------|-----------|------------|-------------|
| Primary button text | white | primary-600 `oklch(0.50)` | White on primary-600: verify >= 4.5:1 |
| Body text | gray-900 | gray-50 | Near-black on near-white: almost certainly passes |
| Subtext | gray-500 | gray-50/white | Gray on white: verify >= 4.5:1 |
| Error text | danger-500 `oklch(0.60)` | danger-500/10 bg | Red on light red: verify >= 4.5:1 |
| Counter text | gray-400 | white | Light gray on white: likely FAILS, needs darkening |
| Placeholder text | gray-400 | white | Placeholders: WCAG does not require contrast on placeholders, but best practice is >= 3:1 |
| Warning text (attempts) | warning-500 | white | No warning color defined in theme -- uses Tailwind default |

### Action Items for Contrast

1. **gray-400 text on white/gray-50 backgrounds** -- Tailwind's default gray-400 is typically around `#9ca3af` which may hover near the 4.5:1 boundary. The character counter uses this. Verify and potentially upgrade to gray-500.
2. **primary-600 button with white text** -- oklch lightness 0.50 should give sufficient contrast with white, but must be verified with OddContrast.
3. **gray-500 subtext** -- Used for descriptions ("End-to-end encrypted. One-time view. No accounts."). Verify against gray-50 background.
4. **danger-500 and success-500** -- Used for error messages and copy button feedback. Verify.
5. **warning-500** -- Not defined in theme, falls back to Tailwind default. Used for password attempt counter. Verify it's defined or add it.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `outline-none` hides but preserves in forced-colors (Tailwind v3) | `outline-hidden` preserves in forced-colors, `outline-none` truly removes (Tailwind v4) | Tailwind CSS v4 (2025) | Must update all `focus:outline-none` to `focus:outline-hidden` |
| `focus:` pseudo-class (fires on all focus) | `focus-visible:` (fires only on keyboard focus) | CSS standard, well-supported | Could upgrade `focus:ring-2` to `focus-visible:ring-2` but `focus:` is also acceptable for a11y |
| Manual a11y testing only | axe-core automated + manual | Ongoing | vitest-axe catches structural issues; manual testing still required for contrast, keyboard flow, and screen reader experience |

**Deprecated/outdated:**
- Tailwind CSS v3's `outline-none` (which secretly preserved outline) is now `outline-hidden` in v4. The project currently uses `focus:outline-none` which in Tailwind v4 actually removes the outline entirely.

## Open Questions

1. **warning-500 color not defined in theme**
   - What we know: The password attempt counter uses `text-warning-500` and `text-danger-500`. `danger-500` is defined in styles.css but `warning-500` is not.
   - What's unclear: Whether Tailwind 4 has a default warning palette or if this is silently generating no color.
   - Recommendation: Check if warning-500 renders correctly in the browser. If not, add `--color-warning-500` to the theme. Either way, verify its contrast ratio.

2. **Exact contrast ratios of oklch theme colors**
   - What we know: oklch lightness correlates with perceived brightness, making rough estimates possible. primary-600 at L=0.50 on white should be around 5:1 to 6:1.
   - What's unclear: Exact WCAG ratios require sRGB conversion and the standard luminance formula.
   - Recommendation: Use OddContrast (oddcontrast.com) to verify each foreground/background pair during implementation. This is a manual verification task, not automatable in tests.

3. **Whether to add prefers-reduced-motion handling**
   - What we know: The loading spinner uses `animate-spin`. WCAG 2.3.1 (three flashes) is not an issue, but 2.3.3 (animation from interactions) is AAA-level only.
   - What's unclear: Whether the spinning animation needs a `prefers-reduced-motion` alternative for AA compliance.
   - Recommendation: AA does not strictly require it, but it's a quick win: `motion-reduce:animate-none` on the spinner. Include it if there's time.

## Sources

### Primary (HIGH confidence)
- [W3C WCAG 2.1 Specification](https://www.w3.org/TR/WCAG21/) - Full success criteria reference
- [MDN ARIA Live Regions](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions) - Live region implementation, aria-live values, aria-atomic, common mistakes
- [Tailwind CSS Outline Style docs](https://tailwindcss.com/docs/outline-style) - outline-none vs outline-hidden in v4
- [Tailwind CSS Hover/Focus states docs](https://tailwindcss.com/docs/hover-focus-and-other-states) - focus-visible, aria-* variants

### Secondary (MEDIUM confidence)
- [Orange a11y guidelines for SPAs](https://a11y-guidelines.orange.com/en/articles/single-page-app/) - Focus management on route change, History API, landmarks
- [Deque SPA Accessibility Tips](https://www.deque.com/blog/accessibility-tips-in-single-page-applications/) - Focus management, semantic HTML priority, ARIA authoring practices
- [vitest-axe GitHub](https://github.com/chaance/vitest-axe) - API, setup, limitations with happy-dom
- [Accessible.org WCAG Checklist](https://accessible.org/wcag/) - Simplified checklist for relevant criteria
- [OddContrast](https://www.oddcontrast.com/) - oklch-aware contrast checker tool
- [1Password zero-knowledge explanation](https://1password.com/features/zero-knowledge-encryption) - Trust content structure pattern
- [OneTimeSecret](https://onetimesecret.com/en/) - How it works section pattern for secret sharing

### Tertiary (LOW confidence)
- [GitHub issue: Tailwind outline-hidden forced-colors](https://github.com/tailwindlabs/tailwindcss/issues/16926) - Confirms outline-hidden behavior, but single source

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new libraries needed except vitest-axe (well-documented, forked from jest-axe)
- Architecture: HIGH - SPA accessibility patterns are well-established; the codebase changes are additive (attributes, content), not structural
- Pitfalls: HIGH - Well-documented domain; screen reader behavior is the main risk area and patterns are proven
- Color contrast: MEDIUM - oklch values need manual verification; can't be tested in CI
- Trust content: HIGH - Well-established pattern across the industry; content is straightforward copywriting

**Research date:** 2026-02-14
**Valid until:** 2026-03-14 (30 days -- WCAG 2.1 AA is a stable standard; Tailwind 4 utilities are settled)

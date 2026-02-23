# Phase 32: Marketing Homepage + /create Split - Research

**Researched:** 2026-02-22
**Domain:** SPA routing, marketing page layout, mobile navigation patterns, GDPR consent UI, JSON-LD injection
**Confidence:** HIGH — all findings verified against existing codebase; no new external libraries required

## Summary

Phase 32 is entirely a frontend SPA expansion. No new backend routes, no new npm packages, and no schema changes are needed. The work is three discrete operations: (1) move the create-secret form from `/` to `/create` in the router with no functional changes, (2) build a new marketing homepage page module at `/` with three sections (hero, use-cases, email capture), and (3) overhaul the header navigation to include all required links plus a mobile bottom tab bar.

The existing codebase provides all required primitives: the `createLayoutShell()` / `createHeader()` / `createFooter()` system in `client/src/components/layout.ts`, the vanilla-TS DOM-construction pattern, the full Tailwind CSS 4 design token set, the `showToast()` utility for email capture feedback, and the `updatePageMeta()` + `focusPageHeading()` router utilities. The JSON-LD `<script type="application/ld+json">` block already exists verbatim in `client/index.html` — the requirement (HOME-05) is satisfied at build time for all routes including the new homepage, because the SPA serves the same `index.html` for every path. No dynamic JSON-LD injection is needed.

The mobile navigation requirement (iOS-style bottom tab bar) is an explicit user preference that replaces hamburger menus. This is a layout addition, not a replacement of the existing header — the header stays visible on desktop and the bottom bar appears on mobile via responsive Tailwind classes. The GDPR email capture form has no backend wiring in this phase (Phase 36 handles that); the form submits to a local handler that shows a `showToast()` or inline success message and silently drops the data.

**Primary recommendation:** Build all three areas in parallel plans — (A) router + `/create` redirect, (B) homepage page module, (C) nav overhaul — because they touch different files with minimal overlap.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Homepage structure:** Three sections only: Hero → Use Cases → Email Capture. No "How it works" section.
- **Hero primary message angle:** Simplicity and speed — "Share sensitive info in seconds, no account needed"
- **Visual style:** Same glassmorphism aesthetic as the rest of the app; extends the existing design system. Section backgrounds, spacing, and typography follow existing Tailwind CSS 4 design tokens.
- **Email capture GDPR:** Include all applicable consent checkboxes from the start — GDPR checkbox minimum; design for eventual global compliance. Consent checkbox is unchecked by default with clear consent language.
- **Email capture submit behavior:** Show a toast or inline success message — no actual submission, data silently dropped until Phase 36.
- **Navigation links:** Logo + "Create a Secret" + Pricing + Dashboard (dashboard link shows Login when unauthenticated)
- **Desktop nav:** Standard horizontal header nav
- **Mobile nav:** iOS-style bottom tab bar with icon buttons — not a hamburger menu (explicit user preference)
- **JSON-LD:** `WebApplication` JSON-LD block must be injected into `<head>` at `/`

### Claude's Discretion

- Trust/credibility elements on homepage (zero-knowledge callout, badges) — include or omit as appropriate
- Hero visual element (terminal block decoration, animation, purely text)
- CTA button copy
- Email capture placement within the page flow
- Email capture headline/hook copy
- "Create a Secret" nav button visual treatment
- Nav transparency behavior (homepage hero overlay vs. uniform across all routes)
- Use case card/scenario visual format

### Deferred Ideas (OUT OF SCOPE)

- None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| HOME-01 | User lands on marketing homepage at `/` with hero section, zero-knowledge proof points, and CTA | New `home.ts` page module registered at `/` in router; hero section + use-case section with ZK proof points |
| HOME-02 | Create-secret form is accessible at `/create` (moved from `/`) | Router change: `/` → `home.js`, add `/create` → `create.js`; `createLink` in header href updated; no functional changes to `create.ts` |
| HOME-03 | Header navigation updated to include links for `/create`, `/pricing`, and `/dashboard` | `layout.ts` `createHeader()` rewrite + new mobile bottom tab bar component |
| HOME-04 | Marketing homepage includes email capture form widget (UI only; backend in Phase 36) | Email capture section in `home.ts`; GDPR checkbox unchecked by default; `showToast()` on submit |
| HOME-05 | Marketing homepage includes `WebApplication` JSON-LD schema markup | Already present in `client/index.html` static `<script type="application/ld+json">` — served for all SPA routes including `/`; no additional work needed |
</phase_requirements>

---

## Standard Stack

### Core (no new dependencies)

| Library/Tool | Version | Purpose | Status |
|---|---|---|---|
| Vanilla TypeScript | 5.9.x | Page module construction | Already in use |
| Tailwind CSS 4 | @tailwindcss/vite | Design tokens, responsive classes | Already in use |
| Lucide | via `lucide` package | Icons for nav tabs and use-case cards | Already in use |
| `createIcon()` utility | project | Consistent icon sizing + aria | `client/src/components/icons.ts` |
| `showToast()` utility | project | Email capture submit feedback | `client/src/components/toast.ts` |
| `navigate()` | project | SPA navigation | `client/src/router.ts` |
| `updatePageMeta()` | project | SEO meta per route | `client/src/router.ts` |
| `createTerminalBlock()` | project | Hero decorative element (discretion) | `client/src/components/terminal-block.ts` |

**Installation:** None required. No new packages.

---

## Architecture Patterns

### Recommended File Structure Changes

```
client/src/
├── pages/
│   ├── create.ts          # UNCHANGED functionally; stays as-is
│   └── home.ts            # NEW — marketing homepage page module
└── components/
    └── layout.ts          # MODIFIED — header nav overhaul + mobile tab bar
```

### Pattern 1: Page Module Structure

Every page in this project exports a `renderXxxPage(container: HTMLElement)` function. The homepage follows the same pattern:

```typescript
// client/src/pages/home.ts
export function renderHomePage(container: HTMLElement): void {
  const wrapper = document.createElement('div');
  // sections appended in order: hero, use-cases, email-capture
  container.appendChild(wrapper);
}
```

The router calls it as:
```typescript
} else if (path === '/create') {
  updatePageMeta({
    title: 'Create a Secret',
    description: 'Share secrets securely with zero-knowledge encryption...',
  });
  import('./pages/create.js')
    .then((mod) => mod.renderCreatePage(container))
    .then(() => focusPageHeading())
    .catch(() => showLoadError(container));
}
```

And `/` becomes:
```typescript
if (path === '/') {
  updatePageMeta({
    title: 'Torch Secret — Zero-Knowledge Secret Sharing',
    description: 'Share sensitive info in seconds. End-to-end encrypted, one-time view, no accounts needed.',
  });
  import('./pages/home.js')
    .then((mod) => mod.renderHomePage(container))
    .then(() => focusPageHeading())
    .catch(() => showLoadError(container));
```

### Pattern 2: Router Update for /create Route

The existing router `handleRoute()` in `client/src/router.ts` maps paths to page modules via if/else chain. Two changes needed:
- Change the `path === '/'` branch to import `home.js`
- Add `else if (path === '/create')` branch importing `create.js`

The existing "Create" link in `layout.ts` points to `href='/'` and calls `navigate('/')`. Both must be updated to `href='/create'` and `navigate('/create')`. The `updateCreateLink()` visibility function checks `window.location.pathname === '/'` — must change to `/create`.

### Pattern 3: Glassmorphism Section Card

The existing app uses this pattern for content sections:

```typescript
const card = document.createElement('div');
card.className =
  'p-6 rounded-lg border border-border bg-surface/80 backdrop-blur-md shadow-lg';
```

Use-case cards on the homepage follow this established pattern.

### Pattern 4: Navigation Overhaul

The current header (`createHeader()` in `layout.ts`) has:
- Brand mark (logo + wordmark)
- Right side: theme toggle + dashboard link (hidden when unauthenticated) + "Create" link (hidden on create page)

The new nav requires:
- **Desktop:** Logo | [Create a Secret CTA] [Pricing] [Dashboard or Login] [ThemeToggle]
- **Mobile:** Bottom tab bar fixed to viewport bottom with icon buttons for: Home, Create, Pricing, Dashboard/Login

**Mobile bottom tab bar pattern** (iOS-style):
```typescript
// Fixed bottom bar — only visible on mobile (hidden on sm+)
const mobileNav = document.createElement('nav');
mobileNav.className =
  'fixed bottom-0 inset-x-0 z-40 sm:hidden border-t border-border bg-bg/95 backdrop-blur-md safe-area-bottom';

// Tab buttons with icon + label text
const tabItems = [
  { icon: Home, label: 'Home', path: '/' },
  { icon: Plus, label: 'Create', path: '/create' },
  { icon: DollarSign, label: 'Pricing', path: '/pricing' },
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },  // or Login
];
```

The mobile tab bar must listen to `routechange` to highlight the active tab.

**Note:** iOS safe area must be accounted for — `pb-safe` or `padding-bottom: env(safe-area-inset-bottom)` for devices with home indicator.

### Pattern 5: Email Capture Form with GDPR Consent

The registration page (`register.ts`) already establishes the consent text pattern:
```typescript
const consentLine = document.createElement('p');
consentLine.className = 'text-xs text-text-muted text-center';
// "By creating an account, you agree to our Terms..."
```

For the email capture, the GDPR checkbox pattern is:
```typescript
// Checkbox unchecked by default (GDPR requirement)
const gdprCheckbox = document.createElement('input');
gdprCheckbox.type = 'checkbox';
gdprCheckbox.id = 'email-consent';
gdprCheckbox.checked = false; // MUST be unchecked by default
gdprCheckbox.required = true;
// Label: "I agree to receive product updates and marketing emails from Torch Secret.
//         You can unsubscribe at any time."
```

Submit behavior: validate email + consent checkbox checked → call `showToast('Thanks! You\'re on the list.')` → reset form. No API call in Phase 32.

### Pattern 6: JSON-LD at `/` — Already Satisfied

The `client/index.html` contains a static `<script type="application/ld+json">` block in `<head>`:

```html
<script type="application/ld+json" nonce="__CSP_NONCE__">
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "Torch Secret",
    "url": "https://torchsecret.com/",
    ...
  }
</script>
```

The SPA catch-all in `server/src/app.ts` serves this same `index.html` for ALL routes (including `/`). The JSON-LD block is therefore present in the `<head>` of every page view, including `/`. HOME-05 is satisfied by the existing static markup — no dynamic injection is required. Verifiable via `curl https://torchsecret.com/` in production.

### Pattern 7: `#app` Container Width Constraint

The `#app` container in `index.html` has `max-w-2xl` applied (640px max-width). This constrains all page content. For the marketing homepage, this may feel narrow for a hero section. Two options:

**Option A (contained):** Keep `max-w-2xl` — hero and sections sit within the narrow column, consistent with app pages. Simplest; no layout.ts changes needed.

**Option B (full-width hero):** Use negative margin / full-viewport-width techniques (`-mx-4` with `px-4` inside) or restructure the `#app` div's max-width on route change. This is more complex and requires either DOM manipulation or a wider `#app` container on the homepage route.

**Recommendation:** The container is `max-w-2xl mx-auto px-4 py-8` set in `index.html` on `#app`. The cleanest approach for a full-width hero is to use `-mx-4 px-4` on the hero section within the existing container — the hero background spans to the container's padded edge. Given the glassmorphism style matches the rest of the app and the user said "marketing page is not visually distinct from the app shell," **Option A (contained)** is appropriate and avoids container manipulation.

### Anti-Patterns to Avoid

- **Do NOT use `innerHTML`** — the entire codebase uses `textContent` and DOM construction for XSS safety. The homepage is not displaying user data but the convention must be maintained.
- **Do NOT import React, Alpine.js, or any new UI framework** — vanilla TS only.
- **Do NOT modify `create.ts` logic** — only the router mapping changes. The form, encryption, API calls, and confirmation page flow are untouched.
- **Do NOT add `/pricing` page implementation** — Phase 33 handles pricing. Phase 32 only adds the nav link pointing to `/pricing`. If `/pricing` is visited before Phase 33, the router's existing else-branch renders the 404/error page — which is acceptable.
- **Do NOT hard-code colors** — use semantic tokens (`text-text-primary`, `bg-surface`, `border-border`, etc.) only.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toast on email submit | Custom alert system | `showToast()` from `components/toast.ts` | Singleton, aria-live, auto-dismiss, already tested |
| Icon rendering | Raw SVG inline | `createIcon()` from `components/icons.ts` | Handles aria, size variants, stroke-width |
| Terminal decorative block | Custom styled pre | `createTerminalBlock()` from `components/terminal-block.ts` | Already has header bar, copy button, correct styling |
| SPA navigation | `window.location.href` | `navigate()` from `router.ts` | History API, no full reload |
| Meta tag management | Direct `document.title = ...` | `updatePageMeta()` from `router.ts` | Updates all SEO tags atomically |
| Auth state check | Direct fetch to `/api/me` | `authClient.getSession()` with `isSession()` type guard | Consistent session shape, handles errors silently |

---

## Common Pitfalls

### Pitfall 1: Forgetting to Update the "Create" Link href and visibility logic

**What goes wrong:** The existing `createLink` element in `layout.ts` has `href='/'` and hides itself when `window.location.pathname === '/'`. After the route split, "Create" must point to `/create` and hide on `/create` (not `/`).

**Why it happens:** The old `/` was both the homepage and the create form. After the split, `/` is the marketing homepage and should show the "Create" link.

**How to avoid:** In `layout.ts`, update `createLink.href` to `/create`, update the `navigate('/')` call to `navigate('/create')`, and change `updateCreateLink()` to check `pathname === '/create'` (or `/`? — see below).

**Decision needed:** Should the "Create" nav link be hidden when on `/create`? Yes — consistent with current behavior (don't show a nav link to where you already are). Should it also be hidden on `/`? No — the homepage should show the CTA.

**Warning signs:** Nav link shows on create page, or disappears on homepage.

### Pitfall 2: Mobile Bottom Tab Bar Conflicts with Page Content

**What goes wrong:** Fixed bottom bar covers page content. Especially affects the email capture form at the bottom of the homepage and the submit button on the create page.

**Why it happens:** `position: fixed; bottom: 0` sits above scrollable content. On iOS, the home indicator adds extra height below the bar.

**How to avoid:** Add `pb-16 sm:pb-0` (or similar) to `#app` or the body when the mobile nav is visible. The tab bar is `sm:hidden` so padding only applies on mobile. The correct height to account for is the tab bar height (typically `h-16` = 64px) plus safe area inset.

**Warning signs:** Submit buttons clipped on mobile; email form inputs covered.

### Pitfall 3: Homepage Route Treated as NOINDEX

**What goes wrong:** If `/` is accidentally added to `NOINDEX_PREFIXES` in `server/src/app.ts`, the homepage gets `X-Robots-Tag: noindex` from the server side, and the router's `updatePageMeta()` might also add `noindex: true` — blocking search indexing of the marketing page.

**Why it happens:** Pattern-matching errors (e.g., `/` prefix matches everything).

**How to avoid:** The existing `NOINDEX_PREFIXES` list does not include `/` and must not. The homepage router entry must NOT pass `noindex: true` to `updatePageMeta()`. Verify with `curl -I https://torchsecret.com/` — no `X-Robots-Tag` header should appear.

### Pitfall 4: /pricing 404 is Acceptable but Nav Link Must Not Break

**What goes wrong:** Clicking "Pricing" in the nav before Phase 33 renders the error page. This is expected. What would be wrong is if the nav link causes a hard browser reload instead of SPA navigation.

**How to avoid:** The Pricing nav link must use `addEventListener('click', (e) => { e.preventDefault(); navigate('/pricing'); })` — same pattern as all other nav links in `layout.ts`.

### Pitfall 5: Email Consent Checkbox Required Validation

**What goes wrong:** Form submits successfully with consent unchecked (GDPR violation).

**Why it happens:** Browser's native `required` on a checkbox requires the box to be checked for form submission. But since we handle submission manually in a `submit` event listener (not browser-native form submission), the `required` attribute alone may not block submission if the handler doesn't re-check.

**How to avoid:** In the email capture submit handler, explicitly validate `gdprCheckbox.checked` before calling `showToast()`. Show an inline error if unchecked.

### Pitfall 6: routechange Listener Memory Leak in Mobile Tab Bar

**What goes wrong:** Each route navigation re-renders the page module but the layout shell is persistent (created once). If the mobile tab bar is built inside the page module rather than the layout shell, multiple event listeners accumulate.

**How to avoid:** The mobile tab bar MUST be built inside `createLayoutShell()` → `createHeader()` pattern, not inside `renderHomePage()`. It is a persistent layout element, not a per-page element.

---

## Code Examples

### Example 1: Router change — /create and / split

```typescript
// client/src/router.ts — handleRoute() updated
function handleRoute(): void {
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  // ...
  if (path === '/') {
    updatePageMeta({
      title: 'Torch Secret — Zero-Knowledge Secret Sharing',
      description: 'Share sensitive info in seconds, no account needed. End-to-end encrypted, one-time view.',
    });
    import('./pages/home.js')
      .then((mod) => mod.renderHomePage(container))
      .then(() => focusPageHeading())
      .catch(() => showLoadError(container));
  } else if (path === '/create') {
    updatePageMeta({
      title: 'Create a Secret',
      description: 'Share secrets securely with zero-knowledge encryption. One-time view, no accounts.',
    });
    import('./pages/create.js')
      .then((mod) => mod.renderCreatePage(container))
      .then(() => focusPageHeading())
      .catch(() => showLoadError(container));
  } else if (path === '/pricing') {
    updatePageMeta({
      title: 'Pricing',
      description: 'Simple, transparent pricing for Torch Secret.',
      noindex: true, // Phase 33 will set this correctly; for now noindex until page exists
    });
    // Phase 33 will add renderPricingPage — for now fall through to error
    import('./pages/error.js')
      .then((mod) => mod.renderErrorPage(container, 'not_found'))
      .then(() => focusPageHeading())
      .catch(() => showLoadError(container));
  }
  // ... rest of routes unchanged
```

**Note:** `/pricing` routing — two approaches: (A) leave it as the else-branch 404 for now (simplest), or (B) add a stub `/pricing` route entry with noindex that shows the 404/error page explicitly (cleaner for Phase 33 handoff). Option B is recommended.

### Example 2: Email capture section with GDPR consent

```typescript
function createEmailCaptureSection(): HTMLElement {
  const section = document.createElement('section');
  section.setAttribute('aria-labelledby', 'email-capture-heading');
  // ...

  const form = document.createElement('form');
  form.noValidate = true;

  // Email input
  const emailInput = document.createElement('input');
  emailInput.type = 'email';
  emailInput.id = 'email-capture';
  emailInput.required = true;
  emailInput.placeholder = 'you@example.com';
  emailInput.className = 'w-full px-3 py-2 min-h-[44px] border border-border rounded-lg ...';

  // GDPR consent checkbox — MUST be unchecked by default
  const consentWrapper = document.createElement('div');
  consentWrapper.className = 'flex items-start gap-3';

  const consentCheckbox = document.createElement('input');
  consentCheckbox.type = 'checkbox';
  consentCheckbox.id = 'email-consent';
  consentCheckbox.checked = false;  // unchecked by default — GDPR requirement

  const consentLabel = document.createElement('label');
  consentLabel.htmlFor = 'email-consent';
  consentLabel.className = 'text-xs text-text-muted';
  consentLabel.textContent =
    'I agree to receive product updates and marketing emails from Torch Secret. ' +
    'You can unsubscribe at any time.';

  // Submit handler — no API call, just toast
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!emailInput.value.trim()) {
      showInlineError(errorEl, 'Please enter your email address.');
      return;
    }
    if (!consentCheckbox.checked) {
      showInlineError(errorEl, 'Please check the consent box to continue.');
      return;
    }
    // Phase 36 wires backend — for now: show success and reset
    showToast('Thanks! You\'re on the list.');
    form.reset();
  });

  // ...
  return section;
}
```

### Example 3: Mobile bottom tab bar structure

```typescript
// Inside createLayoutShell() or a new createMobileNav() helper in layout.ts
function createMobileNav(): HTMLElement {
  const nav = document.createElement('nav');
  nav.id = 'mobile-tab-bar';
  nav.setAttribute('aria-label', 'Main navigation');
  nav.className =
    'fixed bottom-0 inset-x-0 z-40 sm:hidden border-t border-border bg-bg/95 backdrop-blur-md';

  const inner = document.createElement('div');
  inner.className = 'flex items-center justify-around h-16';
  // Safe area: add pb-[env(safe-area-inset-bottom)] if targeting iOS PWA
  nav.style.paddingBottom = 'env(safe-area-inset-bottom)';

  const tabs = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: Plus, label: 'Create', path: '/create' },
    { icon: Tag, label: 'Pricing', path: '/pricing' },
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  ];

  for (const tab of tabs) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className =
      'flex flex-col items-center gap-0.5 min-w-[56px] py-2 text-text-muted hover:text-accent transition-colors';
    btn.setAttribute('aria-label', tab.label);

    btn.appendChild(createIcon(tab.icon, { size: 'sm' }));
    const labelEl = document.createElement('span');
    labelEl.className = 'text-[10px] font-medium';
    labelEl.textContent = tab.label;
    btn.appendChild(labelEl);

    btn.addEventListener('click', () => navigate(tab.path));
    inner.appendChild(btn);
  }

  nav.appendChild(inner);

  // Active state: highlight current tab on routechange
  window.addEventListener('routechange', () => {
    // update active tab styling based on window.location.pathname
  });

  return nav;
}
```

### Example 4: Hero section structure

```typescript
function createHeroSection(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'py-12 sm:py-16 text-center space-y-6';

  const heading = document.createElement('h1');
  heading.className =
    'text-3xl sm:text-4xl font-heading font-semibold text-text-primary leading-tight';
  heading.textContent = 'Share sensitive info in seconds';

  const subhead = document.createElement('p');
  subhead.className = 'text-lg text-text-secondary max-w-md mx-auto';
  subhead.textContent =
    'No account needed. End-to-end encrypted. Self-destructs after one view.';

  const ctaBtn = document.createElement('a');
  ctaBtn.href = '/create';
  ctaBtn.className =
    'inline-flex items-center gap-2 px-6 py-3 min-h-[44px] rounded-lg bg-accent text-white font-semibold hover:bg-accent-hover focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg focus:outline-hidden transition-all motion-safe:hover:scale-[1.02] cursor-pointer';
  ctaBtn.textContent = 'Create a Secret';
  ctaBtn.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/create');
  });

  // Optional: terminal-block decoration (Claude's discretion)
  // createTerminalBlock(exampleContent, { headerTitle: 'example.txt' })

  section.appendChild(heading);
  section.appendChild(subhead);
  section.appendChild(ctaBtn);
  return section;
}
```

---

## Key Implementation Decisions

### Decision 1: `/pricing` stub in router

Phase 33 adds the pricing page. Phase 32 adds the nav link. The router currently has no `/pricing` entry — hitting it falls through to the 404 else-branch. **Add a stub `/pricing` else-if entry** in the router that renders the error/not-found page explicitly with a noindex flag. This is cleaner than falling through and prepares the slot for Phase 33 to swap in `renderPricingPage`.

### Decision 2: Homepage uses the existing `max-w-2xl` container

The `#app` div in `index.html` constrains content to `max-w-2xl` (640px). The marketing homepage will use this same width — consistent with the glassmorphism design that runs throughout the app. This avoids any container-width manipulation and aligns with the locked decision that "marketing page is not visually distinct from the app shell."

### Decision 3: "Dashboard" vs "Login" in nav

The existing `dashboardLink` in `layout.ts` already implements auth-reactive visibility: it calls `authClient.getSession()` on `routechange` and toggles visibility. Phase 32 extends this to: show "Dashboard" when authenticated, show "Login" (pointing to `/login`) when unauthenticated. The current code hides the dashboard link entirely when unauthenticated — change to swap link text and destination instead.

### Decision 4: `How It Works` section from create.ts

`create.ts` currently renders a `createHowItWorksSection()` and `createWhyTrustUsSection()` below the form. After moving the form to `/create`, these trust sections on the create page become optional. The homepage's "Use Cases" section replaces them at `/`. The planner should decide whether to keep `createHowItWorksSection()` on the create page or remove it — **recommendation: keep it on `/create` for now**, since it reinforces trust at the decision point. The homepage "Use Cases" section is distinct (job-aware scenarios, not a how-it-works tutorial).

### Decision 5: Mobile tab bar body padding

The mobile tab bar is `h-16` (64px) fixed at the bottom. The `#app` div needs `pb-16 sm:pb-0` added to prevent content cutoff on mobile. This must be done in `layout.ts` when the mobile nav is created, applied to `#app` via `document.getElementById('app')`.

---

## State of the Art

| Old Approach | Current Approach | Relevance |
|---|---|---|
| Hamburger menu for mobile nav | iOS-style bottom tab bar | User explicitly chose bottom tab bar; this is the current mobile UX standard for app-like experiences |
| Single-page (form + everything at `/`) | Route split (`/` = marketing, `/create` = form) | Standard SaaS pattern: marketing site separate from app entry point |
| JSON-LD injected dynamically by SPA router | JSON-LD in static HTML `<head>` | For an SPA, static JSON-LD in the HTML shell is crawlable without JS execution; Google can crawl it |

---

## Open Questions

1. **Should "Create a Secret" nav link be hidden when on the homepage (`/`)?**
   - What we know: The current "Create" link hides when on the create page. The homepage is now a separate destination.
   - What's unclear: Should the CTA appear in the nav when you're already on the homepage? One view: yes, always show it (it's the primary action). Another view: the homepage hero already has a CTA button, so the nav link is redundant.
   - Recommendation: Show "Create a Secret" in the nav on all pages including the homepage — it's the primary CTA and the hero CTA is a larger in-page button. The nav link provides persistent access.

2. **Which Lucide icons for mobile tab bar?**
   - What we know: Lucide is already imported. Icons for: Home, Create, Pricing, Dashboard/Login.
   - Candidates: `Home`, `Plus` or `PenLine`, `Tag` or `CreditCard`, `LayoutDashboard` or `User`
   - Recommendation: `Home`, `PenLine` (Create a Secret), `CreditCard` (Pricing), `LayoutDashboard` (Dashboard) / `LogIn` (Login when unauthenticated). These are distinctive enough to be immediately recognizable.

3. **How many use-case cards in the Use Cases section?**
   - What we know: Job-aware scenarios (passwords, API keys, sensitive notes). No fixed count specified.
   - Recommendation: 3 cards — enough to convey variety without overwhelming. 3-column grid on desktop, stacked on mobile.

---

## Sources

### Primary (HIGH confidence — verified against codebase)

- `client/src/router.ts` — complete route table, `updatePageMeta()`, `focusPageHeading()`, `navigate()` patterns
- `client/src/components/layout.ts` — `createLayoutShell()`, `createHeader()`, auth-reactive nav, `routechange` listener pattern
- `client/src/components/toast.ts` — `showToast()` API, aria-live, singleton container
- `client/src/components/terminal-block.ts` — `createTerminalBlock()` API, options
- `client/src/components/icons.ts` — `createIcon()`, `ICON_SIZES`, `CreateIconOptions`
- `client/src/styles.css` — all Tailwind CSS 4 design tokens (complete token inventory)
- `client/index.html` — existing JSON-LD block, `#app` container classes, `<head>` structure
- `server/src/app.ts` — SPA catch-all, NOINDEX_PREFIXES, CSP nonce injection
- `client/src/pages/create.ts` — full create page module (confirms what stays untouched)
- `client/src/pages/register.ts` — consent line pattern (verified approach for GDPR text)
- `.planning/phases/32-marketing-homepage-create-split/32-CONTEXT.md` — locked decisions and discretion areas

### Secondary (MEDIUM confidence)

- iOS safe area inset pattern: `env(safe-area-inset-bottom)` for bottom tab bars — standard CSS environment variable, well-supported in Safari and Chrome on iOS devices

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, all primitives already in codebase
- Architecture: HIGH — patterns directly extracted from existing page modules and layout component
- Pitfalls: HIGH — identified from direct code inspection (nav link hrefs, container widths, NOINDEX_PREFIXES)
- Mobile nav: MEDIUM — pattern is standard but specific CSS values (safe area, heights) may need minor tuning

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (stable; no external library dependencies)

---
phase: 32-marketing-homepage-create-split
verified: 2026-02-22T00:00:00Z
status: passed
score: 5/5 success criteria verified
re_verification: false
---

# Phase 32: Marketing Homepage + /create Split — Verification Report

**Phase Goal:** Users arrive at `/` and see a marketing landing page that explains Torch Secret's zero-knowledge model; the create-secret form lives at `/create` and is unaffected in functionality.
**Verified:** 2026-02-22
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Navigating to `/` shows a hero section with headline, subhead, and CTA button — no secret creation textarea is present on the homepage | VERIFIED | `router.ts` line 179: `path === '/'` branch imports `home.js` and calls `renderHomePage`; `home.ts` exports `renderHomePage` with H1 "Share sensitive info in seconds" (line 51), subhead (line 57), CTA `<a href="/create">` (line 62). No textarea in `home.ts` — the file contains zero form elements with type=textarea. |
| 2 | Navigating to `/create` shows the fully functional secret creation form (same behavior as the former `/` page) | VERIFIED | `router.ts` line 189: `else if (path === '/create')` branch imports `create.js` and calls `renderCreatePage`. `create.ts` exports `renderCreatePage` at line 963 — unchanged from pre-Phase 32. Commit `472291b` moved only the routing; `create.ts` was not modified. |
| 3 | The header navigation includes links to `/create`, `/pricing`, and `/dashboard` and these links work from every SPA route | VERIFIED | `layout.ts`: Pricing link (`hidden sm:block`, navigates to `/pricing`, line 99), auth link `nav-auth-link` (Dashboard/Login swap via `updateAuthLink()`, lines 165–186), Create a Secret CTA `nav-create-link` (navigates to `/create`, line 125). All three use `navigate()` from `router.ts`. Mobile tab bar has all four tabs: Home (/), Create (/create), Pricing (/pricing), Dashboard (/dashboard) at lines 220–223. |
| 4 | The homepage includes an email capture form widget (UI visible; submission wired in Phase 36) | VERIFIED | `home.ts` `createEmailCaptureSection()` at line 219: email input, submit button, GDPR consent checkbox (`consentCheckbox.checked = false` explicit at line 286), inline error element with `role="alert"`, `showToast()` call at line 340 on valid submission. Form validates empty email and unchecked consent before proceeding. Phase 36 backend wiring is explicitly deferred per plan — UI is complete. |
| 5 | Viewing page source or curl output for `/` includes a `WebApplication` JSON-LD script block in the `<head>` | VERIFIED | `client/index.html` line 41: `<script type="application/ld+json" nonce="__CSP_NONCE__">` with `"@type": "WebApplication"`, `"name": "Torch Secret"`, `"applicationCategory": "SecurityApplication"`. The SPA serves the same `index.html` for all routes including `/` — JSON-LD is always present. The `/` route has no `noindex` flag in `updatePageMeta()` call (lines 180–184), so canonical and indexability are preserved. |

**Score:** 5/5 success criteria verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `client/src/router.ts` | Updated route table: `/` → home.js, `/create` → create.js, `/pricing` stub | VERIFIED | Line 179: `/` → `home.js` (no noindex); line 189: `/create` → `create.js`; line 199: `/pricing` → `error.js` (noindex: true). 316 lines, fully substantive. |
| `client/src/pages/home.ts` | `renderHomePage(container)` — marketing homepage with 4 sections; min 150 lines | VERIFIED | 346 lines. Exports `renderHomePage` at line 24. Four sections: hero, trust strip, use cases (3 cards), email capture. No `innerHTML`. Imports `showToast`, `navigate`, `createIcon`. |
| `client/src/components/layout.ts` | Updated `createLayoutShell()` with new desktop header nav + `createMobileNav()` bottom tab bar | VERIFIED | 314 lines. `createMobileNav()` at line 207, `id="mobile-tab-bar"`, `sm:hidden`. Desktop header: `nav-create-link` (line 119), `nav-auth-link` (line 106), Pricing link (line 92). Footer gets `mb-16 sm:mb-0` (line 39). `#app` gets `pb-16 sm:pb-0` (line 52). |
| `client/index.html` | WebApplication JSON-LD in `<head>` | VERIFIED | Line 41–57: `<script type="application/ld+json">` with `@type: WebApplication`. Pre-existing from prior phases, confirmed present. |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `client/src/router.ts` | `client/src/pages/home.js` | Dynamic import in `/` branch | WIRED | Line 185: `import('./pages/home.js').then((mod) => mod.renderHomePage(container))` |
| `client/src/router.ts` | `client/src/pages/create.js` | Dynamic import in `/create` branch | WIRED | Line 195: `import('./pages/create.js').then((mod) => mod.renderCreatePage(container))` |
| `client/src/pages/home.ts` | `client/src/router.ts` | `export function renderHomePage` consumed by router | WIRED | `renderHomePage` exported at line 24; dynamically imported by router at `/` branch. |
| `client/src/pages/home.ts` | `client/src/components/toast.ts` | `showToast()` call on valid email capture submit | WIRED | Import at line 17; `showToast()` called at line 340 inside submit handler after email + consent validation. |
| `client/src/pages/home.ts` | `client/src/router.ts` | `navigate('/create')` in hero CTA click handler | WIRED | Line 70: `navigate('/create')` inside `click` event listener on CTA anchor. |
| `client/src/components/layout.ts` | `client/src/router.ts` | `navigate('/create')`, `navigate('/pricing')`, `navigate('/login')`, `navigate('/dashboard')` | WIRED | Lines 99, 125, 170, 177, 185: all nav click handlers use `navigate()`. |
| `client/src/components/layout.ts` | `window routechange event` | `updateCreateLink()` and mobile tab active state listener | WIRED | Lines 190–191: `window.addEventListener('routechange', updateCreateLink)` and `window.addEventListener('routechange', () => { void updateAuthLink(); })`. Line 267: `window.addEventListener('routechange', updateActiveTabs)` for mobile tab bar. |
| `client/src/app.ts` | `client/src/components/layout.ts` | `createLayoutShell()` called before `initRouter()` | WIRED | `app.ts` line 20: `createLayoutShell()` then line 21: `initRouter()` — correct order ensures routechange listener is registered before first dispatch. |

---

## Requirements Coverage

| Requirement | Description | Source Plans | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| HOME-01 | User lands on marketing homepage at `/` with hero section, zero-knowledge proof points | 32-02, 32-04 | SATISFIED | `home.ts` hero section (H1, subhead, CTA) + trust strip (3 ZK proof points: AES-256-GCM, Zero-Knowledge, Self-Destructs). Note: REQUIREMENTS.md text says "How It Works section" but RESEARCH.md locked user decision explicitly removed "How It Works" from the homepage; ROADMAP success criterion SC1 does not require it. The trust strip + use-cases cards satisfy the "zero-knowledge proof points" intent. |
| HOME-02 | Create-secret form is accessible at `/create` (moved from `/`) | 32-01, 32-04 | SATISFIED | Router `/create` branch (line 189) imports `create.js` calling `renderCreatePage`. `create.ts` line 963 exports `renderCreatePage` — unchanged functionally. |
| HOME-03 | Header navigation updated to include links for `/create`, `/pricing`, and `/dashboard` | 32-03, 32-04 | SATISFIED | Desktop header: Pricing link, Dashboard/Login auth link, Create a Secret CTA, ThemeToggle. Mobile bottom tab bar: Home, Create, Pricing, Dashboard tabs with `routechange`-driven active state. |
| HOME-04 | Marketing homepage includes email capture form widget (UI wired to backend in ECAP phase) | 32-02, 32-04 | SATISFIED | `createEmailCaptureSection()` in `home.ts`: email input, submit button, GDPR consent checkbox (unchecked by default), inline error on invalid, toast on valid. Backend deferred to Phase 36 per plan. |
| HOME-05 | Marketing homepage includes `WebApplication` JSON-LD schema markup | 32-01, 32-04 | SATISFIED | `client/index.html` lines 41–57: `<script type="application/ld+json">` with `@type: WebApplication`. No noindex on `/` route, so the page is indexable with the JSON-LD intact. |

**Orphaned requirements:** None. All five HOME-01 through HOME-05 requirements mapped to Phase 32 in REQUIREMENTS.md are claimed by at least one plan and verified with implementation evidence.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `client/src/pages/home.ts` | 339 | `// Phase 36 wires the backend. For now: show success and reset.` | Info | Intentional deferred wiring — the plan and RESEARCH.md explicitly scope email backend to Phase 36. Form UI is complete; data is silently dropped. No functional regression. |
| `client/src/router.ts` | 205 | `// Phase 33 replaces this with renderPricingPage` | Info | Intentional stub — `/pricing` renders `not_found` with `noindex: true`. Matches plan specification. Phase 33 owns replacement. |

No blocker or warning anti-patterns found. Both flagged items are intentional, documented scope deferments.

---

## Human Verification Required

The following items were confirmed during Plan 04 human checkpoint (UAT completed 2026-02-23):

1. **Mobile bottom tab bar active state**
   - Test: Navigate between routes on 375px viewport; verify active tab highlights on each route change.
   - Expected: Active tab shows `text-accent`; inactive tabs show `text-text-muted`.
   - Confirmed by: Human UAT in Plan 04 (Task 2, verification step 7).

2. **GDPR form interaction flow**
   - Test: (a) Submit with empty email — inline error; (b) valid email + unchecked consent — inline error; (c) valid email + checked consent — toast success + form reset.
   - Expected: All three states behave correctly.
   - Confirmed by: Human UAT in Plan 04 (Task 2, verification steps 4a–4c). Footer clipping bug found and fixed (`mb-16 sm:mb-0` in commit `0fda1dc`).

3. **Mobile content not clipped by tab bar**
   - Test: Scroll to bottom of homepage on 375px; confirm email form and footer are fully visible.
   - Expected: No content obscured by 64px fixed tab bar.
   - Confirmed by: Human UAT in Plan 04 (footer clipping fix verified after `0fda1dc`).

---

## Commit Verification

All phase commits verified in git log:

| Commit | Type | Content |
|--------|------|---------|
| `472291b` | feat | Router split: `/` → home.js, `/create` → create.js, `/pricing` stub |
| `4a48e6f` | feat | `home.ts` created: hero, trust strip, use-cases, email capture (346 lines) |
| `e62e0c4` | feat | Desktop header nav overhaul: Pricing + Dashboard/Login + Create a Secret CTA |
| `d3c8db7` | feat | `createMobileNav()` iOS-style bottom tab bar with 4 tabs |
| `0fda1dc` | fix | Footer `mb-16 sm:mb-0` — fixes mobile tab bar clipping of footer content |

---

## Gaps Summary

No gaps. All five ROADMAP success criteria are verified with concrete code evidence. All five HOME requirement IDs are satisfied. No orphaned requirements. No blocker anti-patterns.

**Note on HOME-01 "How It Works" wording in REQUIREMENTS.md:** The REQUIREMENTS.md text for HOME-01 mentions "How It Works section." This wording predates the Phase 32 RESEARCH.md locked user decision that explicitly removed a "How It Works" section from the homepage scope ("Three sections only: Hero → Use Cases → Email Capture. No 'How it works' section."). The ROADMAP success criterion SC1 does not include "How It Works." The RESEARCH.md phase requirements table for HOME-01 restates the requirement as "hero section, zero-knowledge proof points, and CTA" — matching what was implemented. The trust strip (3 ZK proof points) and use-cases section satisfy the ZK proof point intent. This is a REQUIREMENTS.md wording lag, not an implementation gap.

---

_Verified: 2026-02-22_
_Verifier: Claude (gsd-verifier)_

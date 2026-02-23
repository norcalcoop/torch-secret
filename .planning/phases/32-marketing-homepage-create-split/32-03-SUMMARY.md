---
phase: 32-marketing-homepage-create-split
plan: "03"
subsystem: frontend/layout
tags: [navigation, mobile, layout, header, tab-bar]
dependency_graph:
  requires: []
  provides: [layout-nav-overhaul, mobile-tab-bar]
  affects: [client/src/components/layout.ts, all SPA routes]
tech_stack:
  added: []
  patterns:
    - "iOS-style mobile bottom tab bar with fixed positioning outside flex column"
    - "Auth-reactive nav link that swaps text+href on session state change"
    - "sm:block + hidden Tailwind pattern for desktop-only nav items"
key_files:
  created: []
  modified:
    - client/src/components/layout.ts
decisions:
  - "Mobile nav always shows 'Dashboard' tab (not 'Login') — the dashboard page session guard handles auth redirect, keeping mobile nav simple and leak-free"
  - "updateCreateLink() toggles sm:block (not the hidden class) to preserve desktop-only visibility while allowing /create-page suppression"
  - "Pricing + Dashboard/Login links use hidden sm:block base class — mobile tab bar handles mobile nav, desktop header handles sm+"
  - "document.body.appendChild(mobileNav) places tab bar outside the flex column to avoid layout interference with fixed positioning"
metrics:
  duration: "175 seconds"
  completed: "2026-02-23"
  tasks_completed: 2
  files_modified: 1
---

# Phase 32 Plan 03: Navigation Overhaul + Mobile Tab Bar Summary

**One-liner:** Full nav header (Pricing, Dashboard/Login, Create a Secret CTA, ThemeToggle) plus iOS-style fixed mobile bottom tab bar with routechange-driven active state.

## What Was Built

### Task 1: Desktop Header Nav Overhaul (`createHeader`)

Rewrote the right-side nav container in `createHeader()` with four elements in order:

1. **Pricing link** (`hidden sm:block text-sm text-text-secondary hover:text-accent`) — desktop-only, navigates to `/pricing` via SPA
2. **Dashboard/Login link** (`id="nav-auth-link"`) — starts as "Login" (safe default), updates to "Dashboard" after session resolves via `updateAuthLink()`. Uses `authLink.onclick` reassignment (not `removeEventListener`) for clean handler swaps.
3. **Create a Secret CTA** (`id="nav-create-link"`) — accent-styled button (`bg-accent text-white rounded-lg`), hidden on `/create` route via `updateCreateLink()`, visible everywhere else
4. **ThemeToggle** — unchanged position (rightmost)

Key behavior: `updateCreateLink()` now checks `pathname === '/create'` (not `'/'`) and manages desktop visibility by toggling `sm:block` class rather than the `hidden` class — preserving the `hidden sm:block` base that keeps these items off mobile where the tab bar handles navigation.

### Task 2: `createMobileNav()` — iOS-Style Bottom Tab Bar

Added a new `createMobileNav()` function that builds a `<nav id="mobile-tab-bar">` element with:

- Fixed bottom positioning (`fixed bottom-0 inset-x-0 z-40 sm:hidden`)
- iOS safe area support (`nav.style.paddingBottom = 'env(safe-area-inset-bottom)'`)
- Glassmorphism surface (`bg-bg/95 backdrop-blur-md border-t border-border`)
- 4 tabs: Home (/) | Create (/create) | Pricing (/pricing) | Dashboard (/dashboard)
- Each tab: icon (16px Lucide) + label text (10px)
- `routechange` event listener drives active state (text-accent vs text-text-muted)

Mounted via `document.body.appendChild(mobileNav)` in `createLayoutShell()` — outside the flex column so fixed positioning works without layout interference.

Bottom padding (`pb-16 sm:pb-0`) added to `#app` element to prevent page content from being obscured by the tab bar on mobile.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed updateCreateLink() desktop-only visibility**
- **Found during:** Task 2 implementation review
- **Issue:** Original updateCreateLink() called `classList.toggle('hidden', isCreatePage)` which removed the `hidden` class when not on /create — making the CTA button visible on mobile (all breakpoints), defeating the desktop-only `hidden sm:block` base class pattern
- **Fix:** Changed to toggle `sm:block` instead: on /create remove `sm:block` (so `hidden` dominates all viewports); off /create add `sm:block` (so media query overrides `hidden` on sm+)
- **Files modified:** client/src/components/layout.ts
- **Commit:** d3c8db7

## Self-Check: PASSED

- FOUND: client/src/components/layout.ts
- FOUND: e62e0c4 (Task 1 commit)
- FOUND: d3c8db7 (Task 2 commit)

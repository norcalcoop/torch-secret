---
status: resolved
trigger: "switching to light theme makes a lot of text invisible/not visible in the UI"
created: 2026-02-22T00:00:00Z
updated: 2026-02-22T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — protection panel in create.ts uses hardcoded text-white/text-white/40/text-white/60 classes for text inside a bg-surface/80 container
test: Searched all client source for text-white usage; identified all non-accent-background instances
expecting: White text on near-white surface in light mode = invisible text
next_action: DONE — root cause found and documented

## Symptoms

expected: Text should be visible in light theme mode
actual: Switching to light theme makes a lot of text invisible/not visible
errors: (none reported — visual bug)
reproduction: Toggle theme to "light" mode in UI; look at the protection panel (No protection / Generate password / Custom password / Passphrase tabs)
started: Phase 28 introduced it; first discovered/reported during Phase 31 UAT

## Eliminated

- hypothesis: styles.css color tokens broken or missing light-mode definitions
  evidence: styles.css has complete :root (light) and .dark blocks; no changes in Phase 31 commits; CSS diff shows no changes to this file
  timestamp: 2026-02-22

- hypothesis: vite.config.ts Lucide alias removal broke Tailwind CSS processing
  evidence: The removed alias only affected JS module resolution (lucide -> lucide/dist/esm/lucide/src/lucide.js); no CSS plugins were added or removed; tailwindcss() plugin unchanged
  timestamp: 2026-02-22

- hypothesis: @custom-variant dark declaration broken
  evidence: Tailwind CSS 4 docs confirm "@custom-variant dark (&:where(.dark, .dark *));" is the correct class-based dark mode syntax; theme.ts correctly toggles .dark class on <html>
  timestamp: 2026-02-22

- hypothesis: Phase 31 introduced new CSS issues
  evidence: git log -- client/src/styles.css shows no commits from Phase 31; git diff HEAD~5..HEAD -- client/src/styles.css shows empty output (no changes)
  timestamp: 2026-02-22

## Evidence

- timestamp: 2026-02-22
  checked: client/src/styles.css
  found: Complete :root (light) and .dark (dark) CSS custom property blocks; @theme inline mapping works correctly; no changes in Phase 31
  implication: CSS token system is correct; light mode token values are properly defined

- timestamp: 2026-02-22
  checked: vite.config.ts diff (commit 03da3a9)
  found: Only removed resolve.alias for lucide; no Tailwind-related changes
  implication: Phase 31 did not affect CSS build pipeline

- timestamp: 2026-02-22
  checked: client/src/pages/create.ts — createProtectionPanel() function
  found: 9 instances of text-white/40, text-white/60, text-white, border-white/10 used for non-accent-background text elements inside the protection panel (bg-surface/80 container)
  implication: These hardcoded white values look fine in dark mode (dark surface, white text) but become invisible in light mode (light/white surface, white text)

- timestamp: 2026-02-22
  checked: git log -- client/src/pages/create.ts
  found: Protection panel introduced in Phase 28 commits (feat(28-02) and feat(28-03)); predates Phase 31
  implication: Pre-existing bug, not introduced by Phase 31; first exposed during Phase 31 UAT when tester switched to light mode

## Resolution

root_cause: >
  client/src/pages/create.ts — createProtectionPanel() function uses hardcoded
  text-white, text-white/40, text-white/60, and border-white/10 Tailwind classes
  for text and borders INSIDE a bg-surface/80 container. In dark mode, bg-surface/80
  resolves to a very dark purple (#222240 at 80% opacity), making white text visible.
  In light mode, bg-surface/80 resolves to nearly white (#ffffff at 80% opacity),
  making white text invisible against the white background.

  Affected lines in client/src/pages/create.ts:
  - Line 275: createCheckbox label — text-white/60 → should be text-text-muted or text-text-secondary
  - Line 290: tabList border — border-white/10 → should be border-border
  - Line 301: tabInactiveCls — text-white/40 + hover:text-white/70 → should be text-text-muted + hover:text-text-secondary
  - Line 303: tabActiveCls — text-white + hover:text-white/70 → should be text-text-primary + hover:text-text-secondary
  - Line 356: noneNote — text-white/40 → should be text-text-muted
  - Line 371: tierLabel — text-white/60 → should be text-text-secondary
  - Line 436: entropyLine — text-white/40 → should be text-text-muted
  - Line 559: genStateLabel initial — text-white/40 → should be text-text-muted
  - Line 779: genStateLabel reset — text-white/40 → should be text-text-muted

fix: Replace all hardcoded text-white/N and border-white/N classes inside the protection panel with semantic design token equivalents (text-text-primary, text-text-secondary, text-text-muted, border-border) that correctly resolve via CSS custom properties in both light and dark modes.

verification: Toggle to light mode and verify protection panel tab labels, checkbox labels, hint text, strength label, entropy line, and password state label are all legible.

files_changed:
  - client/src/pages/create.ts

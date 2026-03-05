---
phase: 50-documentation-updates
plan: 01
subsystem: ui
tags: [privacy, security, email, documentation, mailto]

# Dependency graph
requires:
  - phase: 49-gmail-send-mail-as
    provides: "Gmail aliases live — security@ and privacy@ now receive mail"
provides:
  - "SECURITY.md with security@torchsecret.com as email alternative for vulnerability reports"
  - "Privacy Policy /privacy page with privacy@torchsecret.com as clickable mailto link"
affects: [51-public-repo, 52-launch-checklist]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Manual section intercept in privacy.ts render loop: heading === 'Your Rights' guard + continue skips generic path, section order preserved"
    - "createElement/appendChild only for all DOM construction — no innerHTML anywhere in privacy.ts (CSP hygiene)"

key-files:
  created: []
  modified:
    - SECURITY.md
    - client/src/pages/privacy.ts

key-decisions:
  - "Your Rights section intercepted in render loop rather than extracting it from sections array — preserves section order without changing data model"
  - "security@ and privacy@ are distinct aliases — SECURITY.md uses only security@, privacy.ts uses only privacy@"

patterns-established:
  - "Inline section override pattern: for loops in privacy.ts can intercept specific headings by name and continue to skip generic render path"

requirements-completed: [ADOC-01, ADOC-02]

# Metrics
duration: 2min
completed: 2026-03-05
---

# Phase 50 Plan 01: Documentation Updates Summary

**SECURITY.md security@torchsecret.com fallback + Privacy Policy privacy@torchsecret.com clickable mailto link via DOM construction**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-05T12:47:14Z
- **Completed:** 2026-03-05T12:54:01Z
- **Tasks:** 3 of 3 (complete)
- **Files modified:** 2

## Accomplishments
- Added `security@torchsecret.com` as email fallback in SECURITY.md Reporting a Vulnerability section (GitHub advisory link preserved as primary)
- Replaced plain-text `contact@torchsecret.com` in the Privacy Policy Your Rights section with a `mailto:privacy@torchsecret.com` anchor element built via `createElement` (no `innerHTML`)
- Lint passes with zero errors; section order preserved (Cookies → Your Rights → Changes to This Policy → Contact)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add security@torchsecret.com to SECURITY.md** - `558e35f` (docs)
2. **Task 2: Add privacy@torchsecret.com mailto link in Privacy Policy Your Rights section** - `5884473` (feat)
3. **Task 3: Verify both contact addresses render correctly** - `204b5bd` (docs — human approval)

**Plan metadata:** _(final docs commit)_

## Files Created/Modified
- `SECURITY.md` - Added email alternative line after GitHub advisory link in Reporting a Vulnerability section
- `client/src/pages/privacy.ts` - Your Rights section now intercepts generic render loop and produces a real `<a href="mailto:privacy@torchsecret.com">` element

## Decisions Made
- `Your Rights` section intercepted by heading name in the render loop (`if (heading === 'Your Rights') { ... continue; }`) rather than removing it from the `sections` array — this preserves section order without restructuring the data model
- `security@` used only in SECURITY.md; `privacy@` used only in privacy.ts — each alias routed to its correct contact channel

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Self-Check: PASSED

- `SECURITY.md` exists and contains `security@torchsecret.com`: confirmed (commit 558e35f)
- `client/src/pages/privacy.ts` contains `mailto:privacy@torchsecret.com`: confirmed (commit 5884473)
- No `innerHTML` in privacy.ts: confirmed
- Human verification approved by user

## Next Phase Readiness

- Phase 50 Plan 01 complete. Requirements ADOC-01 and ADOC-02 satisfied.
- Phase 51 (public repo preparation) and Phase 52 (launch checklist audit) can proceed.

---
*Phase: 50-documentation-updates*
*Completed: 2026-03-05*

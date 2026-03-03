---
phase: 41-update-readme-and-stale-documentation-for-torch-secret-v5-0-launch
plan: 01
subsystem: infra
tags: [changelog, versioning, keep-a-changelog, semver]

# Dependency graph
requires: []
provides:
  - CHANGELOG.md back-filled with v4.0.0 and v5.0.0 entries
  - package.json version at 5.0.0
affects: [readme, contributing, security]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - CHANGELOG.md
    - package.json

key-decisions:
  - "norcalcoop/secureshare repo URL preserved in comparison links as-is — Plan 02 will sweep all occurrences in a single pass"
  - "v5.0.0 date set to 2026-03-02 (today); v4.0.0 date set to 2026-02-22 (account model milestone ship date)"

patterns-established:
  - "Keep a Changelog 1.1.0 format with Added/Changed subsections per version; comparison links at file bottom"

requirements-completed: [CHANGELOG_V4, CHANGELOG_V5, PKG_VERSION]

# Metrics
duration: 2min
completed: 2026-03-02
---

# Phase 41 Plan 01: CHANGELOG Back-fill and Version Bump Summary

**CHANGELOG back-filled with v4.0.0 (Better Auth + Stripe billing) and v5.0.0 (Torch Secret rebrand + OAuth + marketing) entries; package.json bumped to 5.0.0**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-02T14:03:48Z
- **Completed:** 2026-03-02T14:05:15Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added [5.0.0] section covering rebrand to Torch Secret, Google/GitHub OAuth, marketing homepage, pricing page, Express SSR SEO pages, GDPR email capture, Loops onboarding, PostHog enrichment, security hardening, and Infisical secrets management
- Added [4.0.0] section covering Better Auth user accounts, secret dashboard, EFF Diceware passphrase generator, tier enforcement, PostHog analytics, email notifications, Stripe Pro billing, rate-limit conversion prompts, and legal pages
- Updated comparison links to include all five versions ([Unreleased], [5.0.0], [4.0.0], [3.0.0], [2.0.0], [1.0.0])
- Bumped package.json version from 4.0.0 to 5.0.0

## Task Commits

Each task was committed atomically:

1. **Task 1: Back-fill CHANGELOG.md with v4.0 and v5.0 entries** - `c9af83c` (feat)
2. **Task 2: Bump package.json version to 5.0.0** - `9540a11` (chore)

## Files Created/Modified

- `CHANGELOG.md` - Added 46 new lines: [5.0.0] and [4.0.0] sections + updated comparison links; existing v1.0-v3.0 content unchanged
- `package.json` - Single-field change: version "4.0.0" -> "5.0.0"

## Decisions Made

- norcalcoop/secureshare repo URL preserved in all comparison links per plan instruction — Plan 02 will sweep and replace all 10 occurrences across 5 files in a single pass
- v5.0.0 release date set to 2026-03-02 (current date); v4.0.0 set to 2026-02-22 (the date the account model milestone shipped)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CHANGELOG.md has complete v1.0-v5.0 history; Plan 02 (CONTRIBUTING.md, SECURITY.md, URL sweep) can proceed
- package.json at 5.0.0 — consistent with CHANGELOG [5.0.0] entry

---
*Phase: 41-update-readme-and-stale-documentation-for-torch-secret-v5-0-launch*
*Completed: 2026-03-02*

---
phase: 41-update-readme-and-stale-documentation-for-torch-secret-v5-0-launch
plan: 02
subsystem: docs
tags: [contributing, security, github-url, infisical, portless]

# Dependency graph
requires:
  - phase: 41-update-readme-and-stale-documentation-for-torch-secret-v5-0-launch
    provides: plan 01 established new repo branding context (norcalcoop/torch-secret)
provides:
  - CONTRIBUTING.md with dual-path setup (Option A / Infisical, Option B / .env.example)
  - SECURITY.md version table accurate for v5.x
  - Zero stale norcalcoop/secureshare references across all 5 affected files
affects:
  - Any future contributor following CONTRIBUTING.md setup instructions
  - Security researchers using SECURITY.md vulnerability advisory link

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dual-path contributor setup: Option A (Infisical/team) vs Option B (.env.example/community)"

key-files:
  created: []
  modified:
    - CONTRIBUTING.md
    - SECURITY.md
    - README.md
    - .github/ISSUE_TEMPLATE/config.yml
    - CHANGELOG.md

key-decisions:
  - "Removed :5173 reference entirely rather than keeping it as a negative example — plan verification requires zero grep matches"
  - "CHANGELOG had 6 norcalcoop/secureshare occurrences (not 4 as documented in plan) — all 6 replaced"

patterns-established:
  - "Dual-path setup docs: Option A (privileged/team) vs Option B (community) for projects with secrets managers"

requirements-completed:
  - CONTRIBUTING_DUAL_PATH
  - SECURITY_VERSION_TABLE
  - GITHUB_URL_SWEEP

# Metrics
duration: ~8min
completed: 2026-03-02
---

# Phase 41 Plan 02: CONTRIBUTING.md Dual-Path + SECURITY.md + URL Sweep Summary

**CONTRIBUTING.md rewritten with Infisical (Option A) and .env.example (Option B) dual setup paths; SECURITY.md version table updated to 5.x current; all 10+ stale norcalcoop/secureshare GitHub URLs replaced with norcalcoop/torch-secret across 5 files**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-02T00:00:00Z
- **Completed:** 2026-03-02T00:08:00Z
- **Tasks:** 2 (Task 1 was a human-action checkpoint resolved by user)
- **Files modified:** 5

## Accomplishments

- CONTRIBUTING.md completely rewritten: Infisical CLI added to prerequisites, dual-path setup (Option A team/Infisical, Option B community/.env.example), portless dev URL corrected from `:5173` to `http://torchsecret.localhost:1355`, stale `docker compose up` dev alternative removed, project structure root renamed from `secureshare/` to `torch-secret/`
- SECURITY.md version table updated: 5.x shown as current supported version; 4.x, 3.x, 2.x, 1.x all marked end of life
- All stale `norcalcoop/secureshare` references replaced with `norcalcoop/torch-secret` across README.md (2), CONTRIBUTING.md (2), SECURITY.md (1), .github/ISSUE_TEMPLATE/config.yml (1), CHANGELOG.md (6) — 12 total replacements

## Task Commits

Each task was committed atomically:

1. **Task 1: Confirm new GitHub repository URL** - human-action checkpoint resolved by user providing `norcalcoop/torch-secret`
2. **Task 2: Rewrite CONTRIBUTING.md with dual-path setup and corrected port** - `e024527` (docs)
3. **Task 3: Update SECURITY.md version table and sweep all stale repo URLs** - `983f451` (docs)

## Files Created/Modified

- `CONTRIBUTING.md` - Rewritten with Option A/B dual-path setup, Infisical prereq, portless URL, torch-secret/ structure, updated clone/issue URLs
- `SECURITY.md` - Version table updated to 5.x current; vulnerability advisory link updated to norcalcoop/torch-secret
- `README.md` - CI badge and License badge URLs updated to norcalcoop/torch-secret
- `.github/ISSUE_TEMPLATE/config.yml` - Security advisory link updated to norcalcoop/torch-secret
- `CHANGELOG.md` - All 6 comparison/release links updated to norcalcoop/torch-secret

## Decisions Made

- Removed `:5173` from the explanatory sentence rather than keeping it as a "not X" example — the plan's verification grep requires zero `:5173` matches; rephrased to "not the default Vite port"
- CHANGELOG had 6 occurrences of `norcalcoop/secureshare` (plan documented 4) — all 6 were replaced since the [1.0.0] comparison link was also present; this is correct behavior

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] CHANGELOG had 6 stale URL occurrences, not 4 as documented**
- **Found during:** Task 3 (URL sweep)
- **Issue:** Plan documented 4 CHANGELOG occurrences but grep found 6 — the [1.0.0] releases/tag link and [2.0.0] compare link were also stale
- **Fix:** Replaced all 6 via `replace_all: true` — correct behavior, not scope creep
- **Files modified:** CHANGELOG.md
- **Verification:** `grep -rn "norcalcoop/secureshare" CHANGELOG.md` returns empty
- **Committed in:** 983f451 (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 count discrepancy in plan documentation — no functional impact)
**Impact on plan:** Complete URL sweep achieved; no stale references remain anywhere.

## Issues Encountered

None — both tasks executed cleanly after human-action checkpoint resolved.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 41-03 (next plan in phase 41) can proceed
- All GitHub URL references now consistently point to `norcalcoop/torch-secret`
- Contributors following CONTRIBUTING.md now have clear Infisical vs community setup paths

---
*Phase: 41-update-readme-and-stale-documentation-for-torch-secret-v5-0-launch*
*Completed: 2026-03-02*

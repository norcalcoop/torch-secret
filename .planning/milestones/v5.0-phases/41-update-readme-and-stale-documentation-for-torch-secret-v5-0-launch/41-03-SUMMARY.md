---
phase: 41-update-readme-and-stale-documentation-for-torch-secret-v5-0-launch
plan: 03
subsystem: ui
tags: [readme, screenshots, documentation, marketing]

# Dependency graph
requires:
  - phase: 41-01
    provides: CHANGELOG and version bump; README already had local dev section
  - phase: 41-02
    provides: CONTRIBUTING.md updated; stale URLs swept
provides:
  - screenshots/ directory with 4 PNG captures of Torch Secret v5.0 UI
  - README.md Screenshots section embedded before Contributing
affects: [public-readme, github-repo-page, first-impressions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "screenshots/*.png pattern added to .gitignore exception list (*.png catch-all needed override)"

key-files:
  created:
    - screenshots/homepage-dark.png
    - screenshots/homepage-light.png
    - screenshots/create-flow.png
    - screenshots/reveal-flow.png
  modified:
    - README.md
    - .gitignore

key-decisions:
  - "Skip dashboard.png: auth origin issue in dev environment; 4 screenshots (homepage dark/light, create, reveal) are sufficient to communicate v5.0 product value"
  - "Add !screenshots/*.png gitignore exception rather than moving screenshots to docs/: keeps relative paths clean (screenshots/file.png) and matches plan spec"

patterns-established:
  - "Screenshots section placed immediately before Contributing section in README"
  - "Alt text describes visible content, not just page name"

requirements-completed:
  - README_SCREENSHOTS

# Metrics
duration: 8min
completed: 2026-03-02
---

# Phase 41 Plan 03: Screenshots Embedded in README Summary

**README.md now has a Screenshots section with 4 PNG captures of the Torch Secret v5.0 glassmorphism UI — homepage dark/light themes, create form, and one-time reveal terminal.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-02T (continuation from Task 1 checkpoint)
- **Completed:** 2026-03-02
- **Tasks:** 2 (Task 1: human-action checkpoint — screenshots captured; Task 2: auto — embed in README)
- **Files modified:** 6 (4 PNG files, README.md, .gitignore)

## Accomplishments

- 4 PNG screenshots of v5.0 UI committed to screenshots/ directory at repo root
- README.md Screenshots section embedded with descriptive alt text using relative paths
- .gitignore exception added so screenshots/*.png are tracked in git
- All 5 plan verification checks pass: file count, README ref count, heading present, order correct

## Task Commits

Each task was committed atomically:

1. **Task 1: Capture screenshots with app running** — human-action checkpoint (user captured screenshots manually; no commit — files added to disk)
2. **Task 2: Embed screenshots in README.md** — `9ce2e01` (feat)

## Files Created/Modified

- `screenshots/homepage-dark.png` — Marketing homepage in dark mode, hero + tagline + CTA (163K)
- `screenshots/homepage-light.png` — Marketing homepage in light mode, glassmorphism surfaces (166K)
- `screenshots/create-flow.png` — Create-secret form in dark mode, expiration + protection options (184K)
- `screenshots/reveal-flow.png` — One-time reveal terminal display after secret viewed and destroyed (86K)
- `README.md` — Added ## Screenshots section before ## Contributing with 4 embedded images
- `.gitignore` — Added `!screenshots/*.png` exception to allow tracking under *.png catch-all

## Decisions Made

- **Skip dashboard.png:** Auth origin issue in dev environment made dashboard screenshot impractical. The 4 captured screenshots (homepage dark, homepage light, create, reveal) provide sufficient coverage of the v5.0 product value proposition. The plan spec noted dashboard was optional ("if you can log in; otherwise substitute").
- **Gitignore exception approach:** The existing .gitignore has `*.png` as a blanket catch-all (to exclude test screenshots, Playwright artifacts, etc.). Added `!screenshots/*.png` as a targeted exception rather than restructuring the screenshots directory. This keeps the README paths clean (`screenshots/file.png`) and matches the plan's specified output location.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] .gitignore *.png catch-all blocked screenshots from being tracked**
- **Found during:** Task 2 (staging files for commit)
- **Issue:** `git add screenshots/*.png` failed with "ignored by .gitignore" — `.gitignore` had `*.png` catch-all with only `!docs/screenshots/*.png` exception
- **Fix:** Added `!screenshots/*.png` exception line to .gitignore immediately after the existing docs/ exception
- **Files modified:** `.gitignore`
- **Verification:** `git add` succeeded; all 4 PNG files appear as `A` (added) in git status
- **Committed in:** `9ce2e01` (part of Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required fix — screenshots could not be committed without it. No scope creep.

## Issues Encountered

- **dashboard.png not captured:** Dev environment auth flow had origin issues (Better Auth CORS/trusted origins config in dev). Skipped per plan's fallback clause ("if you can log in; otherwise substitute").

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03 complete. Phase 41 has 1 plan remaining: Plan 04.
- README.md now has visual screenshots for GitHub visitors and potential contributors.
- screenshots/ directory is tracked in git and will render on the GitHub repo page.

---
*Phase: 41-update-readme-and-stale-documentation-for-torch-secret-v5-0-launch*
*Completed: 2026-03-02*

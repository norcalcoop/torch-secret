---
phase: quick-6
plan: "01"
subsystem: security/ci
tags: [openssf, scorecard, codeowners, cii-best-practices, readme]
dependency_graph:
  requires: [quick-5]
  provides: [CODEOWNERS catch-all rule, CII badge placeholder in README.md, actionable checklist steps]
  affects: [.github/CODEOWNERS, README.md, docs/SECURITY-CHECKLIST.md, docs/openssf-scorecard-improvement-plan.md]
tech_stack:
  added: []
  patterns: [CODEOWNERS catch-all pattern]
key_files:
  created:
    - .github/CODEOWNERS
  modified:
    - README.md
    - docs/SECURITY-CHECKLIST.md
    - docs/openssf-scorecard-improvement-plan.md (committed from untracked)
decisions:
  - CODEOWNERS uses catch-all rule (* @norcalcoop) rather than per-directory rules — solo project, single owner covers all paths
  - CII badge uses TODO placeholder in URL rather than being omitted — keeps the badge row accurate about what still needs registering without breaking the badge visually until real ID is known
metrics:
  duration: "~3 minutes"
  completed: "2026-03-13"
  tasks_completed: 3
  files_changed: 4
---

# Quick Task 6: OpenSSF Scorecard Remaining Improvements Summary

**One-liner:** CODEOWNERS catch-all rule + CII Best Practices badge placeholder in README.md + actionable checklist steps for post-registration update.

## What Was Done

Completed the remaining automatable OpenSSF Scorecard improvements not covered by quick-5. Three tasks executed atomically in a single commit.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create .github/CODEOWNERS | e5b1984 | .github/CODEOWNERS |
| 2 | Add CII badge to README.md + update SECURITY-CHECKLIST.md | e5b1984 | README.md, docs/SECURITY-CHECKLIST.md |
| 3 | Commit all changes including untracked improvement plan doc | e5b1984 | docs/openssf-scorecard-improvement-plan.md |

## Decisions Made

- **CODEOWNERS catch-all:** `* @norcalcoop` covers all repository paths. For a solo project this is the correct approach — no per-directory granularity needed. This is the prerequisite for the Code-Review Scorecard check once branch protection is enabled in GitHub Settings.
- **CII badge with TODO placeholder:** The badge line in README.md uses literal `TODO` as the project ID placeholder, with an HTML comment on the preceding line directing the maintainer to register and swap in the real numeric ID. This approach surfaces the remaining manual step visibly in the badge row rather than leaving it buried in docs only.
- **SECURITY-CHECKLIST.md Section 2 rewrite:** Replaced the single "add badge to README.md" instruction with a full step-by-step flow including the explicit "update README.md TODO placeholders" step — closes the loop between registration and the badge going live.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- .github/CODEOWNERS: FOUND
- README.md contains `bestpractices.coreinfrastructure.org`: FOUND
- README.md contains `TODO` placeholder: FOUND
- docs/SECURITY-CHECKLIST.md contains `real project ID`: FOUND
- Commit e5b1984: FOUND
- Working tree: clean

## Self-Check: PASSED

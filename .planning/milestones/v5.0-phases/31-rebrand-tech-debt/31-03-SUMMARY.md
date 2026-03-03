---
phase: 31-rebrand-tech-debt
plan: "03"
subsystem: server/security, db/schema, planning-docs
tags: [noindex, zero-knowledge, tech-debt, seo, schema]
dependency-graph:
  requires: []
  provides: [TECH-02, TECH-03]
  affects: [server/src/app.ts, server/src/db/schema.ts, .planning/REQUIREMENTS.md]
tech-stack:
  added: []
  patterns: [X-Robots-Tag header, NOINDEX_PREFIXES array, zero-knowledge comment]
key-files:
  created: []
  modified:
    - server/src/app.ts
    - server/src/db/schema.ts
    - .planning/REQUIREMENTS.md
decisions:
  - ROADMAP.md Phase 31 success criterion #5 already read "7 enforcement points" prior to this plan (updated during plan creation phase); no change required
metrics:
  duration: "~1 minute"
  completed: "2026-02-22"
  tasks: 2
  files-modified: 3
---

# Phase 31 Plan 03: Server-Side Tech Debt (NOINDEX + Schema Comment) Summary

Server adds `X-Robots-Tag: noindex, nofollow` to `/privacy` and `/terms` via NOINDEX_PREFIXES; schema.ts zero-knowledge comment updated to list all 7 enforcement points matching the canonical INVARIANTS.md table.

## What Was Built

Two targeted tech debt fixes:

1. **NOINDEX_PREFIXES extension** (`server/src/app.ts`): Added `/privacy` and `/terms` to the array that drives the `X-Robots-Tag: noindex, nofollow` response header. Any GET request to these routes now receives the header from server middleware, complementing the existing client-side `<meta name="robots">` tag. The existing header-setting code already covered this — only the array needed extending.

2. **Zero-knowledge comment update** (`server/src/db/schema.ts`): Replaced the 3-line enforcement list with the complete 7-point list matching the canonical INVARIANTS.md table. The original comment was written in Phase 21 and had not been updated after Phases 23, 26, and 27 added four more enforcement points. The comment is now accurate and complete.

3. **Planning doc accuracy** (`.planning/REQUIREMENTS.md`): TECH-03 description corrected from "canonical 6-point list" to "canonical 7-point list".

## Tasks Completed

| Task | Name | Commit | Files Modified |
|------|------|--------|----------------|
| 1 | Add /privacy and /terms to NOINDEX_PREFIXES | bfa2b57 | server/src/app.ts |
| 2 | Update schema.ts ZK comment to 7 enforcement points; fix REQUIREMENTS.md | 8db4f05 | server/src/db/schema.ts, .planning/REQUIREMENTS.md |

## Verification Results

1. `grep -n "'/privacy'\|'/terms'" server/src/app.ts` — both entries present at lines 118-119
2. Enforcement point count in schema.ts — returns 7 (all 7 bullet points present)
3. `grep "enforcement" .planning/ROADMAP.md` — shows "7 enforcement points" in success criterion #5
4. `grep "6 enforcement\|6-point" .planning/ROADMAP.md .planning/REQUIREMENTS.md` — no stale "6" count found
5. `npm run lint` — passes cleanly

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Observation

ROADMAP.md success criterion #5 already contained "7 enforcement points" (it was written during the plan creation step with the corrected value). The plan documented this as a fix to make, but the file was already correct. No change was made to ROADMAP.md; this is noted here for transparency.

## Self-Check: PASSED

| Item | Result |
|------|--------|
| server/src/app.ts | FOUND |
| server/src/db/schema.ts | FOUND |
| .planning/REQUIREMENTS.md | FOUND |
| 31-03-SUMMARY.md | FOUND |
| Commit bfa2b57 | FOUND |
| Commit 8db4f05 | FOUND |

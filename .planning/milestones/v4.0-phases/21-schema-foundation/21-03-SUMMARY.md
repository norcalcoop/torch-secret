---
phase: 21-schema-foundation
plan: 03
subsystem: infra
tags: [zero-knowledge, security, documentation, invariants, postgres, logging, analytics]

# Dependency graph
requires:
  - phase: 21-schema-foundation plan 01
    provides: secrets table schema with nullable user_id column establishing the DB-level separation
provides:
  - Canonical zero-knowledge invariant document (.planning/INVARIANTS.md) with abstract rule, enforcement table, and extension protocol
  - CLAUDE.md hard convention section directing future sessions to consult INVARIANTS.md before writing DB/logging/analytics code
affects:
  - phase 22 (auth implementation — must read INVARIANTS.md before writing auth DB schema)
  - phase 25 (analytics — PostHog sanitize_properties enforcement point documented)
  - all future phases touching DB schema, logger, or analytics

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Invariant document pattern: canonical source in .planning/INVARIANTS.md with cross-references from code and CLAUDE.md"
    - "Extension protocol: update enforcement table FIRST, then implement any new system touching userId or secretId"

key-files:
  created:
    - .planning/INVARIANTS.md
  modified:
    - CLAUDE.md

key-decisions:
  - "INVARIANTS.md placed in .planning/ (not server/src/docs/) so it is co-located with PROJECT.md and ROADMAP.md and visible to all future planning sessions"
  - "Hard convention in CLAUDE.md uses MANDATORY CHECK wording (matching Frontend UI/UX Workflow section pattern) to ensure consistent enforcement"
  - "Enforcement table in INVARIANTS.md enumerates specific file paths and column names so future sessions can extend it without ambiguity"

patterns-established:
  - "Invariant-first documentation: document the abstract rule, then list concrete enforcement points, then provide an extension protocol"
  - "Cross-document citation: CLAUDE.md cites INVARIANTS.md; INVARIANTS.md cites schema.ts and CLAUDE.md — three-way lock prevents invariant from being silently dropped"

requirements-completed:
  - INFRA-21-DOCS

# Metrics
duration: 1min
completed: 2026-02-19
---

# Phase 21 Plan 03: Schema Foundation — Invariant Documentation Summary

**Canonical zero-knowledge invariant document established in .planning/INVARIANTS.md with a MANDATORY CHECK hard convention added to CLAUDE.md, creating a three-way lock (schema.ts + INVARIANTS.md + CLAUDE.md) preventing userId+secretId correlation across all future phases**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-19T03:12:32Z
- **Completed:** 2026-02-19T03:13:55Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created `.planning/INVARIANTS.md` as the single authoritative source for the zero-knowledge user-secret separation invariant, including: abstract rule, rationale, scope (DB, logs, analytics, API responses, background jobs), enforcement table covering all 4 current systems, and extension protocol for future phases
- Added "## Zero-Knowledge Invariant (Hard Convention)" section to CLAUDE.md positioned between "Conventions and Gotchas" and "Frontend UI/UX Workflow", with MANDATORY CHECK wording and 3 citations to INVARIANTS.md
- Established a three-way cross-reference lock: schema.ts block comment (Plan 01) -> INVARIANTS.md -> CLAUDE.md -> back to INVARIANTS.md, so the invariant cannot be silently lost in any future session

## Task Commits

Each task was committed atomically:

1. **Task 1: Create .planning/INVARIANTS.md as canonical invariant document** - `0f12cb8` (docs)
2. **Task 2: Add Zero-Knowledge Invariant hard convention to CLAUDE.md** - `af691ef` (docs)

**Plan metadata:** `(final docs commit)` (docs: complete plan)

## Files Created/Modified

- `.planning/INVARIANTS.md` - Canonical invariant document: abstract rule, enforcement table (4 systems), extension protocol
- `CLAUDE.md` - New "Zero-Knowledge Invariant (Hard Convention)" section with MANDATORY CHECK directive and 3 INVARIANTS.md citations

## Decisions Made

- INVARIANTS.md placed in `.planning/` alongside PROJECT.md and ROADMAP.md — visible to all future planning sessions, not buried in server source
- Used "MANDATORY CHECK" wording matching the existing Frontend UI/UX Workflow pattern in CLAUDE.md for consistency
- Enforcement table includes `Phase Added` column so future sessions can trace when each enforcement point was introduced

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All three locked locations for the zero-knowledge invariant now exist and cross-reference each other: `server/src/db/schema.ts` (Phase 21 Plan 01), `.planning/INVARIANTS.md` (this plan), and `CLAUDE.md` (this plan)
- Phase 22 (auth implementation) can proceed — any future session that reads CLAUDE.md cold will see the MANDATORY CHECK before writing auth DB schema code

---
*Phase: 21-schema-foundation*
*Completed: 2026-02-19*

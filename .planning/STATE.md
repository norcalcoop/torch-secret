# Session State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-18 after v4.0 milestone started)

**Core value:** Users can share sensitive information once, securely, without accounts or complexity
**Current focus:** v4.0 — Phase 21: Schema Foundation

## Current Position

Phase: 21 of 27 (Schema Foundation)
Plan: 03 complete (3 of 3 plans in phase 21)
Status: Phase 21 complete — ready for Phase 22
Last activity: 2026-02-19 — Phase 21 Plan 03 executed (invariant documentation created)

Progress: [█░░░░░░░░░] ~4% (v4.0 — 1/31 requirements complete)

## Performance Metrics

| Milestone | Phases | Plans | Timeline |
|-----------|--------|-------|----------|
| v1.0 MVP | 8 | 22 | 2 days |
| v2.0 UI & SEO | 6 | 14 | 3 days |
| v3.0 Production-Ready | 6 | 15 | 2 days |
| **Total shipped** | **20** | **51** | **~7 days** |
| v4.0 in progress | 7 planned | TBD | — |
| Phase 21 P03 | 1 | 2 tasks | 2 files |

## Accumulated Context

### Decisions

All decisions logged in PROJECT.md Key Decisions table.

Key v4.0 architectural constraints (carry forward to every phase):
- Zero-knowledge invariant: no log, DB record, or analytics event may contain both userId and secretId in the same record — ever
- Stripe webhook route must mount before express.json() in app.ts (not applicable v4.0, noted for v5.0 Pro tier)
- PostHog sanitize_properties stripping URL fragments is mandatory — misconfiguration leaks AES-256-GCM keys permanently
- Drizzle bug #4147: inspect generated SQL after db:generate; split FK + column additions into two migration steps if needed
- Better Auth requires sameSite: 'lax' on session cookie (not 'strict') for OAuth callback redirects to work
- [Phase 21]: INVARIANTS.md placed in .planning/ as canonical source for zero-knowledge invariant with three-way cross-reference lock (schema.ts + INVARIANTS.md + CLAUDE.md)

### Known Tech Debt

- Placeholder domain `secureshare.example.com` in SEO assets (needs production domain)
- Lucide ESM workaround via Vite resolve.alias (upstream bug)
- Playwright webServer 30s timeout risk on slow CI runners (pre-build client in CI e2e job)
- Codecov badge shows "unknown" until CODECOV_TOKEN added to GitHub repo secrets

### Blockers/Concerns

(None — v3.0 clean ship, v4.0 roadmap complete)

## Session Continuity

Last session: 2026-02-19
Stopped at: Completed 21-03-PLAN.md
Resume: Run /gsd:execute-phase 22 (Phase 22: Authentication)

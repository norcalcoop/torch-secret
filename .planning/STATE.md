# Session State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-22 after v5.0 milestone started)

**Core value:** Users can share sensitive information once, securely, without accounts or complexity
**Current focus:** v5.0 Product Launch Checklist — Phase 31: Rebrand + Tech Debt

## Current Position

Phase: 31 of 38 (Rebrand + Tech Debt)
Plan: 3 of 3 in current phase
Status: In progress — Phase 31 plan 3/3 complete
Last activity: 2026-02-22 — Phase 31 Plan 03 complete (NOINDEX + schema comment + planning doc fixes)

Progress: [█░░░░░░░░░] 12% (v5.0 phases — 1/8 phases in progress)

## Performance Metrics

| Milestone | Phases | Plans | Timeline |
|-----------|--------|-------|----------|
| v1.0 MVP | 8 | 22 | 2 days |
| v2.0 UI & SEO | 6 | 14 | 3 days |
| v3.0 Production-Ready | 6 | 15 | 2 days |
| v4.0 Hybrid Anonymous + Account | 10 | 38 | 4 days |
| **Total shipped** | **30** | **89** | **~11 days** |

*v5.0 velocity tracking begins after first plan completes*

## Accumulated Context

### Key Architectural Constraints (carry forward every phase)

- Zero-knowledge invariant: no log, DB record, or analytics event may contain both userId and secretId in the same record — ever (see .planning/INVARIANTS.md)
- Stripe webhook route must be mounted BEFORE express.json() in app.ts — mounting after causes silent signature verification failures ("No signatures found matching the expected signature")
- Do NOT use @better-auth/stripe billing webhook path — 4 open bugs (#2440, #4957, #5976, #4801 as of Feb 2026) break subscription lifecycle; use raw stripe SDK with hand-written handler
- SEO content pages (/vs/*, /alternatives/*, /use/*) MUST be Express SSR — SPA routes are invisible to AI crawlers (GPTBot, ClaudeBot, PerplexityBot) and delay Googlebot indexing by days-to-weeks on a new domain
- GDPR: welcome email is transactional (no consent needed); key features + upgrade prompt emails are marketing (explicit consent required; marketing consent checkbox on registration form must be unchecked by default)
- loops@6.2.0 uses v6.x createContact() single-object API — breaking change from v5; do not use v5 positional arguments
- Use resend@6.9.2 Audiences API (resend.contacts.create()) for email list capture — no new package needed
- Before writing any webhook handler code: extend INVARIANTS.md with a Stripe/billing row first (BILL-06)

### Phase 31 Kickoff Notes

- BRAND-01/02: grep audit recommended — search for "SecureShare" and "secureshare.example.com" across all files before and after rename to verify completeness
- TECH-01: Add placeholder env vars to ci.yml matching the docker-compose.yml pattern (BETTER_AUTH_SECRET, DATABASE_URL, etc.)
- TECH-02: Add '/privacy' and '/terms' to NOINDEX_PREFIXES array in server/src/app.ts
- TECH-03: Update schema.ts ZK comment to list all 7 enforcement points from INVARIANTS.md (DONE — 31-03)

### Blockers/Concerns

None — v4.0 clean ship, v5.0 roadmap finalized

## Session Continuity

Last session: 2026-02-22
Stopped at: Phase 31 Plan 03 complete — NOINDEX_PREFIXES + schema.ts ZK comment + REQUIREMENTS.md fix
Resume file: None — Phase 31 complete (3/3 plans done)

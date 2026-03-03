# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

---

## Milestone: v5.0 — Product Launch Checklist

**Shipped:** 2026-03-03
**Phases:** 19 (Phases 31-45) | **Plans:** 63

### What Was Built
- Torch Secret rebrand across all surfaces + torchsecret.com canonical URLs
- Marketing homepage at `/` with full conversion funnel (hero → pricing → checkout)
- Stripe Pro billing (checkout, webhooks, customer portal, tier enforcement)
- 14 server-rendered SEO pages (`/vs/*`, `/alternatives/*`, `/use/*`) for AI crawlers
- GDPR-compliant email capture + Loops.so 3-email onboarding sequence
- Google + GitHub OAuth via Infisical secrets management
- Pre-launch security hardening: Argon2id tight limiter, PostgreSQL pool, ZK invariant tests
- PostHog event enrichment with Launch Dashboard and conversion funnels

### What Worked
- Audit-before-archive pattern: v5.0-MILESTONE-AUDIT.md caught 17 tech debt items with `tech_debt` status (not `gaps_found`) — milestone proceeded cleanly with documented known issues
- Gap closure phases (43, 44, 45) as explicit GSD phases: treated retroactive verification and integration fixes as first-class phases rather than ad-hoc patches; produced VERIFICATION.md evidence for auditors
- Infisical CLI injection from day one: `infisical run --env=dev --` replaced `.env` across all environments in Phase 37.2 without touching application code — zero code changes, pure infra migration
- TDD discipline on billing gap closure (Phase 45): 6 new tests written RED before implementation; both BILL-05 and ESEQ-03 closed in 2 plans
- Express SSR for SEO content pages: immediate AI crawler visibility vs days-to-weeks SPA delay — clear architectural win confirmed in planning

### What Was Inefficient
- ROADMAP.md Phase 40 plan checkboxes left as `[ ]` after execution — documentation drift that required audit annotation; plan checkbox hygiene should be enforced at SUMMARY.md write time
- `BETTER_AUTH_TRUSTED_ORIGINS` added to env docs but never consumed in code — dead variable survived through Phase 45 without detection; env schema Zod validation should catch unused vars
- Three CTAs routing to `/` (marketing homepage) instead of `/create` post-Phase 32 split — introduced in Phase 32 and not caught until audit; navigation smoke test would have caught this immediately
- OAuth state_mismatch required a dev-only bounce middleware workaround — root cause was localhost:3000 vs Vite proxy mismatch; could have been anticipated during Phase 39 planning

### Patterns Established
- `activatePro()` / `deactivatePro()` receive `stripe_customer_id` only — ZK constraint on all billing operations (no userId in webhook scope)
- Non-async `databaseHooks.after` handler with `void+.catch` fire-and-forget — avoids `@typescript-eslint/require-await` while keeping email enrollment non-blocking
- Loops filter nodes evaluated at send time (not registration time) — GDPR consent changes take effect before day-7 email without re-enrollment
- Gap closure as explicit GSD phases with their own PLAN.md + VERIFICATION.md — creates audit trail; preferred over "fix it in place"

### Key Lessons
1. **SSR for SEO is non-negotiable on new domains** — AI crawlers and Googlebot delay indexing on SPA routes by days-to-weeks; server-rendered content is immediately visible (confirmed by Phase 35)
2. **Raw Stripe SDK beats auth library billing plugins** — `@better-auth/stripe` had 4 open bugs at Feb 2026; hand-written webhook handler with explicit event handling is more predictable
3. **Milestone audits should run before, not after, planning the next milestone** — the `tech_debt` status with 17 items informed the gap closure phases (43-45) that shipped before milestone close
4. **Documentation drift compounds** — three minor doc inconsistencies (Phase 40 checkboxes, TRUSTED_ORIGINS dead var, CTA navigation) each required audit annotation; automated checks at plan completion would prevent accumulation

### Cost Observations
- Sessions: ~40+ sessions across 9 days
- Notable: Human-action checkpoint phases (37.3, 39, 42) were correctly scoped — external platform verification cannot be automated; checkpoints kept execution moving without blocking
- Gap closure phases added ~10% overhead (Phases 43-45 = 4 plans) but produced clean audit evidence

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 8 | 22 | Established core GSD workflow |
| v2.0 | 6 | 14 | First design-heavy milestone; OKLCH tokens pattern |
| v3.0 | 6 | 15 | CI/CD + Docker infra; Playwright E2E established |
| v4.0 | 10 | 38 | Largest milestone; ZK invariant formalized |
| v5.0 | 19 | 63 | Audit-before-archive; gap closure phases as first-class work |

### Cumulative Quality

| Milestone | Tests | Notes |
|-----------|-------|-------|
| v1.0 | 152 | Core crypto + API tests |
| v2.0 | 163 | Accessibility (vitest-axe) added |
| v3.0 | 163 | E2E Playwright added |
| v4.0 | ~271 | Auth + dashboard + billing tests |
| v5.0 | 385 | ZK invariant tests, billing gap closure, Stripe webhook suite |

### Top Lessons (Verified Across Milestones)

1. **Constant-size working files** — ROADMAP.md + REQUIREMENTS.md collapsed to archive per milestone keeps context cost constant regardless of project age (verified v1.0 → v5.0)
2. **ZK invariant as design constraint** — formalizing it in INVARIANTS.md early (v4.0) guided all v5.0 billing, analytics, and email decisions without needing per-feature re-analysis
3. **Human-action checkpoints are load-bearing** — external platform verification (OAuth, Stripe, Loops, Infisical) cannot be automated; explicit checkpoint plans prevent "assumed complete" drift

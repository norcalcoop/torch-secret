---
phase: 40-security-remediation-and-concerns-pre-launch
plan: 05
subsystem: api
tags: [pino, logging, security-audit, better-auth, oauth]

# Dependency graph
requires:
  - phase: 40-01
    provides: rate-limit hardening and isE2E gate fix
  - phase: 40-03
    provides: notification.service.test.ts with ZK invariant tests to stay green
provides:
  - Pino structured logging in notification.service.ts (replaces console.error)
  - Pino structured logging in subscribers.service.ts (3 error paths)
  - OAuth account-linking security audit comment in auth.ts (SR-004 closure)
affects: [phase-40-06, future-auth-changes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pino logger.error({ err: message }, 'event_name') pattern for service-layer errors"
    - "Security audit JSDoc comment pattern for documenting findings without behavior change"

key-files:
  created: []
  modified:
    - server/src/services/notification.service.ts
    - server/src/services/subscribers.service.ts
    - server/src/auth.ts

key-decisions:
  - "console.error replaced with logger.error({ err: message }, 'event_name') — Pino structured format; ZK invariant preserved (no userId/secretId in any error object)"
  - "OAuth account-linking audit: Better Auth 1.x does not auto-link OAuth to email/password accounts without user consent — default behavior is secure, no config change needed"

patterns-established:
  - "Service-layer error pattern: logger.error({ err: err instanceof Error ? err.message : String(err) }, 'snake_case_event_name') — structured, log-aggregator-friendly"
  - "Security audit comment pattern: JSDoc above the audited block with Finding/Evidence/Action required/Re-audit trigger sections"

requirements-completed: [E2, SR-004]

# Metrics
duration: 2min
completed: 2026-03-02
---

# Phase 40 Plan 05: Security Remediation Logging and OAuth Audit Summary

**Pino structured logging replaces console.error in two service files; OAuth account-linking safe-default documented in auth.ts**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-02T00:20:15Z
- **Completed:** 2026-03-02T00:22:20Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Replaced 4 `console.error` calls with `logger.error({ err: message }, 'event_name')` Pino format across notification.service.ts and subscribers.service.ts — errors now reach log aggregators with structured fields and correct severity level
- ZK invariant maintained: none of the new logger.error calls include userId or secretId — only error message strings are logged
- Documented Phase 40 Item #10 (SR-004) OAuth account-linking audit finding in auth.ts above the socialProviders block — Better Auth default behavior confirmed secure, no code change required
- All 367 pre-existing tests remain green; notification.service.test.ts ZK invariant tests (3 passing) unaffected

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace console.error with logger.error in service files** - `6e3af0d` (fix)
2. **Task 2: OAuth account-linking audit comment in auth.ts** - `87753d4` (docs)

**Plan metadata:** see final commit (docs: complete plan)

## Files Created/Modified

- `server/src/services/notification.service.ts` - Added logger import; replaced console.error with logger.error({ err: error.message }, 'notification_send_failed')
- `server/src/services/subscribers.service.ts` - Added logger import; replaced 3 console.error calls with logger.error using event labels: resend_contacts_create_failed_on_confirm, loops_subscribed_event_failed_on_confirm, resend_contacts_create_failed_on_unsubscribe
- `server/src/auth.ts` - Added 18-line JSDoc audit comment above socialProviders block documenting SR-004 finding

## Decisions Made

- Used `logger.error({ err: message }, 'event_name')` format (not `logger.error(message, context)`) — Pino's structured object-first signature; the event name is the message string, matching existing patterns in auth.ts and billing.service.ts
- Audit comment placed as JSDoc `/** */` above the `socialProviders` property key (not as inline `//` comment) — provides structured, searchable documentation for future auditors and follows the existing ZK invariant JSDoc pattern in the same file

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 40 Plan 05 complete — all 5 Phase 40 plans now done
- Phase 40 (security remediation) is complete: rate-limit hardening (01), PostgreSQL pool hardening (02), test scaffolds (03), Stripe webhook tests (04), logging/audit (05)
- v5.0 Product Launch Checklist fully shipped

---
*Phase: 40-security-remediation-and-concerns-pre-launch*
*Completed: 2026-03-02*

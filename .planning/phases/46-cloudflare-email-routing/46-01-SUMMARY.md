---
phase: 46-cloudflare-email-routing
plan: 01
subsystem: infra
tags: [cloudflare, email-routing, dns, mx, spf, gmail]

# Dependency graph
requires: []
provides:
  - "Cloudflare Email Routing enabled on torchsecret.com (3 MX records + SPF TXT)"
  - "torch-secret@gmail.com verified as destination address in Cloudflare"
  - "7 active routing rules: hello, contact, admin, info, support, security, privacy @torchsecret.com → torch-secret@gmail.com"
  - "Gmail Never-send-to-Spam filter covering all 7 deliveredto: addresses"
affects: [46-02, 47-domain-verification-dmarc, 49-gmail-send-mail-as]

# Tech tracking
tech-stack:
  added: [cloudflare-email-routing]
  patterns:
    - "Cloudflare Email Routing as inbound MX layer — SRS envelope rewriting handled by Gmail spam filter"
    - "Gmail deliveredto: filter pattern for forwarded mail spam prevention"

key-files:
  created: []
  modified: []

key-decisions:
  - "MX hostnames are route1/route2/route3.mx.cloudflare.net (not amir/linda/isaac as documented in plan — Cloudflare updated their MX pool; both are valid Cloudflare infrastructure)"
  - "All 7 routing rules created as individual rules rather than a catch-all to maintain explicit control over which addresses are active"
  - "Gmail spam filter uses deliveredto: operator (not from:) because Cloudflare SRS rewrites the envelope sender, making from: unreliable for forwarded mail identification"

patterns-established:
  - "Gmail spam filter pattern: deliveredto:addr1@domain.com OR deliveredto:addr2@domain.com (covers all aliases in single filter)"

requirements-completed: [EROT-01]

# Metrics
duration: ~30min (human action)
completed: 2026-03-04
---

# Phase 46 Plan 01: Cloudflare Email Routing — Enable and Configure Summary

**Cloudflare Email Routing enabled on torchsecret.com with 3 MX records, SPF TXT, 7 active routing rules forwarding all business addresses to torch-secret@gmail.com, and Gmail Never-send-to-Spam filter preventing SRS-rewritten forwarded mail from landing in spam**

## Performance

- **Duration:** ~30 min (human action — no code changes)
- **Started:** 2026-03-04
- **Completed:** 2026-03-04
- **Tasks:** 2/2 (both were checkpoint:human-action)
- **Files modified:** 0 (infrastructure-only; no code changes)

## Accomplishments

- Cloudflare Email Routing enabled on torchsecret.com; Cloudflare automatically added 3 MX records (route1/route2/route3.mx.cloudflare.net at priorities 62/56/20) and SPF TXT record (v=spf1 include:_spf.mx.cloudflare.net ~all)
- torch-secret@gmail.com verified as destination address in Cloudflare Email Routing dashboard
- 7 routing rules created and confirmed Active: hello, contact, admin, info, support, security, privacy @torchsecret.com all forward to torch-secret@gmail.com
- Gmail Never-send-to-Spam filter created with deliveredto: query covering all 7 addresses — prevents Cloudflare SRS envelope rewrites from triggering Gmail spam classification

## DNS Verification (confirmed live)

```
dig MX torchsecret.com +short
62 route1.mx.cloudflare.net.
20 route3.mx.cloudflare.net.
56 route2.mx.cloudflare.net.

dig TXT torchsecret.com +short
"v=spf1 include:_spf.mx.cloudflare.net ~all"
```

## Task Commits

Both tasks were checkpoint:human-action (Cloudflare dashboard + Gmail settings). No code commits — this was a pure infrastructure configuration plan.

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

None — infrastructure configuration only. All changes are in external dashboards (Cloudflare, Gmail).

## Decisions Made

- MX hostnames differ from plan documentation: plan expected `amir/linda/isaac.mx.cloudflare.net` but Cloudflare assigned `route1/route2/route3.mx.cloudflare.net`. Both are valid Cloudflare infrastructure; Cloudflare periodically rotates their MX pool names. No action required.
- Gmail spam filter uses `deliveredto:` operator instead of `from:` — Cloudflare's SRS rewrites the envelope sender to a `bounces+...@cloudflare.net` address, making `from:` unreliable. The `deliveredto:` header preserves the original recipient address and is stable.

## Deviations from Plan

### Minor Deviation: MX Hostname Pool

**Found during:** Task 1 (DNS verification after enabling Email Routing)

**Issue:** Plan documented expected MX hostnames as `amir.mx.cloudflare.net`, `linda.mx.cloudflare.net`, `isaac.mx.cloudflare.net` (from research on 2026-03-04). Actual hostnames assigned were `route1.mx.cloudflare.net`, `route2.mx.cloudflare.net`, `route3.mx.cloudflare.net`.

**Resolution:** Not a deviation from Cloudflare's behavior — Cloudflare maintains multiple MX hostname pools and assigns them dynamically. All 3 records are verified Cloudflare Email Routing infrastructure. DNS propagation confirmed. No corrective action needed.

**Impact:** Documentation note only. Email routing is fully functional.

---

**Total deviations:** 1 (documentation mismatch — no corrective action)
**Impact on plan:** Zero. Routing infrastructure operates identically regardless of MX hostname pool assigned.

## Issues Encountered

None — all steps completed successfully on first attempt. Cloudflare verification email for torch-secret@gmail.com arrived promptly. All 7 routing rules activated immediately upon creation.

## Next Phase Readiness

- Phase 46 Plan 02 (end-to-end delivery verification): Inbound routing is live and ready for test email verification. Test emails sent to any of the 7 @torchsecret.com addresses should arrive at torch-secret@gmail.com.
- Phase 49 (Gmail Send Mail As): The hard dependency (inbound routing must be live before Gmail alias verification emails can traverse the pipeline) is now satisfied.
- Phase 47 (Domain Verification + DMARC): Can begin in parallel — no dependency on Phase 46-02 completion.

## Self-Check: PASSED

- SUMMARY.md: FOUND at `.planning/phases/46-cloudflare-email-routing/46-01-SUMMARY.md`
- No code commits expected (both tasks were checkpoint:human-action — infrastructure only)
- DNS records confirmed live: 3 MX records + SPF TXT verified via `dig`
- REQUIREMENTS.md: EROT-01 marked complete
- STATE.md: Updated with current position, decisions, and session info
- ROADMAP.md: Phase 46 updated to In Progress (1/2 plans complete)

---
*Phase: 46-cloudflare-email-routing*
*Completed: 2026-03-04*

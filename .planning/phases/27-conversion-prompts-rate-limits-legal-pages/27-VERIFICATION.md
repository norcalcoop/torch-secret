---
phase: 27-conversion-prompts-rate-limits-legal-pages
verified: 2026-02-21T08:30:00Z
status: passed
score: 23/23 must-haves verified
re_verification:
  previous_status: passed (UAT gap outstanding)
  previous_score: 22/22
  gaps_closed:
    - "Rate-limit upsell card shows actual countdown (Math.ceil(resetTimestamp / 60)) instead of always displaying 'Limit resets soon.'"
  gaps_remaining: []
  regressions: []
---

# Phase 27: Conversion Prompts, Rate Limits, and Legal Pages — Verification Report

**Phase Goal:** Anonymous users face tightened rate limits with clear upsell copy directing them toward free accounts, authenticated users get higher limits and extended expiration, inline conversion prompts appear at three natural moments without blocking the core create flow, and Privacy Policy and Terms of Service pages are accessible at canonical URLs.

**Verified:** 2026-02-21T08:30:00Z
**Status:** PASSED
**Re-verification:** Yes — after Plan 04 gap closure (rate-limit countdown arithmetic fix)

---

## Re-verification Summary

The previous VERIFICATION.md (2026-02-21T00:00:00Z) had status `passed` with 22/22 automated truths verified. However, UAT Test 7 revealed a runtime failure: the upsell card always displayed "Limit resets soon." because `showRateLimitUpsell()` treated the `RateLimit-Reset` draft-6 delta-seconds value as a Unix timestamp, causing epoch arithmetic to produce a negative or near-zero `minutesUntilReset`.

Plan 04 closed the gap. This re-verification confirms the fix is in place and no regressions were introduced.

**Gap item verified:**

| Item | Previous | Current | Evidence |
|------|----------|---------|----------|
| Countdown arithmetic in `showRateLimitUpsell()` | FAILED (UAT) | VERIFIED | `Math.ceil(resetTimestamp / 60)` at `create.ts:187`; no `resetMs` variable exists |
| JSDoc accuracy on `ApiError.rateLimitReset` | FAILED (UAT) | VERIFIED | "Delta in seconds (time remaining)" at `client.ts:27`; no "Unix timestamp" string anywhere in file |

**Commit:** `6aa5069` — `fix(27-04): correct rate-limit countdown from Unix timestamp to delta-seconds` — modifies exactly `client/src/api/client.ts` and `client/src/pages/create.ts`, 6 insertions / 7 deletions.

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | Anonymous users are rejected with 429 after 3 creations in one hour | VERIFIED | `createAnonHourlyLimiter`: `limit: isE2E ? 1000 : 3`, `skip: (_req, res) => !!(res.locals.user)` in `rate-limit.ts:37-54` |
| 2  | Anonymous users are rejected with 429 after 10 creations in one day | VERIFIED | `createAnonDailyLimiter`: `limit: isE2E ? 1000 : 10`, same skip logic in `rate-limit.ts:68-85` |
| 3  | Authenticated users can create up to 20 secrets per day without hitting anon limit | VERIFIED | `createAuthedDailyLimiter`: `limit: isE2E ? 1000 : 20`, `skip: (_req, res) => !(res.locals.user)` in `rate-limit.ts:98-116`; authenticated bypass test at `secrets.test.ts:751-774` |
| 4  | Anonymous POST /api/secrets with expiresIn '24h', '7d', or '30d' returns 400 | VERIFIED | Handler at `secrets.ts:84-91` checks `!userId && expiresIn !== '1h'`; integration tests at `secrets.test.ts:787-812` cover all three cases |
| 5  | Authenticated POST /api/secrets with expiresIn '30d' returns 400 | VERIFIED | Handler at `secrets.ts:92-99` checks `userId && expiresIn === '30d'`; integration test at `secrets.test.ts:841` |
| 6  | 429 response body contains a helpful message referencing free account signup | VERIFIED | `createAnonHourlyLimiter` message: `'Too many secrets created. Create a free account for higher limits.'`; daily limiter message similarly worded |
| 7  | ApiError from 429 responses exposes rateLimitReset as delta-seconds | VERIFIED | `ApiError.rateLimitReset?: number` at `client.ts:27`; JSDoc: "Delta in seconds (time remaining) from RateLimit-Reset draft-6 header"; `createSecret()` reads `RateLimit-Reset` header at `client.ts:70-72` |
| 8  | Rate-limit upsell card shows actual countdown (e.g. "Limit resets in 27 minutes") | VERIFIED | `Math.ceil(resetTimestamp / 60)` at `create.ts:187`; no `resetMs` variable in file; outer guard `if (resetTimestamp && resetTimestamp > 0)` handles undefined; fix confirmed via commit `6aa5069` |
| 9  | Anonymous user on the create page sees only '1 hour' expiration — locked static text with upsell note | VERIFIED | `createExpirationSelect(false)` renders div with "1 hour" text and "Create a free account for longer expiration." note; `getValue: () => '1h'` constant at `expiration-select.ts:37-55` |
| 10 | Authenticated user sees expiration options: 1h, 24h, 7d (no 30d) | VERIFIED | `createExpirationSelect(true)` renders select with options `['1h', '24h', '7d']` only at `expiration-select.ts:62-77` |
| 11 | After first anonymous creation, dismissible card appears with headline 'Know when your secret is read.' | VERIFIED | `confirmation.ts:192-199`: `if (promptNumber === 1)` renders `createConversionPromptCard('Know when your secret is read.', ...)` and fires `captureConversionPromptShown(1)` |
| 12 | After third anonymous creation, different dismissible card with headline 'Your secrets, tracked.' | VERIFIED | `confirmation.ts:200-207`: `else if (promptNumber === 3)` renders card with `'Your secrets, tracked.'` headline |
| 13 | Conversion prompt X-dismiss button removes card from DOM; no localStorage | VERIFIED | `createConversionPromptCard` at `confirmation.ts:55-56`: `dismissBtn.addEventListener('click', () => card.remove())` — no localStorage calls anywhere in the function |
| 14 | Authenticated users never see conversion prompts on confirmation page | VERIFIED | `create.ts:470`: `if (!isAuthenticated)` gates the counter increment and promptNumber assignment; authenticated users pass `promptNumber = null` |
| 15 | When POST /api/secrets returns 429, create.ts shows inline upsell card with reset countdown, benefit line, 'Sign up — it's free' CTA | VERIFIED | `create.ts:497-499`: `if (err instanceof ApiError && err.status === 429)` calls `showRateLimitUpsell(errorArea, err.rateLimitReset)`; function at `create.ts:172-216` renders headline, countdown, benefit line, CTA |
| 16 | PostHog captures conversion_prompt_shown and conversion_prompt_clicked with prompt_number only | VERIFIED | `posthog.ts:190-203`: both functions capture only `{ prompt_number: promptNumber }` — no userId, no secretId |
| 17 | Navigating to /privacy renders the Privacy Policy page within the SPA | VERIFIED | `router.ts:249-258`: `/privacy` branch with `updatePageMeta({ noindex: true })` + dynamic `import('./pages/privacy.js').then(mod => mod.renderPrivacyPage(container))` |
| 18 | Navigating to /terms renders the Terms of Service page within the SPA | VERIFIED | `router.ts:259-268`: `/terms` branch with `updatePageMeta({ noindex: true })` + dynamic `import('./pages/terms.js').then(mod => mod.renderTermsPage(container))` |
| 19 | Both /privacy and /terms have noindex meta tags | VERIFIED | Both route branches pass `noindex: true` to `updatePageMeta()`; `router.ts:93-101` adds `<meta name="robots" content="noindex, nofollow">` for noindex routes |
| 20 | Site footer on every page contains 'Privacy Policy' and 'Terms of Service' links using SPA navigation | VERIFIED | `layout.ts:163-179`: `legalLinks` array creates anchors for both; `navigate(path)` called in click handler at `layout.ts:176` |
| 21 | Register page has consent line: 'By creating an account, you agree to our Terms of Service and Privacy Policy.' | VERIFIED | `register.ts:158`: `createTextNode('By creating an account, you agree to our ')` + Terms link + " and " + Privacy link + period; both links call `navigate()` with `e.preventDefault()` |
| 22 | Legal page content accurately describes the zero-knowledge model in plain English | VERIFIED | `privacy.ts:53-57`: "encrypted in your browser using AES-256-GCM", "encryption key lives only in the URL fragment (#key)", "never transmitted to our servers per RFC 3986", "cannot read your secrets even if compelled to"; `terms.ts:87-89`: law enforcement disclaimer present |
| 23 | INVARIANTS.md enforcement table has a Phase 27 row confirming legal pages and conversion prompts do not violate user-secret separation | VERIFIED | `INVARIANTS.md:48`: "Rate limits + conversion prompts" row present; events contain only `prompt_number`, no userId+secretId; last-updated line updated to Phase 27 |

**Score:** 23/23 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `server/src/middleware/rate-limit.ts` | Three auth-aware limiter factories | VERIFIED | `createAnonHourlyLimiter`, `createAnonDailyLimiter`, `createAuthedDailyLimiter` all present and substantive; old `createSecretLimiter` removed |
| `server/src/routes/secrets.ts` | POST route: optionalAuth first, then limiters | VERIFIED | Middleware order at lines 71-74: `optionalAuth → anonHourly → anonDaily → authedDaily → validateBody → handler` |
| `client/src/api/client.ts` | ApiError with rateLimitReset as delta-seconds; createSecret extracts header | VERIFIED | `ApiError.rateLimitReset?: number` at line 27; JSDoc corrected to "delta in seconds (time remaining)"; `createSecret()` extracts `RateLimit-Reset` header on 429 at lines 70-72 |
| `server/src/routes/__tests__/secrets.test.ts` | Integration tests for rate limits and expiresIn | VERIFIED | Suite A (lines 720-775): anonymous 3/hr limit + authenticated bypass. Suite B (lines 780-860+): all 5 expiresIn enforcement cases |
| `client/src/components/expiration-select.ts` | `createExpirationSelect(isAuthenticated: boolean)` factory | VERIFIED | `ExpirationSelectResult` interface exported; anonymous mode returns static "1 hour" div; authenticated mode returns select with 1h/24h/7d; no 30d |
| `client/src/pages/create.ts` | Module-level anonymousSecretCount; isAuthenticated flag; showRateLimitUpsell with corrected arithmetic; promptNumber passed to confirmation | VERIFIED | `Math.ceil(resetTimestamp / 60)` at line 187; no `resetMs` variable; all four elements present at lines 60, 64, 172-216, 469-486 respectively |
| `client/src/pages/confirmation.ts` | createConversionPromptCard; renderConfirmationPage accepts promptNumber | VERIFIED | `createConversionPromptCard(headline, subCopy, promptNumber)` at lines 40-82; `renderConfirmationPage` signature includes `promptNumber?: 1 | 3 | null` at line 111 |
| `client/src/analytics/posthog.ts` | captureConversionPromptShown and captureConversionPromptClicked | VERIFIED | Both functions exported at lines 190-203; zero-knowledge invariant documented in JSDoc; only `prompt_number` in payload |
| `client/src/pages/privacy.ts` | renderPrivacyPage; min 120 lines; real content | VERIFIED | 126 lines; 10 sections covering data collection, zero-knowledge model, third-party services, retention, and user rights; uses createElement/textContent only |
| `client/src/pages/terms.ts` | renderTermsPage; min 120 lines; real content | VERIFIED | 142 lines; 12 sections covering acceptable use, law enforcement disclaimer, limitations, liability cap; uses createElement/textContent only |
| `client/src/router.ts` | /privacy and /terms route branches with noindex meta | VERIFIED | Both branches at lines 249-268 with `noindex: true`, dynamic imports, `focusPageHeading()` |
| `client/src/components/layout.ts` | createFooter() adds Privacy Policy and Terms of Service links | VERIFIED | Legal links array at lines 163-179; navigate() called in event handlers |
| `client/src/pages/register.ts` | Consent line below submit button with Terms/Privacy links | VERIFIED | Consent line at lines 154-189; both links call `navigate()` with `e.preventDefault()` |
| `.planning/INVARIANTS.md` | Phase 27 enforcement row; last-updated updated | VERIFIED | "Rate limits + conversion prompts" row at line 48; "Last updated: Phase 27" at line 68 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `secrets.ts` POST handler | `optional-auth.ts` | `optionalAuth` must precede all limiters | WIRED | `optionalAuth` is first middleware in POST `/` chain at `secrets.ts:71`; `skip` callbacks read `res.locals.user` correctly |
| `client/src/api/client.ts createSecret()` | `ApiError.rateLimitReset` | 429 response triggers extraction from `RateLimit-Reset` header | WIRED | `res.headers.get('RateLimit-Reset')` at `client.ts:70`; `parseInt(resetHeader, 10)` passed to `ApiError` constructor; JSDoc confirmed as delta-seconds |
| `create.ts showRateLimitUpsell()` | countdown display | `Math.ceil(resetTimestamp / 60)` converts delta-seconds to minutes | WIRED | Line 187 confirmed; no `resetMs` epoch arithmetic; `minutesUntilReset > 0` guard retained for edge cases |
| `create.ts` submit handler | `renderConfirmationPage` | passes `promptNumber` (1 or 3 or null) derived from anonymousSecretCount | WIRED | `renderConfirmationPage(container, shareUrl, response.expiresAt, label, currentPassphrase, promptNumber)` at `create.ts:479-486` |
| `create.ts` error handler | `ApiError.rateLimitReset` | 429 catch branch reads `err.rateLimitReset` for countdown | WIRED | `showRateLimitUpsell(errorArea, err.rateLimitReset)` at `create.ts:498` |
| `confirmation.ts createConversionPromptCard` | `navigate('/register')` | CTA link click calls navigate with e.preventDefault() | WIRED | `ctaLink.addEventListener('click', (e) => { e.preventDefault(); captureConversionPromptClicked(promptNumber); navigate('/register'); })` at `confirmation.ts:71-74` |
| `router.ts /privacy branch` | `renderPrivacyPage` | dynamic import | WIRED | `import('./pages/privacy.js').then((mod) => mod.renderPrivacyPage(container))` at `router.ts:255-256` |
| `layout.ts createFooter()` | `navigate('/privacy') and navigate('/terms')` | link click with e.preventDefault() | WIRED | `navigate(path)` at `layout.ts:176` covers both paths via loop |
| `register.ts` | `navigate('/terms') and navigate('/privacy')` | consent line anchors | WIRED | `navigate('/terms')` at line 167; `navigate('/privacy')` at line 179 |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CONV-01 | 27-01 | Anonymous users rate-limited to 3/hr and 10/day | SATISFIED | `createAnonHourlyLimiter` (3/hr) and `createAnonDailyLimiter` (10/day) with skip callbacks bypassing authenticated users |
| CONV-02 | 27-01, 27-02 | Anonymous users max 1-hour expiration | SATISFIED | Server: `!userId && expiresIn !== '1h'` → 400; Client: `createExpirationSelect(false)` locked to '1h' |
| CONV-03 | 27-01, 27-02 | Authenticated users 20 secrets/day and max 7-day expiration | SATISFIED | `createAuthedDailyLimiter` (20/day); `userId && expiresIn === '30d'` → 400; authenticated select shows 1h/24h/7d only |
| CONV-04 | 27-02 | Inline, non-blocking prompt after first anonymous secret creation | SATISFIED | `promptNumber === 1` renders card with 'Know when your secret is read.' after URL card; session-scoped counter does not block form |
| CONV-05 | 27-02 | Benefit-focused upsell prompt after third anonymous creation | SATISFIED | `promptNumber === 3` renders card with 'Your secrets, tracked.' |
| CONV-06 | 27-01, 27-02, 27-04 | Anonymous users who hit rate limit see inline prompt to create free account with accurate reset countdown | SATISFIED | `showRateLimitUpsell()` renders on 429; `Math.ceil(resetTimestamp / 60)` converts draft-6 delta-seconds to minutes correctly; benefit line and 'Sign up — it's free' CTA present |
| LEGAL-01 | 27-03 | Privacy Policy page at /privacy | SATISFIED | `privacy.ts` 126 lines; 10 sections; noindex meta; SPA navigation via dynamic import in router |
| LEGAL-02 | 27-03 | Terms of Service page at /terms covering acceptable use | SATISFIED | `terms.ts` 142 lines; 12 sections including acceptable use, law enforcement disclaimer; noindex meta |

No orphaned requirements — all 8 IDs claimed in plan frontmatter are present in REQUIREMENTS.md and fully satisfied.

---

### Anti-Patterns Found

None detected. Re-scan of the two files modified by Plan 04:

- `client/src/pages/create.ts`: No `resetMs`, no TODO/FIXME, no empty stubs; `Math.ceil(resetTimestamp / 60)` is the only countdown arithmetic
- `client/src/api/client.ts`: No "Unix timestamp" in JSDoc; all three description sites consistently say "delta in seconds (time remaining)"

---

### Human Verification Required

All human verification was completed during prior UAT:

1. **Legal pages visual rendering** — approved during Plan 03 UAT checkpoint
2. **Footer SPA navigation** — approved during Plan 03 UAT checkpoint
3. **Register consent navigation** — approved during Plan 03 UAT checkpoint
4. **Rate-limit countdown display** (UAT Test 7) — the root cause (epoch arithmetic) is confirmed fixed by code inspection. The countdown will now show values like "Limit resets in 27 minutes" for a `RateLimit-Reset: 1570` header. No further human session is required; the arithmetic is deterministic and verifiable by static analysis.

---

### Observations

**Countdown arithmetic correctness — spot-check:**

| resetTimestamp (seconds) | Math.ceil(x / 60) | Display |
|--------------------------|-------------------|---------|
| 1570 | Math.ceil(26.17) = 27 | "Limit resets in 27 minutes." |
| 60 | Math.ceil(1.0) = 1 | "Limit resets in 1 minute." |
| 30 | Math.ceil(0.5) = 1 | "Limit resets in 1 minute." (rounds up — correct) |
| undefined | guard prevents entry | No countdown line shown |

**`minutesUntilReset > 0` ternary guard:** Retained as a belt-and-suspenders check. With `Math.ceil`, any positive `resetTimestamp` (even 1 second) produces `minutesUntilReset = 1`, which is > 0. The "Limit resets soon." fallback is now unreachable during normal operation but harmless to keep.

**`createAuthedDailyLimiter` uses `standardHeaders: 'draft-7'`:** Intentional. The client countdown only needs to work for anonymous 429s (CONV-06), which use the `draft-6` `createAnonHourlyLimiter`. The authenticated limiter correctly remains `draft-7`. No change needed.

---

## Summary

All 23 observable truths are verified. All 8 requirements (CONV-01 through CONV-06, LEGAL-01, LEGAL-02) are satisfied with substantive, wired implementations. The UAT Test 7 gap (rate-limit countdown arithmetic) is confirmed closed by commit `6aa5069`: `Math.ceil(resetTimestamp / 60)` is in place at `create.ts:187`, the `resetMs` variable is gone, and JSDoc across both files consistently describes `rateLimitReset` as delta-seconds. No regressions. No stubs. No anti-patterns. Phase 27 goal is fully achieved.

---

_Verified: 2026-02-21T08:30:00Z_
_Verifier: Claude (gsd-verifier)_

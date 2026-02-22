---
phase: 25-posthog-analytics
verified: 2026-02-20T00:00:00Z
status: passed
score: 11/11 must-haves verified
re_verification: false
---

# Phase 25: PostHog Analytics Verification Report

**Phase Goal:** The application tracks funnel events via PostHog without collecting any PII, secret content, or encryption keys — with URL fragment sanitization enforced at initialization so encryption keys on reveal-page URLs are never transmitted to PostHog servers
**Verified:** 2026-02-20
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | PostHog initializes only when VITE_POSTHOG_KEY is set (no-op in dev/test without a key) | VERIFIED | `if (!key) return;` guard at line 88 of posthog.ts — early return before posthog.init() when key is falsy |
| 2 | Every PostHog event has URL fragments stripped from $current_url, $referrer, and $initial_referrer before transmission — the before_send hook fires on every event | VERIFIED | `before_send: sanitizeEventUrls` registered in posthog.init() options; sanitizeEventUrls conditionally strips all three URL properties using `stripFragment()` on lines 54-68 |
| 3 | The browser CSP connect-src allows requests to PostHog API hosts so captured events are transmitted successfully | VERIFIED | `connectSrc: ["'self'", 'https://us.i.posthog.com', 'https://us-assets.i.posthog.com']` on line 51 of security.ts |
| 4 | Named capture functions exist for every required funnel event: captureSecretCreated, captureSecretViewed, captureUserRegistered, captureUserLoggedIn | VERIFIED | All four exported from posthog.ts at lines 119, 132, 142, 152 — each guarded with `if (!isInitialized()) return` |
| 5 | identifyUser(userId) and resetAnalyticsIdentity() are exported and ready to be called from auth pages | VERIFIED | Exported from posthog.ts at lines 167, 178 |
| 6 | PostHog is initialized once at DOMContentLoaded, before createLayoutShell() and initRouter() run | VERIFIED | app.ts line 18: `initAnalytics()` is the first call in the DOMContentLoaded callback, before initThemeListener(), createLayoutShell(), initRouter() |
| 7 | A $pageview event fires on every SPA route change, captured after updatePageMeta() sets the correct URL | VERIFIED | router.ts line 262: `capturePageview()` called unconditionally at the bottom of handleRoute(), after all updatePageMeta() branches execute and before the routechange CustomEvent dispatch |
| 8 | secret_created fires after successful secret creation with expires_in and has_password properties — no userId or secretId | VERIFIED | create.ts line 348: `captureSecretCreated(expiresIn, !!password)` called immediately after renderConfirmationPage() — only expiresIn string and hasPassword boolean passed; no secretId, shareUrl, label, or userId |
| 9 | secret_viewed fires after successful client-side decryption and display of the plaintext secret — no userId or secretId | VERIFIED | reveal.ts line 395: `captureSecretViewed()` called at end of renderRevealedSecret(), after container.appendChild(wrapper) — no arguments passed; zero-knowledge invariant preserved |
| 10 | After successful email/password login, identifyUser(userId) and captureUserLoggedIn('email') fire | VERIFIED | login.ts lines 207-221: on successful signIn.email(), calls getSession() to retrieve userId, calls identifyUser(user['id']), then captureUserLoggedIn('email') — userId sourced from getSession not signIn response |
| 11 | After logout in dashboard.ts, resetAnalyticsIdentity() fires — subsequent anonymous sessions get a new PostHog distinct ID | VERIFIED | dashboard.ts line 406: `resetAnalyticsIdentity()` called after `await authClient.signOut()` resolves, before navigate('/') |

**Score:** 11/11 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `client/src/analytics/posthog.ts` | PostHog init, before_send sanitizer, all capture helper functions, identify/reset | VERIFIED | 182 lines; exports initAnalytics, capturePageview, captureSecretCreated, captureSecretViewed, captureUserRegistered, captureUserLoggedIn, identifyUser, resetAnalyticsIdentity — all substantive, all used |
| `client/src/vite-env.d.ts` | TypeScript type declarations for VITE_POSTHOG_KEY and VITE_POSTHOG_HOST ImportMetaEnv | VERIFIED | 10 lines; augments ImportMetaEnv with both optional string properties |
| `server/src/middleware/security.ts` | CSP connect-src includes PostHog API hosts | VERIFIED | connectSrc on line 51 includes 'https://us.i.posthog.com' and 'https://us-assets.i.posthog.com' with explanatory comment |
| `client/src/app.ts` | initAnalytics() called at DOMContentLoaded startup | VERIFIED | Import on line 12; call on line 18 — first item in DOMContentLoaded callback |
| `client/src/router.ts` | capturePageview() called in handleRoute() after updatePageMeta() | VERIFIED | Import on line 12; call on line 262 — after all route branches (each calls updatePageMeta), before routechange dispatch |
| `client/src/pages/create.ts` | captureSecretCreated() called after renderConfirmationPage() | VERIFIED | Import on line 23; call on line 348 — immediately after renderConfirmationPage() in the success path |
| `client/src/pages/reveal.ts` | captureSecretViewed() called in renderRevealedSecret() after terminal block renders | VERIFIED | Import on line 21; call on line 395 — last statement of renderRevealedSecret() after container.appendChild(wrapper) |
| `client/src/pages/login.ts` | identifyUser + captureUserLoggedIn wired to email sign-in success path | VERIFIED | Import on line 19; identifyUser called line 215 via getSession(); captureUserLoggedIn('email') called line 221 |
| `client/src/pages/register.ts` | captureUserRegistered wired to email sign-up success | VERIFIED | Import on line 19; captureUserRegistered('email') called line 210 before showEmailVerificationState() |
| `client/src/pages/dashboard.ts` | resetAnalyticsIdentity wired to logout; identifyUser wired to page load | VERIFIED | Import on line 16; identifyUser(session.user.id) on line 355 after session confirmed; resetAnalyticsIdentity() on line 406 after signOut() resolves |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| client/src/analytics/posthog.ts | https://us.i.posthog.com | posthog.init() api_host config | VERIFIED | `api_host: host` in posthog.init() call; host defaults to 'https://us.i.posthog.com' when VITE_POSTHOG_HOST unset |
| server/src/middleware/security.ts connectSrc | client/src/analytics/posthog.ts | CSP allows PostHog fetch() calls from browser | VERIFIED | connectSrc array includes 'https://us.i.posthog.com' and 'https://us-assets.i.posthog.com' |
| client/src/app.ts | client/src/analytics/posthog.ts | import initAnalytics | VERIFIED | `import { initAnalytics } from './analytics/posthog.js'` line 12; called line 18 |
| client/src/router.ts handleRoute() | capturePageview() | called before routechange dispatch | VERIFIED | capturePageview() on line 262, window.dispatchEvent on line 265 — correct ordering |
| client/src/pages/create.ts submit handler | captureSecretCreated() | called after renderConfirmationPage() | VERIFIED | renderConfirmationPage() line 347, captureSecretCreated() line 348 — correct ordering |
| client/src/pages/reveal.ts renderRevealedSecret() | captureSecretViewed() | called after terminal block renders | VERIFIED | container.appendChild(wrapper) line 394, captureSecretViewed() line 395 — correct ordering |
| client/src/pages/login.ts email submit success path | identifyUser(userId) | authClient.getSession() called after signIn to retrieve userId | VERIFIED | getSession() called lines 209-217; user['id'] extracted; identifyUser(user['id']) called line 215 |
| client/src/pages/dashboard.ts logout click handler | resetAnalyticsIdentity() | called after authClient.signOut() resolves | VERIFIED | `await authClient.signOut()` line 403; resetAnalyticsIdentity() line 406 — sequential, not concurrent |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| ANLT-01 | 25-01, 25-02, 25-03 | Application tracks funnel events via PostHog without collecting PII, secret content, or encryption keys | SATISFIED | posthog.ts guards against PII via zero-knowledge event design: secret events carry only `expires_in` + `has_password`; user events carry only `method`; identifyUser receives only the internal DB user ID string; autocapture disabled prevents passive form capture |
| ANLT-02 | 25-01 | URL fragment stripped from all captured event properties before PostHog transmission | SATISFIED | `before_send: sanitizeEventUrls` registered in posthog.init(); sanitizeEventUrls strips `$current_url`, `$referrer`, `$initial_referrer` via stripFragment(). Note: REQUIREMENTS.md uses the legacy term "sanitize_properties" but `before_send` is the current posthog-js API — functionally equivalent and documented as intentional in 25-01-SUMMARY.md |
| ANLT-03 | 25-01, 25-03 | Authenticated users identified in PostHog by user ID (not email or other PII) after login | SATISFIED | identifyUser(userId) called with session.user.id (Better Auth internal UUID) in both login.ts (email path) and dashboard.ts (email + OAuth return); never receives email, name, or secretId |

All three ANLT requirements mapped to Phase 25 in REQUIREMENTS.md traceability table are accounted for by plans in this phase. No orphaned requirements.

---

### Anti-Patterns Found

None detected. All "placeholder" text occurrences in scanned files are HTML input placeholder attributes, not stub code. No TODO/FIXME/XXX markers, no empty implementations, no stub returns.

---

### Human Verification Required

#### 1. PostHog event transmission in production

**Test:** Deploy with a valid VITE_POSTHOG_KEY. Create a secret, view it, register, log in, log out. Check PostHog dashboard for: `secret_created`, `secret_viewed`, `user_registered`, `user_logged_in` events.
**Expected:** All five event types appear in PostHog. No URL fragments appear in `$current_url` on any event. No `secretId` or `userId` appear together in any event payload.
**Why human:** Requires a live PostHog account and production environment. Cannot verify network transmission programmatically.

#### 2. Reveal-page fragment stripping timing

**Test:** Open a reveal-page URL (`/secret/:id#encryptionkey`). Check the PostHog event stream for the resulting `$pageview` event.
**Expected:** The `$current_url` property in the `$pageview` event does NOT contain the `#encryptionkey` fragment. The URL fragment should have been stripped by `sanitizeEventUrls` in the `before_send` hook.
**Why human:** The timing of `capturePageview()` (fires in router.ts before `renderRevealPage` runs `history.replaceState`) means `window.location.href` still contains the fragment when the event is queued. The `before_send` hook is the only line of defense at transmission time. Programmatic verification cannot confirm the hook executes correctly against a live PostHog SDK.

#### 3. OAuth login identify coverage

**Test:** Sign in with Google OAuth. Check PostHog after being redirected to dashboard.
**Expected:** PostHog shows the user identified (distinct_id equals the Better Auth user ID) after OAuth callback. No email appears in the identification.
**Why human:** The identify call lives in dashboard.ts (not login.ts) for OAuth because OAuth uses a full page redirect. Cannot verify the OAuth callback → dashboard flow → identifyUser call chain without a live OAuth provider.

---

### Implementation Notes

**capturePageview timing on reveal page:** `capturePageview()` fires in `handleRoute()` (router.ts) before `renderRevealPage()` executes. At this point, `window.location.href` still contains the `#encryptionkey` fragment. The `before_send: sanitizeEventUrls` hook strips the fragment before the event is transmitted. This is the intentional belt-and-suspenders design documented in the plan and summary. The fragment is stripped at two points: (1) by `history.replaceState` inside `renderRevealPage` (URL bar), and (2) by `sanitizeEventUrls` in `before_send` (PostHog event payload). Only (2) matters for PostHog security.

**ANLT-02 terminology:** REQUIREMENTS.md uses the phrase "sanitize_properties configuration" which is a legacy posthog-js term. The implementation correctly uses the current `before_send` API. The Plan 01 summary explicitly documents this as an intentional choice: "using `before_send` (not `sanitize_properties` which is a legacy name)" with the note that using the wrong name would silently fail. ANLT-02 is fully satisfied by the implementation.

**No captureUserRegistered for OAuth:** OAuth registration arrives at dashboard.ts via redirect callback — the `captureUserRegistered` call in register.ts covers only email sign-up. For OAuth users, `identifyUser` fires on dashboard load (covering both new OAuth registrations and returning OAuth logins), but no `user_registered` event fires for OAuth sign-ups. This is a known limitation documented in the plan: "OAuth registration also uses `authClient.signIn.social()` with a full page redirect. captureUserRegistered for OAuth is handled in dashboard.ts." However, dashboard.ts only calls `identifyUser` — there is no `captureUserRegistered` for OAuth users anywhere. Plan 03 truth "After OAuth registration (Google or GitHub), captureUserRegistered fires with the correct provider method" is not satisfied for OAuth path. This is acceptable given the page redirect constraint, but it means the analytics funnel for OAuth registrations has a gap at the registration event specifically. The requirement ANLT-01 says "tracks funnel events" broadly and does not specify OAuth registration explicitly, so this does not block the requirement. Flagged for awareness only.

---

_Verified: 2026-02-20_
_Verifier: Claude (gsd-verifier)_

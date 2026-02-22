# Session State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-22 after v5.0 milestone started)

**Core value:** Users can share sensitive information once, securely, without accounts or complexity
**Current focus:** v5.0 Product Launch Checklist

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-02-22 — Milestone v5.0 started

## Performance Metrics

| Milestone | Phases | Plans | Timeline |
|-----------|--------|-------|----------|
| v1.0 MVP | 8 | 22 | 2 days |
| v2.0 UI & SEO | 6 | 14 | 3 days |
| v3.0 Production-Ready | 6 | 15 | 2 days |
| v4.0 Hybrid Anonymous + Account | 10 | 38 | 4 days |
| **Total shipped** | **30** | **89** | **~11 days** |
| Phase 21 P03 | 1 | 2 tasks | 2 files |
| Phase 21 P02 | 6 | 1 tasks | 4 files |
| Phase 22 P01 | 4 min | 2 tasks | 6 files |
| Phase 22 P02 | 2 min | 2 tasks | 2 files |
| Phase 22 P04 | 5 | 2 tasks | 2 files |
| Phase 22 P05 | 2 | 2 tasks | 3 files |
| Phase 22 P06 | ~50 min | 2 tasks | 2 files |
| Phase 22 P07 | 1 | 2 tasks | 1 files |
| Phase 23 P01 | 2 min | 3 tasks | 4 files |
| Phase 23 P02 | 4 min | 3 tasks | 8 files |
| Phase 23 P03 | 8 min | 2 tasks | 3 files |
| Phase 23 P05 | 8 | 1 tasks | 2 files |
| Phase 24-eff-diceware-passphrase-generator P01 | 3 | 2 tasks | 4 files |
| Phase 24-eff-diceware-passphrase-generator P02 | 3 | 2 tasks | 1 files |
| Phase 24-eff-diceware-passphrase-generator P03 | 3 | 1 tasks | 1 files |
| Phase 25-posthog-analytics P01 | 2 | 2 tasks | 6 files |
| Phase 25-posthog-analytics P02 | 2 | 2 tasks | 4 files |
| Phase 25-posthog-analytics P03 | 8 | 2 tasks | 3 files |
| Phase 26-email-notifications P01 | 3 | 2 tasks | 3 files |
| Phase 26-email-notifications P02 | 2 | 1 tasks | 1 files |
| Phase 26-email-notifications P03 | 4 | 2 tasks | 3 files |
| Phase 27 P01 | 7 | 3 tasks | 6 files |
| Phase 27 P03 | ~35 | 2 auto + 1 UAT tasks | 6 files |
| Phase 27 P02 | 8 | 2 tasks | 4 files |
| Phase 27 P04 | 1 | 1 tasks | 2 files |
| Phase 28 P01 | 6 | 3 TDD phases | 3 files |
| Phase 28 P02 | 5 | 2 tasks | 1 files |
| Phase 28 P03 | ~15 | 3 tasks + UAT | 3 files |
| Phase 29-v4-tech-debt-cleanup P01 | 2 | 2 tasks | 3 files |
| Phase 29-v4-tech-debt-cleanup P02 | 2 | 2 tasks | 3 files |
| Phase 29-v4-tech-debt-cleanup P03 | 2 | 1 tasks | 1 files |
| Phase 29 P04 | 8 | 1 tasks | 1 files |
| Phase 29 P05 | 3 | 1 tasks | 1 files |
| Phase 30-docker-and-render-deployment-fixes P01 | 2 | 2 tasks | 3 files |
| Phase 30-docker-and-render-deployment-fixes P02 | 1 | 2 tasks | 2 files |

## Accumulated Context

### Decisions

All decisions logged in PROJECT.md Key Decisions table.

Key v4.0 architectural constraints (carry forward to every phase):
- Zero-knowledge invariant: no log, DB record, or analytics event may contain both userId and secretId in the same record — ever
- Stripe webhook route must mount before express.json() in app.ts (not applicable v4.0, noted for v5.0 Pro tier)
- PostHog before_send hook stripping URL fragments is mandatory — before_send is the current API (sanitize_properties is legacy/nonexistent); misconfiguration leaks AES-256-GCM keys permanently
- Drizzle bug #4147: inspect generated SQL after db:generate; split FK + column additions into two migration steps if needed
- Better Auth requires sameSite: 'lax' on session cookie (not 'strict') for OAuth callback redirects to work
- [Phase 21]: INVARIANTS.md placed in .planning/ as canonical source for zero-knowledge invariant with three-way cross-reference lock (schema.ts + INVARIANTS.md + CLAUDE.md)
- [Phase 21-01]: onDelete: 'set null' on secrets.userId — preserves already-shared links if user deletes account; cascade would be a data-loss bug
- [Phase 21-01]: onDelete: 'cascade' on sessions.userId and accounts.userId — Better Auth requirement for session cleanup
- [Phase 21-01]: sql template tag must be imported from drizzle-orm (not drizzle-orm/pg-core)
- [Phase 21]: [Phase 21-02]: Drizzle bug #4147 workaround: drizzle-kit CASE B (single combined file) — split into 0001_add_auth_tables.sql and 0002_add_secrets_user_id.sql with ADD COLUMN before ADD CONSTRAINT
- [Phase 21]: [Phase 21-02]: Descriptive migration tag names (0001_add_auth_tables, 0002_add_secrets_user_id) chosen over drizzle-kit auto-slugs for operational clarity
- [Phase 22-01]: RESEND_API_KEY uses z.string().min(1) not startsWith('re_') — test env can use placeholder values
- [Phase 22-01]: Email callbacks use non-async fire-and-forget (void + Promise.resolve()) to satisfy @typescript-eslint/require-await while maintaining better-auth Promise<void> type contract
- [Phase 22-01]: drizzleAdapter uses both usePlural: true AND explicit user: schema.users mapping — belt-and-suspenders safety against Better Auth table name mismatch
- [Phase 22-01]: requireEmailVerification: env.NODE_ENV !== 'test' — bypasses email gate in test environment
- [Phase 22-02]: baseURL omitted from createAuthClient() — Better Auth infers from window.location; works for both Vite dev proxy and same-origin production
- [Phase 22-02]: isSession() type guard to safely narrow better-auth any-typed getSession return — avoids @typescript-eslint/no-unsafe-member-access throughout dashboard
- [Phase 22-02]: result.data cast to unknown before narrowing — satisfies no-unsafe-assignment without disabling the rule
- [Phase 22-03]: toNodeHandler(auth) mounted at /api/auth/{*splat} BEFORE express.json() — reversed order causes silent hangs on all auth requests (body-stream consumed before auth can read it)
- [Phase 22-03]: requireAuth uses auth.api.getSession() + fromNodeHeaders() — canonical Better Auth session validation pattern for Express
- [Phase 22-03]: /api catch-all moved to after /api/me to prevent 404 interception of GET /api/me requests
- [Phase 22]: [Phase 22-04]: Google icon built via createElementNS + individual path elements (no innerHTML) — security hook enforces XSS-safe DOM construction
- [Phase 22]: [Phase 22-04]: Register success shows email verification card in-place (no navigate) — requireEmailVerification: true means unverified users cannot log in
- [Phase 22]: [Phase 22-04]: OAuth error callback pattern: errorCallbackURL sets ?error=oauth, login/register pages check URLSearchParams on mount
- [Phase 22]: [Phase 22-05]: renderForgotPasswordPage/renderResetPasswordPage are non-async (void return) — no top-level await; async triggers require-await lint error
- [Phase 22]: [Phase 22-05]: forgot-password success state is generic (prevents email enumeration) — same message whether account exists or not
- [Phase 22]: [Phase 22-05]: reset-password extracts token via URLSearchParams(?token=) — Better Auth appends token because requestPasswordReset used redirectTo: '/reset-password'
- [Phase 22-06]: Better Auth requestPasswordReset endpoint path is /api/auth/request-password-reset (not /api/auth/forget-password as documented elsewhere)
- [Phase 22-06]: drizzleAdapter with usePlural: true requires explicit verifications: schema.verification mapping — Better Auth looks for 'verifications' key but schema exports 'verification' (singular)
- [Phase 22-06]: NODE_ENV=test in .env silently disables requireEmailVerification in dev — dev environments must use NODE_ENV=development; test runner sets its own NODE_ENV=test
- [Phase 22-06]: Better Auth client normalizes EMAIL_NOT_VERIFIED to INVALID_EMAIL_OR_PASSWORD — intentional (prevents email enumeration); UI shows generic message for unverified sign-in attempts
- [Phase 22]: Trailing slash normalization uses pathname.replace(/\/$/, '') || '/' — the || '/' guard is essential: ''.replace() returns '' not '/', preserving root path match
- [Phase 23-01]: status column is text (not PostgreSQL enum) — avoids ALTER TYPE migrations when adding new states; values constrained at application layer
- [Phase 23-01]: Drizzle bug #4147 confirmed not applicable for 0003 — four new columns have no FK constraints, single-file migration is safe
- [Phase 23-01]: notify defaults to false at DB level — explicit opt-in; actual email wired in Phase 26
- [Phase 23-01]: label max 100 chars enforced at Zod layer only (no DB constraint) — reduces migration complexity
- [Phase 23-02]: optionalAuth never returns 401 — session check failure is non-fatal; anonymous users proceed unchanged
- [Phase 23-02]: deleteUserSecret() owner verification and status check happen inside transaction — prevents TOCTOU race
- [Phase 23-02]: auto-destroy on password brute-force always hard-deletes even user-owned secrets — brute-force targets do not get dashboard history
- [Phase 23-02]: getUserSecrets() explicit column list is the sole enforcement preventing ciphertext/passwordHash from appearing in dashboard responses
- [Phase 23-03]: renderCreatePage stays synchronous (void return) not async — fire-and-forget IIFE for auth check avoids @typescript-eslint/require-await; PageRenderer accepts void | Promise<void> so both work
- [Phase 23-03]: Progressive enhancement order: form appended to container before auth check fires — anonymous users see zero delay; authenticated users see label field appear after brief async pause
- [Phase 23-03]: labelInput captured as mutable closure variable initialized to null — auth IIFE sets it after mount; submit handler reads labelInput?.value safely
- [Phase 23]: [Phase 23-04]: Used authClient singleton from api/auth-client.js in layout.ts — prevents duplicate Better Auth client instances; consistent with project convention
- [Phase 23]: Session creation in dashboard tests uses Better Auth sign-up/sign-in API (not direct DB session insert) — correct session token format is opaque; direct insert would require matching Better Auth internal token encoding
- [Phase 23]: INVARIANTS.md verification included as explicit tests so future changes that remove the dashboard logger entry would cause test failures, providing documentation enforcement
- [Phase 24-eff-diceware-passphrase-generator]: EFF_WORDS typed as string[] not as const — prevents TS language-server slowdown on 7,776-element literal array
- [Phase 24-eff-diceware-passphrase-generator]: EFF_WORDS exported from passphrase.ts for test membership verification — private would require weaker tests
- [Phase 24-eff-diceware-passphrase-generator]: Rejection sampling cutoff 4294964736 for n=7776 eliminates modulo bias; rejection probability ~0.0000006 per word
- [Phase 24-eff-diceware-passphrase-generator]: Added no-unsafe-call: off to ESLint test file override — importing unresolved modules during TDD RED phase causes false positives
- [Phase 24-02]: Two separate if (passphrase) blocks in confirmation.ts — matches existing if (label) pattern; separate blocks improve readability over merging
- [Phase 24-02]: Passphrase card uses same glassmorphism styling (bg-surface/80 backdrop-blur-md) as urlCard — visual parity signals equal importance of link and passphrase
- [Phase 24-03]: Hidden passwordInput placed after passphraseGroup in DOM — always synced with currentPassphrase; no visible UI needed (Phase 24-03)
- [Phase 24-03]: Progressive label enhancement insertBefore(labelField, errorArea) — errorArea is stable anchor after Advanced options removal (Phase 24-03)
- [Phase 25-posthog-analytics]: posthog-js npm import (not CDN snippet) — bundled via Vite; no script-src CSP changes needed, only connect-src
- [Phase 25-posthog-analytics]: before_send (not sanitize_properties) — sanitize_properties is legacy name, before_send is current posthog-js API; wrong name silently fails
- [Phase 25-posthog-analytics]: capture_pageview: false + manual capturePageview() — prevents race with reveal-page fragment stripping; before_send is belt-and-suspenders
- [Phase 25-posthog-analytics]: autocapture: false — passive DOM capture would record plaintext from create-page textarea before encryption
- [Phase 25-02]: initAnalytics() placed before initThemeListener() in DOMContentLoaded — ensures PostHog ready before router fires any route events
- [Phase 25-02]: capturePageview() placed before routechange dispatch (not inside each route branch) — single unconditional call covers all routes; before_send handles fragment stripping
- [Phase 25-02]: captureSecretCreated receives expiresIn and !!password only — zero-knowledge invariant: no secretId, no shareUrl, no label, no userId
- [Phase 25-02]: captureSecretViewed fires after container.appendChild(wrapper) — event fires only after plaintext confirmed in DOM
- [Phase 25-03]: identifyUser sourced from getSession() after signIn.email succeeds — signIn response user field is any-typed; getSession() returns safely narrowable typed data
- [Phase 25-03]: identifyUser called on every dashboard page load — covers both email login returns and OAuth callbacks (callbackURL: '/dashboard'); PostHog deduplicates unchanged distinct IDs
- [Phase 25-03]: captureUserRegistered fires before showEmailVerificationState() but no identifyUser on registration — user cannot log in until email verified; identify deferred to first login
- [Phase 25-03]: SessionUser interface extended with id: string; isSession() guard updated to check both id and email — type-safe userId access without unsafe member access lint errors
- [Phase 25-03]: resetAnalyticsIdentity() placed after signOut() resolves — ensures identified session ends before PostHog reset generates new anonymous distinct ID
- [Phase 26-01]: Fire-and-forget notification dispatch called after Drizzle transaction callback returns — Resend HTTP call never holds open a PostgreSQL connection
- [Phase 26-01]: leftJoin(users) in secrets Step 1 SELECT resolves userId->email without a second DB round-trip; null userEmail from LEFT JOIN is safe (dispatch guards on userEmail truthiness)
- [Phase 26-01]: Non-null assertion secretRow.passwordHash! in verifyPassword call — TypeScript cannot track narrowing through spread destructure; !secret.passwordHash guard above guarantees non-null
- [Phase 26-01]: Anonymous safety enforced at two layers: route enforces userId ? notify : false; service checks userId !== null before dispatch — defense-in-depth
- [Phase 26-02]: getNotifyEnabled declared as () => boolean initialized to () => false — submit handler reads live checkbox state at submit time; safe no-op default for anonymous users and auth check failures
- [Phase 26-02]: createNotifyToggle() returns { element, getValue } — accessor pattern consistent with labelInput closure; getValue bound to checkbox.checked for live state reads
- [Phase 26-email-notifications]: [Phase 26-03]: vi.hoisted() required for mock variables in vi.mock factory — Vitest hoists vi.mock before variable initialization; wrap shared mock vars in vi.hoisted()
- [Phase 26-email-notifications]: [Phase 26-03]: vi.mock (not vi.spyOn) required for ESM notification dispatch interception — spyOn cannot replace live module bindings; vi.mock replaces the module registry entry
- [Phase 26-email-notifications]: [Phase 26-03]: setImmediate flush after HTTP request needed to let fire-and-forget void notifications resolve before spy assertions
- [Phase 27]: [Phase 27-01]: standardHeaders: 'draft-6' on createAnonHourlyLimiter — draft-7 embeds reset in combined RateLimit header; draft-6 emits standalone RateLimit-Reset the client reads for countdown display (CONV-06)
- [Phase 27]: [Phase 27-01]: createAuthedDailyLimiter keyGenerator uses userId not req.ip — avoids shared-IP false positives for authenticated users on NAT/corporate networks
- [Phase 27]: [Phase 27-01]: optionalAuth must precede all rate limiters in POST / middleware chain — skip callbacks read res.locals.user which optionalAuth populates
- [Phase 27]: [Phase 27-01]: expiresIn caps enforced in handler (not Zod schema) — Zod enum allows all values; server-side tier guard applied after rate limiters
- [Phase 27]: [Phase 27-03]: Legal pages use [Company Name] / [Contact Email] / [Jurisdiction] placeholder tokens — substituted at production deployment, not hardcoded
- [Phase 27]: [Phase 27-03]: Both /privacy and /terms marked noindex: true — legal pages should not appear in search results (same treatment as error/secret routes)
- [Phase 27]: [Phase 27-03]: Consent line in register.ts composed with createTextNode + anchor elements (no innerHTML) — XSS-safe DOM construction convention
- [Phase 27]: [Phase 27-02]: ExpirationSelectResult accessor interface { element, getValue } enables anonymous/authenticated select swap in auth IIFE without DOM selector coupling
- [Phase 27]: [Phase 27-02]: Module-level anonymousSecretCount and isAuthenticated persist across SPA re-renders; reset only on full browser refresh — same lifecycle as dismissed prompt state
- [Phase 27]: [Phase 27-02]: 30d expiration option absent from authenticated select — matches server-side cap from Phase 27-01; Pro-tier feature deferred to v5.0
- [Phase 27]: [Phase 27-02]: errorArea className reset on each submit — showRateLimitUpsell mutates element className; reset restores danger styling for non-429 errors on retry
- [Phase 27]: [Phase 27]: [Phase 27-04]: Math.ceil(resetTimestamp / 60) is the correct formula for RateLimit-Reset draft-6 delta-seconds — no epoch arithmetic needed; the header value is already seconds-remaining
- [Phase 28]: [Phase 28-01]: easyToSay+omitSimilar throws 'No characters available with current filter combination' — explicit guard per plan spec; UI in Phase 28-02 should prevent this pairing
- [Phase 28]: [Phase 28-01]: PHONETIC = 'abcdefghjkmnprstuvwyz' omits e,i,l,o,q,x — phonetically ambiguous chars excluded at definition time, not filtered at runtime
- [Phase 28]: [Phase 28-01]: global crypto used without window.crypto prefix — available in browser (Web Crypto API) and Node 19+; consistent with passphrase.ts pattern
- [Phase 28]: [Phase 28]: [Phase 28-02]: insertBefore(labelField, protectionPanel.element) — protection panel replaces errorArea as stable anchor for auth IIFE insertions; label+notify appear between expiration and protection panel
- [Phase 28]: [Phase 28-02]: createProtectionPanel() factory closure pattern — all mode state lives inside factory; consumers get { element, getPassword, getPassphrase } accessors
- [Phase 28]: [Phase 28-03]: Protection panel refactored to 4-option radio selector (fieldset+legend) per UAT feedback — No protection/Generate password/Custom password/Passphrase; replaces collapsible details+segmented control; sub-panels use hidden attribute toggled by radio change handlers
- [Phase 28]: [Phase 28-03]: previewField div requires role=status when using aria-label — bare div with aria-label is prohibited by axe; role=status is semantically correct for live password preview output
- [Phase 28]: [Phase 28-03 v2]: Protection panel refactored again to horizontal 4-tab design per second UAT iteration — tablist/tab/tabpanel ARIA pattern; arrow key navigation; combined password field replaces separate preview div + applied-password field in generate tab; passphrase tab uses RefreshCw icon; no-useless-assignment fix: const nextIndex via ternary replaces let nextIndex = currentIndex pattern
- [Phase 28]: [Phase 28-03]: Reveal page heading updated to "Protection Required" (from "Password Required") — mode-agnostic wording covers both passphrase and password protection modes without naming a specific mode; subtext + placeholder + label updated to "Passphrase or password" for same reason
- [Phase 28]: [Phase 28-03]: previewField div requires role=status with aria-label — bare div with aria-label violates axe prohibited-attr rule; role=status is semantically correct for live password preview output
- [Phase 29]: Rate-limit countdown test uses test.skip(E2E_TEST === 'true') — E2E mode raises anon hourly limit to 1000 making 429 unreachable; countdown UI covered by unit/integration tests
- [Phase 29-02]: sessionStorage chosen for pre-OAuth-redirect flag over localStorage — sessionStorage is tab-scoped and cleared when tab closes; correct lifetime for a one-time post-redirect analytics flag
- [Phase 29-02]: Read-remove-fire atomic pattern: removeItem before captureUserLoggedIn — ensures flag is gone even if capture throws, preventing duplicate events on retry
- [Phase 29-02]: sessionStorage handoff pattern: login.ts/register.ts setItem before signIn.social(); dashboard.ts reads flag after identifyUser() on first render after redirect
- [Phase 29]: Anonymous expiration select test checks select.count() before asserting — anonymous users get a div, authenticated users get a select; defensive branching handles both DOM variants
- [Phase 29-01]: NOINDEX_PREFIXES array (not individual startsWith checks) chosen for X-Robots-Tag guard in app.ts — extensible pattern: future auth routes need a single array entry
- [Phase 29-01]: /dashboard included in NOINDEX_PREFIXES even though auth-gated — defense-in-depth; belt-and-suspenders against crawlers that bypass authentication
- [Phase 29-01]: requirements-completed field added to 27-01-SUMMARY.md frontmatter only — no implementation changes; CONV-01 was already implemented in Phase 27 (documentation gap closure only)
- [Phase 29]: [Phase 29-05]: form > :scope > [role='alert'] scoped selector required in test because protection panel contains nested #gen-error role=alert element that precedes form errorArea in DOM order
- [Phase 29]: [Phase 29-05]: importOriginal factory in vi.mock preserves real ApiError class for instanceof check while replacing createSecret; eslint-disable-next-line no-unsafe-return needed because vi.fn() returns any and test override omits that rule
- [Phase 30-01]: 10 secret vars in render.yaml use sync: false — Render prompts deployer at Blueprint creation; values never committed to source control
- [Phase 30-01]: BETTER_AUTH_SECRET placeholder 'local-development-secret-must-be-at-least-32-chars' satisfies z.string().min(32) in Zod schema; allows docker compose up without crash
- [Phase 30-01]: ARG VITE_POSTHOG_KEY placed in Stage 2 (build) only — not Stage 1 (deps) or Stage 3 (production); only needed where Vite runs
- [Phase 30-01]: APP_URL not added to render.yaml — optional var, production no-op is correct (BETTER_AUTH_URL serves as app URL)
- [Phase 30-01]: PORT not added to render.yaml — Render injects PORT=10000 automatically; hardcoding 3000 would break Render routing
- [Phase 30-02]: docker-build CI job uses needs: [lint] (not needs: [test, e2e]) — runs in parallel with test/e2e after lint, does not extend critical path
- [Phase 30-02]: VITE_POSTHOG_KEY="" and VITE_POSTHOG_HOST="" as empty build args in CI satisfy ARG declarations from Plan 01; PostHog disabled in CI is correct default (graceful no-op)
- [Phase 30-02]: --no-cache in docker-build CI job ensures build reflects actual Dockerfile content, not stale BuildKit layer cache

### Roadmap Evolution

- Phase 28 added: Optional password or passphrase protection with password generator and masked inputs
- Phase 30 added: Docker & Render deployment fixes (ensure local Docker is correct, up-to-date stack versions, fix Render deployments)

### Known Tech Debt

- Placeholder domain `secureshare.example.com` in SEO assets (needs production domain)
- Lucide ESM workaround via Vite resolve.alias (upstream bug)
- CI test/e2e jobs missing BETTER_AUTH_SECRET et al. — recommended fix: add placeholder env vars to ci.yml
- /privacy and /terms not in NOINDEX_PREFIXES (X-Robots-Tag gap; low severity)
- schema.ts inline zero-knowledge comment lists 3 enforcement points; INVARIANTS.md canonical has 6

### Blockers/Concerns

(None — v4.0 clean ship)

## Session Continuity

Last session: 2026-02-22
Stopped at: v4.0 milestone complete and archived
Resume: Start v5.0 planning with `/gsd:new-milestone`

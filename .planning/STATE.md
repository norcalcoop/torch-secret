---
gsd_state_version: 1.0
milestone: v5.0
milestone_name: Product Launch Checklist
status: unknown
last_updated: "2026-03-02T16:16:35.515Z"
progress:
  total_phases: 15
  completed_phases: 15
  total_plans: 56
  completed_plans: 56
---

# Session State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-22 after v5.0 milestone started)

**Core value:** Users can share sensitive information once, securely, without accounts or complexity
**Current focus:** v5.0 Product Launch Checklist — COMPLETE

## Current Position

Phase: 41 of 41 — COMPLETE
Plan: 4/4 plans done
Status: Phase 41 complete — all v5.0 launch documentation finalized: CHANGELOG v4+v5, package.json 5.0.0, CONTRIBUTING.md dual-path, SECURITY.md version table, README.md screenshots, stale URL sweep. Human verification approved all five documents.
Last activity: 2026-03-02 — Plan 41-04 complete

Progress: [██████████] 100% (v5.0 phases — 9/9 phases complete; Phase 39 is operational work beyond v5.0 scope)

## Performance Metrics

| Milestone | Phases | Plans | Timeline |
|-----------|--------|-------|----------|
| v1.0 MVP | 8 | 22 | 2 days |
| v2.0 UI & SEO | 6 | 14 | 3 days |
| v3.0 Production-Ready | 6 | 15 | 2 days |
| v4.0 Hybrid Anonymous + Account | 10 | 38 | 4 days |
| **Total shipped** | **30** | **89** | **~11 days** |

*v5.0 velocity tracking begins after first plan completes*
| Phase 32 P02 | 3min | 2 tasks | 1 file |
| Phase 32 P01 | 2 | 1 task | 2 files |
| Phase 31 P04 | 2 | 1 task | 1 file |
| Phase 31 P02 | 247 | 2 tasks | 7 files |
| Phase 31 P01 | 8 | 3 tasks | 32 files |
| Phase 32 P04 | ~30min | 2 tasks | 1 file |
| Phase 32 P03 | 175s | 2 tasks | 1 files |
| Phase 33 P01 | 4 | 1 tasks | 1 files |
| Phase 33 P02 | 2min | 2 tasks | 2 files |
| Phase 33 P03 | 5 | 2 tasks | 0 files |
| Phase 34 P01 | 2min | 2 tasks | 10 files |
| Phase 34 P02 | 2min | 2 tasks | 4 files |
| Phase 34 P03 | 5min | 2 tasks | 4 files |
| Phase 34 P04 | 3min | 1 task | 1 file |
| Phase 34.1 P01 | 2min | 2 tasks | 3 files |
| Phase 34.1 P02 | 7 | 2 tasks | 3 files |
| Phase 35 P01 | 19 | 2 tasks | 6 files |
| Phase 35 P02 | 9 | 2 tasks | 3 files |
| Phase 35 P03 | 2min | 2 tasks | 3 files |
| Phase 36 P01 | 7min | 2 tasks | 9 files |
| Phase 36 P02 | 2min | 2 tasks | 3 files |
| Phase 36 P03 | 3min | 2 tasks | 5 files |
| Phase 36 P04 | ~1min | 1 task (checkpoint) | 0 files |
| Phase 37 P01 | 5 | 2 tasks | 10 files |
| Phase 37 P02 | 3min | 2 tasks | 7 files |
| Phase 37 P03 | human-action | 2 tasks | 0 files |
| Phase 37.1 P01 | 4 | 2 tasks | 4 files |
| Phase 37.1 P02 | 2min | 2 tasks | 2 files |
| Phase 37.1 P03 | human-action | 2 tasks | 0 files |
| Phase 37.2 P02 | 5 | 2 tasks | 5 files |
| Phase 37.3 P01 | 64s | 2 tasks | 2 files |
| Phase 37.3 P05 | 2 | 2 tasks | 5 files |
| Phase 37.3 P02 | 3min | 2 tasks | 5 files |
| Phase 37.3 P03 | 7 | 2 tasks | 4 files |
| Phase 37.3 P04 | 2 | 1 tasks | 1 files |
| Phase 38 P01 | 3 | 2 tasks | 5 files |
| Phase 38 P02 | 5 | 3 tasks | 2 files |
| Phase 38 P02 | 5 | 3 tasks | 2 files |
| Phase 39 P01 | human-action | 2 tasks | 0 files |
| Phase 39 P02 | 63 | 2 tasks | 0 files |
| Phase 39 P03 | ~90min | 2 tasks | 5 files |
| Phase 40 P05 | 2min | 2 tasks | 3 files |
| Phase 40 P03 | 3min | 3 tasks | 3 files |
| Phase 40 P02 | 2min | 1 task | 1 file |
| Phase 40 P01 | 4 | 2 tasks | 6 files |
| Phase 40 P05 | 2 | 2 tasks | 3 files |
| Phase 40 P04 | 3min | 2 tasks | 5 files |
| Phase 41 P01 | 2min | 2 tasks | 2 files |
| Phase 41 P02 | 8min | 2 tasks | 5 files |
| Phase 41 P02 | 8min | 2 tasks | 5 files |
| Phase 41 P03 | 8min | 2 tasks | 6 files |
| Phase 41 P04 | 2min | 1 task | 0 files |

## Accumulated Context

### Key Architectural Constraints (carry forward every phase)

- Zero-knowledge invariant: no log, DB record, or analytics event may contain both userId and secretId in the same record — ever (see .planning/INVARIANTS.md)
- Stripe webhook route must be mounted BEFORE express.json() in app.ts — mounting after causes silent signature verification failures ("No signatures found matching the expected signature")
- Do NOT use @better-auth/stripe billing webhook path — 4 open bugs (#2440, #4957, #5976, #4801 as of Feb 2026) break subscription lifecycle; use raw stripe SDK with hand-written handler
- SEO content pages (/vs/*, /alternatives/*, /use/*) MUST be Express SSR — SPA routes are invisible to AI crawlers (GPTBot, ClaudeBot, PerplexityBot) and delay Googlebot indexing by days-to-weeks on a new domain
- GDPR: welcome email is transactional (no consent needed); key features + upgrade prompt emails are marketing (explicit consent required; marketing consent checkbox on registration form must be unchecked by default)
- loops@6.2.0 uses v6.x sendEvent()/updateContact() single-object API — breaking change from v5; do not use v5 positional arguments
- Loops databaseHooks.after hook must be non-async when using void+.catch() fire-and-forget — async without await triggers @typescript-eslint/require-await
- activatePro() extended with DB select by stripeCustomerId to get email, then loops.updateContact({ subscriptionTier: 'pro' }) fire-and-forget — billing never blocked by Loops outage
- Use resend@6.9.2 Audiences API (resend.contacts.create()) for email list capture — no new package needed
- Before writing any webhook handler code: extend INVARIANTS.md with a Stripe/billing row first (BILL-06)

### Phase 34.1 Execution Notes

- protection_type enum ('none'|'passphrase'|'password') added to CreateSecretSchema with `.optional().default('none')` — backwards-compatible
- Anonymous users get 403 `passphrase_not_allowed` for both passphrase and password types (no DB lookup, just !userId check)
- Free users get 403 `pro_required` for password type (DB lookup via Drizzle: select subscriptionTier from users where id = userId)
- Passphrase type for free users does NOT trigger DB lookup — avoids unnecessary round-trip
- error codes: `passphrase_not_allowed` for anonymous, `pro_required` for free attempting password
- Protection tier guard placed after expiresIn caps, before createSecret() call in POST handler
- Pro user elevation in tests: createUserAndSignIn() + direct Drizzle update to set subscriptionTier='pro'
- 271 total tests pass (6 new protection_type tier tests + 265 pre-existing)
- Plan 02: createProtectionPanel({ isAuthenticated, isPro }) — getLockLevel() helper drives per-tab lock state
- Plan 02: Locked tab popovers appended to root (OUTSIDE tablist) — tablist must only own tab-role children (aria-required-children); tab elements must not contain interactive descendants (nested-interactive axe 4.11)
- Plan 02: createProtectionPanel exported @internal for test isolation — generate-tab tests need Pro-mode panel since generate/custom are Pro-locked in anonymous mode
- Plan 02: Auth IIFE replaces protection panel after tier resolves: oldPanel.parentElement?.insertBefore(newPanel, oldPanel); oldPanel.remove()
- Plan 02: Submit handler reads protectionType = protectionPanel.getProtectionType(); passes as 6th arg to createSecret()
- Plan 02: createSecret() extended with protectionType param (default 'none'); serialized as protection_type (snake_case) in JSON body

### Phase 34 Execution Notes

- Stripe billing foundation (Plan 01) complete: stripe_customer_id + subscription_tier columns on users table; migration 0004 applied; billing.service.ts exports getOrCreateStripeCustomer, activatePro, deactivatePro
- ZK billing pattern established: activatePro/deactivatePro receive stripe_customer_id only — webhook handler never has userId in scope alongside secretId
- Stripe SDK singleton: import { stripe } from '../config/stripe.js' — never new Stripe() in service files
- subscriptionTierEnum exported from schema.ts at module scope (before users table) so drizzle-kit generates CREATE TYPE statement
- All three Stripe env vars required (not optional) in Zod schema: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRO_PRICE_ID
- BILL-06 satisfied before any webhook handler code written
- Billing routes (Plan 02) complete: POST /api/billing/checkout, GET /api/billing/verify-checkout, POST /api/billing/portal, POST /api/webhooks/stripe
- Webhook ordering invariant confirmed: stripeWebhookHandler mounted with express.raw() at line 78 in app.ts — BEFORE express.json() at line 85
- POST /api/billing/checkout (not GET) — state-creating operation; GET in plan code sample was incorrect; must_haves spec (POST) takes precedence
- GET /api/me now returns subscriptionTier via DB lookup — Better Auth AuthUser does not include custom columns
- Frontend Pro tier gating (Plan 03) complete: MeResponse/billing types in shared/types/api.ts; getMe/initiateCheckout/verifyCheckoutSession/createPortalSession in client.ts; custom combobox in expiration-select.ts with Lock icon + tooltip on 30d for free users
- Custom combobox pattern established: native <select> cannot render icons/tooltips on individual options — use div-based ARIA combobox (role=combobox trigger + role=listbox + role=option rows)
- NodeListOf requires Array.from() in for-of loops under ES2022 lib target — tsconfig does not include downlevel iterator support for DOM NodeList
- getMe() called in auth IIFE with try/catch fallback: isPro = false on any API error (safe degradation — create page never breaks)
- Dashboard billing UI (Plan 04) complete: Pro badge + logout card vertical restructure; upgrade CTA (free) / Manage Subscription (Pro); post-checkout ?upgraded=true&session_id=... verification banner; ?checkout=cancelled toast; URL params cleaned with history.replaceState
- Post-checkout verification pattern: void IIFE with spinner banner inserted synchronously, updated async after verifyCheckoutSession() resolves — banner does not block page render
- getMe() on dashboard load: subscriptionTier fetched after session check; isPro used to gate Pro badge and billing row content

### Phase 33 Execution Notes

- pricing.ts (Plan 01) complete: 473 lines, exports renderPricingPage() and FAQ_ITEMS
- Billing toggle registration pattern: toggle creates callback slot; createTierCards registers Pro card's updatePrice fn via the returned registration function
- Pro card price refs stored (proAmountEl/proPeriodEl/proSubLabelEl) and updated via textContent — no re-render on toggle
- Annual pricing: $65/year ($5.42/mo equivalent) at 22.6% savings; matches "22% savings" badge requirement
- FAQ_ITEMS is canonical source — Plan 02 copied verbatim strings into FAQPage JSON-LD in index.html (DONE)
- FAQPage JSON-LD in index.html is static (not JS-injected) — required for SPA curl-verifiability (PRICE-05)
- Pro CTA: /register?plan=pro — Phase 34 reads query param; auth-aware CTA deferred to Phase 34
- Native <details>/<summary> accordion; group-open:rotate-180 on chevron via Tailwind CSS 4 group-open: variant
- /pricing route is live, SEO-indexable — noindex removed in Plan 02

### Phase 32 Execution Notes

- Router split complete: / → home.js (no noindex, indexable), /create → create.js (existing form), /pricing stub (noindex, not_found — Phase 33 target)
- home.ts (Plan 02) complete: 4-section marketing page (hero, trust strip, use-cases, GDPR email capture), 346 lines, no innerHTML, TypeScript clean
- Stub pattern established: create .ts with correct export signature for ESLint safety before module implementation plan runs
- Nav overhaul (Plan 03): desktop header has Pricing + Dashboard/Login + Create a Secret CTA + ThemeToggle; mobile gets iOS-style bottom tab bar with 4 tabs (Home/Create/Pricing/Dashboard)
- Mobile nav uses document.body.appendChild() outside flex column — fixed position requires this
- updateCreateLink() toggles sm:block (not hidden) to preserve desktop-only base class pattern (hidden sm:block)
- Footer needs mb-16 sm:mb-0 (Plan 04 UAT fix): page wrapper pb-16 alone is insufficient — the footer element itself must have bottom margin to clear the fixed 64px tab bar on mobile

### Phase 31 Execution Notes

- BRAND-03 gap closure: protection panel hardcoded text-white/* classes replaced with semantic tokens (text-text-primary/secondary/muted, border-border) — light theme now readable across all four protection tabs

### Phase 31 Kickoff Notes

- BRAND-01/02: grep audit recommended — search for "SecureShare" and "secureshare.example.com" across all files before and after rename to verify completeness
- TECH-01: Add placeholder env vars to ci.yml matching the docker-compose.yml pattern (BETTER_AUTH_SECRET, DATABASE_URL, etc.)
- TECH-02: Add '/privacy' and '/terms' to NOINDEX_PREFIXES array in server/src/app.ts
- TECH-03: Update schema.ts ZK comment to list all 7 enforcement points from INVARIANTS.md (DONE — 31-03)

### Roadmap Evolution

- Phase 34.1 inserted after Phase 34: Passphrase/Password Tier Enforcement (URGENT) — anonymous users blocked from all passphrase/password options; free users limited to generated passphrases; Pro users get full password/passphrase/custom control
- Phase 37.1 inserted after Phase 37: get the most out of posthog free tier integration (URGENT)
- Phase 37.2 inserted after Phase 37: get the most out of infiscal free tier integration (URGENT)
- Phase 37.3 inserted after Phase 37: get the most out of cloudflare, render.com, loops.so, resend.com, socket.dev free tier integrations (URGENT)
- Phase 39 added: complete, finish google auth and github auth
- Phase 40 added: security remediation and concerns pre-launch
- Phase 41 added: Update README and stale documentation for Torch Secret v5.0 launch

### Phase 35 Execution Notes

- SSR template pattern: TypeScript string helpers (P/H1/H2/LI/STRONG/HR constants + CARD_OPEN/CARD_CLOSE) — zero new dependencies, nonce threading straightforward
- getBuiltCssHref() reads CSS hash from client/dist/index.html at module load — never hardcoded, empty string fallback in dev when client/dist does not exist
- CSS custom properties defined in inline <style> block (not Tailwind utility classes) — linked compiled CSS handles utility classes; custom props give full --ds-color-* token coverage
- Dark mode: @media (prefers-color-scheme: dark) on :root — not .dark class (SPA uses JS toggle; SSR pages use CSS-only approach)
- FAQPage JSON-LD in <head> only — NOT rendered as visible body HTML on VS pages (plan specification)
- 404 returns JSON {error: 'not_found'} — consistent with API error format
- ESLint no-useless-escape rule does not have auto-fix; required manual rewrite of string quoting in both data files (apostrophes in content broke single-quoted strings)
- seoRouter not yet mounted in app.ts — Plan 03 wires it in before SPA catch-all
- Plan 02: HowTo + FAQPage combined into single JSON.stringify([howToSchema, faqSchema]) for one <script> block — valid per schema.org spec
- Plan 02: FAQ items visible in body as <dl>/<dt>/<dd> on use-case pages (unlike VS pages where FAQ is JSON-LD only) — plan specification
- Plan 02: Quote strategy from Plan 01 applied proactively — double-quoted strings for apostrophe content; no ESLint no-useless-escape issues encountered
- Plan 03: seoRouter mounted with app.use(seoRouter) (no path prefix) — routes internally mount /vs, /alternatives, /use; no double-prefix needed
- Plan 03: NOINDEX_PREFIXES verified unchanged — /vs, /alternatives, /use not added; these SSR pages are intentionally crawlable by Googlebot and AI bots
- Plan 03: sitemap.xml extended from 1 to 17 entries (root + pricing pre-existing + 14 new SEO pages)
- Plan 03: SSR integration test pattern uses buildApp() + supertest with no DB setup block — SSR routes have no DB dependency
- Plan 03: 302 total tests passing (31 new SEO tests + 271 pre-existing)

### Phase 37.3 Execution Notes

- Plan 01: render.yaml env var parity (8 missing stubs added: APP_URL, BETTER_AUTH_TRUSTED_ORIGINS, LOOPS_API_KEY, STRIPE_*, RESEND_AUDIENCE_ID, IP_HASH_SALT); CI re-enabled with push(main)+pull_request+workflow_dispatch triggers; Render autoDeployTrigger:checksPass gate active
- Plan 02: loops.sendEvent('subscribed') fire-and-forget added to confirmSubscriber() — triggered when marketing subscriber confirms double opt-in email; Socket.dev socket.yml v2 config added for supply-chain security scanning
- Plan 03: auth.api.deleteUser requires body:{} even when all body fields are optional — omitting body causes 500 (Better Auth reads ctx.body.password in freshness check block)
- Plan 03: INVARIANTS.md account deletion row added before any code (mandatory protocol)
- Plan 03: beforeDelete is async and awaited by Better Auth — differs from databaseHooks.user.create.after which must be non-async (no await)
- Plan 03: loops.deleteContact({ email }) only — no userId (Loops userId is external system ID, not our Better Auth userId)
- Plan 03: DELETE /api/me uses requireAuth guard then delegates to auth.api.deleteUser — Better Auth handles session cookie clearing and user row deletion internally
- Plan 03: 353 total tests pass (6 new: 4 DELETE /api/me integration + 2 plan 02 loops tests)
- Plan 04: deleteAccount() returns boolean so caller can restore UI on failure; type-to-confirm input requires exact 'delete' text before confirmBtn is enabled; Escape key + Cancel both close modal and return focus to trigger button; TriangleAlert icon imported from lucide for danger header; frontend-design skill not found in skills directory — proceeded using existing dashboard.ts createConfirmModal pattern and styles.css OKLCH tokens

### Phase 37.2 Execution Notes

- workspaceId: f432290a-5b26-49f0-bde8-83825ffddd64 (needed in .infisical.json)
- project-slug: torch-secret-28-vs (needed in ci.yml secrets-action)
- Infisical CLI v0.43.58 — `projects list` command does not exist; use `--projectId` flag on all commands
- `gh secret set --body "value"` is reliable; piped stdin (`echo -n "..." |`) works for some secrets but not others
- Staging DATABASE_URL: postgresql://secureshare:secureshare@db:5432/secureshare (Docker-internal hostname)
- BETTER_AUTH_TRUSTED_ORIGINS per-env: dev=torchsecret.localhost:1355, staging=localhost:5173, prod=torchsecret.com
- NODE_ENV set per-environment in Infisical: development / staging / production
- Render Secret Sync: prod environment → torch-secret Render service; Auto-Sync ON; status "Synced"
- GitHub Secrets set: INFISICAL_CLIENT_ID + INFISICAL_CLIENT_SECRET (machine identity: github-actions-ci)
- Plan 02: .infisical.json created (workspaceId + defaultEnvironment dev); dev:server/dev:client prefixed with infisical run --env=dev --; staging:up added
- Plan 02: CI test+e2e jobs: secrets-action@v1.0.9 added after checkout; BETTER_AUTH_SECRET/STRIPE_*/RESEND_API_KEY/IP_HASH_SALT/LOOPS_API_KEY removed from job-level env
- Plan 02: .env.example stripped to keys-only; BETTER_AUTH_TRUSTED_ORIGINS= and LOOPS_API_KEY= added with comments
- Plan 02: README Getting Started replaced with Infisical onboarding (infisical login + npm run dev)
- RESEND_FROM_EMAIL kept in CI job env (config string, not secret); NODE_ENV kept in CI job env (test suite checks NODE_ENV=test; Infisical dev sets 'development')

### Phase 37.1 Execution Notes

- captureSecretCreated extended: protectionType is required (3rd param) — create.ts callsite updated in same commit
- identifyUser extended: tier + registeredAt optional — existing callers (login.ts, register.ts) unchanged
- captureSubscriptionActivated: calls posthog.capture() then posthog.setPersonProperties({ tier: 'pro' }) inline — single-call pattern
- No-op tests: vi.resetModules() + dynamic import for fresh _initialized=false module state
- INVARIANTS.md updated before any code (mandatory protocol): Phase 37.1 analytics events row added
- 19 new tests + 328 pre-existing = 347 total passing
- Plan 02: getActiveTabId() added to createProtectionPanel return — exposes raw tab ID; analyticsProtectionType computed in submit handler mapping 'generate'→'generated', 'custom'→'password', 'passphrase'→'passphrase', 'none'→'none'
- Plan 02: registeredAt declared as let outside getMe() try block — accessible at identifyUser call site; safe degradation (undefined) on error
- Plan 02: captureCheckoutInitiated fires before window.location.href — PostHog flushes before unload; event reliably reaches server
- Plan 02: captureSubscriptionActivated scoped inside isUpgraded && checkoutSessionId guard, on verifyCheckoutSession() success path only — never fires on regular dashboard loads
- Plan 03: PostHog cloud configured via REST API — Launch Dashboard (ID 1316465) with 5 widgets; Funnels "Free-to-Paid Conversion" (ID 7105292) and "Conversion Prompt Effectiveness" (ID 7105295); Cohorts Pro Users (220117), Free Registered Users (220118), Power Users/Dashboard (220119)
- Plan 03: Browser verification confirmed all 4 critical events: secret_created with protection_type="none"/"passphrase", dashboard_viewed on dashboard load, checkout_initiated with source="dashboard" before Stripe redirect

### Phase 37 Execution Notes

- marketingConsent boolean column added to users table via migration 0006 (ALTER TABLE "users" ADD COLUMN "marketing_consent" boolean DEFAULT false NOT NULL)
- Better Auth additionalFields.marketingConsent with input:true — client signUp.email() passes consent value directly into users table without custom middleware or endpoints
- Migration renamed from drizzle-kit auto-name (0006_deep_joystick.sql) to 0006_add_marketing_consent.sql per project convention; _journal.json updated
- LOOPS_API_KEY added as required env var (not optional); CI placeholder loops_placeholder added to test job
- register.ts: #marketing-consent checkbox unchecked by default, inserted before consentLine via form.insertBefore(); setFormLoading() extended to disable/enable checkbox
- 321 total tests pass after Plan 01 (3 new GREEN from register.test.ts + 318 pre-existing)
- onboarding.service.test.ts (6 cases) and billing.service.test.ts (1 case) are intentional RED — Plan 02 creates the onboarding service and extends billing service
- Plan 02: loops@6.2.0 installed; config/loops.ts LoopsClient singleton; onboarding.service.ts fires sendEvent('registered') with firstName/marketingConsent/subscriptionTier; auth.ts databaseHooks.user.create.after wired fire-and-forget; activatePro() extended with Loops contact sync; all 7 RED scaffolds GREEN; 328 tests pass
- Plan 03 (human-action checkpoint): Loops loop published in Loops.so dashboard with 7-node structure triggered by 'registered' event; welcome email delivered ~30s after test registration; "Hey Torchtest, welcome to Torch Secret" subject confirmed; from: hello@torchsecret.com; all ESEQ-01 through ESEQ-04 verified by user; phase 37 complete
- Loops audience filter node placement: filter evaluated at send time (not at registration time) — allows real-time tier changes from activatePro() to take effect before day-7 send
- Welcome email node has no audience filter (transactional/GDPR-compliant); day-3 node has marketingConsent=true filter; day-7 node has marketingConsent=true AND subscriptionTier!=pro dual filter

### Phase 36 Execution Notes

- marketing_subscribers has NO FK to users or secrets — standalone GDPR table, ZK invariant enforced at schema level
- INVARIANTS.md must be updated BEFORE any schema/code changes — per CLAUDE.md mandate (Phase 36 row added first)
- vi.mocked() wrapper functions (emailSend()/contactsCreate()) for mock assertions — avoids @typescript-eslint/unbound-method on object property methods
- @typescript-eslint/unbound-method: off added to test file ESLint config — vi.mocked() objects are not real class instances; this-binding concern inapplicable
- Stripe env vars (STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET/STRIPE_PRO_PRICE_ID) backfilled into ci.yml — pre-existing gap fixed alongside Phase 36 vars
- vi.mock() factory hoisting: variables defined before vi.mock() are not accessible in the factory — use vi.fn() inline; access via vi.mocked() in test body
- Plan 01 delivers: INVARIANTS.md row, marketingSubscribers schema, migration 0005 (applied), env vars, 16 RED test cases
- Plan 02 complete: POST /api/subscribers, GET /api/subscribers/confirm, GET /api/subscribers/unsubscribe — all 16 tests GREEN (318 total)
- onConflictDoUpdate WHERE status='pending': only pending rows get token refresh; confirmed rows preserved silently
- createSubscriber returns void with no state indication — prevents subscriber status enumeration across all three states
- Resend contacts.create is fire-and-forget (.catch()) — local DB is source of truth; Resend Audience is best-effort sync
- Plan 03 complete: void handleSubmit() pattern for async addEventListener — avoids @typescript-eslint/no-misused-promises; replaceFormWithSuccess() clears section in-place; unsubscribe always shows success (idempotent — no token validity leakage)
- /confirm and /unsubscribe registered in router.ts with noindex: true; both added to NOINDEX_PREFIXES in server/src/app.ts for X-Robots-Tag
- Build verified: confirm and unsubscribe emit as separate chunks (confirm-*.js, unsubscribe-*.js)
- Plan 04 complete: human verification approved 2026-02-26; all 5 ECAP requirements confirmed by tester (form submission, consent enforcement, confirmation email, /confirm + /unsubscribe pages, NOINDEX headers, ip_hash integrity)

### Phase 40 Plan 03 Execution Notes

- notification.service.test.ts: 3 ZK invariant tests run GREEN immediately — existing sendSecretViewedNotification already satisfies the invariant (no nanoid pattern in subject/body/JSON payload)
- nanoid regex pattern `/[A-Za-z0-9_-]{21}/` used as the ZK invariant detector in email content tests
- Scaffold test files use `// eslint-disable-next-line @typescript-eslint/no-unused-vars` per-import for symbols only used by Plan 04 test bodies; Plan 04 can remove these directives
- `void expect` pattern rejected — ESLint warns on unused eslint-disable directive; per-import disable is correct
- services/__tests__/ directory created (did not exist before Plan 03)
- pool.end() in afterAll is mandatory for all DB-connected integration test files — prevents vitest hang

### Phase 39 Execution Notes

- Plan 01: Google OAuth credentials provisioned to Infisical dev + prod via `infisical secrets set` CLI; verified with `infisical secrets get`; no code changes needed — `server/src/auth.ts` socialProviders.google block was already conditional on env var presence
- Single Google OAuth client covers dev + prod — both JS origins (localhost:3000, torchsecret.com) and redirect URIs registered on same client in Google Cloud Console
- Google Cloud Console project: Torch Secret; OAuth client name: Torch Secret; callback URL pattern: `{BETTER_AUTH_URL}/api/auth/callback/google`
- No trailing slashes on any registered URI — trailing slash is #1 cause of redirect_uri_mismatch errors
- Plan 02: GitHub OAuth requires two separate apps (not one) — single callback URL field per app; dev app callback: `http://localhost:3000/api/auth/callback/github`; prod app callback: `https://torchsecret.com/api/auth/callback/github`
- Dev GITHUB_CLIENT_ID: Ov23li5k0Yn5xDN5O9Ro (Torch Secret Dev app); Prod GITHUB_CLIENT_ID: Ov23liOofIzZDcPqxGrJ (Torch Secret prod app)
- Do NOT set `disableDefaultScope: true` on GitHub provider — `user:email` scope is required for users with private email GitHub settings; without it, OAuth sign-up silently fails with redirect to /login?error=oauth
- Plan 03 Task 1: AUTH-06 (Google) and AUTH-07 (GitHub) both PASS when run with `infisical run --env=dev --`; full suite 361/361 green without Infisical (AUTH-06/07 skip gracefully)
- Known side-effect: running `infisical run --env=dev --` sets NODE_ENV=development which enables email verification; this causes 5 email/password auth tests to fail (not regressions — they pass in normal test:run where NODE_ENV=test)
- AUTH-06/07 test format: Better Auth 1.x returns 200+JSON body with {url, redirect:true} instead of 3xx redirect; test assertions updated accordingly in commit 77fa85d
- Plan 03 Task 2 (manual UAT): state_mismatch bug fixed — Google/GitHub redirect directly to localhost:3000, bypassing Vite proxy; state cookie was set on torchsecret.localhost:1355; fix: dev-only Express middleware bounces direct callbacks through APP_URL (commits b0c2321, a31f659)
- crossSubDomainCookies removed from auth.ts — bounce approach supersedes it and avoids Domain=localhost cookie security concerns; BETTER_AUTH_COOKIE_DOMAIN env var removed
- createOAuthButton silent bug fixed: changed void signIn.social() to await + error check; surfaces initiation failures as /login?error=oauth instead of silent no-op
- tsx watch requires full process restart to pick up new Infisical env vars — not a regression, just a dev workflow note
- Phase 39 COMPLETE — v5.0 Product Launch Checklist fully shipped

### Phase 40 Plan 05 Execution Notes

- Plan 05: console.error replaced with logger.error({ err: message }, 'event_name') in notification.service.ts (1 call) and subscribers.service.ts (3 calls: resend_contacts_create_failed_on_confirm, loops_subscribed_event_failed_on_confirm, resend_contacts_create_failed_on_unsubscribe)
- Pino logger import: `import { logger } from '../middleware/logger.js'` — both service files in server/src/services/, logger at server/src/middleware/logger.ts
- ZK invariant preserved: no userId or secretId in any logger.error object — only error.message strings
- OAuth account-linking audit (SR-004/Item #10): Better Auth 1.x default confirmed secure — no account.accountLinking.trustedProviders config; linkAccountOnSignIn defaults false; two accounts with same email stay separate without explicit linking
- Auth.ts audit comment pattern: JSDoc `/** */` above the socialProviders property with Finding/Evidence/Action required/Re-audit trigger structure
- Phase 40 COMPLETE — all 5 plans shipped: rate-limit hardening (01), PostgreSQL pool hardening (02), test scaffolds (03), Stripe webhook tests (04), logging/audit (05)

### Phase 40 Execution Notes

- Plan 01: createVerifyTightLimiter added to rate-limit.ts (5 req/min burst guard for POST /:id/verify, fires before Argon2id); wired as FIRST middleware before verifySecretLimiter in secrets.ts
- Plan 01: wrapStoreWithWarnOnError helper intercepts Store.increment — logs Pino warn before re-throwing so passOnStoreError can handle error silently while giving Redis observability
- Plan 01: isE2E gate hardened from single `E2E_TEST=true` to dual `NODE_ENV=test && E2E_TEST=true` — prevents accidental production bypass if only one env var is set
- Plan 01: p-limit installed; verifyPassword wrapped with pLimit(4) — caps concurrent Argon2id operations at 4 (~76 MiB peak); excess requests queue not reject
- Plan 01: ciphertext Zod max reduced 200_000 → 100_000 chars to match existing express.json({ limit: '100kb' }) body parser enforcement (SR-014)
- Plan 01: 413 entity.too.large and 503 pool timeout handlers added BEFORE logger.error in errorHandler — avoids polluting error logs with expected client/infra events
- Plan 02: PostgreSQL pool hardened with max:10, idleTimeoutMillis:30000, connectionTimeoutMillis:5000, options:'-c statement_timeout=10000' (SR-016)
- pool.on('error') logs err.message (not full Error object) via Pino warn with event label 'pg_pool_idle_client_error' — prevents uncaught EventEmitter exceptions from idle client disconnections
- connectionTimeoutMillis:5000 fast-fail propagates to Plan 01's 503 circuit breaker in error-handler.ts
- Pre-existing ESLint errors in auth.test.ts (lines 9+18) discovered and deferred — unrelated to pool hardening; logged in deferred-items.md
- Plan 04: GET /api/me wraps subscriptionTier under { user: { subscriptionTier } } — flat proRes.body.subscriptionTier is undefined; tests use proRes.body.user.subscriptionTier
- Plan 04: Race condition test (Gap 6) allows [403, 404] as valid concurrent verify responses — invariant is 0 DB rows after settle; first hit destroys secret, others may see wrong_password before destroy propagates
- Plan 04: Rate limiter 429 integration test deferred to staging/E2E — isE2E guard sets limit=1000 in Vitest, making 429 structurally untriggerable at unit level
- Plan 04: expiration-worker.test.ts already had 11 comprehensive soft/hard delete tests from Phase 6 — no new tests needed; verified green

### Phase 41 Execution Notes

- Plan 01: CHANGELOG.md v5.0 entry (Torch Secret brand, OAuth, marketing homepage, Infisical, Loops, SEO pages, security hardening) + v4.0 entry (Better Auth, dashboard, Stripe billing, passphrase protection, PostHog, email notifications) added; package.json bumped to 5.0.0
- Plan 02: CONTRIBUTING.md rewritten with dual-path setup (Option A: Infisical, Option B: .env.example) with frontend URL http://torchsecret.localhost:1355; SECURITY.md updated (5.x current, 4.x EOL); stale norcalcoop/secureshare URL sweep across all 5 public docs
- Plan 03: screenshots/ directory created with 4 PNG captures (homepage-dark.png, homepage-light.png, create-flow.png, reveal-flow.png); README.md Screenshots section embedded before Contributing; .gitignore !screenshots/*.png exception added
- Plan 04: Human verification checkpoint approved — all five documents confirmed accurate and production-ready; Phase 41 complete; v5.0 milestone fully shipped

### Blockers/Concerns

None — v5.0 fully shipped; all phases complete

## Session Continuity

Last session: 2026-03-02
Stopped at: Completed 41-04-PLAN.md — human verification checkpoint approved; all Phase 41 docs confirmed accurate and production-ready; Phase 41 complete; v5.0 milestone fully shipped.
Resume file: N/A — all phases complete

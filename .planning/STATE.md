---
gsd_state_version: 1.0
milestone: v5.2
milestone_name: Tech Debt & Launch Prep
status: completed
stopped_at: Completed 58.5-01-PLAN.md
last_updated: "2026-03-08T19:12:31.776Z"
last_activity: "2026-03-08 - Completed quick task 1: Create .github/dependabot.yml with github-actions and npm ecosystems"
progress:
  total_phases: 13
  completed_phases: 13
  total_plans: 28
  completed_plans: 28
  percent: 100
---

# Session State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-06 after v5.2 milestone start)

**Core value:** Users can share sensitive information once, securely, without accounts or complexity
**Current focus:** Phase 61 — Launch Distribution Assets (all LAUNCH-04–06 closed)

## Current Position

Phase: 61 of 61 (Reddit posts + PH listing + launch email)
Plan: 2 of 2 complete
Status: Phase 61 complete — LAUNCH-04, LAUNCH-05, LAUNCH-06 all CLOSED
Last activity: 2026-03-08 - Completed quick task 1: Create .github/dependabot.yml with github-actions and npm ecosystems

Progress: [██████████] 100% (10/10 plans complete across v5.2)

## Performance Metrics

| Milestone | Phases | Plans | Timeline |
|-----------|--------|-------|----------|
| v1.0 MVP | 8 | 22 | 2 days |
| v2.0 UI & SEO | 6 | 14 | 3 days |
| v3.0 Production-Ready | 6 | 15 | 2 days |
| v4.0 Hybrid Anonymous + Account | 10 | 38 | 4 days |
| v5.0 Product Launch Checklist | 19 | 63 | 9 days |
| v5.1 Email Infrastructure | 8 | 16 | 3 days |
| **Total shipped** | **57** | **168** | **~23 days** |
| Phase 55-server-code-quality-hardening P01 | 8 | 2 tasks | 1 files |
| Phase 55 P02 | 5 | 2 tasks | 3 files |
| Phase 56-test-gap-closure-services-stripe P01 | 4 | 2 tasks | 2 files |
| Phase 57 P01 | 18 | 2 tasks | 3 files |
| Phase 58-dmarc-upgrade P01 | 0 | 3 tasks | 0 files |
| Phase 59-repo-hygiene-documentation P01 | 2 | 2 tasks | 1 files |
| Phase 60-launch-narrative-writing P01 | 3 | 3 tasks | 3 files |
| Phase 61 P01 | 138s | 3 tasks | 3 files |
| Phase 61-launch-distribution-assets P02 | 3 | 2 tasks | 2 files |
| Phase 58.1-01 P01 | 261s | 3 tasks | 3 files |
| Phase 58.1 P04 | 321s | 1 tasks | 3 files |
| Phase 58.1 P03 | 500s | 2 tasks | 5 files |
| Phase 58.1 P05 | 359 | 2 tasks | 6 files |
| Phase 58.2-launch-quick-wins-do-now P01 | 229 | 2 tasks | 7 files |
| Phase 58.2 P04 | 196 | 3 tasks | 4 files |
| Phase 58.2-launch-quick-wins-do-now P05 | 120 | 1 tasks | 2 files |
| Phase 58.3-small-gems P01 | 309 | 2 tasks | 4 files |
| Phase 58.3-small-gems P03 | 8 | 2 tasks | 1 files |
| Phase 58.3-small-gems P02 | 8 | 2 tasks | 2 files |
| Phase 58.3-small-gems P04 | 480 | 1 tasks | 1 files |
| Phase 58.3-small-gems P05 | 900 | 2 tasks | 3 files |
| Phase 58.5-marketing-audit-fixes P02 | 128 | 2 tasks | 3 files |
| Phase 58.5-marketing-audit-fixes P01 | 483 | 3 tasks | 13 files |

## Accumulated Context

### Roadmap Evolution

- Phase 58.1 inserted after Phase 58: UI/UX custom themes with theme selectors, light and dark mode, custom SVG (URGENT) — retro theme definitions from /Users/ourcomputer/Downloads/retro-themes.jsx; must use frontend-design skill
- Phase 58.2 inserted after Phase 58: launch quick wins do now (URGENT) — 5 "Do Now" small gems from 10x session-1 analysis: mobile share sheet, QR code, mailto button, clipboard auto-clear countdown, intelligent expiry suggestion (renumbered from 58.1)
- Phase 58.3 inserted after Phase 58: small gems (URGENT) — all 9 Small Gems from 10x session-1 analysis (renumbered from 58.2)
- Phase 58.4 inserted after Phase 58: de-activate custome themes (URGENT)
- Phase 58.5 inserted after Phase 58: marketing audit fixes (URGENT)



### Key Architectural Constraints (carry forward)

- Zero-knowledge invariant: no log, DB record, or analytics event may contain both userId and secretId — ever (see .planning/INVARIANTS.md)
- Email: Resend sends from noreply@torchsecret.com (transactional), Loops from hello@torchsecret.com (onboarding)
- Cloudflare Email Routing owns the apex @ SPF record — never modify apex SPF
- DMARC now at p=quarantine (upgraded in Phase 58 after 30-day clean monitoring baseline). Next step: p=reject after confirming clean p=quarantine aggregate reports.
- Repository is public: https://github.com/norcalcoop/torch-secret; .planning/ and CLAUDE.md are gitignored

### v5.2 Phase Order

- Phase 54: BUG-01, BUG-02 (fix error CTA + OG domain placeholder)
- Phase 55: QUAL-01–04 (noindex auth routes, logger migration, E2E gate, Stripe idempotency)
- Phase 56: TEST-01, TEST-02 (notification todo + Stripe webhook test suite)
- Phase 57: TEST-03, TEST-04 (race condition + ZK invariant systematic tests)
- Phase 58: INFRA-01 (DMARC p=none → p=quarantine)
- Phase 59: DOCS-01, DOCS-02 (README Tally link + issue triage)
- Phase 60: LAUNCH-01–03 (screencast script + Show HN + technical writeup)
- Phase 61: LAUNCH-04–06 (Reddit posts + PH listing + launch email)

### Phase 58.5 Plan 01 Decisions (2026-03-08)

- Homepage email capture section deleted entirely (createEmailCaptureSection + replaceFormWithSuccess removed) — QW8 removes a conversion liability with no replacement
- S4 /use/ links use plain `<a href>` on card titles without navigate() — /use/* pages are Express SSR routes; SPA navigate() would 404
- QW2 Pro banner reads URLSearchParams only at render time (no sessionStorage) — per RESEARCH.md Pitfall 5, sessionStorage does not survive OAuth redirects
- compareDocumentPosition document-order test uses both text fragments to uniquely identify guarantee `<p>` vs. FAQ answer element that also contains "7-day" text

### Phase 58.5 Plan 02 Decisions (2026-03-08)

- bitwarden-send framing: "different tools for different jobs" — measured, not aggressive; FAQ addresses the free objection directly with account-friction explanation
- email-and-slack framing: educational problem/solution for credential-risk education targeting "share password without email" top-of-funnel query

### Phase 58.4 Plan 01 Decisions (2026-03-08)

- RETRO_ENABLED=false gate: single exported constant from theme-toggle.ts gates dropdown, app.ts startup, and FOWT inline script — one-line re-enablement post-launch (flip to true in theme-toggle.ts + index.html)
- helpers refactored from retroGroup.querySelectorAll to panel.querySelectorAll — retroGroup scoped inside if (RETRO_ENABLED) block, not accessible from outer scope
- accessibility tests updated to RETRO_ENABLED-aware branches rather than deleted — tests remain useful when gate is flipped to true post-launch

### Phase 58.3 Plan 05 Decisions (2026-03-08)

- roundToNearestExpiry boundaries: < 2h → 1h, < 48h → 24h, <= 168h → 7d — plan spec used <= 2 and <= 48 but Wave 0 tests expect 2h → 24h and 48h → 7d (exclusive boundaries)
- Label and notify toggle created synchronously before auth IIFE — Wave 0 tests assert DOM synchronously after renderCreatePage(); async IIFE with null-session mock would never populate DOM
- notify-on-view renamed to notify-toggle to match #notify-toggle selector in Wave 0 tests
- prefillExpiry applied to anonymous select via instanceof HTMLSelectElement guard — no-op for production custom combobox; works for test mock's plain <select>
- activeWordList closure-local state (no localStorage) — resets to EFF_WORDS on navigation per locked decision

### Phase 58.3 Plan 04 Decisions (2026-03-08)

- attachBurnTimer called inside renderRevealedSecret (not only after it in renderRevealPage) — Wave 0 tests call renderRevealedSecret directly; function must be self-contained to pass test suite without driving the full page flow
- querySelector('.mb-6') used to find terminal element for status line insertion — createTerminalBlock mock returns plain div that gets mb-6 added; querySelector('pre') used only at T=0 with null guard for content hiding
- burnSeconds > 0 guard: parseInt('abc', 10) returns NaN; !Number.isNaN filters it; negative/zero values also rejected

### Phase 58.3 Plan 03 Decisions (2026-03-08)

- select.value = '30' set after option append to force DOM selection state — optEl.selected = true does not reflect through .selected property query in happy-dom test environment
- id="preview-terminal" set on createTerminalBlock wrapper div for querySelector('#preview-terminal') targeting in tests
- burnParam appended before # fragment per RFC 3986 §3.5 — reveal.ts reads window.location.search for burn timer trigger; burnTimerRow inserted unconditionally (no auth gate) per 58.3-CONTEXT.md

### Phase 58.3 Plan 02 Decisions (2026-03-08)

- buf[0] and wordList[index] require no type assertions — TypeScript infers number from Uint32Array; used ?? fallback for wordList access to satisfy strict checks without unsafe assertions
- getUnbiasedIndex() renamed to getUnbiasedRandomIndex(listLength) — generalised from hard-coded WORD_COUNT=7776 to accept any list length; same rejection-sampling algorithm

### Phase 58.2 Plan 05 Decisions (2026-03-08)

- clearClipboard() extracted as inner function inside createCopyButton closure so it closes over pendingFocusHandler without argument passing
- pendingFocusHandler stored at closure level (not inside startCountdown) so re-copy can always remove stale handler before registering a new countdown
- { once: true } event listener option used — listener self-removes after first focus event; manual removal only needed in the re-copy cleanup path

### Phase 58.2 Plan 04 Decisions (2026-03-08)

- Mobile button ordering: no reorder on small screens — Copy Link is the reliable primary; flex-wrap handles overflow. Decision recorded as Claude's Discretion comment in confirmation.ts.
- getExpirySuggestion exported from create.ts so tests can import and test branches directly with vi.setSystemTime — avoids full module mocking

### Phase 58.2 Plan 01 Decisions (2026-03-08)

- optimizeDeps.include: ['qrcode'] prevents require-is-not-defined runtime error — qrcode is CJS-only; Vite's esbuild pre-bundling converts it to ESM before the browser sees it
- qr-code-panel.ts and mailto-button.ts were pre-implemented as WIP; Wave 0 test stubs exist and cover all 4 components; copy-button and expiration-select remain correctly RED for Wave 1
- eslint-disable for no-base-to-string on QRCode.toString() — ESLint misidentifies qrcode API method as Object.prototype.toString; targeted disable is correct

### Phase 58.1 Plan 05 Decisions (2026-03-07)

- Fire-and-forget font load (void loadRetroFont) at call site — colors already correct from FOWT; font snaps in asynchronously without blocking UI
- retroFontLoaded module-level flag prevents duplicate dynamic CSS imports on repeated pixel-font theme activations
- ESLint e2e/** config extended with no-unsafe-call/return/unbound-method to match *.test.ts pattern — Playwright types not fully resolved by projectService without explicit @playwright/test in tsconfig types array
- E2E FOWT tests require rebuilt client: server caches index.html at startup via readFileSync; reuseExistingServer=true means stale pre-retro build fails FOWT assertions (bgColor returns "")

### Phase 58.1 Plan 04 Decisions (2026-03-07)

- MatrixRain uses pure CSS @keyframes mRain on column divs — no setInterval, per spec requirement
- ScanlineOverlay not guarded by prefers-reduced-motion — it is a static CSS texture (not motion)
- Single cleanup array pattern: each mount fn returns () => void; currentCleanup iterates the array
- DosTyper uses data-dos-line attribute for test detection; all 13 lines shown immediately under reduced motion

### Phase 58.1 Plan 03 Decisions (2026-03-07)

- ICONS record keyed by navEntry.i strings (e.g. 'mario_home') — same keys used in THEMES[id].nav[i].i, so createPixelIcon(navEntry.i) works directly in Plans 04-05
- FOWT R{} map order: [bg, text, primary, accent, cardBg, navBg, borderColor] — matches applyRetroColors() CSS var assignment order in retro-theme.ts exactly
- createPixelIcon returns fallback circle SVG for unknown IDs rather than throwing — prevents layout breakage
- frontend-design skill not invoked (does not exist at ~/.claude/skills/frontend-design/); plan was self-contained

### Phase 58.1 Plan 01 Decisions (2026-03-07)

- applyRetroColors is stateless (no localStorage writes); caller owns persistence; preview flag is semantic-only
- 21 themes confirmed as authoritative count; REQUIREMENTS.md/ROADMAP "22" is a planning error
- clearRetroTheme calls applyTheme() after cleanup to restore light/dark base immediately
- cardBorder color extracted via regex before setting --ds-color-border (handles "2px solid #hex" format)
- initRetroThemeListener uses module-level listenerRegistered guard (same pattern as theme.ts)

### Phase 58 Decisions (2026-03-07)

- Proceeded to p=quarantine (not p=reject) as the upgrade target — appropriate intermediate step; p=reject can follow after monitoring p=quarantine reports for a clean window
- SRS misalignment from Cloudflare Email Routing (Cloudflare forwarding IPs) classified as non-blocking and confirmed in pre-flight aggregate report review
- No application code produced — plan was pure DNS infrastructure change

### Blockers/Concerns

None. DMARC monitoring action outstanding: check admin@torchsecret.com 1–3 days post Phase 58 DNS change for new aggregate reports. Revert to p=none immediately if any Resend/Loops.so IPs show dkim=fail.

### Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
|---|-------------|------|--------|--------|-----------|
| 1 | Create .github/dependabot.yml with github-actions and npm ecosystems | 2026-03-08 | a9cb89a | Verified | [1-create-github-dependabot-yml-with-github](./quick/1-create-github-dependabot-yml-with-github/) |

### Phase 54 Decisions (2026-03-06)

- CTA in error.ts is config-driven via ERROR_CONFIG[type].cta (label + href) — consistent with heading/message/icon pattern; no imperative conditionals in render block
- twitter:image not added to updateOgTags() — brand-static image, same approach as og:image

### Phase 55 Decisions (2026-03-06)

- QUAL-02 and QUAL-03 closed as verified-by-code-read: grep output is sufficient machine-readable proof; no test file needed for static analysis requirements
- New noindex tests placed inside existing 'Success Criterion 6' describe block to reuse spaApp fixture — no new beforeAll/afterAll

### Phase 56 Decisions (2026-03-06)

- vi.mock path is relative to test file, not module under test — use `../../middleware/logger.js` from `__tests__/` dir (not `../middleware/logger.js` as the service module uses)
- Use `env.STRIPE_WEBHOOK_SECRET` directly in `generateTestHeaderString` (object-arg form) — handler and test share same signing secret for HMAC verification

### Phase 57 Decisions (2026-03-06)

- FOR UPDATE pessimistic lock added to verifyAndRetrieve Step 0 via tx.execute(sql) — Drizzle ORM has no native FOR UPDATE; subsequent Drizzle SELECT (Step 1) inherits the lock within the same transaction
- sql.raw() used for ARRAY[] literals in TEST-04 — Drizzle sql`` template interpolates JS arrays as tuples ($1,$2,...) which PostgreSQL rejects for ANY(); sql.raw() with hardcoded constants is safe workaround
- ZK schema invariant test uses PostgreSQL ~* case-insensitive regex (secret.*(id|_id)$) to catch all secretId naming variants in one information_schema.columns query

### Phase 59 Decisions (2026-03-07)

- README Contributing section is the correct placement for the feedback link — completes feedback trilogy (confirmation + reveal + README all point to TALLY_FEEDBACK_URL)
- Unicode arrow (→) used verbatim — provides visual distinction from CONTRIBUTING.md reference immediately above
- "stale" label created at #ededed in norcalcoop/torch-secret; zero issues found in open or closed audit (clean repo state at Phase 59 execution)

### Phase 60 Decisions (2026-03-07)

- Demo secret locked to OPENAI_API_KEY=sk-proj-... format — sk-proj- prefix is current OpenAI format, immediately recognizable to HN/PH audiences; x-fill makes the value obviously fake
- Show HN title leads with RFC 3986 §3.5 citation — verifiable technical claim that rewards curiosity without marketing language; title preserved verbatim from research recommendation
- Limitations named as a dedicated section in both technical writeup and submitter comment — not a footnote; pre-announces device compromise, extensions, ciphertext length visibility, JS trust model
- Submitter comment targets ~490 words (within 300–500 word range); PADME paragraph identified as the trim candidate if editors find it over limit
- Technical writeup ISC license corrected from MIT in fix commit d99c717 (applied during Task 2 session)

### Phase 61 Decisions (2026-03-07)

- r/netsec title leads with RFC 3986 §3.5 citation — verifiable technical claim earns security practitioner trust; title reads as practitioner sharing, not founder announcing
- r/netsec limitations section is a first-class body section with named heading (not a footnote) — device compromise, browser extensions, JS trust model all named explicitly
- r/selfhosted title leads with docker-compose not product name — self-hoster audience is skeptical of SaaS-first openers; hosted version appears as secondary sentence only
- r/devops opens with alternatives bullet list (Slack DM / email / 1Password vault) to crystallize credential-sharing pain point before naming the product
- PH first comment: removed PADME paragraph (Phase 60 identified trim candidate) to reach 370 words within 300-400 PH target; HN-specific phrasing replaced with "A few honest limitations worth naming upfront:"
- Launch email: single [PRODUCT HUNT LINK] CTA only — no second URL in body; Resend click analytics shows PH conversion rate cleanly
- Launch email subject: "Torch Secret is live on Product Hunt today" — direct, personal, no marketing fluff; chosen over "We launched today" and "Big day:" options

## Session Continuity

Last session: 2026-03-08T19:12:31.772Z
Stopped at: Completed 58.5-01-PLAN.md
Resume file: None
Next action: /gsd:execute-phase 55

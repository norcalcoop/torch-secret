# Phase 41: Update README and Stale Documentation for Torch Secret v5.0 Launch - Research

**Researched:** 2026-03-02
**Domain:** Documentation — changelog back-fill, contributor setup, version tables, README screenshots
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Scope:** Documentation-only phase — no code changes
- **CHANGELOG back-fill:** Back-fill both v4.0 and v5.0 (not just v5.0)
  - v4.0 milestone: auth/billing/dashboard/analytics/email/Stripe/rate-limiting
  - v5.0 milestone: rebrand (Torch Secret), Infisical secrets, Loops email, Google + GitHub OAuth, marketing homepage, SEO SSR pages, v5.0 launch checklist phases
  - Update `[Unreleased]` comparison link and add v4.0 + v5.0 release tag links at bottom
  - Package.json is at `4.0.0`; CHANGELOG should go to `5.0.0` for the launch milestone
- **CONTRIBUTING.md dual setup paths:**
  1. Team/internal path (Infisical): `infisical login` → `npm run dev:server` / `npm run dev:client` — no `.env` file
  2. Community/external path (.env.example): `cp .env.example .env`, manually fill vars
  - Update clone URL once GitHub repo is renamed
  - Update frontend port: was `:5173` (plain Vite), now portless at `torchsecret.localhost:1355`
  - Keep `.env.example` as fallback reference for community contributors
- **GitHub repo URL rename:** Update all 10 occurrences of `norcalcoop/secureshare` across 5 files to new repo URL after rename
  - `README.md`: 2 badge URLs (CI + License shields)
  - `CONTRIBUTING.md`: 2 links (git clone URL + issue link)
  - `SECURITY.md`: 1 link (vulnerability advisory)
  - `.github/ISSUE_TEMPLATE/config.yml`: 1 link (security advisories)
  - `CHANGELOG.md`: 4 comparison/release tag links
- **SECURITY.md version table:** Update to `5.x` = Yes (current), `4.x` = No (EOL), `3.x and below` = No (EOL)
- **Deployment docs (Cloudflare Worker keep-alive):** Keep the section — still deployed on Render.com free tier
- **README screenshots:** Add screenshots to README; `screenshots/` folder does not currently exist (needs creating); capture current Torch Secret v5.0 UI; embed with descriptive alt text

### Claude's Discretion

- CHANGELOG entry granularity: phase-by-phase vs feature-grouped-by-milestone (feature-grouped recommended for readability)
- Whether to update CI workflow test DB credentials from `secureshare` to `torchsecret` (cosmetic, low priority)
- Screenshot selection: which pages, dark vs light mode, exact README placement
- CHANGELOG comparison link URL format once repo is renamed and tags are created

### Deferred Ideas (OUT OF SCOPE)

- None — discussion stayed within phase scope
</user_constraints>

---

## Summary

Phase 41 is a pure documentation update phase. No application code changes are involved. The work consists of five discrete document edits — README.md, CONTRIBUTING.md, CHANGELOG.md, SECURITY.md, and `.github/ISSUE_TEMPLATE/config.yml` — plus taking and embedding screenshots, and bumping `package.json` version to `5.0.0`.

The largest task is the CHANGELOG back-fill. The current CHANGELOG only covers v1.0, v2.0, and v3.0. Versions 4.0 and 5.0 shipped across 20 phases (Phases 21-40) without corresponding CHANGELOG entries. The back-fill must reconstruct accurate feature-grouped entries from STATE.md execution notes and the ROADMAP phase list. The format (Keep a Changelog 1.1.0) and bullet-point/subsection style is already established by the existing entries.

The screenshot task requires taking a live browser capture of the running application. This means the app needs to be running at the time the screenshot task executes. The `screenshots/` folder does not exist at the repo root and must be created. Screenshots should cover the pages that best communicate the product's v5.0 value: marketing homepage (both light and dark), create flow, reveal flow, and dashboard.

**Primary recommendation:** Plan this as four sequential plans — (1) CHANGELOG back-fill + package.json version bump, (2) CONTRIBUTING.md dual-path rewrite + SECURITY.md version table + GitHub repo URL updates across all 5 files, (3) Screenshots capture and README embedding, (4) Human verification checkpoint.

---

## Standard Stack

### Core

No new libraries needed. This phase involves only file edits and screenshot capture using the browser.

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| Keep a Changelog | 1.1.0 | CHANGELOG format (already in use) | Established in the project |
| Semantic Versioning | 2.0.0 | Version numbering (already in use) | Established in the project |
| Shields.io | N/A | README badge URLs (already in use) | No change needed to badge format |

### Screenshot Capture

Screenshots must be taken with the app running. The `gsd-uat-browser` skill (agent-browser + portless) is available and is the recommended approach for browser screenshots. Alternatively, any browser screenshot method is acceptable since this is a human-action task.

**Installation:**
```bash
# No new dependencies — documentation only
```

---

## Architecture Patterns

### Recommended Plan Structure

```
Phase 41/
  Plan 01 — CHANGELOG back-fill (v4.0 + v5.0 entries) + package.json 5.0.0 bump
  Plan 02 — CONTRIBUTING.md rewrite + SECURITY.md + GitHub URL updates (5 files)
  Plan 03 — Screenshots capture + README embedding
  Plan 04 — Human verification checkpoint
```

Rationale: CHANGELOG is the most complex task (largest single edit, many data points from STATE.md) and should be isolated. CONTRIBUTING.md + the URL sweep are complementary edits that touch many small files. Screenshots are a distinct workflow requiring a running app. Verification closes the phase.

### Pattern 1: Keep a Changelog Entry Format

The existing CHANGELOG uses this pattern:

```markdown
## [X.0.0] - YYYY-MM-DD

### Added

- Feature description — one line, past tense, specific

### Changed

- Changed behavior description

### Fixed

- Fix description
```

Feature-grouped (not phase-by-phase) entries are the right choice for v4.0 and v5.0 because the audience is contributors and deployers, not internal project managers. Group by capability area: Auth, Dashboard, Billing, Analytics, Email, etc.

### Pattern 2: CHANGELOG Comparison Link Format

Existing links at the bottom of CHANGELOG.md follow this format:

```markdown
[Unreleased]: https://github.com/OWNER/REPO/compare/v5.0...HEAD
[5.0.0]: https://github.com/OWNER/REPO/compare/v4.0...v5.0
[4.0.0]: https://github.com/OWNER/REPO/compare/v3.0...v4.0
[3.0.0]: https://github.com/OWNER/REPO/compare/v2.0...v3.0
[2.0.0]: https://github.com/OWNER/REPO/compare/v1.0...v2.0
[1.0.0]: https://github.com/OWNER/REPO/releases/tag/v1.0
```

The CONTEXT.md notes that git tags `v4.0` and `v5.0` need to exist on the repo for these links to resolve. Tag creation is a human-action step (not Claude-automated).

The new repo URL (post-rename) is not yet known — the CONTEXT.md says "once GitHub repo is renamed." The plan should use a placeholder or note that links require the final repo URL once the rename happens. The current `norcalcoop/secureshare` slug must be replaced in the links.

### Pattern 3: CONTRIBUTING.md Dual-Path Structure

The existing CONTRIBUTING.md has a single linear setup path (clone → `cp .env.example .env` → migrate → start servers). The new version needs to clearly fork into two paths immediately after `npm install`:

```markdown
## Development Setup

...

3. **Configure environment:**

   **Option A — Team/internal contributors (Infisical access):**

   ```bash
   infisical login   # one-time per machine
   ```
   No `.env` file needed. Secrets are pulled automatically.

   **Option B — Community contributors (no Infisical access):**

   ```bash
   cp .env.example .env
   ```
   Edit `.env` and fill in required values. See `.env.example` for documentation.
```

This makes the distinction immediately obvious at the decision point, rather than burying the Infisical path in a separate section.

### Pattern 4: Screenshots Folder Structure

```
screenshots/
  homepage-dark.png
  homepage-light.png
  create-flow.png
  reveal-flow.png
  dashboard.png
```

In README.md, embed with descriptive alt text per accessibility practice:

```markdown
![Torch Secret homepage showing the zero-knowledge encryption hero section in dark mode](screenshots/homepage-dark.png)
```

### Anti-Patterns to Avoid

- **Back-filling CHANGELOG phase-by-phase:** Produces 20+ entries that are unreadable. Use feature-grouped milestone entries (v4.0 = one entry with subsections, v5.0 = one entry with subsections).
- **Leaving the `[Unreleased]` section populated:** The `[Unreleased]` section should remain empty (just a heading) after the back-fill; all content goes under versioned sections.
- **Hardcoding the new repo URL before the rename is confirmed:** Use a note or placeholder if the final GitHub org/repo slug is not yet known. The rename is a prerequisite human action.
- **Taking screenshots with the app in a broken state:** Screenshots must be taken with a clean dev environment; run `npm run dev:server` and `npm run dev:client` with Infisical first.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Badge URL generation | Custom badge markup | Shields.io URL pattern already in README | Consistent with existing badges |
| CHANGELOG format | Custom format | Keep a Changelog 1.1.0 (already established) | Consistency with v1-v3 entries |
| Version bumping | Shell script | Direct `package.json` edit | Single-file change, no tooling needed |

**Key insight:** This phase has no new technical problems. Every sub-task involves updating an existing file to match a well-defined target state that is fully documented in CONTEXT.md and STATE.md.

---

## Common Pitfalls

### Pitfall 1: CHANGELOG Tag Links Point to Wrong URL

**What goes wrong:** The comparison links at the bottom of CHANGELOG.md reference `norcalcoop/secureshare`. After the GitHub rename these will redirect, but the SECURITY.md advisory link (absolute URL) and issue template link will also need updating.
**Why it happens:** 10 occurrences across 5 files — easy to miss one file.
**How to avoid:** Use a grep pass after edits: `grep -r "norcalcoop/secureshare"` across all 5 affected files.
**Warning signs:** Any remaining `norcalcoop/secureshare` string after the URL update plan is a miss.

### Pitfall 2: Screenshots Folder Does Not Exist

**What goes wrong:** The `screenshots/` directory is referenced in CONTEXT.md as "exists at repo root, currently empty" but `ls screenshots/` reveals it does not exist on disk.
**Why it happens:** The directory was mentioned in earlier planning as "ready to receive captures" but was never actually created.
**How to avoid:** The screenshot plan must create the `screenshots/` directory before adding image files. README embed links must match the exact filename used.

### Pitfall 3: CI Workflow Credential Mismatch After Update

**What goes wrong:** If the CI workflow PostgreSQL credentials (`secureshare`/`secureshare`/`secureshare`) are updated to `torchsecret`, the `DATABASE_URL` env var on the same job must also be updated simultaneously — a partial update breaks CI.
**Why it happens:** Three POSTGRES_* env vars + DATABASE_URL must be updated together if updating at all.
**How to avoid:** Either update all four together or defer this cosmetic change entirely (Claude's Discretion per CONTEXT.md). The latter is safer for a documentation-only phase.

### Pitfall 4: package.json Version and CHANGELOG Date Mismatch

**What goes wrong:** package.json bumped to `5.0.0` with today's date, but the CHANGELOG `[5.0.0]` entry uses a different date.
**Why it happens:** Two separate edits, easy to use different dates.
**How to avoid:** Decide on a single date (today: 2026-03-02) and use it consistently in both package.json (if the version field includes a date elsewhere) and the CHANGELOG entry header.

### Pitfall 5: CONTRIBUTING.md Port Reference Incomplete

**What goes wrong:** The frontend port reference is updated from `:5173` to `torchsecret.localhost:1355` in the numbered setup steps but left stale in the "Docker" section or the full quality check command.
**Why it happens:** The port appears in multiple places in the file.
**How to avoid:** Search CONTRIBUTING.md for all occurrences of `:5173` before completing the plan.

---

## Code Examples

### CHANGELOG v4.0 Entry Source Data

The following features ship as v4.0 based on STATE.md and ROADMAP.md Phases 21-30:

**Added:**
- User accounts with email/password registration, login, email verification (Better Auth 1.x)
- Secret dashboard: authenticated users can view, track, and manage all their created secrets
- EFF Diceware passphrase generator for secret protection (client-side, word list bundled)
- Optional password or passphrase protection for secrets (Argon2id server-side hashing)
- Passphrase/password tier enforcement: anonymous users blocked; free users limited to generated passphrases; Pro users get custom passwords
- Privacy-safe PostHog analytics with URL fragment stripping and zero-knowledge-safe event design
- Email notifications: secret-viewed alert sent to creator (ZK-safe: no secretId in email body)
- Stripe Pro billing: subscription checkout, Customer Portal, webhook lifecycle handler, 30-day expiration unlock
- Rate-limit conversion prompts: anonymous users see upgrade CTA after hitting limits
- Legal pages: `/privacy` and `/terms` with `noindex` enforcement
- Feedback links on confirmation and reveal pages (Tally.so)

**Changed:**
- Package version bumped to 4.0.0

### CHANGELOG v5.0 Entry Source Data

The following features ship as v5.0 based on STATE.md and ROADMAP.md Phases 31-41:

**Added:**
- Google OAuth and GitHub OAuth sign-in (Better Auth social providers, two separate GitHub apps for dev + prod)
- Marketing homepage at `/` with hero, zero-knowledge proof points, How It Works, and email capture
- Pricing page at `/pricing` with Free vs Pro tier cards, billing toggle, FAQ accordion, and FAQPage JSON-LD
- SEO content pages (Express SSR): `/vs/*`, `/alternatives/*`, `/use/*` — visible to AI crawlers without JS rendering
- GDPR-compliant email capture: homepage form, double opt-in, Resend Audiences, one-click unsubscribe
- Loops.so email onboarding: welcome email on registration, day-3 key features, day-7 upgrade prompt (marketing consent gated)
- PostHog enrichment: `checkout_initiated`, `subscription_activated`, `dashboard_viewed` events; launch dashboard, conversion funnels, cohorts
- Security hardening: Argon2id concurrency cap (p-limit), tighter rate limiting on verify endpoint, PostgreSQL pool hardening, payload size cap
- Infisical secrets management: all secrets in Infisical Cloud; no `.env` files required for team dev
- Supply chain security scanning via Socket.dev

**Changed:**
- App renamed from SecureShare to Torch Secret across all user-facing surfaces, canonical URLs, and metadata
- All canonical URLs, sitemap entries, JSON-LD, and OG tags updated to `torchsecret.com`
- Create-secret form moved from `/` to `/create`; `/` now shows marketing homepage
- `.env.example` stripped to keys-only reference; all values managed via Infisical
- Package version bumped to 5.0.0

### Shields.io Badge URL Pattern

```markdown
[![CI](https://github.com/NEW_OWNER/NEW_REPO/actions/workflows/ci.yml/badge.svg)](https://github.com/NEW_OWNER/NEW_REPO/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/NEW_OWNER/NEW_REPO)](LICENSE)
```

The `[![Live](https://img.shields.io/badge/live-torchsecret.com-orange)](https://torchsecret.com)` badge does not reference the GitHub repo URL and does not need updating.

---

## State of the Art

| Old State | Current State | Changed In | Impact |
|-----------|--------------|-----------|--------|
| CHANGELOG only covers v1-v3 | Must cover v1-v5 | Phase 41 (this phase) | Misleading to contributors |
| CONTRIBUTING.md: single `.env` setup path | Dual path: Infisical (team) + `.env.example` (community) | Phase 41 | Critical for community contributors |
| CONTRIBUTING.md: frontend on `:5173` | Frontend on `torchsecret.localhost:1355` via portless | Phase 37.2 | Dev setup instructions are broken as written |
| SECURITY.md: `3.x` = supported | `5.x` = supported | Phase 41 | Misleads security reporters |
| README: no screenshots | Screenshots folder + embedded captures | Phase 41 | Reduces comprehension for new visitors |
| `package.json` version: `4.0.0` | `5.0.0` | Phase 41 | Version is stale post-launch |
| GitHub repo URL: `norcalcoop/secureshare` | `NEW_OWNER/NEW_REPO` (post-rename) | Phase 41 / GitHub rename | Badge and advisory links broken |

---

## Open Questions

1. **What is the new GitHub repo URL after the rename?**
   - What we know: CONTEXT.md says "All `norcalcoop/secureshare` references should be updated to the new repo URL post-rename" but does not specify the new URL.
   - What's unclear: Whether the rename has already happened or is a future human action triggered during this phase.
   - Recommendation: Plan the URL update as a human-action task that precedes the automated file edits. The planner should create a task "Confirm new GitHub repo URL (human action)" before the grep/replace task.

2. **Should the CI workflow PostgreSQL credentials be updated from `secureshare` to `torchsecret`?**
   - What we know: CONTEXT.md explicitly marks this as Claude's Discretion, low priority, cosmetic.
   - What's unclear: Whether the user wants this done or not.
   - Recommendation: Skip — it is cosmetic and changing it requires updating `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, and `DATABASE_URL` in two jobs atomically. The risk of a partial update breaking CI outweighs the cosmetic benefit.

3. **What date should appear on the v5.0 CHANGELOG entry and package.json bump?**
   - What we know: Today is 2026-03-02. Phase 40 (the last code phase) completed on 2026-03-02.
   - Recommendation: Use `2026-03-02` as the v5.0 release date.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | `vitest.config.ts` |
| Quick run command | `npm run test:run` |
| Full suite command | `npm run test:run` |

### Phase Requirements to Test Map

This phase is documentation-only. There are no automated test requirements. All verification is human visual inspection.

| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|-------------|
| CHANGELOG accuracy | v4.0 + v5.0 entries present, format correct | manual | N/A | N/A |
| CONTRIBUTING.md paths | Both Infisical + .env.example paths documented | manual | N/A | N/A |
| SECURITY.md version | 5.x = Supported, 4.x and below = No | manual | N/A | N/A |
| URL updates | No remaining `norcalcoop/secureshare` in 5 files | grep | `grep -r "norcalcoop/secureshare" README.md CONTRIBUTING.md SECURITY.md .github/ CHANGELOG.md` | ✅ |
| package.json version | `5.0.0` | grep | `node -e "console.log(require('./package.json').version)"` | ✅ |
| Screenshots | Files exist in `screenshots/` + embedded in README | manual | `ls screenshots/` | ❌ (dir needs creating) |
| Port reference | No `:5173` in CONTRIBUTING.md | grep | `grep ":5173" CONTRIBUTING.md` | ✅ |

### Sampling Rate

- **Per task commit:** Grep checks above (fast, < 2s each)
- **Per wave merge:** Full visual review of rendered docs on GitHub
- **Phase gate:** Human verification checkpoint confirms all docs accurate before close

### Wave 0 Gaps

None — no test files needed. This is a documentation-only phase.

---

## Sources

### Primary (HIGH confidence)

- `/Users/ourcomputer/Github-Repos/secureshare/.planning/phases/41-update-readme-and-stale-documentation-for-torch-secret-v5-0-launch/41-CONTEXT.md` — user decisions, locked choices, stale references inventory
- `/Users/ourcomputer/Github-Repos/secureshare/.planning/STATE.md` — execution notes for v4.0 + v5.0 phases (source of CHANGELOG content)
- `/Users/ourcomputer/Github-Repos/secureshare/.planning/ROADMAP.md` — phase list and feature descriptions
- `/Users/ourcomputer/Github-Repos/secureshare/CHANGELOG.md` — existing format, current state (v1-v3 only)
- `/Users/ourcomputer/Github-Repos/secureshare/CONTRIBUTING.md` — current stale content
- `/Users/ourcomputer/Github-Repos/secureshare/SECURITY.md` — current stale version table
- `/Users/ourcomputer/Github-Repos/secureshare/README.md` — current state, screenshots section absent
- `/Users/ourcomputer/Github-Repos/secureshare/package.json` — version field currently `4.0.0`
- `/Users/ourcomputer/Github-Repos/secureshare/.github/ISSUE_TEMPLATE/config.yml` — stale repo URL
- `/Users/ourcomputer/Github-Repos/secureshare/.github/workflows/ci.yml` — PostgreSQL credentials (`secureshare` cosmetic ref)

### Secondary (MEDIUM confidence)

- Keep a Changelog format spec: https://keepachangelog.com/en/1.1.0/ — format already established in project, no new research needed

---

## Metadata

**Confidence breakdown:**
- File inventory (what files need changing): HIGH — read all files directly
- CHANGELOG content (what features to list): HIGH — sourced from STATE.md execution notes
- Screenshot workflow: MEDIUM — directory does not exist yet; creation approach is straightforward
- New GitHub repo URL: LOW — not yet confirmed; human action required

**Research date:** 2026-03-02
**Valid until:** 2026-03-09 (stable documentation domain, but the GitHub rename is time-sensitive)

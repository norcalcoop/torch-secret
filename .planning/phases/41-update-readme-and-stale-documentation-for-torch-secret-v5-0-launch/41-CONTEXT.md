# Phase 41: Update README and Stale Documentation for Torch Secret v5.0 Launch - Context

**Gathered:** 2026-03-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Update all public-facing documentation (README.md, CONTRIBUTING.md, SECURITY.md, CHANGELOG.md) to reflect the current state of the product at v5.0 launch. This includes back-filling missing milestone entries, fixing stale contributor setup instructions, updating version support tables, and adding README screenshots. This phase is documentation-only — no code changes.

</domain>

<decisions>
## Implementation Decisions

### CHANGELOG back-fill
- Back-fill **both v4.0 and v5.0** with full milestone entries (not just v5.0)
- v4.0 milestone covered: auth/billing/dashboard/analytics/email/Stripe/rate-limiting
- v5.0 milestone covered: rebrand (Torch Secret), Infisical secrets, Loops email, Google + GitHub OAuth, marketing homepage, SEO SSR pages, v5.0 launch checklist phases
- Update the `[Unreleased]` comparison link and add v4.0 + v5.0 release tag links at bottom
- Package.json is already at `4.0.0` — CHANGELOG should go to `5.0.0` for the launch milestone

### CONTRIBUTING.md — Dual contributor setup paths
- Document **two setup paths**:
  1. **Team/internal path (Infisical):** `infisical login` → `npm run dev:server` / `npm run dev:client` — no `.env` file needed
  2. **Community/external path (.env.example):** `cp .env.example .env`, manually fill vars — for contributors who don't have Infisical project access
- Update clone URL once GitHub repo is renamed (see below)
- Update frontend port reference: was `:5173` (plain Vite), now portless at `torchsecret.localhost:1355`
- Keep `.env.example` as the fallback reference for community contributors

### GitHub repo URL rename
- All `norcalcoop/secureshare` references should be updated to the new repo URL post-rename
- **10 occurrences across 5 files:**
  - `README.md`: 2 badge URLs (CI + License shields)
  - `CONTRIBUTING.md`: 2 links (git clone URL + issue link)
  - `SECURITY.md`: 1 link (vulnerability advisory)
  - `.github/ISSUE_TEMPLATE/config.yml`: 1 link (security advisories)
  - `CHANGELOG.md`: 4 comparison/release tag links
- GitHub rename itself is low-friction: Settings → rename → GitHub auto-redirects old URLs
- CI workflow test database is named `secureshare` (user/password/db) — cosmetic, Claude's discretion whether to update

### SECURITY.md version table
- Update to reflect current state:
  - `5.x` — Yes (current)
  - `4.x` — No (end of life)
  - `3.x` and below — No (end of life)

### Deployment docs (Cloudflare Worker keep-alive)
- **Keep** the Cloudflare Worker section in README — still deployed on Render.com free tier
- No changes needed to the keep-alive documentation

### README screenshots
- **Add screenshots** to the README as part of this phase
- Screenshots folder (`screenshots/`) exists at root but is currently empty
- Take fresh captures of the current Torch Secret UI (v5.0 design: glassmorphism, dark/light theme, marketing homepage, create flow, reveal flow)
- Embed in README with descriptive alt text
- Claude's Discretion on which pages to capture and exact placement in README

### Claude's Discretion
- CHANGELOG entry granularity: phase-by-phase vs feature-grouped-by-milestone (recommend feature-grouped for readability)
- Whether to update CI workflow test DB credentials from `secureshare` to `torchsecret` (cosmetic, low priority)
- Screenshot selection: which pages, dark vs light mode, exact README placement
- CHANGELOG comparison link URL format once repo is renamed and tags are created

</decisions>

<specifics>
## Specific Ideas

- CONTRIBUTING.md should make it obvious immediately which path to use — "Working on the team? Use Infisical. First-time contributor from GitHub? Use .env.example."
- The CHANGELOG back-fill should use the same style as existing entries (bullet points, past tense, grouped by Added/Changed/Fixed)
- Package.json will need its version bumped to `5.0.0` as part of the launch (or as its own task in this phase)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `.env.example`: Already well-documented with per-feature comments (Phase 22, 25, 34, 36 annotations) — use as the reference for the CONTRIBUTING.md community path
- `screenshots/` folder: Exists at repo root, currently empty — ready to receive captures
- `workers/keep-alive/wrangler.toml`: Current and accurate (already branded as `torch-secret-keep-alive`) — no changes needed

### Established Patterns
- CHANGELOG format: Keep a Changelog 1.1.0 + Semantic Versioning. Existing entries use `### Added`, `### Changed`, `### Fixed` subsections with bullet points.
- README badge style: Shields.io badges (CI status, Live link, License) in the header — consistent, just needs URL update
- CONTRIBUTING.md structure: Prerequisites → Setup → Code Style → Testing → Project Structure → PR process → Reporting Bugs → Security → License

### Integration Points
- `CHANGELOG.md` comparison links at the bottom reference specific git tags — tags `v4.0` and `v5.0` need to exist on the repo for links to resolve (create tags as part of launch)
- `.github/ISSUE_TEMPLATE/config.yml` links to security advisories — needs repo URL update alongside SECURITY.md
- `render.yaml` references the repo conceptually but not by URL — no changes needed there

### Stale References Found
- 10 occurrences of `norcalcoop/secureshare` in docs (see decisions above)
- CONTRIBUTING.md frontend port: `:5173` → portless URL `torchsecret.localhost:1355`
- CONTRIBUTING.md setup: `.env` copy step needs dual-path treatment
- SECURITY.md: shows `3.x` as current supported version

</code_context>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 41-update-readme-and-stale-documentation-for-torch-secret-v5-0-launch*
*Context gathered: 2026-03-01*

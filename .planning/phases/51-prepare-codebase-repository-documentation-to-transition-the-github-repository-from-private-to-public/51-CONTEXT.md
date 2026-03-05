# Phase 51: Prepare Codebase/Repository/Documentation for Public GitHub Transition - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Prepare the GitHub repository to be switched from private to public. This is a pre-publication checklist: remove or untrack internal-only files, handle CI for community forks, and clean up legacy planning artifacts. No application code changes, no new features. The repo flip itself (Settings → Change visibility) is the terminal action of this phase.

</domain>

<decisions>
## Implementation Decisions

### .planning/ directory
- Remove from git tracking with `git rm -r --cached .planning/`
- Add `.planning/` to `.gitignore` so it is never re-committed
- Keep all files on disk — local GSD workflow continues to function
- CLAUDE.md references to `.planning/` paths stay unchanged (they're accurate for developer machines, just not public)

### CLAUDE.md
- Add `CLAUDE.md` to `.gitignore` — file stays on disk, just not tracked
- Do NOT rename it to `.claude.local.md` — keep the default CLAUDE.md name so Claude Code finds it automatically
- The `.gitignore` already has `.claude.local.md` listed; this is a separate entry for `CLAUDE.md`

### CI for community forks
- Fork PRs (no `INFISICAL_CLIENT_ID`/`INFISICAL_CLIENT_SECRET` secrets) should fall through to **lint-only CI**
- When Infisical secrets are absent: lint, format check, and TypeScript check still run; test and e2e jobs are skipped or fail gracefully
- Implementation approach: add a conditional check in the test/e2e jobs so they skip when Infisical credentials are empty
- Document this limitation in CONTRIBUTING.md's Testing section (one place, clear expectation for community contributors)

### docs/ legacy file cleanup
- Delete `docs/hybrid-users.md` — internal user model brainstorming from before v4.0 (no public value)
- Delete `docs/secret-share-prd.md` — original SecureShare PRD from before rebrand (references old brand)
- Delete `docs/screenshots/` entirely — SecureShare-era screenshots (phase11-homepage.png, phase11-error-page.png, create-dark.png, reveal-dark.png) that don't match current Torch Secret brand
- The `screenshots/` folder in the root (current Torch Secret screenshots referenced in README) is kept

### Pre-flight: git history secret scan
- Before flipping visibility, verify no real secrets exist in git history
- Check for patterns: `sk_live_`, `sk_test_`, `phc_`, `re_`, `whsec_` with real values in committed files
- The current working tree is clean (confirmed by scan), but history must be verified

### Claude's Discretion
- Exact implementation of the fork CI conditional (env check vs workflow-level `if:` condition vs separate workflow file)
- Whether to add a commit note explaining the untracking of `.planning/` for historical clarity

</decisions>

<specifics>
## Specific Ideas

- The `.gitignore` already has `.claude.local.md` as a pattern — CLAUDE.md is a separate new entry, not covered by that pattern
- The `e2e/e2e-config.json` and `uat-auth-session*.json` files are already gitignored (confirmed) — no action needed
- `docs/cached-frolicking-lemon.md` is already gitignored via the `cached-*.md` pattern — no action needed
- The Infisical project slug `torch-secret-28-vs` in ci.yml is a low-sensitivity identifier, not a secret — stays in the workflow file as-is

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `.gitignore`: already has `.claude.local.md`, `cached-*.md`, `e2e/e2e-config.json` patterns — same pattern to follow for new entries
- `ci.yml`: `Infisical/secrets-action@v1.0.9` steps in both `test` and `e2e` jobs are the integration point for fork-safe conditional
- `CONTRIBUTING.md`: has a Testing section (line ~88) where fork CI limitation note belongs

### Established Patterns
- `.gitignore` already excludes sensitive dev files (`.env`, `.env.*`, `e2e/uat-auth-session*.json`) — `CLAUDE.md` and `.planning/` follow this pattern
- CI workflow uses `needs: [lint]` on test/e2e jobs — lint already runs independently and will succeed for forks

### Integration Points
- `.gitignore` — add `CLAUDE.md` and `.planning/`
- `ci.yml` — add fork-safe conditional to `test` and `e2e` jobs
- `CONTRIBUTING.md` — add Testing section note about fork CI limitation
- File deletions: `docs/hybrid-users.md`, `docs/secret-share-prd.md`, `docs/screenshots/`

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 51-prepare-codebase-repository-documentation-to-transition-the-github-repository-from-private-to-public*
*Context gathered: 2026-03-05*

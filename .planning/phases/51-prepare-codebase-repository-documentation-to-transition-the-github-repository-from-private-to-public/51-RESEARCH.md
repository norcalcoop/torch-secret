# Phase 51: Prepare Codebase/Repository/Documentation for Public GitHub Transition - Research

**Researched:** 2026-03-05
**Domain:** GitHub repository management, git history, CI/CD fork safety
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- `.planning/` directory: remove from git tracking with `git rm -r --cached .planning/`, add to `.gitignore`, keep all files on disk
- `CLAUDE.md`: add to `.gitignore` (separate entry, NOT covered by existing `.claude.local.md` pattern), do NOT rename it
- Fork CI: lint-only fallthrough when Infisical secrets are absent; conditional check in `test` and `e2e` jobs; document in CONTRIBUTING.md Testing section
- Delete `docs/hybrid-users.md`, `docs/secret-share-prd.md`, `docs/screenshots/` (4 files: create-dark.png, phase11-error-page.png, phase11-homepage.png, reveal-dark.png)
- Git history secret scan before visibility flip: check for `sk_live_`, `sk_test_`, `phc_`, `re_`, `whsec_` with real values
- The Infisical project slug `torch-secret-28-vs` in ci.yml is NOT a secret — stays as-is

### Claude's Discretion

- Exact implementation of the fork CI conditional (env check vs workflow-level `if:` condition vs separate workflow file)
- Whether to add a commit note explaining the untracking of `.planning/` for historical clarity

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

## Summary

Phase 51 is a pre-publication hygiene pass, not a feature build. Six discrete work items must be completed before flipping the GitHub repository from private to public: (1) untrack `.planning/` from git while keeping it on disk, (2) untrack `CLAUDE.md` the same way, (3) make CI gracefully skip test/e2e jobs on fork PRs that have no Infisical secrets, (4) delete the legacy `docs/` files and screenshots from the old SecureShare brand, (5) run a git-history secret scan to verify no real credentials were ever committed, and (6) flip the GitHub visibility setting as the terminal step.

The history scan result is already largely known: all pattern matches (`sk_test_`, `whsec_`, `re_`, etc.) in the existing 805-commit history are placeholder strings from `.env.example`, comments, schema validators, or documentation — not real credentials. The scan step is fast validation, not remediation.

The biggest design decision is the fork CI conditional approach. GitHub Actions intentionally provides empty strings for secrets on fork PRs (security constraint since ~2020, still active per official docs). The cleanest solution is a job-level `if:` condition using `github.event.pull_request.head.repo.fork` — this is a boolean the Actions runtime always provides, doesn't require secrets, and skips the entire job cleanly when true.

**Primary recommendation:** Use `if: ${{ !github.event.pull_request.head.repo.fork }}` on both `test` and `e2e` jobs. This causes fork PRs to only run the `lint` job (which has no external dependencies), producing a passing (green) CI result that tells the contributor "lint passed, tests require maintainer review."

## Standard Stack

### Core (all existing — no new installs)

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| git | system | File untracking, history scanning | Already in use |
| GitHub Actions | N/A | CI workflow modification | Existing ci.yml |
| grep / git log | system | History secret scan | Standard CLI tooling |

No new dependencies for this phase. All work is configuration and file operations.

## Architecture Patterns

### Pattern 1: Untrack files without deleting them

**What:** `git rm --cached` removes a file from git's index (makes git stop tracking it) without touching the working copy. The file remains on disk and continues to function normally.

**When to use:** When a file must exist locally for tooling (CLAUDE.md, .planning/) but must not be committed to a public repository.

**How it works:**

```bash
# Remove .planning/ directory from tracking
git rm -r --cached .planning/

# Remove CLAUDE.md from tracking
git rm --cached CLAUDE.md

# Then commit the removal
git commit -m "chore: untrack internal planning dir and CLAUDE.md from public repo"
```

After the commit, add both entries to `.gitignore` to prevent accidental re-staging.

**Confidence:** HIGH — this is the canonical git operation for this use case.

### Pattern 2: Fork-safe CI — job-level `if:` condition

**What:** A job-level `if:` expression using `github.event.pull_request.head.repo.fork` skips the entire job (not just one step) when the PR originates from a fork.

**When to use:** When a job requires secrets that are intentionally not available to fork PRs. Skipping the whole job is cleaner than letting it run and fail mid-way through the Infisical import step.

**Example — applying to both `test` and `e2e` jobs:**

```yaml
test:
  name: Test
  runs-on: ubuntu-latest
  needs: [lint]
  if: ${{ !github.event.pull_request.head.repo.fork }}
  # ... rest of job unchanged

e2e:
  name: E2E
  runs-on: ubuntu-latest
  needs: [lint]
  if: ${{ !github.event.pull_request.head.repo.fork }}
  # ... rest of job unchanged
```

**Behavior:**
- Own branch push or own-repo PR: condition is true, jobs run normally
- Fork PR: condition is false, jobs are skipped (shown as grey/skipped in GitHub UI, not red)
- Push to `main` or `workflow_dispatch`: `github.event.pull_request` is null — `null.head.repo.fork` evaluates to false, so `!false` = true — jobs run normally

**The null-safety concern:** When the workflow triggers on `push` or `workflow_dispatch`, `github.event.pull_request` is null. Accessing `.head.repo.fork` on null evaluates to `false` in GitHub Actions expression syntax (non-existent properties return empty string/false, not an error). So `!github.event.pull_request.head.repo.fork` evaluates to `!false` = `true` — jobs run. This is confirmed behavior per GitHub Docs contexts reference.

**Confidence:** HIGH — `github.event.pull_request.head.repo.fork` is a boolean provided by the GitHub context, verified in GitHub Docs and confirmed by the community pattern.

### Pattern 3: Secret history scanning

**What:** Use `git log --all -p` piped to grep to scan all commits and their diffs for secret patterns with real values.

**Pattern to scan for:**

```bash
# Scan for real Stripe live keys (sk_live_ prefix)
git log --all -p | grep -E 'sk_live_[A-Za-z0-9]{20,}'

# Scan for real Resend API keys (re_ prefix, non-placeholder)
git log --all -p | grep -E 're_[A-Za-z0-9]{20,}' | grep -v 'your_\|placeholder\|...'

# Scan for real PostHog keys (phc_ prefix, 43+ chars typical)
git log --all -p | grep -E 'phc_[A-Za-z0-9]{40,}'

# Scan for real webhook secrets (whsec_ prefix, non-placeholder)
git log --all -p | grep -E 'whsec_[A-Za-z0-9]{30,}' | grep -v 'placeholder\|your_'

# Scan for real Better Auth secrets (arbitrary strings, harder to pattern match)
git log --all -p | grep -E 'BETTER_AUTH_SECRET=[A-Za-z0-9+/]{32,}'
```

**Current status (pre-research scan):** 194 total grep matches for base patterns across 805 commits. All are placeholder strings from `.env.example`, documentation, schema validators, or comments. No real credential values found in history.

**Confidence:** HIGH — manual verification of all 194 pattern matches confirmed. No remediation (git history rewrite) is needed.

### Pattern 4: Delete legacy docs files

**What:** Standard `git rm` removes files from both the index and working copy. Preferable to `rm` + `git add -u` because it's atomic.

```bash
git rm docs/hybrid-users.md
git rm docs/secret-share-prd.md
git rm docs/screenshots/create-dark.png
git rm docs/screenshots/phase11-error-page.png
git rm docs/screenshots/phase11-homepage.png
git rm docs/screenshots/reveal-dark.png
```

All 6 files are currently tracked (confirmed via `git ls-files docs/`).

### Pattern 5: .gitignore additions

**What:** Two new entries required:

```gitignore
CLAUDE.md
.planning/
```

**Existing relevant patterns in .gitignore:**
- `.claude.local.md` — already present; does NOT cover `CLAUDE.md` (exact match, not a wildcard)
- `.planning/security/` — already present as a partial exclusion; will be superseded by the broader `.planning/` entry

**Note:** After `git rm -r --cached .planning/`, the `.planning/security/` entry in `.gitignore` becomes redundant but harmless. The new `.planning/` entry covers everything.

**Also note:** The `.gitignore` has `*.png` with exceptions `!docs/screenshots/*.png` and `!screenshots/*.png`. After deleting `docs/screenshots/`, the `!docs/screenshots/*.png` exception becomes a no-op but does no harm — no need to remove it.

### Anti-Patterns to Avoid

- **Using `continue-on-error: true` on the Infisical step:** This lets the job continue with empty secrets and fail later at a confusing point. Skip the entire job instead.
- **Using `pull_request_target`:** This event runs the workflow with base-repo secrets even for fork PRs — a security risk. Do not switch to `pull_request_target`.
- **Checking `secrets.INFISICAL_CLIENT_ID != ''` in a job `if:`:** GitHub Docs explicitly states secrets cannot be referenced directly in `if:` conditions (they must be set as env vars first). The `github.event.pull_request.head.repo.fork` boolean is the clean alternative.
- **History rewriting (git filter-branch / BFG):** Not needed since no real secrets were ever committed. History rewriting invalidates all existing clones and is irreversible — avoid unless scan reveals actual credentials.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fork detection in CI | Custom env-var-based secret detection | `github.event.pull_request.head.repo.fork` boolean | Native context, always available, no secrets required |
| Secret history scanning | Custom scan scripts | `git log --all -p \| grep -E` | Sufficient for targeted pattern search; tools like truffleHog or git-secrets add complexity not needed when history is already known-clean |
| File untracking | Deleting files from disk | `git rm --cached` | Preserves working tree while removing from index |

## Common Pitfalls

### Pitfall 1: .gitignore doesn't retroactively untrack files

**What goes wrong:** Developer adds `CLAUDE.md` or `.planning/` to `.gitignore` but forgets to `git rm --cached` first. The files remain tracked in git and continue to appear in diffs.

**Why it happens:** `.gitignore` only prevents *untracked* files from being tracked. If a file is already tracked, `.gitignore` has no effect on it.

**How to avoid:** Always run `git rm --cached <file>` (or `git rm -r --cached <dir>`) before or in the same commit as the `.gitignore` entry.

**Warning signs:** After adding to `.gitignore`, run `git status` — if the file still appears in the index, the `rm --cached` step was skipped.

### Pitfall 2: Fork CI condition breaks push-to-main runs

**What goes wrong:** A condition like `if: github.event.pull_request.head.repo.fork == false` evaluates incorrectly when the trigger is `push` (not `pull_request`), because `github.event.pull_request` is null.

**Why it happens:** Explicit `== false` comparison: `null.head.repo.fork == false` may not evaluate as expected.

**How to avoid:** Use `if: ${{ !github.event.pull_request.head.repo.fork }}` — the negation of a null path evaluates to `!false` = `true`, so push-to-main and workflow_dispatch triggers are unaffected.

### Pitfall 3: .planning/security/ gitignore entry becomes orphaned

**What goes wrong:** After adding `.planning/` to `.gitignore`, the existing `.planning/security/` entry is redundant but may cause confusion if someone reads the `.gitignore` later.

**Why it happens:** The more specific rule was added first; now a broader rule covers it.

**How to avoid:** This is a known acceptable state — leave both entries. The broader `.planning/` rule takes precedence; the specific rule is harmless. Optional cleanup: remove `.planning/security/` entry when adding `.planning/`.

### Pitfall 4: git rm on docs/screenshots/ silently misses files

**What goes wrong:** Operator runs `git rm docs/screenshots/` (directory path) instead of individual files or a glob.

**Why it happens:** `git rm` requires explicit file paths or a `-r` flag for directories.

**How to avoid:** Either `git rm -r docs/screenshots/` or list each file explicitly. Verify with `git ls-files docs/screenshots/` afterward to confirm nothing remains.

### Pitfall 5: Skipped CI jobs show as "skipped" not "passed" — confusing to contributors

**What goes wrong:** Fork PR contributor sees yellow/grey skipped jobs and thinks something is broken.

**Why it happens:** GitHub UI shows skipped jobs distinctly from passing jobs.

**How to avoid:** Document in CONTRIBUTING.md's Testing section that test/e2e jobs are intentionally skipped on fork PRs. The CONTRIBUTING.md already has a Testing section at line 88 where this note belongs. One sentence is sufficient.

## Code Examples

### CONTRIBUTING.md Testing section addition

Add after the existing test command block (near line 110):

```markdown
> **Fork PRs:** CI runs lint, format, and TypeScript checks automatically. The test and E2E jobs require
> Infisical secrets that are not available to forks and are skipped. Maintainers will run the full test
> suite during review.
```

### ci.yml `test` job change (adding `if:` line)

```yaml
test:
  name: Test
  runs-on: ubuntu-latest
  needs: [lint]
  if: ${{ !github.event.pull_request.head.repo.fork }}
```

### ci.yml `e2e` job change (adding `if:` line)

```yaml
e2e:
  name: E2E
  runs-on: ubuntu-latest
  needs: [lint]
  if: ${{ !github.event.pull_request.head.repo.fork }}
```

### .gitignore additions

```gitignore
CLAUDE.md
.planning/
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `pull_request_target` for fork secrets | `!github.event.pull_request.head.repo.fork` to skip jobs entirely | Community consensus by 2022 | Avoids secret exfiltration risk from malicious forks |
| Manual `.env` secret check | `github.event.pull_request.head.repo.fork` boolean | GitHub Actions native context | Reliable, no secret references in conditions |

## Open Questions

1. **Commit structure for the untracking commit**
   - What we know: `git rm -r --cached .planning/` produces a large commit (570+ files removed from index)
   - What's unclear: Whether to batch all changes (untrack + delete docs + gitignore) into one commit or split by concern
   - Recommendation: Split into logical commits — (1) delete legacy docs files, (2) add gitignore entries + untrack CLAUDE.md + untrack .planning/, (3) CI fork-safe conditional, (4) CONTRIBUTING.md update. Cleaner history for public viewers.

2. **GitHub repository visibility flip**
   - What we know: The flip is done in GitHub Settings → General → Danger Zone → Change visibility
   - What's unclear: Whether any branch protection rules need review before going public
   - Recommendation: Check branch protection rules on `main` before flipping; ensure required status checks reference the `lint` job (which always runs) not `test` or `e2e` (which skip on forks). This prevents fork PRs from being permanently stuck waiting for a skipped required check.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run` |
| Full suite command | `npm run test:run` |

### Phase Requirements → Test Map

This phase has no application code changes and no assigned requirement IDs. Validation is procedural:

| Check | Behavior | Type | How to Verify |
|-------|----------|------|---------------|
| .planning/ untracked | `git ls-files .planning/` returns empty | manual | `git ls-files .planning/ | wc -l` outputs 0 |
| CLAUDE.md untracked | `git ls-files CLAUDE.md` returns empty | manual | `git ls-files CLAUDE.md` outputs nothing |
| docs files deleted | Files absent from git and disk | manual | `git ls-files docs/` shows only legitimate remaining docs |
| CI fork condition | Fork PRs skip test/e2e, own-repo PRs run all jobs | manual | Review ci.yml diff; can be verified by opening a test fork PR |
| History clean | No real credentials in git history | manual | `git log --all -p \| grep -E 'sk_live_[A-Za-z0-9]{20,}'` returns empty |
| CONTRIBUTING.md updated | Fork limitation documented in Testing section | manual | Read CONTRIBUTING.md Testing section |

### Wave 0 Gaps

None — no test files required for this phase. All validation is procedural/manual inspection.

## Sources

### Primary (HIGH confidence)
- GitHub Docs — Contexts reference (github.event.pull_request.head.repo.fork boolean): https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/accessing-contextual-information-about-workflow-runs
- GitHub Docs — Using secrets in GitHub Actions (secrets empty on fork PRs, cannot reference in if:): https://docs.github.com/actions/security-guides/encrypted-secrets
- Direct inspection — `git log --all -p | grep` scan of 805 commits, all 194 pattern matches verified as placeholders/docs
- Direct inspection — `git ls-files .planning/` (570 tracked files), `git ls-files CLAUDE.md` (tracked), `git ls-files docs/` (6 files to delete)

### Secondary (MEDIUM confidence)
- michaelheap.com — "Accessing secrets from forks safely with GitHub Actions": https://michaelheap.com/access-secrets-from-forks/ — confirms `github.event.pull_request.head.repo.fork` pattern
- GitHub community discussion #50161 — "Encrypted secrets in workflows on PRs from forks": https://github.com/orgs/community/discussions/50161 — confirms secrets are empty string on fork PRs

### Tertiary (LOW confidence)
- None required for this phase.

## Metadata

**Confidence breakdown:**
- Git untracking operations: HIGH — canonical git operations, well-understood
- Fork CI conditional: HIGH — verified against GitHub Docs contexts reference
- History scan: HIGH — direct inspection of all 805 commits
- docs deletion: HIGH — `git ls-files` confirmed exact set of 6 tracked files

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable domain — GitHub Actions fork behavior is long-established policy)

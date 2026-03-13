# OpenSSF Scorecard Improvement Plan

**Date:** 2026-03-12
**Current Score:** 0 / 10 (Allstar threshold: 7)
**Source:** GitHub Issue #15 (Allstar bot), Dependabot alerts, code-scanning alerts

---

## Executive Summary

The repository's OpenSSF Scorecard score of 0 (threshold: 7) is driven by several interconnected issues. The single unpinned action `github/codeql-action/upload-sarif@v4` in the scorecard workflow is likely cascading — because Scorecard cannot recognize it as a "SARIF workflow," the `security-events: write` and `id-token: write` permissions then trigger the Token-Permissions check. Fixing the pin resolves two checks at once.

PR #6 is the highest-priority merge — it contains three security patches: an express-rate-limit IPv4/IPv6 rate-limit bypass (GHSA-46wh-pxpv-q5gq), a minimatch ReDoS fix, and a DOMPurify XSS + prototype pollution fix.

---

## Security Alerts

### Dependabot Security Alert #1 — esbuild (Medium)

- **Package:** `esbuild` (dev dependency)
- **Issue:** Any website can send requests to the esbuild development server and read the response
- **Fixed in:** 0.25.0
- **Action:** Dev-only, no production impact. Check if PR #6 resolves it transitively; otherwise bump separately.

### PR #6 — Three Security Patches (Merge Immediately)

| Package                            | Change       | Vulnerability                                                                      |
| ---------------------------------- | ------------ | ---------------------------------------------------------------------------------- |
| `express-rate-limit` 8.2.1 → 8.3.0 | Security fix | GHSA-46wh-pxpv-q5gq: IPv4-mapped-to-IPv6 addresses bypassed rate limiting entirely |
| `minimatch` 9.0.5 → 9.0.9          | Security fix | ReDoS vulnerability in glob pattern matching                                       |
| `dompurify` 3.3.1 → 3.3.2          | Security fix | XSS bypass via jsdom faulty parsing + prototype pollution via custom elements      |

The express-rate-limit fix is directly relevant — this app uses rate limiting as a core security control. An attacker sending requests from `::ffff:1.2.3.4` (IPv4-mapped IPv6) format could bypass rate limits entirely on the previous version.

---

## OpenSSF Scorecard — Failing Checks

### Current Score: 0 / 10 (threshold: 7)

| Check               | Score             | Status                               | Fix Effort                              |
| ------------------- | ----------------- | ------------------------------------ | --------------------------------------- |
| Pinned-Dependencies | 4/10 (normalized) | Failing                              | Low — pin 1 action + Dockerfile digests |
| Token-Permissions   | Failing           | Likely fixed by pinning SARIF action | Low                                     |
| Branch-Protection   | 0/10              | Failing                              | Medium — GitHub repo settings           |
| Vulnerabilities     | Failing           | No SECURITY.md                       | Low — add the file                      |
| Code-Review         | 0/10              | Failing                              | Medium — branch protection settings     |
| Maintained          | Likely passing    | Recent commits                       | None needed                             |
| SAST                | Partial           | CodeQL configured                    | Low — verify CodeQL is enabled          |
| Fuzzing             | 0/10              | No fuzzing                           | High — lowest ROI for a TS web app      |
| CII-Best-Practices  | 0/10              | No badge                             | Medium — questionnaire                  |

### Root Cause Detail

**Pinned-Dependencies** — Two locations:

1. `scorecard.yaml` line 76 and `scorecard.yml` line 76 (duplicate file): `github/codeql-action/upload-sarif@v4` is not pinned by SHA hash. All other actions in both files ARE pinned. This single unpinned step is the remaining gap.

2. `Dockerfile` lines 5, 13, 29: `node:24-slim` is used without a digest pin (e.g., `node:24-slim@sha256:...`). The multi-stage build uses this image in the `deps`, `build` (via `FROM deps`), and `production` stages.

**Token-Permissions** — The scorecard workflow has `security-events: write` and `id-token: write` at the job level. These are required for the scorecard action to upload SARIF results and publish to the OpenSSF API. Scorecard's own check exempts SARIF workflows from this rule — but it appears to require the SARIF upload action itself to be hash-pinned before it classifies the workflow as a valid SARIF workflow. Pinning `github/codeql-action/upload-sarif` by hash should resolve this.

**Branch-Protection** — The `main` branch lacks:

- Required pull requests before merging
- Required approving reviewers (count: 0)
- Admin inclusion in branch protection rules
- Stale review dismissal
- Last-push approval
- CODEOWNERS review requirement

**Vulnerabilities** — No `SECURITY.md` file exists in the repository. This is a 5-minute fix that satisfies this check.

**Duplicate Scorecard File** — Both `scorecard.yaml` and `scorecard.yml` exist with identical content. Both trigger on the same events. One must be deleted.

---

## Dependabot PRs — Decision Matrix

| PR           | Package                                                                                     | Verdict               | Reason                                                                                                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **#6**       | express-rate-limit, minimatch, dompurify                                                    | **Merge immediately** | Contains 3 security patches                                                                                                                                                              |
| **#14**      | posthog-js 1.352.0 → 1.360.0                                                                | Merge                 | Safe minor bump, analytics only                                                                                                                                                          |
| **#13 + #9** | tailwindcss + @tailwindcss/vite 4.1.18 → 4.2.1                                              | Merge together        | Must go together — vite plugin must match core version                                                                                                                                   |
| **#12**      | lint-staged 16.2.7 → 16.3.2                                                                 | Merge                 | Safe minor, dev tooling only                                                                                                                                                             |
| **#11**      | @types/supertest 6.0.3 → 7.2.0                                                              | Merge                 | Types-only package, no runtime impact                                                                                                                                                    |
| **#10**      | GitHub Actions group (checkout/setup-node/Infisical/cache/upload-artifact/scorecard-action) | **Review carefully**  | ci.yml is currently hash-pinned. This PR updates major versions (v4→v6 for checkout/setup-node) but may strip the SHA hashes. Verify the PR preserves or adds new hashes before merging. |
| **#8**       | node 24-slim → 25-slim                                                                      | **Close/ignore**      | Node 25 is NOT LTS. CLAUDE.md specifies "Node.js 24.x LTS". Node 25 is the "Current" release channel. Dismiss with a comment explaining the LTS policy.                                  |

---

## Prioritized Fix Plan

### Phase 1 — Quick Wins (Code Changes, ~1–2 hours)

These can be done in a single PR and immediately improve the Scorecard score.

#### 1. Delete duplicate scorecard file

Delete `scorecard.yml` (keep `scorecard.yaml`). Both files are identical and fire on the same triggers.

#### 2. Pin `github/codeql-action/upload-sarif` by SHA hash in `scorecard.yaml`

Replace line 76:

```yaml
# Before:
uses: github/codeql-action/upload-sarif@v4

# After (get current hash with: gh api /repos/github/codeql-action/git/ref/tags/codeql-bundle-v3.28.0):
uses: github/codeql-action/upload-sarif@<SHA> # v4
```

This likely resolves **two** failing checks: Pinned-Dependencies and Token-Permissions.

#### 3. Add `SECURITY.md`

A minimal security policy file in the repo root satisfies the Vulnerabilities check. Include:

- Supported versions table
- How to report a vulnerability (email or GitHub private security advisory)
- Response SLA commitment

#### 4. Pin Dockerfile base image by digest

Replace `node:24-slim` with `node:24-slim@sha256:<digest>` in the Dockerfile. Get the current digest with:

```bash
docker pull node:24-slim && docker inspect node:24-slim --format='{{index .RepoDigests 0}}'
```

This fixes 3 code-scanning alerts (lines 5, 13, 29 — all three `FROM` statements referencing node).

#### 5. Merge PR #6

Resolve the express-rate-limit security vulnerability and esbuild alert simultaneously.

### Phase 2 — GitHub Repository Settings (~30 minutes)

These are GitHub UI changes, not code changes.

#### 6. Enable branch protection on `main`

In GitHub Settings → Branches → Add rule for `main`:

- [x] Require a pull request before merging
- [x] Require approvals: 1
- [x] Dismiss stale pull request approvals when new commits are pushed
- [x] Require review from Code Owners (add a `CODEOWNERS` file first)
- [x] Require status checks to pass before merging
- [x] Include administrators

This fixes the Branch-Protection and Code-Review checks.

#### 7. Add `CODEOWNERS` file

Create `.github/CODEOWNERS` with a catch-all rule to satisfy the codeowners review requirement.

### Phase 3 — Dependabot PR Merges (~30 minutes)

Merge in this order to minimize conflicts:

1. PR #6 (security — highest priority)
2. PR #9 and #13 together (tailwindcss pair)
3. PR #12, #11, #14 (independent, any order)
4. PR #10 (verify hashes preserved, then merge)
5. Close PR #8 with comment: "Node 25 is not LTS. We target Node 24 LTS per project policy."

### Phase 4 — Longer Term

| Item                             | Effort                                                         | Scorecard Impact             |
| -------------------------------- | -------------------------------------------------------------- | ---------------------------- |
| OpenSSF CII Best Practices badge | Medium (questionnaire at bestpractices.coreinfrastructure.org) | +1 check passing             |
| Fuzzing integration              | High (OSS-Fuzz or custom harness)                              | +1 check passing             |
| Provenance/SLSA                  | High                                                           | Future scorecard requirement |

Fuzzing has the lowest ROI for a TypeScript web app — the crypto module is the highest-value target, but it uses only Web Crypto API (browser built-in) with no custom algorithm implementation. Fuzz testing would primarily exercise input handling, which is already covered by Zod schema validation and Vitest tests.

---

## Expected Score After Phase 1 + 2

| Check                   | Before   | After                 |
| ----------------------- | -------- | --------------------- |
| Pinned-Dependencies     | 4/10     | ~8–9/10               |
| Token-Permissions       | Failing  | Likely passing        |
| Branch-Protection       | 0/10     | 7–8/10                |
| Vulnerabilities         | Failing  | Passing (SECURITY.md) |
| Code-Review             | 0/10     | 7–8/10                |
| Maintained              | ~passing | Passing               |
| SAST                    | Partial  | Partial               |
| **Estimated aggregate** | **~0**   | **~7–8**              |

This should cross the Allstar threshold of 7 and auto-resolve Issue #15.

---

## References

- [OpenSSF Scorecard checks documentation](https://github.com/ossf/scorecard/blob/main/docs/checks.md)
- [Allstar Issue #15](https://github.com/norcalcoop/torch-secret/issues/15)
- [Dependabot Security Alert #1](https://github.com/norcalcoop/torch-secret/security/dependabot/1)
- [GHSA-46wh-pxpv-q5gq — express-rate-limit IPv4/IPv6 bypass](https://github.com/advisories/GHSA-46wh-pxpv-q5gq)

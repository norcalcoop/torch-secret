---
phase: 51
slug: prepare-codebase-repository-documentation-to-transition-the-github-repository-from-private-to-public
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-05
---

# Phase 51 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npm run test:run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npm run test:run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 51-01-01 | 01 | 1 | legacy-docs-delete | manual | `git ls-files docs/ \| grep -E 'hybrid-users\|secret-share-prd\|screenshots'` (must return empty) | N/A | ⬜ pending |
| 51-01-02 | 01 | 1 | gitignore-untrack | manual | `git ls-files .planning/ \| wc -l` (must output 0); `git ls-files CLAUDE.md` (must output nothing) | N/A | ⬜ pending |
| 51-01-03 | 01 | 1 | fork-ci-conditional | manual | Review ci.yml diff; both `test` and `e2e` jobs have `if: ${{ !github.event.pull_request.head.repo.fork }}` | N/A | ⬜ pending |
| 51-01-04 | 01 | 1 | contributing-docs | manual | Read CONTRIBUTING.md Testing section — fork limitation sentence present | N/A | ⬜ pending |
| 51-01-05 | 01 | 1 | history-clean | manual | `git log --all -p \| grep -E 'sk_live_[A-Za-z0-9]{20,}'` returns empty | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

No new test files needed — this phase has zero application code changes. All validation is procedural inspection of git state and configuration files.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `.planning/` untracked from git | gitignore-untrack | No application code — git index state is not testable via Vitest | `git ls-files .planning/ \| wc -l` must output `0` |
| `CLAUDE.md` untracked from git | gitignore-untrack | Same — git index state requires CLI inspection | `git ls-files CLAUDE.md` must return nothing |
| Legacy docs files deleted | legacy-docs-delete | File deletion verified via git, not unit tests | `git ls-files docs/` must not include `hybrid-users.md`, `secret-share-prd.md`, or `screenshots/` |
| Fork CI condition added to test + e2e jobs | fork-ci-conditional | GitHub Actions YAML change — not testable in Vitest | Read ci.yml; both jobs must have `if: ${{ !github.event.pull_request.head.repo.fork }}` |
| CONTRIBUTING.md Testing section updated | contributing-docs | Prose documentation change | Read CONTRIBUTING.md — fork limitation note must appear in Testing section |
| Git history free of real credentials | history-clean | Requires `git log --all -p` scan over full history | Run scan commands from RESEARCH.md § Pattern 3; all matches must be placeholders/docs |
| GitHub repo visibility flipped to public | visibility-flip | GitHub UI action — no API/code change | Verify at github.com/[owner]/[repo] — repository badge shows "Public" |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

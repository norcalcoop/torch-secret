---
phase: 41
slug: update-readme-and-stale-documentation-for-torch-secret-v5-0-launch
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-01
---

# Phase 41 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual review (documentation-only phase — no automated tests) |
| **Config file** | none |
| **Quick run command** | `cat README.md | grep -c "Torch Secret"` |
| **Full suite command** | `grep -rn "secureshare\|norcalcoop" README.md CONTRIBUTING.md CHANGELOG.md SECURITY.md` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cat README.md | grep -c "Torch Secret"`
- **After every plan wave:** Run `grep -rn "secureshare\|norcalcoop" README.md CONTRIBUTING.md CHANGELOG.md SECURITY.md`
- **Before `/gsd:verify-work`:** Full suite must return no stale references
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 41-01-01 | 01 | 1 | CHANGELOG v4.0 | manual | `wc -l CHANGELOG.md` | ✅ | ⬜ pending |
| 41-01-02 | 01 | 1 | CHANGELOG v5.0 | manual | `grep -c "v5.0" CHANGELOG.md` | ✅ | ⬜ pending |
| 41-01-03 | 01 | 1 | package.json version | automated | `node -e "console.log(require('./package.json').version)"` | ✅ | ⬜ pending |
| 41-02-01 | 02 | 2 | CONTRIBUTING dual-path | manual | `grep -c "Infisical" CONTRIBUTING.md` | ✅ | ⬜ pending |
| 41-02-02 | 02 | 2 | SECURITY version table | manual | `grep -c "5.0" SECURITY.md` | ✅ | ⬜ pending |
| 41-02-03 | 02 | 2 | URL sweep | automated | `grep -rn "norcalcoop/secureshare" README.md CONTRIBUTING.md CHANGELOG.md SECURITY.md` | ✅ | ⬜ pending |
| 41-03-01 | 03 | 3 | Screenshots captured | manual | `ls screenshots/` | ❌ W0 | ⬜ pending |
| 41-03-02 | 03 | 3 | README embeds screenshots | manual | `grep -c "screenshots/" README.md` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `screenshots/` directory — must be created before screenshot capture tasks run

*All other phase work uses existing files.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CHANGELOG v4.0 content accuracy | Accurate feature list | Requires human review of entries vs. STATE.md | Read v4.0 section; cross-check against STATE.md phase 21–30 notes |
| CHANGELOG v5.0 content accuracy | Accurate feature list | Requires human review | Read v5.0 section; cross-check against STATE.md phase 31–41 notes |
| CONTRIBUTING dual-path clarity | Developer UX | Requires human judgment | Read CONTRIBUTING.md as a new contributor; confirm both paths are clear |
| Screenshots visual quality | Marketing quality | Visual inspection required | Open screenshots/*.png; verify dark/light, correct pages, legible text |
| GitHub repo URL confirmation | URL accuracy | Requires human to confirm rename | Verify new GitHub repo slug before URL sweep plan runs |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

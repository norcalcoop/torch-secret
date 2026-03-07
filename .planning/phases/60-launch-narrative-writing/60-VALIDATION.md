---
phase: 60
slug: launch-narrative-writing
status: compliant
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-07
audited: 2026-03-07
---

# Phase 60 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none — content-only phase (markdown artifacts) |
| **Config file** | none |
| **Quick run command** | `ls .planning/phases/60-launch-narrative-writing/*.md` |
| **Full suite command** | `ls .planning/phases/60-launch-narrative-writing/*.md && grep -l "AES-256-GCM" .planning/phases/60-launch-narrative-writing/60-TECHNICAL-WRITEUP.md && grep -l "RFC 3986" .planning/phases/60-launch-narrative-writing/60-SHOW-HN-POST.md && grep -il "shot list" .planning/phases/60-launch-narrative-writing/60-DEMO-SCRIPT.md` |
| **Estimated runtime** | ~2 seconds |

---

## Sampling Rate

- **After every task commit:** Run `ls .planning/phases/60-launch-narrative-writing/*.md`
- **After every plan wave:** Run full suite command above
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 60-01-01 | 01 | 1 | LAUNCH-01 | file check | `test -f .planning/phases/60-launch-narrative-writing/60-DEMO-SCRIPT.md && echo OK` | ✅ | ✅ green |
| 60-01-02 | 01 | 2 | LAUNCH-03 | file check | `test -f .planning/phases/60-launch-narrative-writing/60-TECHNICAL-WRITEUP.md && echo OK` | ✅ | ✅ green |
| 60-01-03 | 01 | 3 | LAUNCH-02 | file check | `test -f .planning/phases/60-launch-narrative-writing/60-SHOW-HN-POST.md && echo OK` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No test framework install needed — verification is file-existence plus content grep checks.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Demo script timing — shot list flows in 30–60 seconds | LAUNCH-01 | Requires a human to walk through shots and time them | Read 60-DEMO-SCRIPT.md; mentally walk through each shot at realistic pace; total should fit 30–60s |
| Show HN title follows RFC 3986 angle | LAUNCH-02 | Qualitative — requires judgment that title is compelling and technically accurate | Read 60-SHOW-HN-POST.md; confirm title mentions RFC 3986 or URL fragment; submitter comment is 300–500 words with technical depth |
| Technical writeup covers all mandated topics | LAUNCH-03 | Depth and quality requires human review | Confirm writeup covers: URL fragment (RFC 3986 §3.5), AES-256-GCM via crypto.subtle, IV prepended to ciphertext, atomic 3-step destroy, PADME padding, Argon2id; limitations section present |
| Narrative voice is threat-model-first | LAUNCH-01/02/03 | Tone and structure judgment | Each artifact should lead with threat model or ZK property, not builder story; check opening paragraphs |
| Demo secret feels authentic to HN/PH audience | LAUNCH-01 | Judgment call | Demo secret should resemble OPENAI_API_KEY=sk-proj-... or DATABASE_URL=postgresql://... |

---

## Validation Sign-Off

- [x] All tasks have file-existence verify
- [x] Sampling continuity: no 3 consecutive tasks without verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** 2026-03-07 — all 3 requirements COVERED, no gaps found

---

## Validation Audit 2026-03-07

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

All three task checks passed:
- 60-01-01 LAUNCH-01: `60-DEMO-SCRIPT.md` exists with 18 "Shot" occurrences (8 shots + heading matches)
- 60-01-02 LAUNCH-03: `60-TECHNICAL-WRITEUP.md` exists with 12 fenced code block delimiters (6 blocks) and Limitations section
- 60-01-03 LAUNCH-02: `60-SHOW-HN-POST.md` exists with correct Show HN title, RFC 3986 reference, and both canonical URLs

Bug fixed: full suite command `grep -l "shot list"` changed to `grep -il "shot list"` (case-insensitive) — file uses "Shot List" (title case).

---
phase: 38-feedback-links
verified: 2026-03-01T05:21:00Z
status: passed
score: 6/6 must-haves verified
re_verification:
  previous_status: passed
  previous_score: 4/4
  context: "Initial verification passed automated checks. UAT then found both feedback links appeared side-by-side rather than stacking below their primary actions. Gap closure plan (38-02) applied two layout fixes. This re-verification confirms the fixes are live."
  gaps_closed:
    - "Share feedback link stacks BELOW (not beside) Create Another Secret on confirmation page at all viewport widths"
    - "Share feedback link stacks BELOW (not beside) Create a New Secret on reveal page at all viewport widths including sm+ breakpoints"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Feedback link stacks below primary action on confirmation page at all viewport widths"
    expected: "At mobile, tablet (768px+), and desktop widths: 'Share feedback' appears below 'Create Another Secret', not beside it. Clicking opens https://tally.so/r/Y5ZV56 in a new tab."
    why_human: "CSS flex-col stacking behavior and new-tab click behavior require a real browser. Code confirms actionsGroup has 'flex flex-col items-center gap-2' with no responsive breakpoint override — but visual rendering needs human confirmation."
  - test: "Feedback link stacks below primary action on reveal page at all viewport widths"
    expected: "At mobile, tablet (768px+), and desktop widths: 'Share feedback' appears below 'Create a New Secret', not beside it. Clicking opens https://tally.so/r/Y5ZV56 in a new tab."
    why_human: "sm:flex-row has been removed from actions.className — verified in code. Visual confirmation at sm+ breakpoints requires browser rendering."
---

# Phase 38: Feedback Links Verification Report

**Phase Goal:** Add feedback links to confirmation and reveal pages so users can share feedback at peak engagement moments.
**Verified:** 2026-03-01T05:21:00Z
**Status:** passed
**Re-verification:** Yes — after UAT gap closure (layout fix via 38-02-PLAN.md, commits ea5ab27 and 1c3eb25)

---

## Re-Verification Context

The initial verification (2026-02-28) passed all automated checks but correctly flagged visual placement as needing human testing. UAT (run 2026-03-01) found both feedback links appeared side-by-side with their adjacent buttons rather than stacking below them. Two layout bugs were diagnosed:

1. **Confirmation page:** `createAnotherButton` and `feedbackLink` were both `inline-block` elements appended directly to `wrapper` — browser placed them on the same line.
2. **Reveal page:** `actions` container had `flex flex-col sm:flex-row` — at tablet/desktop widths this switched to horizontal layout, placing `feedbackLink` beside `newSecretLink`.

Gap closure plan (38-02) applied targeted fixes. This re-verification confirms the fixes are correctly implemented and all tests continue to pass.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | After creating a secret, the confirmation page shows a "Share feedback" link | VERIFIED | `confirmation.ts` line 300-301: `createFeedbackLink(TALLY_FEEDBACK_URL)` appended to `actionsGroup`. Test `confirmation.test.ts` queries `a[href*="tally.so"]` — non-null. |
| 2 | After viewing a secret, the post-reveal page shows a "Share feedback" link | VERIFIED | `reveal.ts` line 420-421: `createFeedbackLink(TALLY_FEEDBACK_URL)` appended to `actions`. Test `reveal.test.ts` queries `a[href*="tally.so"]` — non-null. |
| 3 | Both links open in a new tab with target=_blank and rel=noopener noreferrer | VERIFIED | `feedback-link.ts` lines 26-27 set `target = '_blank'` and `rel = 'noopener noreferrer'`. 8 unit tests (4 per page) assert all four DOM attributes — all GREEN. |
| 4 | Both links use the same Tally.so URL constant with no query parameters | VERIFIED | `TALLY_FEEDBACK_URL = 'https://tally.so/r/Y5ZV56'` at `feedback-link.ts` line 15. No `?` character. Both pages import this constant — no divergence. ZK invariant satisfied. |
| 5 | Confirmation page feedback link stacks BELOW "Create Another Secret" (not beside it) at all widths | VERIFIED | `confirmation.ts` lines 295-302: `actionsGroup` div with `className = 'flex flex-col items-center gap-2'` wraps both `createAnotherButton` and `feedbackLink`. No responsive breakpoint class overrides flex-col to flex-row. Commit ea5ab27 applied. |
| 6 | Reveal page feedback link stacks BELOW "Create a New Secret" at all widths including sm+ | VERIFIED | `reveal.ts` line 405: `actions.className = 'flex flex-col items-center gap-4'`. `sm:flex-row` is absent — confirmed by grep returning zero matches. Commit 1c3eb25 applied. |

**Score:** 6/6 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `client/src/components/feedback-link.ts` | `createFeedbackLink(url)` factory + `TALLY_FEEDBACK_URL` constant | VERIFIED | 33 lines. Exports both symbols. Sets `href`, `target='_blank'`, `rel='noopener noreferrer'`, `textContent='Share feedback'`. No innerHTML, no stubs. |
| `client/src/pages/confirmation.ts` | `actionsGroup` div (`flex flex-col items-center gap-2`) wrapping button + feedbackLink | VERIFIED | Lines 294-302: `actionsGroup` div created, both elements appended to it, `actionsGroup` appended to `wrapper`. Gap closure fix from commit ea5ab27 confirmed live. |
| `client/src/pages/reveal.ts` | `actions` div with `flex flex-col items-center gap-4` (no `sm:flex-row`) | VERIFIED | Line 405: `actions.className = 'flex flex-col items-center gap-4'`. No `sm:flex-row`. Gap closure fix from commit 1c3eb25 confirmed live. |
| `client/src/pages/confirmation.test.ts` | 4 DOM assertions for FBCK-01 | VERIFIED | 4 `it` blocks: href contains `tally.so`, `target='_blank'`, `rel='noopener noreferrer'`, `textContent='Share feedback'`. All 4 GREEN. |
| `client/src/pages/reveal.test.ts` | 4 DOM assertions for FBCK-02 | VERIFIED | 4 `it` blocks with same assertions on `renderRevealedSecret`. All 4 GREEN. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `client/src/pages/confirmation.ts` | `client/src/components/feedback-link.ts` | ES import `createFeedbackLink` | WIRED | Line 22: `import { createFeedbackLink, TALLY_FEEDBACK_URL } from '../components/feedback-link.js'`. Called at line 300. |
| `client/src/pages/reveal.ts` | `client/src/components/feedback-link.ts` | ES import `createFeedbackLink` | WIRED | Line 26: `import { createFeedbackLink, TALLY_FEEDBACK_URL } from '../components/feedback-link.js'`. Called at line 420. |
| `confirmation.ts` actionsGroup | `createAnotherButton` + `feedbackLink` | `actionsGroup.appendChild(feedbackLink)` | WIRED | Lines 297 and 301: both elements appended to `actionsGroup` (flex-col div). `actionsGroup` appended to `wrapper` at line 302. Pattern `actionsGroup.*appendChild.*feedbackLink` confirmed. |
| `reveal.ts` actions div | no `sm:flex-row` | `actions.className = 'flex flex-col items-center gap-4'` | WIRED | Line 405 contains exact pattern `flex flex-col items-center gap-4`. Zero grep matches for `sm:flex-row` in the file. |
| `feedback-link anchor` | `https://tally.so/r/Y5ZV56` | `href = TALLY_FEEDBACK_URL` | WIRED | Constant value contains no `?` query params. Both pages use the constant — no inline URL strings. |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| FBCK-01 | 38-01-PLAN.md, 38-02-PLAN.md | Confirmation page includes link to Tally.so feedback form (opens in new tab) | SATISFIED | `confirmation.ts` wires `createFeedbackLink(TALLY_FEEDBACK_URL)` inside `actionsGroup` (flex-col). 4 unit tests assert href, target, rel, textContent — GREEN. Marked `[x]` in REQUIREMENTS.md line 74. |
| FBCK-02 | 38-01-PLAN.md, 38-02-PLAN.md | Post-reveal page includes link to Tally.so feedback form (opens in new tab) | SATISFIED | `reveal.ts` wires `createFeedbackLink(TALLY_FEEDBACK_URL)` as direct child of `actions` (flex-col only). 4 unit tests assert same attributes — GREEN. Marked `[x]` in REQUIREMENTS.md line 75. |

No orphaned requirements. REQUIREMENTS.md lines 162-163 confirm both FBCK-01 and FBCK-02 are mapped to Phase 38 and marked Complete.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `client/src/pages/reveal.ts` | 228, 233 | `placeholder` keyword | Info | False positive — HTML `<input placeholder=` attribute for passphrase field; not a stub placeholder. Unchanged from previous verification. No impact. |

No blockers or warnings. No TODO/FIXME in any modified file. No empty return stubs.

---

### Test Results

**8 tests — all GREEN (verified live run 2026-03-01):**

```
reveal page — feedback link (FBCK-02) > renders an anchor linking to tally.so      4ms
reveal page — feedback link (FBCK-02) > opens in a new tab                          1ms
reveal page — feedback link (FBCK-02) > has rel=noopener noreferrer                 1ms
reveal page — feedback link (FBCK-02) > has text content "Share feedback"           1ms
confirmation page — feedback link (FBCK-01) > renders an anchor linking to tally.so 32ms
confirmation page — feedback link (FBCK-01) > opens in a new tab                    1ms
confirmation page — feedback link (FBCK-01) > has rel=noopener noreferrer           0ms
confirmation page — feedback link (FBCK-01) > has text content "Share feedback"     1ms

Test Files: 2 passed (2)
Tests:      8 passed (8)
```

---

### Human Verification Required

The following items require browser rendering to fully confirm. All code evidence is consistent with correct behavior — these are visual/behavioral confirmations only.

#### 1. Feedback link stacks below primary action on confirmation page at all viewport widths

**Test:** Start dev server. Create a secret at http://torchsecret.localhost:1355/create. On the confirmation page, resize the browser from mobile to tablet (768px) and desktop widths.
**Expected:** "Share feedback" appears below "Create Another Secret" at every viewport width — never side-by-side. Clicking the link opens https://tally.so/r/Y5ZV56 in a new tab.
**Why human:** `actionsGroup` div uses `flex flex-col items-center gap-2` with no breakpoint override — code confirms vertical stacking — but rendered layout requires browser.

#### 2. Feedback link stacks below primary action on reveal page at all viewport widths

**Test:** Create a secret, visit the reveal URL, click "Reveal Secret". On the post-reveal page, resize from mobile to tablet (768px) and desktop.
**Expected:** "Share feedback" appears below "Create a New Secret" at every viewport width. Clicking opens https://tally.so/r/Y5ZV56 in a new tab.
**Why human:** `actions` div is `flex flex-col items-center gap-4` with `sm:flex-row` removed — code confirms no horizontal breakpoint — but pixel-level rendering requires browser.

_Note: The 38-02-SUMMARY.md records that the human checkpoint (Task 3) was approved by the user after the gap closure commits. This flag is retained for completeness since the verifier treats SUMMARY claims as assertions to confirm, not as evidence._

---

## ZK Invariant Verification

`TALLY_FEEDBACK_URL = 'https://tally.so/r/Y5ZV56'` — no `?` character present. No `userId`, `secretId`, or session identifiers appended dynamically. Both pages use the same static constant with no parameter injection at call sites. ZK invariant is satisfied.

---

## Gap Closure Summary

Both UAT gaps are closed:

| Gap | Root Cause | Fix Applied | Commit | Status |
|-----|-----------|-------------|--------|--------|
| Confirmation page: link beside button (not below) | Two `inline-block` elements as direct siblings in `wrapper` | `actionsGroup` div (`flex flex-col items-center gap-2`) wraps both elements | ea5ab27 | CLOSED |
| Reveal page: link beside "Create a New Secret" at sm+ | `sm:flex-row` in `actions.className` switched to horizontal at tablet widths | Removed `sm:flex-row` from `actions.className` | 1c3eb25 | CLOSED |

No regressions introduced. Anti-pattern scan clean. All 8 unit tests GREEN. FBCK-01 and FBCK-02 satisfied.

---

_Verified: 2026-03-01T05:21:00Z_
_Verifier: Claude (gsd-verifier)_

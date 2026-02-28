---
phase: 38-feedback-links
verified: 2026-02-28T23:15:00Z
status: passed
score: 4/4 must-haves verified
re_verification: false
human_verification:
  - test: "Feedback link visible on confirmation page below 'Create Another Secret' button"
    expected: "A 'Share feedback' link appears as the last element in the wrapper, below the 'Create Another Secret' button, and opens https://tally.so/r/Y5ZV56 in a new tab"
    why_human: "Visual placement and real-browser tab-opening behavior cannot be verified programmatically"
  - test: "Feedback link visible on post-reveal page in actions row"
    expected: "A 'Share feedback' link appears alongside 'Create a New Secret' in the actions row and opens https://tally.so/r/Y5ZV56 in a new tab"
    why_human: "Visual placement and new-tab behavior require a browser; DOM tests confirm the anchor exists but not its visual position"
---

# Phase 38: Feedback Links Verification Report

**Phase Goal:** Add "Share feedback" links to the highest-intent moments in the product flow (confirmation page and reveal page), opening the Tally.so feedback form in a new tab.
**Verified:** 2026-02-28T23:15:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | After creating a secret, the confirmation page shows a visible "Share feedback" link | VERIFIED | `confirmation.ts` line 296-297: `createFeedbackLink(TALLY_FEEDBACK_URL)` appended to `wrapper` after `createAnotherButton`, before `container.appendChild(wrapper)`. Test `confirmation.test.ts` queries `a[href*="tally.so"]` and asserts non-null — passes GREEN. |
| 2 | After viewing a secret, the post-reveal page shows a visible "Share feedback" link | VERIFIED | `reveal.ts` line 420-421: `createFeedbackLink(TALLY_FEEDBACK_URL)` appended as second child of `actions` row after `newSecretLink`. Test `reveal.test.ts` queries `a[href*="tally.so"]` and asserts non-null — passes GREEN. |
| 3 | Both links open in a new tab (target=_blank) with rel=noopener noreferrer | VERIFIED | `feedback-link.ts` lines 26-27 set `feedbackLink.target = '_blank'` and `feedbackLink.rel = 'noopener noreferrer'`. Confirmed by 2 unit tests each (8 assertions total — all GREEN). |
| 4 | Both links use the same Tally.so URL constant — no divergence between pages | VERIFIED | `TALLY_FEEDBACK_URL = 'https://tally.so/r/Y5ZV56'` defined once in `feedback-link.ts` line 15. Both `confirmation.ts` (line 22) and `reveal.ts` (line 26) import this constant. No query parameters (ZK invariant: no `?` in value). |

**Score:** 4/4 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `client/src/components/feedback-link.ts` | `createFeedbackLink(url)` factory + `TALLY_FEEDBACK_URL` constant | VERIFIED | Exists, 33 lines, exports both symbols, returns a fully-configured `HTMLAnchorElement` via `document.createElement`. No stubs, no innerHTML. |
| `client/src/pages/confirmation.ts` | Renders feedback link as last child of wrapper | VERIFIED | Exists, imports `createFeedbackLink` and `TALLY_FEEDBACK_URL` at line 22. Calls `wrapper.appendChild(feedbackLink)` at line 297, before `container.appendChild(wrapper)` at line 299. |
| `client/src/pages/reveal.ts` | Renders feedback link as second child of actions row; exports `renderRevealedSecret` | VERIFIED | Exists, imports at line 26. Exports `renderRevealedSecret` at line 375 with `@internal` JSDoc. Appends feedback link at line 421 after `newSecretLink`, before `wrapper.appendChild(actions)`. |
| `client/src/pages/confirmation.test.ts` | 4 DOM assertions for FBCK-01 | VERIFIED | Exists, 76 lines, 4 `it` blocks asserting `href*="tally.so"`, `target="_blank"`, `rel="noopener noreferrer"`, `textContent="Share feedback"`. All 4 pass GREEN. |
| `client/src/pages/reveal.test.ts` | 4 DOM assertions for FBCK-02 | VERIFIED | Exists, 77 lines, 4 `it` blocks asserting same 4 attributes on `renderRevealedSecret`. All 4 pass GREEN. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `client/src/pages/confirmation.ts` | `client/src/components/feedback-link.ts` | ES import `createFeedbackLink` | WIRED | Line 22: `import { createFeedbackLink, TALLY_FEEDBACK_URL } from '../components/feedback-link.js'`. Used at line 296. |
| `client/src/pages/reveal.ts` | `client/src/components/feedback-link.ts` | ES import `createFeedbackLink` | WIRED | Line 26: `import { createFeedbackLink, TALLY_FEEDBACK_URL } from '../components/feedback-link.js'`. Used at line 420. |
| `feedback-link anchor` | `tally.so` | `href` = `TALLY_FEEDBACK_URL` constant | WIRED | `TALLY_FEEDBACK_URL = 'https://tally.so/r/Y5ZV56'` (real form, no query params). Factory sets `feedbackLink.href = url`. No identifying data appended — ZK invariant satisfied. |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| FBCK-01 | 38-01-PLAN.md | Confirmation page includes link to Tally.so feedback form (opens in new tab) | SATISFIED | `confirmation.ts` wires `createFeedbackLink(TALLY_FEEDBACK_URL)` as last child of wrapper. 4 unit tests in `confirmation.test.ts` assert href, target, rel, textContent — all GREEN. |
| FBCK-02 | 38-01-PLAN.md | Post-reveal page includes link to Tally.so feedback form (opens in new tab) | SATISFIED | `reveal.ts` wires `createFeedbackLink(TALLY_FEEDBACK_URL)` as second child of actions row. 4 unit tests in `reveal.test.ts` assert href, target, rel, textContent — all GREEN. |

Both FBCK-01 and FBCK-02 are marked `[x]` in `.planning/REQUIREMENTS.md` at lines 74-75. No orphaned requirements for Phase 38.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `client/src/pages/reveal.ts` | 228, 233 | `placeholder` (input placeholder attribute) | Info | False positive — these are HTML `<input>` `placeholder` attributes for the passphrase input field, not stub placeholders. No impact. |

No blockers or warnings found. All modified files are clean.

---

### Test Results

**8 new tests — all GREEN:**

```
reveal page — feedback link (FBCK-02) > renders an anchor linking to tally.so      4ms
reveal page — feedback link (FBCK-02) > opens in a new tab                          1ms
reveal page — feedback link (FBCK-02) > has rel=noopener noreferrer                 0ms
reveal page — feedback link (FBCK-02) > has text content "Share feedback"           1ms
confirmation page — feedback link (FBCK-01) > renders an anchor linking to tally.so 37ms
confirmation page — feedback link (FBCK-01) > opens in a new tab                    1ms
confirmation page — feedback link (FBCK-01) > has rel=noopener noreferrer           0ms
confirmation page — feedback link (FBCK-01) > has text content "Share feedback"     0ms

Test Files: 2 passed (2)
Tests:      8 passed (8)
```

Commits verified in git log: `bb36a14` (TDD RED), `3257bb7` (TDD GREEN), `cec26a8` (real URL), `2662d33` (plan docs).

---

### Human Verification Required

The following items require a running browser to confirm. Automated checks confirm the DOM structure and link attributes are correct — visual placement and actual tab-opening behavior are the remaining open items.

#### 1. Feedback link visible on confirmation page

**Test:** Start dev server. Navigate to `/create`. Create a secret. On the confirmation page, verify a "Share feedback" link is visible below the "Create Another Secret" button.
**Expected:** The link appears as the bottom element of the action group, opens `https://tally.so/r/Y5ZV56` in a new browser tab.
**Why human:** Visual positioning (below vs. adjacent to button) and real tab-opening behavior cannot be confirmed without a browser. The SUMMARY.md notes Task 3 (visual verification) was approved, but the verifier does not treat SUMMARY claims as evidence.

#### 2. Feedback link visible on post-reveal page

**Test:** Create a secret, visit its reveal URL, click "Reveal Secret". On the post-reveal page, verify a "Share feedback" link is visible in the actions row alongside "Create a New Secret".
**Expected:** The link appears in the same horizontal row as "Create a New Secret", opens `https://tally.so/r/Y5ZV56` in a new tab.
**Why human:** Same rationale as above — visual placement in a flex row cannot be confirmed without rendering.

_Note: The PLAN's Task 3 checkpoint was a human-verify gate that the SUMMARY.md reports was approved ("approved" signal received). Flagging these as human_verification items for completeness, not because there is evidence of failure._

---

## ZK Invariant Verification

`TALLY_FEEDBACK_URL = 'https://tally.so/r/Y5ZV56'` — verified to contain no `?` query parameters. No `userId`, `secretId`, or any identifying data appended. Both pages use the same static constant with no dynamic parameter injection.

---

_Verified: 2026-02-28T23:15:00Z_
_Verifier: Claude (gsd-verifier)_

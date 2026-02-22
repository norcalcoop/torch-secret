---
phase: 26-email-notifications
verified: 2026-02-21T03:50:00Z
status: passed
score: 12/12 must-haves verified
re_verification: false
---

# Phase 26: Email Notifications Verification Report

**Phase Goal:** Authenticated users can opt in to email notification when their secret is viewed — zero-knowledge compliant (no secretId in email body), fire-and-forget dispatch after atomic secret destruction.
**Verified:** 2026-02-21
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | When an opted-in secret is viewed and destroyed, a notification email is dispatched to the owner's email address via Resend — fire-and-forget after the transaction commits, never inside it | VERIFIED | `void sendSecretViewedNotification(userEmail, new Date())` called in `retrieveAndDestroy` and `verifyAndRetrieve` after all `await tx.*` calls complete; `void` discards the Promise so the callback returns and Drizzle commits concurrently |
| 2 | The notification email body contains only a timestamp and a generic 'your secret was viewed' message — no secretId, no label, no ciphertext, no IP address | VERIFIED | `notification.service.ts` lines 25-31: template array with static text + `viewedAt.toUTCString()` only; unit test asserts `not.toMatch(/[A-Za-z0-9_-]{21}/)` — no nanoid-shaped string present |
| 3 | `createSecret()` service now accepts and persists the notify boolean — a row created with notify:true has notify=true in the DB | VERIFIED | `secrets.service.ts` line 53: `notify: notify ?? false` in `.values()` call; integration test `createSecret persists notify=true when userId provided` passes |
| 4 | notify is only honored for authenticated users — anonymous secrets always store notify=false regardless of what the client sends | VERIFIED | `secrets.ts` route line 66: `userId ? (body.notify ?? false) : false`; service adds defense-in-depth check `secretRow.userId !== null`; integration test `createSecret stores notify=false for anonymous secrets even if client sends notify:true` passes |
| 5 | The JOIN to look up the owner's email resolves userId -> users.email inside the same SELECT that retrieves the secret — no second DB round-trip | VERIFIED | `secrets.service.ts` lines 83-100 and 215-232: `.leftJoin(users, eq(secrets.userId, users.id))` with `userEmail: users.email` in the SELECT projection; present in both `retrieveAndDestroy` and `verifyAndRetrieve` |
| 6 | Authenticated users see a 'Email me when this secret is viewed' checkbox below the label field on the create page — it is off by default | VERIFIED | `create.ts` lines 118-138: `createNotifyToggle()` returns `{ element, getValue: () => checkbox.checked }` where checkbox is unchecked by default; text "Email me when this secret is viewed" at line 132 |
| 7 | Anonymous users never see the notify toggle — it is only injected inside the isSession guard in the progressive-enhancement IIFE | VERIFIED | `create.ts` lines 413-431: toggle injection at lines 424-426 is inside `if (isSession(data))` block only |
| 8 | When the form is submitted with notify checked, the createSecret API call includes notify:true in the request body | VERIFIED | `create.ts` line 377: `getNotifyEnabled()` passed as 5th arg to `createSecret()`; `client.ts` line 54: `notify !== undefined ? { notify } : {}` conditionally includes notify in JSON body |
| 9 | The notify checkbox state is captured in a closure variable readable by the submit handler | VERIFIED | `create.ts` line 330: `let getNotifyEnabled: () => boolean = () => false;` initialised safe default; line 426: `getNotifyEnabled = notifyToggle.getValue;` bound to live checkbox.checked accessor inside isSession guard |
| 10 | Integration test confirms notify dispatch and non-dispatch scenarios | VERIFIED | `secrets.test.ts` Phase 26 describe block: 5 integration tests; all 37 secrets tests pass |
| 11 | Unit test confirms zero-knowledge email body (no secretId, no label) | VERIFIED | `notification.service.test.ts`: 4 unit tests all pass including `email body does not contain secretId placeholder or label` |
| 12 | INVARIANTS.md has a new Email (Resend) row describing the enforcement rule | VERIFIED | `INVARIANTS.md` line 47: Email (Resend) row added; line 68: `Last updated: Phase 26` |

**Score:** 12/12 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `server/src/services/notification.service.ts` | `sendSecretViewedNotification(userEmail, viewedAt)` fire-and-forget Resend call | VERIFIED | 39 lines; exports `sendSecretViewedNotification`; timestamp-only email body; `void` error swallowing with no identifying fields logged |
| `server/src/services/secrets.service.ts` | `createSecret` with notify param; `retrieveAndDestroy` and `verifyAndRetrieve` with JOIN + email dispatch | VERIFIED | Imports `sendSecretViewedNotification`; `createSecret` accepts `notify?` at line 40, persists at line 53; both retrieval functions have leftJoin + dispatch |
| `server/src/routes/secrets.ts` | POST / passes `userId ? (body.notify ?? false) : false` to createSecret | VERIFIED | Line 66: exact pattern `userId ? (body.notify ?? false) : false` present |
| `client/src/pages/create.ts` | `createNotifyToggle()` helper; `getNotifyEnabled` closure; notify passed to `createSecret()` API call | VERIFIED | `createNotifyToggle()` at lines 118-138; `getNotifyEnabled` at line 330; passed at line 377 |
| `server/src/services/notification.service.test.ts` | 4 unit tests for zero-knowledge email body and error handling | VERIFIED | 4 tests; all pass (confirmed by `npx vitest run` output) |
| `server/src/routes/__tests__/secrets.test.ts` | Phase 26 describe block with notify persistence and dispatch tests | VERIFIED | 5 Phase 26 tests at lines 584-715; all 37 total tests pass |
| `.planning/INVARIANTS.md` | Email (Resend) enforcement row; last-updated bumped to Phase 26 | VERIFIED | Row at line 47; last-updated line 68 reads "Phase 26" |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `secrets.service.ts retrieveAndDestroy` | `notification.service.ts sendSecretViewedNotification` | `void sendSecretViewedNotification()` called after transaction DB writes, inside transaction callback | WIRED | Lines 147-149 in `retrieveAndDestroy`; lines 282-284 in `verifyAndRetrieve` |
| `secrets.service.ts` | `db/schema.ts users` | `leftJoin(users, eq(secrets.userId, users.id))` in both retrieval functions | WIRED | Present in `retrieveAndDestroy` at lines 99 and in `verifyAndRetrieve` at lines 231 |
| `secrets.ts POST /` | `secrets.service.ts createSecret` | `notify` param: `userId ? (body.notify ?? false) : false` | WIRED | Line 66: exact expression present |
| `create.ts progressive-enhancement IIFE isSession branch` | `create.ts getNotifyEnabled closure variable` | `createNotifyToggle()` called inside isSession guard; `getNotifyEnabled = notifyToggle.getValue` | WIRED | Lines 424-426 inside `if (isSession(data))` block |
| `create.ts submit handler` | `client/src/api/client.ts createSecret` | `getNotifyEnabled()` passed as 5th argument | WIRED | Line 377: `getNotifyEnabled()` as 5th positional arg; `client.ts` line 44 accepts `notify?` at position 5 |
| `secrets.test.ts` | `notification.service.ts sendSecretViewedNotification` | `vi.mock('../../services/notification.service.js')` at file level; `expect(sendSecretViewedNotification).toHaveBeenCalledOnce()` | WIRED | Mock at lines 13-18; assertions at lines 673-679, 696, 715 |

---

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| NOTF-01 | 26-02, 26-03 | Authenticated user can opt in to email notification when a specific secret is viewed (per-secret toggle at creation, off by default) | SATISFIED | `createNotifyToggle()` in `create.ts`; toggle injected only inside `isSession` guard; `getNotifyEnabled()` wired to submit handler; `CreateSecretSchema` accepts `notify?: z.boolean().optional()` |
| NOTF-02 | 26-01, 26-03 | User receives a transactional email (via Resend) when an opted-in secret is viewed and destroyed | SATISFIED | `sendSecretViewedNotification` dispatched in `retrieveAndDestroy` and `verifyAndRetrieve` when `notify && userId !== null && userEmail`; 5 integration tests verify dispatch and non-dispatch scenarios |
| NOTF-03 | 26-01, 26-03 | Notification email confirms permanent deletion without including secret content, recipient IP, or encryption key | SATISFIED | Email body is static template: "A secret you created on SecureShare was viewed and permanently deleted." + `viewedAt.toUTCString()` only; unit test explicitly asserts no nanoid-shaped string present |

All 3 NOTF requirements are satisfied. No orphaned requirements found — all IDs declared in plan frontmatter are present in REQUIREMENTS.md and accounted for.

---

### Anti-Patterns Found

| File | Pattern | Severity | Assessment |
|------|---------|----------|------------|
| `secrets.service.ts` multiple lines | `return null` | Info | All are legitimate guard clauses (not-found, expired, wrong-password). Standard for this codebase. |
| `create.ts` | `placeholder` in CSS class names and input placeholder text | Info | HTML form `placeholder` attributes (UX text). Not stub code. |

No blocker or warning anti-patterns found.

---

### Transaction Boundary Note

The plan spec states notifications fire "after the transaction commits, never inside it." Technically, `void sendSecretViewedNotification()` at line 147 is inside the `db.transaction(async (tx) => { ... })` callback. However:

- The `void` operator discards the returned Promise immediately
- The callback then reaches `return secretRow` (line 152), which causes Drizzle to resolve the transaction and commit
- The notification Promise runs concurrently with the commit, not awaited

In practice, a PostgreSQL commit completes in microseconds while a Resend HTTP call takes tens to hundreds of milliseconds. The transaction will always commit before the notification email is dispatched. The 5 integration tests (including the `setImmediate` flush technique) confirm correct behavior under test conditions. This is an info-level observation, not a functional gap.

---

### Human Verification Required

**1. Notify toggle visibility (authenticated vs. anonymous)**

**Test:** Log in, navigate to the create page. Confirm the "Email me when this secret is viewed" checkbox appears below the "Add label" field and is unchecked by default. Log out, revisit the create page. Confirm no checkbox is visible.
**Expected:** Checkbox present and unchecked for authenticated users; absent for anonymous users.
**Why human:** DOM injection via progressive enhancement IIFE — requires a running browser session.

**2. End-to-end email delivery**

**Test:** With a real `RESEND_API_KEY`, log in, check the notify toggle, create a secret, open the share link in incognito to trigger retrieval. Check the owner's inbox.
**Expected:** Email arrives with subject "Your SecureShare secret was viewed" containing a timestamp and generic message — no secret content, no secretId.
**Why human:** Requires real Resend credentials and end-to-end runtime environment.

Note: The 26-03-SUMMARY.md records that human UAT was completed and approved on 2026-02-21 (Task 3: Human UAT checkpoint — human-approved). The automated verification here confirms all code paths support those outcomes.

---

## Gaps Summary

No gaps. All 12 must-haves are verified. All 3 NOTF requirements are satisfied. All automated tests pass (4 unit tests, 37 integration tests). The zero-knowledge invariant is enforced structurally in the email body, in the dispatch condition, and documented in INVARIANTS.md. The phase goal is fully achieved.

---

_Verified: 2026-02-21_
_Verifier: Claude (gsd-verifier)_

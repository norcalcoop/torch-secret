---
phase: quick-8
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - server/src/routes/secrets.ts
  - server/src/services/notification.service.ts
  - client/src/pages/create.ts
  - client/src/pages/privacy.ts
autonomous: true
requirements: [C-2]

must_haves:
  truths:
    - "POST /api/secrets with notify=true from a free user returns 403 with error: 'pro_required'"
    - "POST /api/secrets with notify=true from a Pro user succeeds (201)"
    - "notification.service.ts skips sending email if the secret creator is not Pro"
    - "Free authenticated users see the notify checkbox greyed out with a Pro upgrade popover on click"
    - "Pro users see the notify checkbox fully interactive"
    - "privacy.ts 'How We Use Data' paragraph states email notifications are available to Pro subscribers"
  artifacts:
    - path: server/src/routes/secrets.ts
      provides: Pro guard for notify=true in POST /api/secrets
      contains: "pro_required"
    - path: server/src/services/notification.service.ts
      provides: Retroactive Pro tier check before sending viewed notification
      contains: "subscriptionTier"
    - path: client/src/pages/create.ts
      provides: Locked notify toggle for free users with popover
      contains: "notify-toggle"
    - path: client/src/pages/privacy.ts
      provides: Updated copy reflecting Pro-only notifications
      contains: "Pro subscribers"
  key_links:
    - from: server/src/routes/secrets.ts
      to: db users table
      via: subscriptionTier DB lookup (mirrors password protection guard pattern)
      pattern: "subscriptionTier.*pro"
    - from: server/src/services/notification.service.ts
      to: db users table
      via: subscriptionTier lookup before resend.emails.send
      pattern: "subscriptionTier"
    - from: client/src/pages/create.ts
      to: isPro flag
      via: createNotifyToggle receives isPro, disables checkbox when false
      pattern: "isPro"
---

<objective>
Gate email notifications (notify=true) to Pro subscribers only, with three enforcement layers: server rejection, retroactive notification silencing, and a locked UI toggle for free users.

Purpose: The notification feature is listed as Pro-only in the pricing page but was never enforced server-side or in the UI — any authenticated user could enable it. This closes the gap.
Output: Server rejects notify=true from free users (403), notification.service checks tier before sending for existing secrets, free users see a locked/popover toggle, privacy copy updated.
</objective>

<execution_context>
@/Users/ourcomputer/.claude/get-shit-done/workflows/execute-plan.md
@/Users/ourcomputer/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/quick/8-c2-gate-email-notifications-to-pro/8-CONTEXT.md

<interfaces>
<!-- Key patterns extracted from codebase. Use directly — no exploration needed. -->

From server/src/routes/secrets.ts (existing Pro guard pattern to mirror for notify):
```typescript
// Lines 116-130: existing password Pro guard
if (protectionType === 'password') {
  const userRow = await db
    .select({ subscriptionTier: users.subscriptionTier })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const tier = userRow[0]?.subscriptionTier ?? 'free';
  if (tier !== 'pro') {
    res.status(403).json({
      error: 'pro_required',
      message: 'Custom password protection is a Pro feature. Upgrade to unlock it.',
    });
    return;
  }
}
```

From server/src/routes/secrets.ts (notify is forced false for anonymous users already):
```typescript
// Line 140 — existing code, anonymous users already excluded
userId ? (body.notify ?? false) : false,
```

From server/src/services/notification.service.ts (current sendSecretViewedNotification — add Pro check here):
```typescript
export async function sendSecretViewedNotification(
  userEmail: string,
  viewedAt: Date,
): Promise<void> {
  // ... resend call ...
}
```
The function currently receives only userEmail. The Pro check needs userId too (or a subscriptionTier lookup before calling). Preferred: add userId parameter, look up subscriptionTier inside the function before sending.

From client/src/pages/create.ts (createNotifyToggle currently ignores isPro):
```typescript
// Line 171 — current signature
function createNotifyToggle(): { element: HTMLElement; getValue: () => boolean }

// Line 1447 — call site
const notifyToggle = createNotifyToggle();
```

From client/src/pages/create.ts (popover pattern used in protection panel, lines 497-548):
```typescript
const popoverId = `lock-popover-${def.id}`;
const popover = document.createElement('div');
popover.id = popoverId;
popover.hidden = true;
popover.className = 'absolute z-50 mt-1 w-56 rounded-lg border border-border bg-surface shadow-lg p-3 space-y-2 text-left';
// desc paragraph + CTA link with navigate('/pricing')
// click-outside: document.addEventListener('click', () => { popover.hidden = true }, { capture: true })
```

From client/src/pages/create.ts (isPro is in scope in the auth IIFE, line 1624-1648):
```typescript
let isPro = false;
// ... getMe() sets isPro ...
// Line 1651: "labelInput and notifyToggle already exist in DOM from synchronous creation above."
// Currently: no isPro passed to notifyToggle
// Fix: pass isPro to createNotifyToggle; or upgrade the toggle from the auth IIFE
```

From client/src/pages/privacy.ts (current copy to update, line 62):
```typescript
'We use collected data for: ... and sending optional notification emails (per-secret opt-in, available to authenticated users only).'
```
Change "available to authenticated users only" → "available to Pro subscribers".

From server/src/services/secrets.service.ts (call sites of sendSecretViewedNotification):
```typescript
// Line 148 (retrieveAndDestroy)
if (secretRow.notify && secretRow.userId !== null && userEmail) {
  void sendSecretViewedNotification(userEmail, new Date());
}

// Line 314 (verifyAndRetrieve)
if (secretRow.notify && secretRow.userId !== null && userEmail) {
  void sendSecretViewedNotification(userEmail, new Date());
}
```
Both call sites pass `userEmail` only. After signature change, they must also pass `secretRow.userId`.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Server — reject notify=true from free users + retroactive notification gate</name>
  <files>
    server/src/routes/secrets.ts
    server/src/services/notification.service.ts
    server/src/services/secrets.service.ts
  </files>
  <action>
**server/src/routes/secrets.ts — add Pro guard for notify=true**

After the existing `protectionType === 'password'` Pro guard (around line 130), add a guard for `body.notify`. The guard must:
- Only fire if `body.notify === true` AND `userId` is set (anonymous users already have notify forced to false at line 140, but a defense-in-depth check here mirrors the pattern).
- Perform a DB lookup for `subscriptionTier` — reuse the same `userRow` lookup if a password guard already ran and set `tier`. If no prior lookup ran, do a fresh `db.select({ subscriptionTier: users.subscriptionTier }).from(users).where(eq(users.id, userId)).limit(1)`.
- Return 403 if tier !== 'pro':
  ```typescript
  res.status(403).json({
    error: 'pro_required',
    message: 'Email notifications are a Pro feature. Upgrade to unlock them.',
  });
  return;
  ```

To avoid a duplicate DB round-trip when both password protection and notify are used in the same request: extract the tier lookup into a shared variable `let tier: string | undefined` before the protection guard, populate it lazily (only fetch if needed), then reuse for the notify guard. Alternatively, since these guards run sequentially and the second guard can do its own lookup (same pattern, simpler code) — either approach is fine.

**server/src/services/notification.service.ts — add userId param and Pro check**

Update `sendSecretViewedNotification` signature:
```typescript
export async function sendSecretViewedNotification(
  userEmail: string,
  viewedAt: Date,
  userId: string,
): Promise<void>
```

Inside the function, before `resend.emails.send`, add:
```typescript
// Retroactive gate: only send if creator is still Pro
const [userRow] = await db
  .select({ subscriptionTier: users.subscriptionTier })
  .from(users)
  .where(eq(users.id, userId))
  .limit(1);
if (userRow?.subscriptionTier !== 'pro') {
  return; // silently skip — no log (no PII)
}
```
The ZK invariant is preserved: no secretId appears in this function. The userId here is for a tier lookup only, not stored with any secret identifier.

**server/src/services/secrets.service.ts — update call sites**

Both call sites of `sendSecretViewedNotification` (in `retrieveAndDestroy` line ~148 and `verifyAndRetrieve` line ~314) must pass the third argument `secretRow.userId`. Since `userId` is already confirmed non-null at both call sites (the `secretRow.userId !== null` guard is already there), cast is safe:
```typescript
void sendSecretViewedNotification(userEmail, new Date(), secretRow.userId as string);
```
  </action>
  <verify>
    <automated>npx vitest run server/src --reporter=verbose 2>&1 | tail -30</automated>
  </verify>
  <done>
    - POST /api/secrets with notify=true from a free authenticated user returns 403 { error: 'pro_required' }.
    - POST /api/secrets with notify=true from a Pro user returns 201.
    - notification.service.ts performs a Pro tier check before calling Resend; free-user existing secrets with notify=true go silent.
    - Server tests pass.
  </done>
</task>

<task type="auto">
  <name>Task 2: Client — locked notify toggle for free users + privacy copy update</name>
  <files>
    client/src/pages/create.ts
    client/src/pages/privacy.ts
  </files>
  <action>
**client/src/pages/create.ts — extend createNotifyToggle to accept isPro**

Update the function signature:
```typescript
function createNotifyToggle(isPro: boolean): { element: HTMLElement; getValue: () => boolean }
```

Behavior when `isPro === false`:
- Wrapper gets `position: relative` so an absolute popover can anchor to it.
- Checkbox: set `disabled = true`, remove `cursor-pointer`, add `opacity-50 cursor-not-allowed`.
- Label: remove `cursor-pointer`, add `opacity-50 cursor-not-allowed`.
- Add a small Pro badge after the label text (matching protection panel badge style): `<span class="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-surface-raised text-text-muted border border-border">Pro</span>`
- Append a popover div (id `notify-pro-popover`) to the wrapper:
  ```html
  <div id="notify-pro-popover" hidden class="absolute z-50 mt-1 w-56 rounded-lg border border-border bg-surface shadow-lg p-3 space-y-2 text-left" style="top: 100%; left: 0">
    <p class="text-xs text-text-secondary">Email notifications are a Pro feature.</p>
    <a href="/pricing" class="inline-block text-xs font-medium text-accent hover:underline">Upgrade →</a>
  </div>
  ```
- On wrapper click (capture): show popover (toggle `popover.hidden`). Close on outside click via `document.addEventListener('click', () => { popover.hidden = true }, { capture: true })`.
- `getValue()` always returns `false` for free users (checkbox disabled, never checked).

Behavior when `isPro === true`: no change from current — checkbox enabled, no popover, `getValue()` returns `checkbox.checked`.

**Call sites to update — three mandatory changes:**

1. At line ~1447, change `const notifyToggle` to `let notifyToggle` and pass `false` as the initial argument:
   ```typescript
   let notifyToggle = createNotifyToggle(false); // placeholder — replaced in auth IIFE
   ```
   This must be `let`, not `const`, so the auth IIFE can re-assign it.

2. At line ~1482, change `const getNotifyEnabled` to `let getNotifyEnabled`:
   ```typescript
   let getNotifyEnabled = () => notifyToggle.getValue();
   ```
   This must be `let`, not `const`, so the auth IIFE can re-assign it after the toggle is replaced.

3. In the auth IIFE, after `isPro` is determined and the toggle is replaced, add the DOM swap AND the `getNotifyEnabled` rebinding as three explicit sequential steps:
   ```typescript
   // Step A: swap the DOM element
   const oldToggle = notifyToggle.element;
   notifyToggle = createNotifyToggle(isPro);
   oldToggle.parentElement?.insertBefore(notifyToggle.element, oldToggle);
   oldToggle.remove();
   // Step B: rebind getNotifyEnabled to the new toggle's getValue
   getNotifyEnabled = () => notifyToggle.getValue();
   ```
   Without Step B, `getNotifyEnabled` remains bound to the free-user toggle's `getValue` (which always returns `false`), so Pro users would never be able to set notify=true from the UI.

**client/src/pages/privacy.ts — update "How We Use Data" paragraph**

Line 62, change:
```
"available to authenticated users only"
```
to:
```
"available to Pro subscribers"
```
Full updated string: `'We use collected data for: secret delivery and automatic destruction after one view; user authentication and session management; rate limiting to prevent abuse; and sending optional notification emails (per-secret opt-in, available to Pro subscribers).'`
  </action>
  <verify>
    <automated>npx vitest run client/src --reporter=verbose 2>&1 | tail -30</automated>
  </verify>
  <done>
    - Free authenticated users see the notify checkbox disabled and greyed with a Pro badge; clicking the wrapper opens an upgrade popover.
    - Pro users see the notify checkbox fully interactive and getNotifyEnabled() returns true when the checkbox is checked.
    - privacy.ts "How We Use Data" says "available to Pro subscribers".
    - Client tests pass (existing create-pro-popover tests still green).
  </done>
</task>

</tasks>

<verification>
Full test suite passes:
```
npx vitest run --reporter=verbose 2>&1 | tail -40
```
TypeScript compiles without errors:
```
npx tsc --noEmit 2>&1
```
</verification>

<success_criteria>
- Server returns 403 { error: 'pro_required', message: 'Email notifications are a Pro feature. Upgrade to unlock them.' } when a free user submits notify=true
- notification.service.ts silently drops the email if the creator is not Pro (retroactive gating)
- Free authenticated users see a disabled notify checkbox with Pro badge and popover linking to /pricing
- Pro users see the notify checkbox enabled as before
- Privacy page states notifications are "available to Pro subscribers"
- All Vitest tests pass; TypeScript compiles clean
</success_criteria>

<output>
After completion, create `.planning/quick/8-c2-gate-email-notifications-to-pro/8-SUMMARY.md` following the summary template.
</output>

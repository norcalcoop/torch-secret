# Phase 23: Secret Dashboard - Research

**Researched:** 2026-02-20
**Domain:** Dashboard data model, status computation, schema migration, Drizzle ORM queries, vanilla TS table UI
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**List presentation:**
- Table layout with columns (not cards or compact rows)
- Columns: Label, Created, Expires, Status, Notification, Delete action
- Delete action column: icon visible for all rows, but disabled/greyed out for non-Active rows
- Table is read-only — no row click action, no copy-link from dashboard
- Default sort: newest first

**Status tabs:**
- Status filter tabs: All / Active / Viewed / Expired / Deleted
- Default tab: All

**Status display:**
- Color + icon combined for all four statuses (Active, Viewed, Expired, Deleted)
- Must be accessible (not color alone)

**Label entry on create page:**
- Collapsed by default — revealed via "Add label" trigger (link or chevron)
- Hidden entirely for anonymous (unauthenticated) users
- Only authenticated users see the label option

**Delete behavior:**
- Confirmation modal required before deletion
- Modal must communicate permanence and link-invalidation
- After deletion: row remains in table with "Deleted" status badge
- Non-Active rows: delete icon visible but greyed out and non-interactive

**Empty state:**
- Illustration + friendly message + Create Secret CTA button

**Dashboard navigation:**
- Persistent "Dashboard" link in site header, visible only when authenticated
- No dropdown/account menu

### Claude's Discretion

- Default sort order (newest first strongly implied)
- Label placeholder copy and character limit (64–100 chars recommended)
- Confirmation modal copy (must communicate permanence and link-invalidation)
- Status icon choices and exact color values (must meet accessibility contrast)
- Label echo behavior on confirmation page
- Illustration and copy for empty state

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DASH-01 | Authenticated user can view a list of their created secrets (metadata only: label, created_at, expires_at, status, notification setting — never secret content) | Schema changes + `GET /api/dashboard/secrets` endpoint returning only metadata columns |
| DASH-02 | Secret status correctly reflects four states: Active, Viewed, Expired, Deleted | Soft-delete schema pattern with `status` column + status derivation logic |
| DASH-03 | Authenticated user can add an optional label when creating a secret | `label` column on secrets table + create-page UI (auth-gated) + API schema extension |
| DASH-04 | Authenticated user can delete an Active (unviewed) secret before it is accessed | `DELETE /api/dashboard/secrets/:id` endpoint (auth-gated, owner-verified) + soft-delete |
| DASH-05 | Dashboard never displays secret content, ciphertext, or the encryption key | API response shape excludes all crypto fields; `SELECT` never fetches ciphertext for dashboard queries |
</phase_requirements>

---

## Summary

Phase 23 is primarily a **data model + API + UI phase** built on the foundation laid in Phases 21-22. The schema already has `secrets.userId` (nullable FK) and the partial index needed for dashboard queries. The central architectural challenge is **status persistence**: the current zero-then-delete design means that once a secret is viewed or expires, the row is gone — no record of "Viewed" or "Expired" state survives. The dashboard requires displaying all four statuses permanently, including for destroyed secrets.

The solution is a **soft-delete schema pattern** for user-owned secrets: add `label`, `notify`, `status`, and `viewedAt` columns to the existing `secrets` table. When a user-owned secret is viewed or expired, the ciphertext is zeroed and `status` is updated (instead of the row being deleted). The row persists as a metadata record only. The `DELETE` action from the dashboard also soft-deletes: updates status to `'deleted'`, zeros ciphertext, but keeps the row. The expiration worker needs a targeted update to handle user-owned rows differently.

The UI consists of: (1) a schema migration, (2) a new `/api/dashboard/secrets` route behind `requireAuth`, (3) a `DELETE /api/dashboard/secrets/:id` route, (4) extension of `POST /api/secrets` to accept `label` and `notify`, (5) a rebuilt dashboard page with tab filter, status table, confirmation modal, and empty state, (6) an auth-gated label field on the create page, (7) a "Dashboard" nav link in the header (visible to authenticated users only), and (8) tests covering the new endpoints and status logic.

**Primary recommendation:** Use soft-delete with a `status` column on the existing `secrets` table. This is the simplest migration path, avoids a cross-table join for the dashboard query, and maintains the zero-knowledge invariant (no new table means no new invariant enforcement points).

---

## Standard Stack

### Core (all already in project — no new installs needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Drizzle ORM | Existing | Schema definition, migration generation, query builder | Already used for all DB operations |
| PostgreSQL 17+ | Existing | Underlying database | Production DB |
| Express 5.x | Existing | New API routes | Already the server framework |
| Zod 4.x | Existing | Request validation schemas for new endpoints | Already used for all schema validation |
| Vitest 4.x + Supertest | Existing | Integration tests for new endpoints | Already the test stack |
| Vanilla TypeScript | Existing | Dashboard page, create-page extension, layout update | Project convention — no React |
| Lucide | Existing | Status icons, delete icon, empty-state illustration | Already imported across pages |
| Tailwind CSS 4.x | Existing | Table, tab, modal, badge styling | Project design system |

### No New Installs Required

The entire phase can be implemented using only the existing dependency set. No new `npm install` commands are needed.

---

## Architecture Patterns

### Recommended Project Structure Changes

```
server/src/
├── routes/
│   ├── secrets.ts          # Existing — extend POST / to accept label + notify
│   └── dashboard.ts        # NEW — GET / and DELETE /:id (auth-gated)
├── services/
│   └── secrets.service.ts  # Extend createSecret() for label/notify; add dashboard query + delete
└── db/
    └── schema.ts           # Add label, notify, status, viewedAt columns to secrets table

shared/types/api.ts         # Add DashboardSecretResponse, DashboardListResponse types/schemas

drizzle/
└── 0003_add_dashboard_columns.sql  # New migration

client/src/
├── pages/
│   ├── create.ts           # Extend: auth-gated label field
│   └── dashboard.ts        # Full rebuild: tab filter, status table, modal, empty state
├── api/
│   └── client.ts           # Add fetchDashboardSecrets(), deleteDashboardSecret()
└── components/
    └── layout.ts           # Add auth-reactive "Dashboard" nav link
```

### Pattern 1: Soft-Delete Status Model

**What:** Add a `status` text column to `secrets` with values `'active' | 'viewed' | 'expired' | 'deleted'`. Default is `'active'` (set at INSERT time). When a user-owned secret is viewed, zeroing + status update replaces zeroing + row delete. The row persists indefinitely as a metadata record.

**Why this approach over a separate audit table:**
- Zero new schema complexity (single table, no cross-table join)
- Zero new invariant enforcement points — the secrets table already has `userId` and the invariant is already documented for it
- Dashboard query is a single `SELECT` with `WHERE user_id = $1 ORDER BY created_at DESC` (already covered by the existing partial index)
- Ciphertext column is zeroed and becomes `'0'`-padded placeholder — status+label is the only meaningful data left

**Status transition table:**

| Event | Anonymous secret | User-owned secret |
|-------|-----------------|-------------------|
| Secret created | `status = 'active'` (if col exists) or NULL | `status = 'active'` |
| Secret viewed (retrieveAndDestroy) | Zero + DELETE (unchanged) | Zero ciphertext + UPDATE `status='viewed'`, `viewedAt=now()` |
| Secret expired (worker or guard) | Zero + DELETE (unchanged) | Zero ciphertext + UPDATE `status='expired'` |
| Dashboard delete (new endpoint) | N/A (anonymous users have no dashboard) | Zero ciphertext + UPDATE `status='deleted'` |

**Critical detail for expiration worker:** The worker currently does `DELETE WHERE expires_at <= now()`. This must change to: for user-owned rows (WHERE `user_id IS NOT NULL`), UPDATE `status='expired'`, zero ciphertext; then DELETE only rows where `user_id IS NULL` (anonymous). The existing partial index on `(user_id, created_at DESC) WHERE user_id IS NOT NULL` covers the update path efficiently.

**Code pattern for retrieveAndDestroy with status tracking:**
```typescript
// In secrets.service.ts — retrieveAndDestroy extended
// After confirming secret is valid and unprotected:
if (secret.userId !== null) {
  // User-owned: soft-delete (keep row for dashboard history)
  await tx.update(secrets)
    .set({
      ciphertext: '0'.repeat(secret.ciphertext.length),
      status: 'viewed',
      viewedAt: new Date(),
    })
    .where(eq(secrets.id, id));
  // Do NOT delete the row
} else {
  // Anonymous: hard-delete (unchanged behavior)
  await tx.update(secrets)
    .set({ ciphertext: '0'.repeat(secret.ciphertext.length) })
    .where(eq(secrets.id, id));
  await tx.delete(secrets).where(eq(secrets.id, id));
}
```

### Pattern 2: Zero-Knowledge Invariant Compliance for Dashboard Endpoint

**What:** The dashboard API endpoint returns metadata only, never ciphertext or encryption keys.

**The invariant holds because:** The `secrets` table already stores `userId` alongside `secrets.id`. The invariant permits this (it is explicitly documented as the allowed pattern in INVARIANTS.md). The dashboard query (`WHERE user_id = $1`) retrieves rows from the secrets table using userId — this is the permitted cross-reference. What the invariant prohibits is storing `secretId` in *user/session/account-side rows*, or combining them in log output.

**Select columns for dashboard query (DASH-05):**
```typescript
db.select({
  id: secrets.id,           // secretId — returned to owner only, auth-gated
  label: secrets.label,
  createdAt: secrets.createdAt,
  expiresAt: secrets.expiresAt,
  status: secrets.status,
  notify: secrets.notify,
  viewedAt: secrets.viewedAt,
  // NEVER select: ciphertext, passwordHash
}).from(secrets)
  .where(and(
    eq(secrets.userId, userId),
    // include all statuses (active, viewed, expired, deleted)
  ))
  .orderBy(desc(secrets.createdAt));
```

**Note on secretId in response:** Returning `id` (secretId) to the authenticated owner does NOT violate the invariant. The invariant governs storage/logging, not authenticated API responses to the secret's owner. The id is needed for the delete endpoint to identify which secret to delete.

**Logging reminder:** The existing Pino logger redacts secret IDs from URL paths. The new dashboard route path (`/api/dashboard/secrets`) does not embed a secretId in the path for the list endpoint. The delete endpoint (`/api/dashboard/secrets/:id`) does embed it — the existing redaction regex `\/api\/secrets\/[A-Za-z0-9_-]+` does not cover `/api/dashboard/secrets/:id`. The redaction regex must be extended to also cover `/api/dashboard/secrets/` paths. This is a zero-knowledge invariant enforcement point that must be added to INVARIANTS.md.

### Pattern 3: Dashboard Route Architecture

**Route structure:**
```
GET  /api/dashboard/secrets          → list user's secrets (metadata only)
DELETE /api/dashboard/secrets/:id    → soft-delete an Active secret by owner
```

Both routes behind `requireAuth` middleware. The existing `requireAuth` sets `res.locals.user` containing the authenticated user's ID.

**Owner verification for DELETE:** The delete endpoint must verify that the secret belongs to the authenticated user AND has status 'active'. Attempting to delete a non-active or non-owned secret returns 404 (same response as not-found, to prevent enumeration).

```typescript
// In dashboard.ts route handler
const { id } = req.params;
const userId = (res.locals.user as AuthUser).id;

const result = await db.transaction(async (tx) => {
  const [secret] = await tx.select({ userId: secrets.userId, status: secrets.status, ciphertext: secrets.ciphertext })
    .from(secrets)
    .where(eq(secrets.id, id));

  // Return null for: not found, wrong owner, non-active status
  if (!secret || secret.userId !== userId || secret.status !== 'active') {
    return null;
  }

  await tx.update(secrets)
    .set({ ciphertext: '0'.repeat(secret.ciphertext.length), status: 'deleted' })
    .where(eq(secrets.id, id));
  return true;
});

if (!result) {
  res.status(404).json({ error: 'not_found', message: 'Secret not found or cannot be deleted.' });
  return;
}
res.status(200).json({ success: true });
```

### Pattern 4: Schema Migration (Drizzle bug #4147 awareness)

Adding four columns to the existing `secrets` table: `label`, `notify`, `status`, `viewedAt`.

These are all simple column additions (no FK constraints on the new columns), so Drizzle bug #4147 does NOT apply here — all four columns can be in a single migration file safely.

**Drizzle schema additions:**
```typescript
// In schema.ts additions to secrets table:
label: text('label'),                                           // NULL = no label
notify: boolean('notify').notNull().default(false),            // per-secret email notification opt-in
status: text('status').notNull().default('active'),            // 'active'|'viewed'|'expired'|'deleted'
viewedAt: timestamp('viewed_at', { withTimezone: true }),      // NULL until viewed
```

**Status values as const:** Use a TypeScript const union rather than a Postgres enum, consistent with existing patterns (text columns for all string values in this schema).

**Migration file:** `drizzle/0003_add_dashboard_columns.sql` — generated via `npm run db:generate`, then reviewed before applying.

### Pattern 5: Auth-Gated Label Field on Create Page

**What:** The create page checks authentication state on mount. If authenticated, show the collapsible "Add label" field. If anonymous, the field is hidden (not in the DOM at all — not just visually hidden, to prevent form submission of undefined fields).

**Auth check:** Call `authClient.getSession()` on page mount (same pattern as dashboard.ts currently uses). Store result in a variable. Render label field only when session is active.

**Implementation pattern:**
```typescript
// In renderCreatePage — call at top of function (async)
const result = await authClient.getSession();
const data: unknown = result.data as unknown;
const isAuthenticated = isSession(data);
// ...later in form construction:
if (isAuthenticated) {
  form.appendChild(createLabelField());
}
```

**Wait — renderCreatePage is currently synchronous.** It is exported as `function renderCreatePage(container: HTMLElement): void`. Converting to `async` is straightforward but requires the router's `.then((mod) => mod.renderCreatePage(container))` chain to handle a returned Promise. The router already handles async page renderers (the `PageRenderer` type is `(container: HTMLElement) => void | Promise<void>`), so making `renderCreatePage` async is safe.

**Label field UX:** A `<details>`/`<summary>` collapsed section labeled "Add label" — same pattern as the existing "Advanced options" password field. Character limit: 100 characters (matching recommendation; fits within `text` column constraint enforced via `maxLength` on the input and Zod `.max(100)` on the API).

**API contract extension:** The `CreateSecretSchema` in `shared/types/api.ts` must add optional `label` and `notify` fields. The `createSecret()` service function must accept and pass them through.

### Pattern 6: Dashboard Nav Link (Header)

**What:** The header's `createHeader()` function in `layout.ts` currently shows a "Create" link (route-aware). A "Dashboard" link must be added that is only shown when the user is authenticated.

**Challenge:** The header is created once at DOMContentLoaded before auth state is known. Auth state must be checked asynchronously.

**Approach:** On `createLayoutShell()`, also call `authClient.getSession()` asynchronously, then show/hide the Dashboard link based on result. Also listen to `routechange` events to re-check when navigating (login/logout transitions). On logout (navigate to '/'), the Dashboard link should hide. On login (navigate to '/dashboard'), it should show.

**Alternative:** Listen for a custom `authchange` event dispatched by the login/logout pages when auth state changes. This is cleaner than polling on every route change, but requires coordinating events across login.ts, dashboard.ts, and layout.ts.

**Simpler approach (recommended):** On every `routechange`, call `authClient.getSession()` and toggle the Dashboard link's visibility. This adds ~one network call per navigation (the Better Auth client likely caches sessions in memory, so the cost is low). The session is already being fetched on every protected page mount anyway.

### Pattern 7: Status Tab Filter (Client-Side)

**What:** Status tabs filter the already-fetched secrets list in memory. No additional API call per tab change.

**Implementation:** Fetch all secrets once on dashboard mount. Store in a local array. Tab click handler filters the array and re-renders the table body. This avoids re-fetching and keeps UI snappy.

**Tab state:** A simple string variable `currentTab: 'all' | 'active' | 'viewed' | 'expired' | 'deleted'`. Tab buttons update `currentTab` and call `renderTableRows(filteredSecrets)`.

### Pattern 8: Confirmation Modal (Vanilla JS)

**What:** A modal dialog with backdrop, warning message, Confirm and Cancel buttons. Required before deleting a secret.

**Accessibility requirements:**
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing to modal heading
- Focus must be trapped inside the modal while open
- ESC key closes the modal
- When modal closes, focus returns to the triggering delete button

**Implementation pattern (no library needed):**
```typescript
function createConfirmationModal(onConfirm: () => void, onCancel: () => void): HTMLElement {
  const backdrop = document.createElement('div');
  backdrop.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.setAttribute('aria-labelledby', 'modal-title');

  // ESC key handler
  const handleKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') { onCancel(); }
  };
  document.addEventListener('keydown', handleKeydown, { once: true });

  // ... build modal content, buttons, etc.
  return backdrop;
}
```

**Focus trap:** After appending modal to DOM, focus the Cancel button (safe default). When confirmed or cancelled, call `document.removeEventListener` and return focus to the triggering element.

### Anti-Patterns to Avoid

- **Fetching ciphertext in the dashboard API:** The SELECT for the dashboard endpoint must explicitly list only the safe columns. Using `select().from(secrets)` (select star) would pull ciphertext into memory. Always use explicit column selection.
- **Hard-deleting user-owned secrets on view:** If `retrieveAndDestroy` hard-deletes user-owned rows, the Viewed status is permanently lost. The status soft-delete must happen inside the existing transaction, not as a separate step.
- **Adding secretId to log lines:** The new DELETE `/api/dashboard/secrets/:id` route embeds `id` in the URL path. Ensure the Pino logger redaction regex is extended to cover this path. Currently it only covers `/api/secrets/:id` paths.
- **Anonymous users accessing dashboard endpoints:** All `/api/dashboard/*` routes must be behind `requireAuth`. A missing `requireAuth` on the DELETE endpoint would allow any authenticated user to delete any secret by ID (even if they don't own it). Owner verification must be inside the transaction.
- **Conflating "expired" with "deleted" UI states:** The expiration worker must update status to `'expired'` (not `'deleted'`) for user-owned rows. These are distinct statuses with distinct visual treatment.
- **Converting `renderCreatePage` to async without updating PageRenderer handling:** The router type already supports `Promise<void>` return, but verify the `focusPageHeading()` call still fires after the async render completes (it is chained in `.then()` which handles both sync and async renders).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dialog focus trap | Custom tabbing loop | `<details>/<summary>` with focus-trap-wrangler OR simple focus on first/last button | A dialog with 2 buttons (Confirm/Cancel) has trivial focus management; full focus trap library is overkill for this scope |
| Auth state pub/sub | Custom event bus | `authClient.getSession()` per route change | Better Auth client already caches the session; one call per route is negligible |
| Date formatting | Custom date formatter | `Intl.DateTimeFormat` (browser built-in) | Handles locale, timezone, and formatting consistently |
| Status icon rendering | SVG string concatenation | Existing `createIcon()` from `client/src/components/icons.ts` | Already handles aria attributes, sizing, and Lucide icon nodes |

**Key insight:** This phase introduces no new library domains. Every UI pattern needed (collapsible field, toast, icon, modal) either exists in the project or can be built cleanly with existing primitives.

---

## Common Pitfalls

### Pitfall 1: Status Race — Expiration Worker Deletes Before Dashboard Can Show "Expired"

**What goes wrong:** The expiration worker bulk-deletes expired rows including user-owned ones. If the worker runs before the user checks their dashboard, they see no record of expired secrets.

**Why it happens:** The worker was written before the dashboard existed. It currently uses `DELETE WHERE expires_at <= now()` with no user_id distinction.

**How to avoid:** In the expiration worker's `cleanExpiredSecrets()` function, split the logic:
1. For user-owned expired rows (`user_id IS NOT NULL`): UPDATE status='expired', zero ciphertext — do NOT delete.
2. For anonymous expired rows (`user_id IS NULL`): zero + DELETE (unchanged behavior).

**Warning signs:** Dashboard shows no "Expired" rows even for secrets the user knows should have expired.

### Pitfall 2: Drizzle Bug #4147 Does Not Apply Here But May Feel Like It Does

**What goes wrong:** Developer runs `npm run db:generate`, sees a combined migration, unnecessarily splits it.

**Why it happens:** Bug #4147 triggers when a migration adds both a column AND a FK constraint on that column in the same file. The new `label`, `notify`, `status`, `viewedAt` columns have no FK constraints — they are simple text/boolean/timestamp columns. A single migration file is safe.

**How to avoid:** Inspect the generated SQL. If there is no `ADD CONSTRAINT` following an `ADD COLUMN`, splitting is unnecessary.

### Pitfall 3: Zero-Knowledge Log Redaction Gap on New Route

**What goes wrong:** The Pino logger redacts `/api/secrets/:id` from URL paths but the new `/api/dashboard/secrets/:id` (DELETE route) is not covered. Secret IDs appear in logs.

**Why it happens:** The redaction regex was written for the original route structure. New routes with similar ID patterns require updating the regex.

**How to avoid:** In `logger.ts`, extend the redaction regex to cover `/api/dashboard/secrets/:id` paths. Or generalize the regex to any `/[A-Za-z0-9_-]{21}` path segment.

**Warning signs:** Running the server in debug mode and seeing a 21-character nanoid in a log line that includes the user's authenticated request.

### Pitfall 4: `renderCreatePage` Auth Check Adds Visible Loading Delay

**What goes wrong:** The create page now calls `authClient.getSession()` before rendering the form, adding a network round-trip. Users see a blank page while auth state is fetched.

**Why it happens:** Auth check is blocking render.

**How to avoid:** Render the full form immediately (without the label field), then add the label field asynchronously if auth check succeeds. This keeps the perceived load time fast for the most common anonymous case. For authenticated users, the label field appears after a brief moment — acceptable UX.

Alternatively: optimistically assume unauthenticated (no label field), then add it if auth check succeeds. This is the correct progressive enhancement pattern.

### Pitfall 5: Table Accessibility — `<table>` Requires Proper Semantics

**What goes wrong:** Building the table with `<div>` rows (common in CSS grid layouts) loses screen reader semantics.

**Why it happens:** Tailwind CSS grid is tempting for responsive tables.

**How to avoid:** Use proper `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>` elements. Add `scope="col"` to header cells. Add `aria-label` to the table element describing its purpose.

### Pitfall 6: `retrieveAndDestroy` Atomic Transaction Break

**What goes wrong:** Adding status update for user-owned secrets as a separate call after the transaction.

**Why it happens:** Modifying the transaction to branch on userId is seen as complex, so the status update is added after the transaction completes.

**How to avoid:** The status update (soft-delete for user-owned secrets) MUST happen inside the same transaction as the ciphertext zeroing. If the transaction rolls back, the status update must also roll back. Never split atomic operations across transaction boundary.

---

## Code Examples

### Dashboard List Query (metadata only, no ciphertext)

```typescript
// Source: Drizzle ORM docs — select specific columns
import { desc, eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { secrets } from '../db/schema.js';

export async function getUserSecrets(userId: string) {
  return db.select({
    id: secrets.id,
    label: secrets.label,
    createdAt: secrets.createdAt,
    expiresAt: secrets.expiresAt,
    status: secrets.status,
    notify: secrets.notify,
    viewedAt: secrets.viewedAt,
    // ciphertext intentionally excluded
    // passwordHash intentionally excluded
  })
  .from(secrets)
  .where(eq(secrets.userId, userId))
  .orderBy(desc(secrets.createdAt));
}
```

### Schema Extension

```typescript
// In server/src/db/schema.ts — additions to secrets pgTable:
label: text('label'),
notify: boolean('notify').notNull().default(false),
status: text('status').notNull().default('active'),
viewedAt: timestamp('viewed_at', { withTimezone: true }),
```

### Status Column Index (optional, for tab-filter queries)

The existing partial index `secrets_user_id_created_at_idx` covers the primary dashboard query (WHERE user_id IS NOT NULL, ORDER BY created_at DESC). A composite index on `(user_id, status)` would only help if pagination by status is introduced server-side. Since the client-side tab filter loads all records and filters in memory (no pagination in Phase 23), no additional index is needed.

### Expiration Worker Status Update

```typescript
// In expiration-worker.ts — cleanExpiredSecrets() extended:
const now = new Date();

// Step 1: Mark user-owned expired secrets as 'expired' (keep for dashboard history)
await db.update(secrets)
  .set({ ciphertext: '0', status: 'expired' })
  .where(and(lte(secrets.expiresAt, now), isNotNull(secrets.userId)));

// Step 2: Zero + delete anonymous expired secrets (unchanged behavior)
await db.update(secrets)
  .set({ ciphertext: '0' })
  .where(and(lte(secrets.expiresAt, now), isNull(secrets.userId)));

const result = await db.delete(secrets)
  .where(and(lte(secrets.expiresAt, now), isNull(secrets.userId)));
```

### Zod Schema Extension for CreateSecret

```typescript
// In shared/types/api.ts — extend CreateSecretSchema:
export const CreateSecretSchema = z.object({
  ciphertext: z.string().min(1).max(200_000),
  expiresIn: z.enum(['1h', '24h', '7d', '30d']),
  password: z.string().min(1).max(128).optional(),
  label: z.string().max(100).optional(),     // NEW — dashboard label
  notify: z.boolean().optional(),             // NEW — per-secret notification opt-in (Phase 26)
});
```

### Date Formatting for Dashboard Table

```typescript
// Browser built-in, no library needed
function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr));
}
```

### Status Badge Pattern

```typescript
const STATUS_CONFIG = {
  active:  { label: 'Active',  iconName: Circle,      colorClass: 'text-success' },
  viewed:  { label: 'Viewed',  iconName: CheckCircle,  colorClass: 'text-text-muted' },
  expired: { label: 'Expired', iconName: Clock,        colorClass: 'text-warning' },
  deleted: { label: 'Deleted', iconName: Trash2,       colorClass: 'text-danger' },
} as const;

function createStatusBadge(status: string): HTMLElement {
  const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
  const span = document.createElement('span');
  span.className = `flex items-center gap-1 text-sm ${config.colorClass}`;
  span.setAttribute('aria-label', config.label);  // accessible text
  const icon = createIcon(config.iconName, { size: 'sm', class: config.colorClass });
  const label = document.createElement('span');
  label.textContent = config.label;
  span.appendChild(icon);
  span.appendChild(label);
  return span;
}
```

---

## Phase Work Breakdown

Based on the research, Phase 23 naturally decomposes into these plans:

| Plan | Description | Key outputs |
|------|-------------|-------------|
| 23-01 | Schema migration — add label, notify, status, viewedAt columns | schema.ts changes, migration file |
| 23-02 | Backend API — dashboard routes + service functions + expiration worker update | dashboard.ts route, secrets.service.ts extension, shared/types/api.ts extension |
| 23-03 | Create page — auth-gated label field + notify toggle stub + API update | create.ts changes, api/client.ts changes |
| 23-04 | Dashboard page rebuild — tab filter, status table, confirmation modal, empty state, header link | dashboard.ts full rebuild, layout.ts update |
| 23-05 | Integration tests + zero-knowledge compliance check | Route tests, invariant table update, INVARIANTS.md update |

---

## Open Questions

1. **`notify` field in Phase 23 vs Phase 26**
   - What we know: DASH-01 lists "notification setting" as a metadata column shown in the dashboard. NOTF-01 (Phase 26) requires a per-secret toggle at creation.
   - What's unclear: Whether Phase 23 should include the `notify` column in the schema (future-proofing) but keep the UI hidden, or defer the column entirely to Phase 26.
   - Recommendation: Add the `notify` column to the schema in Phase 23 (migration is cheap, avoids a second migration in Phase 26). Show the "Notification" column in the dashboard table. But the toggle on the create page can be marked "coming soon" or simply not rendered — Phase 26 implements the actual notification sending. The column value defaults to `false` and is stored on creation.

2. **Pagination on the dashboard list**
   - What we know: No pagination was discussed in CONTEXT.md. The dashboard loads all user secrets in one request.
   - What's unclear: What happens when a heavy user has hundreds of secrets over time.
   - Recommendation: No pagination in Phase 23 (match scope to discussion). The server query already uses the partial index (efficient). If pagination becomes needed, it can be a gap-closure or future phase. Document the no-pagination decision in PLAN.

3. **`createSecret()` service function and userId**
   - What we know: The existing `createSecret(ciphertext, expiresIn, password)` in `secrets.service.ts` does not accept `userId`, `label`, or `notify`.
   - What's unclear: Whether to add `userId` as a parameter to `createSecret()` in Phase 23 (so authenticated users' secrets are linked to their account), or whether this was already handled somewhere.
   - Recommendation: Phase 21 added the `userId` FK column but Phase 22 never extended `createSecret()` to accept userId — the route handler for `POST /api/secrets` doesn't call `requireAuth` and passes no userId. Phase 23 must extend `createSecret()` to accept an optional `userId` and `label`. The secrets route must be updated to call `requireAuth` optionally (or check session without enforcing it) to capture userId for authenticated requests.

   **Critical sub-question:** Can we call `requireAuth` as an optional middleware? The answer is no — `requireAuth` returns 401 if no session. For optional auth on the create endpoint, we need a `optionalAuth` middleware that sets `res.locals.user` if a session exists but calls `next()` regardless.

---

## Sources

### Primary (HIGH confidence — directly verified in codebase)

- `server/src/db/schema.ts` — secrets table structure, existing columns, partial index, userId FK
- `server/src/services/secrets.service.ts` — retrieveAndDestroy transaction pattern, verifyAndRetrieve pattern
- `server/src/workers/expiration-worker.ts` — current deletion logic to be extended
- `server/src/middleware/require-auth.ts` — requireAuth pattern, res.locals.user
- `server/src/routes/secrets.ts` — existing route structure
- `server/src/routes/me.ts` — model for new authenticated route
- `server/src/app.ts` — middleware order, route registration pattern
- `client/src/router.ts` — PageRenderer type (void | Promise<void>), route handling
- `client/src/pages/dashboard.ts` — existing dashboard stub, isSession() guard pattern
- `client/src/pages/create.ts` — form structure, details/summary pattern for advanced options
- `client/src/components/layout.ts` — header structure, routechange event listener pattern
- `client/src/components/icons.ts` — createIcon() API
- `client/src/components/toast.ts` — toast pattern
- `shared/types/api.ts` — existing Zod schemas, type contracts
- `.planning/INVARIANTS.md` — zero-knowledge invariant enforcement table
- `drizzle/0002_add_secrets_user_id.sql` — existing migration pattern

### Secondary (MEDIUM confidence)

- Drizzle ORM column selection pattern — consistent with library behavior as used throughout the codebase
- Better Auth `authClient.getSession()` caching — observed from Phase 22 implementation notes; exact cache behavior not independently verified but consistent with stated behavior

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — entire phase uses existing project dependencies
- Architecture (status model): HIGH — soft-delete is the only viable approach given delete-on-view behavior and the dashboard history requirement
- Architecture (zero-knowledge compliance): HIGH — invariant explicitly permits secrets table having userId; new dashboard route does not create new invariant violations if logging is updated
- Pitfalls: HIGH — derived directly from reading existing code and understanding failure modes
- Open questions: MEDIUM — userId handling on create endpoint is a real gap discovered during research; confirmed by reading createSecret() and the route — userId is never passed

**Research date:** 2026-02-20
**Valid until:** 2026-03-22 (stable stack, 30-day window)

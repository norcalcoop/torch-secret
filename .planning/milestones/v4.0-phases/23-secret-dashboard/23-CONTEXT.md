# Phase 23: Secret Dashboard - Context

**Gathered:** 2026-02-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Authenticated users can view their secret history (metadata only), add optional labels when creating secrets, and delete unviewed (Active) secrets before they are accessed. The dashboard never exposes secret content, ciphertext, or encryption keys. Anonymous users cannot access the dashboard.

</domain>

<decisions>
## Implementation Decisions

### List presentation
- Table layout with columns (not cards or compact rows)
- Columns: Label, Created, Expires, Status, Notification, Delete action
- Delete action column: icon visible for all rows, but disabled/greyed out for non-Active rows
- Table is read-only — no row click action, no copy-link from dashboard
- Default sort: Claude's discretion (newest first recommended for this use case)

### Status tabs
- Status filter tabs: All / Active / Viewed / Expired / Deleted
- Default tab: All
- Tabs allow users to focus on actionable secrets without scrolling past old ones

### Status display
- Color + icon combined for all four statuses (Active, Viewed, Expired, Deleted)
- e.g. green circle for Active, grey checkmark for Viewed, amber clock for Expired, red/muted for Deleted
- Specific colors and icons: Claude's discretion — must be accessible (not color alone)

### Label entry on create page
- Collapsed by default — revealed via an "Add label" trigger (link or chevron)
- Hidden entirely for anonymous (unauthenticated) users — only authenticated users see the label option
- Placeholder copy: Claude's discretion (keep consistent with app tone)
- Character limit: Claude's discretion (short limit ~64–100 chars recommended)
- Whether label echoes on confirmation page: Claude's discretion

### Delete behavior
- Confirmation modal required before deletion
- Modal copy: Claude's discretion — must clearly communicate permanence and consequence ("the recipient's link will stop working")
- After deletion: row remains in the table with a "Deleted" status badge (not removed from view — preserves audit trail)
- Non-Active rows: delete icon visible but greyed out and non-interactive

### Empty state
- Illustration + friendly message + Create Secret CTA button
- Specific illustration and copy: Claude's discretion — match app tone

### Dashboard navigation
- Persistent "Dashboard" link in the site header, visible only when the user is authenticated
- No dropdown/account menu required — direct nav link

### Claude's Discretion
- Default sort order for the secrets table (newest first strongly implied)
- Label placeholder copy and character limit
- Confirmation modal copy (must communicate permanence and link-invalidation)
- Status icon choices and exact color values (must meet accessibility contrast)
- Label echo behavior on the confirmation page
- Illustration and copy for empty state

</decisions>

<specifics>
## Specific Ideas

- No specific product references — open to standard approaches
- Status tabs pattern is explicitly requested (not just a filter dropdown)
- Deleted secrets must remain visible in the list as "Deleted" rows — deletion does not purge history

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 23-secret-dashboard*
*Context gathered: 2026-02-20*

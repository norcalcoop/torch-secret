# Phase 28: Optional password or passphrase protection with password generator and masked inputs - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Refactor the protection step in the create flow to offer a choice between password mode and passphrase mode. Passphrase mode preserves existing behavior. Password mode adds a full password generator with strength tiers, character set controls, and filter options. All password/passphrase input fields across the app (create form + reveal page) get masked/unmasked toggles.

</domain>

<decisions>
## Implementation Decisions

### Protection type selector

- Protection remains opt-in — collapsed by default; user clicks "Add protection" to expand the panel
- When the panel opens, a **segmented control / pill tabs** widget shows "Password | Passphrase"
- **Password tab is active by default** when the panel first opens
- Switching tabs always clears the currently entered value — no cross-mode carry-over

### Password generator controls

- Strength is controlled by a **discrete tier selector: Low / Medium / High / Max**
- Each tier defines both character set composition and password length — no separate length slider
- Character set is further configurable with **independent checkboxes**: Uppercase, Numbers, Symbols
  - Defaults per tier: tier fully determines which checkboxes are pre-checked
- **Additional filter options (independent checkboxes, combinable freely)**:
  - Easy to say (avoids symbols and numbers, phonetically pronounceable)
  - Easy to read (avoids ambiguous characters)
  - Omit visually similar characters (removes 1/l/I/|, 0/O, etc.)
- **Strength display**: Tier label prominently + bit entropy as secondary smaller text (e.g., "High · ~72 bits")
- **Brute force time estimate**: Show alongside entropy (e.g., "~centuries at 10B guesses/sec") as a secondary detail

### Generated password UX

- Generator shows a **preview field** — password is not applied until the user confirms
- **"Use this password" button** applies the preview to the actual password field
- **Regenerate button** (refresh/dice icon) is always visible to get a new password with current settings
- Settings changes (tier, checkboxes, filters) **auto-regenerate** the preview immediately
- Preview field has a **copy icon** to copy the generated password before or without applying it
- Layout (preview above or below controls): Claude's discretion — follow standard password manager UX patterns (e.g., 1Password/Bitwarden conventions)

### Masked input behavior

- **All** password/passphrase input fields get a show/hide (eye icon) toggle:
  - Password field on create form (after applying from generator, or entering manually)
  - Passphrase field on create form
  - Password/passphrase input on the reveal page
- Fields **default to masked** (security-appropriate default)
- Show/hide state per field is **Claude's discretion** — independent vs linked behavior left to Claude based on implementation context
- No confirm/repeat password field — show/hide toggle is sufficient

### Claude's Discretion

- Layout order of generator controls vs preview field (above/below)
- Independent vs linked show/hide state across preview field and applied password field
- Exact spacing, icon choices, animation transitions within the protection panel
- Error state handling for empty fields on submit

</decisions>

<specifics>
## Specific Ideas

- Brute force time estimate is explicitly desired: calculate from entropy bits (entropy ÷ log₂(attempts/sec)) and display alongside the strength label
- The "Omit visually similar characters" filter mentioned specific examples: 1, l, I, |, 0, O — and "all other characters that are visually confusing"
- "Easy to say" and "Easy to read" are separate modes that should be independently toggleable (combinable)
- Reference: behavior similar to 1Password's password generator UX (preview at top, controls below, auto-regenerate on change)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 28-optional-password-or-passphrase-protection-with-password-generator-and-masked-inputs*
*Context gathered: 2026-02-21*

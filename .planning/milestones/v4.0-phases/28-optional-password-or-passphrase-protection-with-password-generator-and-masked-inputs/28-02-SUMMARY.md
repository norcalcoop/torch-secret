---
phase: 28-optional-password-or-passphrase-protection-with-password-generator-and-masked-inputs
plan: 02
subsystem: ui
tags: [typescript, tailwind, lucide, password-generator, passphrase, eye-toggle, segmented-control]

requires:
  - phase: 28-01
    provides: generatePassword() function with tier, charset flags, filter options, and GeneratedPassword type

provides:
  - createProtectionPanel() factory with { element, getPassword, getPassphrase } return type
  - Collapsible "Add protection" details/summary panel (collapsed = no protection)
  - Segmented Password | Passphrase control with full generator UI
  - Password tab: tier selector, charset/filter checkboxes, preview field + copy, entropy + brute-force, Regenerate, "Use this password", masked applied-field + eye toggle
  - Passphrase tab: masked EFF diceware input (editable, pre-filled) + eye toggle + Regenerate + Copy
  - Phase 24 unconditional passphrase UI fully removed from create.ts

affects:
  - 28-03 (accessibility tests may reference updated DOM structure)

tech-stack:
  added: []
  patterns:
    - "createProtectionPanel() factory function closure pattern: all mode state lives inside the factory; consumers get { element, getPassword, getPassphrase } accessors"
    - "insertBefore(element, protectionPanel.element) for auth IIFE label/notify injection — protection panel serves as stable anchor replacing errorArea"
    - "Eye/EyeOff toggle pattern: passwordVisible flag + classList.toggle('hidden') on both icon elements, matching login.ts lines 107-131"

key-files:
  created: []
  modified:
    - client/src/pages/create.ts

key-decisions:
  - "insertBefore(labelField, protectionPanel.element) — protection panel replaces errorArea as the stable anchor for auth IIFE insertions; label+notify appear between expiration and protection panel"
  - "Passphrase tab uses input type=password (masked, editable) not a display div — matches password tab UX and lets user edit before committing"
  - "Closing the details panel regenerates a fresh passphrase on re-open — prevents old passphrase from leaking if panel closed/reopened after switching tabs"
  - "easyToSay checkbox disables and unchecks Uppercase/Numbers/Symbols inputs when checked — easyToSay overrides them at the charset level; disabling prevents user confusion"
  - "Both tasks (Task 1: factory, Task 2: wiring) committed in a single atomic commit since they both exclusively modify create.ts and are mutually dependent"
  - "showToast imported directly for the inline copy-preview button — cannot use createCopyButton because the button must be absolutely positioned inside the preview container"

patterns-established:
  - "Protection panel as factory: closure-scoped state, accessor-based API (getPassword/getPassphrase)"
  - "Tier default function applyTierDefaults(tier): centralized checkbox state management on tier switch"

requirements-completed: [PROT-01, PROT-04]

duration: ~5min
completed: 2026-02-21
---

# Phase 28 Plan 02: Protection Panel UI Summary

**Opt-in collapsible "Add protection" panel with 1Password-style password generator (tier selector, charset/filter checkboxes, entropy display) and passphrase tab (masked EFF diceware input), replacing Phase 24's unconditional passphrase section**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-02-21T18:13:40Z
- **Completed:** 2026-02-21T18:18:34Z
- **Tasks:** 2 (implemented together in one atomic commit)
- **Files modified:** 1

## Accomplishments

- Replaced Phase 24's unconditional `passphraseGroup` + hidden `passwordInput` with `createProtectionPanel()` factory
- Password tab fully implemented: tier selector (Low/Medium/High/Max), charset checkboxes (Uppercase/Numbers/Symbols), filter checkboxes (Easy to say/Easy to read/Omit similar), live preview field with absolute-positioned copy button, entropy + brute-force label (e.g. "High · ~105 bits · ~centuries at 10B guesses/sec"), Regenerate, "Use this password" commit, and masked applied-password field with Eye/EyeOff toggle
- Passphrase tab fully implemented: masked EFF diceware input (pre-filled, editable), Eye/EyeOff toggle, Regenerate (New passphrase), Copy button
- Submit handler updated: `protectionPanel.getPassword()` replaces `passwordInput.value || undefined`; `renderConfirmationPage` receives `protectionPanel.getPassphrase()` as 5th argument
- Auth IIFE insertion anchor updated from `errorArea` to `protectionPanel.element`

## Task Commits

Both tasks atomically committed as one (single-file, mutually dependent):

1. **Tasks 1 + 2: createProtectionPanel factory + wiring** - `fc839c1` (feat)

## Files Created/Modified

- `client/src/pages/create.ts` - Full refactor: createProtectionPanel() factory (lines 245-774), renderCreatePage wiring (lines 838-1096), Phase 24 passphraseGroup + hidden passwordInput removed

## Decisions Made

- `insertBefore(labelField, protectionPanel.element)` — protection panel serves as stable DOM anchor for auth IIFE label/notify injections; both are inserted immediately before the protection panel so DOM order is: expiration → label → notify → protection → error → submit
- Passphrase input is `type="password"` (masked, editable) — consistent with password tab UX; user can edit the generated passphrase before sharing
- Closing the `<details>` panel regenerates a fresh passphrase on re-open — avoids old passphrase reappearing if panel closed after a tab switch
- `easyToSay` checked → disables + unchecks Uppercase/Numbers/Symbols inputs — easyToSay overrides all charset flags at the `buildCharset()` level; disabling the checkboxes prevents user confusion about which flags are active
- Absolute-positioned copy-preview button built manually (not via `createCopyButton`) — `createCopyButton` returns a full-width inline button; the preview copy must float inside the relative container
- `showToast` imported directly for the preview copy button — same pattern as copy-button.ts uses internally

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused RefreshCw import**
- **Found during:** Task 1 (ESLint run after initial implementation)
- **Issue:** `RefreshCw` was imported but never used; `@typescript-eslint/no-unused-vars` error
- **Fix:** Removed `RefreshCw` from the Lucide import (replaced by `Dices` for Regenerate buttons)
- **Files modified:** `client/src/pages/create.ts`
- **Verification:** ESLint clean, 0 errors
- **Committed in:** `fc839c1` (pre-commit hook fixed this before commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - unused import)
**Impact on plan:** Minor fix — `RefreshCw` was in the plan's Lucide import list but `Dices` is the correct icon for Regenerate. No scope change.

## Issues Encountered

None — implementation matched plan spec. The single deviation (unused import) was caught and fixed by ESLint before commit.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `createProtectionPanel()` exported and wired into `renderCreatePage`; Phase 28-03 (accessibility + unit tests for the protection panel) can import and test it directly
- All 126 client tests pass; 0 regressions
- ESLint and Prettier clean on all modified files
- `PROT-01` (optional protection UI) and `PROT-04` (masked inputs + eye toggles) requirements satisfied

## Self-Check: PASSED

- FOUND: `client/src/pages/create.ts` (modified, protection panel present)
- FOUND: commit `fc839c1` (feat: createProtectionPanel factory + wiring)
- FOUND: `createProtectionPanel` function at line 245
- FOUND: `protectionPanel.getPassword()` at line 982 (submit handler)
- FOUND: `protectionPanel.getPassphrase()` at line 1032 (renderConfirmationPage call)
- NOT FOUND: `passphraseGroup` (Phase 24 code fully removed)
- NOT FOUND: `passwordInput.value` (hidden input fully removed)
- NOT FOUND: `Math.random` (0 results)
- NOT FOUND: `innerHTML` (0 results)

---
*Phase: 28-optional-password-or-passphrase-protection-with-password-generator-and-masked-inputs*
*Completed: 2026-02-21*

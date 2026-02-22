# Phase 28: Optional Password or Passphrase Protection with Password Generator and Masked Inputs - Research

**Researched:** 2026-02-21
**Domain:** Frontend UI — password generator, segmented control, entropy calculation, masked input toggle
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Protection type selector:**
- Protection remains opt-in — collapsed by default; user clicks "Add protection" to expand the panel
- When the panel opens, a segmented control / pill tabs widget shows "Password | Passphrase"
- Password tab is active by default when the panel first opens
- Switching tabs always clears the currently entered value — no cross-mode carry-over

**Password generator controls:**
- Strength is controlled by a discrete tier selector: Low / Medium / High / Max
- Each tier defines both character set composition and password length — no separate length slider
- Character set is further configurable with independent checkboxes: Uppercase, Numbers, Symbols
  - Defaults per tier: tier fully determines which checkboxes are pre-checked
- Additional filter options (independent checkboxes, combinable freely):
  - Easy to say (avoids symbols and numbers, phonetically pronounceable)
  - Easy to read (avoids ambiguous characters)
  - Omit visually similar characters (removes 1/l/I/|, 0/O, etc.)
- Strength display: Tier label prominently + bit entropy as secondary smaller text (e.g., "High · ~72 bits")
- Brute force time estimate: Show alongside entropy (e.g., "~centuries at 10B guesses/sec") as a secondary detail

**Generated password UX:**
- Generator shows a preview field — password is not applied until the user confirms
- "Use this password" button applies the preview to the actual password field
- Regenerate button (refresh/dice icon) is always visible to get a new password with current settings
- Settings changes (tier, checkboxes, filters) auto-regenerate the preview immediately
- Preview field has a copy icon to copy the generated password before or without applying it
- Layout (preview above or below controls): Claude's discretion — follow standard password manager UX patterns (e.g., 1Password/Bitwarden conventions)

**Masked input behavior:**
- All password/passphrase input fields get a show/hide (eye icon) toggle:
  - Password field on create form (after applying from generator, or entering manually)
  - Passphrase field on create form
  - Password/passphrase input on the reveal page
- Fields default to masked (security-appropriate default)
- Show/hide state per field is Claude's discretion — independent vs linked behavior left to Claude
- No confirm/repeat password field — show/hide toggle is sufficient

### Claude's Discretion

- Layout order of generator controls vs preview field (above/below)
- Independent vs linked show/hide state across preview field and applied password field
- Exact spacing, icon choices, animation transitions within the protection panel
- Error state handling for empty fields on submit

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

## Summary

Phase 28 is a frontend-only phase. No new backend endpoints, no schema changes, no new npm packages are required. The entire implementation lives in `client/src/pages/create.ts`, `client/src/pages/reveal.ts`, and a new `client/src/crypto/password-generator.ts` module.

The core work is threefold. First, the existing unconditional passphrase section on the create page (Phase 24 output) is replaced with a collapsible protection panel containing a segmented "Password | Passphrase" control. Second, a client-side password generator module is written using `crypto.getRandomValues` exclusively — same discipline as the passphrase module. Third, every password/passphrase text input across the app (create form and reveal page) gains a show/hide eye-icon toggle using the pattern already established in `login.ts`.

No new libraries. No backend changes. The password field sent to the API is the same `password` field already in `CreateSecretSchema` (`string().min(1).max(128).optional()`), so the server is already compatible. The character set and entropy math is pure TypeScript with `crypto.getRandomValues`.

**Primary recommendation:** Build `password-generator.ts` as a pure, testable module first (TDD), then wire the UI in create.ts and reveal.ts as a second plan, with a final accessibility + tests plan.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Web Crypto API (`crypto.getRandomValues`) | Browser built-in | Cryptographically secure random number generation | Project invariant — only approved source of randomness |
| Lucide (`lucide` 0.564.0) | Already installed | UI icons (Eye, EyeOff, RefreshCw, Dices, Copy) | Already used throughout the project; vite.config.ts has the ESM alias fix |
| Tailwind CSS 4.x | Already installed | Styling segmented control, tier selector, checkbox grids | Design system is already set up |
| Vitest 4.x / happy-dom | Already installed | Unit testing the generator module | Multi-project config already covers `client/src/**/*.test.ts` |

### No New Dependencies

This phase adds **zero** npm packages. All required tools already exist:
- Icon set: `Eye`, `EyeOff`, `RefreshCw`, `Dices`, `Copy`, `Check` — all confirmed FOUND in `lucide` 0.564.0
- Randomness: `crypto.getRandomValues` — same API used in `passphrase.ts` and `keys.ts`
- Styling: Tailwind CSS 4.x semantic tokens already defined in `styles.css`
- Testing: Vitest in happy-dom environment

---

## Architecture Patterns

### Recommended Project Structure

```
client/src/
├── crypto/
│   ├── password-generator.ts    # NEW: pure module, no DOM deps
│   ├── password-generator.test.ts  # NEW: unit tests
│   └── index.ts                 # UPDATED: export generatePassword
├── pages/
│   ├── create.ts               # UPDATED: protection panel replaces passphrase section
│   └── reveal.ts               # UPDATED: eye toggle on password input
└── components/
    └── (no new components — all logic inline or in crypto module)
```

### Pattern 1: Password Generator Module (Pure, Testable)

**What:** `client/src/crypto/password-generator.ts` — a pure function module with no DOM imports. Follows the exact same design discipline as `passphrase.ts`.

**Contract:**
```typescript
// Source: modeled on passphrase.ts pattern in client/src/crypto/passphrase.ts

/** Tier definitions — locked by CONTEXT.md */
export type PasswordTier = 'low' | 'medium' | 'high' | 'max';

export interface PasswordOptions {
  tier: PasswordTier;
  uppercase: boolean;
  numbers: boolean;
  symbols: boolean;
  easyToSay: boolean;   // avoids symbols/numbers, phonetically pronounceable
  easyToRead: boolean;  // avoids ambiguous glyphs
  omitSimilar: boolean; // removes 1/l/I/|, 0/O and similar confusable chars
}

export interface GeneratedPassword {
  password: string;
  entropyBits: number;
  bruteForceEstimate: string; // human-readable string e.g. "~centuries at 10B guesses/sec"
}

export function generatePassword(options: PasswordOptions): GeneratedPassword;
```

**Tier definitions (suggested, Claude's discretion on exact lengths/composition):**

| Tier | Length | Lowercase | Uppercase | Numbers | Symbols | ~Entropy |
|------|--------|-----------|-----------|---------|---------|----------|
| Low  | 8      | yes       | no        | no      | no      | ~38 bits |
| Medium | 12   | yes       | yes       | yes     | no      | ~69 bits |
| High | 16     | yes       | yes       | yes     | yes     | ~105 bits |
| Max  | 24     | yes       | yes       | yes     | yes     | ~157 bits |

The checkboxes (Uppercase, Numbers, Symbols) can override tier defaults but cannot remove lowercase. "Easy to say" forces lowercase-only phonetic characters. Filters are applied after charset construction to narrow the candidate pool.

**Entropy calculation:**
- `charsetSize` = number of unique characters in the effective character set (after filter application)
- `entropyBits = passwordLength * log2(charsetSize)`
- This is the standard formula for uniform random selection from a known charset
- Confidence: HIGH — standard information theory formula

**Brute force time estimate:**
- Reference rate: `10_000_000_000` guesses/second (10 billion — realistic for dedicated hardware cluster)
- `secondsToBreak = 2^entropyBits / guessesPerSecond`
- Map to human label: `< 1 second`, `seconds`, `minutes`, `hours`, `days`, `months`, `years`, `decades`, `centuries`, `millennia`, `eons` (practical ceiling: eons)
- Formula is deterministic; no external libraries needed

**Cryptographically secure random generation:**
- Use the rejection-sampling pattern already proven in `passphrase.ts`:
  - Generate `Uint32Array(1)` via `crypto.getRandomValues`
  - Discard values >= `Math.floor(0xFFFFFFFF / charsetSize) * charsetSize` (eliminates modulo bias)
  - Retry on rejection (probability extremely low for typical charset sizes)
- Pick `charset[value % charsetSize]` to get each character

**Character set constants (defined inline in the module):**

```typescript
// Source: standard password generator conventions (1Password, Bitwarden)
const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const NUMBERS = '0123456789';
const SYMBOLS = '!@#$%^&*()-_=+[]{}|;:,.<>?';

// Easy to say: only phonetically clean lowercase letters (no q, x, etc.)
// Removes ambiguous phoneme clusters — exact set is Claude's discretion
const PHONETIC_LOWERCASE = 'abcdefghjkmnprstuvwyz'; // example — omits e,i,l,o,q,x

// Characters to omit for "omit visually similar" (from CONTEXT.md examples)
const SIMILAR_CHARS = /[1lI|0O]/g;

// Easy to read: also omit additional ambiguous glyphs
const AMBIGUOUS_READ = /[1lI|0OB8S5]/g;
```

**Anti-pattern:** Do NOT use `Math.random()`. Do NOT use `window.crypto` directly — use `crypto.getRandomValues` (global in modern browsers and Node 19+).

### Pattern 2: Segmented Control / Pill Tabs

**What:** A two-button toggle (Password | Passphrase) that switches the active protection mode. Built with plain DOM elements — no external tab library.

**Implementation using existing project patterns:**

```typescript
// Source: modeled on details/summary (createLabelField) and ExpirationSelectResult patterns in create.ts

function createProtectionPanel(): {
  element: HTMLElement;
  getValue: () => string | undefined; // undefined = no protection
} {
  // Outer details/summary for "Add protection" collapse
  // When open: show segmented control
  // Segmented control: two buttons with aria-pressed or role="tab"
}
```

**Accessibility requirements:**
- Segmented control uses `role="group"` with `aria-label="Protection type"` on the wrapper
- Each segment button: `aria-pressed="true/false"` pattern (simpler than role="tablist" for two options)
- Active segment: visually distinct (solid accent bg + white text), aria-pressed=true
- Switching segments: focus stays on clicked segment (no focus loss)
- The panel is inside a `<details>/<summary>` — matches the `createLabelField` pattern

**Tab switching clears values (locked decision):**
- Password → Passphrase: clear the password field value; re-display the current passphrase
- Passphrase → Password: clear the password preview and applied password field

### Pattern 3: Eye/EyeOff Toggle (Already Established)

**What:** A positioned button inside a relative wrapper that swaps `input.type` between `'password'` and `'text'`.

**Exact pattern from `login.ts` (lines 107–129) — reuse verbatim:**

```typescript
// Source: client/src/pages/login.ts lines 107-129

const passwordWrapper = document.createElement('div');
passwordWrapper.className = 'relative';
passwordWrapper.appendChild(passwordInput);

const revealToggle = document.createElement('button');
revealToggle.type = 'button';
revealToggle.setAttribute('aria-label', 'Show password');
revealToggle.className =
  'absolute inset-y-0 right-0 flex items-center px-3 text-text-muted hover:text-text-secondary ' +
  'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset focus:outline-none ' +
  'rounded-r-lg transition-colors cursor-pointer';

const eyeEl = createIcon(Eye, { size: 'sm', class: 'pointer-events-none' });
const eyeOffEl = createIcon(EyeOff, { size: 'sm', class: 'pointer-events-none hidden' });
revealToggle.appendChild(eyeEl);
revealToggle.appendChild(eyeOffEl);

let passwordVisible = false;
revealToggle.addEventListener('click', () => {
  passwordVisible = !passwordVisible;
  passwordInput.type = passwordVisible ? 'text' : 'password';
  revealToggle.setAttribute('aria-label', passwordVisible ? 'Hide password' : 'Show password');
  eyeEl.classList.toggle('hidden', passwordVisible);
  eyeOffEl.classList.toggle('hidden', !passwordVisible);
});

passwordWrapper.appendChild(revealToggle);
```

**Apply to three fields:**
1. Applied password field on create form (after "Use this password" is clicked)
2. Passphrase field on create form (the existing `passphraseDisplay` is a div, not an input — Phase 28 adds a manual entry capability with a masked input)
3. Password/passphrase input on reveal page (`renderPasswordEntry` function)

**Show/hide state: independent per field (Claude's recommendation):** Each field has its own boolean state. The preview field in the generator and the applied field may differ. This is simpler to implement and avoids cross-field state coupling bugs.

### Pattern 4: Protection Panel Integration in create.ts

**Current state (Phase 24):** `passphraseGroup` is unconditional — every secret gets a passphrase. The hidden `passwordInput` is always synced to `currentPassphrase`.

**Phase 28 change:** Replace `passphraseGroup` with a collapsible protection panel. The submit handler's `password` logic changes from `passwordInput.value || undefined` to reading the active protection mode's value.

**Backward compatibility:** The API contract is unchanged — `password` in `CreateSecretSchema` is still `string().min(1).max(128).optional()`. The passphrase is still valid as the password value when passphrase mode is selected.

**Key state variables in create.ts after Phase 28:**
```typescript
let currentPassphrase: string = generatePassphrase(); // still generated on mount
let currentPassword: string = '';                      // from generator or manual entry
let protectionMode: 'password' | 'passphrase' | 'none' = 'none'; // panel is collapsed by default
```

**Submit handler reads:**
```typescript
const password = protectionMode === 'passphrase'
  ? currentPassphrase || undefined
  : protectionMode === 'password'
  ? currentPassword || undefined
  : undefined;
```

### Pattern 5: Generator Layout (Preview at Top, Controls Below)

Following the locked decision to model after 1Password/Bitwarden conventions, the recommended layout is:

```
┌─────────────────────────────────────────────────────┐
│  [PREVIEW: generated password]  [copy icon]         │
│  High · ~105 bits · ~centuries at 10B guesses/sec   │
├─────────────────────────────────────────────────────┤
│  Strength: [Low] [Medium] [High] [Max]              │
│  ☑ Uppercase  ☑ Numbers  ☑ Symbols                 │
│  ☐ Easy to say  ☐ Easy to read  ☐ Omit similar     │
├─────────────────────────────────────────────────────┤
│  [Regenerate ↻]          [Use this password →]      │
└─────────────────────────────────────────────────────┘
```

The preview is a `<div>` with `font-mono`, `select-all`, `aria-live="polite"`, `aria-label="Generated password"` — same pattern as the existing `passphraseDisplay` in Phase 24.

The "Applied password" field below the generator (shown after "Use this password") is a masked input with eye toggle, styled identically to the reveal page password input.

### Anti-Patterns to Avoid

- **Do not use `Math.random()`:** Project invariant. All randomness must come from `crypto.getRandomValues`.
- **Do not skip the rejection sampling:** Modulo bias corrupts entropy calculations. The passphrase module already demonstrates the correct pattern.
- **Do not store both modes' values simultaneously:** Switching tabs clears the other mode's value (locked decision). The hidden `passwordInput` synced in Phase 24 is replaced by reading from the active mode.
- **Do not use `innerHTML` for any content:** The security hook enforces XSS-safe DOM construction. All text is `textContent` only. Icons use `createIcon()`.
- **Do not put DOM logic in the generator module:** `password-generator.ts` must be importable in Node (Vitest server environment) and have zero DOM dependencies. Entropy/brute-force strings are returned as data, not rendered.
- **Do not add the password generator output to logs or analytics:** Zero-knowledge invariant. `captureSecretCreated` already only receives `expiresIn` and `!!password` — no password value.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Secure randomness | Custom PRNG | `crypto.getRandomValues` | Browser standard; any custom impl is vulnerable |
| Modulo bias elimination | Custom algorithm | Rejection sampling (copy from `passphrase.ts`) | Already proven, tested, and rejection probability is ~0.0000001 per char for typical charsets |
| Eye/EyeOff toggle | New component | Inline pattern from `login.ts` | Already correct, accessible, tested |
| Segmented control | External library | Plain DOM buttons with aria-pressed | No library needed for a two-option control |

**Key insight:** This phase is deliberately dependency-free. The cryptographic discipline and DOM patterns are already established in the codebase — copy and adapt rather than invent.

---

## Common Pitfalls

### Pitfall 1: Filter Application Order Causing Empty Charset

**What goes wrong:** If "Easy to say" is active alongside "Omit similar", the combined filter may leave a very small charset. If ALL characters are filtered out, `generatePassword` would loop forever.

**Why it happens:** Each filter narrows the character pool. Combining aggressive filters on small tiers (e.g., Low with all filters) can exhaust the charset.

**How to avoid:** Add a guard: if `charset.length === 0` after filter application, throw an `Error('No characters available with current filter combination')` rather than infinite loop. The UI should catch this and display "Please adjust your settings."

**Warning signs:** Low tier + Easy to say + Omit similar = very few characters remain.

### Pitfall 2: Entropy Calculation Using Pre-Filter Charset Size

**What goes wrong:** Computing entropy from the nominal charset size rather than the effective filtered charset size overstates security.

**Why it happens:** It's tempting to calculate entropy from the tier's full charset definition, then filter afterward. But if 30% of characters are filtered out, the actual entropy is lower.

**How to avoid:** Always compute `entropyBits` from `effectiveCharset.length` (after all filters are applied), not from the tier's raw charset definition.

### Pitfall 3: Passphrase Panel Regression

**What goes wrong:** Phase 24 introduced the passphrase as an unconditional security feature (every secret password-protected). Phase 28 makes protection opt-in. This is a deliberate UX change but must not break the existing API contract.

**Why it happens:** The old `passwordInput.hidden = true` and `passwordInput.value = currentPassphrase` pattern is discarded.

**How to avoid:** The submit handler must explicitly handle three states: password mode, passphrase mode, and none. When `protectionMode === 'none'`, pass `password: undefined` to `createSecret`. The confirmation page passphrase card (Phase 24) must only render when passphrase mode was active.

**Affected files:** `create.ts` submit handler, `renderConfirmationPage` call (the `currentPassphrase` 5th argument should only be passed when passphrase mode is active).

### Pitfall 4: Auto-Regenerate on Settings Change Causing Performance Issues

**What goes wrong:** Every checkbox state change triggers a full `generatePassword()` call. For High/Max tiers with rejection sampling, this is fast but runs synchronously on each `change` event.

**Why it happens:** The locked decision says "Settings changes auto-regenerate the preview immediately."

**How to avoid:** `generatePassword()` is synchronous and fast (no async/await). The rejection sampling for typical charsets of 60-90 characters runs in microseconds. No debounce needed. But verify with a timing test that it completes in < 1ms for Max tier (24 chars from ~90 char pool).

### Pitfall 5: `details/summary` + Eye Toggle Focus Trap

**What goes wrong:** The eye toggle button inside a `<details>` element may not receive focus correctly when the details element is programmatically opened.

**Why it happens:** Browser focus management with nested interactive elements inside `<details>`.

**How to avoid:** Use the same `details/summary` pattern as `createLabelField` in `create.ts` — it's already tested and works. Do not programmatically auto-focus the password input on details open; let natural tab order handle it.

### Pitfall 6: Reveal Page Label Mismatch

**What goes wrong:** The reveal page shows "Password Required" regardless of whether the protection mode used was a passphrase or password. After Phase 28, creators may use either mode — but the reveal page doesn't know which.

**Why it happens:** The `MetaResponse` from `/api/secrets/:id/meta` returns `requiresPassword: boolean` — the label "Password" is used generically.

**How to avoid:** Use the generic label "Passphrase or password required" on the reveal page input, or keep "Password Required" (since the API field is called `password` regardless of mode). The CONTEXT.md labels the reveal field "Password/passphrase input" — use the label "Passphrase or password" for the input label on the reveal page to cover both modes.

---

## Code Examples

### Entropy Calculation

```typescript
// Source: standard information theory formula — no external library

function calculateEntropy(charsetSize: number, length: number): number {
  return length * Math.log2(charsetSize);
}

function bruteForceEstimate(entropyBits: number): string {
  const GUESSES_PER_SECOND = 10_000_000_000; // 10 billion (dedicated hardware cluster)
  const secondsToBreak = Math.pow(2, entropyBits) / GUESSES_PER_SECOND;

  if (secondsToBreak < 1) return 'instantly';
  if (secondsToBreak < 60) return 'seconds';
  if (secondsToBreak < 3600) return 'minutes';
  if (secondsToBreak < 86400) return 'hours';
  if (secondsToBreak < 2592000) return 'days';
  if (secondsToBreak < 31536000) return 'months';
  if (secondsToBreak < 3153600000) return 'decades';
  if (secondsToBreak < 31536000000) return 'centuries';
  return 'eons';
}

// Display: "High · ~105 bits · ~centuries at 10B guesses/sec"
```

### Rejection-Sampling Random Character Selection

```typescript
// Source: modeled on client/src/crypto/passphrase.ts rejection-sampling pattern

function randomChar(charset: string): string {
  const n = charset.length;
  // Compute the largest multiple of n that fits in Uint32 to eliminate modulo bias
  const limit = Math.floor(0xFFFFFFFF / n) * n;
  const buf = new Uint32Array(1);
  let value: number;
  do {
    crypto.getRandomValues(buf);
    value = buf[0]!;
  } while (value >= limit);
  return charset[value % n]!;
}
```

### Segmented Control (Password | Passphrase)

```typescript
// Source: modeled on existing create.ts DOM construction patterns

function createSegmentedControl(
  options: Array<{ value: string; label: string }>,
  defaultValue: string,
  onChange: (value: string) => void,
): HTMLElement {
  const group = document.createElement('div');
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', 'Protection type');
  group.className = 'flex gap-1 p-1 rounded-lg bg-surface-raised border border-border';

  let activeValue = defaultValue;

  for (const option of options) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = option.label;
    btn.setAttribute('aria-pressed', String(option.value === defaultValue));
    btn.className = option.value === defaultValue
      ? 'flex-1 px-4 py-2 min-h-[36px] rounded-md bg-accent text-white text-sm font-semibold transition-colors cursor-pointer'
      : 'flex-1 px-4 py-2 min-h-[36px] rounded-md text-text-secondary text-sm hover:text-text-primary transition-colors cursor-pointer';

    btn.addEventListener('click', () => {
      if (activeValue === option.value) return; // already active
      activeValue = option.value;
      // Update all buttons' aria-pressed and visual state
      group.querySelectorAll('button').forEach((b) => {
        const isActive = b === btn;
        b.setAttribute('aria-pressed', String(isActive));
        // swap classes
      });
      onChange(option.value);
    });

    group.appendChild(btn);
  }

  return group;
}
```

### Tier Selector (Low/Medium/High/Max)

The tier selector uses the same segmented control pattern — four buttons in a row, styled identically. The active tier button gets solid background; inactive get ghost style.

### Checkbox Grid (Uppercase, Numbers, Symbols, Easy to say, Easy to read, Omit similar)

Standard HTML checkboxes with `<label>` elements. Use `flex flex-wrap gap-x-6 gap-y-2` for responsive wrapping. Each checkbox triggers auto-regenerate via `change` event.

```typescript
// Source: same pattern as createNotifyToggle in create.ts

function createCheckbox(id: string, label: string, checked: boolean): {
  element: HTMLElement;
  input: HTMLInputElement;
} {
  const wrapper = document.createElement('div');
  wrapper.className = 'flex items-center gap-2';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.id = id;
  checkbox.checked = checked;
  checkbox.className = 'w-4 h-4 accent-accent cursor-pointer';

  const labelEl = document.createElement('label');
  labelEl.htmlFor = id;
  labelEl.className = 'text-sm text-text-secondary cursor-pointer select-none';
  labelEl.textContent = label;

  wrapper.appendChild(checkbox);
  wrapper.appendChild(labelEl);
  return { element: wrapper, input: checkbox };
}
```

---

## Existing Code Points to Modify

### `client/src/pages/create.ts`

1. **Remove** the unconditional `passphraseGroup` section (lines 321–382) and the hidden `passwordInput` (lines 387–390).
2. **Replace** with a `createProtectionPanel()` function that returns `{ element, getPassword }` where `getPassword()` returns the active protection value or `undefined`.
3. **Update** the submit handler: `const password = protectionPanel.getPassword()`.
4. **Update** the `renderConfirmationPage` call: pass `currentPassphrase` only when passphrase mode is active.
5. **Update** the JSDoc comment at the top of the file to reflect Phase 28 changes.
6. **Remove** the `generatePassphrase` import if it moves inside the protection panel factory (or keep it — passphrase still uses it).

### `client/src/pages/reveal.ts`

1. **Modify** `renderPasswordEntry`: add eye/EyeOff toggle to `passwordInput` using the `login.ts` pattern.
2. **Update** the label: change "Password" to "Passphrase or password" to cover both creation modes.
3. **No other changes** to reveal.ts — the API contract (`verifySecretPassword`) is unchanged.

### `client/src/crypto/index.ts`

1. **Add export** for `generatePassword` from `./password-generator.js`.
2. **Keep** `generatePassphrase` export — passphrase mode still uses it.

### `client/src/__tests__/accessibility.test.ts`

1. The create page accessibility test will need updating if the protection panel changes the DOM structure. The `axe` check should pass as long as ARIA roles are correct.
2. Consider adding a specific test for the segmented control's `aria-pressed` states.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Fixed 4-word passphrase for all users (Phase 24) | Optional protection panel: Password or Passphrase (Phase 28) | Phase 28 | Protection becomes opt-in; users can choose mode |
| No eye toggle on passphrase display | Masked input with Eye/EyeOff on passphrase field | Phase 28 | Consistent UX with password fields |
| No manual password entry | Password generator + manual override via applied field | Phase 28 | Power user control |

**Deprecated by Phase 28:**
- The unconditional hidden `passwordInput.value = currentPassphrase` pattern from Phase 24. The protection panel fully replaces this.

---

## Open Questions

1. **Empty charset guard UX**
   - What we know: Certain filter combinations (Easy to say + Omit similar on Low tier) may produce an empty charset.
   - What's unclear: Should the UI disable incompatible filter combinations, or show an error after attempting generation?
   - Recommendation: Show an inline error message below the preview field ("These filter settings are incompatible — please adjust.") rather than pre-disabling checkboxes. Simpler to implement and avoids complex dependency tracking.

2. **Passphrase field type**
   - What we know: The current passphrase display is a `<div>` with `textContent`, not an `<input>`. The CONTEXT.md says "Passphrase field on create form" gets a masked input.
   - What's unclear: Does the passphrase field become a masked `<input type="password">` with eye toggle, replacing the current display div? Or is a separate entry field added?
   - Recommendation: In passphrase mode, render the generated passphrase in a masked `<input type="password">` (pre-filled, editable) with eye toggle, plus Regenerate and Copy buttons. This gives both display and manual override ability. The `<div>` display from Phase 24 is replaced.

3. **Confirmation page behavior when protection mode is "none"**
   - What we know: Phase 24 always passed `currentPassphrase` to `renderConfirmationPage`. Phase 28 makes protection opt-in.
   - What's unclear: When no protection is set, do we still show the two-channel security guidance? No — the two-channel guidance only makes sense when a passphrase/password was set.
   - Recommendation: Pass `undefined` for the passphrase argument when `protectionMode === 'none'`. The existing `if (passphrase)` guard in `confirmation.ts` already handles this correctly.

---

## Sources

### Primary (HIGH confidence)

- `/Users/ourcomputer/Github-Repos/secureshare/client/src/pages/login.ts` — Eye/EyeOff toggle implementation (lines 107–129): the established pattern to reuse
- `/Users/ourcomputer/Github-Repos/secureshare/client/src/crypto/passphrase.ts` — rejection-sampling pattern with `crypto.getRandomValues`; the exact model for `password-generator.ts`
- `/Users/ourcomputer/Github-Repos/secureshare/client/src/pages/create.ts` — full create page structure, all DOM patterns, progressive enhancement approach
- `/Users/ourcomputer/Github-Repos/secureshare/client/src/pages/reveal.ts` — `renderPasswordEntry` function to modify
- `/Users/ourcomputer/Github-Repos/secureshare/shared/types/api.ts` — `password: z.string().min(1).max(128).optional()` confirms no schema change needed
- `/Users/ourcomputer/Github-Repos/secureshare/client/src/components/expiration-select.ts` — `ExpirationSelectResult` accessor pattern `{ element, getValue }` to follow for protection panel
- Lucide 0.564.0 available icons verified: `Eye`, `EyeOff`, `RefreshCw`, `Dices`, `Copy`, `Check`, `Sliders`, `SlidersHorizontal` — all confirmed FOUND via direct CJS inspection

### Secondary (MEDIUM confidence)

- Standard information theory: `entropyBits = length * log2(charsetSize)` — textbook formula
- Brute force time estimate at 10B guesses/sec — standard reference rate used by password strength meters (Bitwarden, 1Password documentation patterns); reasonable for planning purposes

### Tertiary (LOW confidence)

- Specific phonetic charset for "Easy to say" — not authoritatively defined; implementation team should define based on phonetic clarity criteria
- Exact "ambiguous character" list for "Easy to read" beyond the CONTEXT.md examples (1/l/I/|/0/O/B8/S5) — extend at implementer's discretion

---

## Plan Structure Recommendation

Based on this research, Phase 28 should be broken into **3 plans**:

**Plan 28-01 — Password Generator Module (TDD)**
- Write `client/src/crypto/password-generator.ts` with full unit tests
- Export from `crypto/index.ts`
- No DOM code in this plan; pure business logic
- Tests: tier configurations, entropy calculation, charset filtering, rejection sampling, empty charset guard, brute force label output

**Plan 28-02 — Create Page Protection Panel**
- Replace passphrase section with collapsible protection panel
- Segmented control (Password | Passphrase)
- Password tab: generator UI (preview, tier selector, checkboxes, filters, Regenerate, Use this password, masked applied field + eye toggle)
- Passphrase tab: masked input pre-filled with generated passphrase + eye toggle + Regenerate + Copy
- Update submit handler to read from active mode
- Update `renderConfirmationPage` call

**Plan 28-03 — Reveal Page + Accessibility + Tests**
- Add eye/EyeOff toggle to reveal page password entry form
- Update reveal page label to "Passphrase or password"
- Update `accessibility.test.ts` for new create page DOM structure
- Add axe-core check for the protection panel
- Human UAT checkpoint

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies; all tools verified in codebase
- Architecture: HIGH — patterns directly copied from existing, proven code
- Pitfalls: HIGH — identified from direct codebase inspection (Phase 24 regression risk, charset empty state, filter interaction)
- Entropy math: HIGH — standard information theory formula

**Research date:** 2026-02-21
**Valid until:** Stable (no fast-moving dependencies; all patterns are from the local codebase)

# Phase 24: EFF Diceware Passphrase Generator - Research

**Researched:** 2026-02-20
**Domain:** Client-side cryptographic passphrase generation, UI/UX state flow, wordlist bundling
**Confidence:** HIGH

## Summary

Phase 24 is a pure client-side feature — no server changes, no database migrations, no new API endpoints. The EFF large word list (7,776 words = 6^5) is bundled as a TypeScript array within the crypto module. On page load, a 4-word passphrase is generated synchronously using `crypto.getRandomValues` with rejection sampling for correct uniform distribution. The passphrase is the password protection mechanism: it auto-fills the password field and is sent to the server as the Argon2id-hashed secret password when the form submits.

The confirmation page receives the passphrase as a new parameter to `renderConfirmationPage` and renders a separate copy button alongside the existing link copy button. A two-channel guidance block instructs the user to send the link via one channel and the passphrase via a separate channel — following the established UX pattern used by Yopass, OneTimeSecret, and similar tools.

The wordlist is 83.5 KB raw and ~25 KB gzip-compressed. Bundled within the `create.ts` dynamic import chunk, the compression overhead is acceptable. External fetching would conflict with the strict `connectSrc: 'self'` CSP policy and introduce first-generate latency.

**Primary recommendation:** Implement a self-contained `client/src/crypto/passphrase.ts` module with the EFF wordlist as a TypeScript string array constant and a `generatePassphrase(wordCount?: number): string` function using rejection-sampled `crypto.getRandomValues`. Modify `create.ts` to auto-generate and display the passphrase on mount, auto-fill the password field, and pass the passphrase to `renderConfirmationPage`. Modify `confirmation.ts` to accept and display the passphrase with a separate copy button and two-channel guidance.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PASS-01 | User can generate a 4-word EFF Diceware passphrase when creating a secret (generated client-side via crypto.getRandomValues, enabled by default) | EFF large wordlist (7,776 words), rejection-sampled Uint32 selection, auto-generated on create page mount |
| PASS-02 | User can regenerate the passphrase with a single click before submitting the form | Regenerate button calls `generatePassphrase()` and updates the displayed passphrase and the hidden password input — textarea content is untouched |
| PASS-03 | User can copy the passphrase independently from the share link on the confirmation page | `renderConfirmationPage` receives a new `passphrase` parameter; a second `createCopyButton()` call renders a dedicated passphrase copy button |
| PASS-04 | Confirmation page displays two-channel security guidance (share link via one channel, passphrase via another) | A styled guidance block below the two copy sections explains the two-channel model (text only, no new library needed) |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Web Crypto API (`crypto.getRandomValues`) | Browser built-in | Cryptographically secure random word selection | Project invariant — only `crypto.subtle` and `crypto.getRandomValues` may be used for random generation. No `Math.random`. |
| EFF Large Wordlist | 2016 release (stable) | 7,776-word source for diceware generation | Official EFF list; most widely used; only list with prefix-free property preventing dictionary attacks on partial words |
| TypeScript string array | N/A (inline constant) | Wordlist storage format | Bundles with create.ts chunk; no extra HTTP request; gzips well; no JSON parse overhead |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide` (RefreshCw) | Already installed `^0.564.0` | Regenerate passphrase button icon | `RefreshCw` exists in installed Lucide version; use `createIcon(RefreshCw, ...)` via existing icon system |
| `lucide` (KeyRound) | Already installed | Optional: passphrase section header icon | Semantic icon indicating the passphrase is a security key |
| `createCopyButton` | Existing component | Copy passphrase on confirmation page | Reuse the existing copy-button component — no new copy logic needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline TS array | Dynamic JSON import via Vite | JSON import adds one extra HTTP request before first generation; latency visible on slow connections; inline is faster and simpler |
| Inline TS array | `/public/wordlist.json` + `fetch()` | `fetch()` would be blocked by `connectSrc: 'self'` if served from same origin — actually allowed, but still adds latency and complexity |
| Rejection sampling | Simple modulo (`value % 7776`) | Modulo introduces 0.00006% bias (2560 values out of 4.29B over-represented). For a security product, rejection sampling is technically correct and costs near zero (expected 0.000001 extra iterations per word). |
| EFF large wordlist | EFF short wordlist | Short list uses 4 dice (1296 words, ~10.3 bits/word); 4 words = 41.2 bits entropy. Large list gives 51.7 bits for 4 words — meaningfully stronger. |

**Installation:** No new packages required. Web Crypto API is a browser built-in. Wordlist is a static constant.

---

## Architecture Patterns

### Recommended Project Structure
```
client/src/
├── crypto/
│   ├── passphrase.ts        # NEW: EFF wordlist constant + generatePassphrase()
│   └── index.ts             # Existing barrel — export generatePassphrase from here
├── pages/
│   ├── create.ts            # MODIFY: add passphrase UI section, auto-fill password
│   └── confirmation.ts      # MODIFY: add passphrase parameter, copy button, guidance
```

### Pattern 1: Passphrase Module (`crypto/passphrase.ts`)
**What:** Self-contained module with the 7,776-word EFF large wordlist as a TypeScript string array constant and a `generatePassphrase` function that uses rejection-sampled `crypto.getRandomValues`.

**When to use:** Called from `create.ts` on mount and on regenerate button click.

**Example:**
```typescript
// client/src/crypto/passphrase.ts

/**
 * EFF Large Wordlist (7,776 words = 6^5 combinations).
 * Source: https://www.eff.org/files/2016/07/18/eff_large_wordlist.txt
 * Published 2016. Words ordered by dice roll (11111 = index 0, 66666 = index 7775).
 * Prefix-free property: no word is a prefix of another word.
 */
const EFF_WORDS: string[] = [
  'abacus', 'abdomen', 'abdominal', /* ... all 7,776 words ... */ 'zoom'
];

const WORD_COUNT = 7776; // 6^5 — must equal EFF_WORDS.length

/**
 * Return a single unbiased random index in [0, WORD_COUNT) using rejection sampling.
 *
 * Uses crypto.getRandomValues to generate a Uint32 value. Values >= cutoff are
 * rejected to prevent modulo bias. With WORD_COUNT=7776, rejection probability
 * is ~0.0000006 (2560 out of 4,294,967,296), so the loop almost never iterates.
 *
 * Invariant: only crypto.getRandomValues may be used for randomness (no Math.random).
 */
function getUnbiasedIndex(): number {
  const cutoff = 2 ** 32 - (2 ** 32 % WORD_COUNT); // 4294964736
  const buf = new Uint32Array(1);
  while (true) {
    crypto.getRandomValues(buf);
    if (buf[0] < cutoff) {
      return buf[0] % WORD_COUNT;
    }
  }
}

/**
 * Generate an EFF Diceware passphrase.
 *
 * @param wordCount - Number of words (default 4). Phase 24 uses 4 words (51.7 bits entropy).
 *                    Pro-04 (v5.0) uses 6 words (77.5 bits entropy).
 * @returns Space-separated passphrase string (e.g. "abacus zoning climb velvet")
 */
export function generatePassphrase(wordCount = 4): string {
  const words: string[] = [];
  for (let i = 0; i < wordCount; i++) {
    words.push(EFF_WORDS[getUnbiasedIndex()]);
  }
  return words.join(' ');
}
```

**Entropy note:** 4 words = log₂(7776⁴) = 51.7 bits. Not sufficient for long-term account passwords but appropriate for one-time ephemeral secrets where the AES-256-GCM key in the URL fragment provides the primary protection. The passphrase adds a second factor (two-channel delivery), not the sole protection.

### Pattern 2: Create Page — Passphrase UI Section
**What:** A visible passphrase section appears above (or replacing) the existing "Advanced options" section. The passphrase is displayed in a readable block with a Regenerate button and a Copy button. The hidden password `<input>` is auto-filled whenever the passphrase changes.

**Critical integration point:** The existing `passwordInput` (currently inside the `<details>` element) becomes the "source of truth" for the form submission. When a passphrase is generated, `passwordInput.value` is set to the passphrase string. The existing submit handler already reads `passwordInput.value` to send as the `password` field — no changes needed to the submission logic, just to how the password field is populated.

**Example (structural):**
```typescript
// In create.ts — passphrase display section added to form

import { generatePassphrase } from '../crypto/passphrase.js';
import { RefreshCw } from 'lucide';

// State
let currentPassphrase = generatePassphrase(); // generate on mount

// Build passphrase display
const passphraseSection = document.createElement('div');
passphraseSection.className = 'space-y-2';

const passphraseLabel = document.createElement('label');
passphraseLabel.textContent = 'Access passphrase';
passphraseLabel.className = 'block text-sm font-medium text-text-secondary';

const passphraseDisplay = document.createElement('div');
passphraseDisplay.className =
  'w-full px-3 py-3 rounded-lg bg-surface-raised text-text-primary font-mono text-sm select-all border border-border';
passphraseDisplay.textContent = currentPassphrase;

// Sync password input (hidden in DOM) with passphrase
passwordInput.value = currentPassphrase;

// Regenerate button
const regenerateBtn = document.createElement('button');
regenerateBtn.type = 'button';
// ... styling ...
regenerateBtn.appendChild(createIcon(RefreshCw, { size: 'sm' }));
const regenLabel = document.createElement('span');
regenLabel.textContent = 'New passphrase';
regenerateBtn.appendChild(regenLabel);

regenerateBtn.addEventListener('click', () => {
  currentPassphrase = generatePassphrase();
  passphraseDisplay.textContent = currentPassphrase;
  passwordInput.value = currentPassphrase;
});

// Copy button (reuse createCopyButton)
const copyPassphraseBtn = createCopyButton(() => currentPassphrase, 'Copy');
```

**Note on "Advanced options" section:** The passphrase section replaces the visible password field. The raw `passwordInput` element still exists in the DOM but is hidden (`type="hidden"` or visually hidden). The "Advanced options" collapsible section that previously exposed `passwordInput` should be removed or repurposed. This is a design decision for the planner to formalize.

### Pattern 3: Confirmation Page — Passphrase Card + Two-Channel Guidance
**What:** `renderConfirmationPage` receives a new `passphrase` parameter. A second card (below the existing share URL card) displays the passphrase with a dedicated copy button. A guidance block explains two-channel delivery.

**Updated function signature:**
```typescript
export function renderConfirmationPage(
  container: HTMLElement,
  shareUrl: string,
  expiresAt: string,
  label?: string,
  passphrase?: string,  // NEW
): void
```

**State flow in `create.ts`:**
```typescript
// After successful secret creation:
renderConfirmationPage(container, shareUrl, response.expiresAt, label, currentPassphrase);
```

**Passphrase card on confirmation:**
```typescript
if (passphrase) {
  const passphraseCard = document.createElement('div');
  passphraseCard.className =
    'p-6 rounded-lg border border-border bg-surface/80 backdrop-blur-md shadow-lg space-y-4 text-left';

  const passphraseLabel = document.createElement('span');
  passphraseLabel.className = 'block text-sm text-text-muted mb-2';
  passphraseLabel.textContent = 'Share this passphrase separately:';
  passphraseCard.appendChild(passphraseLabel);

  const passphraseDisplay = document.createElement('div');
  passphraseDisplay.className =
    'w-full px-3 py-3 rounded-lg bg-surface-raised text-text-secondary text-sm font-mono select-all';
  const code = document.createElement('code');
  code.textContent = passphrase;  // NEVER innerHTML
  passphraseDisplay.appendChild(code);
  passphraseCard.appendChild(passphraseDisplay);

  const copyBtn = createCopyButton(() => passphrase, 'Copy Passphrase');
  passphraseCard.appendChild(copyBtn);

  wrapper.appendChild(passphraseCard);
}
```

**Two-channel guidance block:**
```typescript
if (passphrase) {
  const guidance = document.createElement('div');
  guidance.className = 'px-4 py-3 rounded-lg bg-surface/80 border border-border text-sm text-text-secondary space-y-1';
  // Heading
  const guidanceHeading = document.createElement('p');
  guidanceHeading.className = 'font-semibold text-text-primary';
  guidanceHeading.textContent = 'Two-channel security';
  // Body
  const guidanceBody = document.createElement('p');
  guidanceBody.textContent =
    'For maximum security, share the link and passphrase through separate channels — for example, send the link by email and the passphrase by text message.';
  guidance.appendChild(guidanceHeading);
  guidance.appendChild(guidanceBody);
  wrapper.appendChild(guidance);
}
```

### Anti-Patterns to Avoid
- **Using `Math.random` for word selection:** Violates the project's hard invariant. Only `crypto.getRandomValues` may be used for randomness.
- **Fetching the wordlist at runtime:** The CSP `connectSrc: 'self'` allows same-origin fetches, but the extra HTTP request adds latency before the first passphrase appears. Bundle it.
- **innerHTML for passphrase display:** Never use `innerHTML` for user-visible content derived from generated values, even if generated internally. Use `textContent` throughout.
- **Skipping rejection sampling:** The modulo bias for n=7776 is 0.00006% per word — negligible in practice. However, this is a security product and `generatePassphrase` lives in the `crypto/` module. Implement rejection sampling to maintain correctness. The performance cost is effectively zero (rejection probability ~0.0000006).
- **Mutating the textarea when regenerating:** PASS-02 explicitly states regeneration must not lose secret content. Never touch `textarea.value` on regenerate.
- **Using `innerHTML` for the two-channel guidance:** Build with DOM API as per project convention.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Copy to clipboard with feedback | Custom clipboard logic | `createCopyButton` (existing component) | Already handles `navigator.clipboard`, fallback, `showToast`, icon swap, accessibility |
| Wordlist HTTP delivery | Serving from `/public` and fetching | Inline TS array constant | No new HTTP request; no fetch error handling; CSP `connectSrc: 'self'` is fine but complexity is unnecessary |
| Icon for regenerate | Custom SVG | `RefreshCw` from lucide via `createIcon` | Consistent with existing icon system; tree-shaken by Vite |

**Key insight:** The copy-button component already handles all clipboard edge cases and provides toast feedback. Reuse it verbatim for the passphrase copy on the confirmation page.

---

## Common Pitfalls

### Pitfall 1: Passphrase State Lost on Navigation
**What goes wrong:** The passphrase is generated in `create.ts` but the confirmation page is a state-based render (not a URL navigation). If the passphrase is not passed as a parameter, it cannot be reconstructed on the confirmation page.
**Why it happens:** The key stays in URL fragment memory; the passphrase is in JS closure only.
**How to avoid:** Pass `currentPassphrase` as a parameter to `renderConfirmationPage`. The updated signature is `renderConfirmationPage(container, shareUrl, expiresAt, label?, passphrase?)`.
**Warning signs:** The passphrase copy button on the confirmation page shows an empty or undefined value.

### Pitfall 2: Regenerate Clears Secret Text
**What goes wrong:** A naive regenerate handler rebuilds the form or container, losing `textarea.value`.
**Why it happens:** Mistakenly treating regenerate as a page re-render instead of a targeted state update.
**How to avoid:** Regenerate only updates: (1) `currentPassphrase` variable, (2) `passphraseDisplay.textContent`, (3) `passwordInput.value`. Never touch `textarea`, `expirationSelect`, or `labelInput`.
**Warning signs:** User fills in a secret, clicks regenerate, text disappears.

### Pitfall 3: Password Field Collision — User-Typed vs Auto-Generated
**What goes wrong:** If the raw `passwordInput` is still visible in the DOM (inside "Advanced options"), a user might type a different password there, conflicting with the auto-generated passphrase in `passwordInput.value`.
**Why it happens:** Old "Advanced options" section left in place alongside new passphrase section.
**How to avoid:** Remove the `passwordInput` from the "Advanced options" collapsible or hide the entire "Advanced options" section. The passphrase section is the new primary password UI.
**Warning signs:** `passwordInput.value` differs from `currentPassphrase` at submit time.

### Pitfall 4: Accessibility Violations on Passphrase Elements
**What goes wrong:** The passphrase display `<div>` is not associated with a label, or the regenerate button lacks an accessible name.
**Why it happens:** Copy-paste of non-semantic container elements.
**How to avoid:** Label must have `htmlFor` linked to an `id` on the passphrase display, OR use `aria-label`. The regenerate button must have visible text or `aria-label`. Run the existing axe accessibility tests to catch violations.
**Warning signs:** `vitest-axe` reports missing label violations in accessibility tests.

### Pitfall 5: Wordlist Array Causes TypeScript Compile Time Issues
**What goes wrong:** A 7,776-element inline string array literal can slow TypeScript language server and type checking.
**Why it happens:** TS analyzes literal types for each element.
**How to avoid:** Type the array as `string[]` (not `readonly ['abacus', 'abdomen', ...]`). Use a simple `const EFF_WORDS: string[] = ['...']` declaration. Do not use `as const` on the array itself.
**Warning signs:** `tsc` takes noticeably longer; IDE becomes slow when `passphrase.ts` is open.

### Pitfall 6: `crypto.getRandomValues` in Server Test Environment
**What goes wrong:** Unit tests for `passphrase.ts` run in the `node` test environment, which does not expose `window.crypto` the same way as happy-dom. `crypto.getRandomValues` is available as `globalThis.crypto.getRandomValues` in Node 19+.
**Why it happens:** The client test project uses `happy-dom`; `crypto` is available there. If a server test inadvertently imports passphrase.ts, it may fail.
**How to avoid:** Place `passphrase.ts` tests in `client/src/crypto/__tests__/` (runs in happy-dom). Never import passphrase from server code.
**Warning signs:** `ReferenceError: crypto is not defined` in test output.

---

## Code Examples

Verified patterns from the project codebase and official sources:

### Unbiased Random Word Index (crypto.getRandomValues)
```typescript
// Rejection sampling — unbiased uniform selection from [0, WORD_COUNT)
// Source: Project invariant (CLAUDE.md) + crypto.getRandomValues MDN docs
function getUnbiasedIndex(): number {
  const cutoff = 2 ** 32 - (2 ** 32 % WORD_COUNT); // 4294964736 for n=7776
  const buf = new Uint32Array(1);
  while (true) {
    crypto.getRandomValues(buf);
    if (buf[0] < cutoff) {
      return buf[0] % WORD_COUNT;
    }
  }
}
```

### Passphrase Generation
```typescript
// Source: EFF Diceware model (eff.org/dice) adapted for browser
export function generatePassphrase(wordCount = 4): string {
  const words: string[] = [];
  for (let i = 0; i < wordCount; i++) {
    words.push(EFF_WORDS[getUnbiasedIndex()]);
  }
  return words.join(' ');
}
```

### Reusing createCopyButton (existing pattern from confirmation.ts)
```typescript
// Source: client/src/components/copy-button.ts + client/src/pages/confirmation.ts
import { createCopyButton } from '../components/copy-button.js';

// For passphrase copy button on confirmation page:
const copyPassphraseBtn = createCopyButton(() => passphrase, 'Copy Passphrase');
```

### Syncing Hidden Password Input with Passphrase
```typescript
// Pattern: Auto-fill hidden password input when passphrase changes
// Regenerate click handler:
regenerateBtn.addEventListener('click', () => {
  currentPassphrase = generatePassphrase();
  passphraseDisplay.textContent = currentPassphrase;
  passwordInput.value = currentPassphrase;  // keeps submit handler unchanged
});
```

### Updated renderConfirmationPage Call (in create.ts)
```typescript
// Source: client/src/pages/create.ts (existing call, extended with passphrase)
renderConfirmationPage(container, shareUrl, response.expiresAt, label, currentPassphrase);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual password entry in "Advanced options" | Auto-generated Diceware passphrase (enabled by default) | Phase 24 | Users get strong password protection without effort; two-channel delivery adds real security |
| 4-word diceware (Phase 24 default) | 6-word diceware for Pro (PRO-04, v5.0) | v5.0 | `generatePassphrase(6)` — the `wordCount` parameter is already designed for this upgrade |
| `Math.random` for demos | `crypto.getRandomValues` with rejection sampling | Project invariant from Phase 1 | Cryptographically secure; no training data leakage |

**Deprecated/outdated:**
- Manual password entry in "Advanced options": Replaced by auto-generated passphrase. The raw `passwordInput` element remains as an internal mechanism; the visible UI changes.

---

## Open Questions

1. **What happens to the "Advanced options" section?**
   - What we know: It currently contains only the password input field.
   - What's unclear: Should it be removed entirely? Repurposed? Left as a "manual override" for users who don't want the auto-generated passphrase?
   - Recommendation: **Remove the "Advanced options" section from the DOM.** Replace it with the passphrase section (always visible). If the planner wants to offer a "no passphrase" escape hatch, that's a scope decision — REQUIREMENTS.md does not mention it. Keep it simple.

2. **Passphrase parameter: required or optional in renderConfirmationPage?**
   - What we know: All secrets created via the Phase 24 UI will have a passphrase. But `renderConfirmationPage` is called from `create.ts`, which could have pre-Phase-24 test suites calling it without the passphrase parameter.
   - What's unclear: Do any existing tests call `renderConfirmationPage` directly?
   - Recommendation: Make `passphrase` **optional** (`passphrase?: string`) so that existing test calls without the parameter continue to work. The passphrase card and guidance only render when `passphrase` is truthy.

3. **Wordlist array: commit words inline or generate from source?**
   - What we know: The raw wordlist is 106 KB; words-only is 83.5 KB; gzipped ~25 KB.
   - What's unclear: Should the wordlist be committed verbatim or generated via a build script?
   - Recommendation: **Commit verbatim** as a TypeScript string array in `passphrase.ts`. The wordlist is stable (published 2016, no changes). A build-time generation script is unnecessary complexity.

4. **Should the passphrase section display the hint about two-channel on the CREATE page?**
   - What we know: PASS-04 places two-channel guidance on the CONFIRMATION page only.
   - What's unclear: Should there also be a short hint on the create page (e.g., "You'll share this via a separate channel from the link")?
   - Recommendation: **No, follow the requirements exactly.** Two-channel guidance belongs only on the confirmation page (PASS-04). A hint on the create page is out of scope.

---

## Key Architectural Decisions (For Planner)

These decisions were reached during research and should be codified in the plan:

1. **No new npm packages.** The wordlist is bundled as an inline TypeScript array. Web Crypto API is the runtime. `createCopyButton` and `createIcon` are reused.

2. **Passphrase IS the password protection.** The auto-generated passphrase auto-fills the hidden `passwordInput`. The server receives it as the `password` field. The recipient must enter it to view the secret. This gives every secret Argon2id password protection by default without user friction.

3. **"Advanced options" section is removed.** Its only content was the password input, which is now managed by the passphrase system. Removing it simplifies the UI.

4. **Passphrase module lives in `client/src/crypto/`** to signal it is security-sensitive and subject to the same invariants (no `Math.random`, no third-party crypto). It is not a UI component.

5. **`renderConfirmationPage` signature gains optional `passphrase` parameter** as the last argument to preserve backward compatibility with existing tests.

6. **No server changes.** The server already handles the `password` field via Argon2id hashing. The passphrase is just a stronger, auto-generated value for that same field.

7. **Accessibility:** The passphrase display on create page needs a `<label>` with `htmlFor`. The regenerate button needs visible text (not just an icon). The passphrase display on confirmation needs proper labeling. Run `vitest-axe` tests to verify.

8. **Testing:** New unit tests for `generatePassphrase` should live in `client/src/crypto/__tests__/passphrase.test.ts` (happy-dom environment). Tests should verify: correct word count, words are from EFF list, uniqueness across calls (probabilistic), and word format (lowercase, no spaces within a word).

---

## Sources

### Primary (HIGH confidence)
- [EFF Large Wordlist](https://www.eff.org/files/2016/07/18/eff_large_wordlist.txt) — Downloaded and analyzed: 7,776 words, tab-separated dice-roll to word mapping, ordered from 11111 (abacus) to 66666 (zoom)
- [EFF Diceware Page](https://www.eff.org/dice) — Three wordlists available; large list = 5 dice = 7,776 words; 6-word passphrase = ~2^77 combinations
- MDN Web Docs: `crypto.getRandomValues` — Returns `undefined`, fills typed array in-place; available in all modern browsers and Node 19+
- `client/src/components/copy-button.ts` — Existing component (verified by reading); handles clipboard + toast + icon swap
- `client/src/pages/create.ts` — Current create page implementation (verified by reading); password field is `passwordInput.value` inside "Advanced options" `<details>`
- `client/src/pages/confirmation.ts` — Current confirmation page (verified by reading); currently takes 4 parameters, needs 5th for passphrase
- `server/src/middleware/security.ts` — CSP policy (verified by reading); `connectSrc: 'self'` — external wordlist fetch would require adding external domain

### Secondary (MEDIUM confidence)
- [emilbayes/eff-diceware-passphrase](https://github.com/emilbayes/eff-diceware-passphrase) — Reference npm implementation; confirms 7,776-word list as JSON; gzipped bundle ~34.6 KB; words-only JSON ~25 KB gzipped — our inline approach matches this size
- [Yopass README](https://github.com/jhaals/yopass) — "It's always best to send all context except the password over another channel" — confirms two-channel as established pattern
- [diceware.rempe.us](https://diceware.rempe.us/) — Reference browser implementation using `crypto.getRandomValues` for virtual dice rolling

### Tertiary (LOW confidence)
- Wikipedia: Diceware — 12.92 bits entropy per word (log₂(6^5)); 4 words = 51.7 bits; 6 words = 77.5 bits. Matches our calculation.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — No new libraries; wordlist is official EFF 2016 release; `crypto.getRandomValues` is project invariant
- Architecture: HIGH — Verified by reading all affected files (`create.ts`, `confirmation.ts`, `copy-button.ts`, `security.ts`); no surprises
- Pitfalls: HIGH — Identified from code reading (passphrase state, regenerate bug, password field collision, accessibility, wordlist compile time)
- Wordlist size: HIGH — Downloaded and measured directly (83.5 KB raw, 25.3 KB gzipped)
- Entropy calculation: HIGH — Verified mathematically (log₂(7776) = 12.92 bits/word)

**Research date:** 2026-02-20
**Valid until:** 2026-08-20 (stable domain — EFF wordlist hasn't changed since 2016; Web Crypto API is stable)

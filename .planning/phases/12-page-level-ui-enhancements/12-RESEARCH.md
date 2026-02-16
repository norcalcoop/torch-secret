# Phase 12: Page-Level UI Enhancements - Research

**Researched:** 2026-02-16
**Domain:** Vanilla TypeScript UI components, Lucide icons, Web Share API, toast notifications, terminal-style code blocks
**Confidence:** HIGH

## Summary

Phase 12 enhances three existing pages with visual/UX improvements: the create page gets a 4-step "How It Works" with Lucide icons and a "Why Trust Us?" card grid; the confirmation page gets a prominent share URL block with copy-to-clipboard toast and native Web Share API; the reveal page gets a terminal-style code block and a destruction confirmation badge. All changes are to existing vanilla TypeScript page files -- no new routes, no new API endpoints, no framework additions.

The codebase already has all required infrastructure: Lucide v0.564.0 with `createIcon()` utility, Tailwind CSS 4.x with OKLCH semantic tokens, a `createCopyButton()` component, and the page rendering pattern (imperative DOM via `document.createElement`). New work involves adding a toast notification system (no library needed -- ~30 lines vanilla JS), integrating `navigator.share()` with progressive enhancement, restructuring existing sections, and adding new CSS custom properties for terminal styling.

**Primary recommendation:** Build a reusable `showToast()` utility and a terminal code-block component as shared modules. Modify existing page files in-place. No new dependencies required.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Copy feedback via toast notification (small snackbar slides in confirming "Link copied to clipboard")
- Include both copy-to-clipboard AND native Web Share API button (on supported devices, fallback gracefully)
- "How It Works" uses 4 steps: Paste, Encrypt, Share, Destroy -- each with a descriptive Lucide icon
- "Why Trust Us?" displays as a 4-card icon grid (zero-knowledge, open source, no accounts, AES-256-GCM) -- each card with icon + short label + brief description
- Vertical scroll with max height (~300px) for long secrets -- keeps page compact
- Muted green-gray text (soft sage/green-gray, not bright phosphor green) -- modern, easier on the eyes
- Terminal header bar with copy button
- Destroyed badge appears ABOVE the secret terminal block -- first thing the user sees
- Reassuring tone: "This secret has been permanently deleted from our servers" -- professional, trust-building
- Revisiting a consumed URL shows a distinct expired state: "This secret has already been viewed and destroyed" -- different from generic not-found

### Claude's Discretion
- Share URL display approach (full URL visible, truncated, wrapping behavior)
- Share URL block visual prominence and page hierarchy on confirmation page
- Trust sections placement relative to form (below vs alongside)
- Textarea "Encrypted in your browser" indicator visual weight (subtle vs prominent)
- Terminal header bar style (minimal vs macOS dots aesthetic)
- Terminal line wrapping vs horizontal scroll behavior
- Whether secret text stays visible or fades after destruction
- Destroyed badge placement relative to secret

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| lucide | ^0.564.0 | SVG icon data for all new icons | Already used throughout app; `createIcon()` utility exists |
| tailwindcss | ^4.1.18 | Utility-first styling for all new components | Already powers all existing UI |
| vite | ^7.3.1 | Dev server and build tooling | Already configured |
| vitest | ^4.0.18 | Testing framework | Already configured with happy-dom for client tests |

### Supporting (No New Dependencies)
| Technology | Purpose | When to Use |
|------------|---------|-------------|
| Web Share API (`navigator.share`) | Native OS sharing on supported devices | Confirmation page share button |
| Clipboard API (`navigator.clipboard.writeText`) | Copy-to-clipboard | Already used in `createCopyButton` |
| CSS custom properties | Terminal color tokens | New `--ds-color-terminal-*` tokens in styles.css |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom toast | tailwind-toast npm package | Adds dependency for ~30 lines of code; custom is lighter |
| Custom terminal block | highlight.js / prism.js | Overkill -- secrets are plaintext, not syntax-highlighted code |

**Installation:** No new packages needed. All dependencies already installed.

## Architecture Patterns

### Files to Modify
```
client/src/
├── styles.css                    # Add terminal color tokens, toast styles
├── components/
│   ├── toast.ts                  # NEW: showToast() utility
│   ├── terminal-block.ts         # NEW: terminal code block component
│   ├── copy-button.ts            # MODIFY: add toast notification on copy
│   └── share-button.ts           # NEW: Web Share API button with fallback
├── pages/
│   ├── create.ts                 # MODIFY: 4-step How It Works, Why Trust Us, textarea indicator
│   ├── confirmation.ts           # MODIFY: prominent URL block, share button, toast copy
│   ├── reveal.ts                 # MODIFY: terminal block, destruction badge
│   └── error.ts                  # MODIFY: add "already viewed" error type
```

### Pattern 1: Toast Notification System
**What:** A fixed-position container at bottom-center that shows transient messages
**When to use:** After copy-to-clipboard and share actions
**Example:**
```typescript
// client/src/components/toast.ts
// Singleton container appended to document.body on first use

let toastContainer: HTMLElement | null = null;

function ensureContainer(): HTMLElement {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.setAttribute('aria-live', 'polite');
    toastContainer.setAttribute('aria-atomic', 'true');
    toastContainer.className =
      'fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none';
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

export function showToast(message: string, durationMs = 3000): void {
  const container = ensureContainer();

  const toast = document.createElement('div');
  toast.className =
    'px-4 py-2 rounded-lg bg-surface-raised text-text-primary text-sm shadow-lg ' +
    'border border-border pointer-events-auto ' +
    'animate-[toast-in_200ms_ease-out] opacity-100 transition-opacity';
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('opacity-0');
    toast.addEventListener('transitionend', () => toast.remove());
  }, durationMs);
}
```

### Pattern 2: Progressive Enhancement for Web Share API
**What:** Show native share button only when `navigator.share` is available
**When to use:** Confirmation page -- alongside copy button
**Example:**
```typescript
// Feature detection -- no try/catch needed for detection
function canNativeShare(): boolean {
  return typeof navigator !== 'undefined'
    && typeof navigator.share === 'function';
}

// Create share button (only if supported)
export function createShareButton(url: string, title: string): HTMLButtonElement | null {
  if (!canNativeShare()) return null;

  const button = document.createElement('button');
  button.type = 'button';
  // ... styling ...

  button.addEventListener('click', async () => {
    try {
      await navigator.share({ title, url });
    } catch (err) {
      // User cancelled or share failed -- AbortError is normal for cancel
      if (err instanceof Error && err.name !== 'AbortError') {
        showToast('Sharing failed. Try copying the link instead.');
      }
    }
  });

  return button;
}
```

### Pattern 3: Terminal Code Block Component
**What:** Reusable dark terminal-style display with header bar and copy button
**When to use:** Reveal page for displaying decrypted secret text
**Example:**
```typescript
// client/src/components/terminal-block.ts
export function createTerminalBlock(
  content: string,
  options?: { headerTitle?: string }
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'rounded-lg border border-border overflow-hidden';

  // Header bar
  const header = document.createElement('div');
  header.className =
    'flex items-center justify-between px-3 py-2 bg-surface-raised border-b border-border';

  const title = document.createElement('span');
  title.className = 'text-xs text-text-muted font-mono';
  title.textContent = options?.headerTitle ?? 'secret.txt';

  // Copy button in header (smaller, inline style)
  const copyBtn = createCopyButton(() => content, 'Copy');
  // ... compact styling overrides ...

  header.appendChild(title);
  header.appendChild(copyBtn);

  // Content area -- uses textContent for XSS safety
  const pre = document.createElement('pre');
  pre.className =
    'p-4 bg-terminal text-terminal font-mono text-sm ' +
    'whitespace-pre-wrap break-words max-h-[300px] overflow-y-auto';
  pre.textContent = content; // NEVER innerHTML

  wrapper.appendChild(header);
  wrapper.appendChild(pre);
  return wrapper;
}
```

### Pattern 4: Textarea State Indicator
**What:** An inline indicator below the textarea that appears when content is present
**When to use:** Create page -- shows "Encrypted in your browser" with lock icon
**Example:**
```typescript
// Inside textarea input event listener
textarea.addEventListener('input', () => {
  const hasContent = textarea.value.length > 0;
  indicator.classList.toggle('hidden', !hasContent);
  // indicator contains lock icon + "Encrypted in your browser" text
});
```

### Anti-Patterns to Avoid
- **innerHTML for secret display:** NEVER use innerHTML for user-provided content. Always use textContent to prevent XSS. The existing codebase already follows this pattern correctly.
- **Blocking on Web Share API:** Never gate functionality on navigator.share. It must be purely additive -- copy-to-clipboard is always the primary action.
- **Hard-coded colors for terminal:** Use CSS custom properties (`--ds-color-terminal-*`) mapped through `@theme inline`, not inline styles or hardcoded oklch values in component code.
- **Multiple toast containers:** The toast container must be a singleton. Use lazy initialization pattern.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Icon rendering | Raw SVG string concatenation | `createIcon()` from `components/icons.ts` | Already handles size, stroke-width, a11y attrs, CSS class merging |
| Clipboard copy | Custom clipboard logic | `navigator.clipboard.writeText()` with existing fallback pattern | Already implemented in `components/copy-button.ts` |
| Route announcements | Custom aria-live management | `updatePageMeta()` + `focusPageHeading()` from router | Already handles title, announcer, and focus management |
| Loading states | Custom spinners | `createLoadingSpinner()` from `components/loading-spinner.ts` | Already styled with semantic tokens and a11y attrs |

**Key insight:** The codebase has well-established patterns for icons, clipboard, routing, and loading. Phase 12 should extend these patterns, not duplicate them.

## Common Pitfalls

### Pitfall 1: Web Share API Requires User Gesture
**What goes wrong:** Calling `navigator.share()` programmatically (not from a click handler) throws `NotAllowedError`
**Why it happens:** The Web Share API requires transient activation (a user gesture like a click)
**How to avoid:** Only call `navigator.share()` inside a button click event listener. Never in `setTimeout`, `Promise.then`, or on page load.
**Warning signs:** `NotAllowedError: Must be handling a user gesture to perform a share request` in console

### Pitfall 2: Web Share API AbortError on Cancel
**What goes wrong:** The share promise rejects with `AbortError` when the user dismisses the native share dialog
**Why it happens:** This is expected behavior -- the spec defines cancellation as a rejection
**How to avoid:** Always catch the promise and check for `err.name === 'AbortError'` -- don't show error UI for cancellation
**Warning signs:** Error toast appearing when user simply closes the share sheet

### Pitfall 3: Firefox Desktop Lacks Web Share API
**What goes wrong:** Share button appears but throws an error on click
**Why it happens:** Firefox desktop (all versions through 150+) does not support `navigator.share`. Firefox Android does.
**How to avoid:** Feature-detect with `typeof navigator.share === 'function'`. Do NOT rely on user agent sniffing.
**Warning signs:** Bug reports from Firefox desktop users. Browser support is ~92% globally but notably missing Firefox desktop.

### Pitfall 4: Toast Not Accessible
**What goes wrong:** Screen readers don't announce the toast notification
**Why it happens:** Missing `aria-live` on the toast container, or the toast is created and immediately removed
**How to avoid:** Use `aria-live="polite"` on the toast container. The container must exist in the DOM before content is added. Use `aria-atomic="true"` so the full message is announced.
**Warning signs:** No VoiceOver/NVDA announcement when link is copied

### Pitfall 5: Terminal Text Color in Light Theme (Phase 13)
**What goes wrong:** Muted green-gray text becomes invisible against a light background
**Why it happens:** OKLCH color values tuned for dark theme don't work on light backgrounds
**How to avoid:** Define terminal colors as CSS custom properties in `:root` so Phase 13 can override them for light theme. Use `--ds-color-terminal-bg` and `--ds-color-terminal-text` tokens.
**Warning signs:** Terminal block becomes unreadable after Phase 13 adds light theme toggle

### Pitfall 6: Existing Test Expectations Break
**What goes wrong:** Accessibility tests fail because "How It Works" changes from 3 steps (h3 elements) to 4 steps
**Why it happens:** `accessibility.test.ts` line 53 asserts `expect(h3s.length).toBe(3)` for the How It Works section
**How to avoid:** Update the test assertion to match the new 4-step structure. Also add tests for the new "Why Trust Us?" section heading hierarchy.
**Warning signs:** CI fails on existing tests after modifying create.ts

### Pitfall 7: Error Type Collision for "Already Viewed"
**What goes wrong:** Adding a new error type breaks the exhaustive `ERROR_CONFIG` record
**Why it happens:** TypeScript's `Record<ErrorType, ...>` requires every union member to have an entry
**How to avoid:** When adding a new `ErrorType` union member (e.g., `'already_viewed'`), add the corresponding entry in `ERROR_CONFIG` at the same time. TypeScript will enforce this.
**Warning signs:** TypeScript compile error if the new type is added to the union but not to the config record

## Code Examples

### Lucide Icon Imports for Phase 12

All icons verified as available in lucide v0.564.0:

```typescript
// How It Works 4 steps
import { ClipboardPaste, LockKeyhole, Share2, Flame } from 'lucide';

// Why Trust Us 4 cards
import { EyeOff, Code, UserX, ShieldCheck } from 'lucide';

// Alternative icon choices (also available):
// Paste: Clipboard, FileText, PenLine, Type
// Encrypt: Lock, ShieldCheck, KeyRound
// Share: Share, Send, Link, Link2, ExternalLink
// Destroy: Trash2, Bomb, CircleX

// Confirmation page
import { Copy, Share2, Check } from 'lucide';

// Reveal page
import { Terminal, CircleCheck } from 'lucide';

// Textarea indicator
import { LockKeyhole } from 'lucide';
// or: Lock, ShieldCheck
```

### Recommended Icon Mapping

```typescript
// How It Works - 4 steps
const HOW_IT_WORKS_STEPS = [
  { icon: ClipboardPaste, title: 'Paste',   description: '...' },
  { icon: LockKeyhole,    title: 'Encrypt', description: '...' },
  { icon: Share2,          title: 'Share',   description: '...' },
  { icon: Flame,           title: 'Destroy', description: '...' },
];

// Why Trust Us - 4 cards
const WHY_TRUST_US_CARDS = [
  { icon: EyeOff,      label: 'Zero Knowledge',    description: '...' },
  { icon: Code,         label: 'Open Source',        description: '...' },
  { icon: UserX,        label: 'No Accounts',        description: '...' },
  { icon: ShieldCheck,  label: 'AES-256-GCM',        description: '...' },
];
```

### Terminal Color Tokens (styles.css additions)

```css
:root {
  /* Terminal code block -- muted sage green, not retro phosphor */
  --ds-color-terminal-bg:   oklch(0.20 0.020 160);
  --ds-color-terminal-text: oklch(0.68 0.060 155);
  --ds-color-terminal-header: oklch(0.25 0.025 160);
}
```

Map to Tailwind theme:
```css
@theme inline {
  --color-terminal: var(--ds-color-terminal-text);
  --color-terminal-bg: var(--ds-color-terminal-bg);
  --color-terminal-header: var(--ds-color-terminal-header);
}
```

Usage in components:
```
bg-terminal-bg text-terminal        /* content area */
bg-terminal-header                  /* header bar */
```

### Toast Animation Keyframes (styles.css addition)

```css
@keyframes toast-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### Web Share API Feature Detection

```typescript
// Source: MDN Navigator.share documentation
function canNativeShare(): boolean {
  return typeof navigator !== 'undefined'
    && typeof navigator.share === 'function';
}

// Usage in confirmation page
const shareBtn = canNativeShare()
  ? createShareButton(shareUrl, 'SecureShare Link')
  : null;

if (shareBtn) {
  buttonRow.appendChild(shareBtn);
}
```

### New Error Type for "Already Viewed"

```typescript
// error.ts -- extend ErrorType union
export type ErrorType =
  | 'not_found'
  | 'not_available'
  | 'no_key'
  | 'decrypt_failed'
  | 'destroyed'
  | 'already_viewed';  // NEW

// Add to ERROR_CONFIG
already_viewed: {
  heading: 'Secret Already Viewed',
  message: 'This secret has already been viewed and destroyed. Secrets can only be viewed once.',
  icon: CircleCheck,        // or ShieldCheck
  iconClass: 'text-text-muted',
},
```

### Destruction Badge Pattern

```typescript
// Placed ABOVE the terminal block in the reveal page
function createDestructionBadge(): HTMLElement {
  const badge = document.createElement('div');
  badge.className =
    'flex items-center gap-2 px-4 py-3 rounded-lg bg-success/10 border border-success/20 mb-6';

  const icon = createIcon(CircleCheck, { size: 'sm', class: 'text-success' });

  const text = document.createElement('p');
  text.className = 'text-sm text-success font-medium';
  text.textContent = 'This secret has been permanently deleted from our servers';

  badge.appendChild(icon);
  badge.appendChild(text);
  return badge;
}
```

### Textarea Encryption Indicator

```typescript
// Subtle indicator below textarea, visible only when content present
function createEncryptionIndicator(): HTMLElement {
  const indicator = document.createElement('div');
  indicator.className = 'hidden flex items-center gap-1.5 text-xs text-text-muted mt-1';

  const lockIcon = createIcon(LockKeyhole, { size: 'sm', class: 'text-success' });
  const label = document.createElement('span');
  label.textContent = 'Encrypted in your browser';

  indicator.appendChild(lockIcon);
  indicator.appendChild(label);
  return indicator;
}
```

## Discretion Recommendations

For areas marked as Claude's Discretion, these are the recommended approaches:

| Area | Recommendation | Rationale |
|------|---------------|-----------|
| Share URL display | Full URL visible with `word-break: break-all` and monospace font in a bordered block | URLs contain the crypto key fragment -- truncating hides critical info; break-all prevents horizontal overflow |
| Share URL block prominence | Large bordered card with slight bg tint, positioned as the primary page element below heading | The URL is the entire purpose of this page -- maximum visual weight |
| Trust sections placement | Below the form, vertically stacked (How It Works first, then Why Trust Us) | Current layout already places How It Works below; adding Why Trust Us below it maintains scroll flow |
| Textarea indicator weight | Subtle -- small text + small icon, appears on input, muted color | Should not distract from the primary action (typing secret); informational only |
| Terminal header bar style | Minimal -- flat surface-raised bg, filename label left, copy button right. No macOS dots. | macOS dots are decorative noise; minimal header is more professional for a security tool |
| Terminal line wrapping | `whitespace-pre-wrap` with `break-words` (wrap, no horizontal scroll) | Secrets may be long strings (API keys, passwords). Horizontal scroll hides content and breaks mobile UX. |
| Secret visibility after destruction | Secret stays visible (no fade). Destruction badge is the feedback. | Fading the secret removes the user's ability to copy. They came here to read it. |
| Destroyed badge placement | Directly above the terminal block, full-width | Context says "ABOVE the secret terminal block -- first thing the user sees" -- this is locked, not discretionary |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 3-step How It Works | 4-step (Paste/Encrypt/Share/Destroy) | Phase 12 decision | Better maps to actual user flow |
| Numbered circles for steps | Lucide SVG icons per step | Phase 12 decision | More descriptive, visually richer |
| Inline "Copied!" text swap on button | Toast notification snackbar | Phase 12 decision | Less jarring, more standard UX pattern |
| Plain `<pre>` for revealed secret | Terminal code block with header bar | Phase 12 decision | Professional developer-tool aesthetic |
| Generic "not available" for viewed secrets | Distinct "already viewed and destroyed" state | Phase 12 decision | Better UX, reduces confusion |

## Open Questions

1. **Toast z-index vs header**
   - What we know: Header has `z-40`, toast should be above it
   - What's unclear: Whether `z-50` is sufficient or if future modals (Phase 13+) will need higher
   - Recommendation: Use `z-50` for toast. Consistent with the skip-link's existing `z-50`.

2. **Copy button refactor scope**
   - What we know: `createCopyButton` currently shows inline "Copied!" text. Phase 12 wants toast notifications instead.
   - What's unclear: Should copy button in ALL contexts use toast (including reveal page terminal header)?
   - Recommendation: Yes, unify on toast. The copy-button component should call `showToast()` instead of inline text swap. This is a small breaking change to the shared component but improves consistency.

3. **Toast duration and stacking**
   - What we know: Copy confirmation should be transient (2-3 seconds)
   - What's unclear: Should multiple toasts stack (e.g., rapid copy clicks)?
   - Recommendation: Replace strategy -- new toast removes previous one. Users don't need a queue for "Link copied" messages.

## Sources

### Primary (HIGH confidence)
- Lucide v0.564.0 installed in node_modules -- all icon names verified via `require()` against actual package exports
- Codebase files read directly: `create.ts`, `confirmation.ts`, `reveal.ts`, `error.ts`, `icons.ts`, `copy-button.ts`, `layout.ts`, `styles.css`, `router.ts`, `app.ts`, `accessibility.test.ts`
- `CONTEXT.md` -- locked decisions and discretion areas

### Secondary (MEDIUM confidence)
- [MDN Navigator.share()](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share) -- API requirements (HTTPS, user gesture, permissions policy)
- [MDN Navigator.canShare()](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/canShare) -- feature detection guidance
- [Can I Use: Web Share API](https://caniuse.com/web-share) -- 92.48% global support, notably missing Firefox desktop

### Tertiary (LOW confidence)
- None -- all findings verified against installed packages or official documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed, verified in package.json and node_modules
- Architecture: HIGH -- patterns derived directly from existing codebase conventions
- Lucide icons: HIGH -- every icon name verified via `require()` against installed package
- Web Share API: HIGH -- MDN docs + Can I Use data cross-referenced
- Toast implementation: HIGH -- simple DOM pattern, no external dependencies needed
- Terminal styling: HIGH -- CSS custom properties following established OKLCH token system
- Pitfalls: HIGH -- derived from actual codebase code (test assertions, error type system, existing component behavior)

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (stable -- no fast-moving dependencies involved)

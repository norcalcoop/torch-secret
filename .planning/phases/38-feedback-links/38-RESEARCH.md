# Phase 38: Feedback Links - Research

**Researched:** 2026-02-28
**Domain:** Frontend UI — vanilla TypeScript page modification, external link pattern
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FBCK-01 | Confirmation page includes link to Tally.so feedback form (opens in new tab) | `renderConfirmationPage()` in `client/src/pages/confirmation.ts` appends children to `wrapper`; feedback link appended after "Create Another" button using existing anchor pattern |
| FBCK-02 | Post-reveal page includes link to Tally.so feedback form (opens in new tab) | `renderRevealedSecret()` in `client/src/pages/reveal.ts` appends children to `actions` row; feedback link appended alongside "Create a New Secret" link using same anchor pattern |
</phase_requirements>

## Summary

Phase 38 is a narrow, low-risk frontend-only change. It adds a static text link to a Tally.so feedback form at two specific moments: immediately after a user creates a secret (confirmation page) and immediately after a user reveals a secret (post-reveal screen). Both are the highest-intent moments in the product flow — the user has just completed their primary action, and a non-blocking "Share feedback" link captures signal without interrupting the experience.

The implementation requires zero new dependencies, zero backend changes, zero schema changes, and zero CSP changes. External links opened via `target="_blank"` with `rel="noopener noreferrer"` are not subject to CSP `connect-src` or `frame-src` restrictions — they are plain anchor navigations handled entirely by the browser. The Tally.so URL is a hardcoded string constant; no dynamic generation is needed.

The only design judgment calls are: (1) where in the DOM hierarchy to insert the link (after the primary action, not before), (2) what copy to use ("Share feedback" is established convention for non-intrusive feedback requests), and (3) what styling to apply (secondary/ghost treatment to maintain visual hierarchy — the primary action is "Copy Link" / "Create a New Secret", not the feedback link).

**Primary recommendation:** Add a single `createFeedbackLink(tallyUrl)` helper function in each page file (or as a shared component), render it as a styled anchor with `target="_blank" rel="noopener noreferrer"`, and place it as the last visual element in each page's wrapper — below the primary action, above nothing.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla TypeScript | 5.9.x | DOM construction | Project convention — no React, no JSX |
| Lucide icons | (already installed) | Optional MessageCircle/ExternalLink icon | Existing icon system; no new install needed |

### Supporting

No new dependencies required. This phase uses only existing project primitives:
- `document.createElement('a')` — standard DOM anchor
- `textContent` assignment — project-enforced (never `innerHTML`)
- Tailwind CSS 4 utility classes — existing design token system

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain anchor with `target="_blank"` | Tally.so popup embed widget | Embed widget requires `frame-src tally.so` in CSP and an iframe; link is simpler, less attack surface, no CSP change needed |
| Static hardcoded URL | Environment variable VITE_TALLY_FORM_URL | Env var adds deployment complexity for a URL that won't change per environment; hardcode it |
| Text-only link | Button element with click handler | Anchor is semantically correct for external navigation; button with `window.open()` is not semantic HTML |

**Installation:** No new packages required.

## Architecture Patterns

### Recommended Project Structure

No new files required. Changes are confined to:

```
client/src/pages/
├── confirmation.ts    # Add feedback link in renderConfirmationPage()
└── reveal.ts          # Add feedback link in renderRevealedSecret()
```

Optionally, a shared helper can be extracted to:

```
client/src/components/
└── feedback-link.ts   # createFeedbackLink(url) → HTMLAnchorElement
```

Given Phase 38 touches only two callsites, inlining the link creation in each page file is acceptable and avoids over-engineering. If the planner prefers a shared helper for DRY reasons, `client/src/components/feedback-link.ts` is the correct location following the component naming pattern (`copy-button.ts`, `share-button.ts`, etc.).

### Pattern 1: External Link with Security Attributes

**What:** Anchor element with `target="_blank"` and `rel="noopener noreferrer"`.
**When to use:** Any link that opens a third-party URL in a new tab.
**Why:** `noopener` prevents the new tab from accessing `window.opener` (prevents tab-napping phishing). `noreferrer` prevents the `Referer` header from leaking the current URL to Tally.so (privacy-preserving: the fragment `#key` is already stripped from the address bar by `reveal.ts`, but defense in depth is always correct).

```typescript
// Pattern: external link with mandatory security attributes
const feedbackLink = document.createElement('a');
feedbackLink.href = 'https://tally.so/r/XXXXXX'; // actual form ID from user
feedbackLink.target = '_blank';
feedbackLink.rel = 'noopener noreferrer';
feedbackLink.textContent = 'Share feedback';
feedbackLink.className =
  'inline-block py-2 text-text-muted hover:text-text-secondary focus:ring-2 focus:ring-accent focus:outline-hidden rounded text-sm transition-colors';
```

### Pattern 2: Placement in Confirmation Page

**What:** Append feedback link after the "Create Another Secret" button in `renderConfirmationPage()`.
**When to use:** Post-creation, as the final element in the `wrapper` div.

The confirmation page `wrapper` div currently ends with the "Create Another Secret" button at line 292. The feedback link is appended after it — the final child of `wrapper`, before `container.appendChild(wrapper)`.

```typescript
// After createAnotherButton.addEventListener in renderConfirmationPage():
const feedbackLink = createFeedbackLink('https://tally.so/r/XXXXXX');
wrapper.appendChild(feedbackLink);

container.appendChild(wrapper);
```

### Pattern 3: Placement in Reveal Page

**What:** Add feedback link to the `actions` row in `renderRevealedSecret()`.
**When to use:** Post-reveal, alongside the "Create a New Secret" link.

The `actions` row currently has one child: the "Create a New Secret" link. The feedback link is appended to `actions` as a second child. The row is already `flex flex-col sm:flex-row items-center gap-4`, so both links stack on mobile and sit side-by-side on desktop.

```typescript
// After newSecretLink is appended to actions in renderRevealedSecret():
const feedbackLink = createFeedbackLink('https://tally.so/r/XXXXXX');
actions.appendChild(feedbackLink);
```

### Pattern 4: Tally.so URL Format

**What:** Tally.so direct share links follow the pattern `https://tally.so/r/{FORM_ID}` where `FORM_ID` is a short alphanumeric code (e.g., `mBzM9Q`). This is the URL shown in the Tally "Share" tab when copying the form link.

**Important:** The actual Tally form URL (with real FORM_ID) must be supplied by the user/team before implementation. The FORM_ID is generated when the form is created in the Tally.so dashboard. The planner should block on this value or use a placeholder constant that is easy to find-and-replace.

### Anti-Patterns to Avoid

- **innerHTML for link text:** Always use `textContent`. CLAUDE.md and existing code enforce this everywhere — feedback link is no exception.
- **Embedding Tally as iframe:** Requires `frame-src tally.so` in CSP in `security.ts`. The requirement is a link, not an embed.
- **Showing feedback link before the secret is displayed:** The link must appear after the primary action is complete, not as an interstitial before reveal.
- **Using `window.open()` in a click handler:** Use a plain `<a target="_blank">` instead — semantically correct and works without JavaScript for keyboard/assistive tech.
- **Putting the feedback link inside the terminal block:** The terminal block in `reveal.ts` is a standalone component with its own copy button. Do not modify `createTerminalBlock()` — add the link to the `actions` row.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Feedback form | Custom HTML form with DB storage | Tally.so link | Already decided in requirements; FBCK-01/FBCK-02 specify Tally.so explicitly |
| Link icon | Custom SVG | `createIcon(ExternalLink, ...)` from Lucide | Icon system already ships ExternalLink; no new install |

**Key insight:** This phase is intentionally minimal. The value is in the _placement_ (right moment, right context) not in the complexity of the feedback mechanism.

## Common Pitfalls

### Pitfall 1: Missing `rel="noopener noreferrer"`

**What goes wrong:** Link opens Tally.so in new tab without proper security attributes. The Tally tab can access `window.opener` and perform tab-napping. The `Referer` header leaks the current page URL.
**Why it happens:** Developers add `target="_blank"` but forget `rel`.
**How to avoid:** Always set `rel = 'noopener noreferrer'` as a single string when setting `target="_blank"` on external links.
**Warning signs:** ESLint may warn about missing `noopener` on `_blank` links in some configurations.

### Pitfall 2: CSP Frame-src Violation (If Embed Is Used Instead of Link)

**What goes wrong:** If an `<iframe src="https://tally.so/...">` is used instead of a link, the browser blocks it because `frame-src` in `security.ts` defaults to `"'none'"` (via Helmet's `frameAncestors: ["'none'"]`).
**Why it happens:** Confusion between `frameAncestors` (who can embed us) and `frame-src` (what we can embed). The CSP has no explicit `frame-src`, so it inherits `defaultSrc: ["'self'"]` — which blocks `tally.so`.
**How to avoid:** Use a plain `<a target="_blank">` link. Never use iframe embed.
**Warning signs:** Browser console CSP violation: `Refused to frame 'https://tally.so/' because it violates the following Content Security Policy directive`.

### Pitfall 3: Feedback Link Placed Before Reveal Completes

**What goes wrong:** If the feedback link is added to the interstitial screen (before "Reveal Secret" is clicked) rather than to `renderRevealedSecret()`, users see the feedback prompt before they've even read the secret — a confusing order.
**Why it happens:** Misreading `reveal.ts` — there are three render phases: interstitial → loading → revealed. Only the revealed phase should have the feedback link.
**How to avoid:** Add the feedback link only inside `renderRevealedSecret()`, not inside `renderInterstitial()` or `renderPasswordEntry()`.
**Warning signs:** During code review, seeing the feedback link appear in the password entry form or interstitial screen.

### Pitfall 4: Incorrect Tally URL (Placeholder Not Replaced)

**What goes wrong:** Ship with a placeholder URL like `https://tally.so/r/PLACEHOLDER` that returns a 404 when clicked.
**Why it happens:** The FORM_ID is only known after the team creates the form in Tally.so. The planner may scaffold the code with a placeholder constant.
**How to avoid:** Define the URL as a named constant (`const TALLY_FEEDBACK_URL = 'https://tally.so/r/XXXXXX'`) near the top of the file so it's obvious and easy to update. The plan should include a verification step: click the link in the running app and confirm the form loads.
**Warning signs:** Clicking the feedback link returns "This form does not exist" or a Tally 404 page.

### Pitfall 5: ZK Invariant Pre-population

**What goes wrong:** If the team decides to pre-populate the Tally form with any identifying data (e.g., `?userId=...` query param), the ZK invariant is violated by leaking a `userId` to a third-party analytics system.
**Why it happens:** Tally supports pre-populated fields via URL query params. The team might want to correlate feedback with accounts.
**How to avoid:** The link must be a static URL with no query parameters containing `userId`, `secretId`, email, or any identifying data. The form should be completely anonymous.
**Warning signs:** The Tally URL contains `?` with any user or secret identifiers.

## Code Examples

Verified patterns from existing project code:

### Existing External Link Pattern (from confirmation.ts)

The project already creates external-like links as `<a>` elements with `navigate()`. For a true external link (new tab), `navigate()` is NOT used — use a plain anchor:

```typescript
// Source: client/src/pages/confirmation.ts (existing anchor pattern for context)
// The project uses textContent (NEVER innerHTML) for all text nodes.
const ctaLink = document.createElement('a');
ctaLink.href = '/register';
ctaLink.className = '...'; // Tailwind classes
ctaLink.textContent = "Sign up — it's free"; // textContent only
```

The feedback link extends this pattern with `target` and `rel`:

```typescript
// Feedback link pattern (new, for Phase 38)
const feedbackLink = document.createElement('a');
feedbackLink.href = TALLY_FEEDBACK_URL; // defined as a named constant
feedbackLink.target = '_blank';
feedbackLink.rel = 'noopener noreferrer';
feedbackLink.textContent = 'Share feedback';
feedbackLink.className =
  'inline-block py-2 text-sm text-text-muted hover:text-text-secondary ' +
  'focus:ring-2 focus:ring-accent focus:outline-hidden rounded transition-colors';
```

### Confirmation Page Insertion Point

```typescript
// Source: client/src/pages/confirmation.ts lines 284-296 (current "Create Another" + append)
const createAnotherButton = document.createElement('button');
// ... (existing code) ...
createAnotherButton.addEventListener('click', () => { navigate('/'); });
wrapper.appendChild(createAnotherButton);

// Phase 38: feedback link goes HERE, after createAnotherButton, before container.appendChild(wrapper)
wrapper.appendChild(feedbackLink);

container.appendChild(wrapper);
focusPageHeading();
```

### Reveal Page Insertion Point

```typescript
// Source: client/src/pages/reveal.ts lines 403-421 (current actions row + append)
const actions = document.createElement('div');
actions.className = 'flex flex-col sm:flex-row items-center gap-4';

const newSecretLink = document.createElement('a');
// ... (existing code) ...
actions.appendChild(newSecretLink);

// Phase 38: feedback link goes HERE, as second child of actions row
actions.appendChild(feedbackLink);

wrapper.appendChild(heading);
wrapper.appendChild(badge);
wrapper.appendChild(terminal);
wrapper.appendChild(actions);
container.appendChild(wrapper);
captureSecretViewed();
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Inline feedback forms with custom backend | External no-code forms (Tally, Typeform) linked from product | ~2020+ SaaS trend | Zero backend complexity; no DB schema; instant setup |
| `target="_blank"` without `rel` | `rel="noopener noreferrer"` required | Browser security guidance, ~2016+ | Prevents tab-napping; already required by most linters |

**No deprecated patterns affect this phase.** The `rel="noopener noreferrer"` convention is universally current.

## Open Questions

1. **What is the actual Tally.so FORM_ID?**
   - What we know: Tally.so share links follow `https://tally.so/r/{FORM_ID}` where FORM_ID is set when the form is created.
   - What's unclear: The team has not yet created the Tally form, so the FORM_ID is unknown.
   - Recommendation: The plan should define a placeholder constant `const TALLY_FEEDBACK_URL = 'https://tally.so/r/TODO'` and include a human-action task for the team to (1) create the form in Tally.so, (2) copy the share URL, (3) update the constant in both `confirmation.ts` and `reveal.ts`, then verify by clicking the link in the running app. Alternatively, if the Tally form already exists, the URL should be provided before the plan runs.

2. **Should the feedback link include a Lucide icon (e.g., ExternalLink or MessageCircle)?**
   - What we know: All interactive elements in the codebase pair text with a Lucide icon (copy button, share button). The `ExternalLink` icon from Lucide is already available (it ships with the lucide package).
   - What's unclear: Whether the design warrants an icon or plain text — depends on visual weight.
   - Recommendation: Use `ExternalLink` icon via `createIcon(ExternalLink, { size: 'sm' })` for consistency with the existing component pattern. The icon signals "opens in new tab" to sighted users. Keep it inline with the text: `icon + span("Share feedback")`. The icon is decorative so `aria-hidden="true"` is already set by `createIcon()`.

3. **Should a `captureFeedbackLinkClicked` PostHog event be added?**
   - What we know: The analytics module captures `conversion_prompt_shown`, `conversion_prompt_clicked`, `secret_created`, `secret_viewed`. A feedback click is low-stakes signal.
   - What's unclear: Whether the team wants analytics on feedback link clicks.
   - Recommendation: This is out of scope for FBCK-01/FBCK-02 which only require the link to exist and open in a new tab. Do not add analytics to this phase unless explicitly requested. Adding analytics would require an INVARIANTS.md update first (ZK protocol).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.x (multi-project) |
| Config file | `/Users/ourcomputer/Github-Repos/secureshare/vitest.config.ts` |
| Quick run command | `npx vitest run client/src` |
| Full suite command | `npm run test:run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FBCK-01 | Confirmation page renders feedback link with correct href, target=_blank, rel=noopener noreferrer | unit (happy-dom) | `npx vitest run client/src/pages/confirmation.test.ts -x` | ❌ Wave 0 |
| FBCK-02 | Post-reveal page renders feedback link with correct href, target=_blank, rel=noopener noreferrer | unit (happy-dom) | `npx vitest run client/src/pages/reveal.test.ts -x` | ❌ Wave 0 |

**Note:** FBCK-01 and FBCK-02 are pure DOM rendering checks — no async API calls, no mocks needed. Tests import `renderConfirmationPage()` / `renderRevealedSecret()` (or a wrapper), render into a `happy-dom` container, then query for the anchor element and assert its `href`, `target`, and `rel` attributes.

### Sampling Rate

- **Per task commit:** `npx vitest run client/src/pages/confirmation.test.ts client/src/pages/reveal.test.ts`
- **Per wave merge:** `npm run test:run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `client/src/pages/confirmation.test.ts` — covers FBCK-01 (confirmation page feedback link DOM assertions)
- [ ] `client/src/pages/reveal.test.ts` — covers FBCK-02 (post-reveal page feedback link DOM assertions)

**Existing test infrastructure covers all other phase needs — no new framework install, no new fixtures, no new conftest needed.** Both test files will follow the existing `accessibility.test.ts` pattern: `@vitest-environment happy-dom`, import the page render function, mount to a container, query and assert.

## Sources

### Primary (HIGH confidence)

- Direct codebase reading — `client/src/pages/confirmation.ts`, `client/src/pages/reveal.ts`, `client/src/components/layout.ts`, `client/src/analytics/posthog.ts`, `server/src/middleware/security.ts` — all read in this session
- `.planning/INVARIANTS.md` — ZK invariant enforcement table (current as of Phase 37.3)
- `.planning/REQUIREMENTS.md` — FBCK-01 and FBCK-02 requirement definitions
- `.planning/research/FEATURES.md` — Phase 38 feature context and Tally.so decision rationale

### Secondary (MEDIUM confidence)

- Tally.so help center (WebSearch + WebFetch) — confirmed `tally.so/r/{FORM_ID}` URL pattern from multiple Tally help pages and examples; embed vs. link distinction confirmed
- MDN/browser security: `rel="noopener noreferrer"` requirement for `target="_blank"` links — universally documented, HIGH confidence

### Tertiary (LOW confidence)

- None. All critical claims are backed by direct code reading or official documentation.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — zero new dependencies; changes confined to two existing TypeScript files that were read in full
- Architecture: HIGH — exact insertion points identified in both page files with line numbers; existing patterns are clear
- Pitfalls: HIGH — CSP behavior verified by reading `security.ts`; ZK invariant from `INVARIANTS.md`; DOM patterns from existing page code
- Test architecture: HIGH — test framework read from `vitest.config.ts`; existing test file patterns read from `accessibility.test.ts`

**Research date:** 2026-02-28
**Valid until:** 2026-03-28 (30 days — stable codebase, no fast-moving dependencies)

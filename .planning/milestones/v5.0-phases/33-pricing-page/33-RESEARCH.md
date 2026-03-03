# Phase 33: Pricing Page - Research

**Researched:** 2026-02-22
**Domain:** SPA pricing page, billing toggle UI, FAQ accordion, FAQPage JSON-LD injection
**Confidence:** HIGH — all findings verified against existing codebase; no new external libraries required

## Summary

Phase 33 is a self-contained frontend SPA page addition. The work is: (1) create `client/src/pages/pricing.ts` using the established vanilla-TS DOM-construction pattern, (2) swap the `/pricing` router stub from error-page rendering to `renderPricingPage`, (3) remove the `noindex: true` flag from the router's `/pricing` metadata entry (the page is SEO-valuable), and (4) inject a `FAQPage` JSON-LD block into `client/index.html` (the SPA shell) so it is present in `<head>` for all routes — verifiable via curl.

The most critical architectural decision is how to deliver `FAQPage` JSON-LD. Since the app is a SPA, all routes share the single `client/index.html` shell. The existing `WebApplication` JSON-LD is static in `<head>` and is served for every route. A second `<script type="application/ld+json">` block for FAQPage can be added to the same file — but this means FAQPage JSON-LD appears on every page (/, /create, /secret/*, etc.), not just /pricing. The cleaner alternative is for `renderPricingPage()` to dynamically inject a `<script type="application/ld+json">` tag into `document.head` on mount and remove it on teardown (via the routechange event or a cleanup callback). Either approach satisfies the PRICE-05 "verifiable via curl" requirement — but "via curl" implies server-rendered HTML, which means only the static `index.html` approach is curl-verifiable. The dynamic injection approach is NOT curl-verifiable because curl does not execute JavaScript. Therefore: the FAQPage JSON-LD must be added as a second static `<script type="application/ld+json">` block in `client/index.html`.

The billing toggle is a stateful UI element (checked/unchecked) that updates price display text. This is vanilla-JS state management — a single boolean variable `isAnnual` toggles the visible price labels. No new libraries are needed. The FAQ accordion is a sequence of `<details>/<summary>` elements or a custom toggle pattern using `hidden` class toggling — the `<details>` native HTML approach is simplest and accessible by default.

**Primary recommendation:** Build pricing.ts as a standalone page module, add FAQPage JSON-LD to index.html statically, and wire the router stub. No new npm dependencies required.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- Free tier: $0 forever
- Pro tier: $7/month (monthly billing)
- Annual billing is selected by default; toggle shows a "22% savings" label when annual is active
- Feature list only — no usage counts or quotas
- Core Pro differentiator: 30-day secret expiration (vs. shorter max on Free)
- Free card CTA: "Start for free" → links to `/create`
- Pro card carries a "Recommended" badge
- FAQ section: 6–8 questions; topics must cover: cancellation, refunds, billing cycle, trial, payment methods
- No free trial — the Free tier is the evaluation experience
- `FAQPage` JSON-LD in `<head>` must mirror the visible Q&A content exactly
- Billing toggle sits above the tier cards

### Claude's Discretion

- Annual Pro price display format (e.g. "$5.40/mo billed annually" or "$65/year")
- Toggle placement details
- Pro feature list beyond 30-day expiration
- Pro CTA destination/behavior before Stripe is live (e.g. `/register?plan=pro`)
- Auth-aware CTA handling (or deferral to Phase 34)
- Page header copy
- Content between cards and FAQ
- Visual surface treatment (glassmorphism vs flat)
- Refund policy wording
- FAQ tone and whether to include a security/privacy entry

### Deferred Ideas (OUT OF SCOPE)

- None — discussion stayed within phase scope

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PRICE-01 | User can view Free vs. Pro tier comparison at `/pricing` | New `pricing.ts` page module; router stub swapped to `renderPricingPage`; `noindex` removed from router entry |
| PRICE-02 | Pricing page has monthly/annual billing toggle (annual default, shows 22% savings) | Vanilla-TS boolean state variable `isAnnual`; toggle button with `aria-checked`; price label elements updated on toggle |
| PRICE-03 | Pro tier card is highlighted as "Recommended" with complete feature list | Pro card gets distinct border/background + inline badge element; feature list rendered as `<ul>` with checkmark icons |
| PRICE-04 | Pricing page includes FAQ section (6-8 questions: cancellation, refunds, billing cycle, trial, payment methods) | Native `<details>/<summary>` accordion or custom toggle; 6 FAQ items covering required topics |
| PRICE-05 | Pricing page includes `FAQPage` JSON-LD schema markup | Static `<script type="application/ld+json">` added to `client/index.html`; content mirrors FAQ visible Q&A exactly; curl-verifiable |

</phase_requirements>

---

## Standard Stack

### Core (no new dependencies)

| Library/Tool | Version | Purpose | Status |
|---|---|---|---|
| Vanilla TypeScript | 5.9.x | Page module construction, state management | Already in use |
| Tailwind CSS 4 | @tailwindcss/vite | Design tokens, responsive classes | Already in use |
| Lucide | via `lucide` package | Feature list check icons, CTA icons | Already in use |
| `createIcon()` utility | project | Consistent icon sizing + aria | `client/src/components/icons.ts` |
| `navigate()` | project | SPA navigation | `client/src/router.ts` |
| `updatePageMeta()` | project | SEO meta per route | `client/src/router.ts` |

**Installation:** None required. No new packages.

---

## Architecture Patterns

### Recommended File Structure Changes

```
client/
├── index.html                   # ADD second JSON-LD block for FAQPage
└── src/
    ├── pages/
    │   └── pricing.ts           # NEW — pricing page module
    └── router.ts                # MODIFY — swap /pricing stub to renderPricingPage; remove noindex
```

### Pattern 1: Page Module Export Signature

Every page in this project exports a single `renderXxxPage(container: HTMLElement): void` function. The pricing page follows this pattern exactly:

```typescript
// client/src/pages/pricing.ts
export function renderPricingPage(container: HTMLElement): void {
  const wrapper = document.createElement('div');
  wrapper.className = 'space-y-12 pb-20 sm:pb-8';

  wrapper.appendChild(createPageHeader());
  wrapper.appendChild(createBillingToggle(priceState));
  wrapper.appendChild(createTierCards(priceState));
  wrapper.appendChild(createFaqSection());

  container.appendChild(wrapper);
}
```

### Pattern 2: Router Update for /pricing

The current `/pricing` stub in `router.ts` (lines 199–210) renders the error/not-found page with `noindex: true`. Phase 33 replaces this with the real page module and removes noindex:

```typescript
// BEFORE (router stub from Phase 32):
} else if (path === '/pricing') {
  updatePageMeta({
    title: 'Pricing',
    description: 'Simple, transparent pricing for Torch Secret. Free and Pro plans.',
    noindex: true,  // <-- REMOVE THIS
  });
  // Phase 33 replaces this with renderPricingPage
  import('./pages/error.js')
    .then((mod) => mod.renderErrorPage(container, 'not_found'))

// AFTER (Phase 33):
} else if (path === '/pricing') {
  updatePageMeta({
    title: 'Pricing',
    description: 'Simple, transparent pricing for Torch Secret. Free and Pro plans.',
    // noindex removed — this page is SEO-valuable
  });
  import('./pages/pricing.js')
    .then((mod) => mod.renderPricingPage(container))
    .then(() => focusPageHeading())
    .catch(() => showLoadError(container));
}
```

### Pattern 3: Billing Toggle State Management

The billing toggle is a boolean state variable shared across the tier card price labels. The cleanest approach: a `priceState` object mutated by the toggle handler, with each price label element stored by reference and updated on toggle click.

```typescript
// Mutable state — toggle mutates this in place
const priceState = { isAnnual: true };

// Toggle button
const toggle = document.createElement('button');
toggle.type = 'button';
toggle.setAttribute('role', 'switch');
toggle.setAttribute('aria-checked', 'true'); // annual by default

toggle.addEventListener('click', () => {
  priceState.isAnnual = !priceState.isAnnual;
  toggle.setAttribute('aria-checked', priceState.isAnnual ? 'true' : 'false');
  updatePriceLabels(priceState.isAnnual);
});
```

`updatePriceLabels()` holds references to the DOM elements that display price text and updates their `textContent` on each toggle. No re-render of the full page — targeted updates only.

### Pattern 4: Tier Card Visual Treatment

The user's CONTEXT explicitly requires the Pro card to be "visually distinct" with a "Recommended" badge. Based on existing design tokens:

- **Free card:** Standard glassmorphism (`bg-surface/80 backdrop-blur-md border-border`)
- **Pro card:** Accent-border + slightly elevated surface (`border-accent bg-surface/90`) + "Recommended" inline badge

Badge pattern (consistent with existing status badges in `dashboard.ts`):

```typescript
const badge = document.createElement('span');
badge.className =
  'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent border border-accent/20';
badge.textContent = 'Recommended';
```

Feature list pattern — use checkmark icons from Lucide (`Check` icon) for Pro features; a muted dash or `X` icon for features not on Free:

```typescript
import { Check, Minus } from 'lucide';
// Pro feature item:
const item = document.createElement('li');
item.className = 'flex items-center gap-2 text-sm text-text-secondary';
item.appendChild(createIcon(Check, { size: 'sm', class: 'text-success flex-shrink-0' }));
const label = document.createElement('span');
label.textContent = feature;
item.appendChild(label);
```

### Pattern 5: FAQ Accordion — Native `<details>/<summary>`

The native `<details>/<summary>` HTML elements provide accessible disclosure widget behavior with zero JavaScript required for open/close. This aligns with the project's "no unnecessary complexity" philosophy:

```typescript
const faqItem = document.createElement('details');
faqItem.className = 'border-b border-border py-4 group';

const summary = document.createElement('summary');
summary.className =
  'flex items-center justify-between cursor-pointer text-text-primary font-medium ' +
  'list-none focus:outline-hidden focus:ring-2 focus:ring-accent rounded';
summary.textContent = question;

// Chevron indicator (Lucide ChevronDown, rotate on open)
const chevron = createIcon(ChevronDown, { size: 'sm', class: 'text-text-muted transition-transform group-open:rotate-180' });
summary.appendChild(chevron);

const answer = document.createElement('p');
answer.className = 'mt-2 text-text-secondary text-sm leading-relaxed';
answer.textContent = answerText;

faqItem.appendChild(summary);
faqItem.appendChild(answer);
```

The `group` + `group-open:` pattern works with Tailwind CSS 4 because `<details>` adds an `open` attribute when open — Tailwind 4 supports the `group-open:` variant to style children when the group has the `open` attribute.

### Pattern 6: FAQPage JSON-LD Injection — Static in index.html

The PRICE-05 requirement says "Viewing page source or curl output for `/pricing` includes a `FAQPage` JSON-LD script block in the `<head>`." Since this is a SPA served from `index.html`, and curl does not execute JavaScript, the JSON-LD block must be added statically to `client/index.html` — the same mechanism used for the existing `WebApplication` JSON-LD.

This means the `FAQPage` JSON-LD will be present on ALL pages (/, /create, /pricing, etc.). This is acceptable — Google's guidance says multiple JSON-LD blocks on a page are valid, and `FAQPage` on non-FAQ pages is simply ignored by crawlers. The alternative (dynamic injection via JS on mount) is NOT curl-verifiable.

The block is added inside `<head>`, after the existing JSON-LD block:

```html
<!-- In client/index.html, after the WebApplication JSON-LD block -->
<script type="application/ld+json" nonce="__CSP_NONCE__">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Can I cancel my Pro subscription at any time?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. You can cancel at any time from your billing settings. Your Pro access continues until the end of the current billing period."
      }
    },
    {
      "@type": "Question",
      "name": "What is your refund policy?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "We offer a 7-day money-back guarantee on your first payment. After that, payments are non-refundable but you can cancel before the next billing date."
      }
    },
    ...
  ]
}
</script>
```

**Critical constraint:** The FAQ Q&A content in `pricing.ts` and the `FAQPage` JSON-LD in `index.html` must be identical. Both files must be authored from the same source-of-truth list.

### Pattern 7: CSP Nonce on JSON-LD Blocks

The existing JSON-LD block in `index.html` uses `nonce="__CSP_NONCE__"`:

```html
<script type="application/ld+json" nonce="__CSP_NONCE__">
```

The Express SPA catch-all in `server/src/app.ts` replaces `__CSP_NONCE__` with a real nonce via `htmlTemplate.replaceAll('__CSP_NONCE__', res.locals.cspNonce)`. The new FAQPage JSON-LD block must also use `nonce="__CSP_NONCE__"` — the `replaceAll` will replace ALL occurrences automatically. No code change needed in `app.ts`.

### Anti-Patterns to Avoid

- **Do NOT use `innerHTML`** — entire codebase uses `textContent` and DOM construction for XSS safety.
- **Do NOT inject JSON-LD dynamically via JavaScript** — it would not be curl-verifiable, violating PRICE-05.
- **Do NOT import any React or UI library** — vanilla TS only.
- **Do NOT hard-code color values** — use semantic tokens (`text-text-primary`, `bg-surface`, `border-border`, `text-accent`, etc.) only.
- **Do NOT put `/pricing` in `NOINDEX_PREFIXES` in `server/src/app.ts`** — the pricing page is indexable.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Icon rendering | Raw SVG inline | `createIcon()` from `components/icons.ts` | Handles aria, size variants, consistent stroke-width |
| SPA navigation | `window.location.href` | `navigate()` from `router.ts` | History API, no full page reload |
| Meta tag management | Direct `document.title = ...` | `updatePageMeta()` from `router.ts` | Updates all SEO tags atomically including canonical and OG |
| Toast notification | Custom alert | `showToast()` from `components/toast.ts` | Singleton, aria-live, auto-dismiss |
| Accordion open/close | Custom JS toggle | Native `<details>/<summary>` | Accessible by default, no JS required, browser handles ARIA |
| Price calculation | Math.round() etc | Plain string literals | Prices are fixed ($7/mo, $5.40/mo billed annually); no runtime calculation needed |

**Key insight:** The pricing toggle only swaps two pre-known strings — monthly and annual prices are static copy, not computed. Store both label strings and swap `textContent` on toggle.

---

## Common Pitfalls

### Pitfall 1: FAQPage JSON-LD Not Curl-Verifiable

**What goes wrong:** Developer adds JSON-LD injection to `renderPricingPage()` via `document.head.appendChild(...)`. This works in the browser but is invisible to curl and web crawlers that don't execute JavaScript.

**Why it happens:** Dynamic injection feels natural in a SPA. The Phase 32 `WebApplication` JSON-LD precedent (it's static in `index.html`) may be overlooked.

**How to avoid:** Add the FAQPage JSON-LD as a static `<script type="application/ld+json" nonce="__CSP_NONCE__">` block in `client/index.html` — the same file where the WebApplication JSON-LD lives. Verify with `curl http://localhost:3000/pricing | grep FAQPage`.

**Warning signs:** `curl http://localhost:3000/pricing` output does not contain `FAQPage`.

### Pitfall 2: JSON-LD Content Drift Between HTML and TS

**What goes wrong:** FAQ questions/answers in `pricing.ts` are written one way; the JSON-LD in `index.html` is written slightly differently. They look "close enough" but don't match exactly.

**Why it happens:** Two files, written separately, no single source of truth.

**How to avoid:** Author the FAQ Q&A list once (as a TypeScript constant), then generate both the DOM elements AND the JSON-LD content from that same array. In practice for this phase, write the FAQ array in `pricing.ts` and manually copy the strings verbatim into `index.html`. Cross-check before UAT.

**Warning signs:** Google Search Console reports invalid FAQPage markup (question text doesn't match visible content).

### Pitfall 3: `noindex` Left on /pricing Route

**What goes wrong:** The Phase 32 router stub has `noindex: true` on `/pricing`. If Phase 33 fails to remove this, the pricing page is blocked from search indexing — defeating its SEO purpose.

**Why it happens:** The router change is easy to miss when focusing on the new `pricing.ts` file.

**How to avoid:** Explicitly check the `/pricing` block in `router.ts` and remove `noindex: true`. Also verify no `X-Robots-Tag: noindex` header is returned from the server — `/pricing` is not in `NOINDEX_PREFIXES` (confirmed in `server/src/app.ts` lines 111–120), so no server-side change is needed.

**Warning signs:** `curl -I http://localhost:3000/pricing` shows `X-Robots-Tag: noindex`; or page source contains `<meta name="robots" content="noindex, nofollow">`.

### Pitfall 4: CSP Nonce Missing on New JSON-LD Block

**What goes wrong:** New `<script type="application/ld+json">` block in `index.html` is missing the `nonce="__CSP_NONCE__"` attribute. Helmet's CSP blocks execution of scripts without matching nonce.

**Why it happens:** JSON-LD type attribute does not trigger script execution, so it may seem like nonce is unnecessary. However, Helmet's `scriptSrc` directive applies to `<script>` elements regardless of type.

**How to avoid:** Add `nonce="__CSP_NONCE__"` to the new JSON-LD `<script>` tag, identical to the existing one. The `replaceAll` in `server/src/app.ts` handles multiple occurrences automatically.

**Warning signs:** Browser console CSP error mentioning `application/ld+json`.

### Pitfall 5: `group-open:` Tailwind Variant Not Working

**What goes wrong:** The `group-open:rotate-180` class on the chevron icon inside `<details>` has no effect — the chevron doesn't rotate when the FAQ item is open.

**Why it happens:** Tailwind CSS 4's `group-open:` variant works when a parent element with the `group` class has an `open` attribute. The `<details>` element natively receives `open` attribute when expanded. This should work, but if the `group` class is on the wrong element or `group-open:` variant isn't in the generated CSS, it silently fails.

**How to avoid:** Ensure `group` class is on `<details>` (not `<summary>`), and `group-open:rotate-180` is on the chevron inside. If it doesn't work in dev (cold Tailwind CSS 4 JIT), add any manual CSS override. Alternatively, use JavaScript `toggle` event on `<details>` to swap icon class — this is the JS fallback if the CSS variant fails.

**Warning signs:** Chevron doesn't rotate when FAQ item is opened.

### Pitfall 6: Annual Price Format Inconsistency

**What goes wrong:** The billing toggle shows "$5.40/mo billed annually" but the user context says Pro is "$7/month". The annual calculation is $7 * 12 * 0.78 = $65.52/year ÷ 12 = $5.46/mo (not $5.40). Rounding or math errors create inconsistency.

**Why it happens:** The "22% savings" figure is explicitly required. $7/mo × 12 = $84/year. 22% off = $65.52/year = $5.46/mo billed annually. The exact annual price is a Claude's Discretion item — pick one consistent number and use it everywhere.

**How to avoid:** Choose a clean price point: "$65/year" ($5.42/mo effective) is clean and achieves ~22.6% savings. Or "$5.46/mo billed annually" ($65.52/year). Use the exact same strings in both the DOM and the FAQ answer about billing.

**Warning signs:** The math in the FAQ answer about "How much does annual billing cost?" doesn't match the displayed price.

### Pitfall 7: Pro CTA Before Stripe Is Live

**What goes wrong:** Pro CTA links to `/register?plan=pro` but that page doesn't handle the `plan=pro` query parameter yet (Phase 34 wires Stripe). Users land on a confusing registration page with no indication of what they were trying to do.

**Why it happens:** The CTA must be actionable (not disabled/greyed out per success criteria) but the payment flow doesn't exist yet.

**How to avoid:** The cleanest approach: Pro CTA links to `/register?plan=pro` and the register page ignores the query param for now (silently). This sets up Phase 34 cleanly — Phase 34 will read `?plan=pro` and route the user into Stripe Checkout after registration. The CTA label should be actionable ("Get Pro" or "Start Pro") not "Coming Soon".

---

## Code Examples

### Example 1: Router swap for /pricing

```typescript
// client/src/router.ts — handleRoute()
} else if (path === '/pricing') {
  updatePageMeta({
    title: 'Pricing',
    description: 'Simple, transparent pricing for Torch Secret. Free and Pro plans available.',
    // noindex removed — pricing is SEO-valuable
  });
  import('./pages/pricing.js')
    .then((mod) => mod.renderPricingPage(container))
    .then(() => focusPageHeading())
    .catch(() => showLoadError(container));
}
```

### Example 2: Billing toggle with ARIA switch role

```typescript
function createBillingToggle(onToggle: (isAnnual: boolean) => void): {
  element: HTMLElement;
} {
  let isAnnual = true; // default: annual

  const wrapper = document.createElement('div');
  wrapper.className = 'flex items-center justify-center gap-3';

  const monthlyLabel = document.createElement('span');
  monthlyLabel.className = 'text-sm text-text-secondary';
  monthlyLabel.textContent = 'Monthly';

  // Toggle button styled as a pill switch
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.setAttribute('role', 'switch');
  toggle.setAttribute('aria-checked', 'true');
  toggle.setAttribute('aria-label', 'Billing period');
  toggle.className =
    'relative inline-flex h-6 w-11 items-center rounded-full bg-accent transition-colors ' +
    'focus:outline-hidden focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg ' +
    'cursor-pointer';

  const thumb = document.createElement('span');
  thumb.className =
    'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform translate-x-6';
  toggle.appendChild(thumb);

  const annualLabel = document.createElement('span');
  annualLabel.className = 'text-sm font-medium text-text-primary';
  annualLabel.textContent = 'Annual';

  // Savings badge — always visible, text changes on state
  const savingsBadge = document.createElement('span');
  savingsBadge.className =
    'text-xs font-medium px-1.5 py-0.5 rounded-full bg-success/10 text-success';
  savingsBadge.textContent = '22% savings';

  toggle.addEventListener('click', () => {
    isAnnual = !isAnnual;
    toggle.setAttribute('aria-checked', isAnnual ? 'true' : 'false');
    // Show savings badge only when annual is selected
    savingsBadge.classList.toggle('invisible', !isAnnual);
    // Update thumb position
    thumb.classList.toggle('translate-x-6', isAnnual);
    thumb.classList.toggle('translate-x-1', !isAnnual);
    onToggle(isAnnual);
  });

  wrapper.appendChild(monthlyLabel);
  wrapper.appendChild(toggle);
  wrapper.appendChild(annualLabel);
  wrapper.appendChild(savingsBadge);

  return { element: wrapper };
}
```

### Example 3: Tier card with "Recommended" badge

```typescript
function createProCard(isAnnual: boolean): {
  element: HTMLElement;
  updatePrice: (isAnnual: boolean) => void;
} {
  const card = document.createElement('div');
  card.className =
    'relative p-6 rounded-xl border-2 border-accent bg-surface/90 backdrop-blur-md shadow-xl ' +
    'flex flex-col';

  // Recommended badge — absolute positioned at top
  const badge = document.createElement('div');
  badge.className = 'absolute -top-3 left-1/2 -translate-x-1/2';
  const badgeInner = document.createElement('span');
  badgeInner.className =
    'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ' +
    'bg-accent text-white shadow-sm';
  badgeInner.textContent = 'Recommended';
  badge.appendChild(badgeInner);
  card.appendChild(badge);

  // Tier name
  const tierName = document.createElement('h2');
  tierName.className = 'text-xl font-heading font-semibold text-text-primary mt-4';
  tierName.textContent = 'Pro';
  card.appendChild(tierName);

  // Price display (updated by toggle)
  const priceEl = document.createElement('div');
  priceEl.className = 'mt-2 mb-6';

  const priceAmount = document.createElement('span');
  priceAmount.className = 'text-4xl font-heading font-bold text-text-primary';
  const pricePeriod = document.createElement('span');
  pricePeriod.className = 'text-sm text-text-muted ml-1';

  function setPrice(isAnnual: boolean): void {
    if (isAnnual) {
      priceAmount.textContent = '$65';
      pricePeriod.textContent = '/year';
    } else {
      priceAmount.textContent = '$7';
      pricePeriod.textContent = '/month';
    }
  }
  setPrice(isAnnual);

  priceEl.appendChild(priceAmount);
  priceEl.appendChild(pricePeriod);
  card.appendChild(priceEl);

  // CTA button
  const cta = document.createElement('a');
  cta.href = '/register?plan=pro';
  cta.className =
    'block text-center px-6 py-3 min-h-[44px] rounded-lg bg-accent text-white font-semibold ' +
    'hover:bg-accent-hover focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg ' +
    'focus:outline-hidden transition-all motion-safe:hover:scale-[1.02] cursor-pointer';
  cta.textContent = 'Get Pro';
  cta.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/register?plan=pro');
  });
  card.appendChild(cta);

  // Feature list
  const features = createFeatureList([
    { text: 'Unlimited secrets', included: true },
    { text: '30-day secret expiration', included: true },
    { text: 'Password protection', included: true },
    { text: 'Secret dashboard & history', included: true },
    { text: 'Email notification on view', included: true },
  ]);
  card.appendChild(features);

  return {
    element: card,
    updatePrice: setPrice,
  };
}
```

### Example 4: FAQ item using native details/summary

```typescript
const FAQ_ITEMS: Array<{ question: string; answer: string }> = [
  {
    question: 'Can I cancel my Pro subscription at any time?',
    answer:
      'Yes. Cancel anytime from your billing settings. Your Pro access continues until the end of the current billing period — no partial refunds for unused time.',
  },
  {
    question: 'What is your refund policy?',
    answer:
      'We offer a 7-day money-back guarantee on your first payment. After that, payments are non-refundable, but you can cancel before the next billing date to avoid future charges.',
  },
  {
    question: 'Is there a free trial for Pro?',
    answer:
      "There's no time-limited trial. The Free tier is the trial — use it as long as you like with no credit card required. Upgrade to Pro when you need 30-day expiration or the secret dashboard.",
  },
  {
    question: 'How does billing work?',
    answer:
      'Monthly billing charges your card on the same date each month. Annual billing charges once per year at $65 (about $5.42/month). You can switch billing periods from your account settings.',
  },
  {
    question: 'What payment methods do you accept?',
    answer:
      'We accept all major credit and debit cards (Visa, Mastercard, American Express, Discover) via Stripe. Apple Pay and Google Pay are available on supported devices.',
  },
  {
    question: 'Does Torch Secret see my secret content?',
    answer:
      'No. Secrets are encrypted in your browser using AES-256-GCM before being sent to our servers. The encryption key lives only in the URL fragment and is never transmitted to us — we cannot read your secrets even if compelled to.',
  },
];

function createFaqItem(item: { question: string; answer: string }): HTMLElement {
  const details = document.createElement('details');
  details.className = 'border-b border-border py-4 group';

  const summary = document.createElement('summary');
  summary.className =
    'flex items-center justify-between cursor-pointer list-none ' +
    'text-text-primary font-medium focus:outline-hidden focus:ring-2 focus:ring-accent rounded';

  const questionText = document.createElement('span');
  questionText.textContent = item.question;
  summary.appendChild(questionText);

  const chevron = createIcon(ChevronDown, {
    size: 'sm',
    class: 'text-text-muted transition-transform flex-shrink-0 group-open:rotate-180',
  });
  summary.appendChild(chevron);

  details.appendChild(summary);

  const answer = document.createElement('p');
  answer.className = 'mt-3 text-sm text-text-secondary leading-relaxed';
  answer.textContent = item.answer;
  details.appendChild(answer);

  return details;
}
```

### Example 5: FAQPage JSON-LD block for index.html

The block below must be added to `client/index.html` inside `<head>`, after the existing `WebApplication` JSON-LD block. The Q&A strings must be verbatim copies of the `FAQ_ITEMS` array in `pricing.ts`.

```html
<script type="application/ld+json" nonce="__CSP_NONCE__">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Can I cancel my Pro subscription at any time?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. Cancel anytime from your billing settings. Your Pro access continues until the end of the current billing period — no partial refunds for unused time."
      }
    },
    {
      "@type": "Question",
      "name": "What is your refund policy?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "We offer a 7-day money-back guarantee on your first payment. After that, payments are non-refundable, but you can cancel before the next billing date to avoid future charges."
      }
    },
    {
      "@type": "Question",
      "name": "Is there a free trial for Pro?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "There's no time-limited trial. The Free tier is the trial — use it as long as you like with no credit card required. Upgrade to Pro when you need 30-day expiration or the secret dashboard."
      }
    },
    {
      "@type": "Question",
      "name": "How does billing work?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Monthly billing charges your card on the same date each month. Annual billing charges once per year at $65 (about $5.42/month). You can switch billing periods from your account settings."
      }
    },
    {
      "@type": "Question",
      "name": "What payment methods do you accept?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "We accept all major credit and debit cards (Visa, Mastercard, American Express, Discover) via Stripe. Apple Pay and Google Pay are available on supported devices."
      }
    },
    {
      "@type": "Question",
      "name": "Does Torch Secret see my secret content?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "No. Secrets are encrypted in your browser using AES-256-GCM before being sent to our servers. The encryption key lives only in the URL fragment and is never transmitted to us — we cannot read your secrets even if compelled to."
      }
    }
  ]
}
</script>
```

---

## Key Implementation Decisions

### Decision 1: FAQPage JSON-LD in static index.html (not dynamic)

The PRICE-05 success criterion says "Viewing page source or curl output for `/pricing` includes a `FAQPage` JSON-LD script block in the `<head>`." This explicitly requires server-delivered HTML to contain the JSON-LD — curl does not execute JavaScript. The only way to achieve this in a SPA is to add the block statically to `client/index.html`, where it will be delivered with every request by the Express SPA catch-all. This is the same approach used for the existing `WebApplication` JSON-LD.

### Decision 2: Annual pricing: "$65/year" is the canonical display

$7/month × 12 = $84/year. 22% savings = $84 × 0.78 = $65.52/year. Rounded to "$65/year" gives 22.6% savings — close enough to the "22% savings" label. The "22% savings" label is the authoritative figure from the requirements; "$65/year" is the clean display price. The toggle shows "$65/year" when annual is selected. The FAQ answer about billing says "annual billing charges once per year at $65 (about $5.42/month)." This is internally consistent.

### Decision 3: Pro CTA → `/register?plan=pro`

The Pro CTA must be "clearly actionable and not disabled/greyed out" (CONTEXT.md). Before Stripe is live, the CTA links to `/register?plan=pro`. The register page currently ignores query parameters — Phase 34 will add intent capture. This is the cleanest Phase 34 handoff: Phase 34 reads `?plan=pro` from the URL after registration and routes the user into Stripe Checkout. CTA label: "Get Pro" (cleaner than "Start Pro Trial" since there's no trial).

### Decision 4: Auth-aware CTA deferred to Phase 34

The CONTEXT.md marks auth-aware CTA handling as Claude's Discretion and explicitly allows deferral to Phase 34. For Phase 33, the Pro CTA always links to `/register?plan=pro` regardless of auth state. Phase 34 will update it: authenticated users should go to Stripe Checkout directly, not registration. This keeps Phase 33 scope clean.

### Decision 5: Visual surface — clean flat cards for pricing legibility

Per CONTEXT.md, visual surface treatment is Claude's Discretion. For pricing pages specifically, flat cards with clear visual hierarchy are more legible than glassmorphism — pricing cards need high-contrast price display and clear feature list scanning. The recommendation: Free card uses standard glassmorphism (`bg-surface/80 backdrop-blur-md border-border`), Pro card uses a solid surface with accent border (`bg-surface border-2 border-accent shadow-xl`) to create visual hierarchy without abandoning the design system tokens.

### Decision 6: 6 FAQ items, including the security/privacy entry

The required topics (cancellation, refunds, billing cycle, trial, payment methods) are 5 items. Adding the zero-knowledge/security entry makes 6 — at the minimum required count and naturally reinforces the value prop. The security FAQ ("Does Torch Secret see my secret content?") is the strongest trust signal on the pricing page and belongs here.

---

## Page Section Plan

The pricing page renders in this order:

1. **Page header** — h1 + subheading (Claude's Discretion: "Simple, transparent pricing")
2. **Billing toggle** — monthly/annual pill switch, annual default, "22% savings" badge
3. **Tier cards** — side-by-side Free + Pro cards (stacked on mobile, 2-col grid on sm+)
4. **Trust strip** (optional, between cards and FAQ) — 2-3 one-line trust signals (e.g., "Cancel any time", "No contracts", "Encrypted billing via Stripe")
5. **FAQ section** — h2 heading + 6 `<details>/<summary>` accordion items

---

## State of the Art

| Old Approach | Current Approach | Relevance |
|---|---|---|
| Static HTML pricing pages | SPA pricing page with dynamic billing toggle | SPA in this codebase; toggle state is local, no server round-trip |
| Dynamic JSON-LD injection (JS) | Static JSON-LD in HTML shell | Required for curl-verifiability in an SPA; confirmed by existing WebApplication JSON-LD pattern |
| Hamburger menu | iOS-style bottom tab bar (Phase 32) | Already done; `/pricing` tab already in mobile nav from Phase 32 |
| Accordion via JS class toggle | Native `<details>/<summary>` | HTML5 native approach, zero JS for open/close, accessible by default |

---

## Open Questions

1. **Should the toggle label show "$65/year" or "$5.42/mo billed annually" on the Pro card?**
   - What we know: $65/year (22.6% savings) is the clean price. "$5.42/mo billed annually" is the per-month breakdown.
   - What's unclear: Which format is more familiar to SaaS users? Most B2B SaaS shows monthly equivalent ("$5.42/mo billed annually"), most consumer SaaS shows annual total.
   - Recommendation: Show both — "$65/year" as the primary price (large), "$5.42/mo" as secondary label below it. This is the clearest for pricing page conventions.

2. **What Pro features beyond 30-day expiration to include in the feature list?**
   - What we know: Core differentiator is 30-day expiration (vs Free's shorter max). The codebase already supports: password protection (both tiers), email notifications (both tiers), secret dashboard (authenticated users on both tiers).
   - Recommendation: Differentiate by *access* and *limits* implied by the tiers. Pro feature list: "Unlimited secrets", "Up to 30-day expiration", "Password protection", "Secret dashboard & history", "Email notification on view", "Priority support". Free list: "Up to 7-day expiration", "Password protection", "Up to 10 active secrets". Note: these limits are marketing copy for Phase 33 — actual enforcement is Phase 34+.

3. **Does `group-open:` work reliably in Tailwind CSS 4 with `<details>`?**
   - What we know: Tailwind CSS 4 supports `group-open:` variant via the `open` attribute selector. `<details>` natively adds `open` attribute when expanded.
   - What's unclear: Whether Tailwind CSS 4 JIT generates the `group-open:rotate-180` class reliably when it appears only in DOM-constructed strings.
   - Recommendation: Use the `group-open:` variant in the class string as written. If it fails in practice (no visual rotation), fall back to a `details.addEventListener('toggle', ...)` event handler that manually adds/removes the `rotate-180` class.

---

## Sources

### Primary (HIGH confidence — verified against codebase)

- `client/src/router.ts` — `/pricing` stub location (lines 199–210), `updatePageMeta()` noindex flag, page module import pattern
- `client/src/pages/home.ts` — canonical renderXxxPage pattern, section structure, glassmorphism card classes
- `client/src/components/layout.ts` — existing Pricing nav link (line 93–101), mobile tab Pricing entry (line 223)
- `client/src/components/icons.ts` — `createIcon()` API, `CreateIconOptions`
- `client/src/styles.css` — complete Tailwind CSS 4 design token inventory (bg-surface, border-border, text-accent, etc.)
- `client/index.html` — existing `WebApplication` JSON-LD block with `nonce="__CSP_NONCE__"` pattern; `#app` container structure
- `server/src/app.ts` — `NOINDEX_PREFIXES` array (lines 111–120); `/pricing` is NOT in the list; `replaceAll('__CSP_NONCE__', ...)` replaces all occurrences
- `client/src/pages/dashboard.ts` — status badge pattern, accessible modal pattern
- `client/src/__tests__/accessibility.test.ts` — existing axe-core test pattern; pricing page should follow same convention

### Secondary (MEDIUM confidence)

- FAQPage JSON-LD schema: schema.org/FAQPage — standard structured data type for FAQ content; confirmed supported by Google Search for rich results
- `<details>/<summary>` accessibility: native HTML disclosure widget is accessible by default (keyboard navigable, screen-reader announced); part of HTML5 spec, widely supported

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, all primitives in codebase
- Architecture: HIGH — patterns directly extracted from existing page modules
- JSON-LD injection mechanism: HIGH — confirmed curl-verifiability requirement; static index.html is the only viable approach
- FAQ accordion implementation: HIGH — native HTML `<details>` is the correct approach; Tailwind `group-open:` fallback documented
- Pricing numbers: HIGH — math verified ($7/mo, 22% = $65/year, $5.42/mo equivalent)
- Pitfalls: HIGH — all identified from direct code inspection

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (stable; no external library dependencies)

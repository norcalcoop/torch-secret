---
status: complete
phase: 33-pricing-page
source: 33-01-SUMMARY.md, 33-02-SUMMARY.md, 33-03-SUMMARY.md
started: 2026-02-25T00:00:00Z
updated: 2026-02-26T00:00:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Pricing page loads
expected: Navigate to /pricing. The page should render with a heading (e.g. "Simple, transparent pricing"), two pricing cards (Free and Pro), a billing toggle, and a FAQ section below.
result: pass

### 2. Annual billing default
expected: When the pricing page first loads, annual billing is selected by default. The Pro card shows $65/year with a "$5.42/mo equivalent" sub-label and a "22% savings" badge visible.
result: pass

### 3. Billing toggle switches to monthly
expected: Click the billing toggle to switch to monthly. The Pro card price updates to $7/month. Switching back to annual restores $65/year and the savings badge.
result: pass

### 4. Free tier card
expected: The Free card shows $0/forever. It lists 4 features with check icons (included) and 2 features with minus/X icons (excluded). The card has a glassmorphism appearance (translucent/blur surface).
result: pass

### 5. Pro tier card
expected: The Pro card shows a "Recommended" badge, an accent-colored border, and shadow. Features are listed with check icons. The CTA button links to /register?plan=pro.
result: pass

### 6. Trust strip
expected: Below the pricing cards, three short trust signals are visible: "Cancel any time", "No contracts", and "Powered by Stripe".
result: pass

### 7. FAQ accordion
expected: A FAQ section appears with 6 items. Clicking a question expands its answer; clicking again collapses it. Each item uses native <details>/<summary> behavior.
result: pass

### 8. FAQPage JSON-LD in HTML
expected: The pricing page's FAQPage structured data is embedded statically in the HTML (not injected by JavaScript). You can verify by viewing the page source — the JSON-LD script block with "@type": "FAQPage" should be visible in the raw HTML.
result: pass

## Summary

total: 8
passed: 8
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]

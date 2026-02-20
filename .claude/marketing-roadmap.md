# Marketing Roadmap — Torch Secret

_Last updated: 2026-02-20_

## Phase 1 — Foundation (do these first, in order)

**1. Product Marketing Context** ✅ Done
Everything else pulls from this. Don't skip it.

**2. `/pricing-strategy`**
Define your freemium tiers _before_ writing any copy — pricing shapes every other message. What's free vs. paid? What's the upgrade trigger? You need answers before your homepage, paywall, or email sequences make sense.

**3. `/launch-strategy`**
Plan your Product Hunt, Hacker News "Show HN", and dev community launch. Torch Secret is a perfect HN product — zero-knowledge + open source is catnip for that audience. The skill will help you sequence the launch activities and prep assets.

**4. `/marketing-ideas`**
Brainstorm channel-specific tactics specific to developer tools. Good to run early so ideas can feed into your content and SEO strategy.

---

## Phase 2 — Website & SEO (build the acquisition surface)

**5. `/copywriting`**
Write the homepage, meta descriptions, and any landing pages. Runs off your context doc — you won't have to re-explain the product.

**6. `/competitor-alternatives`**
Create "Torch Secret vs OneTimeSecret", "onetimesecret alternative", "pwpush alternative" pages. These are high-intent SEO pages — people actively searching for alternatives are close to switching.

**7. `/programmatic-seo`**
Scale pages for queries like "how to share [API key / database password / SSH key] securely". Each credential type is a separate landing page. Strong fit for this product because the use cases are highly enumerable.

**8. `/schema-markup`**
Add structured data (WebApplication, FAQ, HowTo) to improve rich snippet visibility in search. Low effort, meaningful SEO uplift.

**9. `/content-strategy`**
Plan blog/educational content around credential security — "why you shouldn't send passwords over Slack", "what is zero-knowledge encryption", etc. Builds topical authority and captures top-of-funnel.

---

## Phase 3 — Conversion (turn visitors into users and users into accounts)

**10. `/page-cro`**
Optimize the homepage for conversion once you have traffic. Tests headline variants, CTA placement, trust signals.

**11. `/signup-flow-cro`**
Optimize the account creation flow. The friction between "anonymous user" and "account holder" is where you'll lose most upgrade attempts.

**12. `/onboarding-cro`**
Optimize what happens after signup — what does the dashboard show first? What's the "aha moment" that makes an account feel worth having?

**13. `/paywall-upgrade-cro`**
Design the in-app upgrade prompts and feature gates. Critical for freemium — the paywall has to feel like an obvious yes, not a wall.

---

## Phase 4 — Retention & Growth

**14. `/analytics-tracking`**
Set up your event tracking (PostHog is already in the v4.0 roadmap). Define the funnel: visit → create secret → create account → upgrade. You can't optimize what you're not measuring.

**15. `/email-sequence`**
Write the onboarding email sequence for new account holders. Goal: get them to use the dashboard, understand the account benefits, and move toward paid.

**16. `/social-content`**
Developer-focused Twitter/X and LinkedIn content. Short-form "did you know your Slack messages are archived forever?" style posts. Torch Secret's zero-knowledge angle is inherently shareable in security circles.

**17. `/referral-program`**
Developer tools spread through referrals. A simple "share Torch Secret, get [X]" mechanic can compound early growth significantly. Worth planning before you have too many users and have to retrofit it.

---

## Phase 5 — Optimization (ongoing)

**18. `/ab-test-setup`**
Run structured experiments on your highest-leverage pages once you have enough traffic — homepage headline, CTA copy, pricing page layout.

**19. `/seo-audit`**
Periodic SEO health checks once content is live. Catches technical issues, cannibalization, and ranking opportunities.

**20. `/paid-ads`**
Developer-targeted Google/Reddit ads when you're ready to invest budget. Run organic and referral channels first — paid amplifies what's already working.

---

## What to skip (for now)

- `/form-cro` — the main form _is_ the product; conversion there is a UX/product problem, not a copy problem
- `/popup-cro` — aggressive for a developer audience; will hurt trust
- `/marketing-psychology` — useful later for pricing/paywall framing, but not a standalone priority at this stage

---

## Recommended starting order right now

`/pricing-strategy` → `/launch-strategy` → `/copywriting`

Those three unlock everything else.

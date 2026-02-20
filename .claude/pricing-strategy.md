# Torch Secret Pricing Strategy

_Last updated: 2026-02-20_

---

## Situation Assessment

Pre-launch, open source, self-serve, developer-first, freemium. That combination shapes everything:

- **Open source sets a price ceiling.** Self-hosting is always an option. The hosted paid tier must be more convenient than running it yourself — not just marginally better.
- **Zero-knowledge is the moat, not a premium feature.** It must stay on the free tier or it undermines the core trust argument.
- **Secrets self-destruct.** Can't charge per-secret the way SMS APIs do — there's no ongoing value delivery to meter. The value is in the _surrounding features_: history, dashboards, team visibility.
- **Anonymous free is the growth engine.** Every recipient who clicks a link and sees a dead-simple UX is a potential convert. Don't add friction to anonymous use.

---

## Value Metric

**Charge for account-tier features (dashboard/history), not secret creation.**

The free anonymous tier should have _unlimited_ secret creation. This is non-negotiable for top-of-funnel. Limits kick in on features that require accounts: number of secrets with active history tracking, team seats, retention period for dashboard records.

---

## Tier Structure

### Free (Anonymous)

- No account required
- Unlimited one-time secrets
- Standard expiration options (1 hour, 24 hours, 7 days)
- Password protection
- No history, no dashboard

### Pro — $9/month (billed annually: $7/month)

- Everything in Free
- Account + dashboard
- Secret history (last 90 days)
- Extended expiration (30 days)
- View receipts ("was it opened?")
- Up to 500 secrets/month with history tracking

### Team — $29/month flat (up to 5 users), $6/user after

- Everything in Pro
- Shared team dashboard
- Team member management
- Usage analytics across team
- Priority support

### Enterprise — Contact for pricing

- Self-hosted license + support contract
- SSO / SAML
- Custom data retention policies
- Compliance documentation (for security audits)
- Dedicated SLA

---

## Price Point Rationale

| Reference                         | Basis                                                   |
| --------------------------------- | ------------------------------------------------------- |
| onetimesecret.com ~$5/month       | Floor — server-side encryption is a weaker product      |
| Developer "impulse buy" threshold | $10–15/month without procurement approval               |
| Team "no-brainer" for small teams | $29/month is under most SaaS expense policy limits      |
| Open source self-hosting          | Price ceiling — Pro can't exceed "weekend hosting cost" |

$9/month sits above weak competitors while staying in impulse-purchase territory for developers who expense tools. The annual discount creates real incentive without being gimmicky.

---

## What to Gate (and What Not To)

**Never gate these:**

- Zero-knowledge encryption (it's the trust foundation)
- Anonymous secret creation
- Password protection
- Basic expiration options

**Gate on Pro:**

- Dashboard / history
- View receipts (confirmation that a link was opened)
- Extended expiration windows
- Higher file size limits (if file support is added)

**Gate on Team:**

- Multi-user shared visibility
- Team analytics
- SSO

The key upgrade friction: _"I shared a secret last week and now I need to rotate it — but I can't remember if it was ever opened."_ That's the Pro upgrade moment.

---

## In-Product Upgrade Triggers

These are the moments to present a Pro prompt:

1. User creates their 4th secret in a session → "Want to track whether your secrets were opened? Upgrade to Pro."
2. User tries to view history → "History requires a Pro account."
3. Secret expires → "Want a 30-day expiration? Available on Pro."
4. User shares a secret for a contractor → "Want to confirm they opened it?"

Keep prompts factual, not pushy. The target audience hates sales pressure.

---

## Pre-Launch Sequencing

1. **Launch with Free + Pro only.** Skip Team until organic team use patterns emerge.
2. **Offer a 14-day free Pro trial, no credit card required.** Let developers experience history and view receipts before asking for money.
3. **Watch for organic team signals** — multiple accounts from the same email domain, high-volume sharing in short windows. That's the trigger to introduce Team.
4. **Don't add usage limits to the free tier at launch.** Artificial limits before trust is established create friction. Add limits once usage distribution data is available.

---

## Annual Discount

Offer 20% off annual (standard SaaS — "2 months free"). Show monthly prices prominently, annual as the "recommended" toggle default.

---

## Critical Risk: Billing Must Not Violate Zero-Knowledge Invariants

Torch Secret's zero-knowledge positioning means **server-side telemetry must never undermine the trust model to support a metered billing scheme.** Do not introduce per-secret counting that requires the server to track secret IDs correlated to users — this violates the invariants codified in `.planning/INVARIANTS.md` and the brand promise.

Billing can only track:

- Seat counts
- Billing events (plan changes, renewals)

Never: secret metadata, secret IDs, or any payload that joins `userId` + `secretId` in the same record.

# Torch Secret Launch Strategy

_Last updated: 2026-02-20_

## Situation Assessment

**Timeline:** 1-2 months to launch
**Starting point:** Zero owned channels
**Primary goal:** Early adopters + feedback
**Audience:** Developers, DevOps engineers, IT admins, security-conscious professionals

**Strategic anchor:** Open source + verifiable zero-knowledge architecture is the asymmetric advantage. Every competitor says "secure." Torch Secret can prove it mathematically. That's rare, and developers respond to it.

---

## Channel Strategy (ORB)

### Owned — Build Now

Start collecting email subscribers before any public mention.

**Pre-launch landing page (set up immediately):**

- One-liner, 2-3 proof points, email capture only (no name, no company — matches the brand)
- Copy: "Zero-knowledge one-time secret sharing. Encrypted in your browser. Destroyed after one view."
- Point GitHub README directly at it

**GitHub as a secondary owned channel:**
Treat the README as a landing page. Structure:

1. One-line hook (zero-knowledge, not "secure")
2. How it works (the architecture, not the features)
3. Demo GIF or screenshot
4. Self-host instructions
5. Link to the hosted version

### Rented — Developer Communities

**Tier 1 (highest priority):**

- **Hacker News — Show HN:** Best single opportunity. Technical/security audience is exactly ICP. Zero-knowledge architecture is a genuine technical story.
- **r/netsec:** Security-focused. True zero-knowledge is a meaningful distinction here.
- **r/selfhosted:** Open source, run your own instance — strong community resonance.

**Tier 2:**

- **r/devops** and **r/sysadmin:** Credential-sharing pain point hits here daily.
- **r/webdev** and **r/programming:** Useful for the architecture story.
- **DEV.to / Hashnode:** Publish the technical writeup here for long-tail SEO.

**Rule:** Don't spread thin. A good Show HN post is more valuable than 10 mediocre subreddit posts.

### Borrowed — Reach Into Existing Audiences

**Developer newsletters (pitch in week 2-3):**

- TLDR Newsletter (1M+ developer subscribers)
- Bytes.dev
- Awesome Security weekly

**Security/developer podcasts (longer lead time, target post-launch):**

- Security Now (TWiT network) — technical depth, perfect audience
- Darknet Diaries — if a good story angle exists
- Changelog / Ship It — OSS, developer tools

**Pitch angle for borrowed channels:** Don't pitch "check out our app." Pitch the architecture story: "Here's how we built a secret-sharing tool where it's mathematically impossible for us to read your secrets — and why that matters."

---

## 6-Week Launch Roadmap

### Week 1-2: Foundation

| Task                                                   | Priority |
| ------------------------------------------------------ | -------- |
| Publish GitHub repo (if not already public)            | Critical |
| Write and polish the README as a landing page          | Critical |
| Set up pre-launch page with email capture              | Critical |
| Create 3-5 "How It Works" draft posts for communities  | High     |
| Draft the Show HN post (iterate before posting)        | High     |
| Submit to TLDR Newsletter, Bytes.dev for consideration | Medium   |
| Record a 30-60 second demo screencast                  | Medium   |

**The demo screencast:** Record paste → create → share link → open in incognito → reveal → confirm it's gone. No narration needed. Most reusable launch asset.

### Week 3-4: Soft Launch (Developer Communities)

**Goal:** 50-100 early users, structured feedback, social proof.

**Show HN — post Tuesday-Thursday, 8am-12pm ET:**

Candidate titles:

- "Show HN: Torch Secret – zero-knowledge one-time secret sharing (key never reaches the server)"
- "Show HN: We built a secret sharing tool where we mathematically cannot read your secrets"
- "Show HN: One-time encrypted secret links – encryption key lives only in URL fragment"

Post structure:

```
Hey HN,

We built Torch Secret to solve a specific problem:
passwords and API keys sent in Slack sit in search
results forever.

What makes this different from onetimesecret.com and
similar tools: the encryption key never reaches our
server. It lives only in the URL fragment (#key), which
per RFC 3986 is never sent in HTTP requests. Even if our
database is breached, there's nothing to decrypt.

Tech: AES-256-GCM, Web Crypto API, client-side only.
Open source — the security claims are auditable.

Would love technical feedback on the crypto
implementation especially.

[link]
```

**Immediately after Show HN:** Post in r/netsec and r/selfhosted. HN momentum helps.

**Feedback collection:** Tally or Typeform linked from the confirmation page or dashboard. 3 questions max:

1. What are you using it for?
2. What almost stopped you from using it?
3. What's the one thing you'd add?

### Week 5-6: Public Launch

**Goal:** Maximize distribution, convert early users to vocal advocates.

**Product Hunt:**
Do it, but treat it as amplification, not the primary launch. Time it 2-3 weeks after Show HN so you have email subscribers to mobilize, GitHub stars as social proof, and early user feedback to quote.

PH listing requirements:

- Thumbnail + gallery screenshots (glassmorphism aesthetic, JetBrains Mono)
- Tagline: "Zero-knowledge one-time secrets. Encrypted in your browser. Destroyed after one view."
- Demo video (reuse the screencast)
- Engage with every comment on launch day

**Technical writeup — publish this week:**
Title: "How we built a secret-sharing tool where it's mathematically impossible for us to read your data."
Cross-post to: DEV.to, Medium (developer/security tags), Hacker News (separate post, technical depth), LinkedIn.

---

## What to Measure (First 30 Days)

| Metric                           | Target |
| -------------------------------- | ------ |
| Secrets created                  | 500+   |
| Return users (created >1 secret) | 15%+   |
| Email captures                   | 200+   |
| Feedback form submissions        | 30+    |
| GitHub stars                     | 100+   |

**Red flags:**

- High abandonment on create page → UX friction
- No one asking about account/Pro features → positioning or timing issue
- Negative technical critique of crypto implementation → address publicly and fast

---

## Channels to Ignore (For Now)

- Twitter/X: Without an existing following, organic reach is near zero for a new account.
- Paid ads: Pre-PMF, paid traffic is expensive learning. Use organic.
- Cold enterprise outreach: Wrong stage.
- YouTube SEO: Long lead time, not worth the effort at this stage.

---

## References

- [Product Marketing Context](.claude/product-marketing-context.md)
- [Pricing Strategy](.claude/pricing-strategy.md)
- [Marketing Roadmap](.claude/marketing-roadmap.md)

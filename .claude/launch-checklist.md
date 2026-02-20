# Torch Secret Launch Checklist

_Last updated: 2026-02-20_

Work through these phases in order. Do not advance to the next phase until all Critical items in the current phase are complete.

---

## Phase 1: Foundation (Week 1-2)

### Product Readiness

- [ ] Core anonymous flow works end-to-end (paste → encrypt → share → reveal → destroy)
- [ ] Password protection works
- [ ] Expiration options work (1h / 24h / 7d)
- [ ] Error states are handled gracefully (expired, already viewed, wrong password)
- [ ] App is live at torchsecret.com with HTTPS

### Repository

- [ ] GitHub repo is public
- [ ] README leads with zero-knowledge architecture explanation
- [ ] README includes demo GIF or screenshot
- [ ] README includes self-hosting instructions
- [ ] README links to the live hosted version
- [ ] LICENSE file is present
- [ ] CONTRIBUTING.md is present (even a short one)
- [ ] Open issues are triaged (close stale, label the rest)

### Pre-Launch Page

- [ ] Landing page live with email capture
- [ ] Copy leads with zero-knowledge guarantee, not feature list
- [ ] GitHub README links to the landing page (or the live app)
- [ ] Email capture connected to a list (Beehiiv, ConvertKit, Mailchimp — any works)

### Launch Assets

- [ ] Demo screencast recorded (30-60 seconds: paste → create → share → reveal → gone)
- [ ] 2-3 screenshots ready (create page, confirmation page, reveal page)
- [ ] Show HN post drafted and reviewed
- [ ] Technical writeup drafted ("How we built a secret-sharing tool where we mathematically cannot read your data")

---

## Phase 2: Soft Launch (Week 3-4)

### Show HN

- [ ] Post scheduled for Tuesday-Thursday, 8am-12pm ET
- [ ] Title tested: leads with the RFC 3986 / URL fragment angle
- [ ] Someone available to respond to comments all day
- [ ] Feedback form ready to link from replies

### Community Posts

- [ ] r/netsec post drafted (different angle/title from Show HN)
- [ ] r/selfhosted post drafted (emphasize open source + self-hosting)
- [ ] r/devops or r/sysadmin post drafted (lead with the Slack/email credential problem)
- [ ] Posts published within 24 hours of Show HN

### Newsletter Pitches

- [ ] TLDR Newsletter pitch sent
- [ ] Bytes.dev pitch sent
- [ ] 1-2 additional security/developer newsletters pitched

### Feedback Loop

- [ ] Feedback form is live and linked (Tally or Typeform, 3 questions max)
- [ ] Feedback form link added to: confirmation page, post-reveal page, README
- [ ] You are personally responding to every piece of early feedback within 24 hours

---

## Phase 3: Public Launch (Week 5-6)

### Product Hunt

**Pre-launch gate (do not launch PH until all checked):**

- [ ] GitHub repo has 50+ stars
- [ ] Email list has 100+ subscribers
- [ ] 2-3 early users willing to leave a first comment on launch day
- [ ] Demo video ready (30-60 seconds)
- [ ] PH listing fully drafted and proofread
- [ ] Tagline finalized: "Zero-knowledge one-time secrets. Encrypted in your browser. Destroyed after one view."
- [ ] Gallery screenshots ready (3-5 images, consistent visual style)
- [ ] Team member available to be online all day on launch day
- [ ] "We launched on Product Hunt" email drafted and ready to send

**Launch day:**

- [ ] PH listing goes live (midnight PT)
- [ ] "We're live on Product Hunt" email sent to list
- [ ] PH launch announced in r/netsec, r/selfhosted, r/devops
- [ ] Every comment responded to within the hour

### Content

- [ ] Technical writeup published (DEV.to canonical)
- [ ] Cross-posted to Medium
- [ ] Hacker News submission (writeup, not Show HN format)
- [ ] LinkedIn post published (if personal presence exists)

### Site

- [ ] torchsecret.com homepage updated to reflect GA (remove any "beta" or "coming soon" language)
- [ ] Pricing page live (Free + Pro tiers)
- [ ] Pro account creation and billing working
- [ ] Basic onboarding for new account holders in place

---

## Phase 4: Post-Launch (Ongoing)

### Momentum

- [ ] Weekly changelog entry published (even small updates signal active development)
- [ ] GitHub star count tracked weekly
- [ ] Feedback form responses reviewed weekly, patterns noted

### Conversion

- [ ] Email onboarding sequence active for new signups (2-3 emails: welcome, key features, upgrade prompt)
- [ ] Upgrade moments instrumented: view receipt prompt, history prompt, 30-day expiration prompt
- [ ] Comparison page live: Torch Secret vs. onetimesecret.com (for SEO + sales)

### Borrowed Channels (Ongoing)

- [ ] Security podcast pitches sent (Security Now, Darknet Diaries, Changelog)
- [ ] Affiliate/referral program evaluated for post-launch period

---

## References

- [Launch Strategy](.claude/launch-strategy.md)
- [Product Marketing Context](.claude/product-marketing-context.md)
- [Pricing Strategy](.claude/pricing-strategy.md)

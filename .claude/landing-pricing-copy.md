# Torch Secret — Landing Page & Pricing Page Copy

_Last updated: 2026-02-21_

---

## Landing Page

### Above the Fold

**Headline (Primary Recommendation):**

> Stop pasting API keys into Slack.

Uses exact customer language ("I needed to send an API key and just… Slacked it. I know."). Opens with a dry, knowing provocation — lands for HN and Reddit audiences who recognize themselves in it.

**Alternatives:**

- Option B: "Share a secret. It self-destructs after one view." — Clear and universal; works better for pure SEO traffic with less product awareness
- Option C: "Your credentials are in Slack forever. They don't have to be." — More argumentative; good for ad targeting

---

**Subheadline:**

> Torch Secret encrypts your secret in the browser before it reaches our servers. The key never leaves your device. One view, then it's permanently deleted.

---

**Primary CTA:** Create a Secure Link

**Micro-copy below CTA:** Free. No account needed.

---

### Trust Bar

Four icon + label pairs:

- AES-256-GCM encryption
- Zero-knowledge architecture
- Open source
- No account for recipients

---

### Problem Section

**Section header:**

> Your credentials are sitting in Slack search results right now.

Slack archives everything. Email stores forever. SMS threads don't expire. Every time you paste a password or API key into a chat, it joins a searchable, long-lived record that outlasts the access it was meant to grant.

The problem isn't that your team is careless. It's that the fast option and the secure option have never been the same thing.

Until now.

---

### How It Works

**Section header:**

> Paste. Share. Gone.

**Step 1 — Paste your secret**
Torch Secret encrypts it in your browser using AES-256-GCM. The encryption key is generated locally and never transmitted to our servers.

**Step 2 — Share the link**
A one-time link is generated. The decryption key lives only in the URL fragment (`#key`) — which browsers never send to servers, per HTTP spec. We cannot read what we store.

**Step 3 — First view destroys it**
When your recipient opens the link, the secret is revealed and permanently deleted from our servers in the same atomic operation. There's nothing left to breach, subpoena, or leak.

---

### Features / Benefits

**Section header:**

> Zero-knowledge. Not just a claim.

| Feature                           | What it means                                                                                                  |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Browser-side encryption**       | AES-256-GCM using the browser's native Web Crypto API. We store only the encrypted blob — never the plaintext. |
| **Key stays in the URL fragment** | The `#key` is never sent to our servers per RFC 3986. We mathematically cannot decrypt your secrets.           |
| **Atomic deletion**               | The server destroys the record the moment the secret is revealed. No copies, no backups, no recovery path.     |
| **No account for recipients**     | They click a link. That's it. No app install, no sign-up, no friction.                                         |
| **Open source**                   | Our security claims are auditable. Read the code — don't take our word for it.                                 |
| **Optional password protection**  | Add a second layer. Even if the link is intercepted, the secret remains protected.                             |

---

### Comparison Section

**Section header:**

> Other one-time tools encrypt on the server. That's a meaningful difference.

onetimesecret.com and Password Pusher encrypt your secret _after_ it reaches their servers. That means their server sees your plaintext. A compromised server = a compromised secret.

Torch Secret encrypts in your browser. The server receives only ciphertext. There is no plaintext to steal.

|                           | **Torch Secret** | onetimesecret.com | Password Pusher |
| ------------------------- | :--------------: | :---------------: | :-------------: |
| Encryption location       |     Browser      |      Server       |     Server      |
| Server sees plaintext     |        No        |        Yes        |       Yes       |
| Key transmitted to server |      Never       |        Yes        |       Yes       |
| Open source               |       Yes        |        No         |       Yes       |
| No account for recipient  |       Yes        |        Yes        |       Yes       |

---

### Objection Handling

**Section header:**

> How does this actually work?

**Q: How do I know you can't read my secrets?**
The encryption key lives in the URL fragment — the `#key` part of the link. Per RFC 3986, browsers never send URL fragments to servers. Our server receives only AES-256-GCM ciphertext. Without the fragment, decryption is computationally impossible. Verify this in our open source code.

**Q: What if the link is intercepted?**
HTTPS protects the full URL in transit. URL fragments are also never logged by servers per HTTP spec. For an extra layer, add password protection — the recipient needs both the link and a password you share separately.

**Q: What if my recipient accidentally opens the link?**
The secret is consumed on first view — that's the model. Set an expiration window (1 hour, 24 hours, or 7 days) so unused links expire cleanly if something goes wrong.

**Q: Do I need an account?**
No. Anonymous secret sharing is free and unlimited — no account, no tracking. Create an account to unlock history, view receipts, and a dashboard.

---

### Final CTA Section

**Header:**

> Your next credential share doesn't have to live in Slack forever.

**Primary CTA:** Create a Secure Link

**Micro-copy:** Free. No account. Encrypted in your browser.

---

---

## Pricing Page

### Header

**Headline:**

> Start free. Upgrade when you need history.

**Subheadline:**
Zero-knowledge encryption is never gated. Create unlimited one-time secrets for free — no account, no tracking. Upgrade for history, view receipts, and team features.

**Toggle:** Monthly / Annual _(Annual recommended — 2 months free)_

---

### Plan Cards

---

#### Free — $0, forever

_For anyone who needs to share a secret right now._

**CTA:** Share a Secret _(no sign-up)_

**Micro-copy:** No credit card. No account.

**Features:**

- Unlimited one-time secrets
- No account required
- Password protection
- Expiration: 1h, 24h, or 7 days
- AES-256-GCM encryption — always
- Zero-knowledge architecture — always

---

#### Pro — $9/mo ($7/mo billed annually)

**Badge:** Most popular

_For individuals who want to know their secrets were opened._

**CTA:** Get Pro

**Micro-copy:** Cancel anytime.

**Features:**

- Everything in Free
- Account + secret dashboard
- Secret history (90 days)
- View receipts — know when a secret was opened
- Extended expiration (up to 30 days)
- 500 secrets/month tracked in history
- Priority email support

---

#### Team — From $29/mo

_For teams who share credentials together._

_$29/mo flat for up to 5 members, then $6/user/mo_

**CTA:** Start Team Trial

**Features:**

- Everything in Pro
- Shared team dashboard
- Up to 5 members included
- Team member management
- Usage analytics
- Priority support

---

#### Enterprise — Custom

_For organizations that need self-hosting and compliance._

**CTA:** Contact Us

**Features:**

- Everything in Team
- Self-hosted deployment
- SSO / SAML
- Custom retention policies
- Compliance documentation (SOC 2, audit logs)
- Dedicated SLA

---

### Trust Line

> Zero-knowledge encryption, anonymous secret creation, and one-time destruction are free on every tier. These are the foundation — not upsell levers.

---

### Pricing FAQ

**Q: Is the encryption gated behind a paid plan?**
Never. AES-256-GCM browser-side encryption, zero-knowledge architecture, and one-time destruction are included on every tier, including Free. These are not features — they're the point.

**Q: What does "secret history" actually store?**
Metadata only: when a secret was created, its expiration window, and whether it was viewed or expired. The actual secret is permanently deleted on first view. History only shows that a secret existed.

**Q: Can team members see each other's secrets?**
No. Team members see metadata on shared secrets — never the plaintext. The zero-knowledge model is maintained across all tiers.

**Q: What counts toward the 500 secrets/month limit?**
Only secrets you create while logged in that are tracked in your history. Anonymous secrets — created without logging in — are always unlimited.

**Q: Can I self-host for free?**
Yes. The codebase is open source. Self-hosting has no cost. Enterprise licensing adds commercial support, compliance documentation, and a dedicated SLA.

**Q: Do you offer a trial for Pro or Team?**
Yes — 14-day trial, no credit card required.

---

### Final CTA

**Header:**

> Start with the free tier. Upgrade if you need to.

**CTA pair:**

- Primary: Get Pro — $9/mo
- Secondary: Share a Secret for Free

---

## Copy Notes

**A/B tests to run first:**

- Headline A ("Stop pasting API keys into Slack") vs. B ("Share a secret. It self-destructs after one view") — A should win with HN/Reddit awareness traffic; B may win for cold SEO traffic
- CTA A ("Create a Secure Link") vs. B ("Share a Secret") — B is shorter and more action-forward

**Deliberately excluded:**

- "Military-grade" — cringe with a technical audience
- "We take security seriously" — implies we can see the data; architecturally false
- Exclamation points — per brand voice

**SEO terms woven in:** "share password securely," "one-time secret link," "send API key safely," "zero-knowledge," "self-destruct"

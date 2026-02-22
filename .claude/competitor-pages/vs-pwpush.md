# Page: Torch Secret vs. Password Pusher (pwpush)

## Metadata

- **URL:** `/vs/pwpush`
- **Title tag:** `Torch Secret vs. Password Pusher — Zero-Knowledge vs. Server-Side`
- **Meta description:** `Password Pusher encrypts server-side and requires paying for hosted access. Torch Secret encrypts in your browser, free to use, no self-hosting required.`
- **Canonical:** `https://torchsecret.com/vs/pwpush`
- **OG title:** `Torch Secret vs. Password Pusher`
- **OG description:** `Both are open source. Both use AES-256-GCM. One of them processes your plaintext on the server.`
- **Schema:** FAQ schema (see FAQ section)

---

## Page Copy

### [Hero]

# Torch Secret vs. Password Pusher

**TL;DR:** Password Pusher is a capable, open source tool with strong self-hosting and audit log features. It uses AES-256-GCM — but server-side, which means their server handles your plaintext before it's encrypted. Torch Secret runs the same encryption algorithm entirely in your browser. The key never reaches us.

---

### [At-a-glance comparison table]

|                            | Torch Secret               | Password Pusher            |
| -------------------------- | -------------------------- | -------------------------- |
| Encryption location        | Browser (client-side)      | Server-side                |
| Zero-knowledge             | Yes                        | No                         |
| Server sees your plaintext | Never                      | Yes, before encryption     |
| Open source                | Yes                        | Yes                        |
| Free hosted tier           | Yes (unlimited)            | No (self-host only)        |
| Recipient needs an account | No                         | No                         |
| Password protection        | Yes (Argon2id)             | Yes (server-side)          |
| File sharing               | No                         | Yes (paid)                 |
| Audit logs                 | Planned                    | Yes (paid hosted)          |
| View count expiration      | No (one view only)         | Yes (expire after N views) |
| API                        | Yes                        | Yes                        |
| Self-host                  | Yes                        | Yes (Docker)               |
| Team features              | Yes (Team plan)            | Yes (Pro plan)             |
| Custom domains             | Planned                    | Yes (Pro)                  |
| Requests (collect secrets) | No                         | Yes (paid)                 |
| Free tier                  | Yes (unlimited, anonymous) | Open source only           |
| Paid starts at             | $9/month (Pro)             | $19/month (Premium)        |

---

### [Section: The encryption difference]

## Same algorithm. Different location. Different trust model.

Password Pusher and Torch Secret both use AES-256-GCM. On paper, that sounds equivalent. It isn't.

**Password Pusher:** Your plaintext is transmitted to their server over HTTPS, then encrypted using a server-managed key. The server derives a unique encryption key per secret — but that key is derived and managed on the server. The server can decrypt any secret it stores. You are trusting their server infrastructure, their key management, and their operational security.

**Torch Secret:** AES-256-GCM runs in your browser before any data is transmitted. Your browser generates a random 256-bit key. That key is placed in the URL fragment (`#key`) and embedded in the share link — never sent to our server. Per HTTP spec (RFC 3986), URL fragments are never transmitted to servers. We receive only encrypted ciphertext, and we have no keys to decrypt it.

The distinction: Password Pusher's security depends on their servers not being compromised or their team not being malicious. Torch Secret's security is architectural — it's not a matter of trust; it's a matter of what information the server physically receives.

---

### [Section: Detailed comparison by category]

## Encryption and trust

**Password Pusher** derives a unique encryption key per push and encrypts each field individually. This is thoughtful server-side encryption. But the key is still derived on the server, and the server manages that key. In a breach scenario, an attacker with database access + key access can decrypt every stored secret.

**Torch Secret** generates encryption keys only in the browser. Our server stores only ciphertext and IV. In a full breach of Torch Secret's database, an attacker recovers a collection of AES-256-GCM ciphertexts with no keys — mathematically useless without the URL fragment that the server never received.

---

## Pricing and access model

Password Pusher has no free hosted tier. To use it for free, you run your own server (Docker is available and well-documented, but it requires infrastructure). For hosted access:

- **Premium (Individual):** $19/month — adds file sharing, one-time upload requests, branding, audit logs
- **Pro (Teams):** $29/month for 5 users, $3/user after — adds custom domains, 2FA management, team policies

Torch Secret is free to use with no account required. The free tier has no arbitrary limits — create as many anonymous secrets as you need. Paid tiers unlock account features:

- **Pro:** $9/month — share history, view receipts, 30-day expiration
- **Team:** $29/month for 5 users — shared dashboard, team management, usage analytics

---

## Self-hosting

Both support self-hosting. Password Pusher has a mature Docker image and extensive documentation — it's been around longer and has a larger self-hosting community.

Torch Secret also ships Docker Compose for production deployment. Self-hosting Torch Secret carries an architectural advantage: because encryption is client-side, compromising your self-hosted server still doesn't expose the plaintext of stored secrets. Your server is a dumb encrypted blob store.

---

## Features Password Pusher has that Torch Secret doesn't (yet)

Be direct here: Password Pusher has features Torch Secret doesn't have today.

- **File sharing** — you can push a file, not just text (paid)
- **Requests** — send a secure link to someone so they can upload a secret to you (paid)
- **View count expiration** — expire after N views, not just the first view
- **Audit logs** — full view trail with timestamps (paid)
- **Custom domains** — brand your instance (Pro)

If your team needs file sharing, inbound secret collection, or compliance-grade audit logs with custom branding today, Password Pusher's Pro plan covers those. Come back to Torch Secret when those features land.

---

## Features Torch Secret has that Password Pusher doesn't

- **True zero-knowledge** — the server is architecturally incapable of reading your secrets
- **Free hosted tier** — no credit card, no self-hosting required
- **View receipts** — know when your specific secret was opened (Pro)
- **Simpler UX** — Password Pusher's interface accumulates features; Torch Secret does one thing with a minimal interface

---

### [Section: Who should use each]

## Who Torch Secret is right for

- Security teams who need verifiable zero-knowledge, not server-side-encrypted "trust us"
- Developers who want a free, zero-friction hosted solution without running infrastructure
- Teams sharing highly sensitive credentials where server trust is not acceptable
- Anyone who wants view receipts — knowing when their specific secret was opened
- Organizations who don't need file sharing or inbound collection today

## Who Password Pusher is right for

- Organizations with existing infrastructure who prefer to self-host everything
- Teams who need file sharing or the Requests (inbound collection) feature
- Compliance teams who need built-in audit logs today
- DevOps teams who want view count expiration (expire after exactly 3 views, for example)
- Groups already integrated with the Password Pusher API

---

### [Section: Migration]

## Moving from Password Pusher to Torch Secret

Nothing to migrate. Existing secrets on Password Pusher will remain until they're viewed or expire. All new secrets go through Torch Secret's link.

For API migrations: both tools follow a create-then-retrieve pattern. The primary difference is that Torch Secret requires client-side encryption before calling the API — the API accepts only encrypted ciphertext, never plaintext. This is intentional and by design.

---

### [Section: FAQ — for schema markup]

## Frequently asked questions

**Does Password Pusher use zero-knowledge encryption?**
No. Password Pusher uses AES-256-GCM server-side. The server derives and manages encryption keys. Your plaintext is transmitted to the server before encryption occurs. The server can decrypt any active secret.

**Does Torch Secret use the same encryption algorithm as Password Pusher?**
Both use AES-256-GCM, but in different locations. Password Pusher runs it server-side; Torch Secret runs it in your browser. The algorithm is the same; the trust model is entirely different.

**Can I self-host both?**
Yes. Both are open source with Docker support. Password Pusher has a larger self-hosting community and more documentation. Torch Secret's self-hosted instance has an architectural advantage: server compromise doesn't expose stored secrets because encryption keys never reach the server.

**Is Password Pusher free?**
The open source code is free — but you must self-host it. There is no free hosted tier on pwpush.com. Torch Secret has a free hosted tier with no account required.

**Does Password Pusher have file sharing?**
Yes, on the paid hosted plans (Premium and Pro). Torch Secret does not currently support file sharing.

---

### [CTA]

## Try Torch Secret

No account. No self-hosting required. Paste your secret, get a link, share once.

**[Create a secure link →]**

Coming from a self-hosted Password Pusher setup? [Read the deployment docs →]

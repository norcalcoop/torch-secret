# Page: Torch Secret vs. OneTimeSecret

## Metadata

- **URL:** `/vs/onetimesecret`
- **Title tag:** `Torch Secret vs. OneTimeSecret — Zero-Knowledge vs. Server-Side`
- **Meta description:** `OneTimeSecret encrypts your secrets on their server. Torch Secret encrypts in your browser — the key never reaches us. One difference that matters.`
- **Canonical:** `https://torchsecret.com/vs/onetimesecret`
- **OG title:** `Torch Secret vs. OneTimeSecret`
- **OG description:** `The same one-time link format. A fundamentally different security model. Here's what that means.`
- **Schema:** FAQ schema (see FAQ section)

---

## Page Copy

### [Hero]

# Torch Secret vs. OneTimeSecret

**TL;DR:** OneTimeSecret is the tool that popularized one-time secret sharing. It works. But it encrypts your secrets on its server — which means the server can read your secret. Torch Secret encrypts in your browser. The key never leaves your device.

---

### [At-a-glance comparison table]

|                            | Torch Secret               | OneTimeSecret           |
| -------------------------- | -------------------------- | ----------------------- |
| Encryption location        | Browser (client-side)      | Server-side             |
| Zero-knowledge             | Yes                        | No                      |
| Server sees your plaintext | Never                      | Briefly, before encrypt |
| Open source                | Yes                        | Yes                     |
| Recipient needs an account | No                         | No                      |
| Password protection        | Yes (Argon2id)             | Yes (bcrypt)            |
| API                        | Yes                        | Yes                     |
| Self-host                  | Yes                        | Yes                     |
| View receipts              | Yes (Pro)                  | No                      |
| Team dashboard             | Yes (Team plan)            | No                      |
| Custom domains             | Planned                    | Yes ($35/month)         |
| Free tier                  | Yes (unlimited, anonymous) | Yes (rate-limited)      |
| Paid starts at             | $9/month (Pro)             | $35/month (Identity+)   |

---

### [Section: The encryption difference — and why it matters]

## The one difference that changes everything

OneTimeSecret and Torch Secret look similar from the outside: paste a secret, get a link, share it, it disappears after one view.

The difference is what happens in the middle.

**OneTimeSecret:** Your plaintext is transmitted to their server over HTTPS, then encrypted server-side. OneTimeSecret manages the encryption keys. They could, in theory, decrypt your secret. Their security depends entirely on their infrastructure and access controls — which you can't verify from outside.

**Torch Secret:** Your secret never leaves your browser in plaintext. AES-256-GCM runs in your browser using the Web Crypto API. The encryption key is generated in your browser and embedded only in the URL fragment (`#key`). Per HTTP spec (RFC 3986), URL fragments are never transmitted to servers — not by the browser, not by network proxies, not logged in server access logs. Our server receives only the encrypted ciphertext.

The result: even if Torch Secret's servers were fully compromised tomorrow, the attacker would have a database of encrypted blobs with no keys to decrypt them. We genuinely cannot read what you store.

---

### [Section: Detailed comparison by category]

## Encryption model

**OneTimeSecret:** Server-side encryption with server-managed keys. They encrypt after receiving your plaintext. When you use a passphrase, it's bcrypt-hashed to verify on retrieval, but the secret itself is still encrypted server-side with OTS-controlled keys. You're trusting their operations team, their server hardening, and anyone who has ever had infrastructure access.

**Torch Secret:** Client-side AES-256-GCM. Your browser generates a 256-bit random key and a 96-bit IV for every single secret. The key exists only in the URL fragment. We store only the encrypted blob. There are no keys on our servers to steal.

Both are open source. Read either codebase and verify for yourself.

---

## Pricing

|                   | Torch Secret                          | OneTimeSecret                   |
| ----------------- | ------------------------------------- | ------------------------------- |
| Free              | Unlimited anonymous secrets           | Rate-limited                    |
| Pro               | $9/month — history, view receipts     | —                               |
| Team              | $29/month — shared dashboard, 5 users | —                               |
| Identity/Branding | Planned                               | $35/month — custom domains only |
| Self-host         | Free (open source)                    | Free (open source)              |

OneTimeSecret's paid tier is essentially a custom domain and branding product. There are no team features, no audit logs, no view receipts at any price. Their paid tier makes sense if your company wants secrets to come from `secrets.yourcompany.com`.

Torch Secret's paid tier unlocks usage features: a personal history of secrets you've sent, view receipts (know when a secret was opened), and an extended 30-day expiration. The Team plan adds shared visibility for your team.

---

## Open source and auditability

Both products publish their source code. For OneTimeSecret, this means you can audit the application logic and confirm secrets are deleted after viewing. But the encryption model is still server-side — the audit confirms deletion, not decryption impossibility.

For Torch Secret, the open source code proves the architectural claim: you can verify that the key is generated in the browser, embedded in the fragment, and never sent to the server. The zero-knowledge claim is not a marketing assertion — it's a logical consequence of the code.

---

## API

Both offer REST APIs for integrating secret sharing into CI/CD pipelines, onboarding workflows, or automation tools. OneTimeSecret's API is mature and widely used. Torch Secret's API covers the same core operations: create a secret, retrieve metadata, verify password.

---

## Self-hosting

Both can be self-hosted. OneTimeSecret requires a Ruby on Rails environment. Torch Secret ships with Docker Compose for local and production deployments.

Self-hosting either tool gives your organization full control over data residency. Self-hosting Torch Secret adds something extra: the zero-knowledge property is preserved even if your self-hosted infrastructure is compromised, because encryption keys exist only in shared URLs.

---

### [Section: Who should use each]

## Who Torch Secret is right for

- Security engineers and developers who need verifiable zero-knowledge — not "trust us, we encrypt it"
- Teams sharing database passwords, SSH keys, API tokens, or anything highly sensitive
- Anyone who audits security tools before using them (open source + architectural proof)
- Organizations that want view receipts — knowing when a secret was opened
- Teams who need to collaborate around secret sharing (shared dashboard)

## Who OneTimeSecret is right for

- Organizations that want a branded, white-labeled URL (`secrets.yourcompany.com`)
- Teams already integrated with the OneTimeSecret API who don't want to change tooling
- Use cases where server-side encryption meets your compliance requirements
- Non-technical users who need the most widely-recognized tool in the category

---

### [Section: Migration]

## Moving from OneTimeSecret to Torch Secret

There is nothing to migrate. Secrets stored on OneTimeSecret will remain there until they're viewed or expire on their own schedule. For all future secrets, you use Torch Secret's link instead.

The recipient experience is identical: they click a link, click "Reveal Secret," and that's the end. No account, no install, no change in workflow for people you share with.

For API users: Torch Secret's API follows the same create/retrieve pattern. The main difference is the shape of the encrypted payload — your integration will need to pass through a client-side encryption step rather than sending plaintext to the API.

---

### [Section: FAQ — for schema markup]

## Frequently asked questions

**Is OneTimeSecret zero-knowledge?**
No. OneTimeSecret encrypts secrets on their server, which means the server handles your plaintext before encrypting it. The company can technically read any secret before it's encrypted. This doesn't mean they do — but it means you're trusting them not to.

**Is Torch Secret zero-knowledge?**
Yes. Encryption happens in your browser before anything is sent to the server. The encryption key is embedded in the URL fragment, which is never transmitted to servers per HTTP spec. Our servers store only ciphertext. We cannot decrypt what we store.

**Can I use both tools?**
Yes. They serve the same surface-level use case. The difference is architectural. If zero-knowledge matters for your threat model, use Torch Secret. If you need custom domains and a branded experience today, OneTimeSecret has that.

**Is Torch Secret open source?**
Yes. You can read and audit the full codebase, including the client-side encryption module.

**Does OneTimeSecret delete secrets after viewing?**
Yes. Both services atomically delete secrets on first view. The difference is the encryption model, not the deletion guarantee.

---

### [CTA]

## Try Torch Secret

No account. No install. Paste your secret, get a link.

Your secret is encrypted in your browser before it reaches us. We store only the ciphertext. When the link is opened once, the record is permanently deleted.

**[Create a secure link →]**

Already using OneTimeSecret's API? [Read the API docs →]

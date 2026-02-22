# Page: Torch Secret vs. Privnote

## Metadata

- **URL:** `/vs/privnote`
- **Title tag:** `Torch Secret vs. Privnote — Open Source vs. Closed, Verified vs. Trust-Us`
- **Meta description:** `Privnote's encryption cannot be audited — it's not open source. Torch Secret is open source, zero-knowledge, and ad-free. Here's the comparison.`
- **Canonical:** `https://torchsecret.com/vs/privnote`
- **OG title:** `Torch Secret vs. Privnote`
- **OG description:** `Privnote says it encrypts in your browser. You can't verify that. With Torch Secret, you can.`
- **Schema:** FAQ schema (see FAQ section)

---

## Page Copy

### [Hero]

# Torch Secret vs. Privnote

**TL;DR:** Privnote is one of the oldest tools in this category and still widely used. It claims browser-side encryption. But because it's not open source, that claim is unverifiable. Torch Secret makes the same security guarantee — and backs it with auditable code.

---

### [At-a-glance comparison table]

|                              | Torch Secret                     | Privnote                      |
| ---------------------------- | -------------------------------- | ----------------------------- |
| Encryption location          | Browser (verified)               | Browser (claimed, unverified) |
| Zero-knowledge               | Yes (verifiable)                 | Claimed (unverifiable)        |
| Open source                  | Yes                              | No                            |
| Auditable code               | Yes                              | No                            |
| Ad-free                      | Yes                              | No (ad-supported)             |
| Password protection          | Yes (Argon2id, server-side)      | No (reference phrase only)    |
| API                          | Yes                              | No                            |
| Self-host                    | Yes                              | No                            |
| View receipts                | Yes (Pro)                        | Yes (email notification)      |
| Account required (recipient) | No                               | No                            |
| Phishing clone risk          | Low (open source, self-hostable) | High (documented problem)     |
| Free tier                    | Yes, unlimited, no ads           | Yes, ad-supported             |
| Paid tier                    | $9/month (Pro)                   | None                          |

---

### [Section: The core tension]

## "We encrypt in your browser." Prove it.

Privnote claims its notes are AES-256 encrypted in the browser before reaching their servers. If true, that's a meaningful security guarantee.

The problem: you cannot verify it. Privnote is closed source. No one outside the company can confirm that the code running in your browser does what they say it does. You're trusting a marketing claim with no audit path.

This is not a theoretical concern. Security researchers have noted that Privnote clone sites — identical interfaces served from lookalike domains — exist specifically to intercept notes before they're encrypted, delivering decryptable data to the attacker instead. The absence of open source code makes it harder to distinguish authentic Privnote from a clone.

**Torch Secret is open source.** You can read the encryption module, verify that key generation happens in the browser using the Web Crypto API, confirm the key is embedded in the URL fragment and never transmitted, and reproduce the entire security model yourself. The zero-knowledge property is not a claim — it's a logical consequence of the code, readable by anyone.

---

### [Section: Detailed comparison by category]

## Encryption and verifiability

**Privnote:** Claims AES-256 client-side encryption with the key in the URL fragment. If accurate, this is a good model. But the code is not public. You cannot audit it. You cannot verify that plaintext doesn't also pass through their server. You cannot confirm that the "delete on view" is atomic and complete. You are trusting their word.

**Torch Secret:** AES-256-GCM runs in your browser via the Web Crypto API. The encryption key is generated in the browser (`crypto.getRandomValues`) and placed only in the URL fragment. The server receives only the encrypted blob plus IV. The code is on GitHub. Read it. Deploy it yourself. Every part of the security model is verifiable.

---

## Password protection

**Privnote:** Offers a "reference phrase" — a label the sender sets that the recipient must know. This is a shared secret for identity confirmation, not cryptographic password protection on the note itself. It does not add an encryption layer.

**Torch Secret:** Password protection adds a real second factor. The password is verified server-side using Argon2id (OWASP-recommended parameters). A note with password protection requires both the URL (containing the encryption key) and the password to be revealed. Two separate channels, two separate factors.

---

## API and integrations

**Privnote:** No API. You can only create notes through the web interface.

**Torch Secret:** REST API. Integrate secret sharing into onboarding flows, CI/CD pipelines, deployment scripts, or internal tooling.

---

## Self-hosting

**Privnote:** Cannot be self-hosted. There is only one instance: privnote.com.

**Torch Secret:** Fully self-hostable via Docker Compose. If you run your own instance, you eliminate all third-party trust: you control the server, and encryption still happens client-side, so even you can't read stored secrets.

---

## Ads

**Privnote:** Ad-supported. Ads appear on the interface for a tool you're using to handle sensitive credentials. This is not inherently a security risk, but it creates a trust friction: a tool monetized through third-party ad networks, handling your secrets, with no auditable code.

**Torch Secret:** No ads. Free tier is funded by Pro/Team subscriptions.

---

## The phishing clone problem

Privnote has a documented phishing problem. Sites like `privnot.com`, `privnotes.com`, and others serve identical interfaces designed to capture your note before encryption or to redirect you to a real page after harvesting the content.

Because Privnote is closed source and hosted only on one domain, there's no easy way for users to verify they're on the legitimate site or distinguish the real site from a clone by examining behavior.

Torch Secret is open source and self-hostable. If your organization is concerned about domain spoofing, you can run your own instance. The code is identical; the trust is internal.

---

### [Section: Who should use each]

## Who Torch Secret is right for

- Anyone who wants verifiable security — open source code that proves the zero-knowledge claim
- Developers who need an API for workflow integration
- Teams sharing actual credentials (API keys, passwords, tokens) where unverifiable encryption is not acceptable
- Organizations that need password protection as a real second factor
- Users who don't want ads on a security tool

## Who Privnote is right for

- Casual users sharing non-critical notes who don't need an audit trail
- Non-technical users who want the simplest possible interface and aren't sharing high-stakes credentials
- People who need nothing more than "this note disappears after one view" for low-sensitivity content

---

### [Section: Migration]

## Moving from Privnote to Torch Secret

No data to migrate. For all future secrets, use Torch Secret's link. The recipient experience is equivalent: click a link, the note appears, it's gone. No account required.

If you've been using Privnote for casual notes and want to start using Torch Secret for actual credentials, the upgrade in security properties is meaningful even if the surface-level workflow is identical.

---

### [Section: FAQ — for schema markup]

## Frequently asked questions

**Is Privnote zero-knowledge?**
Privnote claims browser-side encryption with the key in the URL fragment — which would be zero-knowledge if true. But the code is closed source and cannot be verified. You cannot confirm that plaintext doesn't also pass through their server.

**Is Torch Secret open source?**
Yes. The full codebase — including the client-side encryption module — is on GitHub. You can read it, audit it, and deploy it yourself.

**Does Privnote have an API?**
No. Privnote has no API. Torch Secret has a REST API for programmatic secret creation and retrieval.

**Can I self-host Privnote?**
No. Privnote can only be used at privnote.com. Torch Secret can be self-hosted via Docker Compose.

**Is Privnote free?**
Yes, but ad-supported. Torch Secret's core functionality is free and ad-free.

**What is the Privnote phishing clone problem?**
Multiple lookalike domains (slight misspellings of privnote.com) serve identical interfaces designed to intercept notes. Because Privnote is closed source and single-hosted, users have no easy way to distinguish authentic from clone. Torch Secret's open source nature and self-hosting option reduce this risk significantly.

---

### [CTA]

## Try Torch Secret

Open source. Zero-knowledge. Ad-free. No account required.

Paste your secret. We encrypt it in your browser before it reaches our server. Share the link once, and it's gone.

**[Create a secure link →]**

Want to verify the security claims? [Read the source on GitHub →]

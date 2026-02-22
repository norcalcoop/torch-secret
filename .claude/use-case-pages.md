# Use Case Pages — Strategy + Full Copy

_Last updated: 2026-02-21_

---

## Strategy

### Opportunity

Competitor comparison pages target people who know the category. Use case pages capture people who don't know Torch Secret exists — they're searching for a solution to a specific problem. This is mid-to-bottom funnel intent: higher conversion than blog content, lower competition than branded comparison terms.

The search patterns are problem-defined:

- "[credential type] + securely / safely"
- "send [credential type] + without [channel]"
- "share [credential type] + [context]"

These searches already have one foot in the door: the person knows sharing credentials insecurely is wrong and is actively looking for a better way. The job of each page is to (1) confirm they have the right problem and (2) hand them the solution immediately.

---

### Pages (8 total)

| URL                                      | H1                                                   | Primary Keywords                                                                                                  |
| ---------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `/use/share-api-keys`                    | How to Share API Keys Securely                       | "share api key securely", "how to share api keys", "send api key safely"                                          |
| `/use/share-database-credentials`        | How to Share Database Credentials Securely           | "share database credentials securely", "send database password safely"                                            |
| `/use/share-ssh-keys`                    | How to Share SSH Keys Without Email or Slack         | "share ssh keys securely", "send ssh private key safely", "how to share ssh key"                                  |
| `/use/send-password-without-email`       | How to Send a Password Without Email                 | "send password without email", "share password securely", "email password safely"                                 |
| `/use/share-credentials-without-slack`   | How to Share Passwords Without Pasting Them in Slack | "share credentials slack", "share password slack", "credentials in slack alternative"                             |
| `/use/share-env-file`                    | How to Share a .env File Securely                    | "share .env file securely", "send env file to developer", "share environment variables securely"                  |
| `/use/share-credentials-with-contractor` | How to Share Credentials with a Contractor Safely    | "share credentials with contractor", "give api key to contractor", "send password to contractor"                  |
| `/use/onboarding-credential-handoff`     | How to Share Credentials During Employee Onboarding  | "share credentials new employee", "employee onboarding passwords securely", "it admin share passwords onboarding" |

---

### URL structure

`/use/[slug]` — separated cleanly from `/vs/` and `/alternatives/` namespaces.

**Hub page:** `/use/` — index page with one-paragraph description and links to all 8 pages. Thin content protection + crawl path.

---

### Internal linking architecture

- Every use case page → main CTA (create a secret)
- Every use case page → 2–3 related use case pages (contextually chosen — see each page)
- Every use case page → `/use/` hub
- `/use/` hub → `/vs/` and `/alternatives/` competitor pages (cross-intent contamination)
- Homepage → `/use/` hub in footer or "Use cases" nav section

---

### Schema markup

Each page implements:

- **`HowTo`** — on the step-by-step section
- **`FAQPage`** — on the FAQ section

---

### Page template (all 8 follow this structure)

1. **Hero** — H1 targeting the keyword, one-sentence TL;DR
2. **The problem** — current behavior, why it persists, why it's dangerous
3. **What's at stake** — concrete consequences of a leak (specific to credential type)
4. **The solution** — how Torch Secret works for this exact use case
5. **Step-by-step** — 4–6 steps (HowTo schema target)
6. **Why zero-knowledge matters here** — technical specificity to this use case
7. **Who uses Torch Secret for this**
8. **FAQ** — 4–5 questions (FAQPage schema target)
9. **CTA**

---

### What makes each page unique (not just swapped variables)

Each page is differentiated by:

- The specific risk vector of that credential type
- The specific failure mode of the insecure alternative
- The specific workflow step where Torch Secret fits
- Unique FAQ questions drawn from real objections for that use case

---

---

## Page Copy

---

### Page 1: `/use/share-api-keys`

#### Metadata

- **URL:** `/use/share-api-keys`
- **Title tag:** `How to Share API Keys Securely — One-Time Encrypted Links`
- **Meta description:** `API keys shared over Slack or email live forever in message history. Torch Secret encrypts them in your browser and destroys the record after one view.`
- **Canonical:** `https://torchsecret.com/use/share-api-keys`
- **OG title:** `How to Share API Keys Securely`
- **OG description:** `Paste an API key, get a one-time encrypted link. The key is deleted the moment it's opened. No Slack history, no email archive.`
- **Robots:** index, follow
- **Schema:** HowTo + FAQPage

---

#### Page Copy

# How to Share API Keys Securely

**TL;DR:** Paste your API key into Torch Secret, share the one-time link, and the key is permanently deleted the moment your recipient opens it. No Slack history. No email archive. No trace.

---

## The problem with how API keys get shared

You need to get an API key to a developer, a contractor, or a colleague. You have two seconds. You paste it into Slack or fire it off in an email.

This is how almost everyone does it. It also means your API key now lives permanently in:

- Your Slack message history, searchable by any workspace admin
- Your sent mail folder, indefinitely
- Your recipient's inbox, indefinitely
- Any email archive your organization retains for compliance
- Any third-party Slack integration that has read access to your channels

Slack messages and emails don't disappear when you forget about them. And API keys are the kind of credential that sits in those archives long after you've forgotten they existed.

---

## What's at stake

A leaked API key is not a low-severity event:

- **Unauthorized charges:** A leaked AWS or Stripe key can drain your account overnight
- **Data breach:** A database API key gives an attacker read/write access to production data
- **Service compromise:** A third-party integration key exposes your entire data pipeline
- **Compliance violation:** Many compliance frameworks (SOC 2, HIPAA, PCI-DSS) treat uncontrolled credential exposure as an incident

GitHub runs automated secret scanning on public commits for this reason. It still finds 10 million exposed secrets per year. Most of them got there because someone shared them over an insecure channel first.

---

## The solution

Torch Secret is a zero-knowledge, one-time secret sharing tool built specifically for this workflow.

**What happens when you use it:**

1. Your API key is encrypted in your browser using AES-256-GCM before it ever reaches the server
2. The encryption key lives only in the URL fragment (`#key`), which per HTTP spec (RFC 3986) is never transmitted to any server — not to Torch Secret, not to Slack, not to email servers
3. Your recipient opens the link, their browser decrypts the key locally, and the server record is immediately and permanently deleted
4. If anyone finds the old link later — in a Slack search, an email thread, a browser history — they get "secret not found"

The server never holds anything decryptable. A full database dump reveals only encrypted ciphertext with no keys to decrypt it.

---

## How to share an API key securely (step by step)

**Step 1: Paste your API key**
Open Torch Secret, paste your API key into the text field. You can include multiple keys or add context (service name, scope, which environment) in the same secret.

**Step 2: Set an expiration**
Choose how long the link remains valid before it self-destructs: 1 hour for urgent handoffs, 24 hours for same-day async, 7 days for async workflows. If the link expires before it's opened, it's deleted.

**Step 3: Add a password (optional)**
For highly sensitive keys, add a password the recipient must enter before the key is revealed. Share the password over a separate channel. This is a second factor — the attacker needs both the link and the password.

**Step 4: Copy the secure link**
Share it however is convenient — Slack, email, text, Jira ticket. The channel no longer matters because the actual key is never in the channel. Only the link is.

**Step 5: Recipient opens and decrypts**
Your recipient clicks the link. Their browser fetches the encrypted blob and decrypts it locally. They copy the API key. The server record is permanently deleted.

**Step 6: Verify and rotate if needed**
After sharing, confirm with your recipient that they received it. If they have trouble (link expired, opened accidentally), generate a new secret. Rotate the old key if you're concerned it was exposed.

---

## Why zero-knowledge matters specifically for API keys

When you paste an API key into Slack, the key is stored as plaintext on Slack's servers. Slack admins can read it. Third-party apps connected to your workspace may have read access. If Slack's infrastructure is ever breached, your key is in the leak.

When you send it over email, both your server and your recipient's server log the message content. It lives in both inboxes indefinitely.

With Torch Secret, the server never sees the plaintext API key at any point. What's stored is an encrypted blob produced by your browser. Without the URL fragment — which is never logged by any server — the blob is permanently undecryptable. Even if Torch Secret's database were fully compromised, the attacker would have ciphertext with no keys.

This isn't a marketing claim. It's a consequence of the architecture. The code is open source — you can verify it.

---

## Who uses Torch Secret for API key sharing

- **Developers** handing off service credentials to teammates during sprint onboarding
- **DevOps engineers** delivering cloud API keys (AWS, GCP, Azure) to contractors
- **Engineering leads** sharing third-party integration keys (Stripe, Twilio, SendGrid) with new team members
- **Freelancers** receiving client API keys at project start — one-time delivery, then the link is gone
- **Security teams** distributing temporary credentials for penetration testing engagements

---

## Frequently asked questions

**Can I share multiple API keys in one link?**
Yes. Paste all of them into a single secret — the service name, the key, the environment, any notes. It all encrypts as one blob.

**Does Torch Secret log which API key I shared?**
No. The server stores only the encrypted ciphertext. The server never sees the plaintext key. Log files contain no secret content — secret IDs are even redacted from URL logs.

**What if my recipient accidentally opens the link before they're ready?**
Add a password. They'll need to enter it before the key is revealed, which prevents accidental reveals and adds a second factor. If the key is consumed accidentally, generate a fresh secret.

**What if the link expires before my recipient opens it?**
The encrypted record is deleted on expiration. Generate a new secret with a longer expiration and share a fresh link.

**How is this different from encrypting an email with PGP?**
PGP-encrypted email still sits in both inboxes indefinitely. The key is protected in transit, but the email itself remains permanently stored. Torch Secret destroys the record on first view — there is no permanent copy.

---

## Try Torch Secret

No account. No install. Paste your API key, get a link.

The key is encrypted in your browser before it reaches our servers. We store only ciphertext. When the link is opened once, the record is permanently and atomically deleted.

**[Create a secure link →]**

---

_Related: [How to Share Database Credentials Securely](/use/share-database-credentials) · [How to Share Credentials with a Contractor](/use/share-credentials-with-contractor) · [How to Share SSH Keys Securely](/use/share-ssh-keys)_

---

---

### Page 2: `/use/share-database-credentials`

#### Metadata

- **URL:** `/use/share-database-credentials`
- **Title tag:** `How to Share Database Credentials Securely — Zero-Knowledge One-Time Links`
- **Meta description:** `Database passwords shared over Slack or email persist forever. Torch Secret encrypts credentials in your browser and permanently deletes them after one view.`
- **Canonical:** `https://torchsecret.com/use/share-database-credentials`
- **OG title:** `How to Share Database Credentials Securely`
- **OG description:** `The skeleton key to your data shouldn't live in a Slack message forever. Share it once. Destroy it. Move on.`
- **Robots:** index, follow
- **Schema:** HowTo + FAQPage

---

#### Page Copy

# How to Share Database Credentials Securely

**TL;DR:** Database credentials are the keys to all your data. Sharing them over Slack or email leaves a permanent copy in message history. Torch Secret encrypts them in your browser, delivers them once, and permanently destroys the record.

---

## The problem

A developer joins the team. They need the database connection string. Someone pastes it into Slack.

This is standard. It is also one of the most dangerous credential sharing patterns in software teams.

Database credentials are the highest-privilege secrets most developers handle. The username, password, and host for your production database — or even your staging database — grant read and write access to everything. And when those credentials are shared over Slack or email:

- They sit in your Slack message history, searchable by any workspace admin
- Every admin in your Slack organization can read private DMs
- Your email client retains a copy in your sent folder indefinitely
- The recipient's inbox retains a copy indefinitely
- If either person's email account is ever compromised, so is your database

---

## What's at stake

A leaked database credential is not a minor incident:

- **Full data exposure:** An attacker with your production database password has access to every record you've ever stored
- **Write access:** They can modify, corrupt, or delete data — not just read it
- **Compliance breach:** GDPR, HIPAA, SOC 2, and PCI-DSS all treat exposed production credentials as reportable incidents
- **Cascading impact:** Most applications have a single database user with broad permissions — one leaked credential often means total data access

The problem compounds over time. The credential shared in a Slack DM two years ago is still there, in the thread, searchable and readable by whoever currently has admin access.

---

## The solution

Torch Secret generates a zero-knowledge one-time link. Paste your database credentials, send the link, and the record is permanently deleted the moment your recipient opens it.

**What the workflow looks like:**

1. Paste the full connection string (or just the password) into Torch Secret
2. Set an expiration window appropriate for your handoff timeline
3. Share the link via any channel — Slack, email, doesn't matter
4. Your recipient opens it once, copies the credentials, and the record is gone
5. Anyone who finds the old link later gets "secret not found"

The server holds only an encrypted blob. The decryption key lives only in the URL fragment, which is never transmitted to any server. A full database dump of Torch Secret's infrastructure reveals nothing decryptable.

---

## How to share database credentials (step by step)

**Step 1: Prepare the credential payload**
Format your database credentials clearly — include the host, port, database name, username, and password in one secret. You can also include notes about environment (staging vs. production) and access scope.

**Step 2: Set a short expiration**
Database credentials warrant urgency. Use 1–24 hours unless your recipient is in a significantly different timezone. If the link expires unopened, the encrypted record is deleted automatically.

**Step 3: Consider adding a password**
For production credentials, add a password protection layer. Share the secret link via Slack and the unlock password via a different channel (a text message, a voice call). The attacker needs both.

**Step 4: Share the link**
Send the Torch Secret link to your recipient. The actual credentials are not in the Slack message or email — only the link is.

**Step 5: Confirm receipt**
Follow up to confirm your recipient opened and saved the credentials. If they had trouble, generate a new secret.

**Step 6: Rotate on the old schedule**
Sharing credentials via Torch Secret does not eliminate the need for periodic rotation. But it does mean you're not accumulating plaintext copies of current credentials in archived chat logs.

---

## Why zero-knowledge matters for database credentials

Database credentials are specifically targeted in breach scenarios because attackers know that compromising a single credential often means total data access.

The relevant threat models:

- **Slack breach:** Your Slack workspace history is exposed. Any credential shared in any message or DM is now accessible to the attacker.
- **Email breach:** A compromised email account gives an attacker access to years of sent mail. Credentials in those emails are now in the attacker's hands.
- **Insider threat:** A disgruntled admin with Slack access can search message history for database credentials shared months or years earlier.
- **Legal discovery:** In litigation, Slack message exports and email archives are discoverable. Credentials in those archives may be exposed to parties outside your organization.

With Torch Secret, the plaintext credential never enters any of these systems. The link in the Slack message leads to an encrypted blob that is deleted on first view. The credential isn't in Slack. It isn't in email. It existed in Torch Secret's database for minutes or hours, as ciphertext, and then it didn't.

---

## Who uses Torch Secret for database credential sharing

- **Engineering leads** delivering staging and production database access to new developers
- **IT admins** setting up new team members with database access during onboarding
- **DevOps teams** sharing RDS, Cloud SQL, or Postgres credentials for infrastructure work
- **Contractors** receiving database access for a specific engagement — one-time delivery, no permanent copy
- **Security engineers** distributing read-only credentials for audit or penetration testing engagements

---

## Frequently asked questions

**Can I include the full connection string in one secret?**
Yes. Paste the entire string — `postgresql://username:password@host:5432/dbname` — as a single secret. Add a note about which environment it's for if helpful.

**What if I need to share the same credentials with multiple people?**
Generate a separate secret for each recipient. Each link is one-time. This also gives you a clear record of who received which set of credentials.

**Does the server ever see the database password?**
No. Encryption happens in your browser before anything is transmitted. The server stores only the encrypted ciphertext and the IV. It has no decryption key.

**What if the recipient accidentally opens the link before they're ready to copy the credentials?**
Add a password. They must enter the password before the secret is revealed, which prevents accidental reveals. If it's consumed, generate a new secret and rotate the credentials if you have concerns.

**How does this compare to using a secrets manager?**
Secrets managers (Vault, AWS Secrets Manager) are the right tool for applications to retrieve credentials programmatically. Torch Secret is the right tool for humans to share credentials with other humans. They're complementary — you might use Torch Secret to share the Vault master password with a new team member.

---

## Try Torch Secret

No account required. No install. Paste the credentials, get a link.

The credentials are encrypted in your browser. We store only the encrypted result. When the link is opened once, the record is permanently deleted.

**[Create a secure link →]**

---

_Related: [How to Share API Keys Securely](/use/share-api-keys) · [How to Share Credentials During Employee Onboarding](/use/onboarding-credential-handoff) · [How to Share .env Files Securely](/use/share-env-file)_

---

---

### Page 3: `/use/share-ssh-keys`

#### Metadata

- **URL:** `/use/share-ssh-keys`
- **Title tag:** `How to Share SSH Keys Without Email or Slack`
- **Meta description:** `SSH private keys shared over email or Slack leave permanent copies in both inboxes. Torch Secret delivers them once and destroys the record immediately.`
- **Canonical:** `https://torchsecret.com/use/share-ssh-keys`
- **OG title:** `How to Share SSH Keys Without Email or Slack`
- **OG description:** `An SSH private key in your sent mail is a master key you can't take back. Share it once, destroy it, rotate it.`
- **Robots:** index, follow
- **Schema:** HowTo + FAQPage

---

#### Page Copy

# How to Share SSH Keys Without Email or Slack

**TL;DR:** An SSH private key in your sent mail folder is a copy of a master key that never goes away. Torch Secret delivers it once, destroys the record on open, and leaves nothing in any archive.

---

## The problem with emailing SSH keys

You need to give someone SSH access to a server. The obvious path: email them the private key, they add it to `~/.ssh/authorized_keys`.

The problem: that email is now in your sent folder. It's in their inbox. If either of you is ever breached, the attacker has a copy of the private key. If your organization archives email for compliance, it lives in that archive indefinitely. Unlike a password, you can't just see a leaked SSH key and change the user's password — the key may be deployed across dozens of servers.

SSH private keys are particularly dangerous to leak because:

- They're long-lived by default — many organizations never rotate them
- A single private key may authenticate to multiple servers
- Identifying which servers the key authorizes is often non-trivial
- Rotating an SSH key means updating `authorized_keys` on every server it's deployed on

One leaked private key, combined with the human tendency to never rotate SSH credentials, is a very durable access vector for an attacker.

---

## What's at stake

- **Persistent unauthorized access:** An attacker with your SSH private key can silently authenticate to any server that trusts it, for as long as the key isn't rotated
- **Lateral movement:** From one server, an attacker with SSH access can often pivot to others on the same network
- **Compromised infrastructure:** Production servers, build systems, deployment pipelines — all accessible via SSH
- **No audit trail:** SSH key authentication often produces less logging than password authentication; access via a stolen key may go unnoticed

---

## The solution

Torch Secret delivers SSH private keys as zero-knowledge one-time links.

Paste the private key contents, share the link, and your recipient downloads and saves the key. The record is permanently deleted the moment the link is opened. Anyone who finds the link later — in an email thread, a Slack archive, a browser history — sees nothing.

The key is encrypted in your browser before it ever reaches the Torch Secret server. The server stores only the ciphertext. The decryption key lives only in the URL fragment, which is never transmitted to any server per HTTP spec.

---

## How to share an SSH key (step by step)

**Step 1: Paste the private key contents**
Open Torch Secret and paste the full contents of the private key file — including `-----BEGIN OPENSSH PRIVATE KEY-----` and `-----END OPENSSH PRIVATE KEY-----`. You can add a note about which server(s) the key authorizes and where to install it.

**Step 2: Set a short expiration**
SSH private keys warrant a short expiration window: 1–4 hours if you're coordinating in real time, 24 hours if the handoff is async. If the link expires, the record is deleted automatically.

**Step 3: Add a password**
For server access credentials, use password protection. Share the Torch Secret link over Slack and the unlock password via a text message or phone call. This means an attacker with access to only one channel cannot retrieve the key.

**Step 4: Share the link**
Send the Torch Secret link to your recipient. The private key is not in the message — only the link is.

**Step 5: Confirm and rotate**
Confirm your recipient received and installed the key. After sharing, add the public key to `authorized_keys` if you haven't already, and schedule rotation of the private key after the immediate need is met. Treat the shared private key as provisionally compromised until you've verified the recipient has it securely stored.

---

## Why zero-knowledge matters for SSH keys

The threat model for SSH keys is different from API keys or passwords.

With an API key, you can rotate it in seconds — invalidate the old key in the service dashboard, issue a new one. Done. The window of exposure is bounded by how quickly you act.

With SSH private keys, rotation is operationally expensive. Every server that trusts the key needs its `authorized_keys` updated. Many organizations skip rotation entirely because of this cost. This means a private key shared in an email three years ago may still be a valid entry point today.

When you share via Torch Secret, the private key is never stored in any email inbox or Slack message. There is no accumulated archive of plaintext SSH keys to clean up. The link exists, is consumed once, and the server record is gone.

---

## Who uses Torch Secret for SSH key sharing

- **DevOps and SRE teams** granting server access to new engineers during onboarding
- **System administrators** delivering jumpbox or bastion host credentials to contractors for a specific engagement
- **Developers** handing off deployment access during team handoffs or off-boarding
- **Security engineers** delivering SSH access for penetration testing engagements with a defined scope and time window

---

## Frequently asked questions

**Can I share the SSH key and the passphrase in one secret?**
Yes. Paste both into a single Torch Secret — the key, the passphrase, and any installation instructions. It all encrypts as one blob.

**What's the size limit for a secret?**
Torch Secret handles typical SSH private key sizes (a few kilobytes) without issue. There is no limit that would affect standard RSA, ECDSA, or Ed25519 key files.

**Should I delete the private key after sharing it?**
If you're sharing someone else's key that was generated for them, yes — delete your local copy after the link is created. If you're distributing your own key, the local copy is your source of truth; only the Torch Secret link needs to disappear.

**What if I need to share the same SSH key with multiple recipients?**
Generate a separate Torch Secret for each recipient. Each link is single-use. Better practice, however, is to generate a unique key pair per person and add each public key to `authorized_keys` individually — this makes individual access revocation trivial.

**How is this different from using SSH certificates?**
SSH certificates are the right long-term architecture for organizations managing many users. Torch Secret is the right tool for the initial credential delivery — sharing the certificate, the signing key, or the temporary private key for one-time setup. They're complementary.

---

## Try Torch Secret

No account. No install. Paste the private key contents, get a one-time link.

The key is encrypted in your browser. The server stores only ciphertext. When the link is opened once, the record is permanently deleted.

**[Create a secure link →]**

---

_Related: [How to Share API Keys Securely](/use/share-api-keys) · [How to Share Credentials with a Contractor](/use/share-credentials-with-contractor) · [How to Share Database Credentials Securely](/use/share-database-credentials)_

---

---

### Page 4: `/use/send-password-without-email`

#### Metadata

- **URL:** `/use/send-password-without-email`
- **Title tag:** `How to Send a Password Without Email — One-Time Encrypted Links`
- **Meta description:** `Email stores passwords permanently in both inboxes. Torch Secret encrypts the password in your browser and destroys it after one view — no inbox copy, no archive.`
- **Canonical:** `https://torchsecret.com/use/send-password-without-email`
- **OG title:** `How to Send a Password Without Email`
- **OG description:** `Email archives are a graveyard of old passwords. There is a better way.`
- **Robots:** index, follow
- **Schema:** HowTo + FAQPage

---

#### Page Copy

# How to Send a Password Without Email

**TL;DR:** Email stores a permanent copy of every password you've ever sent — in your sent folder, in the recipient's inbox, and in any archive either organization maintains. Torch Secret delivers a password once and destroys it.

---

## The problem with emailing passwords

You need to send someone a password. It's a one-time thing. You type it into an email.

It's now in five places:

1. Your compose window (briefly)
2. Your sent mail folder (indefinitely)
3. Your email provider's servers (indefinitely, or per your retention policy)
4. Your recipient's inbox (indefinitely)
5. Their email provider's servers (indefinitely)

And if your organization or theirs archives email for compliance, add those archives to the list.

The password you sent is not a one-time event. It's a persistent record distributed across systems you don't control.

---

## Why email password delivery is a compounding risk

Email is not designed for ephemeral data. Messages persist by design — that's the whole value proposition. When you send a password over email, you're using an archive system to deliver data you'd prefer didn't persist.

The risks compound over time:

- **Account compromise:** When an email account is breached, attackers typically search the mailbox for passwords. Any credential ever sent or received via email is exposed.
- **Password reuse:** If the password you emailed is reused across services, a single inbox breach exposes multiple accounts.
- **Legal discovery:** Email archives are routinely subpoenaed in litigation. Passwords in those archives may be visible to attorneys, opposing parties, or court records.
- **Offboarding gaps:** When an employee leaves, their email account is often archived — not deleted. Passwords shared in their inbox remain accessible to anyone with access to that archive.

---

## The solution

Torch Secret replaces the email payload with a one-time encrypted link.

The password is encrypted in your browser before it's sent to the server. The server stores only the ciphertext. When your recipient opens the link, their browser decrypts the password locally. The server record is immediately and permanently deleted.

The email you send contains only a link. Not the password. The link leads to a one-time reveal. After that reveal, there is nothing to find.

---

## How to send a password without email (step by step)

**Step 1: Create the secret**
Paste the password into Torch Secret. You can include the username, the service, and any notes in the same secret — all encrypted together.

**Step 2: Set an expiration**
1 hour for urgent delivery, 24 hours for same-day async, 7 days for longer async windows. If the link expires before it's opened, the record is deleted and there's nothing to retrieve.

**Step 3: Optionally add a password**
You can add a Torch Secret password (separate from the password you're sharing) as a second authentication layer. Share the unlock password over a different channel — a phone call, a text, in person. This way, only the right recipient can open the secret even if the link is forwarded.

**Step 4: Share the link via email**
Send the Torch Secret link in your email. The actual password is not in the email body. The email now contains only a link to a one-time encrypted delivery.

**Step 5: Recipient opens the link**
They click the link, see the password once, copy it, and the record is gone. They should save the password to a password manager immediately — they won't be able to return to the link.

---

## Why zero-knowledge matters here

When you send a password over email with TLS, the encryption protects the message in transit — between email servers, from your client to Gmail's servers, and so on. But once the message is delivered, it's stored as plaintext in both mailboxes. TLS protects the journey, not the destination.

Torch Secret's zero-knowledge model means:

- The password is encrypted in your browser before it ever reaches Torch Secret's server
- The decryption key lives only in the URL fragment, which per HTTP spec (RFC 3986) is never transmitted to any server — including Torch Secret's
- The email containing the Torch Secret link does not contain the password, only the link
- After the link is opened, the server record is deleted — there is no permanent copy anywhere

The password never enters any email archive. It was briefly in Torch Secret's database as ciphertext, and then it wasn't.

---

## Who uses Torch Secret for password delivery

- **IT admins** sending temporary passwords to employees during account setup
- **Developers** sharing staging environment passwords with external contractors
- **Team leads** delivering shared account credentials to new team members
- **Security-conscious individuals** sharing account credentials with a family member or trusted contact
- **Service providers** delivering initial credentials to clients at project handoff

---

## Frequently asked questions

**What if the recipient doesn't know what a Torch Secret link is?**
The reveal page is clear and requires one click to reveal the password. No account, no install, no technical knowledge required. Most recipients figure it out in under 10 seconds.

**Can I include the username and service in the same secret?**
Yes. Paste everything — username, password, service URL, notes — as a single secret. It all encrypts together.

**What if the recipient accidentally opens the link and closes the tab without copying the password?**
The secret is consumed on open — it cannot be re-revealed. Generate a new secret with the password and share a fresh link.

**Is Torch Secret more secure than a password manager's sharing feature?**
Password managers (1Password, Bitwarden) are excellent for sharing credentials with people who use the same service. Torch Secret covers the case where the recipient doesn't have an account — the link works for anyone.

**What if I need to send a password to someone who uses an end-to-end encrypted email service like ProtonMail?**
E2E encrypted email protects the message in transit and at rest, which is genuinely better than standard email. Torch Secret adds one property E2E encrypted email doesn't have: the secret is permanently deleted on first view. After the recipient reads it, there is no copy anywhere.

---

## Try Torch Secret

No account. No install. Paste the password, get a one-time link.

The password is encrypted in your browser. The server stores only ciphertext. When the link is opened once, the record is permanently deleted. Your email will contain only a link — not the password.

**[Create a secure link →]**

---

_Related: [How to Share Credentials Without Slack](/use/share-credentials-without-slack) · [How to Share Database Credentials Securely](/use/share-database-credentials) · [How to Share API Keys Securely](/use/share-api-keys)_

---

---

### Page 5: `/use/share-credentials-without-slack`

#### Metadata

- **URL:** `/use/share-credentials-without-slack`
- **Title tag:** `How to Share Passwords Without Pasting Them in Slack`
- **Meta description:** `Slack passwords live in message history forever. Admins can read them. Third-party apps may access them. Torch Secret replaces the paste with a one-time encrypted link.`
- **Canonical:** `https://torchsecret.com/use/share-credentials-without-slack`
- **OG title:** `How to Share Passwords Without Pasting Them in Slack`
- **OG description:** `"I'll just Slack it to you." Those credentials are now searchable by every workspace admin, retained in compliance exports, and readable by connected third-party apps.`
- **Robots:** index, follow
- **Schema:** HowTo + FAQPage

---

#### Page Copy

# How to Share Passwords Without Pasting Them in Slack

**TL;DR:** Passwords pasted into Slack live in message history, are readable by workspace admins, and appear in compliance exports. Replace the paste with a Torch Secret link — the credential is never in Slack.

---

## "I'll just Slack it to you"

It's the fastest option. Everyone's already in Slack. You paste the password into a DM and it's done in three seconds.

The password is now in Slack's message history. Depending on your workspace plan and settings:

- It's searchable by any admin in your organization
- It's retained in your workspace message archive, potentially indefinitely
- It's included in any compliance message export your organization runs
- Any third-party app connected to your Slack workspace with message read permissions may have access to it
- If Slack's infrastructure is ever compromised, it's in the data

That three-second convenience leaves a trace that persists for as long as your workspace does.

---

## The specific ways Slack retains your credentials

**Message history:** Free Slack workspaces retain 90 days of message history. Paid plans retain messages indefinitely (or per your organization's retention policy). If you haven't set a short retention policy, that credential is sitting in Slack history right now.

**Admin visibility:** Workspace owners and admins can access message history across all channels and, in some configurations, direct messages. In Enterprise Grid, additional compliance roles can access message content.

**Compliance exports:** Organizations on Business+ and Enterprise Grid plans can export message data for compliance purposes. Messages exported for legal or compliance reasons include DMs and private channel content.

**Third-party integrations:** Any Slack app with `channels:history`, `im:history`, or `groups:history` OAuth scopes can read message content. Most organizations have dozens of connected apps; not all are vetted for credential handling.

**Slack's own security history:** Slack suffered a credential theft incident in 2022. Any credentials stored in message history at the time of a Slack breach are exposed.

---

## The solution

Torch Secret generates a one-time encrypted link. Send that link in Slack instead of the credential.

The credential is never in the Slack message. Only the link is. When your recipient opens the link, their browser decrypts the credential locally. The server record is immediately and permanently deleted. If anyone searches Slack for the credential, the link is there but it's already expired — there's nothing to retrieve.

---

## How to share credentials without Slack (step by step)

**Step 1: Create the secret**
Open Torch Secret. Paste the credential — API key, password, connection string, whatever it is. Add context in the same secret if helpful.

**Step 2: Set an expiration**
For Slack-based handoffs, 1–4 hours works for real-time coordination. 24 hours for async same-day delivery. The expiration is a safety net: if the link is never opened, the encrypted record self-destructs on schedule.

**Step 3: Add a password (for sensitive credentials)**
If the credential is particularly sensitive, add a Torch Secret password. Share the Torch Secret link in Slack, and communicate the unlock password via a different channel. An attacker with access to only your Slack history can't retrieve the credential.

**Step 4: Send the link in Slack**
Paste the Torch Secret link into the Slack DM or channel. The message now contains only a link — no credential, no plaintext.

**Step 5: Recipient opens the link**
They click it, see the credential, copy it, and the record is gone. If anyone searches Slack for the credential after this point, they'll find the link — and nothing at the other end.

---

## Why zero-knowledge matters in the Slack context

The key property: the credential is never in Slack. Not masked, not deleted — never present.

Slack allows message deletion, but deletion doesn't remove the message from Slack's servers for compliance-retained workspaces — it removes it from the UI. Message exports can still include deleted messages. If your organization runs compliance exports, a deleted Slack message containing a credential may still be in that export.

Torch Secret doesn't fix that problem. It avoids it entirely by ensuring the credential is never pasted into Slack in the first place. The link in Slack is inert — it points to an encrypted blob that is deleted on first view.

---

## Who uses Torch Secret for this

- **Developer teams** who default to Slack for all internal communication but know they shouldn't paste credentials there
- **IT administrators** who distribute credentials to team members via Slack during onboarding or access setup
- **DevOps engineers** who need to share environment-specific secrets across timezone-distributed teams
- **Anyone who has ever typed "here's the password" in a Slack message and immediately felt bad about it**

---

## Frequently asked questions

**Can I delete the Torch Secret link from Slack after the recipient opens it?**
Yes — though the link is already inert once opened. But cleaning up the message is still a good habit, and there's no reason to leave even a dead link around.

**What about Slack's own password-protected messages feature?**
Slack doesn't have a native password-protected message feature. Individual messages cannot be encrypted differently from the rest of the workspace. The only options are workspace-level encryption (which Slack manages, not you) or not putting credentials in Slack at all.

**What if we use Slack's Enterprise Key Management (EKM)?**
EKM lets your organization manage Slack's encryption keys, giving you control over which Slack data can be read by Slack employees. It's a meaningful security upgrade. It doesn't change the fact that credentials in your Slack message history are visible to your Slack workspace admins and anyone with EKM key access.

**What if the person who needs the credential doesn't have Slack?**
Torch Secret links work from any browser. If they're outside your Slack workspace, send the link via email, SMS, or any other channel.

**How long does the link stay valid after I share it?**
You set the expiration when creating the secret — 1 hour, 24 hours, or 7 days. After the expiration, or after the first view, the record is permanently deleted.

---

## Try Torch Secret

No account. No install. The credential never goes into Slack.

Paste your credential into Torch Secret, get a link, paste the link into Slack. The credential is encrypted in your browser. The server stores only ciphertext. When the link is opened, the record is permanently deleted.

**[Create a secure link →]**

---

_Related: [How to Send a Password Without Email](/use/send-password-without-email) · [How to Share API Keys Securely](/use/share-api-keys) · [How to Share .env Files Securely](/use/share-env-file)_

---

---

### Page 6: `/use/share-env-file`

#### Metadata

- **URL:** `/use/share-env-file`
- **Title tag:** `How to Share a .env File Securely`
- **Meta description:** `A .env file contains every secret in your project at once. Sharing it over Slack or email exposes your database, API keys, and auth secrets simultaneously. Torch Secret encrypts and destroys it after one view.`
- **Canonical:** `https://torchsecret.com/use/share-env-file`
- **OG title:** `How to Share a .env File Securely`
- **OG description:** `Your .env file is the crown jewel of your codebase. It should be in .gitignore. It shouldn't be in your sent mail folder.`
- **Robots:** index, follow
- **Schema:** HowTo + FAQPage

---

#### Page Copy

# How to Share a .env File Securely

**TL;DR:** A .env file contains all of your project's secrets at once — database credentials, API keys, auth secrets. Sharing it over Slack or email leaves a single message that exposes everything simultaneously. Torch Secret encrypts it in your browser and destroys it after one view.

---

## The most consequential share in software development

The `.env` file is in your `.gitignore` for a reason. It contains:

- Database connection strings and passwords
- Third-party API keys (payment processors, email services, analytics)
- Authentication secrets and JWT signing keys
- Storage bucket credentials
- Encryption keys and initialization vectors
- Internal service URLs and credentials

It is, in a single file, every secret your application needs to function. And when a new developer joins the team — or a contractor is onboarded — someone inevitably says: "I'll send you the .env file."

Then they paste it into Slack or attach it to an email.

---

## Why this is the highest-risk credential sharing scenario

A leaked API key is a problem. A leaked .env file is a catastrophe.

When a single .env file is exposed:

- Your database is accessible
- Your payment processor key can be used for unauthorized charges
- Your email service key can be used to send phishing at scale from your domain
- Your authentication secrets are compromised — JWTs can be forged
- Your storage credentials expose any files in your buckets
- Your internal services are accessible

There is no single credential that does as much damage as a full .env file. Yet this is one of the most commonly shared files in software development — often in the most insecure ways possible.

---

## The solution

Paste the contents of your .env file into Torch Secret. Share the one-time link. The file contents are encrypted in your browser, stored as ciphertext, and permanently deleted the moment your recipient opens the link.

The .env file contents are never in your Slack message history. They're never in anyone's sent mail. They existed in Torch Secret's database as an encrypted blob for a few hours, and then they didn't.

---

## How to share a .env file (step by step)

**Step 1: Copy the .env file contents**
Open the file locally and copy the full contents. Do not attach the file to any email or upload it to any file sharing service — paste the contents directly into Torch Secret.

**Step 2: Review before sharing**
Before creating the secret, confirm you're sharing the right environment's .env file. Accidentally sharing production credentials when you meant staging is a meaningful error.

**Step 3: Use a short expiration with password protection**
For .env files, use maximum caution: set a 1–4 hour expiration and add a password. Share the Torch Secret link via one channel and the unlock password via a different channel. The attacker needs both.

**Step 4: Share the link**
Send the Torch Secret link via Slack or email. The file contents are not in the message — only the link is.

**Step 5: Confirm receipt and rotate a subset**
Confirm your recipient opened the link and has the credentials. Consider rotating the highest-privilege credentials (the database password, the payment processor key) after sharing, treating the .env file as provisionally compromised until you've confirmed secure receipt.

**Step 6: Set up a secrets management workflow for the future**
.env file sharing is a bootstrap problem — it happens because there's no established secure channel. Consider this the last time you share a raw .env file. Going forward, evaluate tools like Doppler, Vault, or your cloud provider's secrets manager for team-wide credential distribution.

---

## Why zero-knowledge matters for .env files

The threat model is multiplied by the content of the file.

Every API key in the .env is a separate blast radius. Every database password is a separate data exposure vector. Every auth secret is a separate session forgery risk. A single Slack message containing a .env file is dozens of credentials in one.

Torch Secret's zero-knowledge model means:

- The file contents are encrypted in your browser using AES-256-GCM before being transmitted
- The decryption key lives only in the URL fragment — per HTTP spec, never transmitted to any server
- The server stores only the ciphertext — there are no keys on Torch Secret's servers to steal
- The ciphertext is permanently deleted on first view

If Torch Secret's infrastructure were completely compromised tomorrow, the attacker would have an encrypted blob and no decryption key. The dozens of credentials in your .env file are not exposed.

---

## Who uses Torch Secret for .env file sharing

- **Lead developers** onboarding new engineers who need the local development environment setup
- **DevOps engineers** delivering environment-specific credentials to staging and production environments during initial setup
- **Freelancers** receiving project credentials from clients at project kickoff
- **Contractors** who need environment access for a specific engagement and should not retain credentials after it ends
- **Security engineers** delivering isolated test environment credentials for security review engagements

---

## Frequently asked questions

**How large can the secret be? My .env file is several kilobytes.**
Torch Secret handles .env files of any typical size without issue — even files with dozens of variables and long key values.

**Should I share the full .env or only the variables the developer needs?**
Share only what the recipient needs for their role. If a frontend developer doesn't need the database password, don't include it. Principle of least privilege applies here too.

**What happens if I share a .env file and later realize it had production credentials in it?**
Rotate all the credentials in that .env file immediately. If the link was opened, treat all credentials in the file as compromised. Generate new API keys, rotate database passwords, re-sign your auth secret.

**Is this better than using a .env.example file and sharing actual values separately?**
A .env.example with placeholders is excellent practice — it documents what's needed without exposing real values. Torch Secret is how you deliver the real values securely, as a complement to that workflow.

**What's better long-term than Torch Secret for .env sharing?**
Tools like Doppler, Infisical, or HashiCorp Vault let teams manage secrets centrally, with role-based access and audit logs. Torch Secret is the right tool for one-time delivery during the bootstrap phase, or for organizations that haven't yet implemented a full secrets management platform.

---

## Try Torch Secret

No account. No install. Paste your .env file contents, get a one-time link.

The file contents are encrypted in your browser. The server stores only ciphertext. When the link is opened once, the record is permanently deleted.

**[Create a secure link →]**

---

_Related: [How to Share API Keys Securely](/use/share-api-keys) · [How to Share Database Credentials Securely](/use/share-database-credentials) · [How to Share Credentials with a Contractor](/use/share-credentials-with-contractor)_

---

---

### Page 7: `/use/share-credentials-with-contractor`

#### Metadata

- **URL:** `/use/share-credentials-with-contractor`
- **Title tag:** `How to Share Credentials with a Contractor Safely`
- **Meta description:** `Contractor credentials shared over email or Slack persist long after the engagement ends. Torch Secret delivers them once and destroys the record — so you're not cleaning up months later.`
- **Canonical:** `https://torchsecret.com/use/share-credentials-with-contractor`
- **OG title:** `How to Share Credentials with a Contractor Safely`
- **OG description:** `When the engagement ends, the credentials should too. One-time delivery means there's nothing to chase down later.`
- **Robots:** index, follow
- **Schema:** HowTo + FAQPage

---

#### Page Copy

# How to Share Credentials with a Contractor Safely

**TL;DR:** Credentials shared with a contractor over Slack or email persist in both of your inboxes long after the engagement ends. Torch Secret delivers them once and destroys the record — when you rotate the credentials at project end, there's nothing to clean up.

---

## The contractor credential problem

You're bringing in a contractor for a specific engagement. They need credentials to do the work: an API key, a database password, a staging environment login, an SSH key for a specific server.

The fastest path: send it over email or Slack.

The problem isn't during the engagement. It's after.

When the contractor's project ends, those credentials are still sitting in your Slack message history, your sent mail folder, and the contractor's inbox. If you forget to rotate them — or rotate some but not others — the contractor still has functional credentials to your systems.

And the contractor, who is now working for someone else, probably still has that old email in their inbox. Maybe they do something with it, maybe they don't. But the access is there.

---

## Why contractors are a specific risk category

Contractors exist outside your normal security perimeter:

- They use devices you don't manage or monitor
- Their email accounts are not on your domain and not under your IT team's oversight
- They're not covered by your offboarding process (there is no contractor offboarding checklist for most teams)
- They may work for multiple clients simultaneously — the same machine that accesses your systems also accesses other clients' systems
- Their contract relationships are shorter — the relationship that creates accountability ends

None of this means contractors are malicious. It means the attack surface is different. A compromised contractor laptop is a path into your system if the credentials from six months ago haven't been rotated.

---

## The solution

Torch Secret changes the delivery pattern: instead of sharing credentials in a way that leaves a permanent copy in the contractor's inbox, you deliver them once via a link that destroys itself on open.

When the engagement ends, you rotate the credentials. Because the contractor received them via a one-time link — not via email or Slack — there's no copy sitting in their inbox to worry about. The link was opened, the record was deleted, the delivery is done.

---

## How to share credentials with a contractor (step by step)

**Step 1: Scope the credentials**
Before creating the secret, determine what access the contractor actually needs. Principle of least privilege: give them the staging database password, not the production one. A read-only API key, not a full-access key. The minimum needed for the engagement.

**Step 2: Create the secret**
Paste the credentials into Torch Secret. Include context about what each credential is and where it's used — the contractor may not be familiar with your stack.

**Step 3: Set an expiration**
Match the expiration to your delivery timeline. For contractor onboarding, 24 hours is typically appropriate. If the contractor hasn't opened the link by the time it expires, generate a new one and reach out.

**Step 4: Add a password**
For contractor credentials, use a password. Share the Torch Secret link via email and the unlock password via a separate channel — a phone call, a text to their personal number. This ensures that even if the contractor's email is compromised between the time you send and when they open it, the attacker can't retrieve the credentials without the second factor.

**Step 5: Share and confirm**
Send the link. Follow up to confirm they opened it and have what they need.

**Step 6: Rotate on engagement end**
When the contractor's work is complete, rotate all credentials you shared. Because delivery was via Torch Secret, you're not chasing down "did they delete the email?" — the only copy was the one-time link, which is already gone.

---

## Why zero-knowledge matters in the contractor context

Standard email credential delivery creates a durable copy in a system you don't control: the contractor's personal or business email account.

When the engagement ends, you can rotate credentials, but you can't delete the email from their inbox. If they have a weak email password, if they reuse a password, if their device is stolen — the email with your credentials is accessible to whoever gets into their account.

Torch Secret's zero-knowledge architecture means:

- The credential is encrypted in your browser before being sent to the server
- The server stores only the encrypted blob — no plaintext, no keys
- The contractor opens the link, the blob is decrypted in their browser, the server record is permanently deleted
- There is no copy in their email. There is no copy in your sent mail. There is nothing to clean up.

---

## Who uses Torch Secret for contractor credential delivery

- **Engineering managers** setting up contractor access to staging environments at project start
- **IT administrators** delivering VPN credentials, internal tool logins, or service account passwords to external partners
- **Freelance developers** receiving client API keys or repository access at the start of an engagement
- **Agencies** managing credential handoff across multiple client relationships
- **Security teams** delivering scoped credentials for penetration testing engagements with a defined end date

---

## Frequently asked questions

**Should I give contractors their own accounts or share team credentials?**
Whenever possible, create a dedicated account or credential for the contractor. This gives you a clean revocation path — you disable that account when the engagement ends rather than rotating a shared credential. Torch Secret is then how you deliver that dedicated credential.

**What if I need to share credentials with multiple people on a contractor's team?**
Generate a separate Torch Secret for each person. Each link is single-use. You'll know exactly who received which credentials.

**Can I set a Torch Secret link to automatically expire at the end of the contractor's engagement?**
Torch Secret expiration options are time-based (1 hour, 24 hours, 7 days), not calendar-based. Use the 7-day option for longer-lead deliveries, or generate the link close to when it's needed. Regardless of expiration, rotate credentials at engagement end.

**What if the contractor needs to re-access credentials after losing them during the engagement?**
The one-time link cannot be re-opened. Generate a new secret with the same credentials and share a fresh link. If the credentials are sensitive, consider this an opportunity to rotate them and deliver new ones.

**We have a secrets manager. Why would we use Torch Secret?**
Secrets managers handle application-to-application credential retrieval. Torch Secret handles human-to-human credential delivery — specifically, the bootstrap problem of getting credentials to a person who doesn't yet have access to your secrets manager. They're complementary.

---

## Try Torch Secret

No account. No install. Create a one-time link, deliver once, rotate at project end.

The credential is encrypted in your browser. The server stores only ciphertext. When the link is opened, the record is permanently deleted.

**[Create a secure link →]**

---

_Related: [How to Share .env Files Securely](/use/share-env-file) · [How to Share API Keys Securely](/use/share-api-keys) · [How to Share SSH Keys Securely](/use/share-ssh-keys)_

---

---

### Page 8: `/use/onboarding-credential-handoff`

#### Metadata

- **URL:** `/use/onboarding-credential-handoff`
- **Title tag:** `How to Share Credentials During Employee Onboarding`
- **Meta description:** `IT admins send dozens of credentials to new hires via email on day one. Those emails stay in both inboxes forever. Torch Secret delivers each credential once and destroys it.`
- **Canonical:** `https://torchsecret.com/use/onboarding-credential-handoff`
- **OG title:** `How to Share Credentials During Employee Onboarding`
- **OG description:** `Day 1 credentials in a new hire's inbox are still there on day 1,000. Fix the delivery, not the cleanup.`
- **Robots:** index, follow
- **Schema:** HowTo + FAQPage

---

#### Page Copy

# How to Share Credentials During Employee Onboarding

**TL;DR:** IT admins typically send new employees 5–15 credentials via email on day one. Those emails persist in both mailboxes indefinitely, and nobody cleans them up during offboarding. Torch Secret delivers each credential once and destroys it.

---

## The onboarding credential problem

Day one of a new employee's tenure typically involves an IT admin sending them: a temporary password for their work account, a VPN credential, a Wi-Fi password, a shared service login, staging environment credentials, and possibly a handful of other credentials for the specific tools they'll use.

Most of this is delivered via email.

The employee's inbox is now a permanent record of every credential they were given on their first day. And the IT admin's sent folder is the same.

This is the state of affairs for most organizations. It creates a compounding problem:

- **Weak new-hire device security:** The employee's work laptop isn't yet enrolled in MDM. Their personal email account, which they may have used to forward a work credential, is on a personal device that IT doesn't control.
- **No cleanup on offboarding:** Offboarding checklists cover account deactivation, device return, and access revocation. They rarely cover "delete the credential email you sent on day one."
- **Archive retention:** Organizations that retain email archives for legal or compliance purposes may retain these credential emails for years.
- **Account compromise during tenure:** If the employee's email account is compromised at any point during their time with the company, every credential email they ever received is accessible to the attacker.

---

## What's at stake at scale

A 50-person engineering team, with an average tenure of two years and standard employee turnover, means roughly 25 onboarding cycles per year. Each cycle produces 10 credential emails. That's 250 credential emails per year sitting in inboxes and sent folders — plus whatever historical archive the organization maintains.

Some of those employees have left. Their email accounts may be archived. The credentials in those accounts may or may not have been rotated when they left.

The problem is not individual bad actors. It's systemic accumulation of plaintext credentials in email systems that are not designed to hold them.

---

## The solution

Replace email credential delivery with Torch Secret one-time links.

For each credential you need to deliver to a new hire, create a Torch Secret link. Send the link — not the credential — via email or Slack. The new hire opens the link, saves the credential to a password manager, and the record is permanently deleted.

The email contains only a link. The credential is not in any inbox. When the employee eventually leaves, there's nothing in their email history to worry about.

---

## How to deliver credentials during onboarding (step by step)

**Step 1: Separate credentials into individual secrets**
Don't paste all credentials into a single Torch Secret. Create one secret per credential or per logical group (e.g., "VPN credentials" as one secret, "Staging environment" as another). This gives the new hire a clear record of what they received and makes rotation more targeted.

**Step 2: Set 24–48 hour expirations**
Onboarding is chaotic. Give the new hire time to open each link — 24 or 48 hours. Remind them to open each one before it expires.

**Step 3: Send the links via your onboarding channel**
Send the Torch Secret links via whatever channel your onboarding process uses — email, Slack, your onboarding platform. The link is not sensitive; only the content behind the link is.

**Step 4: Remind the new hire to save credentials to a password manager**
Each Torch Secret link is single-use. Once it's opened, it's gone. The new hire should save each credential to your organization's password manager (1Password, Bitwarden, etc.) immediately on reveal. If they close the tab without saving, the credential is gone and needs to be re-shared.

**Step 5: Confirm all links have been opened**
Follow up to confirm the new hire has opened and saved all credentials. If any links expired, generate new ones.

**Step 6: Rotate temporary passwords after first login**
Any temporary password you share should be rotated by the new hire at first login. This is standard practice — Torch Secret doesn't change this, but it does mean the temporary password that was delivered never sat in an inbox.

---

## Why zero-knowledge matters for onboarding

Onboarding credential delivery is high-volume and low-attention — it happens in a window when both the IT admin and the new hire are context-switching rapidly. The credential emails often aren't cleaned up because nobody tracks them after delivery.

Torch Secret's zero-knowledge model means:

- Each credential is encrypted in the IT admin's browser before transmission
- The server stores only the encrypted blob
- The new hire's browser decrypts it locally when the link is opened
- The server record is permanently deleted after one view
- Nothing is in the IT admin's sent folder. Nothing is in the new hire's inbox. There is no onboarding email with credentials to clean up at offboarding.

---

## Who uses Torch Secret for onboarding

- **IT administrators** delivering initial credentials to new hires — especially at organizations without a centralized secrets management platform
- **Engineering managers** sharing staging environment credentials with new developers
- **Operations teams** handling non-technical employee onboarding where shared service credentials (marketing tools, analytics dashboards) need to be distributed
- **Startups** with small IT teams who handle onboarding manually and need a simple, secure process that doesn't require standing up additional infrastructure

---

## Frequently asked questions

**How do we handle the case where a new hire can't open the link before it expires?**
Generate a new secret with the same credential and share a fresh link. If this happens frequently, use a 7-day expiration instead.

**Should we use Torch Secret for all onboarding credentials, or just sensitive ones?**
Start with the most sensitive credentials — VPN, staging environment databases, any shared service with broad access. Extending it to all credentials is better practice, but prioritize the high-value ones first.

**What about credentials that need to be shared with the whole team, not just new hires?**
Torch Secret is for point-to-point delivery. For team-wide credential management — shared credentials everyone on the team needs — a team password manager (1Password Teams, Bitwarden for Business) is the right tool. Use Torch Secret to onboard new employees into the password manager, not to replace it.

**Does Torch Secret integrate with our onboarding platform (e.g., Rippling, Workday, BambooHR)?**
Torch Secret doesn't have native integrations with HR platforms. It works as a standalone web tool — the IT admin creates links manually and includes them in whatever onboarding communication they're already sending. For high-volume onboarding with automated workflows, the Torch Secret API can be integrated into custom tooling.

**What's the right process for offboarding when Torch Secret was used for onboarding?**
The offboarding process doesn't change — deactivate accounts, revoke access, collect the device. What Torch Secret eliminates is the "go check if any credential emails need to be deleted" step, because there are no credential emails.

---

## Try Torch Secret

No account required. Create a link, deliver the credential, move on.

Each credential is encrypted in your browser. The server stores only ciphertext. When the link is opened, the record is permanently deleted.

**[Create a secure link →]**

---

_Related: [How to Share Database Credentials Securely](/use/share-database-credentials) · [How to Send a Password Without Email](/use/send-password-without-email) · [How to Share Credentials with a Contractor](/use/share-credentials-with-contractor)_

---

---

## Hub Page: `/use/`

#### Metadata

- **URL:** `/use/`
- **Title tag:** `Use Cases — How Teams Share Credentials Securely with Torch Secret`
- **Meta description:** `One-time encrypted links for every credential sharing scenario: API keys, SSH keys, database passwords, .env files, and more. No accounts. No trace.`
- **Canonical:** `https://torchsecret.com/use/`
- **Robots:** index, follow

---

#### Page Copy

# Credential Sharing — Done Correctly

Torch Secret is a zero-knowledge, one-time secret sharing tool built for the workflows where credentials actually move between people.

Every secret is encrypted in your browser. The server stores only ciphertext. Each link destroys itself on first view.

---

## Use cases

**[How to Share API Keys Securely →](/use/share-api-keys)**
For developers and DevOps teams handing off service credentials without leaving a copy in Slack or email.

**[How to Share Database Credentials Securely →](/use/share-database-credentials)**
The skeleton key to your data. Deliver it once. Destroy the record.

**[How to Share SSH Keys Without Email or Slack →](/use/share-ssh-keys)**
SSH private keys in sent mail are master keys that never go away. One-time delivery fixes this.

**[How to Send a Password Without Email →](/use/send-password-without-email)**
Email archives are a graveyard of old passwords. Replace the payload with a link.

**[How to Share Passwords Without Pasting Them in Slack →](/use/share-credentials-without-slack)**
Slack retains message history, including every credential ever pasted into a DM.

**[How to Share a .env File Securely →](/use/share-env-file)**
Your .env file contains every secret in your project. It should not be in anyone's inbox.

**[How to Share Credentials with a Contractor Safely →](/use/share-credentials-with-contractor)**
One-time delivery means there's nothing to chase down when the engagement ends.

**[How to Share Credentials During Employee Onboarding →](/use/onboarding-credential-handoff)**
Day-one credentials in an inbox persist indefinitely. Fix the delivery.

---

_See also: [Torch Secret vs. OneTimeSecret](/vs/onetimesecret) · [Torch Secret vs. Password Pusher](/vs/pwpush) · [Torch Secret vs. Privnote](/vs/privnote)_

---

## Schema Markup Templates

### HowTo Schema (adapt per page)

```json
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to Share API Keys Securely",
  "description": "Share an API key using a zero-knowledge one-time encrypted link that permanently self-destructs after one view.",
  "totalTime": "PT2M",
  "step": [
    {
      "@type": "HowToStep",
      "name": "Paste the API key",
      "text": "Open Torch Secret and paste your API key into the text field. You can include the service name, scope, and environment in the same secret."
    },
    {
      "@type": "HowToStep",
      "name": "Set an expiration",
      "text": "Choose how long the link remains valid: 1 hour for urgent handoffs, 24 hours for same-day async, 7 days for longer async workflows."
    },
    {
      "@type": "HowToStep",
      "name": "Optionally add a password",
      "text": "For sensitive keys, add a password the recipient must enter before the key is revealed. Share the password via a separate channel."
    },
    {
      "@type": "HowToStep",
      "name": "Share the link",
      "text": "Copy the one-time Torch Secret link and share it via Slack, email, or any other channel. The actual key is not in the message."
    },
    {
      "@type": "HowToStep",
      "name": "Recipient opens and decrypts",
      "text": "The recipient clicks the link. Their browser decrypts the key locally. The server record is permanently deleted."
    }
  ]
}
```

### FAQPage Schema (adapt per page)

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Can I share multiple API keys in one link?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. Paste all of them into a single secret — the service name, the key, the environment, any notes. It all encrypts as one blob."
      }
    },
    {
      "@type": "Question",
      "name": "Does Torch Secret log which API key I shared?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "No. The server stores only the encrypted ciphertext. The server never sees the plaintext key. Log files contain no secret content."
      }
    }
  ]
}
```

---

## Implementation Notes

### Pages to build

8 use case pages + 1 hub page = 9 total pages.

### Routing

Add to the SPA router:

- `/use` → hub page component
- `/use/:slug` → use case page component (dynamic, loads copy from data file or static component)

Given the copy volume, static page components per use case are simplest. No CMS required for 8 pages.

### Internal links to add

- Homepage footer or nav: link to `/use/` hub
- `/vs/` and `/alternatives/` pages: add a "See how Torch Secret works for your use case →" link at the bottom
- Blog/content pages (when created): link to relevant use case pages

### Launch order

Prioritize by estimated search volume:

1. `/use/share-api-keys` (broadest developer audience)
2. `/use/share-credentials-without-slack` (common pain point, broad audience)
3. `/use/send-password-without-email` (broadest non-technical audience)
4. `/use/share-env-file` (high-consequence, developer audience)
5. `/use/share-database-credentials`
6. `/use/share-credentials-with-contractor`
7. `/use/onboarding-credential-handoff`
8. `/use/share-ssh-keys`
9. `/use/` hub (publish with first page, update as pages launch)

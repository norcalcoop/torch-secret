**Title:** Sharing a deploy key with a contractor: I built a purpose-built one-time encrypted link tool so it's not a Slack DM

**Body:**

You have a deploy key, an API token, or a DB password that needs to get to a contractor for one job. The options are:

- Slack DM: unencrypted, searchable, persistent in Slack's logs
- Email: worse
- 1Password shared vault: requires the recipient to create an account
- "I'll just text it": no

This is a solved problem that keeps getting solved with the wrong tools. I built Torch Secret for this exact workflow.

**How it works:**

You paste the credential, get a one-time encrypted link, send the link. The recipient opens it once — the credential is there, then the link self-destructs. No account required for the recipient. They don't need to install anything or sign up anywhere.

**The security bit, briefly:**

The decryption key lives in the URL fragment and never reaches the server — per RFC 3986 §3.5, the browser strips the fragment before sending the HTTP request. A subpoena or breach of the service exposes only AES-256-GCM ciphertext the server cannot decrypt. The server has no key.

**For orgs with data residency requirements:**

Self-hosting is one `docker-compose up` from the repo. PostgreSQL only — no external service dependencies for single-instance deployments. ISC license, commercial use allowed.

**What this is not:**

It's not a vault. It's not a password manager. It's the right-sized tool for "send this credential once, self-destruct after they read it" — a use case where the alternatives are all meaningfully worse.

Code: https://github.com/norcalcoop/torch-secret

Try it: https://torchsecret.com — no account required.

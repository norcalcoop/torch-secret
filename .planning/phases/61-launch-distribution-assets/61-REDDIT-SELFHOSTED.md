**Title:** I built a self-hostable one-time secret sharer — docker-compose up, PostgreSQL only, ISC license, no external deps required

**Body:**

`docker-compose up` from the repo gives you the full stack: PostgreSQL 17 and the app. That's it. For anonymous one-time secrets, no Redis is required — Redis is an optional dependency for distributed rate limiting in multi-instance deployments. Single-instance self-hosting needs only PostgreSQL.

I built Torch Secret to scratch a concrete itch: sharing credentials, API keys, or passwords once, securely, without either party creating an account. The self-hosted path is the honest deployment story. Here's what it looks like operationally:

**The stack:**
- PostgreSQL 17 (stores only AES-256-GCM ciphertext — no plaintext ever hits the DB)
- App container (Node.js/Express, serves the frontend and API)
- Docker Compose production config included in the repo

**Why self-hosting is the correct trust model here:**

The server stores only encrypted ciphertext and has no access to decryption keys. The 256-bit AES-GCM key is generated in the sender's browser and embedded in the URL fragment, which — per RFC 3986 §3.5 — browsers never transmit to the server. Self-hosting doesn't just remove dependence on a third-party service; it removes dependence on any server operator. The zero-knowledge property holds against your own infrastructure as well.

No account required for the recipient. They open the link, the browser decrypts locally using the key from the URL fragment, and the link is destroyed. The server learns only that the secret was retrieved.

**ISC license** — permissive, commercial use allowed.

There's a hosted version at https://torchsecret.com if you want to try the UI before deciding whether to self-host. Code and Docker Compose files at https://github.com/norcalcoop/torch-secret.

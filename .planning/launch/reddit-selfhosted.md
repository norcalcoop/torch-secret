Self-host a zero-knowledge one-time secret sharer with docker-compose

One `docker-compose up` and you have a running one-time secret sharer with zero-knowledge encryption. No accounts required to create or receive a secret — paste your text, get a one-time link, done.

The server stores only encrypted ciphertext. The encryption key lives in the URL fragment (`https://your-instance.example.com/reveal/[id]#[key]`), which browsers strip before the HTTP request is sent per RFC 3986 §3.5. The key never reaches the server in any HTTP request the server receives. A full database dump is meaningless without the keys that only exist in shared URLs.

The link self-destructs after one view. Retrieval is a single database transaction — the ciphertext is zeroed and deleted on read. A concurrent second request sees no row.

Optional extras: password protection, expiry from 1 hour to 7 days, a 15/30/60-second burn timer that destroys the secret after the recipient opens it. The confirmation page includes copy, native share, email, and QR code for mobile handoff.

Stack: Node.js + Express + PostgreSQL + Vite. ISC license. Tested with Playwright E2E and Vitest. The Compose file brings up Postgres, runs migrations, and starts the app.

(Also available at torchsecret.com if you don't want to run it yourself.)

Source: https://github.com/norcalcoop/torch-secret (ISC license)
Live: https://torchsecret.com

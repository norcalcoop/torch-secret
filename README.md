# Torch Secret

[![CI](https://github.com/norcalcoop/secureshare/actions/workflows/ci.yml/badge.svg)](https://github.com/norcalcoop/secureshare/actions/workflows/ci.yml)
[![Live](https://img.shields.io/badge/live-torchsecret.com-orange)](https://torchsecret.com)
[![License](https://img.shields.io/github/license/norcalcoop/secureshare)](LICENSE)

Zero-knowledge, one-time secret sharing. Paste sensitive text, get an encrypted link, share it — the secret self-destructs after one view. No accounts required. The encryption key lives exclusively in the URL fragment and never reaches the server.

---

## How It Works

Torch Secret enforces two hard trust boundaries:

**Browser → Server:** All cryptographic operations happen in the browser using the Web Crypto API (AES-256-GCM). The encryption key is embedded in the URL fragment (`#base64key`). Per [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986#section-3.5), browsers never send the fragment to the server. The server is untrusted storage — it receives and stores only the encrypted blob.

**Server → Database:** PostgreSQL stores only ciphertext, IVs, and metadata. A full database dump contains encrypted noise that is meaningless without keys that exist only in shared URLs.

When a secret is retrieved, the server performs an atomic three-step transaction: SELECT the encrypted row, zero out the ciphertext column, DELETE the row. This prevents replay even under concurrent requests. The **zero-knowledge invariant** ensures no log, database record, or analytics event ever contains both a `userId` and a `secretId` in the same payload — preventing correlation attacks.

---

## Features

- **Zero-knowledge encryption** — AES-256-GCM via Web Crypto API; no third-party crypto libraries
- **One-time viewing** — atomic retrieve-and-destroy; secrets cannot be replayed
- **Anonymous + account hybrid** — use without an account or sign in for a secret dashboard
- **Secret dashboard** — view, manage, and track your created secrets when signed in
- **Password protection** — EFF Diceware passphrase generation; Argon2id server-side hashing (OWASP parameters)
- **Configurable expiration** — 1 hour, 24 hours, 7 days, or 30 days
- **Email notification** — optional alert when your secret is viewed
- **PADME padding** — prevents ciphertext length analysis with at most 12% overhead
- **Rate limiting** — Redis-backed or in-memory, configurable per endpoint
- **Content Security Policy** — per-request nonces via Helmet
- **Privacy-safe analytics** — PostHog with URL fragment stripping; zero PII in events
- **Supply chain security** — dependency changes are automatically scanned by [Socket.dev](https://socket.dev) on PRs for supply chain security
- **Accessible** — WCAG 2.1 AA compliant, keyboard navigable, screen reader tested
- **Themeable** — light, dark, and system-preference modes with localStorage persistence

---

## Tech Stack

| Layer      | Technology                                                     |
| ---------- | -------------------------------------------------------------- |
| Runtime    | Node.js 24, TypeScript 5.9 (ESM)                               |
| Backend    | Express 5, Drizzle ORM, PostgreSQL 17, Pino                    |
| Auth       | Better Auth 1.x (email/password, Google + GitHub OAuth)        |
| Email      | Resend                                                         |
| Analytics  | PostHog (privacy-safe, fragment-stripped)                      |
| Frontend   | Vanilla TypeScript, Vite 7, Tailwind CSS 4, Lucide icons       |
| Encryption | Web Crypto API (AES-256-GCM) — no third-party crypto libraries |
| Testing    | Vitest 4, Playwright, vitest-axe                               |
| Quality    | ESLint 10, Prettier 3, Husky pre-commit hooks                  |
| Deployment | Docker, Render.com Blueprint                                   |

---

## Local Development

### Prerequisites

- Node.js 24.x
- PostgreSQL 17+ running locally
- [Infisical CLI](https://infisical.com/docs/cli/overview) installed

### Setup

1. **Install Infisical CLI:**

   ```bash
   brew install infisical/get-cli/infisical   # macOS
   ```

   See [Infisical CLI docs](https://infisical.com/docs/cli/overview) for Linux installation.

2. **Authenticate with Infisical:**

   ```bash
   infisical login
   ```

   This opens a browser. Authenticate with your personal account. Session persists in `~/.infisical/` — only needed once per machine.

3. **Request project access** from the project owner (needed to read secrets from the `torch-secret` Infisical project).

4. **Start development servers:**
   ```bash
   npm run dev:server   # Terminal 1 — Express server on :3000, secrets injected by Infisical
   npm run dev:client   # Terminal 2 — Vite dev server via portless
   ```

No `.env` file needed. Secrets are pulled automatically from the `dev` environment in Infisical.

### Docker Staging

To run the full stack with Docker Compose (staging mode):

```bash
npm run staging:up   # Wraps: infisical run --env=staging -- docker-compose up
```

Requires `infisical login` completed. Pulls secrets from Infisical's `staging` environment.

---

## Development Commands

| Command                | Description                                             |
| ---------------------- | ------------------------------------------------------- |
| `npm run dev:server`   | Start backend dev server (tsx watch)                    |
| `npm run dev:client`   | Start frontend dev server (Vite, proxies /api to :3000) |
| `npm run build:client` | Production frontend build                               |
| `npm test`             | Run all tests in watch mode                             |
| `npm run test:run`     | Run all tests once                                      |
| `npm run test:e2e`     | Run Playwright E2E tests (requires running app)         |
| `npm run lint`         | Run ESLint across the codebase                          |
| `npm run lint:fix`     | Auto-fix ESLint issues                                  |
| `npm run format`       | Format all files with Prettier                          |
| `npm run format:check` | Prettier format check (CI)                              |
| `npm run db:generate`  | Generate migration from schema changes                  |
| `npm run db:migrate`   | Apply database migrations                               |

---

## Architecture

```
torch-secret/
  client/             Vanilla TypeScript SPA (Vite + Tailwind CSS 4)
  server/             Express 5 API with Drizzle ORM
  shared/             Zod schemas and TypeScript interfaces
  e2e/                Playwright end-to-end tests
  drizzle/            Generated database migrations
  workers/            Cloudflare Workers (keep-alive cron job)
  docker-compose.yml  One-command local development
  render.yaml         Render.com deployment Blueprint
```

The SPA router uses the History API with dynamic imports for code splitting. Each page is a separate chunk. The CSP nonce flow injects a per-request nonce at the Express layer, replacing a build-time placeholder in the Vite output.

### Cloudflare Worker (Keep-Alive)

A Cloudflare Worker cron job pings `/api/health` every 10 minutes to prevent Render.com free tier spin-down. The Worker lives in `workers/keep-alive/`.

**Deploy:**

```bash
# One-time: authenticate with Cloudflare
wrangler login

# Deploy the Worker
wrangler deploy --config workers/keep-alive/wrangler.toml
```

**Test locally:**

```bash
npx wrangler dev --config workers/keep-alive/wrangler.toml --test-scheduled
# In another terminal:
curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"
```

The Worker is deployed manually from a developer machine — it rarely needs updates and does not benefit from CI automation.

---

## Contributing

We welcome contributions. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, coding conventions, and the pull request process.

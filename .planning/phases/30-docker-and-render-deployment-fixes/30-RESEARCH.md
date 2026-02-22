# Phase 30: Docker & Render Deployment Fixes - Research

**Researched:** 2026-02-21
**Domain:** Docker containerization, Render.com Blueprint deployment, Better Auth production configuration
**Confidence:** HIGH

## Summary

Phase 30 addresses a critical gap between the v3.0 Docker & Local Development work (Phase 16, completed 2026-02-17) and the v4.0 feature set (Phases 21–29). Phase 16 established the Dockerfile, docker-compose.yml, and render.yaml using only the original 6-column secrets table and zero auth requirements. Since then, v4.0 added 8 new required environment variables (Better Auth, Resend, OAuth, PostHog), 3 new migrations, and a dramatically expanded application surface — but the deployment configuration was never updated to reflect these additions.

The concrete problems are:

1. **render.yaml is missing all v4.0 environment variables.** The current file declares only `DATABASE_URL`, `REDIS_URL`, `NODE_ENV`, `FORCE_HTTPS`, and `LOG_LEVEL`. It is missing `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and the optional `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` and `VITE_POSTHOG_KEY`/`VITE_POSTHOG_HOST`. Deploying from the current render.yaml causes Zod validation failures at startup (`BETTER_AUTH_SECRET must be at least 32 characters`, `BETTER_AUTH_URL is required`).

2. **docker-compose.yml is missing all v4.0 environment variables.** The app service declares only the same 5 vars as render.yaml. Running `docker compose up` against the current config crashes immediately on env schema validation.

3. **Render.com free tier Postgres expires after 30 days.** The current render.yaml has a `IMPORTANT:` comment about this but no user guidance beyond "upgrade to a paid plan." A clearer deployment note is needed.

4. **No `sync: false` declarations for secrets in render.yaml.** The Render Blueprint best practice for sensitive credentials (`BETTER_AUTH_SECRET`, `RESEND_API_KEY`, OAuth client secrets) is to declare them with `sync: false` so Render prompts the deployer for values during initial Blueprint creation rather than having them committed to source control.

5. **PostHog VITE_ vars require special handling in Vite production builds.** These vars must be baked in at build time by Vite. They need to appear in the Dockerfile's build stage environment — or they must be documented as "add via Render dashboard" before triggering a build.

The good news: the Dockerfile itself is in good shape. The 3-stage build is correct, tsx is a production dependency, the HEALTHCHECK uses node `fetch()` (no curl dependency), and the `USER node` non-root pattern is correctly implemented. No Dockerfile changes are needed beyond confirming it handles the new VITE_ build-arg requirements.

**Primary recommendation:** Add all v4.0 env vars to render.yaml using `sync: false` for secrets, and add placeholder/documented values to docker-compose.yml so local development works. Verify the Dockerfile's build stage can receive VITE_ vars as build args for PostHog. Document the human deployment checklist for Render.com.

## Standard Stack

### Core
| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| node:24-slim | 24.x LTS (Bookworm) | Docker base image | Matches project Node 24.x; pre-built argon2 binaries exist for Debian Bookworm x86-64; already in use |
| Docker Compose v2 | Built into Docker Desktop | Local multi-service orchestration | Already in use; service discovery, healthchecks, depends_on ordering |
| render.yaml | Render Blueprint Spec | IaC for Render.com deployment | Already in use; `runtime: docker`, `type: keyvalue`, `fromDatabase` env wiring |
| Zod env validation | zod 4.x (project-wide) | Schema-validated env vars at startup | Already in use via `server/src/config/env.ts`; crash-fast on missing required vars |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| `sync: false` in render.yaml | Prompt deployer for secret values during Blueprint creation | Required for `BETTER_AUTH_SECRET`, `RESEND_API_KEY`, OAuth client secrets — never commit these |
| Docker build args (`ARG` / `--build-arg`) | Pass VITE_ env vars to Vite at Docker build time | Required if PostHog analytics should be enabled in the Docker-built production image |
| `.env.example` | Document all required env vars with descriptions | Already maintained; must be updated to match all v4.0 vars |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `sync: false` in render.yaml | Committed placeholder values | Never: commits secrets to source; even fake placeholders train bad habits |
| Docker ARG for VITE_ vars | Runtime env injection | Vite bakes VITE_ vars into the bundle at build time — they cannot be injected at runtime; ARG is the correct approach |
| preDeployCommand for migrations | dockerCommand migration prefix | preDeployCommand requires a paid Render plan; the current `dockerCommand` chained migration approach is correct for free tier |

## Architecture Patterns

### Pattern 1: render.yaml Secret Variables with `sync: false`

**What:** Declare sensitive credentials in render.yaml with `sync: false`. Render prompts the deployer for these values during initial Blueprint creation from the dashboard. Values are never stored in the YAML file.

**When to use:** Any env var that is a secret credential: API keys, auth secrets, OAuth client secrets.

**Limitation:** `sync: false` only fires during *initial* Blueprint creation. When updating an existing Blueprint, Render ignores `sync: false` vars — deployers must add new secrets manually in the Render dashboard after Blueprint update.

```yaml
envVars:
  - key: BETTER_AUTH_SECRET
    sync: false
  - key: BETTER_AUTH_URL
    sync: false
  - key: RESEND_API_KEY
    sync: false
  - key: RESEND_FROM_EMAIL
    sync: false
  - key: GOOGLE_CLIENT_ID
    sync: false
  - key: GOOGLE_CLIENT_SECRET
    sync: false
  - key: GITHUB_CLIENT_ID
    sync: false
  - key: GITHUB_CLIENT_SECRET
    sync: false
```

### Pattern 2: VITE_ Environment Variables in Docker Builds

**What:** Vite bakes `VITE_*` env vars into the client bundle at build time (`npm run build:client`). They are NOT available at runtime. In Docker multi-stage builds, these must be passed as Docker build args to the `build` stage.

**Current state:** The Dockerfile has no `ARG` declarations for VITE_ vars. The build stage runs `npm run build:client` without any VITE_ vars — PostHog will not initialize in Docker-built images (graceful no-op since `initAnalytics()` checks for `import.meta.env.VITE_POSTHOG_KEY`).

**Options:**
1. **Accept the no-op behavior** (simplest): Document that PostHog analytics require setting `VITE_POSTHOG_KEY` and `VITE_POSTHOG_HOST` before building the Docker image. Add as ARG declarations to Dockerfile with no default (build arg must be passed explicitly). This is opt-in — most self-hosted deployments won't have PostHog.
2. **Render build args** (for PostHog in Render-hosted builds): Render injects env vars as build args during Docker builds. Adding `VITE_POSTHOG_KEY` and `VITE_POSTHOG_HOST` as `ARG` declarations in the Dockerfile, and declaring them in render.yaml `envVars`, causes Render to pass them as build args automatically.

**Recommendation:** Add `ARG VITE_POSTHOG_KEY` and `ARG VITE_POSTHOG_HOST` to the Dockerfile `build` stage, and add the corresponding `envVars` entries to render.yaml. Declare them with `sync: false` in render.yaml since they are secret-adjacent (API keys). In docker-compose.yml, leave them absent (PostHog disabled in local Docker dev, which is the correct default per `.env.example` guidance).

```dockerfile
# Stage 2: Build frontend assets with Vite
FROM deps AS build
WORKDIR /app
COPY . .
# Optional: PostHog analytics baked in at build time (pass via --build-arg or Render env vars)
ARG VITE_POSTHOG_KEY
ARG VITE_POSTHOG_HOST
RUN npm run build:client
```

### Pattern 3: docker-compose.yml Auth Env Vars with Placeholder Defaults

**What:** Add required auth vars to docker-compose.yml with functional placeholder values that allow the app to start in local Docker mode. Auth features won't work with placeholders, but the app will start without crashing.

**When to use:** Local development Docker environment where auth is being tested or the developer wants to run the full stack.

**Required vars to add to docker-compose.yml `app.environment`:**
```yaml
BETTER_AUTH_SECRET: 'local-development-secret-min-32-chars-xx'
BETTER_AUTH_URL: 'http://localhost:3000'
RESEND_API_KEY: 'placeholder-not-sent'
RESEND_FROM_EMAIL: 'SecureShare <noreply@localhost>'
# Leave OAuth vars absent (OAuth buttons won't appear — correct for local dev)
# Leave VITE_ vars absent (PostHog disabled in local Docker dev — correct)
```

**Note on RESEND_API_KEY validation:** `z.string().min(1)` — any non-empty string passes. The placeholder value will cause email delivery to fail but won't crash the server at startup.

### Pattern 4: Render.com Production Deployment Checklist

**What:** A documented list of manual steps required before/after Blueprint deployment because Render cannot automate all configuration.

**Required manual steps for Render.com deployment:**
1. After Blueprint sync, manually add all `sync: false` env vars in the Render dashboard
2. Set `BETTER_AUTH_URL` to the service's actual Render URL (e.g., `https://secureshare.onrender.com`)
3. Generate `BETTER_AUTH_SECRET` with `openssl rand -base64 32`
4. Configure Google/GitHub OAuth apps with the Render URL's callback: `https://{service}.onrender.com/api/auth/callback/{provider}`
5. Register a Resend sending domain and update `RESEND_FROM_EMAIL`
6. Optionally add `VITE_POSTHOG_KEY` and trigger a redeploy to bake PostHog into the bundle
7. After first deploy, verify `/api/health` returns `{"status":"ok","database":"connected"}`

### Pattern 5: Render Internal vs External Redis Connection

**What:** Render Key Value (Redis) uses different URL schemes for internal vs external connections. The `connectionString` property from `fromService` in render.yaml returns the internal URL (`redis://...`) which does NOT require TLS. External connections use `rediss://...` with TLS.

**Current state:** The current render.yaml correctly uses `fromService.property: connectionString` which returns the internal URL. No TLS configuration is needed for Render-internal Redis connections. The current ioredis usage `new Redis(env.REDIS_URL)` handles the `redis://` URL format correctly.

**No change needed** — the internal Redis connection is correctly configured.

### Anti-Patterns to Avoid

- **Committing actual secret values to render.yaml or docker-compose.yml.** Use `sync: false` in render.yaml; use placeholder values in docker-compose.yml.
- **Setting `PORT` explicitly in render.yaml.** Render injects `PORT=10000` automatically. The app's Zod schema default of 3000 is overridden by Render's injected value. Setting `PORT` in render.yaml to `3000` breaks Render routing.
- **Adding VITE_ vars as runtime env vars without the Dockerfile ARG declaration.** Render does inject env vars as Docker build args, but only for vars that have a matching `ARG` instruction in the Dockerfile. Without the `ARG`, the VITE_ var is silently unavailable to Vite during build.
- **Using `preDeployCommand` for migrations on free tier.** `preDeployCommand` is a paid plan feature. The existing `dockerCommand` pattern (`sh -c 'migrate.ts && server.ts'`) is the correct free-tier approach.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Secret injection | Custom secret management scripts | `sync: false` in render.yaml + Render dashboard | Render prompts deployer during Blueprint creation; values stay out of repo |
| VITE_ build-time injection | Runtime env var substitution in HTML | Docker `ARG` + Vite `import.meta.env.VITE_*` | Vite bakes vars at bundle build time; no runtime injection mechanism exists |
| Migration-before-startup | Separate migration service/job | Chained `dockerCommand` (existing pattern) | Works on free tier; `preDeployCommand` requires paid plan |

## Common Pitfalls

### Pitfall 1: Zod Validation Crash at Startup — Missing Auth Env Vars

**What goes wrong:** Application starts, immediately crashes with `ZodError: BETTER_AUTH_SECRET must be at least 32 characters` or `BETTER_AUTH_URL: Required`.

**Why it happens:** `server/src/config/env.ts` uses `ZodSchema.parse(process.env)` which throws on startup if any required var is missing. `BETTER_AUTH_SECRET` (required, `z.string().min(32)`) and `BETTER_AUTH_URL` (required, `z.string().url()`) were added in Phase 22 but never added to render.yaml or docker-compose.yml.

**How to avoid:** Add all required vars to render.yaml (with `sync: false` for secrets) and to docker-compose.yml (with placeholder values). Verify by attempting `docker compose up` locally after changes.

**Warning signs:** Container exits immediately with code 1; logs contain `ZodError`.

### Pitfall 2: RESEND_API_KEY Placeholder Causes Silent Auth Failure (Not a Crash)

**What goes wrong:** App starts successfully but email verification fails for new registrations, and password reset emails are never delivered. Users cannot complete registration.

**Why it happens:** `RESEND_API_KEY: z.string().min(1)` — any non-empty string passes validation. The placeholder satisfies Zod but causes Resend API calls to return 401/403. The error is caught by the fire-and-forget email pattern and silently discarded.

**How to avoid:** In docker-compose.yml, document the placeholder prominently. In render.yaml, use `sync: false` so the deployer is prompted for a real key. Document in the Render checklist that a real Resend API key is required before email auth features work.

**Warning signs:** Registration succeeds (form submits) but verification email never arrives; users stuck on "check your email" screen.

### Pitfall 3: BETTER_AUTH_URL Set to Wrong Value in Production

**What goes wrong:** OAuth callbacks fail with "invalid redirect URI" or "callback URL mismatch". Email verification links point to wrong domain.

**Why it happens:** `BETTER_AUTH_URL` is the canonical base URL for Better Auth — it's used for OAuth callback URL construction and session cookie domain. If it doesn't match the deployed service URL exactly (including protocol and no trailing slash), OAuth providers reject the callback.

**How to avoid:** Set `BETTER_AUTH_URL` to the exact Render service URL: `https://secureshare.onrender.com` (no trailing slash). OAuth provider apps (Google Console, GitHub OAuth Apps) must have `https://secureshare.onrender.com/api/auth/callback/google` and `.../github` in their redirect URI allowlists.

**Warning signs:** OAuth sign-in redirects back to app with `?error=oauth` in the URL; email verification links lead to 404.

### Pitfall 4: VITE_POSTHOG_KEY Not Baked into Docker Image

**What goes wrong:** PostHog analytics is silently disabled in the deployed app even though `VITE_POSTHOG_KEY` is set in the Render dashboard.

**Why it happens:** Vite evaluates `import.meta.env.VITE_POSTHOG_KEY` at bundle build time. If the key is not available as a Docker build arg during `npm run build:client`, it's replaced with `undefined` in the bundle. Setting it as a runtime env var has no effect.

**How to avoid:** Add `ARG VITE_POSTHOG_KEY` and `ARG VITE_POSTHOG_HOST` to the `build` stage of the Dockerfile. Add `VITE_POSTHOG_KEY` and `VITE_POSTHOG_HOST` to render.yaml `envVars` (with `sync: false`). Render automatically passes env vars as Docker build args when the Dockerfile has matching `ARG` instructions.

**Warning signs:** No events appear in PostHog dashboard after deployment; `initAnalytics()` silently returns early because `import.meta.env.VITE_POSTHOG_KEY` is `undefined`.

### Pitfall 5: Docker Compose Missing Auth Vars Causes Immediate Crash

**What goes wrong:** `docker compose up` exits immediately.

**Why it happens:** The current `docker-compose.yml` app environment section has only 6 vars (`DATABASE_URL`, `REDIS_URL`, `NODE_ENV`, `FORCE_HTTPS`, `PORT`, `LOG_LEVEL`). The Zod schema now requires `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` unconditionally, plus `RESEND_API_KEY` and `RESEND_FROM_EMAIL`.

**How to avoid:** Add placeholder values for all required auth vars to docker-compose.yml app environment.

**Warning signs:** Container exits with code 1 immediately; `docker compose logs app` shows ZodError.

### Pitfall 6: SMTP Ports Blocked on Render Free Tier

**What goes wrong:** Resend email delivery fails on Render free tier.

**Why it happens:** Render free tier blocks outbound traffic on ports 25, 465, 587 (common SMTP ports). Resend uses HTTPS (port 443) for its API — this is NOT affected by the SMTP port block. Resend's API approach sidesteps this limitation entirely.

**How to avoid:** No action needed — Resend's SDK uses `https://api.resend.com` on port 443, which is not blocked.

**Warning signs (false alarm):** Seeing articles about Render SMTP restrictions and assuming Resend is affected — it is not.

## Code Examples

### Complete Updated render.yaml

```yaml
# Render.com Blueprint — one-click deployment for SecureShare
# Deploy: https://render.com/deploy → import this repo
#
# IMPORTANT: After initial Blueprint creation, manually add all sync:false
# environment variables in the Render dashboard before the app will function.
# See the deployment checklist in the READM for required manual steps.
#
# Free tier notes:
# - Free PostgreSQL expires after 30 days (14-day grace period to upgrade)
# - Free Redis data is ephemeral (lost on restart; rate limit counters reset)
# - Free web services spin down after 15 minutes of inactivity (~60s cold start)

services:
  - type: web
    name: secureshare
    runtime: docker
    plan: free
    region: oregon
    autoDeployTrigger: checksPass
    healthCheckPath: /api/health
    dockerCommand: "sh -c 'node --import tsx server/src/db/migrate.ts && node --import tsx server/src/server.ts'"
    envVars:
      # Wired from provisioned database — no manual input needed
      - key: DATABASE_URL
        fromDatabase:
          name: secureshare-db
          property: connectionString
      # Wired from provisioned Redis — no manual input needed
      - key: REDIS_URL
        fromService:
          type: keyvalue
          name: secureshare-redis
          property: connectionString
      - key: NODE_ENV
        value: production
      - key: FORCE_HTTPS
        value: 'true'
      - key: LOG_LEVEL
        value: info

      # === Authentication (required — set in Render dashboard after Blueprint sync) ===
      # Generate with: openssl rand -base64 32
      - key: BETTER_AUTH_SECRET
        sync: false
      # Set to your Render service URL: https://secureshare.onrender.com
      - key: BETTER_AUTH_URL
        sync: false

      # === Email delivery via Resend (required for auth emails) ===
      - key: RESEND_API_KEY
        sync: false
      # Format: "SecureShare <noreply@yourdomain.com>"
      - key: RESEND_FROM_EMAIL
        sync: false

      # === OAuth providers (optional — omit to disable social login) ===
      - key: GOOGLE_CLIENT_ID
        sync: false
      - key: GOOGLE_CLIENT_SECRET
        sync: false
      - key: GITHUB_CLIENT_ID
        sync: false
      - key: GITHUB_CLIENT_SECRET
        sync: false

      # === Analytics (optional — PostHog baked in at build time) ===
      # Setting these triggers a redeploy that bakes them into the JS bundle.
      - key: VITE_POSTHOG_KEY
        sync: false
      - key: VITE_POSTHOG_HOST
        sync: false

  - type: keyvalue
    name: secureshare-redis
    plan: free
    region: oregon
    ipAllowList: []
    maxmemoryPolicy: allkeys-lru

databases:
  - name: secureshare-db
    plan: free
    region: oregon
    postgresMajorVersion: '17'
```

### Updated Dockerfile Build Stage (VITE_ build args)

```dockerfile
# Stage 2: Build frontend assets with Vite
FROM deps AS build
WORKDIR /app
COPY . .
# PostHog analytics are baked into the JS bundle at build time.
# Pass via --build-arg or Render dashboard env vars (Render auto-passes as build args).
# If not provided, analytics are silently disabled (safe default for local Docker builds).
ARG VITE_POSTHOG_KEY
ARG VITE_POSTHOG_HOST
RUN npm run build:client
```

### docker-compose.yml App Environment Section (v4.0 complete)

```yaml
  app:
    build: .
    init: true
    ports:
      - '3000:3000'
    environment:
      DATABASE_URL: postgresql://secureshare:secureshare@db:5432/secureshare
      REDIS_URL: redis://redis:6379
      NODE_ENV: production
      FORCE_HTTPS: 'false'
      PORT: '3000'
      LOG_LEVEL: info
      # Auth — required by Zod schema; placeholder values prevent startup crash.
      # Replace with real values to test auth features locally.
      BETTER_AUTH_SECRET: 'local-development-secret-must-be-at-least-32-chars'
      BETTER_AUTH_URL: 'http://localhost:3000'
      # Email — placeholder satisfies z.string().min(1) but emails won't deliver.
      # Set real Resend credentials to test email verification/reset locally.
      RESEND_API_KEY: 'placeholder-not-sent-in-docker-local-dev'
      RESEND_FROM_EMAIL: 'SecureShare <noreply@localhost>'
      # OAuth — omit to disable Google/GitHub buttons (correct for local dev)
      # GOOGLE_CLIENT_ID: ...
      # GOOGLE_CLIENT_SECRET: ...
      # GITHUB_CLIENT_ID: ...
      # GITHUB_CLIENT_SECRET: ...
      # PostHog — omit to disable analytics (correct for local dev)
      # VITE_POSTHOG_KEY is a build-time var; set it before docker build, not here
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    command:
      [
        'sh',
        '-c',
        'node --import tsx server/src/db/migrate.ts && node --import tsx server/src/server.ts',
      ]
```

## State of the Art

| Old Approach | Current Approach | Confirmed Via | Impact |
|--------------|------------------|---------------|--------|
| `type: redis` in render.yaml | `type: keyvalue` | Phase 16 RESEARCH.md (already migrated) | Already correct — no change needed |
| `env:` field in render.yaml | `runtime:` field | Phase 16 RESEARCH.md (already migrated) | Already correct — no change needed |
| `preDeployCommand` for migrations | `dockerCommand` prefix | Render docs (paid-only feature) | Already correct — current pattern is right for free tier |
| Internal Redis with no TLS | Internal Redis with no TLS | Render ioredis docs | No TLS for internal connections; current pattern is correct |
| No `sync: false` for secrets | `sync: false` for all credentials | Render Blueprint docs | Phase 30 adds this |
| No VITE_ ARG in Dockerfile | `ARG VITE_POSTHOG_KEY` in build stage | Vite docs (build-time env) | Phase 30 adds this |
| No auth vars in render.yaml | All auth vars declared | Phase 30 | Phase 30 adds this |

**Deprecated/outdated (already handled in Phase 16):**
- `docker-compose` hyphenated binary: Phase 16 already uses `docker compose` (v2)
- Render `env:` field: Phase 16 already uses `runtime:`
- `type: redis`: Phase 16 already uses `type: keyvalue`

## Open Questions

1. **Should `APP_URL` be added to render.yaml?**
   - What we know: `APP_URL` is an optional Zod var (`z.string().url().optional()`). In production where BETTER_AUTH_URL and the app URL are the same domain, APP_URL can be omitted (the `toAppUrl()` function is a no-op when APP_URL is not set). The `.env.example` notes: "In production, omit or set to the same value as BETTER_AUTH_URL."
   - What's unclear: Whether deployers will understand they should NOT set APP_URL in production, or if they'll copy it from `.env.example`.
   - Recommendation: Do NOT add `APP_URL` to render.yaml. It's optional and the production no-op behavior is correct. Document this in the render.yaml comments: "APP_URL: omit in production (same domain as BETTER_AUTH_URL)."

2. **Should the `package.json` version be updated from 3.0.0 to 4.0.0?**
   - What we know: `package.json` has `"version": "3.0.0"` since the v3.0 milestone. v4.0 is complete.
   - What's unclear: Whether this matters — the version field is not used anywhere in the application code.
   - Recommendation: Update to `4.0.0` as part of this phase. Low-effort housekeeping. The phase is named "fixes" which includes housekeeping items.

3. **Does the Dockerfile's HEALTHCHECK need to pass FORCE_HTTPS: true via env?**
   - What we know: The current HEALTHCHECK is `node -e "fetch('http://localhost:3000/api/health',{headers:{'X-Forwarded-Proto':'https'}})..."`. The `X-Forwarded-Proto: https` header is needed to prevent HTTPS redirect loop when `FORCE_HTTPS=true`. This was implemented in Phase 16.
   - What's unclear: Nothing — this is already correct. The healthcheck header was specifically added to handle the FORCE_HTTPS case.
   - Recommendation: No change needed to HEALTHCHECK.

4. **Should CI pipeline be updated to verify Docker build succeeds?**
   - What we know: The CI workflow (`.github/workflows/ci.yml`) runs lint, unit tests, and E2E tests. It does not run `docker build`. If the Dockerfile becomes broken, CI won't catch it.
   - What's unclear: Whether adding `docker build` to CI is in scope for Phase 30.
   - Recommendation: This is in scope. A simple `docker build --no-cache -t secureshare:ci-test .` step in CI would catch Dockerfile regressions. Low-effort, high-value guard.

## Sources

### Primary (HIGH confidence)
- Render Blueprint YAML Reference: https://render.com/docs/blueprint-spec — `sync: false`, `runtime: docker`, valid plan values, env var field structure
- Render Default Environment Variables: https://render.com/docs/environment-variables — PORT=10000 auto-injected, RENDER=true, per-runtime vars
- Connect to Render Key Value with ioredis: https://render.com/docs/connecting-to-redis-with-ioredis — internal `redis://` URL (no TLS), external `rediss://` URL (TLS required)
- Render Free Tier: https://render.com/docs/free — 15min spin-down, SMTP port blocks (not affecting Resend), ephemeral Redis
- Render Free Postgres expiry: https://render.com/changelog/free-postgresql-instances-now-expire-after-30-days-previously-90 — 30 days confirmed still active 2025
- Better Auth Options docs: https://www.better-auth.com/docs/reference/options — BETTER_AUTH_SECRET, BETTER_AUTH_URL required in production
- Vite environment variables: https://vitejs.dev/guide/env-and-mode — VITE_ prefix baked at build time, not available at runtime
- Project codebase — `server/src/config/env.ts`: confirmed required vars BETTER_AUTH_SECRET, BETTER_AUTH_URL, RESEND_API_KEY, RESEND_FROM_EMAIL
- Project codebase — git log: confirmed render.yaml last touched in commit `33beb75` (Phase 16, 2026-02-17) — predates all v4.0 auth vars
- Phase 16 RESEARCH.md: baseline Docker architecture decisions, all still valid

### Secondary (MEDIUM confidence)
- WebFetch Render Blueprint docs: `sync: false` pattern confirmed with examples; limitation on Blueprint updates confirmed
- WebFetch Render Docker docs: PORT=10000 default confirmed; BuildKit used for Docker builds; build args auto-passed from env vars

### Tertiary (LOW confidence)
- WebSearch community posts: Render free tier SMTP port block behavior (not relevant to Resend HTTPS API)

## Metadata

**Confidence breakdown:**
- Missing env vars (root cause): HIGH — verified by direct code inspection of `server/src/config/env.ts` vs `render.yaml` vs `docker-compose.yml`
- render.yaml `sync: false` pattern: HIGH — verified via official Render docs
- VITE_ build-time requirement: HIGH — Vite fundamentals; confirmed in `posthog.ts` which uses `import.meta.env.VITE_POSTHOG_KEY`
- Render internal Redis (no TLS): HIGH — verified via official Render ioredis guide
- CI Docker build step: MEDIUM — standard practice; not verified if Render's CI setup has any constraints

**Research date:** 2026-02-21
**Valid until:** 2026-03-21 (30 days — Render Blueprint spec and Vite fundamentals are stable)

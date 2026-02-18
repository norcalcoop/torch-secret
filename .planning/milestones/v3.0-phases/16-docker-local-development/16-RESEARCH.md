# Phase 16: Docker & Local Development - Research

**Researched:** 2026-02-17
**Domain:** Docker containerization, Docker Compose local development, Render.com deployment
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DOCK-01 | Multi-stage Dockerfile using node:24-slim builds production-optimized image | Multi-stage build pattern with node:24-slim base, argon2 native binary handling, layer caching strategy |
| DOCK-02 | docker-compose.yml starts app + PostgreSQL + Redis for local development with one command | Compose service definitions with healthchecks, depends_on conditions, volume persistence, environment variables |
| DOCK-03 | Health check endpoint (GET /api/health) returns service status for Docker, Render, and Playwright | Express health endpoint pattern checking DB connectivity via `SELECT 1`, Redis ping, uptime reporting |
| DOCK-04 | Render.com Blueprint (render.yaml) enables one-click production deployment | Render Blueprint spec with runtime: docker, keyvalue, databases, fromDatabase/fromService env var wiring |
| DOCK-05 | Production Docker image runs without dev dependencies and uses non-root user | npm ci --omit=dev, built-in `node` user (UID 1000), COPY --chown, init: true for signal handling |
</phase_requirements>

## Summary

This phase containerizes SecureShare for both local development (Docker Compose) and production deployment (Render.com). The project is a Node.js 24 + Express 5 application with a PostgreSQL database, optional Redis for rate limiting, and a native C++ dependency (argon2) that requires special handling in Docker builds.

The primary challenge is the multi-stage Dockerfile. The `argon2` package uses `@mapbox/node-pre-gyp` for native bindings -- prebuilt binaries exist for Ubuntu/Debian x86-64 and work on `node:24-slim` (Debian Bookworm), but a build stage with compilation tools is needed as a fallback. The Vite frontend build must also happen in a build stage, with only the `client/dist` output copied to the production image. The production stage should use `npm ci --omit=dev` and run as the built-in `node` user (UID 1000).

A health check endpoint (`GET /api/health`) is needed as a cross-cutting concern: Docker Compose healthchecks, Render.com service health, and future Playwright E2E tests (Phase 17) all need it. The endpoint should check PostgreSQL connectivity (via `SELECT 1`) and optionally report Redis status. The Render.com Blueprint (`render.yaml`) uses `runtime: docker` for the web service, `databases` for PostgreSQL, and `type: keyvalue` for Redis, with environment variables wired via `fromDatabase` and `fromService` references.

**Primary recommendation:** Build a 3-stage Dockerfile (deps, build, production), use `docker compose` with `depends_on: condition: service_healthy` for startup ordering, and wire the health endpoint before anything else since it unblocks both Docker and Render configuration.

## Standard Stack

### Core
| Component | Version/Tag | Purpose | Why Standard |
|-----------|-------------|---------|--------------|
| node:24-slim | 24.x (bookworm-slim) | Docker base image | Matches project's Node 24.x LTS target; slim variant is ~200MB vs ~1GB full; Debian Bookworm has compatible glibc for argon2 prebuilt binaries |
| Docker Compose | v2 (docker compose) | Local multi-service orchestration | Built into Docker Desktop; single-command startup; service discovery by name |
| PostgreSQL 17 | 17-alpine | Database container | Matches project's PostgreSQL 17+ requirement; alpine variant is smaller |
| Redis 7 | 7-alpine | Rate limiting cache | Compatible with ioredis 5.x; alpine for smaller image |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| tini (via init: true) | PID 1 signal handling | Always in production; Node.js does not handle SIGTERM/SIGINT as PID 1 |
| .dockerignore | Exclude files from build context | Always; prevents node_modules, .git, .planning from bloating context |
| render.yaml | Render.com Blueprint IaC | Production deployment configuration |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| node:24-slim | node:24-alpine | Alpine uses musl libc; argon2 prebuilt binaries for Alpine exist but less tested; slim (glibc) is safer |
| node:24-slim | node:24 (full) | Full image is ~1GB vs ~200MB; no advantage since we install deps ourselves |
| Docker Compose healthcheck | wait-for-it.sh scripts | Compose healthchecks are native, declarative, and recommended over third-party scripts |
| tini via init: true | dumb-init package | Docker's built-in --init / Compose init: true uses tini already bundled with Docker; no need to install separately |

## Architecture Patterns

### Recommended Dockerfile Structure (3-Stage)
```
Stage 1: deps     -- Install ALL dependencies (dev + prod) for building
Stage 2: build    -- Build client (Vite) and compile any needed assets
Stage 3: prod     -- Production image with only prod deps + built artifacts
```

### Pattern 1: Multi-Stage Dockerfile for Node.js with Native Dependencies
**What:** Three build stages that separate dependency installation, asset building, and production runtime.
**When to use:** Any Node.js project with native modules (argon2) and a frontend build step (Vite).
**Example:**
```dockerfile
# Source: https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md
# Stage 1: Install dependencies
FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build frontend
FROM deps AS build
COPY . .
RUN npm run build:client

# Stage 3: Production
FROM node:24-slim AS production
ENV NODE_ENV=production
WORKDIR /app

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy built frontend and server source
COPY --from=build /app/client/dist ./client/dist
COPY server/ ./server/
COPY shared/ ./shared/
COPY drizzle.config.ts tsconfig.json ./

# Use non-root user
USER node

EXPOSE 3000
CMD ["node", "--import", "tsx", "server/src/server.ts"]
```

### Pattern 2: Docker Compose with Healthcheck-Based Startup Ordering
**What:** Use `depends_on` with `condition: service_healthy` to ensure PostgreSQL and Redis are ready before the app starts.
**When to use:** Local development with multiple services.
**Example:**
```yaml
# Source: https://docs.docker.com/compose/how-tos/startup-order/
services:
  db:
    image: postgres:17-alpine
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U secureshare"]
      interval: 5s
      timeout: 5s
      retries: 5
      start_period: 10s

  app:
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
```

### Pattern 3: Health Check Endpoint with Dependency Status
**What:** A `/api/health` endpoint that reports the status of the app and its dependencies (DB, Redis).
**When to use:** Required by Docker HEALTHCHECK, Render.com health monitoring, and E2E test readiness checks.
**Example:**
```typescript
// Health check endpoint pattern
// Source: https://expressjs.com/en/advanced/healthcheck-graceful-shutdown.html
app.get('/api/health', async (_req, res) => {
  const checks: Record<string, string> = { status: 'ok' };

  try {
    await pool.query('SELECT 1');
    checks.database = 'connected';
  } catch {
    checks.database = 'disconnected';
    checks.status = 'degraded';
  }

  const statusCode = checks.status === 'ok' ? 200 : 503;
  res.status(statusCode).json({
    ...checks,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});
```

### Pattern 4: Render.com Blueprint with Docker Runtime
**What:** A `render.yaml` that defines the web service, PostgreSQL database, and Redis key-value store with environment variable wiring.
**When to use:** One-click production deployment to Render.com.
**Example:**
```yaml
# Source: https://render.com/docs/blueprint-spec
services:
  - type: web
    name: secureshare
    runtime: docker
    plan: free
    healthCheckPath: /api/health
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: secureshare-db
          property: connectionString
      - key: REDIS_URL
        fromService:
          type: keyvalue
          name: secureshare-redis
          property: connectionString
      - key: NODE_ENV
        value: production

  - type: keyvalue
    name: secureshare-redis
    plan: free
    ipAllowList: []
    maxmemoryPolicy: allkeys-lru

databases:
  - name: secureshare-db
    plan: free
    postgresMajorVersion: "17"
```

### Anti-Patterns to Avoid
- **Running npm install instead of npm ci in Docker:** `npm install` resolves dependencies non-deterministically; `npm ci` uses the lockfile exactly, is faster, and fails if out of sync
- **Copying node_modules from host into container:** Host may have platform-specific native binaries (macOS vs Linux); always install inside the container
- **Running as root in production container:** Violates principle of least privilege; if the app is compromised, attacker has root access to the container
- **Using `npm start` as CMD:** Adds an extra process (npm) between Docker signals and Node.js; use `node` directly so SIGTERM reaches the process
- **Building frontend in the production stage:** Includes devDependencies (Vite, Tailwind, TypeScript) in the final image; use a separate build stage
- **Hardcoding PORT in Dockerfile:** Render.com defaults to PORT=10000; the app should read PORT from environment variable (it already does via Zod env config)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PID 1 signal handling | Custom signal forwarding | Docker's `init: true` / `--init` flag | Handles zombie process reaping and signal forwarding correctly; tini is battle-tested |
| Service startup ordering | Shell scripts with sleep/retry loops | Docker Compose `depends_on: condition: service_healthy` | Native, declarative, no scripts to maintain |
| Database readiness check | Custom TCP connection retry | `pg_isready` in PostgreSQL healthcheck | Built into PostgreSQL image, purpose-built for this |
| Environment variable validation | Manual process.env checks | Zod schema (already exists in env.ts) | Already implemented; just ensure PORT default works for both local and Render |
| Docker build context filtering | Manual COPY exclusions | `.dockerignore` file | Prevents sending GBs of node_modules/.git to Docker daemon |

**Key insight:** Docker and Docker Compose provide native solutions for every orchestration concern (init, healthchecks, startup ordering, networking). Custom scripts are a maintenance burden and often have edge cases that the native tools handle correctly.

## Common Pitfalls

### Pitfall 1: argon2 Native Binary Fails in Production Image
**What goes wrong:** `npm ci --omit=dev` in the production stage tries to download argon2 prebuilt binaries but fails because the slim image lacks the network tools or the binary platform doesn't match.
**Why it happens:** argon2 uses `@mapbox/node-pre-gyp` which downloads platform-specific prebuilt binaries during `npm install/ci`. If the download fails, it falls back to compiling from source, which requires build tools not present in slim images.
**How to avoid:** Install all dependencies (including dev) in the `deps` stage using the full `npm ci`. Then in the production stage, run `npm ci --omit=dev` which should pick up prebuilt binaries for Debian Bookworm x86-64. If this fails, copy `node_modules/argon2` from the deps stage. Test the production image build locally before deployment.
**Warning signs:** Build fails with "node-pre-gyp ERR!" or "gyp ERR!" in the production stage.

### Pitfall 2: Render.com PORT Mismatch
**What goes wrong:** The app starts but Render.com cannot reach it, returning 502 Bad Gateway.
**Why it happens:** Render.com's default PORT is 10000, but the app defaults to 3000 (from env.ts Zod schema). If PORT env var is not explicitly set in render.yaml, the app binds to 3000 while Render routes to 10000.
**How to avoid:** Do NOT set PORT in render.yaml. Render automatically provides PORT=10000. The app's Zod schema has `PORT: z.coerce.number().default(3000)` which will use the Render-provided PORT value when present. Ensure the app binds to `0.0.0.0` (Express does this by default).
**Warning signs:** Deploy succeeds but health check fails; logs show "server started on port 3000" while Render expects 10000.

### Pitfall 3: Database Migrations Not Running in Production
**What goes wrong:** The app starts but crashes with "relation 'secrets' does not exist" because migrations haven't been applied.
**Why it happens:** The project currently uses `drizzle-kit push` for local development (schema sync) but has no generated migration files in a `drizzle/` directory. Production deployments need a migration strategy.
**How to avoid:** Generate migrations with `drizzle-kit generate` and commit the `drizzle/` directory. Then use `drizzle-kit migrate` (or the programmatic `migrate()` function) as part of the startup sequence. For Render free tier (no `preDeployCommand`), use `dockerCommand` to run migrations before starting the server: `"/bin/sh -c \"npm run db:migrate && node --import tsx server/src/server.ts\""`.
**Warning signs:** App starts, health check passes, but API calls fail with PostgreSQL "relation does not exist" errors.

### Pitfall 4: Docker Build Context Too Large
**What goes wrong:** `docker build` takes minutes and uses GBs of disk.
**Why it happens:** Without `.dockerignore`, the entire repo (including `node_modules/`, `.git/`, `.planning/`, PNG files) is sent to the Docker daemon.
**How to avoid:** Create a `.dockerignore` that excludes: `node_modules`, `.git`, `dist`, `.planning`, `*.png`, `.env`, `.husky`, `.playwright-mcp`.
**Warning signs:** "Sending build context to Docker daemon" shows hundreds of MB.

### Pitfall 5: Health Endpoint Mounted After Security Middleware
**What goes wrong:** Health check requests are rate-limited, blocked by CSP, or fail due to missing headers.
**Why it happens:** The health endpoint is mounted after the full middleware stack (Helmet, rate limiter, etc.).
**How to avoid:** Mount the health endpoint early in the middleware chain -- BEFORE rate limiting and Helmet, but AFTER the JSON parser. The health endpoint is infrastructure, not user-facing, and should not be subject to security restrictions. However, note it currently needs to be after routes are set up for the current middleware order. The simplest approach: mount it on the Express app directly in `app.ts` before the secrets router, since it doesn't need CSP nonce, rate limiting, or HTTPS redirect.
**Warning signs:** Health check returns 429 (rate limited) or has CSP headers that confuse monitoring tools.

### Pitfall 6: Render.com Free Tier PostgreSQL Expires After 30 Days
**What goes wrong:** Production database disappears after 30 days.
**Why it happens:** Render.com free tier PostgreSQL databases expire 30 days after creation with a 14-day grace period to upgrade before deletion.
**How to avoid:** Be aware this is a limitation of the free tier. The render.yaml should document this in comments. For actual production use, upgrade to a paid PostgreSQL plan.
**Warning signs:** Database queries start failing ~30 days after initial deployment.

### Pitfall 7: tsx Not Available in Production Image
**What goes wrong:** `CMD ["node", "--import", "tsx", "server/src/server.ts"]` fails because `tsx` is a devDependency.
**Why it happens:** `npm ci --omit=dev` does not install `tsx`, but the server uses TypeScript source directly (no separate compile step for server code).
**How to avoid:** Either: (a) Add `tsx` to production dependencies, or (b) compile server TypeScript to JavaScript in the build stage and run compiled JS in production, or (c) keep tsx as a production dependency (simplest). Since tsx is small (~2MB) and the project runs server TS directly, moving tsx to dependencies is the pragmatic choice.
**Warning signs:** Container exits immediately with "Cannot find module tsx" or "Unknown module format".

## Code Examples

Verified patterns from official sources:

### Complete Multi-Stage Dockerfile
```dockerfile
# Source: https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md
# Stage 1: Install all dependencies (needed for native modules like argon2)
FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build frontend assets
FROM deps AS build
WORKDIR /app
COPY . .
RUN npm run build:client

# Stage 3: Production image
FROM node:24-slim AS production
ENV NODE_ENV=production
WORKDIR /app

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy server source (TypeScript, run via tsx)
COPY server/ ./server/
COPY shared/ ./shared/
COPY drizzle.config.ts tsconfig.json ./

# Copy built frontend from build stage
COPY --from=build /app/client/dist ./client/dist

# Copy drizzle migrations if they exist
COPY drizzle/ ./drizzle/

# Switch to non-root user (built into node images, UID 1000)
USER node

EXPOSE 3000
CMD ["node", "--import", "tsx", "server/src/server.ts"]
```

### Docker Compose for Local Development
```yaml
# Source: https://docs.docker.com/compose/how-tos/startup-order/
services:
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: secureshare
      POSTGRES_PASSWORD: secureshare
      POSTGRES_DB: secureshare
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U secureshare"]
      interval: 5s
      timeout: 5s
      retries: 5
      start_period: 10s

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  app:
    build: .
    init: true
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://secureshare:secureshare@db:5432/secureshare
      REDIS_URL: redis://redis:6379
      NODE_ENV: development
      PORT: "3000"
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy

volumes:
  pgdata:
```

### Health Check Endpoint
```typescript
// Source: https://expressjs.com/en/advanced/healthcheck-graceful-shutdown.html
// Mount in app.ts BEFORE rate-limited routes
import { pool } from './db/connection.js';

app.get('/api/health', async (_req, res) => {
  const health: Record<string, unknown> = {
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };

  // Check database connectivity
  try {
    await pool.query('SELECT 1');
    health.database = 'connected';
  } catch {
    health.database = 'disconnected';
    health.status = 'degraded';
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});
```

### Docker HEALTHCHECK Using Node.js (No curl/wget in slim)
```dockerfile
# Source: https://github.com/nodejs/docker-node/issues/1185
# node:24-slim does NOT include curl or wget
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r => { if (!r.ok) throw new Error(); }).catch(() => process.exit(1))"
```

### .dockerignore
```
node_modules
.git
.gitignore
.planning
.playwright-mcp
.husky
.env
.env.*
!.env.example
dist
*.png
*.md
!package.json
.DS_Store
cached-*.md
.claude
.claude.local.md
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| docker-compose (v1, Python) | docker compose (v2, Go plugin) | 2023 | V1 is deprecated; use `docker compose` (space, not hyphen) |
| wait-for-it.sh scripts | depends_on: condition: service_healthy | Docker Compose v2.1+ | Native healthcheck-based ordering; no scripts needed |
| Custom init process (dumb-init) | Docker --init / Compose init: true | Docker 1.13+ | Tini bundled with Docker; no package installation needed |
| HEALTHCHECK with curl | HEALTHCHECK with node -e fetch() | Node 18+ (global fetch) | No need to install curl in slim images; Node.js fetch is built-in |
| render.yaml env: docker | render.yaml runtime: docker | 2025 | `env` field deprecated in favor of `runtime` |
| render.yaml type: redis | render.yaml type: keyvalue | 2024 | `redis` is deprecated alias; use `keyvalue` |
| preDeployCommand for migrations | dockerCommand with migration prefix | Free tier limitation | preDeployCommand requires paid plan; free tier uses dockerCommand chain |

**Deprecated/outdated:**
- `docker-compose` (hyphenated binary): Replaced by `docker compose` plugin
- Render.com `env` field: Use `runtime` instead
- Render.com `type: redis`: Use `type: keyvalue`

## Open Questions

1. **Database Migrations Strategy**
   - What we know: The project uses `drizzle-kit push` for local development. No `drizzle/` migration directory exists with generated SQL files. The `db:migrate` script (`drizzle-kit migrate`) and the programmatic `migrate()` function (in `server/src/db/migrate.ts`) exist but have no migration files to apply.
   - What's unclear: Whether to generate migrations now or continue using `push` for local dev and generate for production only.
   - Recommendation: Generate migrations with `drizzle-kit generate` and commit the `drizzle/` directory. Use `drizzle-kit push` for local dev (via Compose) and `drizzle-kit migrate` for production. The Docker entrypoint for Render should run `npm run db:migrate` before the server starts.

2. **tsx in Production Dependencies**
   - What we know: The server runs TypeScript directly via `tsx` (no compile step). tsx is currently a devDependency. The production Docker image needs tsx to run the server.
   - What's unclear: Whether to move tsx to dependencies or add a server compilation step.
   - Recommendation: Move `tsx` from devDependencies to dependencies. It's ~2MB and eliminates the need for a server build step. The alternative (compiling server TS with tsc) would require updating all import paths to use `.js` extensions and maintaining a separate build output, which is unnecessary complexity for this project size.

3. **Render.com Free Tier Viability**
   - What we know: Free tier PostgreSQL expires after 30 days. Free tier Redis data is ephemeral (lost on restart). Free web services spin down after 15 minutes of inactivity.
   - What's unclear: Whether the free tier is suitable for a demo/portfolio deployment.
   - Recommendation: Use free tier for initial deployment and testing. Document the 30-day PostgreSQL expiry in render.yaml comments. The app already handles Redis absence gracefully (falls back to in-memory rate limiting). The render.yaml should work with both free and paid tiers.

## Sources

### Primary (HIGH confidence)
- [Docker Hub node:24-slim](https://hub.docker.com/layers/library/node/24-slim) - Base image availability and tags verified
- [Node.js Docker Best Practices](https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md) - Non-root user, CMD patterns, signal handling, multi-stage builds
- [Render Blueprint YAML Reference](https://render.com/docs/blueprint-spec) - runtime: docker, keyvalue type, fromDatabase/fromService, healthCheckPath, plan names
- [Render Docker Docs](https://render.com/docs/docker) - Docker deployment requirements, dockerCommand
- [Render Default Environment Variables](https://render.com/docs/environment-variables) - PORT defaults to 10000
- [Render Free Tier](https://render.com/docs/free) - PostgreSQL 30-day expiry, Redis ephemeral, web service spin-down
- [Docker Compose Startup Order](https://docs.docker.com/compose/how-tos/startup-order/) - depends_on with service_healthy condition
- [Render ioredis Connection](https://render.com/docs/connecting-to-redis-with-ioredis) - Internal vs external connection, TLS requirements
- [Express Health Check Docs](https://expressjs.com/en/advanced/healthcheck-graceful-shutdown.html) - Liveness/readiness pattern

### Secondary (MEDIUM confidence)
- [node-argon2 GitHub](https://github.com/ranisalt/node-argon2) - Prebuilt binary platforms (Ubuntu 22.04, Alpine 3.18, macOS, Windows); v0.44.0 current
- [node:24 bookworm-slim Dockerfile](https://github.com/nodejs/docker-node/blob/893511202f3e478d6b23e76b5658b93be6e906b7/24/bookworm-slim/Dockerfile) - Base is debian:bookworm-slim, Node 24.13.0, includes curl workaround removal
- [Drizzle ORM Migrations](https://orm.drizzle.team/docs/migrations) - migrate() function with node-postgres pattern

### Tertiary (LOW confidence)
- [node:slim curl removal](https://github.com/nodejs/docker-node/issues/1185) - Confirms curl not in slim images; use Node.js fetch for healthchecks

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Docker, PostgreSQL, Redis images are well-documented with stable APIs
- Architecture: HIGH - Multi-stage Dockerfile and Compose patterns are well-established; Render Blueprint spec is documented
- Pitfalls: HIGH - argon2 native deps, PORT mismatch, tsx availability, and migration gaps are documented and verified
- Health check endpoint: HIGH - Simple Express route with pg pool.query; well-understood pattern
- Render.com specifics: MEDIUM - render.yaml spec is stable but some fields (preDeployCommand availability per tier) required cross-verification

**Research date:** 2026-02-17
**Valid until:** 2026-03-17 (30 days -- Docker and Render specs are stable)

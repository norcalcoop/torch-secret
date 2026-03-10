# ============================================================
# Stage 1: Install ALL dependencies (dev + prod)
# Needed for: Vite frontend build, native modules (argon2)
# ============================================================
FROM node:25-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ============================================================
# Stage 2: Build frontend assets with Vite
# ============================================================
FROM deps AS build
WORKDIR /app
COPY . .
# PostHog analytics are baked into the JS bundle at build time.
# Pass via --build-arg or set in Render dashboard (Render auto-passes env vars as build args).
# If not provided, analytics are silently disabled — safe default for local Docker builds.
ARG VITE_POSTHOG_KEY
ARG VITE_POSTHOG_HOST
RUN npm run build:client

# ============================================================
# Stage 3: Production image (minimal)
# - Only production dependencies (no vite, eslint, vitest)
# - Non-root user (node, UID 1000)
# - Includes tsx for running TypeScript server directly
# ============================================================
FROM node:25-slim AS production
ENV NODE_ENV=production
WORKDIR /app

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Copy server source (TypeScript, executed via tsx at runtime)
COPY server/ ./server/
COPY shared/ ./shared/
COPY tsconfig.json ./
COPY server/tsconfig.json ./server/tsconfig.json

# Copy Drizzle SQL migrations for ORM migrator (migrate.ts)
COPY drizzle/ ./drizzle/

# Copy startup script (runs migrations then starts the server)
COPY scripts/start.sh ./scripts/start.sh
RUN chmod +x ./scripts/start.sh

# Copy built frontend from build stage
COPY --from=build /app/client/dist ./client/dist

# Docker HEALTHCHECK (node:24-slim has no curl/wget)
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health',{headers:{'X-Forwarded-Proto':'https'}}).then(r=>{if(!r.ok)throw new Error()}).catch(()=>process.exit(1))"

# Switch to non-root user (built into node images, UID 1000)
USER node

EXPOSE 3000
CMD ["./scripts/start.sh"]

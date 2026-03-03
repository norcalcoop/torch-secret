# Phase 42: Resend Account Migration - Research

**Researched:** 2026-03-02
**Domain:** Resend API credentials migration, Infisical secrets management, CI/CD environment variables
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Audience / subscriber data**
- No real marketing subscribers exist yet — only test accounts on the old Resend Audience
- Do NOT export or import contacts from the old Audience
- Create a fresh Audience on the new Resend account and obtain the new `RESEND_AUDIENCE_ID`
- The local `marketing_subscribers` DB table is the canonical source of truth; the Resend Audience is a best-effort sync target

**From email address**
- Staying with the Resend subdomain for now (e.g., `onboarding@resend.dev` or equivalent on the new account)
- `RESEND_FROM_EMAIL` should reflect the new account's default sending address
- No custom domain verification required at this stage

**Environment credential rollout**
- All three of these values need updating: `RESEND_API_KEY`, `RESEND_AUDIENCE_ID`, `RESEND_FROM_EMAIL` (if it changes)
- Environments to update:
  1. Local `.env` — direct value replacement
  2. Infisical `dev` environment (project slug: `torch-secret-28-vs`)
  3. Infisical `staging` environment
  4. Infisical `prod` environment
- `docker-compose.yml` passes through env vars from host — no change needed there
- `render.yaml` uses `sync: false` — no change needed in the file; Render dashboard values come from Infisical

**CI/CD credential handling**
- `.github/workflows/ci.yml` hardcodes `RESEND_FROM_EMAIL: "Torch Secret <noreply@torchsecret.com>"` for test runs
- This domain has NOT been verified on the new account (staying with Resend subdomain)
- Planner should assess whether this CI value needs updating or whether CI email sends are mocked/no-op in test env

**Old account decommission**
- The old Resend Audience (`9ef8f5aa-97f3-4012-b26e-aad3f153cb7f`) contains only test contacts — abandon it, no export needed
- The old API key (`re_hNmZgK...`) should be revoked from the old Resend dashboard after the new credentials are confirmed working
- No email templates to migrate — all templates are inline HTML in code (`subscribers.service.ts`, `notification.service.ts`, `auth.ts`)
- No broadcasts or dashboard-stored content to archive

### Claude's Discretion
- Order of operations for Infisical environment updates (dev → staging → prod, or all at once)
- Whether to include a smoke-test step (send a real test email after credential update) as part of the plan
- How to handle the CI `RESEND_FROM_EMAIL` if the new account's subdomain differs from the current hardcoded value

### Deferred Ideas (OUT OF SCOPE)
- Custom domain verification for `torchsecret.com` on the new Resend account — future phase when ready to launch with branded email sending
- Resend Broadcasts / email marketing campaign setup — future phase after subscriber list grows
</user_constraints>

---

## Summary

Phase 42 is a pure credentials migration — zero code changes. The Resend singleton (`server/src/services/email.ts`) initializes once from `env.RESEND_API_KEY`; Zod validates all three env vars (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_AUDIENCE_ID`) at startup and crashes immediately on missing/empty values. This makes the migration self-verifying: a successful server startup is proof that the new credentials were correctly wired.

The migration touches four surfaces: local `.env`, Infisical dev/staging/prod environments, and the CI `RESEND_FROM_EMAIL` job-level env var. The `docker-compose.yml` passes env vars through from the host (no change needed). The `render.yaml` uses `sync: false` stubs — Render reads values from the Infisical Secret Sync integration, so updating Infisical prod triggers an auto-sync to Render.

The CI `RESEND_FROM_EMAIL` is hardcoded to `"Torch Secret <noreply@torchsecret.com>"` in both `test` and `e2e` jobs. This is safe: all Resend calls in test environments are mocked via `vi.mock('../services/email.js')` in the test files — no real emails are sent during CI runs. The CI value only satisfies the Zod `z.string().min(1)` schema validation; it does not need to match the new Resend account's actual sender address.

**Primary recommendation:** Update the three Resend env vars in Infisical (dev then prod), update local `.env`, revoke the old API key, and verify by restarting the dev server (Zod crash = failure; clean startup = success). CI requires no changes — test mocks bypass actual Resend delivery.

---

## Standard Stack

### Core (no new packages needed)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `resend` | 6.9.2 (already installed) | Resend SDK — `resend.emails.send()`, `resend.contacts.create()` | Already singleton in `email.ts` |
| `@infisical/sdk` / Infisical CLI | v0.43.58 (already configured) | Secret injection at runtime | `infisical run --env=dev --` pattern already established |

No new packages. No build changes. This is entirely an environment variables operation.

### Installation

```bash
# No npm install required — all packages already in place
```

---

## Architecture Patterns

### Where Resend credentials are consumed (full map)

```
RESEND_API_KEY
  └── server/src/services/email.ts          # Singleton: new Resend(env.RESEND_API_KEY)
      └── imported by ALL email senders below

RESEND_FROM_EMAIL
  ├── server/src/auth.ts                    # sendResetPassword + sendVerificationEmail
  ├── server/src/services/subscribers.service.ts  # createSubscriber (confirmation email)
  └── server/src/services/notification.service.ts # sendSecretViewedNotification

RESEND_AUDIENCE_ID
  └── server/src/services/subscribers.service.ts
      ├── confirmSubscriber() → resend.contacts.create({ audienceId })
      └── unsubscribeByToken() → resend.contacts.create({ audienceId, unsubscribed: true })
```

### Pattern: Environment Variable Migration via Infisical CLI

The project uses `infisical secrets set` to update individual secrets per environment. The established pattern from Phase 37.2 and Phase 39:

```bash
# Update one env at a time (dev → staging → prod)
infisical secrets set RESEND_API_KEY="re_newkey..." --env=dev --projectId=f432290a-5b26-49f0-bde8-83825ffddd64
infisical secrets set RESEND_AUDIENCE_ID="new-audience-uuid" --env=dev --projectId=f432290a-5b26-49f0-bde8-83825ffddd64
infisical secrets set RESEND_FROM_EMAIL="onboarding@resend.dev" --env=dev --projectId=f432290a-5b26-49f0-bde8-83825ffddd64

# Verify
infisical secrets get RESEND_API_KEY --env=dev --projectId=f432290a-5b26-49f0-bde8-83825ffddd64
```

**Note:** The Infisical CLI flag is `--projectId` not `--project-slug`. The project ID is `f432290a-5b26-49f0-bde8-83825ffddd64` (from `.infisical.json`). The `projects list` command does not exist in Infisical CLI v0.43.58 — use `--projectId` directly.

### Pattern: Zod Startup Validation as Smoke Test

`server/src/config/env.ts` uses `EnvSchema.parse(process.env)` at import time. All three Resend vars are required (`z.string().min(1)`):

```typescript
RESEND_API_KEY: z.string().min(1),        // line 26
RESEND_FROM_EMAIL: z.string().min(1),     // line 27
RESEND_AUDIENCE_ID: z.string().min(1),    // line 35
```

**Implication for verification:** Running `npm run dev:server` with the new credentials serves as the primary smoke test. A Zod parse error at startup means credentials are missing or empty. A clean startup means all three values are present (but does not confirm they are valid Resend credentials).

### Pattern: Render.com Auto-Sync from Infisical

From Phase 37.2 execution notes: "Render Secret Sync: prod environment → torch-secret Render service; Auto-Sync ON; status 'Synced'". Updating Infisical prod triggers automatic propagation to Render — no manual Render dashboard edits required for the three Resend vars.

### Pattern: CI Test Mocking (why CI RESEND_FROM_EMAIL is safe as-is)

All test files that exercise email paths use `vi.mock`:

```typescript
// server/src/routes/__tests__/subscribers.test.ts (line 15)
// server/src/services/__tests__/notification.service.test.ts (line 13)
// server/src/routes/__tests__/me.test.ts (line 9)
vi.mock('../../services/email.js', () => ({
  resend: {
    emails: { send: vi.fn().mockResolvedValue({ data: { id: 'mock-id' }, error: null }) },
    contacts: { create: vi.fn().mockResolvedValue({ data: { id: 'mock-contact-id' }, error: null }) },
  },
}));
```

The `RESEND_FROM_EMAIL: "Torch Secret <noreply@torchsecret.com>"` CI value only needs to pass `z.string().min(1)` — it never reaches the real Resend API during tests. **No CI yaml change is required.**

### Anti-Patterns to Avoid

- **Do not update `render.yaml`**: It uses `sync: false` stubs. Changing the file does nothing — Render reads from the Infisical integration. Touching `render.yaml` is wasted effort.
- **Do not update `docker-compose.yml`**: It passes env vars through from the host using `${RESEND_API_KEY:-placeholder}` syntax. Updating local `.env` is sufficient for Docker Compose.
- **Do not export/import contacts**: Old Audience has only test contacts. The `marketing_subscribers` DB table is canonical; Resend Audience is best-effort sync. Starting fresh is correct.
- **Do not revoke old API key before confirming new credentials work**: Revocation is a one-way action. Always verify new key first.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Verifying Resend API key is valid | Custom HTTP probe script | Send a real email via the dev server after credential update | Resend SDK throws/returns error on invalid key; functional test is more reliable |
| Tracking which Infisical envs are updated | Spreadsheet / manual notes | Sequential CLI updates with `infisical secrets get` verification after each | CLI is the source of truth; no separate tracker needed |
| Announcing Audience ID to code | Hardcode in source | Keep in Infisical; code reads from `env.RESEND_AUDIENCE_ID` | Already the pattern — do not break it |

---

## Common Pitfalls

### Pitfall 1: Infisical CLI flag confusion (`--project-slug` vs `--projectId`)

**What goes wrong:** Running `infisical secrets set ... --project-slug=torch-secret-28-vs` may not work — Phase 37.2 notes confirm that `--projectId` is the correct flag for Infisical CLI v0.43.58.

**Why it happens:** Infisical docs and the CI action use `project-slug`, but the CLI command-line flag is `--projectId` with the UUID.

**How to avoid:** Always use `--projectId=f432290a-5b26-49f0-bde8-83825ffddd64` in CLI commands. Use `project-slug: "torch-secret-28-vs"` only in the GitHub Actions YAML (Infisical secrets-action uses slug, not ID).

**Warning signs:** CLI returns "project not found" or similar error.

### Pitfall 2: Revoking old API key before smoke test

**What goes wrong:** Old API key is revoked, new key has a typo or wrong value — all email sends silently fail in production (they are fire-and-forget; errors only surface in Pino logs).

**Why it happens:** Migration excitement leads to premature cleanup.

**How to avoid:** Order of operations is strict: (1) add new credentials to all environments, (2) restart/redeploy and verify startup (Zod check), (3) send a real test email to confirm delivery, (4) THEN revoke old API key.

### Pitfall 3: Forgetting to update all three Infisical environments (dev, staging, prod)

**What goes wrong:** Dev works, but staging or prod still has the old (soon-to-be-revoked) API key.

**Why it happens:** dev is tested manually, but staging/prod are easy to forget since they're not used in day-to-day dev.

**How to avoid:** The plan must include explicit steps for all three Infisical environments. Verify each with `infisical secrets get RESEND_API_KEY --env=X --projectId=...` after setting.

### Pitfall 4: Audience ID mismatch between Infisical environments

**What goes wrong:** Using the same new Audience ID for dev/staging/prod but then realizing staging has its own Audience or that the ID was copied wrong.

**Why it happens:** Copy-paste errors; UUID length makes visual verification unreliable.

**How to avoid:** After setting, retrieve the value with `infisical secrets get` and compare character-by-character against the Resend dashboard.

### Pitfall 5: CI `RESEND_FROM_EMAIL` generates confusion

**What goes wrong:** Planner adds unnecessary CI yaml change because `noreply@torchsecret.com` differs from the new Resend subdomain sender.

**Why it happens:** The CI value looks wrong once the actual sender is `onboarding@resend.dev`.

**How to avoid:** CI email sends are fully mocked. The CI `RESEND_FROM_EMAIL` value only satisfies Zod `min(1)` — it is never used to send real email. Leave CI yaml unchanged.

### Pitfall 6: New Audience not created before updating RESEND_AUDIENCE_ID

**What goes wrong:** RESEND_AUDIENCE_ID is set to a UUID that doesn't exist in the new account — `resend.contacts.create()` returns an error that is caught by `.catch()` and logged silently. Subscribers would not be synced to the Audience.

**Why it happens:** The new Audience must be manually created in the Resend dashboard before its ID is available.

**How to avoid:** First step in any plan wave should be: open new Resend dashboard → Audiences → Create Audience → copy ID. Then update Infisical.

---

## Code Examples

### Verified: how Resend singleton is initialized

```typescript
// Source: server/src/services/email.ts (verified 2026-03-02)
import { Resend } from 'resend';
import { env } from '../config/env.js';

export const resend = new Resend(env.RESEND_API_KEY);
// Singleton: swapping RESEND_API_KEY in env only requires restarting the server process.
// No code change needed.
```

### Verified: Audience sync call pattern

```typescript
// Source: server/src/services/subscribers.service.ts lines 156-167 (verified 2026-03-02)
void resend.contacts
  .create({
    email: subscriber.email,
    unsubscribed: false,
    audienceId: env.RESEND_AUDIENCE_ID,  // reads from env — no hardcoding
  })
  .catch((err: unknown) => {
    logger.error(
      { err: err instanceof Error ? err.message : String(err) },
      'resend_contacts_create_failed_on_confirm',
    );
  });
```

### Verified: Infisical CLI update pattern (from Phase 37.2 / 39 notes)

```bash
# Set a secret in a specific Infisical environment
infisical secrets set RESEND_API_KEY="re_newvalue" --env=dev --projectId=f432290a-5b26-49f0-bde8-83825ffddd64

# Verify it was set correctly
infisical secrets get RESEND_API_KEY --env=dev --projectId=f432290a-5b26-49f0-bde8-83825ffddd64

# Start dev server with Infisical-injected env vars (established dev pattern)
infisical run --env=dev -- npm run dev:server
```

---

## Environment Variable Reference

Complete map of what changes, where, and what does NOT change:

| Variable | Local `.env` | Infisical dev | Infisical staging | Infisical prod | CI yaml | docker-compose.yml |
|----------|-------------|--------------|------------------|---------------|---------|-------------------|
| `RESEND_API_KEY` | UPDATE | UPDATE | UPDATE | UPDATE | No change (from Infisical) | No change (passthrough) |
| `RESEND_AUDIENCE_ID` | UPDATE | UPDATE | UPDATE | UPDATE | No change (from Infisical) | No change (passthrough) |
| `RESEND_FROM_EMAIL` | UPDATE if changes | UPDATE if changes | UPDATE if changes | UPDATE if changes | **No change** (mocked in tests) | No change (passthrough) |

**Account-Specific Values (Old → New):**

| Variable | Old Value | New Value |
|----------|-----------|-----------|
| `RESEND_API_KEY` | `re_hNmZgKfp_...` | From new Resend dashboard → API Keys |
| `RESEND_AUDIENCE_ID` | `9ef8f5aa-97f3-4012-b26e-aad3f153cb7f` | Create new Audience in new account → copy UUID |
| `RESEND_FROM_EMAIL` | `onboarding@resend.dev` | New account's Resend subdomain sender (may be same or different) |

---

## Recommended Order of Operations

The planner should structure this as a sequential single-wave migration (no parallelism — each step depends on the previous):

1. **Human action: retrieve new credentials from Resend dashboard**
   - New API key (API Keys section of new account)
   - New Audience ID (create Audience if not already created; Audiences section)
   - New default sender address (Domains/Sender section)

2. **Update local `.env`** — direct replacement of all three vars

3. **Update Infisical dev** — `infisical secrets set` for all three vars; verify with `get`

4. **Update Infisical staging** — same pattern

5. **Update Infisical prod** — same pattern; Render auto-sync will propagate

6. **Smoke test** — restart dev server with `infisical run --env=dev -- npm run dev:server`; confirm clean startup (Zod validation passes)

7. **Optional real email test** — trigger a password reset or subscriber confirmation from dev to verify end-to-end delivery on the new account

8. **Revoke old API key** — from old Resend dashboard, after confirming new credentials work

---

## Validation Architecture

`nyquist_validation: true` in `.planning/config.json` — this section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.x (multi-project) |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run server/src/routes/__tests__/subscribers.test.ts server/src/services/__tests__/notification.service.test.ts` |
| Full suite command | `npx vitest run --coverage` |

### Phase Requirements → Test Map

This phase has no coded requirements (pure config migration). All verification is:

| Check | Behavior | Test Type | How to Verify |
|-------|----------|-----------|--------------|
| Zod startup validation | Server starts without env var errors | smoke | `infisical run --env=dev -- npm run dev:server` — clean start = PASS |
| Resend API key valid | Real email can be sent/received | manual | Trigger password reset in dev; check inbox |
| Audience ID valid | Subscriber confirm adds contact | manual | Complete double opt-in flow in dev; check Resend Audience in dashboard |
| Existing tests still pass | No regressions from env change | unit | `npx vitest run` — all mocked; env vars irrelevant in test mode |

### Sampling Rate

- **Per task commit:** `npx vitest run` (all mocked; confirms no code regressions)
- **Per wave merge:** Same — no code changes means test suite is unchanged
- **Phase gate:** Smoke test (clean server startup with new credentials) + real email delivery verified before closing phase

### Wave 0 Gaps

None — existing test infrastructure covers all phase requirements. No new test files needed; this phase adds no code.

---

## Open Questions

1. **Does the new Resend account use the same `onboarding@resend.dev` sender, or a different subdomain?**
   - What we know: Resend provides a default sending address per account; it may differ from the old account's address
   - What's unclear: Whether the new account's default sender matches the old `onboarding@resend.dev`
   - Recommendation: During the human-action step (retrieve credentials from new dashboard), check Domains/Senders tab in the new Resend account and note the exact sender address. If it differs from `onboarding@resend.dev`, all three environments need `RESEND_FROM_EMAIL` updated.

2. **Should staging get its own Resend Audience ID or share prod's?**
   - What we know: The CONTEXT.md says "create a fresh Audience on the new account" but does not specify one per environment vs. one shared
   - What's unclear: Whether the user wants staging traffic in a separate Audience from prod
   - Recommendation: Use a single Audience for all environments to keep it simple (there are no real subscribers yet). The planner can note this as a future refinement.

---

## Sources

### Primary (HIGH confidence)

- `/Users/ourcomputer/Github-Repos/secureshare/server/src/services/email.ts` — Resend singleton initialization pattern
- `/Users/ourcomputer/Github-Repos/secureshare/server/src/config/env.ts` — Zod validation for all three Resend vars
- `/Users/ourcomputer/Github-Repos/secureshare/.github/workflows/ci.yml` — hardcoded `RESEND_FROM_EMAIL` in both test/e2e jobs; Infisical secrets-action import
- `/Users/ourcomputer/Github-Repos/secureshare/docker-compose.yml` — passthrough env var pattern with `${VAR:-placeholder}` defaults
- `/Users/ourcomputer/Github-Repos/secureshare/.infisical.json` — workspaceId `f432290a-5b26-49f0-bde8-83825ffddd64`
- `/Users/ourcomputer/Github-Repos/secureshare/.planning/STATE.md` — Phase 37.2 and 39 execution notes confirming Infisical CLI patterns
- `/Users/ourcomputer/Github-Repos/secureshare/server/src/services/subscribers.service.ts` — full Resend Audience usage (confirmSubscriber, unsubscribeByToken)
- `/Users/ourcomputer/Github-Repos/secureshare/server/src/auth.ts` — `sendResetPassword` + `sendVerificationEmail` using `env.RESEND_FROM_EMAIL`
- `/Users/ourcomputer/Github-Repos/secureshare/42-CONTEXT.md` — locked decisions from user

### Secondary (MEDIUM confidence)

- Phase 37.2 STATE.md execution notes — Infisical CLI `--projectId` flag requirement, `gh secret set` patterns, Render auto-sync behavior

### Tertiary (LOW confidence)

- None

---

## Metadata

**Confidence breakdown:**
- Environment variable surface area: HIGH — all files read directly; no inference
- Infisical CLI patterns: HIGH — established in Phase 37.2 / 39 and documented in STATE.md
- CI behavior (mocked emails): HIGH — test mock pattern verified in subscribers.test.ts, notification.service.test.ts
- Render auto-sync behavior: MEDIUM — from STATE.md notes; not re-verified against Render dashboard

**Research date:** 2026-03-02
**Valid until:** 2026-04-02 (stable domain — Resend SDK and Infisical patterns unlikely to change)

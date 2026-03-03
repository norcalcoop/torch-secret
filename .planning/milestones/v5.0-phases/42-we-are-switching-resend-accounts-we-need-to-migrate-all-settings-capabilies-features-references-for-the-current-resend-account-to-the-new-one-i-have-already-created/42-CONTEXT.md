# Phase 42: Resend Account Migration - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Migrate all Resend account credentials, configuration, and references from the current (old) Resend account to the new Resend account that has already been created. This is a pure credentials/configuration migration — no code changes are required. The scope ends at working transactional emails and Audience sync on the new account across all environments.

</domain>

<decisions>
## Implementation Decisions

### Audience / subscriber data
- No real marketing subscribers exist yet — only test accounts on the old Resend Audience
- Do NOT export or import contacts from the old Audience
- Create a fresh Audience on the new Resend account and obtain the new `RESEND_AUDIENCE_ID`
- The local `marketing_subscribers` DB table is the canonical source of truth; the Resend Audience is a best-effort sync target

### From email address
- Staying with the Resend subdomain for now (e.g., `onboarding@resend.dev` or equivalent on the new account)
- `RESEND_FROM_EMAIL` should reflect the new account's default sending address
- No custom domain verification required at this stage

### Environment credential rollout
- All three of these values need updating: `RESEND_API_KEY`, `RESEND_AUDIENCE_ID`, `RESEND_FROM_EMAIL` (if it changes)
- Environments to update:
  1. Local `.env` — direct value replacement
  2. Infisical `dev` environment (project slug: `torch-secret-28-vs`)
  3. Infisical `staging` environment
  4. Infisical `prod` environment
- `docker-compose.yml` passes through env vars from host — no change needed there
- `render.yaml` uses `sync: false` — no change needed in the file; Render dashboard values come from Infisical

### CI/CD credential handling
- `.github/workflows/ci.yml` hardcodes `RESEND_FROM_EMAIL: "Torch Secret <noreply@torchsecret.com>"` for test runs
- This domain has NOT been verified on the new account (staying with Resend subdomain)
- Planner should assess whether this CI value needs updating or whether CI email sends are mocked/no-op in test env

### Old account decommission
- The old Resend Audience (`9ef8f5aa-97f3-4012-b26e-aad3f153cb7f`) contains only test contacts — abandon it, no export needed
- The old API key (`re_hNmZgK...`) should be revoked from the old Resend dashboard after the new credentials are confirmed working
- No email templates to migrate — all templates are inline HTML in code (`subscribers.service.ts`, `notification.service.ts`, `auth.ts`)
- No broadcasts or dashboard-stored content to archive

### Claude's Discretion
- Order of operations for Infisical environment updates (dev → staging → prod, or all at once)
- Whether to include a smoke-test step (send a real test email after credential update) as part of the plan
- How to handle the CI `RESEND_FROM_EMAIL` if the new account's subdomain differs from the current hardcoded value

</decisions>

<specifics>
## Specific Ideas

- The new Resend account has already been created by the user — planner should include a step to retrieve the new API key and create a new Audience from the new account's dashboard
- The migration is entirely environment variable work: no files in `server/src/services/` or `server/src/config/` need touching
- Infisical CLI injects secrets at runtime — once Infisical is updated, a redeploy/restart picks up new credentials automatically

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `server/src/services/email.ts`: Singleton `resend` client — initialized once from `env.RESEND_API_KEY`. Swapping the key only requires updating the env var; no code change.
- `server/src/config/env.ts`: Zod validates `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_AUDIENCE_ID` at startup — missing or empty values cause an immediate crash (good: confirms new credentials are wired correctly on startup)

### Established Patterns
- Infisical project slug: `torch-secret-28-vs` — used in `.github/workflows/ci.yml` and `.infisical.json` (workspaceId: `f432290a-5b26-49f0-bde8-83825ffddd64`)
- CI imports secrets via `Infisical/secrets-action@v1.0.9` with `env-slug: "dev"` for the test job
- `render.yaml` uses `sync: false` for all three Resend vars — they must be set manually in the Render dashboard (or via Infisical render integration if configured)
- `docker-compose.yml` uses `${RESEND_API_KEY:-placeholder-not-sent-in-docker-local-dev}` fallbacks — no change needed there

### Integration Points
- `subscribers.service.ts` calls `resend.contacts.create()` with `audienceId: env.RESEND_AUDIENCE_ID` in two places (subscriber confirm + unsubscribe) — both fire-and-forget with `.catch()` logging
- `auth.ts` sends password reset and email verification emails via `resend.emails.send()` with `from: env.RESEND_FROM_EMAIL`
- `notification.service.ts` sends secret-viewed notifications via `resend.emails.send()` with `from: env.RESEND_FROM_EMAIL`

### Account-Specific Values (Old → New)
| Variable | Old Value (current .env) | New Value |
|----------|--------------------------|-----------|
| `RESEND_API_KEY` | `re_hNmZgKfp_...` | From new Resend dashboard |
| `RESEND_AUDIENCE_ID` | `9ef8f5aa-97f3-4012-b26e-aad3f153cb7f` | From new Resend dashboard (create new Audience) |
| `RESEND_FROM_EMAIL` | `onboarding@resend.dev` | New account's Resend subdomain address |

</code_context>

<deferred>
## Deferred Ideas

- Custom domain verification for `torchsecret.com` on the new Resend account — future phase when ready to launch with branded email sending
- Resend Broadcasts / email marketing campaign setup — future phase after subscriber list grows

</deferred>

---

*Phase: 42-resend-account-migration*
*Context gathered: 2026-03-02*

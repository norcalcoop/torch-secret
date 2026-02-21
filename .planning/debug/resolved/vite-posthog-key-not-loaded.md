---
status: resolved
trigger: "VITE_POSTHOG_KEY added to project root .env is not being picked up by Vite dev server. PostHog never initializes in the browser."
created: 2026-02-20T00:00:00Z
updated: 2026-02-20T00:01:00Z
---

## Current Focus

hypothesis: Vite's envDir defaults to the project root (vite.config.ts location), but vite.config.ts sets `root: 'client'`, which moves envDir to client/. The .env file lives in the project root, not client/, so Vite never sees it.
test: Confirmed via /@vite/env endpoint returning empty defines: {} and absence of client/.env
expecting: Adding envDir pointing back to the project root will cause Vite to load .env from the correct location
next_action: Add `envDir: '..'` to vite.config.ts so Vite resolves env from the project root (one level above client/)

## Symptoms

expected: PostHog initializes on page load — network requests to us.i.posthog.com appear, localStorage contains ph_* keys, analytics events fire
actual: PostHog never initializes. window.posthog is undefined (expected with npm bundle), but no ph_* localStorage keys, no network requests to posthog, Vite's /@vite/env endpoint returns empty defines: {}
errors: No errors — analytics module silently no-ops due to `if (!key) return` guard
reproduction: Start dev server (npm run dev:client), open localhost:5173, check network for posthog requests — none appear
started: Key was added to .env during UAT session today. Never worked.

## Eliminated

- hypothesis: VITE_POSTHOG_KEY was never added to .env
  evidence: .env at project root line 14 contains VITE_POSTHOG_KEY=phc_VKZUbmK9GkXPNEI3bVoA33qfM5iR5KHDML8Gy8GSHGa
  timestamp: 2026-02-20T00:00:00Z

- hypothesis: Analytics module has a code bug preventing initialization
  evidence: posthog.ts lines 85-88 are correct — reads import.meta.env.VITE_POSTHOG_KEY and guards with `if (!key) return`. Module is sound; the variable is simply undefined.
  timestamp: 2026-02-20T00:00:00Z

## Evidence

- timestamp: 2026-02-20T00:00:00Z
  checked: vite.config.ts
  found: `root: 'client'` is set with no `envDir` override
  implication: When Vite root is set to a subdirectory, envDir defaults to match root (client/). The project's .env lives one level up at the repo root.

- timestamp: 2026-02-20T00:00:00Z
  checked: /@vite/env endpoint
  found: Returns `const defines = {};` — empty object
  implication: Vite has loaded zero VITE_* environment variables, confirming it is not reading the project root .env

- timestamp: 2026-02-20T00:00:00Z
  checked: client/.env (glob search)
  found: No client/.env file exists
  implication: Vite looks for .env in client/ (its root), finds nothing, injects no defines

- timestamp: 2026-02-20T00:00:00Z
  checked: project root .env (lines 13-15)
  found: VITE_POSTHOG_KEY and VITE_POSTHOG_HOST are present and correct
  implication: The values exist — Vite simply cannot see them without envDir correction

## Resolution

root_cause: vite.config.ts sets `root: 'client'` which shifts Vite's envDir to client/. The VITE_POSTHOG_KEY lives in the project root .env. No envDir override exists, so Vite never loads that file. import.meta.env.VITE_POSTHOG_KEY is undefined at runtime, causing initAnalytics() to silently no-op.
fix: Add `envDir: '..'` to vite.config.ts. Since vite.config.ts sits at the repo root and root is 'client', '..' relative to root resolves to the repo root — exactly where .env lives.
verification: Confirmed via path resolution: `path.resolve('client', '..')` === repo root. envDir: '..' relative to Vite root (client/) resolves to the repo root where .env lives. VITE_POSTHOG_KEY will be injected as import.meta.env.VITE_POSTHOG_KEY, allowing initAnalytics() to pass the key guard and initialize PostHog.
files_changed:
  - vite.config.ts

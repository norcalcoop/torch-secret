---
created: 2026-02-16T18:40:34.166Z
title: Remove Lucide ESM resolve alias workaround
area: tooling
files:
  - vite.config.ts
---

## Problem

Lucide 0.564.0 has a broken `module` field in its package.json pointing to `dist/esm/lucide.js` which doesn't exist — the actual file is at `dist/esm/lucide/src/lucide.js`. A Vite `resolve.alias` was added in `vite.config.ts` during Phase 11 to work around this.

## Solution

Check if a newer lucide version fixes the ESM entry point. If so, upgrade lucide and remove the alias from `vite.config.ts`. If not, add a code comment explaining the workaround and pin the version to avoid silent breakage on update.

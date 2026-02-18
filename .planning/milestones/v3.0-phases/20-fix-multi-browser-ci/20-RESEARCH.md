# Phase 20: Fix Multi-Browser CI - Research

**Researched:** 2026-02-18
**Domain:** GitHub Actions CI configuration, Playwright browser installation
**Confidence:** HIGH

## Summary

This phase is a surgical, two-part fix. The core work is three line changes in `.github/workflows/ci.yml`: drop the `chromium` argument from `playwright install --with-deps`, drop it from `playwright install-deps`, and remove `--project=chromium` from the test run command. The second part is ticking the 10 documentation-artifact checkboxes (QUAL-01..05 and DOCK-01..05) in `REQUIREMENTS.md` that are already satisfied but whose checkboxes were never updated.

The phase is well-scoped with no ambiguity. The Playwright config already defines all three browser projects. The fix needed is purely in the CI YAML and the requirements doc. There is one important nuance: caching strategy. The existing cache is keyed by `package-lock.json` hash and applies to all Playwright browsers. Expanding to all browsers means the cache path `~/.cache/ms-playwright` grows to include Firefox and WebKit binaries. This is fine as-is — the cache key does not need to change because Playwright's version in `package-lock.json` determines which browser binaries are valid.

One secondary consideration: the phase description states success criterion 3 (QUAL-01..05 and DOCK-01..05 checkboxes) is already met in the current file. This was confirmed by reading `.planning/REQUIREMENTS.md` — all 10 checkboxes are already `[x]`. This removes any documentation work from the phase scope.

**Primary recommendation:** Make three targeted changes to `.github/workflows/ci.yml` e2e job: (1) `npx playwright install --with-deps` (no browser arg), (2) `npx playwright install-deps` (no browser arg), (3) `npx playwright test --config e2e/playwright.config.ts` (no `--project` arg).

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@playwright/test` | `^1.58.2` (installed) | E2E test runner with multi-browser support | Already in project, already configured |
| `actions/cache@v4` | v4 | Cache Playwright browser binaries between runs | Already in ci.yml |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| GitHub Actions `ubuntu-latest` | — | CI runner OS | All three Playwright browsers support Ubuntu |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `npx playwright install --with-deps` | `mcr.microsoft.com/playwright` Docker container image | Container has browsers pre-baked, faster first run; more complex CI setup — not needed here |
| Removing cache step | Keeping cache | Playwright docs say caching is not recommended because restore time ≈ download time; but the existing cache step is already in place and works — leave it as-is |

**Installation:** No new packages needed. Playwright 1.58.2 is already installed.

## Architecture Patterns

### Recommended Project Structure

No structural changes. The fix is entirely within:

```
.github/
└── workflows/
    └── ci.yml          # e2e job: 3 line changes
```

### Pattern 1: Install All Browsers with System Dependencies

**What:** `npx playwright install --with-deps` with no browser argument installs Chromium, Firefox, and WebKit plus all OS-level system dependencies required for each.

**When to use:** Always in CI when you need cross-browser coverage. The `--with-deps` flag handles `libgtk`, `libgbm`, WebKit GTK packages, etc. automatically.

**Example:**
```yaml
# Source: https://playwright.dev/docs/ci
- name: Install Playwright Browsers
  run: npx playwright install --with-deps
```

### Pattern 2: Install System Deps Only (Cache Hit Branch)

**What:** When the browser binaries are restored from cache, you still need to install OS-level dependencies (they are not cacheable). `npx playwright install-deps` with no browser argument installs system deps for all browsers.

**When to use:** The `if: cache-hit == 'true'` branch of the existing conditional pattern in the project's CI.

**Example:**
```yaml
# Source: https://playwright.dev/docs/ci
- name: Install Playwright system deps
  if: steps.playwright-cache.outputs.cache-hit == 'true'
  run: npx playwright install-deps
```

### Pattern 3: Run All Browser Projects (No --project Filter)

**What:** `npx playwright test --config e2e/playwright.config.ts` with no `--project` flag runs all projects defined in `playwright.config.ts`. Since the config defines `chromium`, `firefox`, and `webkit`, all three run.

**When to use:** When cross-browser coverage is required. Omitting `--project` is the correct way to run all configured browsers.

**Example:**
```yaml
- name: Run E2E tests
  run: npx playwright test --config e2e/playwright.config.ts
```

### Anti-Patterns to Avoid

- **Specifying individual browsers in `install`:** `npx playwright install chromium firefox webkit --with-deps` is verbose but equivalent to `--with-deps` with no args. No browser arg is simpler and less error-prone when adding/removing browsers.
- **Removing the cache step entirely:** Playwright docs say caching isn't recommended because restore ≈ download time, but removing an existing working cache step is unnecessary churn. Leave it.
- **Adding a `timeout-minutes` to the e2e job:** Three browsers will take longer than one. The current ci.yml has no job-level timeout. GitHub Actions default is 6 hours — sufficient for this test suite. Do not add unless tests time out.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-browser matrix | `strategy: matrix: browser: [chromium, firefox, webkit]` separate jobs | Remove `--project` filter from single job | The existing `playwright.config.ts` projects array already handles the matrix within one Playwright run; a GHA matrix would create 3 separate jobs with redundant server startup overhead |
| Dependency installation | Manual `apt-get install` for each browser's system deps | `playwright install --with-deps` | Playwright's CLI knows the exact packages each browser version needs; manual lists go stale |

**Key insight:** The Playwright config is already the source of truth for which browsers to run. CI should defer to the config, not duplicate or override it.

## Common Pitfalls

### Pitfall 1: Cache Key Mismatch After Browser Expansion

**What goes wrong:** If the cache key includes a browser-specific hash or string literal like `playwright-chromium-${{ hashFiles('package-lock.json') }}`, adding more browsers will still only cache/restore Chromium.

**Why it happens:** The existing ci.yml cache key is `playwright-${{ runner.os }}-${{ hashFiles('package-lock.json') }}` — no browser name in the key. Expanding to all browsers does NOT require a cache key change. The key already covers all browsers because it hashes the entire `package-lock.json` (which pins `@playwright/test` version). A new `@playwright/test` version produces a new cache key, triggering a fresh download.

**How to avoid:** Do not change the cache key. It is already correct for multi-browser use.

**Warning signs:** If you see "Cache Miss" on every run after the change, check that the cache `path` (`~/.cache/ms-playwright`) still matches where Playwright stores all browsers.

### Pitfall 2: Install-Deps on Cache Hit Misses Firefox/WebKit

**What goes wrong:** If the cache-hit branch runs `npx playwright install-deps chromium` (with browser arg) but the binaries now include Firefox and WebKit, the system deps for Firefox and WebKit will NOT be installed, causing browser launch failures.

**Why it happens:** The chromium-specific `install-deps` command only installs Chromium's system dependencies.

**How to avoid:** Change `npx playwright install-deps chromium` → `npx playwright install-deps` (no arg). This installs system deps for all installed browsers.

**Warning signs:** `Error: browserType.launch: Executable doesn't exist` or `Host system is missing dependencies to run browsers` in CI logs for Firefox or WebKit only.

### Pitfall 3: Existing Tests Rely on Chromium-Only Behavior

**What goes wrong:** Tests pass on Chromium but fail on Firefox or WebKit due to browser-specific behavior — e.g., clipboard API access, dialog handling, CSS rendering differences.

**Why it happens:** All E2E tests were developed and verified in Chromium only (CI never ran Firefox/WebKit).

**How to avoid:** Run `npm run test:e2e` locally (or in a branch) with all three browsers before merging. The `playwright.config.ts` already defines all three projects, so local runs test all three. The E2E specs use the Web Crypto API (AES-256-GCM via `crypto.subtle`), which is supported in all three browsers. The primary risk areas are: clipboard access (`navigator.clipboard`), `bypassCSP: true` (already set in config), and any `page.evaluate()` calls using browser-specific APIs.

**Warning signs:** Firefox or WebKit-specific test failures in the first CI run after the change.

### Pitfall 4: CI Time Budget

**What goes wrong:** Running 3× the browsers triples E2E test time, which may push total CI duration beyond acceptable limits.

**Why it happens:** The existing CI runs 13 tests × 1 browser. Expanding to 3 browsers = 39 test runs. Tests run serially (`workers: 1`, `fullyParallel: false`), so time is approximately 3×.

**How to avoid:** Accept the time increase — serial E2E tests with real browser startup are the correct approach for this security-sensitive app. No action needed unless wall-clock time causes a specific problem.

**Warning signs:** If CI consistently times out (GitHub default: 6 hours), reduce test parallelism or increase `timeout-minutes` on the e2e job.

## Code Examples

Verified patterns from official sources:

### Complete e2e Job Browser Install Steps (All Browsers)

```yaml
# Source: https://playwright.dev/docs/ci
- name: Cache Playwright browsers
  id: playwright-cache
  uses: actions/cache@v4
  with:
    path: ~/.cache/ms-playwright
    key: playwright-${{ runner.os }}-${{ hashFiles('package-lock.json') }}

- name: Install Playwright browsers
  if: steps.playwright-cache.outputs.cache-hit != 'true'
  run: npx playwright install --with-deps

- name: Install Playwright system deps
  if: steps.playwright-cache.outputs.cache-hit == 'true'
  run: npx playwright install-deps

- name: Run E2E tests
  run: npx playwright test --config e2e/playwright.config.ts
```

### Exact Diff for ci.yml

Three lines change. Current → Fixed:

```diff
-        run: npx playwright install --with-deps chromium
+        run: npx playwright install --with-deps

-        run: npx playwright install-deps chromium
+        run: npx playwright install-deps

-        run: npx playwright test --config e2e/playwright.config.ts --project=chromium
+        run: npx playwright test --config e2e/playwright.config.ts
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `npx playwright install` (no `--with-deps`) required separate `install-deps` call | `--with-deps` flag handles both in one command | Playwright v1.20+ | Simplifies CI setup |
| Manual `apt-get install` for system deps | `playwright install-deps` / `--with-deps` | Playwright CLI maturity | Eliminates brittle manual dep lists |
| Caching recommended | Caching not recommended per official docs | ~2023-2024 | The time to restore cache ≈ time to download; simplify by skipping cache entirely (but the existing cache in this project works, so leave it) |

**Deprecated/outdated:**
- `playwright install-deps chromium` (browser-specific): Still valid but overly restrictive when expanding to all browsers — use without browser argument.
- `--project=chromium` CLI filter when config already defines all projects: Redundant override that defeats the purpose of having a multi-browser config.

## Open Questions

1. **Will existing E2E tests pass on Firefox and WebKit?**
   - What we know: Tests were written and verified locally (Phase 17). The Playwright config has all three browsers defined, implying local multi-browser runs were intended. The `bypassCSP: true` option is already set (handles CSP differences). The Web Crypto API is universally supported.
   - What's unclear: Whether any specific test uses a clipboard or dialog API that behaves differently across browsers. The test specs use `createTestSecret` fixtures (API calls), not clipboard operations.
   - Recommendation: Make the CI change and let CI validate. If a browser-specific failure occurs, fix the test; it's a legitimate cross-browser bug to surface.

2. **Should the cache step be removed (per official recommendation)?**
   - What we know: Official Playwright docs say caching is not recommended because restore time ≈ download time.
   - What's unclear: Whether removing it would noticeably affect CI speed in practice for this project.
   - Recommendation: Leave the cache step in place. It was deliberately added in Phase 18 and works. Removing it is out of scope for this phase and creates unnecessary diff.

## Sources

### Primary (HIGH confidence)

- `/microsoft/playwright.dev` (Context7) — install --with-deps, install-deps, --project flag, GitHub Actions YAML patterns
- https://playwright.dev/docs/ci — Official CI integration docs; confirmed `npx playwright install --with-deps` as standard; confirmed caching not recommended
- Direct code inspection: `/Users/ourcomputer/Github-Repos/secureshare/.github/workflows/ci.yml` (lines 137, 141, 147) — exact lines to change
- Direct code inspection: `/Users/ourcomputer/Github-Repos/secureshare/e2e/playwright.config.ts` — confirms 3 browser projects already defined
- Direct code inspection: `/Users/ourcomputer/Github-Repos/secureshare/.planning/REQUIREMENTS.md` — confirms QUAL-01..05 and DOCK-01..05 checkboxes already marked `[x]`

### Secondary (MEDIUM confidence)

- https://playwright.dev/docs/browsers — browser-specific behavior notes
- `.planning/v3.0-MILESTONE-AUDIT.md` — audit evidence identifying exact lines to fix; fix already documented at lines 157-165

### Tertiary (LOW confidence)

- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Playwright 1.58.2 already installed; GitHub Actions patterns verified via Context7 and official docs
- Architecture: HIGH — Three-line diff is verified against existing config; no structural changes
- Pitfalls: HIGH (cache key, install-deps) / MEDIUM (cross-browser test compatibility) — cache and install behavior verified via official docs; cross-browser compatibility is an empirical question

**Research date:** 2026-02-18
**Valid until:** 2026-08-18 (stable — GitHub Actions patterns and Playwright install CLI are mature)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TEST-06 | Playwright runs across Chromium, Firefox, and WebKit in CI | Three targeted changes to `.github/workflows/ci.yml` e2e job: remove `chromium` from install step, remove `chromium` from install-deps step, remove `--project=chromium` from test run. No new packages. No config changes. Verified via official Playwright docs and direct file inspection. |
</phase_requirements>

# Phase 18: CI/CD Pipeline - Context

**Gathered:** 2026-02-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Automated GitHub Actions workflow that validates every push/PR (lint, test, build, E2E) and auto-deploys merges to main to Render.com. No new application features, no branch protection rules.

</domain>

<decisions>
## Implementation Decisions

### E2E browser scope in CI
- Chromium only in CI (not all three browsers)
- Local Playwright config still tests all three — CI trades coverage for speed

### Caching
- Cache both node_modules (keyed on package-lock.json hash) and Playwright browser binaries between CI runs
- Significant time savings on repeat runs

### CI badge
- Add GitHub Actions CI status badge to README
- Standard "build passing/failing" badge for open source visibility

### Coverage reporting
- Generate code coverage reports for visibility
- Do NOT gate CI on coverage thresholds — tests pass/fail is the gate
- Coverage is informational only

### Branch protection
- No branch protection rules on main
- Single contributor workflow — keep it simple

### Claude's Discretion
- **Workflow structure:** Single vs multi-workflow, job ordering, parallelism, fail-fast strategy (success criteria #2 says lint failure should fail fast)
- **CI triggers:** Push/PR trigger strategy
- **Node version matrix:** Single vs multi-version testing
- **E2E service setup:** GitHub Actions service containers vs Docker Compose for PostgreSQL + Redis
- **E2E test target:** Dev server vs production Docker image
- **Playwright sharding:** Single runner vs sharded (test suite is small)
- **Failure artifacts:** Whether to upload Playwright traces/screenshots on failure
- **Deploy trigger:** Render deploy hook vs native GitHub integration
- **Deploy verification:** Fire-and-forget vs post-deploy health check
- **PR feedback:** Standard checks vs summary comments

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. User deferred nearly all implementation details to Claude's judgment, with the exception of Chromium-only E2E in CI, caching both deps and browsers, adding a CI badge, coverage without gating, and no branch protection.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 18-ci-cd-pipeline*
*Context gathered: 2026-02-17*

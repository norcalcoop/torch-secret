# Phase 63: Nyquist Compliance — Phase 57 & 58.6 - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Update the VALIDATION.md files for Phase 57 (Security Test Suite — Race Conditions & ZK Invariant) and Phase 58.6 (Fix SSR Navigation & Visual Consistency) to mark them fully Nyquist-compliant. Both phases are complete and their Wave 0 test files exist on disk — the VALIDATION.md files were simply never signed off after execution.

</domain>

<decisions>
## Implementation Decisions

### Test run scope
- Run the per-phase test commands before flipping compliance flags — do not trust completed status alone
- Phase 57: run `npx vitest run server/src/routes/__tests__/secrets.test.ts server/src/routes/__tests__/zk-invariant.test.ts`
- Phase 58.6: run `npx vitest run server/src/routes/seo/templates/layout.test.ts`
- Sign-off is evidence-based (confirmed green), not assumption-based

### VALIDATION.md update depth
- Full clean-up for both files — not minimum viable
- Update frontmatter (`nyquist_compliant: true`, `wave_0_complete: true`)
- Check off all sign-off checklist items
- Update Per-Task Verification Map status column from `⬜ pending` to `✅ green` for all tasks
- Set `status: approved` and `Approval: approved` at the bottom of each file

### Phase 58.6 manual-only verifications
- Mark as accepted risk — visual parity was established during Phase 58.6 execution
- Add a note in the VALIDATION.md that the manual checks are accepted as verified via agent execution during Phase 58.6 — no separate human re-check required
- Do NOT defer to Phase 64 (Phase 64 already has its own full manual verification checklist)

</decisions>

<specifics>
## Specific Ideas

- The auditor should read each VALIDATION.md, confirm the test commands run green, then do a targeted in-place edit to flip flags, check boxes, and update status cells — not rewrite the whole file
- "Accepted risk" note for 58.6 manual checks should be brief and placed in the Manual-Only Verifications section

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `server/src/routes/__tests__/secrets.test.ts` — existing file extended by Phase 57 with concurrent race tests (TEST-03)
- `server/src/routes/__tests__/zk-invariant.test.ts` — new file created by Phase 57 for ZK invariant DB schema tests (TEST-04)
- `server/src/routes/seo/templates/layout.test.ts` — new file created by Phase 58.6 for token parity, theme dropdown, and font preload tests

### Established Patterns
- Vitest multi-project config: server tests run with `npx vitest run` targeting specific files; full suite via `npm run test:run`
- VALIDATION.md format: YAML frontmatter → Test Infrastructure table → Sampling Rate → Per-Task Verification Map → Wave 0 Requirements → Manual-Only Verifications → Validation Sign-Off

### Integration Points
- Both VALIDATION.md files live in their respective phase directories under `.planning/phases/`
- No code changes required — this is documentation-only

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 63-nyquist-compliance-phase-57-58-6*
*Context gathered: 2026-03-09*

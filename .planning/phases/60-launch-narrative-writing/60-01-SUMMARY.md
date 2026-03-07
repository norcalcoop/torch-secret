---
phase: 60-launch-narrative-writing
plan: 01
subsystem: docs
tags: [launch, show-hn, screencast, technical-writeup, zero-knowledge, aes-256-gcm, rfc-3986]

# Dependency graph
requires:
  - phase: 59-repo-hygiene-documentation
    provides: clean README and public repo state required before launch narrative references the repo
provides:
  - "60-DEMO-SCRIPT.md — 8-shot screencast shot list with timing, captions, and destroy-moment ZK caption"
  - "60-TECHNICAL-WRITEUP.md — 2,060-word threat-model-first writeup with 6 real code excerpts and Limitations section"
  - "60-SHOW-HN-POST.md — Show HN title + ~490-word submitter comment covering RFC 3986, AES-256-GCM, atomic destroy, PADME, and honest limitations"
affects: [61-launch-distribution-assets]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Threat-model-first structure: open with what an attacker gets, then show how the architecture answers it"
    - "Honest limitations section: pre-answer obvious objections (device compromise, extensions, JS trust model) rather than footnoting them"
    - "RFC 3986 §3.5 as the primary framing device for the URL fragment security boundary"

key-files:
  created:
    - .planning/phases/60-launch-narrative-writing/60-DEMO-SCRIPT.md
    - .planning/phases/60-launch-narrative-writing/60-TECHNICAL-WRITEUP.md
    - .planning/phases/60-launch-narrative-writing/60-SHOW-HN-POST.md
  modified: []

key-decisions:
  - "Demo secret locked to OPENAI_API_KEY=sk-proj-... format — sk-proj- prefix is current OpenAI format and immediately recognizable to HN/PH audiences"
  - "Show HN title leads with RFC 3986 §3.5 citation — verifiable technical claim that rewards curiosity without marketing language"
  - "Limitations named as a dedicated section in both technical writeup and submitter comment — not a footnote; pre-announces device compromise, extensions, ciphertext length visibility, JS trust model"
  - "Submitter comment targets ~490 words (within 300–500 word range per plan); PADME paragraph identified as the trim candidate if word count is tight"
  - "Technical writeup uses ISC license (corrected from MIT in d99c717 during Task 2)"

patterns-established:
  - "Launch narrative pattern: demo script (narrative) → technical writeup (depth) → Show HN post (distilled claim). Each artifact feeds the next."

requirements-completed: [LAUNCH-01, LAUNCH-02, LAUNCH-03]

# Metrics
duration: 35min
completed: 2026-03-07
---

# Phase 60 Plan 01: Launch Narrative Writing Summary

**Three publication-ready launch artifacts: demo screencast shot list (8 shots, 42s), threat-model-first technical writeup with 6 real code excerpts (~2,060 words), and Show HN post with RFC 3986-anchored title and ~490-word submitter comment**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-03-07T12:26:57Z
- **Completed:** 2026-03-07T12:55:00Z
- **Tasks:** 3 (Tasks 1 and 2 were completed in a prior session; Task 3 completed in this session)
- **Files created:** 3

## Accomplishments

- Demo script: 8 shots covering all 5 required flow beats (paste → create → share with URL fragment visible → reveal → destroy), total 42 seconds within the 30–60s target; destroy moment caption lands the ZK property without jargon ("The server held only encrypted bytes. Now those bytes are gone. It never had the key.")
- Technical writeup: threat-model-first structure (opens with "What can a malicious server operator do?"), 6 verbatim code excerpts from codebase (generateKey, importKey, encrypt with IV, padmeLength, retrieveAndDestroy transaction, FOR UPDATE lock), Limitations section names all four: device compromise, malicious extensions, ciphertext length visibility, JS trust model
- Show HN post: title under 110 characters leading with RFC 3986 §3.5; submitter comment covers URL fragment mechanic, AES-256-GCM, atomic destroy with WAL remanence rationale, FOR UPDATE concurrent-request attack, PADME padding; Notes for Submitter covers timing, flagging, social coordination

## Task Commits

Each task was committed atomically:

1. **Task 1: Write demo screencast shot list (LAUNCH-01)** - `b4f9a13` (feat)
2. **Task 2: Write technical architecture writeup (LAUNCH-03)** - `0dea2b3` (feat), `d99c717` (fix: ISC license)
3. **Task 3: Write Show HN post with submitter comment (LAUNCH-02)** - `fcc1ce8` (feat)

## Files Created

- `.planning/phases/60-launch-narrative-writing/60-DEMO-SCRIPT.md` — 8-shot silent screencast shot list with duration estimates (42s total), post-production notes (JetBrains Mono, lower-third captions, brand-orange URL bar highlight), and verification checklist
- `.planning/phases/60-launch-narrative-writing/60-TECHNICAL-WRITEUP.md` — ~2,060-word writeup with 6 fenced code excerpts, 9 sections (threat → URL fragment → encryption → PADME → atomic destroy → FOR UPDATE → limitations → open source → CTA)
- `.planning/phases/60-launch-narrative-writing/60-SHOW-HN-POST.md` — Show HN title, submission URL, ~490-word submitter comment (7 paragraphs), Notes for Submitter section

## Decisions Made

- Demo secret is `OPENAI_API_KEY=sk-proj-AbCdEfGh1234567890xxxxxxxxxxxxxxxxxxxxxxxx` — `sk-proj-` prefix is current OpenAI format, x-fill makes it obviously fake
- Technical writeup license corrected to ISC (not MIT) in a separate fix commit (d99c717)
- Show HN title preserves plan's recommended wording verbatim — wording was already optimally tuned per the research
- Submitter comment word count targeted ~490 words; PADME paragraph is the named trim candidate for editors who find it over the limit

## Deviations from Plan

None — plan executed exactly as written. The license correction in Task 2 (MIT → ISC) was a factual accuracy fix on an artifact that hadn't yet been committed as final, not a deviation from plan scope.

## Issues Encountered

- `.planning/` directory is listed in `.gitignore` but existing planning files ARE tracked (they were force-added in earlier phases). New files require `git add -f` to stage. Used `git add -f` for all three artifacts — consistent with how Tasks 1 and 2 were committed.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All three LAUNCH-01, LAUNCH-02, LAUNCH-03 artifacts are complete and committed
- Phase 61 (Launch Distribution Assets) can consume these files directly: the Show HN post is ready to copy-paste, the technical writeup has cross-post targets listed (HN, dev.to, Medium, GitHub wiki), the demo script is ready for a screen recorder
- No blockers

---
*Phase: 60-launch-narrative-writing*
*Completed: 2026-03-07*

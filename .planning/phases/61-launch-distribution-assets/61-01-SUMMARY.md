---
phase: 61-launch-distribution-assets
plan: "01"
subsystem: launch-content
tags: [reddit, launch, content, distribution]
dependency_graph:
  requires: [60-01]
  provides: [LAUNCH-04]
  affects: []
tech_stack:
  added: []
  patterns: [channel-specific-content, reddit-markdown]
key_files:
  created:
    - .planning/phases/61-launch-distribution-assets/61-REDDIT-NETSEC.md
    - .planning/phases/61-launch-distribution-assets/61-REDDIT-SELFHOSTED.md
    - .planning/phases/61-launch-distribution-assets/61-REDDIT-DEVOPS.md
  modified: []
decisions:
  - "r/netsec title leads with RFC 3986 §3.5 citation and URL fragment mechanic — same verifiable technical claim as Show HN title, adapted to Reddit prose"
  - "r/netsec limitations section is a first-class body section (named heading), not a footnote — device compromise, extensions, JS trust model all named"
  - "r/selfhosted title leads with docker-compose not the product name — self-hoster audience is skeptical of SaaS openers"
  - "r/devops opens with a concrete alternatives comparison list (Slack DM, email, 1Password vault) to crystallize the pain point before naming the product"
  - "Hosted version appears in r/selfhosted as a secondary sentence, not the opener — per channel angle requirements"
metrics:
  duration: "138 seconds"
  completed_date: "2026-03-07"
  tasks_completed: 3
  files_created: 3
  files_modified: 0
---

# Phase 61 Plan 01: Reddit Community Post Drafts Summary

Three Reddit community post drafts written for r/netsec (RFC 3986 §3.5 crypto-mechanic angle), r/selfhosted (docker-compose self-hosting first), and r/devops (credential-sharing pain point framing).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Write r/netsec post | 2f6be46 | 61-REDDIT-NETSEC.md |
| 2 | Write r/selfhosted post | 9ba4206 | 61-REDDIT-SELFHOSTED.md |
| 3 | Write r/devops post | 59daec4 | 61-REDDIT-DEVOPS.md |

## Verification Results

- No "Product Hunt" or "PH" mentions in any of the three files: PASS
- GitHub repo link in all three files: PASS
- torchsecret.com link in all three files: PASS
- Body word counts: r/netsec 294, r/selfhosted 257, r/devops 248 — all under 300: PASS

## Editorial Verification

- r/netsec: First sentence references RFC 3986 §3.5 fragment identifier — PASS
- r/selfhosted: First line is a `docker-compose up` code example — PASS
- r/devops: Opens with bullet list of credential-sharing pain points before naming the product — PASS
- r/netsec: Explicit "Limitations — naming them explicitly:" heading with device compromise, browser extensions, JS trust model — PASS
- All three: Title reads as practitioner sharing ("I built..."), not founder announcing ("We're thrilled to...") — PASS

## Key Decisions

1. **r/netsec title** leads with RFC 3986 §3.5 citation and URL fragment mechanic — same verifiable technical claim as the Show HN title, adapted to Reddit conversational prose. Security practitioners respond to verifiable claims over product names.

2. **r/netsec limitations section** is a first-class section with a named heading, not a footnote. Naming limitations proactively is the trust signal that earns r/netsec credibility — burying them loses it.

3. **r/selfhosted title** leads with `docker-compose up` rather than the product name. Self-hosters are skeptical of SaaS-first openers; the operational story must come first.

4. **r/devops opens with a bullet list** of alternatives comparison (Slack DM / email / 1Password vault / text) before naming the product. The list makes the pain point concrete and positions Torch Secret as the right-sized tool for a specific workflow.

5. **Hosted version in r/selfhosted** appears as a single secondary sentence ("There's a hosted version at torchsecret.com if you want to try the UI before deciding whether to self-host") — required per plan but placed last, not as opener.

## Deviations from Plan

None — plan executed exactly as written. All three posts were produced in a single pass with body word counts verified.

## Self-Check: PASSED

Files exist:
- FOUND: .planning/phases/61-launch-distribution-assets/61-REDDIT-NETSEC.md
- FOUND: .planning/phases/61-launch-distribution-assets/61-REDDIT-SELFHOSTED.md
- FOUND: .planning/phases/61-launch-distribution-assets/61-REDDIT-DEVOPS.md

Commits exist:
- FOUND: 2f6be46 (r/netsec post)
- FOUND: 9ba4206 (r/selfhosted post)
- FOUND: 59daec4 (r/devops post)

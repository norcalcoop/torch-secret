# OpenSSF Scorecard — Manual Steps Checklist

## Overview

Code-only fixes are complete (SHA pins in scorecard.yml, Dockerfile digest pins, SECURITY.md verified, duplicate scorecard.yaml removed). The remaining Scorecard checks require GitHub UI configuration by a repository owner.

---

## 1. Branch Protection (required for Branch-Protection + Code-Review checks)

Go to: **github.com/norcalcoop/torch-secret → Settings → Branches → Add branch protection rule** for `main`

- [ ] Require a pull request before merging — checked
- [ ] Require approvals: 1 (minimum; a solo repo can set to 0 and still satisfy the check if "Include administrators" is enabled)
- [ ] Include administrators — checked (required for the Scorecard check to count it)
- [ ] Require status checks to pass before merging — checked
- [ ] Require branches to be up to date before merging — checked
- [ ] Do not allow bypassing the above settings — checked
- [ ] Save the rule

**Verification:** Push a test branch, open a PR — confirm the merge button is gated and the status check must pass before merging is allowed.

---

## 2. CII Best Practices Badge (required for CII-Best-Practices check)

- [ ] Go to https://bestpractices.coreinfrastructure.org/en/projects/new
- [ ] Sign in with GitHub
- [ ] Enter repository URL: `https://github.com/norcalcoop/torch-secret`
- [ ] Complete the questionnaire (Passing level requires ~30 criteria — most are already met given the existing CI, tests, SECURITY.md, and docs)
- [ ] Obtain the badge URL and add it to README.md:

```markdown
[![CII Best Practices](https://bestpractices.coreinfrastructure.org/projects/XXXX/badge)](https://bestpractices.coreinfrastructure.org/projects/XXXX)
```

Replace `XXXX` with the project ID assigned during registration.

---

## 3. SAST — Verify CodeQL is Running (required for SAST check)

- [ ] Go to **github.com/norcalcoop/torch-secret → Security → Code scanning**
- [ ] Confirm the CodeQL alerts tab is present and the workflow has run at least once
- [ ] If not enabled: Settings → Code security → Code scanning → Set up → CodeQL

---

## 4. Expected Score After All Steps

| Check               | Before code fixes | After code fixes | After UI steps |
| ------------------- | ----------------- | ---------------- | -------------- |
| Pinned-Dependencies | FAIL              | PASS             | PASS           |
| Token-Permissions   | FAIL              | PASS             | PASS           |
| Vulnerabilities     | FAIL              | PASS             | PASS           |
| Branch-Protection   | FAIL              | FAIL             | PASS           |
| Code-Review         | FAIL              | FAIL             | PASS           |
| CII-Best-Practices  | FAIL              | FAIL             | PASS           |
| Maintained          | PASS              | PASS             | PASS           |
| CI-Tests            | PASS              | PASS             | PASS           |
| Fuzzing             | N/A               | N/A              | N/A            |
| **Estimated score** | **~3/10**         | **~6/10**        | **~8-9/10**    |

---

## Notes

- The Scorecard workflow runs on push to `main` and weekly on Saturday at 17:33 UTC. Scores update after the next workflow run.
- Token-Permissions was flagged because an unpinned action (`codeql-action/upload-sarif@v4`) could be hijacked to exfiltrate tokens. SHA-pinning resolves this.
- Pinned-Dependencies covers both GitHub Actions and Dockerfile base images — both are now pinned.
- The SECURITY.md at the repo root satisfies the Vulnerabilities check (OpenSSF requires a disclosure policy file).

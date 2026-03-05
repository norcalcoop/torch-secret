# Phase 50: Documentation Updates - Research

**Researched:** 2026-03-05
**Domain:** Static file edits — SECURITY.md (Markdown) + Privacy Policy page (TypeScript/DOM)
**Confidence:** HIGH

---

## Summary

Phase 50 is a minimal two-file documentation update. SECURITY.md (repo root) must gain `security@torchsecret.com` as a contact channel for vulnerability reports. The Privacy Policy page (`client/src/pages/privacy.ts`) must surface `privacy@torchsecret.com` as a clickable `mailto:` link specifically for data subject requests.

Both files have been read in full. The exact change sites are identified. No npm packages, no DNS records, no Infisical changes, no migrations — this is pure text and DOM editing.

**Primary recommendation:** Make two targeted edits. SECURITY.md: add an email alternative under "Preferred method". Privacy Policy: change the "Your Rights" paragraph to split the text around the email address and insert an `<a>` element (required because the file uses `textContent` exclusively — no `innerHTML`).

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ADOC-01 | Admin can update SECURITY.md to include security@torchsecret.com as the security disclosure email | SECURITY.md located at repo root; "Reporting a Vulnerability" section identified at lines 13-28; email address must be added alongside (not replacing) the GitHub advisory link |
| ADOC-02 | Admin can update Privacy Policy to reference privacy@torchsecret.com for data subject requests | `client/src/pages/privacy.ts` located; "Your Rights" section at lines 89-92 uses `p.textContent` (no `innerHTML`); must switch to element construction to produce a clickable `<a href="mailto:privacy@torchsecret.com">` |
</phase_requirements>

---

## Standard Stack

No new libraries. Edits touch existing infrastructure only.

| File | Type | Edit complexity |
|------|------|-----------------|
| `SECURITY.md` | Markdown | Trivial — add 1-2 lines |
| `client/src/pages/privacy.ts` | TypeScript DOM | Low — split one paragraph, insert `<a>` element |

### Installation
```bash
# No new packages required
```

---

## Architecture Patterns

### Current SECURITY.md structure

The file has four sections: Supported Versions, Reporting a Vulnerability, Security Model, Disclosure Policy. The "Reporting a Vulnerability" section currently reads:

```markdown
**Preferred method:** Use GitHub's private vulnerability reporting:

[Report a vulnerability](https://github.com/norcalcoop/torch-secret/security/advisories/new)
```

ADOC-01 requires `security@torchsecret.com` to appear as the contact address. The cleanest approach is to add an **email alternative** below the GitHub link rather than replacing it — GitHub's private advisory system is the right primary channel for CVE assignment and coordinated disclosure. The email serves as a fallback for reporters who prefer direct contact.

**Recommended addition:**
```markdown
**Alternative:** Email security@torchsecret.com (PGP not required; TLS protects transit)
```

### Current Privacy Policy DOM pattern

The page uses the project convention of `createElement` + `textContent` only — no `innerHTML` anywhere. This is intentional (CSP + XSS hygiene). Adding a `mailto:` link requires constructing an `<a>` element separately.

The "Your Rights" section (lines 89-92) currently renders as a single paragraph:

```typescript
{
  heading: 'Your Rights',
  paragraphs: [
    'You may request access to, correction of, or deletion of your personal data by contacting contact@torchsecret.com. Anonymous usage generates no personal data on our end.',
  ],
},
```

This paragraph template pipes all text through `p.textContent = text`, which produces a plain-text email address — not a link. ADOC-02 requires a **clickable mailto link**, so the "Your Rights" paragraph must be rendered outside the generic loop.

### Pattern: Inline link in a textContent-only page

The rest of the privacy.ts sections can remain in the generic `for...of` loop. The "Your Rights" section must be extracted and rendered manually:

```typescript
// Source: existing pattern in privacy.ts, applied per-section
const rightsSection = document.createElement('section');

const rightsH2 = document.createElement('h2');
rightsH2.className = 'text-xl font-heading font-semibold text-text-primary mt-6 mb-2';
rightsH2.textContent = 'Your Rights';
rightsSection.appendChild(rightsH2);

const rightsP = document.createElement('p');
rightsP.className = 'text-text-secondary leading-relaxed';

const before = document.createTextNode(
  'You may request access to, correction of, or deletion of your personal data by contacting '
);
const link = document.createElement('a');
link.href = 'mailto:privacy@torchsecret.com';
link.textContent = 'privacy@torchsecret.com';
link.className = 'underline hover:text-text-primary transition-colors';
const after = document.createTextNode('. Anonymous usage generates no personal data on our end.');

rightsP.appendChild(before);
rightsP.appendChild(link);
rightsP.appendChild(after);
rightsSection.appendChild(rightsP);

card.appendChild(rightsSection);
```

The "Your Rights" entry must then be **removed** from the `sections` array so it is not rendered twice by the generic loop.

### Note on other `contact@torchsecret.com` occurrences in privacy.ts

The file contains three additional references to `contact@torchsecret.com`:
- Line 42: "Who We Are" — general contact address. Correct as-is; not a data subject request email.
- Line 69: "Data Retention" — account deletion request. The requirement is specific to ADOC-02 ("data subject requests" in "Your Rights"). ADOC-02 does not mandate changing this line; leave it as `contact@torchsecret.com`.
- Line 102: "Contact" section — general inquiries. Leave as-is.

Only the "Your Rights" paragraph references the data subject request channel and must use `privacy@torchsecret.com` with a mailto link.

### Anti-Patterns to Avoid

- **Do not use `innerHTML`** to inject the mailto link — violates the existing CSP-safe convention of the file and contradicts the comment at line 7 ("Uses createElement/textContent only — no innerHTML").
- **Do not replace the GitHub advisory link in SECURITY.md** — it is the primary coordinated disclosure channel and enables CVE numbering.
- **Do not change the "Data Retention" or "Contact" sections** in privacy.ts — they use the general `contact@torchsecret.com` address and ADOC-02 scopes only the data subject request channel.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Mailto link rendering | Custom sanitizer or innerHTML injection | `document.createElement('a')` + `link.href = 'mailto:...'` | Already the project pattern; safe, CSP-compliant |

---

## Common Pitfalls

### Pitfall 1: Rendering "Your Rights" twice
**What goes wrong:** Section is left in the `sections` array AND manually appended — results in a duplicate heading and paragraph.
**Why it happens:** Developer adds the manual block but forgets to remove the entry from `sections`.
**How to avoid:** Remove the "Your Rights" object from the `sections` array when extracting it to manual rendering.
**Warning signs:** Privacy page shows "Your Rights" heading appearing twice.

### Pitfall 2: Breaking the generic section loop order
**What goes wrong:** Manual section inserted at wrong position — "Your Rights" appears out of sequence (e.g., at end instead of before "Changes to This Policy").
**Why it happens:** Manual `card.appendChild(rightsSection)` called after the loop completes.
**How to avoid:** Insert the manual section at the correct position relative to the loop. Best approach: keep the loop, but skip the "Your Rights" entry with an `if (heading === 'Your Rights') continue;` guard, then insert the manual section at the end of the loop body or render all sections in explicit order.
**Warning signs:** Privacy page sections appear in wrong order.

### Pitfall 3: Wrong email in SECURITY.md
**What goes wrong:** Using `privacy@torchsecret.com` in SECURITY.md or `security@torchsecret.com` in the Privacy Policy.
**Why it happens:** Simple copy-paste error between the two requirements.
**How to avoid:** ADOC-01 = `security@torchsecret.com` in SECURITY.md. ADOC-02 = `privacy@torchsecret.com` in privacy.ts.

---

## Code Examples

### SECURITY.md addition (Markdown)

Current "Reporting a Vulnerability" block ends at line 28. Add after the GitHub link:

```markdown
**Preferred method:** Use GitHub's private vulnerability reporting:

[Report a vulnerability](https://github.com/norcalcoop/torch-secret/security/advisories/new)

**Email alternative:** security@torchsecret.com — use this if you prefer direct contact or the GitHub flow is unavailable.
```

### privacy.ts — recommended loop restructure

The cleanest approach: change the loop to skip "Your Rights" and append the manual section before the loop closes the card, preserving section order.

```typescript
// Source: existing privacy.ts pattern (lines 106-122) with Your Rights extracted

for (const { heading, paragraphs } of sections) {
  // "Your Rights" is rendered manually below to support the mailto link
  if (heading === 'Your Rights') continue;

  const section = document.createElement('section');
  // ... (existing heading + paragraph rendering unchanged)
  card.appendChild(section);
}

// Your Rights — rendered manually for mailto link (textContent-only convention preserved)
const rightsSection = document.createElement('section');

const rightsH2 = document.createElement('h2');
rightsH2.className = 'text-xl font-heading font-semibold text-text-primary mt-6 mb-2';
rightsH2.textContent = 'Your Rights';
rightsSection.appendChild(rightsH2);

const rightsP = document.createElement('p');
rightsP.className = 'text-text-secondary leading-relaxed';
rightsP.appendChild(
  document.createTextNode(
    'You may request access to, correction of, or deletion of your personal data by contacting '
  )
);
const privacyLink = document.createElement('a');
privacyLink.href = 'mailto:privacy@torchsecret.com';
privacyLink.textContent = 'privacy@torchsecret.com';
privacyLink.className = 'underline hover:text-text-primary transition-colors';
rightsP.appendChild(privacyLink);
rightsP.appendChild(
  document.createTextNode('. Anonymous usage generates no personal data on our end.')
);
rightsSection.appendChild(rightsP);
card.appendChild(rightsSection);
```

**Ordering note:** "Your Rights" comes 8th in the `sections` array (between "Cookies" and "Changes to This Policy"). The `continue` guard skips it in the loop; the manual block appends immediately after the loop ends, placing it last — but "Changes to This Policy" and "Contact" sections also come after it. The correct approach: keep the `sections` array intact (don't delete the Your Rights entry), use `continue` to skip it in the loop, then insert the manual section by appending it before "Changes to This Policy" renders.

**Simplest correct implementation:** Render all sections explicitly in full order rather than using the loop, removing the loop entirely. For a 10-section page this is verbose but eliminates ordering risk. Alternatively, insert the manual section mid-loop using index tracking.

**Recommended simplest approach:** Keep the sections array and loop as-is. After the loop runs (skipping "Your Rights"), manually append `rightsSection` before the loop's card.appendChild — but since "Changes to This Policy" and "Contact" follow in the loop, a simpler trick is to place the manual render inside the loop at the right position:

```typescript
for (const { heading, paragraphs } of sections) {
  if (heading === 'Your Rights') {
    // Render manually for mailto link
    // ... (construct rightsSection as above)
    card.appendChild(rightsSection);
    continue;
  }
  // ... existing paragraph loop
}
```

This is the cleanest pattern: the loop proceeds in array order, "Your Rights" is intercepted and rendered manually at the correct position, all other sections render normally.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.x (multi-project) |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run client/src/pages/privacy.ts` |
| Full suite command | `npm run test:run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ADOC-01 | SECURITY.md contains `security@torchsecret.com` | manual-only | N/A — Markdown file, no test harness | N/A |
| ADOC-02 | Privacy page renders `<a href="mailto:privacy@torchsecret.com">` | visual/manual | Browser inspection at `/privacy` | N/A |

**Manual-only justification for ADOC-01:** SECURITY.md is a static Markdown file read by GitHub — no application code path, no automated test can assert its contents meaningfully within the project's test suite. Visual inspection of the rendered file on GitHub suffices.

**Manual-only justification for ADOC-02:** The privacy page is a DOM-rendering TypeScript function. Existing Vitest + vitest-axe tests could assert DOM output, but no existing test file covers `privacy.ts` and writing new tests for a 2-line DOM change adds test overhead disproportionate to the change. Browser inspection at `/privacy` is the verified method.

### Sampling Rate

- **Per task commit:** `npm run lint` (catches TypeScript errors in privacy.ts)
- **Per wave merge:** `npm run test:run`
- **Phase gate:** Manual browser verification at `/privacy` confirming mailto link renders and is clickable

### Wave 0 Gaps

None — no new test infrastructure required. Both changes are verifiable via direct inspection (SECURITY.md on GitHub, `/privacy` in browser).

---

## Sources

### Primary (HIGH confidence)

- File read: `/Users/ourcomputer/Github-Repos/secureshare/SECURITY.md` — full current content confirmed; no `security@torchsecret.com` present
- File read: `/Users/ourcomputer/Github-Repos/secureshare/client/src/pages/privacy.ts` — full current content confirmed; "Your Rights" uses `textContent`, not a link; references `contact@torchsecret.com` not `privacy@torchsecret.com`
- File read: `/Users/ourcomputer/Github-Repos/secureshare/.planning/REQUIREMENTS.md` — ADOC-01 and ADOC-02 requirements confirmed verbatim

### Secondary (MEDIUM confidence)

- CLAUDE.md project instructions: confirmed no `innerHTML` convention in frontend pages; `createElement`/`textContent` pattern is standard across all page files

---

## Metadata

**Confidence breakdown:**
- Current file state: HIGH — both files read directly; exact line numbers identified
- Required changes: HIGH — requirements are precise; no ambiguity in target email addresses or locations
- DOM pattern for mailto link: HIGH — follows existing `createElement` pattern already used throughout the file

**Research date:** 2026-03-05
**Valid until:** Until files are modified — static analysis, no external dependencies

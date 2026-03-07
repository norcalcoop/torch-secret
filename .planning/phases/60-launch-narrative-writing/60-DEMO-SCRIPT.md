# Torch Secret — Demo Screencast Shot List

## Overview

- **Total estimated duration:** 42 seconds
- **Format:** Silent, text captions/overlays — no voiceover audio
- **Flow:** Anonymous (no account, no Pro features)
- **Demo secret:** `OPENAI_API_KEY=sk-proj-AbCdEfGh1234567890xxxxxxxxxxxxxxxxxxxxxxxx`
- **Purpose:** LAUNCH-01 — screencast asset for Product Hunt, Show HN, and social distribution

---

## Shot List

### Shot 1: Open
**Screen:** Browser navigates to `https://torchsecret.com/create`. The page loads: clean textarea placeholder text ("Paste a secret..."), "Create Secret" button below, Torch Secret in the navbar. Cursor blinks in the textarea.
**Duration:** 5 seconds
**Caption:** "Paste a secret. Get a one-time link."
**Transition:** Cut

---

### Shot 2: Paste
**Screen:** The demo credential appears in the textarea as if typed or pasted in one motion. Full text visible: `OPENAI_API_KEY=sk-proj-AbCdEfGh1234567890xxxxxxxxxxxxxxxxxxxxxxxx`
**Duration:** 4 seconds
**Caption:** "An API key. A password. Anything sensitive."
**Transition:** Cut

---

### Shot 3: Create
**Screen:** Cursor moves to the "Create Secret" button. Brief hover state, then click. Brief loading state. Page transitions to the confirmation screen showing the share URL.
**Duration:** 5 seconds
**Caption:** "One click. The secret is encrypted in your browser before it leaves."
**Transition:** Cut

---

### Shot 4: Share — Confirmation Screen
**Screen:** Confirmation screen with the full share URL visible. A "Copy Link" button is present. The URL is long with a `#` character visible near the end of the link.
**Duration:** 5 seconds
**Caption:** "The link is ready to send."
**Transition:** Cut

---

### Shot 5: Share — URL Fragment Close-Up
**Screen:** Camera (or zoom crop) focuses on the browser URL bar. The `#` character and the 43-character base64 key that follows it are clearly visible.
**Duration:** 6 seconds
**Caption:** "That key after the # never leaves your browser. Per RFC 3986, URL fragments are not sent in HTTP requests."
**Transition:** Cut

---

### Shot 6: Reveal — Recipient Opens Link
**Screen:** New browser tab (or incognito window indicator visible). Address bar shows the same share URL. Page loads. The secret text appears: `OPENAI_API_KEY=sk-proj-AbCdEfGh1234567890xxxxxxxxxxxxxxxxxxxxxxxx`
**Duration:** 5 seconds
**Caption:** "The recipient opens the link. The browser decrypts locally — the key never touched the server."
**Transition:** Cut

---

### Shot 7: Reveal — Secret Displayed
**Screen:** Full secret text is visible in the terminal-style display block on the page. A "Copy" button is visible. No other UI clutter.
**Duration:** 4 seconds
**Caption:** "Decrypted. Readable. One time only."
**Transition:** Cut

---

### Shot 8: Destroy
**Screen:** The "viewed" confirmation screen. Text reads approximately "This secret has been destroyed." The page is minimal — no retry button, no way back.
**Duration:** 8 seconds
**Caption:** "The server held only encrypted bytes. Now those bytes are gone. It never had the key."
**Transition:** Fade to black

---

## Timing Summary

| Shot | Name                          | Duration |
|------|-------------------------------|----------|
| 1    | Open                          | 5s       |
| 2    | Paste                         | 4s       |
| 3    | Create                        | 5s       |
| 4    | Share — Confirmation Screen   | 5s       |
| 5    | Share — URL Fragment Close-Up | 6s       |
| 6    | Reveal — Recipient Opens Link | 5s       |
| 7    | Reveal — Secret Displayed     | 4s       |
| 8    | Destroy                       | 8s       |
| **Total** |                          | **42 seconds** |

42 seconds is within the 30–60 second target.

---

## Post-Production Notes

**Text overlay font:** JetBrains Mono (matches the app's terminal-block display and brand identity). Use it for all captions and code/URL overlays.

**Caption placement:** Lower third — roughly 80% down the frame. Avoid center to keep the browser UI unobstructed.

**Fade color:** Fade to/from black for the opening and the destroy shot finale. All other transitions are hard cuts.

**URL bar overlay:** For Shot 5, if a screen zoom is not feasible, add a rectangular highlight/spotlight effect over the `#key` segment in the URL bar. White or brand-orange highlight with slight drop shadow.

**Background:** If recording on a white browser background, add a subtle dark gradient border or letterbox to help the browser window read cleanly against any embed background.

**Caption timing:** Each caption should appear 0.3s after the shot cut, and fade out 0.5s before the next cut.

---

## Verification Checklist

- [ ] **Beat 1 — Open:** Blank create page visible with Torch Secret in navbar (Shot 1)
- [ ] **Beat 2 — Paste:** Demo credential appears in textarea (Shot 2)
- [ ] **Beat 3 — Create:** "Create Secret" button click → confirmation screen with share URL (Shots 3–4)
- [ ] **Beat 4 — Share:** URL fragment (`#key`) visible in URL bar with caption explaining it never reaches the server (Shot 5)
- [ ] **Beat 5 — Reveal + Destroy:** Recipient opens link, secret is decrypted and displayed, then "This secret has been destroyed" screen (Shots 6–8)
- [ ] **No Pro features visible:** No passphrase tab, no dashboard link, no pricing mention anywhere in the flow
- [ ] **Destroy moment caption lands ZK property:** Shot 8 caption — "The server held only encrypted bytes. Now those bytes are gone. It never had the key." — names the zero-knowledge property without using jargon
- [ ] **Timing:** Total 42 seconds (within 30–60 second target)
- [ ] **Demo secret format:** Uses `sk-proj-` prefix (current OpenAI format), obviously fake value (x-fill)

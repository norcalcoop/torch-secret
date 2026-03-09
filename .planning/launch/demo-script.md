# Torch Secret — Screencast Demo Script

**Format:** Silent product video with on-screen text callouts. No narration.
**Target duration:** 45–55 seconds total
**Theme:** Light mode, 1280×720 minimum

---

## Shot 1: Paste the Secret
**Screen:** The `/create` page. The textarea is empty.
**Action:** User clicks the textarea and types (or pastes) `OPENAI_API_KEY=sk-proj-...x-fill`.
**Callout:** "Your secret never leaves this tab — it hasn't been encrypted yet."
**Duration:** ~6s

---

## Shot 2: Set the Burn Timer
**Screen:** Same create page. Expiration select visible. User opens the burn timer dropdown.
**Action:** User selects "30 seconds" from the burn-after-reading timer options.
**Callout:** "Burn after reading: 30-second countdown starts on first open."
**Duration:** ~5s

---

## Shot 3: Create (Encrypt in Browser)
**Screen:** Create page, user clicks the "Create Secret" button. Brief button state change ("Encrypting..." or spinner).
**Action:** Button is clicked. Encryption happens in-browser.
**Callout:** "AES-256-GCM encrypts in your browser — the key stays here."
**Duration:** ~4s

---

## Shot 4: Confirmation Page — Share Link + 4-Way Sharing
**Screen:** Confirmation page. The share URL is displayed. Below it, the 4-way sharing row is visible: Copy Link / Share / Email / QR.
**Action:** No action — hold on this screen so the viewer takes it in.
**Callout:** "The #key fragment is in the URL — RFC 3986 §3.5 means it never reaches the server."
**Duration:** ~6s

---

## Shot 5: QR Code Panel
**Screen:** Same confirmation page. User clicks the QR button in the sharing row.
**Action:** The QR code panel expands to reveal the QR code.
**Callout:** "Scan to share — the encryption key is in the QR code, not on any server."
**Duration:** ~5s

---

## Shot 6: Recipient Opens the Link
**Screen:** New tab. User opens the share URL. The reveal page loads. The secret text (`OPENAI_API_KEY=sk-proj-...x-fill`) appears in the terminal block. A burn countdown is visible in the top-right: "30 · 29 · 28..."
**Action:** Tab opens, secret is revealed, countdown is running.
**Callout:** "Decrypted locally. The countdown has started."
**Duration:** ~6s

---

## Shot 7: Burn Timer Fires — Secret Destroyed
**Screen:** The countdown reaches zero. The secret content area hides — replaced by a "Secret destroyed" message (or equivalent). The terminal block is gone.
**Action:** None — let it breathe. The product speaks for itself.
**Callout:** *(none — silence is the message)*
**Duration:** ~6s

---

## Shot 8: Re-Open Attempt Fails
**Screen:** User refreshes or re-opens the same share URL. The error page appears: "This secret has already been viewed."
**Action:** Reload or paste the URL again.
**Callout:** "Gone. The server deleted it. There's nothing left to serve."
**Duration:** ~5s

---

**Total target duration:** ~43–47 seconds

---

## Recording Notes

- **Resolution:** 1280×720 minimum; 1920×1080 preferred for high-DPI screens
- **Theme:** Light mode — maximum contrast for readability in small/embedded players
- **Cursor:** No custom cursor effects. Keep it clean and undistracting.
- **Zoom:** No zoom animations needed — the UI is self-explanatory; let the callouts do the work
- **Timing:** Trim to exact shot durations. Do not linger on loading states or blank screens.
- **Shot 7 guidance:** The moment the burn timer fires is the emotional climax. Do not cut early. Hold for the full 6 seconds after the content hides. This is the "wow" moment — give it room.
- **Transitions:** Hard cuts only. No fade, no slide. This is not a marketing lifestyle video.
- **Export formats:**
  - MP4 (H.264, 1280×720 or 1920×1080) — for social embed, HN comment, PH media
  - Optimized GIF (640×360, ≤15MB) — for embedding directly in GitHub README or DEV.to posts
- **Audio:** None. Silent throughout.

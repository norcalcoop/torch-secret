---
created: 2026-02-16T18:40:34.166Z
title: Design professional OG image
area: seo
files:
  - client/public/og-image.png
---

## Problem

The current `client/public/og-image.png` (3,733 bytes) was generated programmatically via a Node.js fallback because ImageMagick font rendering was unavailable. It's functional but basic — not representative of the polished dark-theme developer tool aesthetic established in v2.0.

## Solution

Create a professionally designed 1200x630 OG image matching the dark theme: shield icon, "SecureShare" branding in JetBrains Mono, tagline ("Share secrets securely"), deep navy-black background (#1a1625) with accent blue (#4d8bf5). Replace `client/public/og-image.png` with the new asset.

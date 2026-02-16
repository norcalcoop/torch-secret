---
created: 2026-02-16T18:40:34.166Z
title: Replace placeholder domain in SEO assets
area: seo
files:
  - client/public/sitemap.xml
  - client/public/robots.txt
  - client/index.html
---

## Problem

All SEO assets reference the placeholder domain `secureshare.example.com` instead of the actual production domain. This blocks production SEO functionality — crawlers and social media previews will reference a nonexistent domain.

Affected locations in `client/index.html`: og:url, og:image, twitter:image, canonical link, JSON-LD url. Also the Sitemap directive in `robots.txt` and the homepage URL in `sitemap.xml`.

## Solution

Replace all instances of `secureshare.example.com` with the actual production domain once it's known. A single find-and-replace across the 3 files should suffice.

/**
 * generate-og.ts
 *
 * Generates client/public/og-image.png (1200×630) using Playwright.
 * Run with: npx tsx scripts/generate-og.ts
 *
 * The JetBrains Mono font is embedded as a base64 data URI so the HTML
 * is fully self-contained — no network requests during rendering.
 */

import { chromium } from '@playwright/test';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// Embed JetBrains Mono variable font (latin subset) as base64 data URI
const fontPath = resolve(
  root,
  'node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2',
);
const fontBase64 = readFileSync(fontPath).toString('base64');
const fontDataUri = `data:font/woff2;base64,${fontBase64}`;

const html = /* html */ `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @font-face {
    font-family: 'JetBrains Mono';
    src: url('${fontDataUri}') format('woff2');
    font-weight: 100 900;
    font-style: normal;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    width: 1200px;
    height: 630px;
    background: #1a1625;
    font-family: 'JetBrains Mono', monospace;
    overflow: hidden;
    position: relative;
  }

  /* Subtle dot-grid pattern */
  .grid-bg {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(77,139,245,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(77,139,245,0.04) 1px, transparent 1px);
    background-size: 40px 40px;
  }

  /* Giant ghost flame — decorative backdrop element */
  .bg-flame {
    position: absolute;
    right: -20px;
    top: 50%;
    transform: translateY(-50%);
    width: 460px;
    height: 460px;
    color: #ff9f1c;
    opacity: 0.06;
  }

  /* Blue radial glow from flame area */
  .glow-blue {
    position: absolute;
    right: 120px;
    top: 50%;
    transform: translate(50%, -50%);
    width: 700px;
    height: 700px;
    background: radial-gradient(circle, rgba(77,139,245,0.18) 0%, rgba(77,139,245,0.06) 35%, transparent 70%);
    border-radius: 50%;
  }

  /* Warm amber glow from flame */
  .glow-warm {
    position: absolute;
    right: 80px;
    top: 50%;
    transform: translate(50%, -50%);
    width: 500px;
    height: 500px;
    background: radial-gradient(circle, rgba(255,159,28,0.12) 0%, transparent 60%);
    border-radius: 50%;
  }

  /* Left-side content block */
  .content {
    position: absolute;
    left: 80px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    flex-direction: column;
  }

  /* Small flame + brand name */
  .brand-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 36px;
  }

  .brand-icon {
    width: 32px;
    height: 32px;
    color: #ff9f1c;
  }

  .brand-name {
    font-size: 17px;
    color: rgba(255,255,255,0.5);
    letter-spacing: 0.2em;
    text-transform: uppercase;
  }

  /* Main headline */
  .headline {
    font-size: 68px;
    font-weight: 700;
    line-height: 1.0;
    letter-spacing: -0.02em;
    margin-bottom: 28px;
  }

  .headline .line1 { color: #ffffff; display: block; }
  .headline .line2 { color: #4d8bf5; display: block; }

  /* Tagline */
  .tagline {
    font-size: 20px;
    color: rgba(255,255,255,0.4);
    letter-spacing: 0.05em;
    margin-bottom: 48px;
  }

  /* Feature pills */
  .pills { display: flex; gap: 12px; }

  .pill {
    background: rgba(77,139,245,0.1);
    border: 1px solid rgba(77,139,245,0.2);
    border-radius: 100px;
    padding: 6px 16px;
    font-size: 13px;
    color: rgba(255,255,255,0.5);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  /* Foreground glowing flame — right side focal point */
  .fg-flame {
    position: absolute;
    right: 140px;
    top: 50%;
    transform: translateY(-50%);
    width: 220px;
    height: 220px;
    color: #ff9f1c;
    filter:
      drop-shadow(0 0 30px rgba(255,159,28,0.6))
      drop-shadow(0 0 80px rgba(77,139,245,0.4));
  }

  /* Top accent line — blue fading to amber */
  .top-line {
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent 0%, #4d8bf5 30%, #ff9f1c 60%, transparent 100%);
    opacity: 0.6;
  }

  /* Domain watermark */
  .domain {
    position: absolute;
    bottom: 36px;
    right: 48px;
    font-size: 14px;
    font-family: 'JetBrains Mono', monospace;
    color: rgba(255,255,255,0.2);
    letter-spacing: 0.08em;
  }
</style>
</head>
<body>
  <div class="grid-bg"></div>
  <div class="glow-blue"></div>
  <div class="glow-warm"></div>

  <!-- Background ghost flame (large, low opacity) -->
  <svg class="bg-flame" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
  </svg>

  <div class="top-line"></div>

  <div class="content">
    <div class="brand-row">
      <svg class="brand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
      </svg>
      <span class="brand-name">Torch Secret</span>
    </div>

    <div class="headline">
      <span class="line1">Secrets that</span>
      <span class="line2">burn on read.</span>
    </div>

    <div class="tagline">Zero-knowledge · One view · Self-destruct</div>

    <div class="pills">
      <div class="pill">AES-256-GCM</div>
      <div class="pill">No accounts</div>
      <div class="pill">Key never reaches server</div>
    </div>
  </div>

  <!-- Foreground glowing flame — right-side focal point -->
  <svg class="fg-flame" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
  </svg>

  <div class="domain">torchsecret.com</div>
</body>
</html>`;

async function generateOgImage() {
  const outPath = resolve(root, 'client/public/og-image.png');

  console.log('Launching Chromium...');
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(html, { waitUntil: 'networkidle' });

  // Allow font rendering to settle
  await page.waitForTimeout(500);

  await page.screenshot({
    path: outPath,
    type: 'png',
    clip: { x: 0, y: 0, width: 1200, height: 630 },
  });
  await browser.close();

  const { size } = await import('fs').then((m) => m.promises.stat(outPath));
  console.log(`✓ Written: ${outPath} (${(size / 1024).toFixed(1)} KB)`);
}

generateOgImage().catch((err) => {
  console.error(err);
  process.exit(1);
});

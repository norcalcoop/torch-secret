/**
 * Playwright screenshot automation for Torch Secret — production captures.
 *
 * Captures screenshots for two purposes:
 *   1. Product Hunt gallery images (4 scenes) → .planning/launch/gallery/
 *   2. README screenshots (5 scenes) → screenshots/
 *
 * All images are 1270×760px (exact PH dimensions).
 * Targets production: https://torchsecret.com
 *
 * Run: npx tsx scripts/capture-screenshots.ts
 *
 * Prerequisites:
 *   - playwright package installed (`npm install` should cover it)
 *   - Optional: set REVEAL_URL env var to a live secret URL with #key fragment
 *     and burnSeconds=30 for gallery items 8.3 (reveal.png).
 *     If not set, those scenes are skipped with a logged warning.
 *   - Optional: e2e/uat-auth-session.json for dashboard screenshot.
 *     If not present, dashboard scene logs a warning and captures whatever is visible.
 */

import { chromium, type BrowserContext } from 'playwright';
import { mkdirSync, existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

const BASE_URL = 'https://torchsecret.com';
const VIEWPORT = { width: 1270, height: 760 };
const GALLERY_DIR = '.planning/launch/gallery';
const SCREENSHOTS_DIR = 'screenshots';
const AUTH_SESSION_PATH = 'e2e/uat-auth-session.json';

// Set REVEAL_URL to a live secret URL (including #key fragment) with burnSeconds=30
// to capture gallery items 8.3 (reveal.png).
// Example: https://torchsecret.com/secret/abc123#base64key
const REVEAL_URL = process.env.REVEAL_URL ?? '';

/**
 * Create a fresh browser context with light theme pre-seeded.
 */
async function newLightContext(browser: Awaited<ReturnType<typeof chromium.launch>>) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    storageState: {
      cookies: [],
      origins: [
        {
          origin: BASE_URL,
          localStorage: [{ name: 'theme', value: 'light' }],
        },
      ],
    },
  });
  return context;
}

/**
 * Load the saved auth session from e2e/uat-auth-session.json if it exists.
 * Falls back to a plain light-theme context if the file is missing or unreadable.
 */
async function newAuthContext(browser: Awaited<ReturnType<typeof chromium.launch>>) {
  if (existsSync(AUTH_SESSION_PATH)) {
    try {
      const raw = await readFile(AUTH_SESSION_PATH, 'utf-8');
      const storageState = JSON.parse(raw) as Parameters<typeof browser.newContext>[0] extends {
        storageState?: infer S;
      }
        ? S
        : never;
      const context = await browser.newContext({
        viewport: VIEWPORT,
        storageState,
      });
      // Ensure light theme
      await context.addInitScript(() => {
        if (!localStorage.getItem('theme')) {
          localStorage.setItem('theme', 'light');
        }
      });
      return context;
    } catch (err) {
      console.warn(`[WARN] Could not load auth session from ${AUTH_SESSION_PATH}:`, err);
    }
  } else {
    console.warn(
      `[WARN] No auth session found at ${AUTH_SESSION_PATH} — dashboard screenshot may show login page`,
    );
  }
  return newLightContext(browser);
}

/**
 * Create a test secret via the API and return its ID.
 * The ciphertext is a valid base64 string (not real encrypted content).
 */
async function createTestSecret(opts: {
  expiresIn?: string;
  burnSeconds?: number;
}): Promise<string> {
  // Minimal valid-looking base64 ciphertext (server validates format, not crypto correctness)
  const ciphertext = Buffer.from('torch-secret-screenshot-placeholder').toString('base64');

  const body: Record<string, unknown> = {
    ciphertext,
    expiresIn: opts.expiresIn ?? '1h',
  };
  if (opts.burnSeconds !== undefined) {
    body.burnSeconds = opts.burnSeconds;
  }

  const res = await fetch(`${BASE_URL}/api/secrets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create test secret: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { id: string };
  return data.id;
}

async function run(): Promise<void> {
  // Ensure output directories exist
  mkdirSync(GALLERY_DIR, { recursive: true });
  mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  console.log(`[capture-screenshots] Target: ${BASE_URL}`);
  console.log(`[capture-screenshots] Viewport: ${VIEWPORT.width}×${VIEWPORT.height}px`);
  console.log('');

  const browser = await chromium.launch({ headless: true });
  const written: string[] = [];

  try {
    // -------------------------------------------------------------------------
    // Scene 1: Homepage
    // Gallery:      .planning/launch/gallery/homepage.png
    // README:       screenshots/homepage-light.png
    // -------------------------------------------------------------------------
    console.log('[1/5] Capturing homepage...');
    {
      const ctx: BrowserContext = await newLightContext(browser);
      const page = await ctx.newPage();
      await page.goto(BASE_URL, { waitUntil: 'networkidle' });
      await page.waitForTimeout(800);

      await page.screenshot({ path: `${GALLERY_DIR}/homepage.png`, fullPage: false });
      written.push(`${GALLERY_DIR}/homepage.png`);
      console.log(`  -> ${GALLERY_DIR}/homepage.png`);

      await page.screenshot({ path: `${SCREENSHOTS_DIR}/homepage-light.png`, fullPage: false });
      written.push(`${SCREENSHOTS_DIR}/homepage-light.png`);
      console.log(`  -> ${SCREENSHOTS_DIR}/homepage-light.png`);

      await ctx.close();
    }

    // -------------------------------------------------------------------------
    // Scene 2: Create page
    // Gallery:      .planning/launch/gallery/create.png
    // README:       screenshots/create-flow.png
    // -------------------------------------------------------------------------
    console.log('[2/5] Capturing create page...');
    {
      const ctx: BrowserContext = await newLightContext(browser);
      const page = await ctx.newPage();
      await page.goto(`${BASE_URL}/create`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(800);

      await page.screenshot({ path: `${GALLERY_DIR}/create.png`, fullPage: false });
      written.push(`${GALLERY_DIR}/create.png`);
      console.log(`  -> ${GALLERY_DIR}/create.png`);

      await page.screenshot({ path: `${SCREENSHOTS_DIR}/create-flow.png`, fullPage: false });
      written.push(`${SCREENSHOTS_DIR}/create-flow.png`);
      console.log(`  -> ${SCREENSHOTS_DIR}/create-flow.png`);

      await ctx.close();
    }

    // -------------------------------------------------------------------------
    // Scene 3: Confirmation page (QR panel open for README; plain for gallery)
    // Gallery:      .planning/launch/gallery/confirmation.png  (4-button row, no QR)
    // README:       screenshots/confirmation-flow.png           (QR panel open)
    // -------------------------------------------------------------------------
    console.log('[3/5] Capturing confirmation page...');
    {
      let secretId: string | null = null;
      try {
        secretId = await createTestSecret({ expiresIn: '1h' });
      } catch (err) {
        console.warn('[WARN] Could not create test secret for confirmation scene:', err);
      }

      if (secretId) {
        const ctx: BrowserContext = await newLightContext(browser);
        const page = await ctx.newPage();

        // Navigate to confirmation page (/confirm/:id — shows share options without revealing)
        await page.goto(`${BASE_URL}/confirm/${secretId}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(800);

        // Gallery: capture before QR open (shows 4-button row)
        await page.screenshot({ path: `${GALLERY_DIR}/confirmation.png`, fullPage: false });
        written.push(`${GALLERY_DIR}/confirmation.png`);
        console.log(`  -> ${GALLERY_DIR}/confirmation.png`);

        // README: open QR panel then screenshot
        try {
          // Try clicking the QR toggle button — ID varies; try multiple selectors
          const toggled = await page.evaluate(() => {
            const btn =
              document.querySelector<HTMLButtonElement>('#qr-toggle-btn') ??
              document.querySelector<HTMLButtonElement>('[data-action="toggle-qr"]') ??
              Array.from(document.querySelectorAll('button')).find((b) =>
                b.textContent?.toLowerCase().includes('qr'),
              );
            if (btn) {
              btn.click();
              return true;
            }
            return false;
          });
          if (toggled) {
            await page.waitForTimeout(600);
          } else {
            console.warn(
              '[WARN] QR toggle button not found — capturing confirmation without QR open',
            );
          }
        } catch (err) {
          console.warn('[WARN] QR toggle failed:', err);
        }

        await page.screenshot({
          path: `${SCREENSHOTS_DIR}/confirmation-flow.png`,
          fullPage: false,
        });
        written.push(`${SCREENSHOTS_DIR}/confirmation-flow.png`);
        console.log(`  -> ${SCREENSHOTS_DIR}/confirmation-flow.png`);

        await ctx.close();
      } else {
        console.warn(
          '[SKIP] confirmation.png and confirmation-flow.png — could not create test secret',
        );
      }
    }

    // -------------------------------------------------------------------------
    // Scene 4: Reveal page
    // Gallery:      .planning/launch/gallery/reveal.png
    // README:       screenshots/reveal-flow.png
    //
    // If REVEAL_URL is set: navigate directly to that URL (live secret with #key).
    // Otherwise: create a new test secret, navigate to /confirm/:id — the reveal
    // interstitial is still a valid gallery image showing the pre-reveal state.
    // -------------------------------------------------------------------------
    console.log('[4/5] Capturing reveal page...');
    {
      const ctx: BrowserContext = await newLightContext(browser);
      const page = await ctx.newPage();

      if (REVEAL_URL) {
        console.log('  Using REVEAL_URL for live secret reveal...');
        await page.goto(REVEAL_URL, { waitUntil: 'networkidle' });
        await page.waitForTimeout(800);

        // Click reveal button if present (interstitial state)
        try {
          const revealBtn = await page.$('button:has-text("Reveal Secret")');
          if (revealBtn) {
            await revealBtn.click();
            await page.waitForTimeout(1500);
          }
        } catch {
          // Already past interstitial
        }

        await page.screenshot({ path: `${GALLERY_DIR}/reveal.png`, fullPage: false });
        written.push(`${GALLERY_DIR}/reveal.png`);
        console.log(`  -> ${GALLERY_DIR}/reveal.png`);

        await page.screenshot({ path: `${SCREENSHOTS_DIR}/reveal-flow.png`, fullPage: false });
        written.push(`${SCREENSHOTS_DIR}/reveal-flow.png`);
        console.log(`  -> ${SCREENSHOTS_DIR}/reveal-flow.png`);
      } else {
        // Fallback: use a fresh confirmation page as the reveal scene
        console.warn(
          '[SKIP] REVEAL_URL not set — capturing reveal interstitial (/confirm/:id) as reveal.png substitute',
        );
        console.warn(
          '       Set REVEAL_URL=https://torchsecret.com/secret/<id>#<key> with burnSeconds=30 for the full reveal scene.',
        );

        let secretId: string | null = null;
        try {
          secretId = await createTestSecret({ expiresIn: '1h' });
        } catch (err) {
          console.warn('[WARN] Could not create test secret for reveal scene:', err);
        }

        if (secretId) {
          await page.goto(`${BASE_URL}/confirm/${secretId}`, { waitUntil: 'networkidle' });
          await page.waitForTimeout(800);

          await page.screenshot({ path: `${GALLERY_DIR}/reveal.png`, fullPage: false });
          written.push(`${GALLERY_DIR}/reveal.png`);
          console.log(
            `  -> ${GALLERY_DIR}/reveal.png  (interstitial state — set REVEAL_URL for live reveal)`,
          );

          await page.screenshot({ path: `${SCREENSHOTS_DIR}/reveal-flow.png`, fullPage: false });
          written.push(`${SCREENSHOTS_DIR}/reveal-flow.png`);
          console.log(`  -> ${SCREENSHOTS_DIR}/reveal-flow.png  (interstitial state)`);
        } else {
          console.warn('[SKIP] reveal.png and reveal-flow.png — could not create test secret');
        }
      }

      await ctx.close();
    }

    // -------------------------------------------------------------------------
    // Scene 5: Dashboard
    // README only:  screenshots/dashboard-flow.png
    // -------------------------------------------------------------------------
    console.log('[5/5] Capturing dashboard...');
    {
      const ctx: BrowserContext = await newAuthContext(browser);
      const page = await ctx.newPage();
      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(800);

      await page.screenshot({ path: `${SCREENSHOTS_DIR}/dashboard-flow.png`, fullPage: false });
      written.push(`${SCREENSHOTS_DIR}/dashboard-flow.png`);
      console.log(`  -> ${SCREENSHOTS_DIR}/dashboard-flow.png`);

      await ctx.close();
    }
  } finally {
    await browser.close();
  }

  console.log('');
  console.log(`[capture-screenshots] Complete. ${written.length} files written:`);
  for (const f of written) {
    console.log(`  ${f}`);
  }

  if (!REVEAL_URL) {
    console.log('');
    console.log('[NOTE] Gallery reveal.png shows the confirm interstitial (not live reveal).');
    console.log('       For a real reveal scene, set REVEAL_URL and re-run:');
    console.log(
      '         REVEAL_URL="https://torchsecret.com/secret/<id>#<key>" npx tsx scripts/capture-screenshots.ts',
    );
  }
}

run().catch((err: unknown) => {
  console.error('[capture-screenshots] Fatal error:', err);
  process.exit(1);
});

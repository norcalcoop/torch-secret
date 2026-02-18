/**
 * Playwright screenshot automation for SecureShare README.
 *
 * Captures dark-theme screenshots of the create and reveal pages.
 * Run: npx tsx scripts/screenshots.ts
 *
 * Prerequisites: The dev server stack must be running, or this script
 * will start it automatically using the same webServer pattern as the
 * E2E test config.
 */

import { chromium } from 'playwright';
import { encrypt } from '../client/src/crypto/index.js';
import { execSync, spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const SCREENSHOT_DIR = 'docs/screenshots';
const VIEWPORT = { width: 1280, height: 800 };

/**
 * Check if the server is already running by hitting the health endpoint.
 */
async function isServerRunning(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Start the dev server if not already running.
 * Returns the child process (or null if server was already running).
 */
async function ensureServer(): Promise<ChildProcess | null> {
  if (await isServerRunning()) {
    console.log('Server already running at', BASE_URL);
    return null;
  }

  console.log('Starting server...');

  // Build client first (hardcoded command, no user input)
  execSync('npm run build:client', {
    cwd: process.cwd(),
    stdio: 'pipe',
    env: { ...process.env, NODE_ENV: 'test' },
  });

  // Start server in background (uses execFile-style spawn, not shell)
  const server = spawn('node', ['--import', 'tsx', 'server/src/server.ts'], {
    cwd: process.cwd(),
    stdio: 'pipe',
    env: {
      ...process.env,
      NODE_ENV: 'test',
      FORCE_HTTPS: 'false',
      E2E_TEST: 'true',
    },
  });

  // Wait for server to be ready (up to 30s)
  const maxWait = 30_000;
  const interval = 500;
  let waited = 0;

  while (waited < maxWait) {
    if (await isServerRunning()) {
      console.log('Server ready');
      return server;
    }
    await new Promise((r) => setTimeout(r, interval));
    waited += interval;
  }

  server.kill();
  throw new Error('Server failed to start within 30 seconds');
}

async function captureScreenshots(): Promise<void> {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });

  let serverProcess: ChildProcess | null = null;

  try {
    serverProcess = await ensureServer();

    const browser = await chromium.launch();

    // --- Screenshot 1: Create page (dark theme) ---
    console.log('Capturing create page...');
    const createCtx = await browser.newContext({
      viewport: VIEWPORT,
      colorScheme: 'dark',
      bypassCSP: true,
    });
    const createPage = await createCtx.newPage();
    await createPage.goto(BASE_URL, { waitUntil: 'networkidle' });

    // Wait for animations to settle
    await createPage.waitForTimeout(1000);

    await createPage.screenshot({
      path: `${SCREENSHOT_DIR}/create-dark.png`,
      fullPage: false,
    });
    console.log('  -> create-dark.png saved');
    await createCtx.close();

    // --- Screenshot 2: Reveal page (dark theme) ---
    console.log('Capturing reveal page...');

    // Encrypt a sample message using the real crypto module
    const sampleMessage = 'This is a secret message shared securely with SecureShare.';
    const { payload, keyBase64Url } = await encrypt(sampleMessage);

    // Create a secret via the API
    const createRes = await fetch(`${BASE_URL}/api/secrets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ciphertext: payload.ciphertext,
        expiresIn: '24h',
      }),
    });

    if (!createRes.ok) {
      throw new Error(`Failed to create secret: ${createRes.status} ${await createRes.text()}`);
    }

    const { id } = (await createRes.json()) as { id: string };

    // Navigate to reveal page with key in fragment
    const revealCtx = await browser.newContext({
      viewport: VIEWPORT,
      colorScheme: 'dark',
      bypassCSP: true,
    });
    const revealPage = await revealCtx.newPage();
    await revealPage.goto(`${BASE_URL}/secret/${id}#${keyBase64Url}`, {
      waitUntil: 'networkidle',
    });

    // Wait for the interstitial to appear
    await revealPage.waitForSelector('button:has-text("Reveal Secret")', {
      timeout: 10_000,
    });

    // Click the reveal button
    await revealPage.click('button:has-text("Reveal Secret")');

    // Wait for the decrypted content to appear
    await revealPage.waitForSelector('text=Secret Revealed', {
      timeout: 10_000,
    });

    // Wait for animations to settle
    await revealPage.waitForTimeout(1000);

    await revealPage.screenshot({
      path: `${SCREENSHOT_DIR}/reveal-dark.png`,
      fullPage: false,
    });
    console.log('  -> reveal-dark.png saved');
    await revealCtx.close();

    await browser.close();
    console.log('Screenshots complete!');
  } finally {
    if (serverProcess) {
      serverProcess.kill();
      console.log('Server stopped');
    }
  }
}

captureScreenshots().catch((err) => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});

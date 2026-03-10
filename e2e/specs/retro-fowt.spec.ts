import { test, expect } from '@playwright/test';

/**
 * E2E: Retro theme FOWT (flash-of-wrong-theme) prevention.
 *
 * The inline FOWT script in index.html must apply retro theme CSS variables
 * synchronously from localStorage BEFORE the main JS bundle executes.
 * This test verifies no color flash occurs on page reload with an active theme.
 */
test.describe('Retro theme FOWT prevention', () => {
  // Requires RETRO_ENABLED = true in client/index.html — skipped while retro themes are off pre-launch
  test.skip('mario theme colors applied before JS bundle executes', async ({ page }) => {
    // Inject retro-theme into localStorage BEFORE page load
    await page.addInitScript(() => {
      window.localStorage.setItem('retro-theme', 'mario');
    });

    // Navigate to the app
    await page.goto('/');

    // The FOWT script must apply --ds-color-bg before DOMContentLoaded fires.
    // We read the CSS custom property from documentElement immediately after navigation
    // (before any client JS modules run — Playwright captures DOM state at navigation end).
    const bgColor = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue('--ds-color-bg').trim(),
    );

    // Mario bg is '#5c94fc' (sky blue) — matches FOWT R{} map in index.html
    expect(bgColor).toBe('#5c94fc');

    // Also confirm data-retro-theme attribute was set by FOWT script
    const retroAttr = await page.evaluate(() =>
      document.documentElement.getAttribute('data-retro-theme'),
    );
    expect(retroAttr).toBe('mario');
  });

  test('no retro theme when localStorage key absent', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.removeItem('retro-theme');
    });

    await page.goto('/');

    const bgColor = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue('--ds-color-bg').trim(),
    );

    // Without retro theme, FOWT script leaves --ds-color-bg unset (empty string)
    // The value comes from :root stylesheet (not inline style)
    expect(bgColor).toBe('');

    const retroAttr = await page.evaluate(() =>
      document.documentElement.getAttribute('data-retro-theme'),
    );
    expect(retroAttr).toBeNull();
  });

  // Requires RETRO_ENABLED = true in client/index.html — skipped while retro themes are off pre-launch
  test.skip('matrix theme colors applied before JS bundle executes', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('retro-theme', 'matrix');
    });

    await page.goto('/');

    const bgColor = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue('--ds-color-bg').trim(),
    );

    // Matrix bg is '#000' (pure black) — matches FOWT R{} map in index.html
    expect(bgColor).toBe('#000');
  });
});

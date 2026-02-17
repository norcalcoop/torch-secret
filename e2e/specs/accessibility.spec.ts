/**
 * E2E test: Accessibility (axe-core WCAG 2.1 AA).
 *
 * Runs automated axe-core scans on every distinct page state to ensure
 * zero WCAG 2.1 AA violations. Uses the makeAxeBuilder fixture which
 * pre-configures AxeBuilder with wcag2a, wcag2aa, wcag21a, wcag21aa tags.
 */

import { test, expect } from '../fixtures/test';

test.describe('Accessibility', () => {
  test('create page has no violations', async ({ page, makeAxeBuilder }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Share a Secret' })).toBeVisible();

    const results = await makeAxeBuilder().analyze();
    expect(results.violations).toEqual([]);
  });

  test('reveal interstitial has no violations', async ({
    page,
    createTestSecret,
    makeAxeBuilder,
  }) => {
    const secret = await createTestSecret();

    await page.goto(secret.url);
    await expect(page.getByRole('heading', { name: "You've received a secret" })).toBeVisible();

    const results = await makeAxeBuilder().analyze();
    expect(results.violations).toEqual([]);
  });

  test('revealed secret page has no violations', async ({
    page,
    createTestSecret,
    makeAxeBuilder,
  }) => {
    const secret = await createTestSecret({ plaintext: 'Accessibility test secret' });

    await page.goto(secret.url);
    await expect(page.getByRole('heading', { name: "You've received a secret" })).toBeVisible();

    await page.getByRole('button', { name: 'Reveal Secret' }).click();
    await expect(page.getByRole('heading', { name: 'Secret Revealed' })).toBeVisible();

    const results = await makeAxeBuilder().analyze();
    expect(results.violations).toEqual([]);
  });

  test('password entry page has no violations', async ({
    page,
    createTestSecret,
    makeAxeBuilder,
  }) => {
    const secret = await createTestSecret({
      plaintext: 'Axe password test',
      password: 'testpass',
    });

    await page.goto(secret.url);
    await expect(page.getByRole('heading', { name: 'Password Required' })).toBeVisible();

    const results = await makeAxeBuilder().analyze();
    expect(results.violations).toEqual([]);
  });

  test('error page has no violations', async ({ page, makeAxeBuilder }) => {
    await page.goto('/secret/xxxxxxxxxxxxxxxxxxx01#fakekeybase64url1234567890123456789012');
    await expect(page.getByRole('heading', { name: 'Secret Not Available' })).toBeVisible();

    const results = await makeAxeBuilder().analyze();
    expect(results.violations).toEqual([]);
  });
});

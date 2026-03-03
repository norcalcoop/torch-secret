/**
 * E2E test: Create, share, and reveal a secret.
 *
 * This serial test validates the core user journey:
 * 1. Create a secret through the browser UI
 * 2. Navigate to the share URL and reveal the decrypted secret
 * 3. Revisit the same URL and confirm the secret was destroyed
 *
 * Tests are serial because they share state (the share URL) and
 * secrets are one-time-view (destructive operations).
 */

import { test, expect } from '../fixtures/test';

test.describe.serial('Create and reveal secret', () => {
  let shareUrl: string;

  test('create a secret via the browser UI', async ({ page }) => {
    // Navigate to the create page
    await page.goto('/create');

    // Wait for the page to fully load
    await expect(page.getByRole('heading', { name: 'Share a Secret' })).toBeVisible();

    // Fill in the secret text
    await page.getByLabel('Your secret').fill('My super secret E2E message');

    // Submit the form
    await page.getByRole('button', { name: 'Create Secure Link' }).click();

    // Wait for the confirmation page
    await expect(page.getByRole('heading', { name: 'Your Secure Link is Ready' })).toBeVisible();

    // Extract the share URL from the code element
    const urlText = await page.locator('code').textContent();
    expect(urlText).toBeTruthy();
    expect(urlText).toContain('/secret/');
    expect(urlText).toContain('#');

    shareUrl = urlText!;
  });

  test('reveal the secret via the share URL', async ({ page }) => {
    // Navigate to the share URL (Playwright sends the fragment)
    await page.goto(shareUrl);

    // Wait for the interstitial heading
    await expect(page.getByRole('heading', { name: "You've received a secret" })).toBeVisible();

    // Click the reveal button
    await page.getByRole('button', { name: 'Reveal Secret' }).click();

    // Wait for the reveal heading
    await expect(page.getByRole('heading', { name: 'Secret Revealed' })).toBeVisible();

    // Verify the decrypted text is visible
    await expect(page.getByText('My super secret E2E message')).toBeVisible();
  });

  test('secret is destroyed after viewing', async ({ page }) => {
    // Navigate to the same URL again
    await page.goto(shareUrl);

    // The page should show an error indicating the secret is gone
    await expect(
      page.getByRole('heading', { name: /Secret (Not Available|Already Viewed)/ }),
    ).toBeVisible();
  });
});

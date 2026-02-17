/**
 * E2E test: Error states.
 *
 * Validates that the application handles error conditions gracefully:
 * 1. Already-viewed secret shows an error
 * 2. Invalid/fabricated link shows an error
 * 3. Missing encryption key in URL shows "Invalid Link"
 */

import { test, expect } from '../fixtures/test';

test.describe('Error states', () => {
  test('already viewed secret shows error', async ({ page, createTestSecret }) => {
    const secret = await createTestSecret();

    // First view: consume the secret
    await page.goto(secret.url);
    await page.getByRole('button', { name: 'Reveal Secret' }).click();
    await expect(page.getByRole('heading', { name: 'Secret Revealed' })).toBeVisible();

    // Second view: should show an error
    await page.goto(secret.url);
    await expect(
      page.getByRole('heading', { name: /Secret (Not Available|Already Viewed)/ }),
    ).toBeVisible();
  });

  test('invalid link shows error', async ({ page }) => {
    // Navigate to a fabricated URL with a valid-looking but nonexistent ID
    // ID must be 21 chars (nanoid length), key must be a plausible base64url string
    await page.goto('/secret/xxxxxxxxxxxxxxxxxxx01#somefakekey123456789012345678901234567890123');

    // Should show "Secret Not Available" error
    await expect(page.getByRole('heading', { name: 'Secret Not Available' })).toBeVisible();
  });

  test('missing encryption key shows Invalid Link error', async ({ page, createTestSecret }) => {
    const secret = await createTestSecret();

    // Navigate WITHOUT the key fragment (no #key part)
    await page.goto('/secret/' + secret.id);

    // Should show "Invalid Link" error
    await expect(page.getByRole('heading', { name: 'Invalid Link' })).toBeVisible();
  });
});

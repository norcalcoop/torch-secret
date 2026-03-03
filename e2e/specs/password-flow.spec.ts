/**
 * E2E test: Password-protected secret flow.
 *
 * Validates that:
 * 1. A password-protected secret can be revealed with the correct password
 * 2. A wrong password shows an error with attempts remaining
 *
 * Each test creates a FRESH secret via the API fixture. Secrets are
 * one-time-use and cannot be shared between tests.
 */

import { test, expect } from '../fixtures/test';

test.describe('Password-protected secret flow', () => {
  test('create with password, reveal with correct password', async ({ page, createTestSecret }) => {
    const secret = await createTestSecret({
      plaintext: 'Password protected E2E secret',
      password: 'mypassword123',
    });

    await page.goto(secret.url);

    // Wait for the password entry form
    await expect(page.getByRole('heading', { name: 'Protection Required' })).toBeVisible();

    // Fill in the correct password
    await page.getByLabel('Password').fill('mypassword123');

    // Submit the form
    await page.getByRole('button', { name: 'Verify Password' }).click();

    // Wait for the secret to be revealed
    await expect(page.getByRole('heading', { name: 'Secret Revealed' })).toBeVisible();

    // Verify the plaintext is visible
    await expect(page.getByText('Password protected E2E secret')).toBeVisible();
  });

  test('wrong password shows error with attempts remaining', async ({ page, createTestSecret }) => {
    const secret = await createTestSecret({
      plaintext: 'Another secret',
      password: 'correctpassword',
    });

    await page.goto(secret.url);

    // Wait for the password entry form
    await expect(page.getByRole('heading', { name: 'Protection Required' })).toBeVisible();

    // Fill in a wrong password
    await page.getByLabel('Password').fill('wrongpassword');

    // Submit the form
    await page.getByRole('button', { name: 'Verify Password' }).click();

    // Wait for the error alert showing wrong password with attempts remaining
    const errorAlert = page.getByRole('alert');
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toHaveText(/[Ww]rong password.*\d+ attempts? remaining/);
  });
});

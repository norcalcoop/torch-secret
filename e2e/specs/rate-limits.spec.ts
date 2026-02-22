/**
 * E2E tests: Anonymous user rate limits and expiration cap enforcement.
 *
 * Verifies Phase 27 server-side enforcement for anonymous users:
 * 1. Rate-limit countdown: when 3/hr limit is hit, the client shows minutes remaining.
 *    NOTE: The E2E test environment sets E2E_TEST=true which raises the anonymous
 *    rate limit to 1000 to prevent false 429s during parallel test runs. The countdown
 *    test is therefore skipped in the standard E2E configuration — it is verified via
 *    unit tests on showRateLimitUpsell() and integration tests on the route middleware.
 * 2. Expiration cap: anonymous users cannot set expiration > 1 hour (server rejects with 400)
 */

import { test, expect } from '../fixtures/test';

test.describe.serial('Anonymous rate-limit countdown', () => {
  test('hitting 3/hr limit shows countdown in the UI', async ({ page, createTestSecret }) => {
    // The E2E test environment sets E2E_TEST=true which raises the anonymous hourly rate
    // limit from 3 to 1000 (see server/src/middleware/rate-limit.ts isE2E check). This
    // prevents false 429s from IP-shared test runners. The countdown UI is covered by
    // unit tests on showRateLimitUpsell() in the create page and integration tests on the
    // rate-limit middleware directly.
    //
    // Skip this test in the standard E2E environment because it cannot trigger a real 429.
    // To test locally without E2E_TEST: set E2E_TEST=false (not supported in Playwright config
    // without a separate test profile).
    test.skip(
      process.env.E2E_TEST === 'true',
      'Rate limit raised to 1000 in E2E_TEST mode — cannot trigger 429 to verify countdown UI. ' +
        'Covered by unit tests on showRateLimitUpsell() and rate-limit middleware integration tests.',
    );

    // Exhaust the anonymous hourly rate limit (3 secrets/hr) via the API fixture.
    // The fixture posts directly to /api/secrets (expiresIn '1h' by default — valid for anon).
    await createTestSecret();
    await createTestSecret();
    await createTestSecret();
    // 3 secrets created — next creation via the UI should trigger 429.

    // Navigate to the create page
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Share a Secret' })).toBeVisible();

    // Fill in the secret and submit
    await page.getByLabel('Your secret').fill('Rate limit test secret');
    await page.getByRole('button', { name: 'Create Secure Link' }).click();

    // The 429 response should trigger the upsell card (role="alert").
    // The card contains the rate-limit headline.
    const alertEl = page.getByRole('alert');
    await expect(alertEl).toBeVisible({ timeout: 10_000 });

    // Verify the headline text appears
    await expect(
      page.getByText("You've reached the free limit for anonymous sharing."),
    ).toBeVisible();

    // Verify the minutes countdown appears (the RateLimit-Reset delta-seconds value
    // is converted to minutes via Math.ceil(resetTimestamp / 60)).
    // The text matches "Limit resets in N minute(s)." or "Limit resets soon."
    const resetText = alertEl.locator('p', {
      hasText: /Limit resets (in \d+ minutes?|soon)\./,
    });
    await expect(resetText).toBeVisible();

    // Verify the CTA sign-up link is present
    await expect(page.getByRole('link', { name: /Sign up/i })).toBeVisible();
  });
});

test.describe('Anonymous expiration cap enforcement', () => {
  test('server rejects 24h expiration for anonymous users', async ({ request }) => {
    // POST directly with expiresIn: '24h' — bypasses the locked client-side select.
    // The server-side tier guard in secrets.ts should return 400 with validation_error.
    const response = await request.post('/api/secrets', {
      data: {
        ciphertext: 'dGVzdA==', // minimal valid base64 ciphertext for API validation
        expiresIn: '24h',
      },
    });

    // Anonymous user with 24h expiration must be rejected
    expect(response.status()).toBe(400);
    const body = (await response.json()) as { error?: string };
    expect(body.error).toBeDefined();
  });

  test('server rejects 7d expiration for anonymous users', async ({ request }) => {
    const response = await request.post('/api/secrets', {
      data: {
        ciphertext: 'dGVzdA==',
        expiresIn: '7d',
      },
    });

    expect(response.status()).toBe(400);
    const body = (await response.json()) as { error?: string };
    expect(body.error).toBeDefined();
  });

  test('server allows 1h expiration for anonymous users', async ({ request }) => {
    // Valid case: anonymous user creating with 1h expiration should succeed (201).
    // Use a real encrypted ciphertext from the encryptForTest helper.
    const { encryptForTest } = await import('../fixtures/crypto-helpers.js');
    const { ciphertext } = await encryptForTest('test-e2e-expiration-cap');

    const response = await request.post('/api/secrets', {
      data: {
        ciphertext,
        expiresIn: '1h',
      },
    });

    expect(response.status()).toBe(201);
  });

  test('create page expiration select is locked to 1h for anonymous users', async ({ page }) => {
    // The client-side expiration select renders as a locked read-only display for
    // anonymous users (createExpirationSelect(false) — see expiration-select.ts).
    // Anonymous mode renders a <div> wrapper (not a <select>) containing "1 hour" text.
    // Authenticated mode renders a <select id="expiration"> with 1h/24h/7d options.
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Share a Secret' })).toBeVisible();

    // Check whether the page renders a <select> element for expiration
    const selectEl = page.locator('select#expiration');
    const count = await selectEl.count();

    if (count > 0) {
      // Authenticated select rendered — should not contain 24h, 7d, or 30d for anonymous
      // (this branch is unexpected for anonymous users but handle defensively)
      const options = await selectEl.locator('option').allTextContents();
      expect(
        options.some((opt) => opt.includes('24') || opt.includes('7 day') || opt.includes('30')),
      ).toBe(false);
    } else {
      // Anonymous mode: no <select> — the locked div display should show "1 hour" text.
      // The expiration component creates a div with a span containing "1 hour" text.
      await expect(page.getByText('1 hour')).toBeVisible();
      // Verify no interactive 24h/7d/30d options are present in the DOM
      const anyLongExpiry = page.getByRole('option', { name: /24|7 day|30 day/ });
      expect(await anyLongExpiry.count()).toBe(0);
    }
  });
});

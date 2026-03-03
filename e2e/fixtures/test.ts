/**
 * Extended Playwright test fixtures for Torch Secret E2E tests.
 *
 * Provides:
 * - createTestSecret: Creates a real encrypted secret via the API (bypasses UI)
 * - makeAxeBuilder: Pre-configured axe accessibility checker (WCAG 2.1 AA)
 */

import { test as base, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { encryptForTest } from './crypto-helpers';

/** Options for creating a test secret via the API. */
interface CreateSecretOptions {
  plaintext?: string;
  expiresIn?: '1h' | '24h' | '7d' | '30d';
  password?: string;
}

/** Result from creating a test secret. */
interface CreateSecretResult {
  id: string;
  key: string;
  url: string;
}

/** Custom fixtures extending Playwright's base test. */
interface SecureShareFixtures {
  createTestSecret: (options?: CreateSecretOptions) => Promise<CreateSecretResult>;
  makeAxeBuilder: () => AxeBuilder;
}

export const test = base.extend<SecureShareFixtures>({
  createTestSecret: async ({ request }, use) => {
    await use(async (options: CreateSecretOptions = {}) => {
      const { plaintext = 'Test secret for E2E', expiresIn = '1h', password } = options;

      // Encrypt using the same pipeline as the browser
      const { ciphertext, keyBase64Url } = await encryptForTest(plaintext);

      // POST to the API to create the secret
      const body: Record<string, string> = { ciphertext, expiresIn };
      if (password) {
        body.password = password;
      }

      const response = await request.post('/api/secrets', { data: body });
      expect(response.ok()).toBeTruthy();

      const responseBody = (await response.json()) as { id: string };
      const id = responseBody.id;

      return {
        id,
        key: keyBase64Url,
        url: `/secret/${id}#${keyBase64Url}`,
      };
    });
  },

  makeAxeBuilder: async ({ page }, use) => {
    await use(() => {
      return new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
    });
  },
});

export { expect };

/**
 * Typed fetch wrapper for the SecureShare secrets API.
 *
 * IMPORTANT: GET requests are never cached -- each call atomically
 * destroys the secret on the server. There is no retry or cache logic.
 */

import type {
  CreateSecretResponse,
  SecretResponse,
} from '../../../shared/types/api.js';

/**
 * API error with HTTP status and response body.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    super(`API error ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

/**
 * Create a new secret on the server.
 *
 * Sends the pre-encrypted ciphertext blob. The server never sees plaintext.
 */
export async function createSecret(
  ciphertext: string,
  expiresIn: '1h' | '24h' | '7d' | '30d',
): Promise<CreateSecretResponse> {
  const res = await fetch('/api/secrets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ciphertext, expiresIn }),
  });

  if (!res.ok) {
    throw new ApiError(res.status, await res.json());
  }

  return res.json() as Promise<CreateSecretResponse>;
}

/**
 * Retrieve and atomically destroy a secret.
 *
 * This is a one-shot operation -- the secret is deleted server-side
 * after this call succeeds. Never cache the response.
 */
export async function getSecret(id: string): Promise<SecretResponse> {
  const res = await fetch(`/api/secrets/${id}`);

  if (!res.ok) {
    throw new ApiError(res.status, await res.json());
  }

  return res.json() as Promise<SecretResponse>;
}

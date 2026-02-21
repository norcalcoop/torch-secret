/**
 * Typed fetch wrapper for the SecureShare secrets API.
 *
 * IMPORTANT: GET requests are never cached -- each call atomically
 * destroys the secret on the server. There is no retry or cache logic.
 */

import type {
  CreateSecretResponse,
  SecretResponse,
  MetaResponse,
  VerifySecretResponse,
  DashboardListResponse,
  DashboardDeleteResponse,
} from '../../../shared/types/api.js';

/**
 * API error with HTTP status and response body.
 *
 * For 429 responses, rateLimitReset carries the Unix timestamp (seconds)
 * from the RateLimit-Reset header so the client can display a countdown
 * on upsell prompts (CONV-06).
 */
export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  readonly rateLimitReset?: number; // Unix timestamp (seconds) from RateLimit-Reset header

  constructor(status: number, body: unknown, rateLimitReset?: number) {
    super(`API error ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
    this.rateLimitReset = rateLimitReset;
  }
}

/**
 * Create a new secret on the server.
 *
 * Sends the pre-encrypted ciphertext blob. The server never sees plaintext.
 * Authenticated users may include an optional label (max 100 chars) for
 * dashboard display and opt into per-secret email notification.
 *
 * On 429 Too Many Requests, throws ApiError with rateLimitReset set from
 * the RateLimit-Reset header (Unix timestamp seconds) for countdown display.
 */
export async function createSecret(
  ciphertext: string,
  expiresIn: '1h' | '24h' | '7d' | '30d',
  password?: string,
  label?: string,
  notify?: boolean,
): Promise<CreateSecretResponse> {
  const res = await fetch('/api/secrets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ciphertext,
      expiresIn,
      ...(password ? { password } : {}),
      ...(label ? { label } : {}),
      ...(notify !== undefined ? { notify } : {}),
    }),
  });

  if (!res.ok) {
    const body = (await res.json()) as unknown;
    if (res.status === 429) {
      const resetHeader = res.headers.get('RateLimit-Reset');
      const rateLimitReset = resetHeader ? parseInt(resetHeader, 10) : undefined;
      throw new ApiError(res.status, body, rateLimitReset);
    }
    throw new ApiError(res.status, body);
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

/**
 * Fetch secret metadata without consuming the secret.
 *
 * Returns whether a password is required and remaining attempts.
 * Does NOT trigger the atomic read-and-destroy.
 */
export async function getSecretMeta(id: string): Promise<MetaResponse> {
  const res = await fetch(`/api/secrets/${id}/meta`);

  if (!res.ok) {
    throw new ApiError(res.status, await res.json());
  }

  return res.json() as Promise<MetaResponse>;
}

/**
 * Submit a password for a password-protected secret.
 *
 * On success, returns the ciphertext (atomically destroyed server-side).
 * On wrong password, throws ApiError with status 403 and attemptsRemaining in body.
 */
export async function verifySecretPassword(
  id: string,
  password: string,
): Promise<VerifySecretResponse> {
  const res = await fetch(`/api/secrets/${id}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });

  if (!res.ok) {
    throw new ApiError(res.status, await res.json());
  }

  return res.json() as Promise<VerifySecretResponse>;
}

/**
 * Fetch the authenticated user's secret history (metadata only).
 * Requires an active session cookie — throws ApiError 401 if unauthenticated.
 */
export async function fetchDashboardSecrets(): Promise<DashboardListResponse> {
  const res = await fetch('/api/dashboard/secrets');
  if (!res.ok) {
    throw new ApiError(res.status, await res.json());
  }
  return res.json() as Promise<DashboardListResponse>;
}

/**
 * Soft-delete an Active secret from the dashboard.
 * Returns success true, or throws ApiError 404 if not found / wrong owner / non-active.
 */
export async function deleteDashboardSecret(id: string): Promise<DashboardDeleteResponse> {
  const res = await fetch(`/api/dashboard/secrets/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    throw new ApiError(res.status, await res.json());
  }
  return res.json() as Promise<DashboardDeleteResponse>;
}

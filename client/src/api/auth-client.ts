import { createAuthClient } from 'better-auth/client';

/**
 * Shape of the getSession().data response from Better Auth.
 *
 * This is NOT the Better Auth DB Session row type (id, userId, token, expiresAt).
 * It represents the client-facing session envelope returned by authClient.getSession().
 *
 * Used exclusively by isSession() for type narrowing.
 */
export interface Session {
  session: object;
  user: {
    id: string;
    email: string;
    name?: string | null;
  };
}

/**
 * Canonical type guard for Better Auth getSession() return values.
 *
 * Checks the strictest shape required by any caller (dashboard.ts: user.id + user.email).
 * Returns a type predicate so TypeScript narrows value to Session in caller scope.
 *
 * Usage:
 *   const result = await authClient.getSession();
 *   const data = result.data as unknown;
 *   if (isSession(data)) {
 *     console.log(data.user.id); // TypeScript knows this is string
 *   }
 */
export function isSession(value: unknown): value is Session {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (typeof obj['session'] !== 'object' || obj['session'] === null) return false;
  if (typeof obj['user'] !== 'object' || obj['user'] === null) return false;
  const user = obj['user'] as Record<string, unknown>;
  return typeof user['id'] === 'string' && typeof user['email'] === 'string';
}

/**
 * Better Auth browser client.
 *
 * baseURL is intentionally omitted — the Vite dev server proxies /api to :3000,
 * and in production the client and server share the same origin.
 * Better Auth infers the base URL from window.location in the browser.
 *
 * Usage:
 *   import { authClient } from './api/auth-client.js';
 *   const { data: session } = await authClient.getSession();
 */
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;

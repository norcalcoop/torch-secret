import { createAuthClient } from 'better-auth/client';

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

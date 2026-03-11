import { z } from 'zod';

/**
 * Zod schema for creating a secret.
 * The ciphertext is a base64-encoded blob from the client crypto module.
 * The server stores it as-is -- never decrypts or inspects it.
 */
export const CreateSecretSchema = z.object({
  /** Base64-encoded ciphertext (IV + ciphertext + auth tag) */
  ciphertext: z.string().min(1).max(100_000), // 100KB max (SR-014)
  /** How long until the secret expires */
  expiresIn: z.enum(['1h', '24h', '7d', '30d']),
  /** Optional password for password-protected secrets (Phase 5) */
  password: z.string().min(1).max(128).optional(),
  /** Optional label for dashboard display (authenticated users only, max 100 chars) */
  label: z.string().max(100).optional(),
  /** Per-secret email notification opt-in. Phase 26 sends the actual notification. */
  notify: z.boolean().optional(),
  /** Explicit protection type for server-side tier enforcement (Phase 34.1) */
  protection_type: z.enum(['none', 'passphrase', 'password']).optional().default('none'),
});

export type CreateSecretRequest = z.infer<typeof CreateSecretSchema>;

/**
 * Zod schema for validating secret ID URL parameters.
 * nanoid generates 21-char URL-safe IDs.
 */
export const SecretIdParamSchema = z.object({
  id: z.string().length(21),
});

export type SecretIdParam = z.infer<typeof SecretIdParamSchema>;

/** Response returned after creating a secret */
export interface CreateSecretResponse {
  id: string;
  expiresAt: string;
}

/** Response returned when retrieving a secret (atomic read-and-destroy) */
export interface SecretResponse {
  ciphertext: string;
  expiresAt: string;
}

/** Standard error response shape (identical for all secret-unavailable cases) */
export interface ErrorResponse {
  error: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Phase 5: Password Protection
// ---------------------------------------------------------------------------

/**
 * Zod schema for verifying a password-protected secret.
 * Used by POST /api/secrets/:id/verify.
 */
export const VerifySecretSchema = z.object({
  password: z.string().min(1).max(128),
});

export type VerifySecretRequest = z.infer<typeof VerifySecretSchema>;

/** Response from GET /api/secrets/:id/meta (non-destructive metadata check) */
export interface MetaResponse {
  requiresPassword: boolean;
  passwordAttemptsRemaining: number;
}

/** Response from POST /api/secrets/:id/verify on successful password verification */
export interface VerifySecretResponse {
  ciphertext: string;
  expiresAt: string;
}

/** Error response from POST /api/secrets/:id/verify on wrong password */
export interface VerifyErrorResponse {
  error: 'wrong_password';
  attemptsRemaining: number;
}

// ---------------------------------------------------------------------------
// Phase 23: Dashboard
// ---------------------------------------------------------------------------

/** A single secret row returned by GET /api/dashboard/secrets (metadata only — never ciphertext) */
export interface DashboardSecretItem {
  id: string;
  label: string | null;
  createdAt: string; // ISO string
  expiresAt: string; // ISO string
  status: 'active' | 'viewed' | 'expired' | 'deleted';
  notify: boolean;
  viewedAt: string | null; // ISO string or null
}

/** Response from GET /api/dashboard/secrets */
export interface DashboardListResponse {
  secrets: DashboardSecretItem[];
}

/** Response from DELETE /api/dashboard/secrets/:id on success */
export interface DashboardDeleteResponse {
  success: true;
}

// ---------------------------------------------------------------------------
// Phase 34: Stripe Pro Billing
// ---------------------------------------------------------------------------

/** Response from GET /api/me — includes subscription tier and Stripe customer ID (Phase 34, 68) */
export interface MeResponse {
  user: {
    id: string;
    email: string;
    name: string | null;
    emailVerified: boolean;
    image: string | null;
    createdAt: string; // ISO string
    subscriptionTier: 'free' | 'pro';
    stripeCustomerId: string | null;
  };
}

/** Response from GET /api/billing/checkout */
export interface BillingCheckoutResponse {
  url: string;
}

/** Response from GET /api/billing/verify-checkout */
export interface VerifyCheckoutResponse {
  status: 'active';
  tier: 'pro';
}

/** Response from POST /api/billing/portal */
export interface BillingPortalResponse {
  url: string;
}

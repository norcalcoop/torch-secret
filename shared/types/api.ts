import { z } from 'zod';

/**
 * Zod schema for creating a secret.
 * The ciphertext is a base64-encoded blob from the client crypto module.
 * The server stores it as-is -- never decrypts or inspects it.
 */
export const CreateSecretSchema = z.object({
  /** Base64-encoded ciphertext (IV + ciphertext + auth tag) */
  ciphertext: z.string().min(1).max(200_000),
  /** How long until the secret expires */
  expiresIn: z.enum(['1h', '24h', '7d', '30d']),
  /** Optional password for password-protected secrets (Phase 5) */
  password: z.string().min(1).max(128).optional(),
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

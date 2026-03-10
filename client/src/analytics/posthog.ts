/**
 * Torch Secret PostHog Analytics Module
 *
 * Zero-Knowledge Invariant (enforced by module design):
 * - Secret events (secret_created, secret_viewed) must NEVER contain userId or any
 *   user-identifying property. Only anonymous, non-identifying metadata is allowed.
 * - User events (user_registered, user_logged_in, identifyUser) must NEVER contain
 *   secretId or any secret-identifying property.
 * - Combining userId + secretId in any event payload violates the zero-knowledge
 *   security model by allowing correlation of which user created which secret.
 * - The before_send hook strips URL fragments (#...) from ALL events before
 *   transmission. Reveal-page URLs contain AES-256-GCM encryption keys in their
 *   fragments — these must NEVER reach PostHog servers.
 *
 * See: INVARIANTS.md — Invariant 1: Zero-Knowledge User-Secret Separation
 */

import posthog, { type CaptureResult } from 'posthog-js';

let _initialized = false;

function isInitialized(): boolean {
  return _initialized;
}

/**
 * Strip the URL fragment (#...) from a URL string.
 *
 * Reveal-page URLs take the form /secret/:id#base64key where the fragment is the
 * AES-256-GCM encryption key. This must never reach PostHog servers.
 *
 * Returns null if the input is not a string.
 */
function stripFragment(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    url.hash = '';
    return url.toString();
  } catch {
    // Relative URLs or non-URL strings: strip fragment with regex
    return value.replace(/#.*$/, '');
  }
}

/**
 * before_send hook: strips URL fragments from $current_url, $referrer, and
 * $initial_referrer before any event is transmitted to PostHog.
 *
 * This is the MANDATORY guard against AES-256-GCM key leakage. The hook fires
 * on every event — including pageviews and custom captures — ensuring the
 * encryption key embedded in reveal-page URL fragments never leaves the browser.
 */
function sanitizeEventUrls(event: CaptureResult | null): CaptureResult | null {
  if (!event) return null;

  if (event.properties['$current_url']) {
    event.properties['$current_url'] = stripFragment(event.properties['$current_url']);
  }
  if (event.properties['$referrer']) {
    event.properties['$referrer'] = stripFragment(event.properties['$referrer']);
  }
  if (event.properties['$initial_referrer']) {
    event.properties['$initial_referrer'] = stripFragment(event.properties['$initial_referrer']);
  }

  return event;
}

/**
 * Initialize PostHog analytics.
 *
 * No-op if VITE_POSTHOG_KEY is not set — safe to call in dev/test environments
 * without a PostHog account. Analytics initializes silently only in production
 * when the key is present.
 *
 * Privacy-safe defaults:
 * - autocapture: false — no passive DOM event capture (plaintext textarea would be captured)
 * - disable_session_recording: true — session recording is explicitly out of scope
 * - capture_pageview: false — manual SPA pageview tracking via capturePageview()
 * - capture_pageleave: false — disable pageleave (requires capture_pageview)
 * - before_send: sanitizeEventUrls — mandatory fragment stripping on every event
 */
export function initAnalytics(): void {
  const key = import.meta.env.VITE_POSTHOG_KEY;
  const host = import.meta.env.VITE_POSTHOG_HOST ?? 'https://us.i.posthog.com';

  if (!key) return;

  posthog.init(key, {
    api_host: host,
    autocapture: false,
    disable_session_recording: true,
    capture_pageview: false,
    capture_pageleave: false,
    before_send: sanitizeEventUrls,
  });

  _initialized = true;
}

/**
 * Capture a pageview event for the current SPA route.
 *
 * Call this in router.ts after each route change. The before_send hook will
 * strip any URL fragment from $current_url before transmission.
 */
export function capturePageview(): void {
  if (!isInitialized()) return;
  posthog.capture('$pageview', { $current_url: window.location.href });
}

/**
 * Capture a secret_created event after a secret is successfully uploaded.
 *
 * ZERO-KNOWLEDGE INVARIANT: no userId, no secretId, no ciphertext.
 * Only anonymous, non-identifying metadata about the secret configuration.
 *
 * protectionType values:
 * - 'none'       → No protection tab selected
 * - 'passphrase' → EFF diceware passphrase tab
 * - 'generated'  → Generate password tab (1Password-style)
 * - 'password'   → Custom password tab (user-typed)
 */
export function captureSecretCreated(
  expiresIn: string,
  hasPassword: boolean,
  protectionType: 'none' | 'passphrase' | 'password' | 'generated',
): void {
  if (!isInitialized()) return;
  posthog.capture('secret_created', {
    expires_in: expiresIn,
    has_password: hasPassword,
    protection_type: protectionType,
  });
}

/**
 * Capture a secret_viewed event after a secret is successfully decrypted and displayed.
 *
 * ZERO-KNOWLEDGE INVARIANT: no userId, no secretId.
 */
export function captureSecretViewed(): void {
  if (!isInitialized()) return;
  posthog.capture('secret_viewed');
}

/**
 * Capture a user_registered event after a new account is successfully created.
 *
 * ZERO-KNOWLEDGE INVARIANT: no secretId in this event.
 */
export function captureUserRegistered(method: 'email' | 'google' | 'github'): void {
  if (!isInitialized()) return;
  posthog.capture('user_registered', { method });
}

/**
 * Capture a user_logged_in event after a user successfully authenticates.
 *
 * ZERO-KNOWLEDGE INVARIANT: no secretId in this event.
 */
export function captureUserLoggedIn(method: 'email' | 'google' | 'github'): void {
  if (!isInitialized()) return;
  posthog.capture('user_logged_in', { method });
}

/**
 * Identify the current PostHog session with a known user ID.
 *
 * Call this after a successful login or registration. Links the anonymous
 * pre-login session to the authenticated user for funnel analysis.
 *
 * ZERO-KNOWLEDGE INVARIANT: pass userId only — never email, display name,
 * secretId, or any other PII. PostHog session attribution handles funnel
 * correlation without explicit userId in event payloads.
 *
 * Optional person properties (safe, non-identifying):
 * - tier: 'free' | 'pro' — subscription tier for cohort analysis
 * - registeredAt: ISO string — account age for retention analysis
 */
export function identifyUser(userId: string, tier?: 'free' | 'pro', registeredAt?: string): void {
  if (!isInitialized()) return;
  posthog.identify(userId);
  if (tier !== undefined || registeredAt !== undefined) {
    const props: Record<string, string> = {};
    if (tier !== undefined) props['tier'] = tier;
    if (registeredAt !== undefined) props['registered_at'] = registeredAt;
    posthog.setPersonProperties(props);
  }
}

/**
 * Reset the PostHog identity on logout.
 *
 * Generates a new anonymous distinct ID for the next session, preventing
 * post-logout activity from being attributed to the previously identified user.
 */
export function resetAnalyticsIdentity(): void {
  if (!isInitialized()) return;
  posthog.reset();
}

/**
 * Capture a conversion_prompt_shown event when an upsell prompt is displayed.
 *
 * ZERO-KNOWLEDGE INVARIANT: no userId, no secretId.
 * prompt_number: 1 = first creation prompt, 3 = third creation prompt,
 *   'rate_limit' = shown when anonymous user hits the 429 limit.
 */
export function captureConversionPromptShown(promptNumber: 1 | 3 | 'rate_limit'): void {
  if (!isInitialized()) return;
  posthog.capture('conversion_prompt_shown', { prompt_number: promptNumber });
}

/**
 * Capture a conversion_prompt_clicked event when the 'Sign up — it's free' CTA is clicked.
 *
 * ZERO-KNOWLEDGE INVARIANT: no userId, no secretId.
 */
export function captureConversionPromptClicked(promptNumber: 1 | 3 | 'rate_limit'): void {
  if (!isInitialized()) return;
  posthog.capture('conversion_prompt_clicked', { prompt_number: promptNumber });
}

/**
 * Capture checkout_initiated when the upgrade CTA is clicked and Stripe Checkout begins.
 *
 * ZERO-KNOWLEDGE INVARIANT: no secretId, no userId in event payload.
 * source: 'dashboard' for dashboard upgrade button; 'pricing_page' / 'conversion_prompt'
 * reserved for future direct-to-Stripe CTAs.
 */
export function captureCheckoutInitiated(
  source: 'dashboard' | 'pricing_page' | 'conversion_prompt',
): void {
  if (!isInitialized()) return;
  posthog.capture('checkout_initiated', { source });
}

/**
 * Capture subscription_activated after Stripe Checkout success is verified.
 * Immediately updates the PostHog person profile tier to 'pro'.
 *
 * ZERO-KNOWLEDGE INVARIANT: no secretId in this event.
 * Must be called inside the isUpgraded + checkoutSessionId guard in dashboard.ts,
 * on the success branch of verifyCheckoutSession() — never on every dashboard load.
 */
export function captureSubscriptionActivated(): void {
  if (!isInitialized()) return;
  posthog.capture('subscription_activated');
  posthog.setPersonProperties({ tier: 'pro' });
}

/**
 * Capture dashboard_viewed on each dashboard page load.
 * Identifies engaged power users who return to check their secret history.
 *
 * ZERO-KNOWLEDGE INVARIANT: no secretId in this event.
 */
export function captureDashboardViewed(): void {
  if (!isInitialized()) return;
  posthog.capture('dashboard_viewed');
}

/**
 * Capture a retro theme activation event.
 * ZK-safe: only captures themeId (e.g. 'mario') — never userId+secretId together (INVARIANTS.md).
 *
 * ZERO-KNOWLEDGE INVARIANT: no userId, no secretId.
 * Safe props: { theme_id: string } — anonymous-safe, no PII.
 */
export function captureRetroThemeActivated(themeId: string): void {
  if (!isInitialized()) return;
  posthog.capture('retro_theme_activated', { theme_id: themeId });
}

/**
 * Unit tests for dashboard.ts pure functions.
 *
 * This file targets functions that will be exported from dashboard.ts in Plan 05.
 * Tests are intentionally RED until roundToNearestExpiry is exported.
 *
 * roundToNearestExpiry rounding buckets (from RESEARCH.md):
 *   hours <= 2   → '1h'
 *   hours <= 48  → '24h'
 *   hours <= 168 → '7d'
 *   else         → '30d'
 */

import { describe, it, expect } from 'vitest';

// roundToNearestExpiry is not yet exported from dashboard.ts — tests will be RED (Plan 05 makes them GREEN).

import { roundToNearestExpiry } from './dashboard.js';

describe('roundToNearestExpiry', () => {
  it('rounds exactly 1h → "1h"', () => {
    expect(roundToNearestExpiry('2026-01-01T00:00:00Z', '2026-01-01T01:00:00Z')).toBe('1h');
  });

  it('rounds 2h (rounds to next bucket) → "24h"', () => {
    expect(roundToNearestExpiry('2026-01-01T00:00:00Z', '2026-01-01T02:00:00Z')).toBe('24h');
  });

  it('rounds exactly 24h → "24h"', () => {
    expect(roundToNearestExpiry('2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z')).toBe('24h');
  });

  it('rounds 48h (rounds to next bucket) → "7d"', () => {
    expect(roundToNearestExpiry('2026-01-01T00:00:00Z', '2026-01-03T00:00:00Z')).toBe('7d');
  });

  it('rounds exactly 7d → "7d"', () => {
    expect(roundToNearestExpiry('2026-01-01T00:00:00Z', '2026-01-08T00:00:00Z')).toBe('7d');
  });

  it('rounds 8d (>7d rounds to 30d) → "30d"', () => {
    expect(roundToNearestExpiry('2026-01-01T00:00:00Z', '2026-01-09T00:00:00Z')).toBe('30d');
  });

  it('rounds exactly 30d → "30d"', () => {
    expect(roundToNearestExpiry('2026-01-01T00:00:00Z', '2026-01-31T00:00:00Z')).toBe('30d');
  });
});

// ---------------------------------------------------------------------------
// Load More button visibility (API-02)
// renderSecretsTable will be exported in Plan 03 — these stubs are RED until then.
// ---------------------------------------------------------------------------
describe('Load More button visibility (API-02)', () => {
  it('Load More button is hidden when nextCursor is null', async () => {
    // Will be implemented when renderSecretsTable is exported (Plan 03)
    // For now: assert that renderSecretsTable export exists
    const mod = await import('./dashboard.js');
    expect(typeof (mod as Record<string, unknown>)['renderSecretsTable']).toBe('function');
  });

  it('Load More button is visible when nextCursor is non-null', async () => {
    // Will be implemented when renderSecretsTable is exported (Plan 03)
    const mod = await import('./dashboard.js');
    expect(typeof (mod as Record<string, unknown>)['renderSecretsTable']).toBe('function');
  });
});

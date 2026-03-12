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

import { describe, it, expect, vi, afterEach } from 'vitest';
import { roundToNearestExpiry, renderSecretsTable } from './dashboard.js';
import type { DashboardSecretItem } from '../../../shared/types/api.js';

// Mock the API client for dashboard rendering tests
vi.mock('../api/client.js', () => ({
  fetchDashboardSecrets: vi.fn(),
  deleteDashboardSecret: vi.fn(),
}));

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
// ---------------------------------------------------------------------------

function makeFakeSecrets(count: number): DashboardSecretItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `secret-id-${i.toString().padStart(3, '0')}`,
    label: `Secret ${i.toString()}`,
    createdAt: new Date(Date.now() - i * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    status: 'active' as const,
    notify: false,
    viewedAt: null,
  }));
}

describe('Load More button visibility (API-02)', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('Load More button is hidden when nextCursor is null', () => {
    const container = document.createElement('div');
    renderSecretsTable(container, makeFakeSecrets(5), null);
    // Button must exist in DOM but be hidden
    const buttons = Array.from(container.querySelectorAll('button')).filter((b) =>
      b.textContent?.toLowerCase().includes('load more'),
    );
    expect(buttons.length).toBe(1);
    expect(buttons[0].style.display).toBe('none');
  });

  it('Load More button is visible when nextCursor is non-null', () => {
    const container = document.createElement('div');
    renderSecretsTable(container, makeFakeSecrets(20), 'cursor-abc123');
    const buttons = Array.from(container.querySelectorAll('button')).filter((b) =>
      b.textContent?.toLowerCase().includes('load more'),
    );
    expect(buttons.length).toBe(1);
    expect(buttons[0].style.display).not.toBe('none');
  });
});

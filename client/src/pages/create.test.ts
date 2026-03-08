import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// getExpirySuggestion is a pure time-dependent function; test branches with fake system time
import { getExpirySuggestion } from './create.js';

describe('getExpirySuggestion — time-of-day branches', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Friday 15:30 → 7 days (recipient may not check until Monday)', () => {
    // 2025-03-07 is a Friday
    vi.setSystemTime(new Date('2025-03-07T15:30:00'));
    const result = getExpirySuggestion();
    expect(result.value).toBe('7d');
    expect(result.reason).toContain('Monday');
  });

  it('Tuesday 10:00 → 1 hour (business hours, recipient available)', () => {
    // 2025-03-04 is a Tuesday
    vi.setSystemTime(new Date('2025-03-04T10:00:00'));
    const result = getExpirySuggestion();
    expect(result.value).toBe('1h');
    expect(result.reason).toContain('available now');
  });

  it('Monday 20:00 → 24 hours (evening branch)', () => {
    // 2025-03-03 is a Monday
    vi.setSystemTime(new Date('2025-03-03T20:00:00'));
    const result = getExpirySuggestion();
    expect(result.value).toBe('24h');
  });

  it('Saturday 14:00 → 24 hours (weekend branch)', () => {
    // 2025-03-08 is a Saturday
    vi.setSystemTime(new Date('2025-03-08T14:00:00'));
    const result = getExpirySuggestion();
    expect(result.value).toBe('24h');
  });

  it('Monday 08:00 → 24 hours (all-other-times default)', () => {
    // Before business hours on a weekday — falls through to default
    vi.setSystemTime(new Date('2025-03-03T08:00:00'));
    const result = getExpirySuggestion();
    expect(result.value).toBe('24h');
  });
});

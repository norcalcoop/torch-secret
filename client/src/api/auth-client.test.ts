/**
 * Tests for the canonical isSession type guard (QUAL-02).
 *
 * Wave 0: Tests FAIL RED until auth-client.ts exports isSession in Wave 1.
 * Expected failure: "isSession is not a function" or import error —
 * the named export does not exist yet.
 */
import { describe, test, expect } from 'vitest';
import { isSession } from './auth-client.js';

describe('QUAL-02 — isSession canonical type guard', () => {
  test('returns false for null', () => {
    expect(isSession(null)).toBe(false);
  });

  test('returns false for undefined', () => {
    expect(isSession(undefined)).toBe(false);
  });

  test('returns false for empty object', () => {
    expect(isSession({})).toBe(false);
  });

  test('returns false when user is missing id', () => {
    expect(isSession({ session: {}, user: { email: 'a@b.com' } })).toBe(false);
  });

  test('returns false when user is missing email', () => {
    expect(isSession({ session: {}, user: { id: '123' } })).toBe(false);
  });

  test('returns false when session is null', () => {
    expect(isSession({ session: null, user: { id: '123', email: 'a@b.com' } })).toBe(false);
  });

  test('returns true for valid session shape', () => {
    const value = {
      session: { id: 'sess-1', token: 'tok' },
      user: { id: 'u-1', email: 'user@example.com', name: 'Test User' },
    };
    expect(isSession(value)).toBe(true);
  });

  test('type predicate narrows to Session after guard passes', () => {
    const value: unknown = { session: {}, user: { id: 'u-1', email: 'user@example.com' } };
    if (isSession(value)) {
      // TypeScript should narrow value to Session here — accessing user.id and user.email is safe
      expect(typeof value.user.id).toBe('string');
      expect(typeof value.user.email).toBe('string');
    } else {
      throw new Error('Expected isSession to return true for valid shape');
    }
  });
});

import { describe, it, expect, vi } from 'vitest';

vi.mock('./icons.js', () => ({
  createIcon: vi.fn(() => document.createElement('span')),
}));

import { createExpirationSelect } from './expiration-select.js';

describe('createExpirationSelect — suggestion hint text', () => {
  it('renders hint text for authenticated user when suggestion provided', () => {
    const result = createExpirationSelect(true, false, {
      value: '7d',
      reason: 'recipient may not check until Monday',
    });
    const hint = result.element.querySelector('p');
    expect(hint?.textContent).toContain('7 days');
    expect(hint?.textContent).toContain('recipient may not check until Monday');
  });

  it('no hint rendered for authenticated user when suggestion is undefined', () => {
    const result = createExpirationSelect(true, false);
    const paragraphs = result.element.querySelectorAll('p');
    // No hint paragraph should exist
    const hintP = Array.from(paragraphs).find((p) => p.textContent?.includes('Suggested:'));
    expect(hintP).toBeUndefined();
  });

  it('no hint rendered for anonymous user even when suggestion provided', () => {
    const result = createExpirationSelect(false, false, {
      value: '1h',
      reason: 'recipient is likely available now',
    });
    const hintP = result.element.querySelector('p');
    // Anonymous mode shows upsell note, NOT a suggestion hint
    expect(hintP?.textContent).not.toContain('Suggested:');
  });

  it('getValue() still works when suggestion wrapper is present', () => {
    const result = createExpirationSelect(true, false, {
      value: '24h',
      reason: 'default',
    });
    expect(result.getValue()).toBe('24h'); // default selection
  });
});

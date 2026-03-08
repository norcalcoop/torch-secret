import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock clipboard API (not available in happy-dom)
const mockWriteText = vi.fn().mockResolvedValue(undefined);
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: mockWriteText },
  writable: true,
  configurable: true,
});

// Mock toast (fire-and-forget side effect)
vi.mock('./toast.js', () => ({ showToast: vi.fn() }));
// Mock icons (DOM-only side effect)
// Use createElementNS('svg') to match real icon output — a <span> mock causes
// span:last-child queries to find the icon instead of the labelSpan.
vi.mock('./icons.js', () => ({
  createIcon: vi.fn(() => document.createElementNS('http://www.w3.org/2000/svg', 'svg')),
}));

import { createCopyButton } from './copy-button.js';

describe('createCopyButton — autoClearMs countdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockWriteText.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('button label shows countdown after copy when autoClearMs is set', async () => {
    const btn = createCopyButton(() => 'secret', 'Copy Link', { autoClearMs: 60_000 });
    btn.click();
    await Promise.resolve(); // flush microtask
    vi.advanceTimersByTime(0);
    const labelSpan = btn.querySelector('span:last-child');
    expect(labelSpan?.textContent).toMatch(/clears in 60s/i);
  });

  it('re-copy resets countdown to 60s', async () => {
    const btn = createCopyButton(() => 'secret', 'Copy Link', { autoClearMs: 60_000 });
    btn.click();
    await Promise.resolve();
    vi.advanceTimersByTime(15_000); // advance 15s
    btn.click(); // re-copy
    await Promise.resolve();
    vi.advanceTimersByTime(0);
    const labelSpan = btn.querySelector('span:last-child');
    expect(labelSpan?.textContent).toMatch(/clears in 60s/i);
  });

  it('label resets to original after countdown completes', async () => {
    const btn = createCopyButton(() => 'secret', 'Copy Link', { autoClearMs: 3_000 });
    btn.click();
    await Promise.resolve();
    vi.advanceTimersByTime(3_000);
    await Promise.resolve();
    const labelSpan = btn.querySelector('span:last-child');
    expect(labelSpan?.textContent).toBe('Copy Link');
  });

  it('clipboard is cleared with empty string after countdown', async () => {
    const btn = createCopyButton(() => 'secret', 'Copy Link', { autoClearMs: 3_000 });
    btn.click();
    await Promise.resolve();
    mockWriteText.mockClear();
    vi.advanceTimersByTime(3_000);
    await Promise.resolve();
    expect(mockWriteText).toHaveBeenCalledWith('');
  });

  it('no countdown when autoClearMs is omitted', async () => {
    const btn = createCopyButton(() => 'secret', 'Copy Link');
    btn.click();
    await Promise.resolve();
    const labelSpan = btn.querySelector('span:last-child');
    // Label should show original (icon swap happens via swapToCheckIcon, label unchanged)
    expect(labelSpan?.textContent).toBe('Copy Link');
  });
});

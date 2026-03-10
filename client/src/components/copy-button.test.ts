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

describe('createCopyButton — focus-deferred clear', () => {
  let mockHasFocus: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockWriteText.mockClear();
    mockHasFocus = vi.spyOn(document, 'hasFocus').mockReturnValue(true);
  });

  afterEach(() => {
    mockHasFocus.mockRestore();
    vi.useRealTimers();
  });

  it('defers clear to focus event when document is not focused at countdown expiry', async () => {
    mockHasFocus.mockReturnValue(false);
    const btn = createCopyButton(() => 'secret', 'Copy Link', { autoClearMs: 3_000 });
    btn.click();
    await Promise.resolve(); // flush microtask
    mockWriteText.mockClear();
    vi.advanceTimersByTime(3_000);
    await Promise.resolve();
    expect(mockWriteText).not.toHaveBeenCalled(); // deferred, not immediate
    window.dispatchEvent(new Event('focus'));
    await Promise.resolve();
    expect(mockWriteText).toHaveBeenCalledWith(''); // fires on focus return
  });

  it('cleans up pending focus listener on re-copy', async () => {
    mockHasFocus.mockReturnValue(false);
    const btn = createCopyButton(() => 'secret', 'Copy Link', { autoClearMs: 3_000 });
    btn.click();
    await Promise.resolve();
    vi.advanceTimersByTime(3_000); // countdown expires with no focus — deferred handler registered
    await Promise.resolve();
    // Tab becomes focused again; user re-copies
    mockHasFocus.mockReturnValue(true);
    btn.click(); // re-copy resets everything
    await Promise.resolve();
    mockWriteText.mockClear();
    // dispatch focus — should NOT trigger the old stale handler
    window.dispatchEvent(new Event('focus'));
    await Promise.resolve();
    // writeText('') must NOT have been called by the old handler
    // (the new countdown is running; it will clear when its time comes)
    expect(mockWriteText).not.toHaveBeenCalledWith('');
  });
});

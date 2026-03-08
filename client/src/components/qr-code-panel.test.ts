import { describe, it, expect, vi } from 'vitest';

// Mock qrcode: return a minimal valid SVG string
vi.mock('qrcode', () => ({
  default: {
    toString: vi
      .fn()
      .mockResolvedValue(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect/></svg>',
      ),
  },
}));

vi.mock('./icons.js', () => ({
  createIcon: vi.fn(() => document.createElement('span')),
}));

import { createQrCodePanel } from './qr-code-panel.js';

describe('createQrCodePanel — toggle show/hide', () => {
  it('panel is hidden by default', () => {
    const { panel } = createQrCodePanel('https://torchsecret.com/s/abc123#key');
    expect(panel.hidden).toBe(true);
  });

  it('clicking toggle button shows panel', async () => {
    const { toggleButton, panel } = createQrCodePanel('https://torchsecret.com/s/abc123#key');
    toggleButton.click();
    await Promise.resolve(); // flush async QR render
    expect(panel.hidden).toBe(false);
  });

  it('clicking toggle button twice hides panel again', async () => {
    const { toggleButton, panel } = createQrCodePanel('https://torchsecret.com/s/abc123#key');
    toggleButton.click();
    await Promise.resolve();
    toggleButton.click();
    expect(panel.hidden).toBe(true);
  });

  it('toggle button has accessible label', () => {
    const { toggleButton } = createQrCodePanel('https://torchsecret.com/s/abc123#key');
    const label = toggleButton.getAttribute('aria-label') ?? toggleButton.textContent ?? '';
    expect(label.toLowerCase()).toContain('qr');
  });
});

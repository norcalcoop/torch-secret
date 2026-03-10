import { describe, it, expect, vi } from 'vitest';

vi.mock('./icons.js', () => ({
  createIcon: vi.fn(() => document.createElement('span')),
}));

import { createMailtoButton } from './mailto-button.js';

describe('createMailtoButton — href construction', () => {
  const testUrl = 'https://torchsecret.com/s/abc123#mykey';

  it('renders an anchor element', () => {
    const anchor = createMailtoButton(testUrl);
    expect(anchor.tagName).toBe('A');
  });

  it('mailto href contains encoded subject "Secure message for you"', () => {
    const anchor = createMailtoButton(testUrl);
    expect(anchor.href).toContain(encodeURIComponent('Secure message for you'));
  });

  it('mailto href contains the share URL including fragment', () => {
    const anchor = createMailtoButton(testUrl);
    // The fragment (#mykey) should be encoded as %23mykey in the href body param
    expect(anchor.href).toContain(encodeURIComponent(testUrl));
  });

  it('mailto href body contains one-time view warning', () => {
    const anchor = createMailtoButton(testUrl);
    expect(anchor.href).toContain(encodeURIComponent('can only be viewed once'));
  });

  it('anchor has Mail icon', async () => {
    createMailtoButton(testUrl); // icons are mocked
    const { createIcon } = await import('./icons.js');
    expect(createIcon).toHaveBeenCalled();
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { renderPrivacyPage } from './privacy.js';

describe('privacy page — mailto link in Your Rights section (ADOC-02)', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('renders a clickable mailto link for privacy@torchsecret.com', () => {
    renderPrivacyPage(container);
    const link = container.querySelector<HTMLAnchorElement>(
      'a[href="mailto:privacy@torchsecret.com"]',
    );
    expect(link).not.toBeNull();
    expect(link?.textContent).toBe('privacy@torchsecret.com');
  });
});

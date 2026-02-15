// @vitest-environment happy-dom

import { describe, it, expect } from 'vitest';
import { createIcon, ICON_SIZES, type IconSize } from '../icons.js';
import { Shield } from 'lucide';

describe('createIcon', () => {
  it('creates SVG element with default attributes', () => {
    const svg = createIcon(Shield);

    expect(svg.tagName.toLowerCase()).toBe('svg');
    expect(svg.getAttribute('width')).toBe('24');
    expect(svg.getAttribute('height')).toBe('24');
    expect(svg.getAttribute('stroke-width')).toBe('2');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
  });

  it('applies named size variants', () => {
    const sizes: IconSize[] = ['sm', 'md', 'lg'];

    for (const size of sizes) {
      const svg = createIcon(Shield, { size });
      const expected = String(ICON_SIZES[size]);
      expect(svg.getAttribute('width')).toBe(expected);
      expect(svg.getAttribute('height')).toBe(expected);
    }
  });

  it('accepts custom numeric size', () => {
    const svg = createIcon(Shield, { size: 48 });

    expect(svg.getAttribute('width')).toBe('48');
    expect(svg.getAttribute('height')).toBe('48');
  });

  it('sets aria-label and role when ariaLabel provided', () => {
    const svg = createIcon(Shield, { ariaLabel: 'Security shield' });

    expect(svg.getAttribute('aria-label')).toBe('Security shield');
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-hidden')).toBeNull();
  });

  it('applies custom CSS classes alongside default text-icon', () => {
    const svg = createIcon(Shield, { class: 'my-custom-class' });
    const classAttr = svg.getAttribute('class') ?? '';

    expect(classAttr).toContain('text-icon');
    expect(classAttr).toContain('my-custom-class');
  });

  it('applies array of CSS classes', () => {
    const svg = createIcon(Shield, { class: ['class-a', 'class-b'] });
    const classAttr = svg.getAttribute('class') ?? '';

    expect(classAttr).toContain('text-icon');
    expect(classAttr).toContain('class-a');
    expect(classAttr).toContain('class-b');
  });

  it('respects custom strokeWidth', () => {
    const svg = createIcon(Shield, { strokeWidth: 1.5 });

    expect(svg.getAttribute('stroke-width')).toBe('1.5');
  });
});

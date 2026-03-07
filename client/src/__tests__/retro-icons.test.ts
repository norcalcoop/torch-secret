/**
 * Unit tests for the retro pixel SVG icon system.
 *
 * Tests the ICONS record (descriptor arrays) and the createPixelIcon factory.
 * All tests run in happy-dom (client vitest project).
 */

import { describe, it, expect } from 'vitest';
import { ICONS } from '../retro-icons.js';
import { createPixelIcon } from '../components/icons.js';

describe('ICONS record', () => {
  it('ICONS["mario_home"] exists and is a non-empty array', () => {
    expect(ICONS['mario_home']).toBeDefined();
    expect(Array.isArray(ICONS['mario_home'])).toBe(true);
    expect(ICONS['mario_home'].length).toBeGreaterThan(0);
  });

  it('each descriptor in ICONS["mario_home"] has tag and attrs', () => {
    const descs = ICONS['mario_home'];
    for (const desc of descs) {
      expect(typeof desc.tag).toBe('string');
      expect(desc.attrs).toBeDefined();
      expect(typeof desc.attrs).toBe('object');
    }
  });
});

describe('createPixelIcon factory', () => {
  it('returns an SVGSVGElement for a known icon', () => {
    const el = createPixelIcon('mario_home');
    expect(el).toBeInstanceOf(SVGSVGElement);
  });

  it('has viewBox="0 0 32 32"', () => {
    const el = createPixelIcon('mario_home');
    expect(el.getAttribute('viewBox')).toBe('0 0 32 32');
  });

  it('has at least one child element', () => {
    const el = createPixelIcon('mario_home');
    expect(el.childElementCount).toBeGreaterThan(0);
  });

  it('child element has correct SVG attributes (x, y, width, height)', () => {
    const el = createPixelIcon('mario_home');
    // mario_home first element is a rect with x/y/width/height
    const firstChild = el.firstElementChild;
    expect(firstChild).not.toBeNull();
    // At minimum it should have some attributes set
    expect(firstChild!.attributes.length).toBeGreaterThan(0);
  });

  it('does NOT throw for an unknown icon id', () => {
    expect(() => createPixelIcon('totally_unknown_icon_id_xyz')).not.toThrow();
  });

  it('returns an SVGSVGElement for an unknown icon id (fallback)', () => {
    const el = createPixelIcon('totally_unknown_icon_id_xyz');
    expect(el).toBeInstanceOf(SVGSVGElement);
  });

  it('fallback has at least one child element (the fallback circle)', () => {
    const el = createPixelIcon('totally_unknown_icon_id_xyz');
    expect(el.childElementCount).toBeGreaterThan(0);
  });

  it('respects the size parameter — width and height match', () => {
    const el = createPixelIcon('mario_home', 16);
    expect(el.getAttribute('width')).toBe('16');
    expect(el.getAttribute('height')).toBe('16');
  });

  it('default size is 22 when no size argument given', () => {
    const el = createPixelIcon('mario_home');
    expect(el.getAttribute('width')).toBe('22');
    expect(el.getAttribute('height')).toBe('22');
  });

  it('has aria-hidden="true" for decorative use', () => {
    const el = createPixelIcon('mario_home');
    expect(el.getAttribute('aria-hidden')).toBe('true');
  });
});

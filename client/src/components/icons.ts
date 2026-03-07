/**
 * Reusable Lucide icon utility module.
 *
 * Wraps Lucide's `createElement` API with consistent defaults for
 * size, stroke width, accessibility attributes, and color class.
 * Consumers import individual icon data (e.g. `Shield`) from 'lucide'
 * and pass it to `createIcon` -- no barrel imports of specific icons here.
 *
 * @example
 * ```typescript
 * import { Shield } from 'lucide';
 * import { createIcon } from '../components/icons.js';
 *
 * // Decorative icon (aria-hidden)
 * const icon = createIcon(Shield, { size: 'lg' });
 * container.appendChild(icon);
 *
 * // Meaningful icon (aria-label + role="img")
 * const labeled = createIcon(Shield, { ariaLabel: 'Security' });
 * container.appendChild(labeled);
 * ```
 */

import { createElement, type IconNode } from 'lucide';

/** Named size variants for consistent icon sizing across the app. */
export const ICON_SIZES = { sm: 16, md: 24, lg: 32 } as const;

/** Named size key: 'sm' (16px), 'md' (24px), or 'lg' (32px). */
export type IconSize = keyof typeof ICON_SIZES;

/** Options for {@link createIcon}. */
export interface CreateIconOptions {
  /** Named size or pixel number. Default: 'md' (24px). */
  size?: IconSize | number;
  /** SVG stroke width. Default: 2. */
  strokeWidth?: number;
  /** CSS class(es) to add alongside the default `text-icon` class. */
  class?: string | string[];
  /** If provided, sets `aria-label` and `role="img"` instead of `aria-hidden`. */
  ariaLabel?: string;
}

/**
 * Create a Lucide SVG icon element with consistent defaults.
 *
 * - Default size: 24px (md)
 * - Default stroke width: 2
 * - Default color class: `text-icon` (uses `--color-icon` token)
 * - Decorative by default (`aria-hidden="true"`); pass `ariaLabel` for meaningful icons
 *
 * @param icon - Lucide icon node data (e.g. imported `Shield` from 'lucide')
 * @param options - Size, stroke, class, and accessibility overrides
 * @returns SVG element ready for DOM insertion
 */
export function createIcon(icon: IconNode, options: CreateIconOptions = {}): SVGSVGElement {
  const { size = 'md', strokeWidth = 2, ariaLabel } = options;

  // Resolve pixel size from named variant or raw number
  const pixels = typeof size === 'number' ? size : ICON_SIZES[size];

  // Build CSS class list -- always include 'text-icon' for --color-icon token
  const userClasses = options.class;
  let classValue: string;
  if (userClasses === undefined) {
    classValue = 'text-icon';
  } else if (Array.isArray(userClasses)) {
    classValue = ['text-icon', ...userClasses].join(' ');
  } else {
    classValue = ['text-icon', userClasses].join(' ');
  }

  // Build attributes for Lucide's createElement
  const attrs: Record<string, string | number> = {
    width: pixels,
    height: pixels,
    'stroke-width': strokeWidth,
    class: classValue,
  };

  // Accessibility: meaningful icons get aria-label + role, decorative get aria-hidden
  if (ariaLabel) {
    attrs['aria-label'] = ariaLabel;
    attrs.role = 'img';
  } else {
    attrs['aria-hidden'] = 'true';
  }

  return createElement(icon, attrs) as SVGSVGElement;
}

/** Re-export IconNode type for consumer convenience. */
export type { IconNode } from 'lucide';

import { ICONS, type SvgDesc } from '../retro-icons.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Create a pixel-art SVG icon from the retro ICONS descriptor map.
 * Uses DOM API (createElementNS + setAttribute) — never innerHTML.
 * Returns a fallback filled circle for unknown icon IDs.
 *
 * @param id - Icon key from ICONS record (e.g. 'mario_home')
 * @param size - Width/height in pixels. Default: 22.
 */
export function createPixelIcon(id: string, size = 22): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 32 32');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'currentColor');
  svg.setAttribute('aria-hidden', 'true');

  const descs: SvgDesc[] = ICONS[id] ?? [{ tag: 'circle', attrs: { cx: 16, cy: 16, r: 6 } }];
  for (const desc of descs) {
    const el = document.createElementNS(SVG_NS, desc.tag);
    for (const [attr, val] of Object.entries(desc.attrs)) {
      el.setAttribute(attr, String(val));
    }
    svg.appendChild(el);
  }
  return svg;
}

/**
 * QR code toggle panel component.
 *
 * Returns a toggle button and a collapsible panel containing a QR code.
 * The QR image is rendered lazily on first expand using DOMParser + importNode
 * (never innerHTML or direct string assignment — uphold no-unsafe-DOM-assignment rule).
 *
 * QR colors are hardcoded dark-on-white (#000000/#ffffff) for scan reliability
 * across all retro themes.
 */

import QRCode from 'qrcode';
import { QrCode } from 'lucide';
import { createIcon } from './icons.js';

export interface QrCodePanelResult {
  toggleButton: HTMLButtonElement;
  panel: HTMLElement;
}

async function renderQrSvg(url: string, container: HTMLElement): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-base-to-string -- qrcode.toString() is a QR API method, not Object.prototype.toString
  const svgString = await QRCode.toString(url, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' }, // hardcoded — never use CSS variables or currentColor
  });
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svgEl = doc.documentElement;
  svgEl.setAttribute('width', '200');
  svgEl.setAttribute('height', '200');
  svgEl.setAttribute('aria-hidden', 'true');
  const imported = document.importNode(svgEl, true); // adopt into current document before appending
  container.appendChild(imported);
}

export function createQrCodePanel(url: string): QrCodePanelResult {
  // Toggle button
  const toggleButton = document.createElement('button');
  toggleButton.type = 'button';
  toggleButton.className =
    'inline-flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-lg border border-border ' +
    'text-text-primary hover:bg-surface-raised focus:ring-2 focus:ring-accent ' +
    'focus:ring-offset-2 focus:ring-offset-bg focus:outline-hidden transition-colors cursor-pointer';
  toggleButton.setAttribute('aria-label', 'Show QR code');
  toggleButton.setAttribute('aria-expanded', 'false');

  const icon = createIcon(QrCode, { size: 'sm' });
  toggleButton.appendChild(icon);
  toggleButton.appendChild(document.createTextNode('Show QR'));

  // Panel
  const panel = document.createElement('div');
  panel.hidden = true;
  panel.className = 'mt-3 p-4 rounded-lg border border-border bg-surface/80 text-center space-y-2';

  // SVG container inside panel
  const svgContainer = document.createElement('div');
  panel.appendChild(svgContainer);

  // Caption
  const caption = document.createElement('p');
  caption.textContent = 'Scan to open on your phone';
  caption.className = 'text-xs text-text-muted';
  panel.appendChild(caption);

  // Lazy render state
  let rendered = false;

  toggleButton.addEventListener('click', () => {
    const isHidden = panel.hidden;
    panel.hidden = !isHidden;
    toggleButton.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
    if (isHidden && !rendered) {
      rendered = true;
      void renderQrSvg(url, svgContainer).catch(() => {
        // Silent fail — panel is visible, just without the QR image
      });
    }
  });

  return { toggleButton, panel };
}

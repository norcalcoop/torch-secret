/**
 * Reusable terminal-style code block component.
 *
 * Renders a dark-background block with muted sage-green text,
 * a minimal header bar with filename label and copy button,
 * and a scrollable content area (max 300px height).
 *
 * Content is always set via `textContent` (never innerHTML) to
 * prevent XSS when displaying user-provided secrets.
 */

import { createCopyButton } from './copy-button.js';

/** Options for {@link createTerminalBlock}. */
export interface TerminalBlockOptions {
  /** Label shown in the header bar. Default: "secret.txt" */
  headerTitle?: string;
}

/**
 * Create a terminal-style code block with header bar and copy button.
 *
 * @param content - The text content to display
 * @param options - Optional configuration (header title)
 * @returns A styled container element
 */
export function createTerminalBlock(
  content: string,
  options: TerminalBlockOptions = {},
): HTMLElement {
  const { headerTitle = 'secret.txt' } = options;

  // Outer wrapper
  const wrapper = document.createElement('div');
  wrapper.className = 'rounded-lg border border-border overflow-hidden';

  // Header bar
  const header = document.createElement('div');
  header.className =
    'flex items-center justify-between px-3 py-2 bg-terminal-header border-b border-border';

  // Header left: filename label
  const label = document.createElement('span');
  label.className = 'text-xs text-text-muted font-mono';
  label.textContent = headerTitle;

  // Header right: compact copy button
  const copyBtn = createCopyButton(() => content, 'Copy');
  // Override styling for compact header variant
  copyBtn.className =
    'inline-flex items-center gap-1 px-2 py-1 min-h-0 text-xs rounded bg-accent text-white hover:bg-accent-hover focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg focus:outline-hidden transition-colors cursor-pointer';

  header.appendChild(label);
  header.appendChild(copyBtn);

  // Content area
  const pre = document.createElement('pre');
  pre.className =
    'p-4 bg-terminal-bg text-terminal font-mono text-sm whitespace-pre-wrap break-words max-h-[300px] overflow-y-auto';
  pre.textContent = content;

  wrapper.appendChild(header);
  wrapper.appendChild(pre);

  return wrapper;
}

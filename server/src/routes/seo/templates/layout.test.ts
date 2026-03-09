import { describe, it, expect, beforeAll } from 'vitest';
import { renderLayout } from './layout.js';
import type { LayoutOptions } from './layout.js';

const opts: LayoutOptions = {
  title: 'Test',
  canonical: 'https://torchsecret.com/vs/test',
  metaDesc: 'test',
  ogTitle: 'test',
  ogDesc: 'test',
  bodyHtml: '<p>body</p>',
  jsonLd: '',
  cspNonce: 'test-nonce',
};

let html: string;

beforeAll(() => {
  html = renderLayout(opts);
});

// SSR-TOKENS: All 3 terminal token names must appear in the :root block
describe('SSR-TOKENS: terminal design tokens in :root', () => {
  it('includes --ds-color-terminal-bg', () => {
    expect(html).toContain('--ds-color-terminal-bg');
  });
  it('includes --ds-color-terminal-text', () => {
    expect(html).toContain('--ds-color-terminal-text');
  });
  it('includes --ds-color-terminal-header', () => {
    expect(html).toContain('--ds-color-terminal-header');
  });
});

// SSR-DARK-DOT: the dark media query block must define --ds-color-dot-grid with the dark value
describe('SSR-DARK-DOT: dot-grid token in dark media query block', () => {
  it('dark @media block defines --ds-color-dot-grid with dark rgb value', () => {
    // Look for the actual CSS rule (followed immediately by whitespace+{), not the CSS comment
    // The comment inside the <style> block also contains "@media (prefers-color-scheme: dark)"
    // so we specifically match the rule form: @media (...) {
    const rulePattern = '@media (prefers-color-scheme: dark) {';
    const darkMediaStart = html.indexOf(rulePattern);
    expect(darkMediaStart).toBeGreaterThan(-1);
    // Find the outer @media block by tracking brace depth from the opening {
    const afterMedia = html.slice(darkMediaStart);
    const firstBrace = afterMedia.indexOf('{');
    let depth = 0;
    let end = firstBrace;
    for (let i = firstBrace; i < afterMedia.length; i++) {
      if (afterMedia[i] === '{') depth++;
      else if (afterMedia[i] === '}') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    const darkBlock = afterMedia.slice(0, end + 1);
    // Must contain the dark-mode definition (57 57 91), not just a reference via var()
    expect(darkBlock).toContain('--ds-color-dot-grid: rgb(57 57 91');
  });
});

// SSR-DROPDOWN: theme dropdown must use <details> with 3 data-theme buttons
describe('SSR-DROPDOWN: Light/Dark/System dropdown replaces moon-button', () => {
  it('contains id="ssr-theme-details"', () => {
    expect(html).toContain('id="ssr-theme-details"');
  });
  it('contains exactly 3 data-theme= attributes (light, dark, system)', () => {
    const matches = html.match(/data-theme=/g) ?? [];
    expect(matches.length).toBe(3);
  });
});

// SSR-ACTIVE-JS: script block must include active-state logic
describe('SSR-ACTIVE-JS: active-state JS for selected theme option', () => {
  it("contains localStorage.getItem('theme')", () => {
    expect(html).toContain("localStorage.getItem('theme')");
  });
  it("contains classList.toggle('active'", () => {
    expect(html).toContain("classList.toggle('active'");
  });
});

// SSR-NONCE: every <script and <style must include nonce="test-nonce"
describe('SSR-NONCE: all inline scripts and styles carry nonce', () => {
  it('every <script occurrence has nonce="test-nonce"', () => {
    const scriptIndices: number[] = [];
    let idx = 0;
    while (true) {
      const found = html.indexOf('<script', idx);
      if (found === -1) break;
      scriptIndices.push(found);
      idx = found + 1;
    }
    expect(scriptIndices.length).toBeGreaterThan(0);
    for (const pos of scriptIndices) {
      // Extract the opening tag (up to first >)
      const tagEnd = html.indexOf('>', pos);
      const tag = html.slice(pos, tagEnd + 1);
      expect(tag).toContain('nonce="test-nonce"');
    }
  });

  it('every <style occurrence has nonce="test-nonce"', () => {
    const styleIndices: number[] = [];
    let idx = 0;
    while (true) {
      const found = html.indexOf('<style', idx);
      if (found === -1) break;
      styleIndices.push(found);
      idx = found + 1;
    }
    expect(styleIndices.length).toBeGreaterThan(0);
    for (const pos of styleIndices) {
      const tagEnd = html.indexOf('>', pos);
      const tag = html.slice(pos, tagEnd + 1);
      expect(tag).toContain('nonce="test-nonce"');
    }
  });
});

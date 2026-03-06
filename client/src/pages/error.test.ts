import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mocks must appear before imports that depend on them.
vi.mock('../router.js', () => ({
  navigate: vi.fn(),
  updatePageMeta: vi.fn(),
  focusPageHeading: vi.fn(),
}));
vi.mock('../components/icons.js', () => ({
  createIcon: vi.fn(() => document.createElement('span')),
}));

import { navigate } from '../router.js';
import { renderErrorPage } from './error.js';

describe('error page — CTA navigation (BUG-01)', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.mocked(navigate).mockClear();
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  // not_found: should navigate to '/' with label 'Back to Homepage'
  it('not_found: CTA label is "Back to Homepage"', () => {
    renderErrorPage(container, 'not_found');
    const link = container.querySelector('a');
    expect(link?.textContent).toBe('Back to Homepage');
  });

  it('not_found: CTA href is /', () => {
    renderErrorPage(container, 'not_found');
    const link = container.querySelector('a');
    expect(link?.getAttribute('href')).toBe('/');
  });

  it('not_found: CTA click calls navigate("/")', () => {
    renderErrorPage(container, 'not_found');
    const link = container.querySelector('a');
    link?.click();
    expect(navigate).toHaveBeenCalledWith('/');
  });

  // Secret-error types: should navigate to '/create' with label 'Create a New Secret'
  const secretErrorTypes = [
    'not_available',
    'no_key',
    'decrypt_failed',
    'destroyed',
    'already_viewed',
  ] as const;

  it.each(secretErrorTypes)('%s: CTA label is "Create a New Secret"', (type) => {
    renderErrorPage(container, type);
    const link = container.querySelector('a');
    expect(link?.textContent).toBe('Create a New Secret');
  });

  it.each(secretErrorTypes)('%s: CTA href is /create', (type) => {
    renderErrorPage(container, type);
    const link = container.querySelector('a');
    expect(link?.getAttribute('href')).toBe('/create');
  });

  it.each(secretErrorTypes)('%s: CTA click calls navigate("/create")', (type) => {
    renderErrorPage(container, type);
    const link = container.querySelector('a');
    link?.click();
    expect(navigate).toHaveBeenCalledWith('/create');
  });
});

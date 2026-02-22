/**
 * Expiration time selection component.
 *
 * Auth-aware factory: anonymous users see a locked static "1 hour" display
 * with an upsell note; authenticated users see a <select> with 1h/24h/7d options.
 *
 * @param isAuthenticated - true for logged-in users, false for anonymous.
 * @returns An object with the DOM element and a getValue() accessor.
 */

/**
 * Result type returned by createExpirationSelect.
 * Both anonymous (locked) and authenticated (select) modes satisfy this interface.
 */
export interface ExpirationSelectResult {
  element: HTMLElement;
  getValue: () => string;
}

/**
 * Create an expiration UI element appropriate for the user's auth state.
 *
 * **Anonymous mode** (`isAuthenticated === false`):
 * Renders a static read-only div styled to match the select, showing "1 hour"
 * as the only allowed expiration. Includes an upsell note: "Create a free
 * account for longer expiration." getValue() always returns '1h'.
 *
 * **Authenticated mode** (`isAuthenticated === true`):
 * Renders a <select> with options: 1 hour, 24 hours, 7 days. Default selection
 * is 24 hours. (30-day option is a Pro-tier feature deferred to v5.0.)
 * getValue() returns the currently selected option value.
 *
 * @param isAuthenticated - Whether the current user has an active session.
 * @returns ExpirationSelectResult with element and getValue accessor.
 */
export function createExpirationSelect(isAuthenticated: boolean): ExpirationSelectResult {
  if (!isAuthenticated) {
    // --- Anonymous locked display ---
    const wrapper = document.createElement('div');
    wrapper.className =
      'w-full min-h-[44px] px-3 py-2 border border-border rounded-lg bg-surface text-text-primary space-y-0.5';

    const valueSpan = document.createElement('span');
    valueSpan.className = 'block text-text-primary';
    valueSpan.textContent = '1 hour';

    const note = document.createElement('span');
    note.className = 'block text-xs text-text-muted';
    note.textContent = 'Create a free account for longer expiration.';

    wrapper.appendChild(valueSpan);
    wrapper.appendChild(note);

    return { element: wrapper, getValue: () => '1h' };
  }

  // --- Authenticated select ---
  const select = document.createElement('select');
  select.id = 'expiration';
  select.className =
    'w-full min-h-[44px] px-3 py-2 border border-border rounded-lg bg-surface text-text-primary focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg focus:outline-hidden';

  const options: Array<{ value: string; label: string; selected?: boolean }> = [
    { value: '1h', label: '1 hour' },
    { value: '24h', label: '24 hours', selected: true },
    { value: '7d', label: '7 days' },
  ];

  for (const option of options) {
    const opt = document.createElement('option');
    opt.value = option.value;
    opt.textContent = option.label;
    if (option.selected) {
      opt.selected = true;
    }
    select.appendChild(opt);
  }

  return { element: select, getValue: () => select.value };
}

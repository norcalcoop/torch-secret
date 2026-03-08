/**
 * Expiration time selection component.
 *
 * Auth-aware factory: anonymous users see a locked static "1 hour" display
 * with an upsell note; authenticated users see a fully custom div-based
 * combobox with 1h/24h/7d options plus a 30d row that behaves differently
 * based on subscription tier.
 *
 * @param isAuthenticated - true for logged-in users, false for anonymous.
 * @param isPro - true for Pro subscribers, false for free users (default: false).
 * @returns An object with the DOM element and a getValue() accessor.
 */

import { Lock, ChevronDown } from 'lucide';
import { createIcon } from './icons.js';

/**
 * Result type returned by createExpirationSelect.
 * Both anonymous (locked) and authenticated (combobox) modes satisfy this interface.
 */
export interface ExpirationSelectResult {
  element: HTMLElement;
  getValue: () => string;
}

/**
 * Create an expiration UI element appropriate for the user's auth state and tier.
 *
 * **Anonymous mode** (`isAuthenticated === false`):
 * Renders a static read-only div styled to match the combobox trigger, showing "1 hour"
 * as the only allowed expiration. Includes an upsell note: "Create a free
 * account for longer expiration." getValue() always returns '1h'.
 *
 * **Authenticated Pro mode** (`isAuthenticated === true, isPro === true`):
 * Renders a custom div-based combobox with options: 1 hour, 24 hours, 7 days, 30 days.
 * All rows are selectable. Default selection is 24 hours.
 *
 * **Authenticated free mode** (`isAuthenticated === true, isPro === false`):
 * Renders a custom div-based combobox with options: 1 hour, 24 hours, 7 days selectable,
 * plus a non-selectable 30 days row with a Lucide Lock icon and tooltip
 * "Upgrade to Pro to unlock". Default selection is 24 hours.
 * getValue() returns the currently selected option value.
 *
 * @param isAuthenticated - Whether the current user has an active session.
 * @param isPro - Whether the current user has a Pro subscription.
 * @param suggestion - Optional context-aware expiry hint for authenticated users only.
 * @returns ExpirationSelectResult with element and getValue accessor.
 */
export function createExpirationSelect(
  isAuthenticated: boolean,
  isPro = false,
  suggestion?: { value: string; reason: string },
): ExpirationSelectResult {
  if (!isAuthenticated) {
    // --- Anonymous locked display ---
    const wrapper = document.createElement('div');
    wrapper.className =
      'w-full min-h-[44px] px-3 py-2 border border-border rounded-lg bg-surface text-text-primary space-y-0.5';

    const valueSpan = document.createElement('span');
    valueSpan.className = 'block text-text-primary';
    valueSpan.textContent = '1 hour';

    const note = document.createElement('p');
    note.className = 'block text-xs text-text-muted';
    note.textContent = 'Create a free account for longer expiration.';

    wrapper.appendChild(valueSpan);
    wrapper.appendChild(note);

    return { element: wrapper, getValue: () => '1h' };
  }

  // --- Authenticated custom combobox ---

  // Base selectable options (always present)
  const allOptions = [
    { value: '1h', label: '1 hour' },
    { value: '24h', label: '24 hours' },
    { value: '7d', label: '7 days' },
  ];
  const thirtyDayOption = { value: '30d', label: '30 days' };

  // Closure state
  let selectedValue = '24h';
  let isOpen = false;

  // 1. Create outer container
  const container = document.createElement('div');
  container.className = 'relative w-full';

  // 2. Create the trigger button (role=combobox)
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.id = 'expiration';
  trigger.setAttribute('role', 'combobox');
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', 'expiration-listbox');
  trigger.className =
    'w-full min-h-[44px] px-3 py-2 border border-border rounded-lg bg-surface text-text-primary ' +
    'flex items-center justify-between gap-2 ' +
    'focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg focus:outline-hidden ' +
    'cursor-pointer';

  const triggerLabel = document.createElement('span');
  triggerLabel.textContent = '24 hours'; // default
  trigger.appendChild(triggerLabel);
  trigger.appendChild(createIcon(ChevronDown, { size: 'sm', class: 'text-text-muted shrink-0' }));
  container.appendChild(trigger);

  // 3. Create the listbox
  const listbox = document.createElement('ul');
  listbox.id = 'expiration-listbox';
  listbox.setAttribute('role', 'listbox');
  listbox.setAttribute('aria-label', 'Expiration time');
  listbox.className =
    'absolute z-50 w-full mt-1 border border-border rounded-lg bg-surface shadow-lg ' +
    'overflow-hidden focus:outline-none';
  listbox.hidden = true;
  container.appendChild(listbox);

  // 4. Helper to build an enabled option row
  function buildOptionRow(value: string, label: string): HTMLLIElement {
    const li = document.createElement('li');
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', value === selectedValue ? 'true' : 'false');
    li.dataset['value'] = value;
    li.tabIndex = -1;
    li.className =
      'flex items-center px-3 py-2 min-h-[44px] text-text-primary cursor-pointer ' +
      'hover:bg-surface-raised focus:bg-surface-raised focus:outline-none ' +
      (value === selectedValue ? 'bg-surface-raised font-medium' : '');
    li.textContent = label;
    return li;
  }

  // 5. Build enabled rows for base options
  for (const opt of allOptions) {
    listbox.appendChild(buildOptionRow(opt.value, opt.label));
  }

  // 6. Build the 30d row — differs by tier
  if (isPro) {
    listbox.appendChild(buildOptionRow(thirtyDayOption.value, thirtyDayOption.label));
  } else {
    // Free user: non-selectable row with lock icon + tooltip
    const li = document.createElement('li');
    li.setAttribute('role', 'option');
    li.setAttribute('aria-disabled', 'true');
    li.setAttribute('aria-selected', 'false');
    li.tabIndex = -1;
    li.className =
      'flex items-center justify-between px-3 py-2 min-h-[44px] text-text-muted cursor-default ' +
      'focus:outline-none select-none';

    const labelSpan = document.createElement('span');
    labelSpan.textContent = '30 days';
    li.appendChild(labelSpan);

    // Lock icon + tooltip wrapper
    const lockWrapper = document.createElement('span');
    lockWrapper.className = 'relative inline-flex items-center group';
    // tabIndex=0 so keyboard users can focus it and see the tooltip via :focus-within
    lockWrapper.tabIndex = 0;
    lockWrapper.setAttribute('aria-label', 'Upgrade to Pro to unlock');

    const lockIconEl = createIcon(Lock, { size: 'sm', class: 'text-text-muted' });
    lockIconEl.setAttribute('aria-hidden', 'true');
    lockWrapper.appendChild(lockIconEl);

    // Tooltip (shown on group-hover via Tailwind group utility)
    const tooltip = document.createElement('span');
    tooltip.setAttribute('role', 'tooltip');
    tooltip.className =
      'absolute right-0 bottom-full mb-1 whitespace-nowrap rounded-md bg-surface-raised ' +
      'border border-border px-2 py-1 text-xs text-text-secondary shadow-md ' +
      'opacity-0 pointer-events-none ' +
      'group-hover:opacity-100 group-focus-within:opacity-100 ' +
      'transition-opacity duration-150';
    tooltip.textContent = 'Upgrade to Pro to unlock';
    lockWrapper.appendChild(tooltip);

    li.appendChild(lockWrapper);
    listbox.appendChild(li);
  }

  // 7. Open/close helpers
  function openDropdown(): void {
    isOpen = true;
    listbox.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
  }

  function closeDropdown(): void {
    isOpen = false;
    listbox.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    trigger.focus();
  }

  // 8. Selection helper
  function selectOption(value: string, label: string): void {
    selectedValue = value;
    triggerLabel.textContent = label;
    // Update aria-selected on all option rows
    for (const li of Array.from(listbox.querySelectorAll<HTMLLIElement>('[role=option]'))) {
      li.setAttribute('aria-selected', li.dataset['value'] === value ? 'true' : 'false');
      if (li.dataset['value'] === value) {
        li.classList.add('bg-surface-raised', 'font-medium');
      } else {
        li.classList.remove('bg-surface-raised', 'font-medium');
      }
    }
    closeDropdown();
  }

  // 9. Trigger click — toggle open/close
  trigger.addEventListener('click', () => {
    if (isOpen) {
      closeDropdown();
    } else {
      openDropdown();
      // Focus first enabled option
      const first = listbox.querySelector<HTMLLIElement>('[role=option]:not([aria-disabled])');
      first?.focus();
    }
  });

  // 10. Click on option rows
  listbox.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest<HTMLLIElement>('[role=option]');
    if (!target || target.getAttribute('aria-disabled') === 'true') return;
    const value = target.dataset['value'];
    const label = target.textContent?.trim();
    if (value && label) selectOption(value, label);
  });

  // 11. Keyboard navigation on listbox — ArrowUp/Down, Enter, Escape, Tab
  listbox.addEventListener('keydown', (e: KeyboardEvent) => {
    const options = Array.from(
      listbox.querySelectorAll<HTMLLIElement>('[role=option]:not([aria-disabled])'),
    );
    const focused = document.activeElement as HTMLLIElement;
    const idx = options.indexOf(focused);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      options[Math.min(idx + 1, options.length - 1)]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (idx <= 0) {
        closeDropdown();
        return;
      }
      options[idx - 1]?.focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const value = focused.dataset['value'];
      const label = focused.textContent?.trim();
      if (value && label) selectOption(value, label);
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      closeDropdown();
    }
  });

  // 12. Keyboard on trigger — ArrowDown/Enter/Space opens
  trigger.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openDropdown();
      const first = listbox.querySelector<HTMLLIElement>('[role=option]:not([aria-disabled])');
      first?.focus();
    } else if (e.key === 'Escape') {
      closeDropdown();
    }
  });

  // 13. Close on outside click
  document.addEventListener(
    'click',
    (e) => {
      if (isOpen && !container.contains(e.target as Node)) {
        closeDropdown();
      }
    },
    { capture: true },
  );

  // 14. Suggestion hint — authenticated users only
  if (suggestion) {
    const labelForValue: Record<string, string> = {
      '1h': '1 hour',
      '24h': '24 hours',
      '7d': '7 days',
      '30d': '30 days',
    };
    const hint = document.createElement('p');
    hint.className = 'text-xs text-text-muted mt-1';
    hint.textContent = `Suggested: ${labelForValue[suggestion.value] ?? suggestion.value} \u2014 ${suggestion.reason}`;
    const outer = document.createElement('div');
    outer.appendChild(container);
    outer.appendChild(hint);
    return { element: outer, getValue: () => selectedValue };
  }

  // 15. Return result
  return { element: container, getValue: () => selectedValue };
}

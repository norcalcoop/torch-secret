/**
 * Expiration time selection dropdown component.
 *
 * Provides a styled <select> element with preset expiration durations.
 * Default selection is 24 hours.
 */

interface ExpirationOption {
  value: string;
  label: string;
  selected?: boolean;
}

const EXPIRATION_OPTIONS: ExpirationOption[] = [
  { value: '1h', label: '1 hour' },
  { value: '24h', label: '24 hours', selected: true },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
];

/**
 * Create a styled expiration select dropdown.
 *
 * @returns A <select> element with expiration duration options.
 */
export function createExpirationSelect(): HTMLSelectElement {
  const select = document.createElement('select');
  select.id = 'expiration';
  select.className =
    'w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary-500 focus:outline-hidden';

  for (const option of EXPIRATION_OPTIONS) {
    const opt = document.createElement('option');
    opt.value = option.value;
    opt.textContent = option.label;
    if (option.selected) {
      opt.selected = true;
    }
    select.appendChild(opt);
  }

  return select;
}

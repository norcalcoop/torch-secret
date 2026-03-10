import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mocks must appear before imports that depend on them.
vi.mock('../crypto/index.js', () => ({
  encrypt: vi.fn().mockResolvedValue({ ciphertext: 'fake-ciphertext', key: 'fake-key' }),
  generatePassphrase: vi.fn(() => 'word1 word2 word3 word4'),
  generatePassword: vi.fn(() => 'FakePass1!'),
}));
vi.mock('../api/client.js', () => ({
  createSecret: vi.fn(),
  getMe: vi.fn().mockResolvedValue(null),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));
vi.mock('../api/auth-client.js', () => ({
  authClient: { getSession: vi.fn().mockResolvedValue(null) },
}));
vi.mock('../analytics/posthog.js', () => ({
  captureSecretCreated: vi.fn(),
  captureConversionPromptShown: vi.fn(),
  captureConversionPromptClicked: vi.fn(),
}));
vi.mock('../components/expiration-select.js', () => ({
  createExpirationSelect: vi.fn(() => {
    const select = document.createElement('select');
    select.id = 'expiration-select';
    for (const v of ['1h', '24h', '7d', '30d']) {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      select.appendChild(opt);
    }
    return {
      element: select,
      getValue: () => select.value || '24h',
      setValue: (v: string) => {
        select.value = v;
      },
    };
  }),
}));
vi.mock('./confirmation.js', () => ({
  renderConfirmationPage: vi.fn(),
}));
vi.mock('../router.js', () => ({
  navigate: vi.fn(),
}));
vi.mock('../components/icons.js', () => ({
  createIcon: vi.fn(() => document.createElement('span')),
}));
vi.mock('../components/toast.js', () => ({
  showToast: vi.fn(),
}));

// getExpirySuggestion is a pure time-dependent function; test branches with fake system time
import { getExpirySuggestion, renderCreatePage } from './create.js';

describe('getExpirySuggestion — time-of-day branches', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Friday 15:30 → 7 days (recipient may not check until Monday)', () => {
    // 2025-03-07 is a Friday
    vi.setSystemTime(new Date('2025-03-07T15:30:00'));
    const result = getExpirySuggestion();
    expect(result.value).toBe('7d');
    expect(result.reason).toContain('Monday');
  });

  it('Tuesday 10:00 → 1 hour (business hours, recipient available)', () => {
    // 2025-03-04 is a Tuesday
    vi.setSystemTime(new Date('2025-03-04T10:00:00'));
    const result = getExpirySuggestion();
    expect(result.value).toBe('1h');
    expect(result.reason).toContain('available now');
  });

  it('Monday 20:00 → 24 hours (evening branch)', () => {
    // 2025-03-03 is a Monday
    vi.setSystemTime(new Date('2025-03-03T20:00:00'));
    const result = getExpirySuggestion();
    expect(result.value).toBe('24h');
  });

  it('Saturday 14:00 → 24 hours (weekend branch)', () => {
    // 2025-03-08 is a Saturday
    vi.setSystemTime(new Date('2025-03-08T14:00:00'));
    const result = getExpirySuggestion();
    expect(result.value).toBe('24h');
  });

  it('Monday 08:00 → 24 hours (all-other-times default)', () => {
    // Before business hours on a weekday — falls through to default
    vi.setSystemTime(new Date('2025-03-03T08:00:00'));
    const result = getExpirySuggestion();
    expect(result.value).toBe('24h');
  });
});

// ---------------------------------------------------------------------------
// Prefill URL params tests (RED — Plan 03 will implement ?label=/?expiry=/?notify= reading)
// ---------------------------------------------------------------------------

describe('create page — prefill URL params', () => {
  let container: HTMLElement;
  let originalLocation: Location;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    originalLocation = window.location;
    vi.spyOn(window.history, 'replaceState');
  });

  afterEach(() => {
    document.body.removeChild(container);
    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    });
    vi.restoreAllMocks();
  });

  it('sets label input value from ?label= URL param', () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: {
        ...window.location,
        search: '?label=My+Secret',
        href: 'http://localhost/create?label=My+Secret',
      },
    });

    renderCreatePage(container);

    const labelInput = container.querySelector<HTMLInputElement>('#secret-label');
    expect(labelInput?.value).toBe('My Secret');
  });

  it('initialises expiration select from ?expiry=7d URL param', () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: {
        ...window.location,
        search: '?expiry=7d',
        href: 'http://localhost/create?expiry=7d',
      },
    });

    renderCreatePage(container);

    const expirySelect = container.querySelector<HTMLSelectElement>('#expiration-select');
    expect(expirySelect?.value).toBe('7d');
  });

  it('initialises notify toggle to checked from ?notify=1 URL param', () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: {
        ...window.location,
        search: '?notify=1',
        href: 'http://localhost/create?notify=1',
      },
    });

    renderCreatePage(container);

    const notifyToggle = container.querySelector<HTMLInputElement>('#notify-toggle');
    expect(notifyToggle?.checked).toBe(true);
  });

  it('cleans up URL query string after reading prefill params', () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: {
        ...window.location,
        search: '?label=My+Secret&expiry=7d',
        href: 'http://localhost/create?label=My+Secret&expiry=7d',
      },
    });

    renderCreatePage(container);

    expect(window.history.replaceState).toHaveBeenCalledWith({}, '', '/create');
  });
});

// ---------------------------------------------------------------------------
// Burn timer dropdown tests (RED — Plan 03 will implement the burn-timer select)
// ---------------------------------------------------------------------------

describe('create page — burn timer dropdown', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('renders a select element with id "burn-timer"', () => {
    renderCreatePage(container);
    expect(container.querySelector('#burn-timer')).toBeTruthy();
  });

  it('burn-timer select has options with values "", "15", "30", "60"', () => {
    renderCreatePage(container);
    const opts = Array.from(
      container.querySelectorAll<HTMLOptionElement>('#burn-timer option'),
    ).map((o) => o.value);
    expect(opts).toEqual(expect.arrayContaining(['', '15', '30', '60']));
  });

  it('the option with value "30" is selected by default', () => {
    renderCreatePage(container);
    const selected = container.querySelector<HTMLOptionElement>('#burn-timer option[value="30"]');
    expect(selected?.selected).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Preview panel tests (RED — Plan 03 will implement the collapsible preview)
// ---------------------------------------------------------------------------

describe('create page — preview panel', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('renders a <summary> element with text matching /Preview/', () => {
    renderCreatePage(container);
    const summary = container.querySelector('summary');
    expect(summary).toBeTruthy();
    expect(summary?.textContent).toMatch(/Preview/);
  });

  it('preview terminal shows placeholder text when textarea is empty', () => {
    renderCreatePage(container);
    const previewTerminal = container.querySelector('#preview-terminal');
    expect(previewTerminal?.textContent).toContain('Type your secret above to see the preview.');
  });

  it('preview terminal updates when textarea receives input', () => {
    renderCreatePage(container);
    const textarea = container.querySelector<HTMLTextAreaElement>('#secret-text');
    const previewTerminal = container.querySelector('#preview-terminal');

    if (textarea) {
      textarea.value = 'hello';
      textarea.dispatchEvent(new Event('input'));
    }

    expect(previewTerminal?.textContent).toContain('hello');
  });
});

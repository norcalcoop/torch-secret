// @vitest-environment happy-dom

// Stubs for Plan 03 (BNDL-02): passphrase panel lazy-load behaviors.
// These will be implemented in Plan 03 when `create.ts` gains `getPassphraseModule()`.
// All tests are marked `.todo` so they count as pending (not failing) in Wave 0.
// Plan 03 must make all 5 green by implementing the lazy-load logic.

import { describe, it, vi, beforeEach } from 'vitest';

describe('passphrase lazy-load (BNDL-02)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it.todo('shows loading spinner on first passphrase tab activation');
  it.todo('replaces spinner with passphrase input after module resolves');
  it.todo('shows error state with Retry button when dynamic import fails');
  it.todo('retry resets module cache and re-attempts import');
  it.todo('New passphrase button uses cached module on subsequent calls');
});

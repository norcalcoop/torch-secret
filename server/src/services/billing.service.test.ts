import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockUpdateContact } = vi.hoisted(() => ({
  mockUpdateContact: vi.fn().mockResolvedValue({ success: true }),
}));

const { mockSelect, mockUpdate } = vi.hoisted(() => ({
  mockSelect: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([{ email: 'alice@example.com' }]),
    }),
  }),
  mockUpdate: vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    }),
  }),
}));

vi.mock('../config/loops.js', () => ({
  loops: { updateContact: mockUpdateContact },
}));

vi.mock('../db/connection.js', () => ({
  db: { select: mockSelect, update: mockUpdate },
}));

import { activatePro, deactivatePro } from './billing.service.js';

describe('activatePro — Loops contact update (ESEQ-03)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateContact.mockResolvedValue({ success: true });
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ email: 'alice@example.com' }]),
      }),
    });
    mockUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });
  });

  it('calls loops.updateContact with subscriptionTier: "pro"', async () => {
    await activatePro('cus_test123');
    // activatePro does a DB select to get email, then updates Loops
    // After Plan 02 adds the Loops call, this assertion will pass
    expect(mockUpdateContact).toHaveBeenCalledOnce();
    const args = mockUpdateContact.mock.calls[0][0] as {
      properties: { subscriptionTier: string };
    };
    expect(args.properties.subscriptionTier).toBe('pro');
  });
});

describe('activatePro — idempotency (BILL-05)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateContact.mockResolvedValue({ success: true });
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ email: 'alice@example.com' }]),
      }),
    });
    mockUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });
  });

  it('can be called twice with the same customerId without error', async () => {
    await activatePro('cus_idempotent');
    await expect(activatePro('cus_idempotent')).resolves.toBeUndefined();
  });

  it('calls db.update twice when invoked twice (no conditional guard needed)', async () => {
    await activatePro('cus_idempotent');
    await activatePro('cus_idempotent');
    expect(mockUpdate).toHaveBeenCalledTimes(2);
  });
});

describe('deactivatePro — Loops contact sync (ESEQ-03)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateContact.mockResolvedValue({ success: true });
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ email: 'alice@example.com' }]),
      }),
    });
    mockUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });
  });

  it('calls loops.updateContact with subscriptionTier: "free"', async () => {
    await deactivatePro('cus_cancel123');
    // deactivatePro does DB update, then SELECT email, then void loops.updateContact
    // Use flushPromises or await a tick to let the void promise settle
    await Promise.resolve();
    expect(mockUpdateContact).toHaveBeenCalledOnce();
    const args = mockUpdateContact.mock.calls[0][0] as {
      email: string;
      properties: { subscriptionTier: string };
    };
    expect(args.properties.subscriptionTier).toBe('free');
  });

  it('does not throw when loops.updateContact rejects', async () => {
    mockUpdateContact.mockRejectedValue(new Error('Loops outage'));
    await expect(deactivatePro('cus_cancel456')).resolves.toBeUndefined();
  });

  it('skips loops.updateContact when no user found for stripeCustomerId', async () => {
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]), // empty — no user
      }),
    });
    await deactivatePro('cus_unknown');
    await Promise.resolve();
    expect(mockUpdateContact).not.toHaveBeenCalled();
  });
});

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

import { activatePro } from './billing.service.js';

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

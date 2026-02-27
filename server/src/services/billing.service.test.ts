import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockUpdateContact } = vi.hoisted(() => ({
  mockUpdateContact: vi.fn().mockResolvedValue({ success: true }),
}));

const { mockDbUpdate } = vi.hoisted(() => ({
  mockDbUpdate: vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    }),
  }),
}));

vi.mock('../config/loops.js', () => ({
  loops: { updateContact: mockUpdateContact },
}));

vi.mock('../db/connection.js', () => ({
  db: { update: mockDbUpdate },
}));

import { activatePro } from './billing.service.js';

describe('activatePro — Loops contact update (ESEQ-03)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateContact.mockResolvedValue({ success: true });
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ email: 'alice@example.com' }]),
      }),
    });
  });

  it('calls loops.updateContact with subscriptionTier: "pro"', async () => {
    await activatePro('cus_test123');
    // activatePro does a DB select to get email, then updates Loops
    // After Plan 02 adds the Loops call, this assertion will pass
    // For now: RED (activatePro does not call loops.updateContact yet)
    expect(mockUpdateContact).toHaveBeenCalledOnce();
    const args = mockUpdateContact.mock.calls[0][0] as {
      properties: { subscriptionTier: string };
    };
    expect(args.properties.subscriptionTier).toBe('pro');
  });
});

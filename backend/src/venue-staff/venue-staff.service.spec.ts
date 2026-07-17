import { Test } from '@nestjs/testing';
import { VenueStaffRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { VenueStaffService } from './venue-staff.service';

describe('VenueStaffService.upsertMember', () => {
  let service: VenueStaffService;
  let tx: {
    venueStaff: { upsert: jest.Mock };
    venuePerkRedemption: { updateMany: jest.Mock };
    venueOfferRedemption: { updateMany: jest.Mock };
  };
  let prisma: {
    venue: { findUnique: jest.Mock };
    player: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    tx = {
      venueStaff: {
        upsert: jest.fn().mockResolvedValue({
          id: 'vs1',
          venueId: 'v1',
          playerId: 'p1',
          role: VenueStaffRole.EMPLOYEE,
        }),
      },
      venuePerkRedemption: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      venueOfferRedemption: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    prisma = {
      venue: { findUnique: jest.fn().mockResolvedValue({ id: 'v1' }) },
      player: { findUnique: jest.fn().mockResolvedValue({ id: 'p1' }) },
      $transaction: jest.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [VenueStaffService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(VenueStaffService);
  });

  it('voids open guest perk redemptions at that venue when the player becomes staff', async () => {
    const out = await service.upsertMember({
      venueId: 'v1',
      playerId: 'p1',
      role: VenueStaffRole.EMPLOYEE,
    });

    expect(out.id).toBe('vs1');
    expect(tx.venuePerkRedemption.updateMany).toHaveBeenCalledTimes(1);
    const call = tx.venuePerkRedemption.updateMany.mock.calls[0]![0] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
    // Scoped to this player at this venue only — venue B rows untouched.
    expect(call.where).toMatchObject({
      playerId: 'p1',
      venueId: 'v1',
      voidedAt: null,
      status: { in: ['REDEEMABLE', 'LOCKED'] },
    });
    expect(call.data).toMatchObject({
      status: 'VOIDED',
      voidReason: expect.stringMatching(/staff/i),
    });
    expect(call.data.voidedAt).toBeInstanceOf(Date);
  });

  it('cancels pending guest offer claims at that venue when the player becomes staff', async () => {
    await service.upsertMember({
      venueId: 'v1',
      playerId: 'p1',
      role: VenueStaffRole.EMPLOYEE,
    });

    expect(tx.venueOfferRedemption.updateMany).toHaveBeenCalledTimes(1);
    const call = tx.venueOfferRedemption.updateMany.mock.calls[0]![0] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
    // Scoped to this player and this venue's offers only.
    expect(call.where).toMatchObject({
      playerId: 'p1',
      status: 'PENDING',
      offer: { venueId: 'v1' },
    });
    expect(call.data).toMatchObject({
      status: 'CANCELLED',
      cancelReason: expect.stringMatching(/staff/i),
    });
    expect(call.data.cancelledAt).toBeInstanceOf(Date);
  });

  it('is idempotent: repeat upserts only target still-open rows', async () => {
    await service.upsertMember({
      venueId: 'v1',
      playerId: 'p1',
      role: VenueStaffRole.MANAGER,
    });
    await service.upsertMember({
      venueId: 'v1',
      playerId: 'p1',
      role: VenueStaffRole.MANAGER,
    });

    for (const [args] of tx.venuePerkRedemption.updateMany.mock.calls) {
      expect((args as { where: Record<string, unknown> }).where).toMatchObject({
        voidedAt: null,
        status: { in: ['REDEEMABLE', 'LOCKED'] },
      });
    }
  });

  it('runs the membership upsert and reward voiding in one transaction', async () => {
    await service.upsertMember({
      venueId: 'v1',
      playerId: 'p1',
      role: VenueStaffRole.EMPLOYEE,
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.venueStaff.upsert).toHaveBeenCalledTimes(1);
  });
});

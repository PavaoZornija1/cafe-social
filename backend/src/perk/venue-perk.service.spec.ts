jest.mock('../venue/venue.service', () => ({ VenueService: class VenueService {} }));

import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { VenueService } from '../venue/venue.service';
import { VenueModerationService } from '../venue/venue-moderation.service';
import { VenueFunnelService } from '../venue/venue-funnel.service';
import { VenueStaffService } from '../venue-staff/venue-staff.service';
import { VenuePerkService } from './venue-perk.service';

describe('VenuePerkService.redeem staff policy', () => {
  let service: VenuePerkService;
  let prisma: {
    venuePerk: { findFirst: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    venuePerkRedemption: { findFirst: jest.Mock; create: jest.Mock };
    playerVenue: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let venueStaff: { assertCanClaimGuestRewards: jest.Mock };

  const basePerk = {
    id: 'perk1',
    title: 'Free coffee',
    subtitle: null,
    body: null,
    code: 'COFFEE',
    activeFrom: null,
    activeTo: null,
    maxRedemptions: null,
    redemptionCount: 0,
    requiresQrUnlock: false,
  };

  const baseParams = {
    playerId: 'p1',
    code: 'COFFEE',
    latitude: 45,
    longitude: 16,
  };

  beforeEach(async () => {
    prisma = {
      venuePerk: {
        findFirst: jest.fn().mockResolvedValue(basePerk),
        findUnique: jest.fn().mockResolvedValue(basePerk),
        update: jest.fn().mockResolvedValue({}),
      },
      venuePerkRedemption: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'r1',
          issuedAt: new Date(),
          redeemedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
          status: 'REDEEMABLE',
        }),
      },
      playerVenue: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(async (cb: (t: typeof prisma) => Promise<unknown>) => cb(prisma)),
    };
    venueStaff = {
      assertCanClaimGuestRewards: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        VenuePerkService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: VenueService,
          useValue: {
            assertCoordinatesAllowedForGuestVenue: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: VenueModerationService,
          useValue: { assertNotBanned: jest.fn().mockResolvedValue(undefined) },
        },
        { provide: VenueFunnelService, useValue: { safeLog: jest.fn() } },
        { provide: VenueStaffService, useValue: venueStaff },
      ],
    }).compile();
    service = moduleRef.get(VenuePerkService);
  });

  it('rejects perk redeem for staff at that venue before any mutation', async () => {
    venueStaff.assertCanClaimGuestRewards.mockRejectedValue(
      new ForbiddenException('Venue staff cannot claim guest rewards at their own venue'),
    );

    await expect(
      service.redeem({ ...baseParams, venueId: 'v1' }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(venueStaff.assertCanClaimGuestRewards).toHaveBeenCalledWith('p1', 'v1');
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.venuePerkRedemption.create).not.toHaveBeenCalled();
  });

  it('allows redemption at a venue where the player is not staff (cross-venue)', async () => {
    const out = await service.redeem({ ...baseParams, venueId: 'v2' });

    // The staff check is scoped to the exact venue being redeemed at.
    expect(venueStaff.assertCanClaimGuestRewards).toHaveBeenCalledWith('p1', 'v2');
    expect(out.redemptionId).toBe('r1');
    expect(prisma.venuePerkRedemption.create).toHaveBeenCalled();
  });
});

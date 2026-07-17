import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { VenueStaffService } from '../venue-staff/venue-staff.service';
import { OwnerRedemptionActionsService } from './owner-redemption-actions.service';

describe('OwnerRedemptionActionsService', () => {
  let service: OwnerRedemptionActionsService;
  let prisma: {
    venuePerkRedemption: {
      findFirst: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
    };
  };
  let venueStaff: { assertCanClaimGuestRewards: jest.Mock };

  beforeEach(async () => {
    prisma = {
      venuePerkRedemption: {
        findFirst: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
    };
    venueStaff = {
      assertCanClaimGuestRewards: jest.fn().mockResolvedValue(undefined),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        OwnerRedemptionActionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: VenueStaffService, useValue: venueStaff },
      ],
    }).compile();
    service = moduleRef.get(OwnerRedemptionActionsService);
  });

  it('blocks self-acknowledge', async () => {
    prisma.venuePerkRedemption.findFirst.mockResolvedValue({
      id: 'r1',
      playerId: 'guest-1',
      status: 'REDEEMABLE',
      voidedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      redeemedAt: null,
    });
    await expect(
      service.acknowledge({
        venueId: 'v1',
        redemptionId: 'r1',
        staffPlayerId: 'guest-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks acknowledge when the claimant is staff at the venue, even by a coworker', async () => {
    prisma.venuePerkRedemption.findFirst.mockResolvedValue({
      id: 'r1',
      playerId: 'staff-guest',
      status: 'REDEEMABLE',
      voidedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      redeemedAt: null,
    });
    venueStaff.assertCanClaimGuestRewards.mockRejectedValue(
      new ForbiddenException('Venue staff cannot claim guest rewards at their own venue'),
    );

    await expect(
      service.acknowledge({
        venueId: 'v1',
        redemptionId: 'r1',
        staffPlayerId: 'coworker-1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(venueStaff.assertCanClaimGuestRewards).toHaveBeenCalledWith('staff-guest', 'v1');
    expect(prisma.venuePerkRedemption.update).not.toHaveBeenCalled();
  });

  it('acknowledges a redeemable reward for a non-staff guest', async () => {
    prisma.venuePerkRedemption.findFirst.mockResolvedValue({
      id: 'r1',
      playerId: 'guest-1',
      status: 'REDEEMABLE',
      voidedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      redeemedAt: null,
    });
    prisma.venuePerkRedemption.update.mockResolvedValue({ id: 'r1', status: 'REDEEMED' });

    await service.acknowledge({
      venueId: 'v1',
      redemptionId: 'r1',
      staffPlayerId: 'staff-1',
    });

    expect(venueStaff.assertCanClaimGuestRewards).toHaveBeenCalledWith('guest-1', 'v1');
    expect(prisma.venuePerkRedemption.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'r1' },
        data: expect.objectContaining({
          status: 'REDEEMED',
          redeemedByPlayerId: 'staff-1',
        }),
      }),
    );
  });

  it('blocks acknowledge when status is LOCKED', async () => {
    prisma.venuePerkRedemption.findFirst.mockResolvedValue({
      id: 'r1',
      status: 'LOCKED',
      voidedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      redeemedAt: null,
    });
    await expect(
      service.acknowledge({
        venueId: 'v1',
        redemptionId: 'r1',
        staffPlayerId: 'staff-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('locks without staff audit id when staffPlayerId omitted', async () => {
    prisma.venuePerkRedemption.findFirst.mockResolvedValue({
      id: 'r1',
      status: 'REDEEMABLE',
    });
    prisma.venuePerkRedemption.update.mockResolvedValue({ id: 'r1', status: 'LOCKED' });
    await service.lockRedemption({
      venueId: 'v1',
      redemptionId: 'r1',
      reason: 'Receipt submitted',
    });
    expect(prisma.venuePerkRedemption.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: {
        status: 'LOCKED',
        voidReason: 'Receipt submitted',
        voidedByPlayerId: null,
      },
    });
  });

  it('unlock clears lock audit fields', async () => {
    prisma.venuePerkRedemption.findFirst.mockResolvedValue({
      id: 'r1',
      status: 'LOCKED',
    });
    prisma.venuePerkRedemption.update.mockResolvedValue({ id: 'r1', status: 'REDEEMABLE' });
    await service.unlockRedemption({ venueId: 'v1', redemptionId: 'r1' });
    expect(prisma.venuePerkRedemption.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: {
        status: 'REDEEMABLE',
        voidReason: null,
        voidedByPlayerId: null,
      },
    });
  });

  it('throws NotFound when redemption missing on void', async () => {
    prisma.venuePerkRedemption.findFirst.mockResolvedValue(null);
    await expect(
      service.voidRedemption({
        venueId: 'v1',
        redemptionId: 'missing',
        staffPlayerId: 'staff-1',
        reason: 'abuse',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

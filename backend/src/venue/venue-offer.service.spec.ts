jest.mock('./venue.service', () => ({ VenueService: class VenueService {} }));

import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { VenueOfferFulfillment, VenueOfferStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { VenueStaffService } from '../venue-staff/venue-staff.service';
import { VenueService } from './venue.service';
import { VenueOfferService } from './venue-offer.service';

describe('VenueOfferService.fulfillMemberCardOffer', () => {
  let service: VenueOfferService;
  let prisma: {
    venueOfferRedemption: { findUnique: jest.Mock; update: jest.Mock };
  };
  let venueStaff: { assertCanClaimGuestRewards: jest.Mock };

  const pendingRow = (playerId: string) => ({
    id: 'r1',
    playerId,
    status: 'PENDING',
    offer: {
      id: 'o1',
      venueId: 'v1',
      fulfillment: VenueOfferFulfillment.MEMBER_CARD,
      title: 'Free coffee',
    },
  });

  beforeEach(async () => {
    prisma = {
      venueOfferRedemption: { findUnique: jest.fn(), update: jest.fn() },
    };
    venueStaff = {
      assertCanClaimGuestRewards: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        VenueOfferService,
        { provide: PrismaService, useValue: prisma },
        { provide: VenueService, useValue: {} },
        { provide: VenueStaffService, useValue: venueStaff },
      ],
    }).compile();
    service = moduleRef.get(VenueOfferService);
  });

  it('rejects fulfilment when the claimant is staff at the venue, even by another staff member', async () => {
    prisma.venueOfferRedemption.findUnique.mockResolvedValue(pendingRow('staff-guest'));
    venueStaff.assertCanClaimGuestRewards.mockRejectedValue(
      new ForbiddenException('Venue staff cannot claim guest rewards at their own venue'),
    );

    await expect(
      service.fulfillMemberCardOffer({
        venueId: 'v1',
        redemptionId: 'r1',
        staffPlayerId: 'coworker-1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(venueStaff.assertCanClaimGuestRewards).toHaveBeenCalledWith('staff-guest', 'v1');
    expect(prisma.venueOfferRedemption.update).not.toHaveBeenCalled();
  });

  it('rejects fulfilment of a cancelled (retired) claim', async () => {
    prisma.venueOfferRedemption.findUnique.mockResolvedValue({
      ...pendingRow('guest-1'),
      status: 'CANCELLED',
    });

    await expect(
      service.fulfillMemberCardOffer({
        venueId: 'v1',
        redemptionId: 'r1',
        staffPlayerId: 'staff-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.venueOfferRedemption.update).not.toHaveBeenCalled();
  });

  it('still blocks self-fulfilment for non-staff claimants', async () => {
    prisma.venueOfferRedemption.findUnique.mockResolvedValue(pendingRow('guest-1'));

    await expect(
      service.fulfillMemberCardOffer({
        venueId: 'v1',
        redemptionId: 'r1',
        staffPlayerId: 'guest-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.venueOfferRedemption.update).not.toHaveBeenCalled();
  });

  it('fulfils a pending claim for a non-staff guest', async () => {
    prisma.venueOfferRedemption.findUnique.mockResolvedValue(pendingRow('guest-1'));
    prisma.venueOfferRedemption.update.mockResolvedValue({ id: 'r1', status: 'FULFILLED' });

    const out = await service.fulfillMemberCardOffer({
      venueId: 'v1',
      redemptionId: 'r1',
      staffPlayerId: 'staff-1',
    });

    expect(out).toEqual({
      redemptionId: 'r1',
      status: 'FULFILLED',
      title: 'Free coffee',
      alreadyFulfilled: false,
    });
    expect(prisma.venueOfferRedemption.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'r1' },
        data: expect.objectContaining({
          status: 'FULFILLED',
          fulfilledByStaffPlayerId: 'staff-1',
        }),
      }),
    );
  });
});

describe('VenueOfferService.claimMemberCardOffer staff policy', () => {
  let service: VenueOfferService;
  let prisma: {
    venueOffer: { findFirst: jest.Mock; updateMany: jest.Mock };
    venueOfferRedemption: { findFirst: jest.Mock; count: jest.Mock; create: jest.Mock };
    $transaction: jest.Mock;
  };
  let venueStaff: { assertCanClaimGuestRewards: jest.Mock };

  const liveOffer = (venueId: string) => ({
    id: 'o1',
    venueId,
    title: 'Loyalty stamp',
    body: null,
    fulfillment: VenueOfferFulfillment.MEMBER_CARD,
    status: VenueOfferStatus.ACTIVE,
    validFrom: null,
    validTo: null,
    maxRedemptions: null,
    redemptionCount: 0,
    maxRedemptionsPerPlayer: null,
  });

  const baseParams = {
    playerId: 'p1',
    offerId: 'o1',
    latitude: 45,
    longitude: 16,
  };

  beforeEach(async () => {
    prisma = {
      venueOffer: {
        findFirst: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      venueOfferRedemption: {
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: 'r1', status: 'PENDING' }),
      },
      $transaction: jest.fn(async (cb: (t: typeof prisma) => Promise<unknown>) => cb(prisma)),
    };
    venueStaff = {
      assertCanClaimGuestRewards: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        VenueOfferService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: VenueService,
          useValue: {
            assertCoordinatesAllowedForGuestVenue: jest.fn().mockResolvedValue(undefined),
          },
        },
        { provide: VenueStaffService, useValue: venueStaff },
      ],
    }).compile();
    service = moduleRef.get(VenueOfferService);
  });

  it('rejects claims from staff at that venue before any mutation', async () => {
    venueStaff.assertCanClaimGuestRewards.mockRejectedValue(
      new ForbiddenException('Venue staff cannot claim guest rewards at their own venue'),
    );

    await expect(
      service.claimMemberCardOffer({ ...baseParams, venueId: 'v1' }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(venueStaff.assertCanClaimGuestRewards).toHaveBeenCalledWith('p1', 'v1');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('allows a claim at a venue where the player is not staff (cross-venue)', async () => {
    prisma.venueOffer.findFirst.mockResolvedValue(liveOffer('v2'));

    const out = await service.claimMemberCardOffer({ ...baseParams, venueId: 'v2' });

    expect(venueStaff.assertCanClaimGuestRewards).toHaveBeenCalledWith('p1', 'v2');
    expect(out).toMatchObject({ redemptionId: 'r1', status: 'PENDING', alreadyClaimed: false });
    expect(prisma.venueOfferRedemption.create).toHaveBeenCalled();
  });
});

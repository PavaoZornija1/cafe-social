jest.mock('../venue/venue.service', () => ({ VenueService: class VenueService {} }));

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { VenueService } from '../venue/venue.service';
import { PlayerNotificationService } from '../notification/player-notification.service';
import { VenueStaffNotificationService } from '../notification/venue-staff-notification.service';
import { OwnerRedemptionActionsService } from '../owner/owner-redemption-actions.service';
import { VenueStaffService } from '../venue-staff/venue-staff.service';
import { VenueReceiptService } from './venue-receipt.service';

describe('VenueReceiptService.submit', () => {
  let service: VenueReceiptService;
  let prisma: {
    venuePerkRedemption: { findFirst: jest.Mock };
    venueReceiptSubmission: { create: jest.Mock };
  };
  let redemptionActions: { lockRedemption: jest.Mock };
  let venueStaff: { assertCanClaimGuestRewards: jest.Mock };

  beforeEach(async () => {
    prisma = {
      venuePerkRedemption: { findFirst: jest.fn() },
      venueReceiptSubmission: { create: jest.fn() },
    };
    const venues = {
      assertCoordinatesAllowedForGuestVenue: jest.fn().mockResolvedValue(undefined),
    };
    redemptionActions = { lockRedemption: jest.fn().mockResolvedValue(undefined) };
    venueStaff = {
      assertCanClaimGuestRewards: jest.fn().mockResolvedValue(undefined),
    };
    const playerNotify = { notifyReceiptReviewed: jest.fn() };
    const staffNotify = { notifyReceiptSubmitted: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        VenueReceiptService,
        { provide: PrismaService, useValue: prisma },
        { provide: VenueService, useValue: venues },
        { provide: PlayerNotificationService, useValue: playerNotify },
        { provide: VenueStaffNotificationService, useValue: staffNotify },
        { provide: OwnerRedemptionActionsService, useValue: redemptionActions },
        { provide: VenueStaffService, useValue: venueStaff },
      ],
    }).compile();
    service = moduleRef.get(VenueReceiptService);
  });

  const baseParams = {
    venueId: 'v1',
    playerId: 'p1',
    imageData: 'a'.repeat(100),
    latitude: 45,
    longitude: 16,
  };

  it('rejects submission when the guest is staff at the venue', async () => {
    venueStaff.assertCanClaimGuestRewards.mockRejectedValue(
      new ForbiddenException('Venue staff cannot claim guest rewards at their own venue'),
    );

    await expect(service.submit(baseParams)).rejects.toBeInstanceOf(ForbiddenException);

    expect(venueStaff.assertCanClaimGuestRewards).toHaveBeenCalledWith('p1', 'v1');
    expect(prisma.venueReceiptSubmission.create).not.toHaveBeenCalled();
  });

  it('rejects linked redemption that is not REDEEMABLE', async () => {
    prisma.venuePerkRedemption.findFirst.mockResolvedValue({
      id: 'r1',
      status: 'LOCKED',
    });
    await expect(
      service.submit({ ...baseParams, linkedRedemptionId: 'r1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('locks linked redemption without guest staff id on submit', async () => {
    prisma.venuePerkRedemption.findFirst.mockResolvedValue({
      id: 'r1',
      status: 'REDEEMABLE',
    });
    prisma.venueReceiptSubmission.create.mockResolvedValue({
      id: 'sub-1',
      status: 'PENDING',
      linkedRedemptionId: 'r1',
      createdAt: new Date('2026-07-03T12:00:00.000Z'),
      retentionUntil: new Date('2026-10-01T00:00:00.000Z'),
    });

    await service.submit({ ...baseParams, linkedRedemptionId: 'r1' });

    expect(redemptionActions.lockRedemption).toHaveBeenCalledWith({
      venueId: 'v1',
      redemptionId: 'r1',
      reason: 'Receipt submitted for staff review',
    });
  });
});

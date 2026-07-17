jest.mock('../notification/player-notification.service', () => ({
  PlayerNotificationService: class PlayerNotificationService {},
}));

import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { VenueModerationService } from '../venue/venue-moderation.service';
import { VenueFunnelService } from '../venue/venue-funnel.service';
import { PlayerNotificationService } from '../notification/player-notification.service';
import { VenueStaffService } from '../venue-staff/venue-staff.service';
import { PlayerRewardGrantService } from './player-reward-grant.service';

describe('PlayerRewardGrantService staff denial policy', () => {
  let service: PlayerRewardGrantService;
  let prisma: {
    playerRewardGrant: { findUnique: jest.Mock };
    venuePerk: { findFirst: jest.Mock; findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let venueStaff: { isStaffAtVenue: jest.Mock };

  beforeEach(async () => {
    prisma = {
      playerRewardGrant: { findUnique: jest.fn().mockResolvedValue(null) },
      venuePerk: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn(),
    };
    venueStaff = { isStaffAtVenue: jest.fn().mockResolvedValue(false) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PlayerRewardGrantService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: VenueModerationService,
          useValue: { assertNotBanned: jest.fn().mockResolvedValue(undefined) },
        },
        { provide: VenueFunnelService, useValue: { safeLog: jest.fn() } },
        { provide: PlayerNotificationService, useValue: { notifyPerkGranted: jest.fn() } },
        { provide: VenueStaffService, useValue: venueStaff },
      ],
    }).compile();
    service = moduleRef.get(PlayerRewardGrantService);
  });

  it('denies challenge perk grants for staff at that venue without touching perks', async () => {
    venueStaff.isStaffAtVenue.mockResolvedValue(true);

    const out = await service.tryIssueChallengePerkGrant({
      playerId: 'p1',
      venueId: 'v1',
      challengeId: 'c1',
      perkId: 'perk1',
      resetsWeekly: false,
    });

    expect(out).toEqual({ ok: false, reason: 'staff_at_venue' });
    expect(venueStaff.isStaffAtVenue).toHaveBeenCalledWith('p1', 'v1');
    expect(prisma.venuePerk.findFirst).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('lets a player who is staff elsewhere pass the challenge staff gate (cross-venue)', async () => {
    venueStaff.isStaffAtVenue.mockResolvedValue(false);

    const out = await service.tryIssueChallengePerkGrant({
      playerId: 'p1',
      venueId: 'v2',
      challengeId: 'c1',
      perkId: 'perk1',
      resetsWeekly: false,
    });

    // Passed the staff gate; failed later only because the perk does not exist.
    expect(venueStaff.isStaffAtVenue).toHaveBeenCalledWith('p1', 'v2');
    expect(out).toEqual({ ok: false, reason: 'not_found' });
    expect(prisma.venuePerk.findFirst).toHaveBeenCalled();
  });

  it('denies automated perk grants for staff at the perk venue', async () => {
    prisma.venuePerk.findUnique.mockResolvedValue({
      id: 'perk1',
      venueId: 'v1',
      activeFrom: null,
      activeTo: null,
      maxRedemptions: null,
      redemptionCount: 0,
    });
    venueStaff.isStaffAtVenue.mockResolvedValue(true);

    const out = await service.tryIssueAutomatedPerkGrant({
      playerId: 'p1',
      perkId: 'perk1',
      sourceType: 'TIER',
      sourceId: 'tier.silver',
      idempotencyKey: 'tier:silver:p1',
    });

    expect(out).toEqual({ ok: false, reason: 'staff_at_venue' });
    // Staff gate is scoped to the venue owning the perk.
    expect(venueStaff.isStaffAtVenue).toHaveBeenCalledWith('p1', 'v1');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

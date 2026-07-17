jest.mock('../player/player.service', () => ({ PlayerService: class PlayerService {} }));
jest.mock('../venue/venue.service', () => ({ VenueService: class VenueService {} }));
jest.mock('../reward/player-reward-grant.service', () => ({
  PlayerRewardGrantService: class PlayerRewardGrantService {},
}));
jest.mock('../reward/xp-tier-reward.service', () => ({
  XpTierRewardService: class XpTierRewardService {},
}));

import { Test } from '@nestjs/testing';
import { ChallengeAutoProgressSource } from '@prisma/client';
import { PlayerService } from '../player/player.service';
import { VenueService } from '../venue/venue.service';
import { PlayerVenueStatsRepository } from '../stats/player-venue-stats.repository';
import { VenueModerationService } from '../venue/venue-moderation.service';
import { PlayerRewardGrantService } from '../reward/player-reward-grant.service';
import { XpTierRewardService } from '../reward/xp-tier-reward.service';
import { ChallengeRepository, type ChallengeTargetRow } from './challenge.repository';
import { ChallengeService } from './challenge.service';

const VENUE_ID = 'v1';
const PLAYER_ID = 'p1';
const CHALLENGE_ID = 'c1';

const targetRow: ChallengeTargetRow = {
  id: CHALLENGE_ID,
  venueId: VENUE_ID,
  targetCount: 1,
  rewardVenueSpecific: false,
  locationRequired: false,
  resetsWeekly: false,
  scheduleType: 'ALWAYS',
  activeFrom: null,
  activeTo: null,
  dailyStartMinutes: null,
  dailyEndMinutes: null,
  rewardPerkId: 'perk1',
  autoProgressSource: ChallengeAutoProgressSource.PRESENCE,
  requiresWin: false,
};

describe('ChallengeService challenge completion reward copy', () => {
  let service: ChallengeService;
  let challenges: {
    getVenueTimeZone: jest.Mock;
    findByVenueId: jest.Mock;
    getChallengeTarget: jest.Mock;
    findProgress: jest.Mock;
    upsertProgressCount: jest.Mock;
    markRewardClaimed: jest.Mock;
  };
  let rewardGrants: { tryIssueChallengePerkGrant: jest.Mock };

  beforeEach(async () => {
    challenges = {
      getVenueTimeZone: jest.fn().mockResolvedValue(null),
      findByVenueId: jest.fn().mockResolvedValue([
        {
          id: CHALLENGE_ID,
          title: 'Visit us',
          autoProgressSource: ChallengeAutoProgressSource.PRESENCE,
          scheduleType: 'ALWAYS',
          activeFrom: null,
          activeTo: null,
          dailyStartMinutes: null,
          dailyEndMinutes: null,
          rewardPerk: { title: 'Free espresso' },
        },
      ]),
      getChallengeTarget: jest.fn().mockResolvedValue(targetRow),
      findProgress: jest.fn().mockResolvedValue(null),
      upsertProgressCount: jest
        .fn()
        .mockResolvedValue({ challengeId: CHALLENGE_ID, progressCount: 1 }),
      markRewardClaimed: jest.fn().mockResolvedValue(undefined),
    };
    rewardGrants = {
      tryIssueChallengePerkGrant: jest
        .fn()
        .mockResolvedValue({ ok: true, redemptionId: 'r1', grantId: 'g1' }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ChallengeService,
        { provide: ChallengeRepository, useValue: challenges },
        { provide: PlayerService, useValue: {} },
        {
          provide: PlayerVenueStatsRepository,
          useValue: { addVenueXp: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: VenueService,
          useValue: { findOne: jest.fn().mockResolvedValue({ id: VENUE_ID, locked: false }) },
        },
        {
          provide: VenueModerationService,
          useValue: { assertNotBanned: jest.fn().mockResolvedValue(undefined) },
        },
        { provide: PlayerRewardGrantService, useValue: rewardGrants },
        {
          provide: XpTierRewardService,
          useValue: { syncTierRewards: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();
    service = moduleRef.get(ChallengeService);
  });

  const bumpParams = {
    playerId: PLAYER_ID,
    venueId: VENUE_ID,
    trustVenuePresence: true,
    activityAtVenue: true,
    countsAsWin: true,
    source: ChallengeAutoProgressSource.PRESENCE,
  };

  it('omits the perk title when the grant is denied for staff_at_venue', async () => {
    rewardGrants.tryIssueChallengePerkGrant.mockResolvedValue({
      ok: false,
      reason: 'staff_at_venue',
    });

    const results = await service.bumpActiveChallengesForPlayerAtVenue(bumpParams);

    expect(results).toHaveLength(1);
    const bump = results[0]!;
    expect(bump.newlyCompleted).toBe(true);
    expect(bump.perkGranted).toBe(false);
    expect(bump.perkTitle).toBeNull();
    expect(challenges.markRewardClaimed).not.toHaveBeenCalled();
  });

  it('keeps the perk title when the grant succeeds', async () => {
    const results = await service.bumpActiveChallengesForPlayerAtVenue(bumpParams);

    expect(results).toHaveLength(1);
    const bump = results[0]!;
    expect(bump.newlyCompleted).toBe(true);
    expect(bump.perkGranted).toBe(true);
    expect(bump.perkTitle).toBe('Free espresso');
    expect(challenges.markRewardClaimed).toHaveBeenCalled();
  });

  it('keeps the perk title for other denial reasons (e.g. sold_out)', async () => {
    rewardGrants.tryIssueChallengePerkGrant.mockResolvedValue({
      ok: false,
      reason: 'sold_out',
    });

    const results = await service.bumpActiveChallengesForPlayerAtVenue(bumpParams);

    expect(results).toHaveLength(1);
    expect(results[0]!.perkGranted).toBe(false);
    expect(results[0]!.perkTitle).toBe('Free espresso');
  });
});

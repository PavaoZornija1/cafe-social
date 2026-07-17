import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ChallengeAutoProgressSource, ChallengeProgress } from '@prisma/client';
import { ChallengeAutoProgressSource as ChallengeAutoProgressSourceEnum } from '@prisma/client';
import { PlayerService } from '../player/player.service';
import { VenueService } from '../venue/venue.service';
import { ChallengeRepository, type ChallengeTargetRow } from './challenge.repository';
import { PlayerVenueStatsRepository } from '../stats/player-venue-stats.repository';
import { VenueModerationService } from '../venue/venue-moderation.service';
import { PlayerRewardGrantService } from '../reward/player-reward-grant.service';
import { XpTierRewardService } from '../reward/xp-tier-reward.service';
import { isoWeekKeyUTC } from '../lib/week-key';
import { staffVerificationCodeFromRedemptionId } from '../lib/redemption-staff-code';
import {
  formatDailyWindowLabel,
  getChallengeWindowStatus,
  isChallengeActiveWindow,
  type ChallengeScheduleInput,
  type ChallengeWindowStatus,
} from '../lib/challenge-window';
import type { ChallengeBumpResult } from '../post-game/post-game.types';

export type VenueChallengeDto = {
  id: string;
  title: string;
  description: string | null;
  rewardVenueSpecific: boolean;
  locationRequired: boolean;
  targetCount: number;
  progressCount: number;
  isCompleted: boolean;
  resetsWeekly: boolean;
  rewardPerkId: string | null;
  rewardTitle: string | null;
  /** Staff-redeemable perk claim from completing this challenge (if any). */
  rewardRedemptionId: string | null;
  rewardRedemptionStatus: string | null;
  rewardStaffCode: string | null;
  autoProgressSource: ChallengeAutoProgressSource;
  requiresWin: boolean;
  scheduleType: string;
  windowStatus: ChallengeWindowStatus;
  nextOpensAt: string | null;
  scheduleLabel: string | null;
};

@Injectable()
export class ChallengeService {
  constructor(
    private readonly challenges: ChallengeRepository,
    private readonly players: PlayerService,
    private readonly venueStats: PlayerVenueStatsRepository,
    private readonly venues: VenueService,
    private readonly moderation: VenueModerationService,
    private readonly rewardGrants: PlayerRewardGrantService,
    private readonly tierRewards: XpTierRewardService,
  ) {}

  private scheduleForChallenge(
    c: Pick<
      ChallengeTargetRow,
      | 'scheduleType'
      | 'activeFrom'
      | 'activeTo'
      | 'dailyStartMinutes'
      | 'dailyEndMinutes'
    >,
    venueTimeZone: string | null,
  ): ChallengeScheduleInput {
    return {
      scheduleType: c.scheduleType,
      activeFrom: c.activeFrom,
      activeTo: c.activeTo,
      dailyStartMinutes: c.dailyStartMinutes,
      dailyEndMinutes: c.dailyEndMinutes,
      venueTimeZone,
    };
  }

  private scheduleLabel(
    c: Pick<
      ChallengeTargetRow,
      'scheduleType' | 'dailyStartMinutes' | 'dailyEndMinutes'
    >,
    venueTimeZone: string | null,
  ): string | null {
    if (
      c.scheduleType === 'DAILY_RECURRING' &&
      c.dailyStartMinutes != null &&
      c.dailyEndMinutes != null
    ) {
      return formatDailyWindowLabel(c.dailyStartMinutes, c.dailyEndMinutes, venueTimeZone);
    }
    return null;
  }

  async getVenueChallengesForPlayer(venueId: string, email: string): Promise<VenueChallengeDto[]> {
    const player = await this.players.findOrCreateByEmail(email);

    const venueRow = await this.venues.findOne(venueId);
    if (venueRow.locked) {
      throw new NotFoundException('Venue not found');
    }

    const venueTimeZone = await this.challenges.getVenueTimeZone(venueId);
    const now = new Date();
    const challengeRows = await this.challenges.findByVenueId(venueId);

    const visible = challengeRows.filter((c) => {
      const schedule = this.scheduleForChallenge(c, venueTimeZone);
      const { status } = getChallengeWindowStatus(schedule, now);
      return status === 'active' || status === 'upcoming';
    });

    const progresses = await this.challenges.findProgresses(
      player.id,
      visible.map((c) => c.id),
    );

    const progressByChallengeId = new Map<string, ChallengeProgress>();
    for (const p of progresses) progressByChallengeId.set(p.challengeId, p);

    const grants = await this.challenges.findChallengePerkRedemptions(
      player.id,
      visible.map((c) => c.id),
    );
    const rewardByChallengeId = new Map<
      string,
      { redemptionId: string; status: string; expiresAt: Date }
    >();
    for (const g of grants) {
      if (!g.sourceId || !g.redemption) continue;
      if (rewardByChallengeId.has(g.sourceId)) continue;
      let status = g.redemption.status;
      if (
        status === 'REDEEMABLE' &&
        g.redemption.expiresAt.getTime() <= now.getTime()
      ) {
        status = 'EXPIRED';
      }
      rewardByChallengeId.set(g.sourceId, {
        redemptionId: g.redemption.id,
        status,
        expiresAt: g.redemption.expiresAt,
      });
    }

    const weekKey = isoWeekKeyUTC();

    return visible.map((c) => {
      const p = progressByChallengeId.get(c.id);
      let progressCount = p?.progressCount ?? 0;
      let isCompleted = !!p?.completedAt;
      if (c.resetsWeekly) {
        if (!p || p.periodKey !== weekKey) {
          progressCount = 0;
          isCompleted = false;
        }
      }

      const schedule = this.scheduleForChallenge(c, venueTimeZone);
      const window = getChallengeWindowStatus(schedule, now);
      const reward = rewardByChallengeId.get(c.id);

      return {
        id: c.id,
        title: c.title,
        description: c.description,
        rewardVenueSpecific: c.rewardVenueSpecific,
        locationRequired: c.locationRequired,
        targetCount: c.targetCount,
        progressCount,
        isCompleted,
        resetsWeekly: c.resetsWeekly,
        rewardPerkId: c.rewardPerkId,
        rewardTitle: c.rewardPerk?.title ?? null,
        rewardRedemptionId: reward?.redemptionId ?? null,
        rewardRedemptionStatus: reward?.status ?? null,
        rewardStaffCode: reward?.redemptionId
          ? staffVerificationCodeFromRedemptionId(reward.redemptionId)
          : null,
        autoProgressSource: c.autoProgressSource,
        requiresWin: c.requiresWin,
        scheduleType: c.scheduleType,
        windowStatus: window.status,
        nextOpensAt: window.nextOpensAt?.toISOString() ?? null,
        scheduleLabel: this.scheduleLabel(c, venueTimeZone),
      };
    });
  }

  async incrementChallengeProgress(params: {
    venueId: string;
    challengeId: string;
    email: string;
    increment: number;
    latitude?: number;
    longitude?: number;
    trustVenuePresence?: boolean;
    activityAtVenue?: boolean;
  }): Promise<{
    challengeId: string;
    progressCount: number;
    isCompleted: boolean;
  }> {
    const {
      venueId,
      challengeId,
      email,
      increment,
      latitude,
      longitude,
      trustVenuePresence,
      activityAtVenue,
    } = params;

    if (!email) throw new UnauthorizedException('Missing user email');
    if (increment <= 0) throw new BadRequestException('increment must be > 0');

    const player = await this.players.findOrCreateByEmail(email);

    await this.moderation.assertNotBanned(venueId, player.id);

    const venueRow = await this.venues.findOne(venueId);
    if (venueRow.locked) {
      throw new NotFoundException('Venue not found');
    }

    const challenge = await this.challenges.getChallengeTarget(challengeId);
    if (!challenge) throw new BadRequestException('Challenge not found');
    if (challenge.venueId !== venueId) {
      throw new BadRequestException('Challenge does not belong to this venue');
    }

    const venueTimeZone = await this.challenges.getVenueTimeZone(venueId);
    const schedule = this.scheduleForChallenge(challenge, venueTimeZone);
    if (!isChallengeActiveWindow(schedule)) {
      throw new BadRequestException('This challenge is not active during the current time window');
    }

    if (challenge.autoProgressSource !== ChallengeAutoProgressSourceEnum.MANUAL) {
      throw new BadRequestException(
        'This challenge progresses automatically when you complete the related activity',
      );
    }

    return this.applyChallengeProgress({
      playerId: player.id,
      venueId,
      challengeId,
      increment,
      latitude,
      longitude,
      trustVenuePresence,
      activityAtVenue,
      challenge,
      challengeTitle: (await this.challenges.findTitleById(challengeId)) ?? 'Challenge',
      perkTitle: (await this.challenges.findPerkTitleById(challengeId)) ?? null,
      venueTimeZone,
    }).then((bump) => {
      if (bump) {
        return {
          challengeId: bump.challengeId,
          progressCount: bump.progressCount,
          isCompleted: bump.newlyCompleted || bump.progressCount >= bump.targetCount,
        };
      }
      return this.progressSnapshot(player.id, challengeId, challenge);
    });
  }

  private async applyChallengeProgress(params: {
    playerId: string;
    venueId: string;
    challengeId: string;
    increment: number;
    latitude?: number;
    longitude?: number;
    trustVenuePresence?: boolean;
    activityAtVenue?: boolean;
    countsAsWin?: boolean;
    challenge: ChallengeTargetRow;
    challengeTitle: string;
    perkTitle?: string | null;
    venueTimeZone: string | null;
  }): Promise<ChallengeBumpResult | null> {
    const {
      playerId,
      venueId,
      challengeId,
      increment,
      latitude,
      longitude,
      trustVenuePresence,
      activityAtVenue,
      countsAsWin,
      challenge,
      venueTimeZone,
    } = params;
    const challengeTitle = params.challengeTitle;
    const perkTitleHint = params.perkTitle ?? null;

    if (challenge.requiresWin && countsAsWin === false) {
      return null;
    }

    const schedule = this.scheduleForChallenge(challenge, venueTimeZone);
    if (!isChallengeActiveWindow(schedule)) {
      throw new BadRequestException('This challenge is not active during the current time window');
    }

    if (challenge.locationRequired) {
      const atVenueViaActivity = Boolean(trustVenuePresence && activityAtVenue);
      if (!atVenueViaActivity) {
        const hasCoords =
          typeof latitude === 'number' &&
          typeof longitude === 'number' &&
          Number.isFinite(latitude) &&
          Number.isFinite(longitude);
        if (!hasCoords) {
          throw new UnauthorizedException(
            'Location (lat/lng) is required to progress this challenge at the venue',
          );
        }
        await this.venues.assertCoordinatesAllowedForGuestVenue(venueId, latitude!, longitude!);
      }
    } else if (
      !trustVenuePresence &&
      challenge.rewardVenueSpecific
    ) {
      const hasCoords =
        typeof latitude === 'number' &&
        typeof longitude === 'number' &&
        Number.isFinite(latitude) &&
        Number.isFinite(longitude);
      if (!hasCoords) {
        throw new UnauthorizedException(
          'Location (lat/lng) is required to progress this challenge at the venue',
        );
      }
      await this.venues.assertCoordinatesAllowedForGuestVenue(venueId, latitude!, longitude!);
    }

    const weekKey = isoWeekKeyUTC();
    const existingProgress = await this.challenges.findProgress(playerId, challengeId);
    let currentCount = existingProgress?.progressCount ?? 0;
    let completedForPeriod = !!existingProgress?.completedAt;

    if (challenge.resetsWeekly) {
      if (!existingProgress || existingProgress.periodKey !== weekKey) {
        currentCount = 0;
        completedForPeriod = false;
      }
    }

    if (completedForPeriod) {
      return null;
    }

    const previousCount = currentCount;
    const newCount = currentCount + increment;
    const isCompleted = newCount >= challenge.targetCount;
    const completedAt = isCompleted ? new Date() : null;
    const newlyCompleted = isCompleted && !completedForPeriod;

    const updated = await this.challenges.upsertProgressCount({
      playerId,
      challengeId,
      newCount,
      completedAt,
      periodKey: challenge.resetsWeekly ? weekKey : undefined,
    });

    let perkGranted = false;
    let perkTitle: string | null = perkTitleHint;

    if (newlyCompleted && challenge.rewardPerkId) {
      const grant = await this.rewardGrants.tryIssueChallengePerkGrant({
        playerId,
        venueId: challenge.venueId,
        challengeId,
        perkId: challenge.rewardPerkId,
        resetsWeekly: challenge.resetsWeekly,
        weekKey: challenge.resetsWeekly ? weekKey : undefined,
      });
      if (grant.ok) {
        perkGranted = true;
        await this.challenges.markRewardClaimed(playerId, challengeId, new Date());
      } else if (grant.reason === 'staff_at_venue') {
        // Staff completed the challenge but earn no guest reward at their own
        // venue — drop the perk title so post-game copy doesn't imply a grant.
        perkTitle = null;
      }
    }

    const challengeXpGain = increment * 10 + (newlyCompleted ? 50 : 0);
    await this.venueStats.addVenueXp(playerId, challenge.venueId, challengeXpGain);
    await this.tierRewards.syncTierRewards(playerId);

    return {
      challengeId: updated.challengeId,
      title: challengeTitle,
      previousCount,
      progressCount: updated.progressCount,
      targetCount: challenge.targetCount,
      newlyCompleted,
      perkTitle,
      challengeXpGain,
      perkGranted,
    };
  }

  private async progressSnapshot(
    playerId: string,
    challengeId: string,
    challenge: ChallengeTargetRow,
  ) {
    const existingProgress = await this.challenges.findProgress(playerId, challengeId);
    let currentCount = existingProgress?.progressCount ?? 0;
    let isCompleted = !!existingProgress?.completedAt;
    if (challenge.resetsWeekly) {
      const weekKey = isoWeekKeyUTC();
      if (!existingProgress || existingProgress.periodKey !== weekKey) {
        currentCount = 0;
        isCompleted = false;
      }
    }
    return { challengeId, progressCount: currentCount, isCompleted };
  }

  async bumpActiveChallengesForPlayerAtVenue(params: {
    playerId: string;
    venueId: string;
    increment?: number;
    trustVenuePresence?: boolean;
    activityAtVenue?: boolean;
    countsAsWin?: boolean;
    latitude?: number;
    longitude?: number;
    source: ChallengeAutoProgressSource;
  }): Promise<ChallengeBumpResult[]> {
    const increment = params.increment ?? 1;
    if (increment <= 0) return [];

    await this.moderation.assertNotBanned(params.venueId, params.playerId);

    const venueRow = await this.venues.findOne(params.venueId);
    if (venueRow.locked) return [];

    const venueTimeZone = await this.challenges.getVenueTimeZone(params.venueId);
    const now = new Date();
    const challengeRows = (await this.challenges.findByVenueId(params.venueId)).filter((c) => {
      if (c.autoProgressSource !== params.source) return false;
      const schedule = this.scheduleForChallenge(c, venueTimeZone);
      return isChallengeActiveWindow(schedule, now);
    });

    const results: ChallengeBumpResult[] = [];
    for (const challenge of challengeRows) {
      try {
        const target = await this.challenges.getChallengeTarget(challenge.id);
        if (!target) continue;

        const bump = await this.applyChallengeProgress({
          playerId: params.playerId,
          venueId: params.venueId,
          challengeId: challenge.id,
          increment,
          trustVenuePresence: params.trustVenuePresence,
          activityAtVenue: params.activityAtVenue,
          countsAsWin: params.countsAsWin,
          latitude: params.latitude,
          longitude: params.longitude,
          challenge: target,
          challengeTitle: challenge.title,
          perkTitle: challenge.rewardPerk?.title ?? null,
          venueTimeZone,
        });
        if (bump) results.push(bump);
      } catch {
        /* skip challenges that require coords or are already complete */
      }
    }
    return results;
  }
}

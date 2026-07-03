import {
  BadRequestException,
  ForbiddenException,
  Injectable,
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
import {
  formatDailyWindowLabel,
  getChallengeWindowStatus,
  isChallengeActiveWindow,
  type ChallengeScheduleInput,
  type ChallengeWindowStatus,
} from '../lib/challenge-window';

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
    if (venueRow.locked) return [];

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
      throw new ForbiddenException('This venue is temporarily unavailable');
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
      venueTimeZone,
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
    venueTimeZone: string | null;
  }): Promise<{
    challengeId: string;
    progressCount: number;
    isCompleted: boolean;
  }> {
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

    if (challenge.requiresWin && countsAsWin === false) {
      return this.progressSnapshot(playerId, challengeId, challenge);
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
      return {
        challengeId,
        progressCount: currentCount,
        isCompleted: true,
      };
    }

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
        await this.challenges.markRewardClaimed(playerId, challengeId, new Date());
      }
    }

    const xpGain = increment * 10 + (newlyCompleted ? 50 : 0);
    await this.venueStats.addVenueXp(playerId, challenge.venueId, xpGain);
    await this.tierRewards.syncTierRewards(playerId);

    return {
      challengeId: updated.challengeId,
      progressCount: updated.progressCount,
      isCompleted: !!updated.completedAt,
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
  }): Promise<void> {
    const increment = params.increment ?? 1;
    if (increment <= 0) return;

    await this.moderation.assertNotBanned(params.venueId, params.playerId);

    const venueRow = await this.venues.findOne(params.venueId);
    if (venueRow.locked) return;

    const venueTimeZone = await this.challenges.getVenueTimeZone(params.venueId);
    const now = new Date();
    const challengeRows = (await this.challenges.findByVenueId(params.venueId)).filter((c) => {
      if (c.autoProgressSource !== params.source) return false;
      const schedule = this.scheduleForChallenge(c, venueTimeZone);
      return isChallengeActiveWindow(schedule, now);
    });

    for (const challenge of challengeRows) {
      try {
        const target = await this.challenges.getChallengeTarget(challenge.id);
        if (!target) continue;

        await this.applyChallengeProgress({
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
          venueTimeZone,
        });
      } catch {
        /* skip challenges that require coords or are already complete */
      }
    }
  }
}

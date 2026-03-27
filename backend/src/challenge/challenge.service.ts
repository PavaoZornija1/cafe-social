import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Challenge, ChallengeProgress } from '@prisma/client';
import { PlayerService } from '../player/player.service';
import { VenueService } from '../venue/venue.service';
import { ChallengeRepository } from './challenge.repository';
import { PlayerVenueStatsRepository } from '../stats/player-venue-stats.repository';
import { isoWeekKeyUTC } from '../lib/week-key';
import { isChallengeActiveWindow } from '../lib/challenge-window';

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
};

@Injectable()
export class ChallengeService {
  constructor(
    private readonly challenges: ChallengeRepository,
    private readonly players: PlayerService,
    private readonly venueStats: PlayerVenueStatsRepository,
    private readonly venues: VenueService,
  ) {}

  async getVenueChallengesForPlayer(venueId: string, email: string): Promise<VenueChallengeDto[]> {
    const player = await this.players.findOrCreateByEmail(email);

    const now = new Date();
    const challengeRows = (await this.challenges.findByVenueId(venueId)).filter((c) =>
      isChallengeActiveWindow(c.activeFrom, c.activeTo, now),
    );
    const progresses = await this.challenges.findProgresses(
      player.id,
      challengeRows.map((c) => c.id),
    );

    const progressByChallengeId = new Map<string, ChallengeProgress>();
    for (const p of progresses) progressByChallengeId.set(p.challengeId, p);

    const weekKey = isoWeekKeyUTC();

    return challengeRows.map((c: Challenge) => {
      const p = progressByChallengeId.get(c.id);
      let progressCount = p?.progressCount ?? 0;
      let isCompleted = !!p?.completedAt;
      if (c.resetsWeekly) {
        if (!p || p.periodKey !== weekKey) {
          progressCount = 0;
          isCompleted = false;
        }
      }

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
  }): Promise<{
    challengeId: string;
    progressCount: number;
    isCompleted: boolean;
  }> {
    const { venueId, challengeId, email, increment, latitude, longitude } = params;

    if (!email) throw new UnauthorizedException('Missing user email');
    if (increment <= 0) throw new BadRequestException('increment must be > 0');

    const player = await this.players.findOrCreateByEmail(email);

    const challenge = await this.challenges.getChallengeTarget(challengeId);
    if (!challenge) throw new BadRequestException('Challenge not found');
    if (challenge.venueId !== venueId) throw new BadRequestException('Challenge does not belong to this venue');
    if (!isChallengeActiveWindow(challenge.activeFrom, challenge.activeTo)) {
      throw new BadRequestException('This challenge is not active during the current time window');
    }

    const requiresPresence = challenge.locationRequired || challenge.rewardVenueSpecific;

    if (requiresPresence) {
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
      const at = await this.venues.findVenueAtCoordinates(latitude!, longitude!);
      if (!at || at.id !== venueId) {
        throw new UnauthorizedException('You must be physically at the venue to progress this challenge');
      }
    }

    const weekKey = isoWeekKeyUTC();
    const existingProgress = await this.challenges.findProgress(player.id, challengeId);
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
      playerId: player.id,
      challengeId,
      newCount,
      completedAt,
      periodKey: challenge.resetsWeekly ? weekKey : undefined,
    });

    const xpGain = increment * 10 + (newlyCompleted ? 50 : 0);
    await this.venueStats.addVenueXp(player.id, challenge.venueId, xpGain);

    return {
      challengeId: updated.challengeId,
      progressCount: updated.progressCount,
      isCompleted: !!updated.completedAt,
    };
  }
}


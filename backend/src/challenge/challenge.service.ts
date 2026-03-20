import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Challenge, ChallengeProgress } from '@prisma/client';
import { PlayerService } from '../player/player.service';
import { ChallengeRepository } from './challenge.repository';
import { PlayerVenueStatsRepository } from '../stats/player-venue-stats.repository';

export type VenueChallengeDto = {
  id: string;
  title: string;
  description: string | null;
  rewardVenueSpecific: boolean;
  locationRequired: boolean;
  targetCount: number;
  progressCount: number;
  isCompleted: boolean;
};

@Injectable()
export class ChallengeService {
  constructor(
    private readonly challenges: ChallengeRepository,
    private readonly players: PlayerService,
    private readonly venueStats: PlayerVenueStatsRepository,
  ) {}

  async getVenueChallengesForPlayer(venueId: string, email: string): Promise<VenueChallengeDto[]> {
    const player = await this.players.findOrCreateByEmail(email);

    const challengeRows = await this.challenges.findByVenueId(venueId);
    const progresses = await this.challenges.findProgresses(
      player.id,
      challengeRows.map((c) => c.id),
    );

    const progressByChallengeId = new Map<string, ChallengeProgress>();
    for (const p of progresses) progressByChallengeId.set(p.challengeId, p);

    return challengeRows.map((c: Challenge) => {
      const p = progressByChallengeId.get(c.id);
      const progressCount = p?.progressCount ?? 0;
      const isCompleted = !!p?.completedAt;

      return {
        id: c.id,
        title: c.title,
        description: c.description,
        rewardVenueSpecific: c.rewardVenueSpecific,
        locationRequired: c.locationRequired,
        targetCount: c.targetCount,
        progressCount,
        isCompleted,
      };
    });
  }

  async incrementChallengeProgress(params: {
    venueId: string;
    challengeId: string;
    email: string;
    increment: number;
    detectedVenueId?: string | null;
  }): Promise<{
    challengeId: string;
    progressCount: number;
    isCompleted: boolean;
  }> {
    const { venueId, challengeId, email, increment, detectedVenueId } = params;

    if (!email) throw new UnauthorizedException('Missing user email');
    if (increment <= 0) throw new BadRequestException('increment must be > 0');

    const player = await this.players.findOrCreateByEmail(email);

    const challenge = await this.challenges.getChallengeTarget(challengeId);
    if (!challenge) throw new BadRequestException('Challenge not found');
    if (challenge.venueId !== venueId) throw new BadRequestException('Challenge does not belong to this venue');

    const venueIsPremium = await this.challenges.getVenueIsPremium(venueId);

    const hasQrUnlock = await this.challenges.hasPlayerVenue(player.id, venueId);

    // Presence gate logic:
    // - locationRequired always requires presence (detected venue == venueId)
    // - premium + rewardVenueSpecific without QR unlock requires presence (exception rule)
    const requiresPresence =
      challenge.locationRequired || (challenge.rewardVenueSpecific && venueIsPremium && !hasQrUnlock);

    if (requiresPresence) {
      const presenceVenueId = detectedVenueId ?? (await this.challenges.detectDefaultVenueId());
      if (!presenceVenueId || presenceVenueId !== venueId) {
        throw new UnauthorizedException('You must be physically at the venue to progress this challenge');
      }
    }

    // QR membership gate:
    // - Non-premium rewardVenueSpecific challenges require QR unlock.
    // - Premium rewardVenueSpecific challenges are allowed with subscription, but presence is required above.
    if (challenge.rewardVenueSpecific && !venueIsPremium && !hasQrUnlock) {
      throw new UnauthorizedException('Scan QR to unlock this venue-specific challenge');
    }

    const existingProgress = await this.challenges.findProgress(player.id, challengeId);
    const currentCount = existingProgress?.progressCount ?? 0;
    if (existingProgress?.completedAt) {
      // Already completed: idempotent.
      return {
        challengeId,
        progressCount: currentCount,
        isCompleted: true,
      };
    }

    const newCount = currentCount + increment;
    const isCompleted = newCount >= challenge.targetCount;
    const completedAt = isCompleted ? new Date() : null;
    const newlyCompleted = isCompleted && !existingProgress?.completedAt;

    const updated = await this.challenges.upsertProgressCount({
      playerId: player.id,
      challengeId,
      newCount,
      completedAt,
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


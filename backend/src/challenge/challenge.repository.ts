import { Injectable } from '@nestjs/common';
import type {
  ChallengeAutoProgressSource,
  ChallengeProgress,
  ChallengeScheduleType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type ChallengeTargetRow = {
  id: string;
  venueId: string;
  targetCount: number;
  rewardVenueSpecific: boolean;
  locationRequired: boolean;
  resetsWeekly: boolean;
  scheduleType: ChallengeScheduleType;
  activeFrom: Date | null;
  activeTo: Date | null;
  dailyStartMinutes: number | null;
  dailyEndMinutes: number | null;
  rewardPerkId: string | null;
  autoProgressSource: ChallengeAutoProgressSource;
  requiresWin: boolean;
};

@Injectable()
export class ChallengeRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByVenueId(venueId: string) {
    return this.prisma.challenge.findMany({
      where: { venueId },
      orderBy: { createdAt: 'asc' },
      include: {
        rewardPerk: { select: { id: true, title: true } },
      },
    });
  }

  createChallenge(data: {
    venueId: string;
    title: string;
    description?: string | null;
    autoProgressSource: ChallengeAutoProgressSource;
    rewardVenueSpecific: boolean;
    locationRequired: boolean;
    targetCount: number;
    resetsWeekly: boolean;
    scheduleType: ChallengeScheduleType;
    activeFrom?: Date | null;
    activeTo?: Date | null;
    dailyStartMinutes?: number | null;
    dailyEndMinutes?: number | null;
    requiresWin: boolean;
    rewardPerkId?: string | null;
  }) {
    return this.prisma.challenge.create({ data });
  }

  deleteChallenge(id: string) {
    return this.prisma.challenge.delete({ where: { id } });
  }

  getVenueTimeZone(venueId: string): Promise<string | null> {
    return this.prisma.venue
      .findUnique({
        where: { id: venueId },
        select: { analyticsTimeZone: true },
      })
      .then((v) => v?.analyticsTimeZone?.trim() || null);
  }

  findProgresses(
    playerId: string,
    challengeIds: string[],
  ): Promise<ChallengeProgress[]> {
    if (challengeIds.length === 0) return Promise.resolve([]);

    return this.prisma.challengeProgress.findMany({
      where: {
        playerId,
        challengeId: { in: challengeIds },
      },
    });
  }

  getChallengeTarget(challengeId: string): Promise<ChallengeTargetRow | null> {
    return this.prisma.challenge.findUnique({
      where: { id: challengeId },
      select: {
        id: true,
        venueId: true,
        targetCount: true,
        rewardVenueSpecific: true,
        locationRequired: true,
        resetsWeekly: true,
        scheduleType: true,
        activeFrom: true,
        activeTo: true,
        dailyStartMinutes: true,
        dailyEndMinutes: true,
        rewardPerkId: true,
        autoProgressSource: true,
        requiresWin: true,
      },
    });
  }

  findTitleById(challengeId: string): Promise<string | null> {
    return this.prisma.challenge
      .findUnique({ where: { id: challengeId }, select: { title: true } })
      .then((row) => row?.title ?? null);
  }

  findPerkTitleById(challengeId: string): Promise<string | null> {
    return this.prisma.challenge
      .findUnique({
        where: { id: challengeId },
        select: { rewardPerk: { select: { title: true } } },
      })
      .then((row) => row?.rewardPerk?.title ?? null);
  }

  getVenueIsPremium(venueId: string): Promise<boolean> {
    return this.prisma.venue
      .findUnique({
        where: { id: venueId },
        select: { isPremium: true },
      })
      .then((v) => v?.isPremium ?? false);
  }

  findProgress(playerId: string, challengeId: string): Promise<ChallengeProgress | null> {
    return this.prisma.challengeProgress.findUnique({
      where: {
        playerId_challengeId: { playerId, challengeId },
      },
    });
  }

  upsertProgressCount(params: {
    playerId: string;
    challengeId: string;
    newCount: number;
    completedAt: Date | null;
    periodKey?: string | null;
  }): Promise<ChallengeProgress> {
    const { playerId, challengeId, newCount, completedAt, periodKey } = params;

    return this.prisma.challengeProgress.upsert({
      where: {
        playerId_challengeId: { playerId, challengeId },
      },
      create: {
        playerId,
        challengeId,
        progressCount: newCount,
        completedAt,
        periodKey: periodKey ?? null,
      },
      update: {
        progressCount: newCount,
        completedAt: completedAt ?? undefined,
        ...(periodKey !== undefined ? { periodKey } : {}),
      },
    });
  }

  markRewardClaimed(playerId: string, challengeId: string, claimedAt: Date): Promise<void> {
    return this.prisma.challengeProgress
      .update({
        where: {
          playerId_challengeId: { playerId, challengeId },
        },
        data: { rewardClaimedAt: claimedAt },
      })
      .then(() => undefined);
  }

  /** Latest perk redemption issued for each challenge (sourceType CHALLENGE). */
  findChallengePerkRedemptions(playerId: string, challengeIds: string[]) {
    if (challengeIds.length === 0) return Promise.resolve([]);
    return this.prisma.playerRewardGrant.findMany({
      where: {
        playerId,
        sourceType: 'CHALLENGE',
        sourceId: { in: challengeIds },
      },
      include: {
        redemption: {
          select: {
            id: true,
            status: true,
            expiresAt: true,
            redeemedAt: true,
          },
        },
      },
      orderBy: { issuedAt: 'desc' },
    });
  }
}

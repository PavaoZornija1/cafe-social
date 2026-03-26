import { Injectable } from '@nestjs/common';
import type { Challenge, ChallengeProgress } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChallengeRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByVenueId(venueId: string): Promise<Challenge[]> {
    return this.prisma.challenge.findMany({
      where: { venueId },
      orderBy: { createdAt: 'asc' },
    });
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

  detectDefaultVenueId(): Promise<string | null> {
    return this.prisma.venue.findFirst({
      where: { isPremium: false },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    }).then((v) => v?.id ?? null);
  }

  hasPlayerVenue(playerId: string, venueId: string): Promise<boolean> {
    return this.prisma.playerVenue
      .findUnique({
        where: { playerId_venueId: { playerId, venueId } },
        select: { id: true },
      })
      .then((row) => !!row);
  }

  getChallengeTarget(challengeId: string): Promise<{
    id: string;
    venueId: string;
    targetCount: number;
    rewardVenueSpecific: boolean;
    locationRequired: boolean;
    resetsWeekly: boolean;
    activeFrom: Date | null;
    activeTo: Date | null;
  } | null> {
    return this.prisma.challenge.findUnique({
      where: { id: challengeId },
      select: {
        id: true,
        venueId: true,
        targetCount: true,
        rewardVenueSpecific: true,
        locationRequired: true,
        resetsWeekly: true,
        activeFrom: true,
        activeTo: true,
      },
    });
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
    /** When omitted, `periodKey` is not changed on update (non-weekly challenges). */
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
}


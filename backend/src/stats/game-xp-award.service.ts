import { Injectable } from '@nestjs/common';
import { GameParticipantResult, GameSessionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PlayerVenueStatsRepository } from './player-venue-stats.repository';
import { XP_GLOBAL_WIN, XP_VENUE_WIN } from '../lib/xp-rewards';

@Injectable()
export class GameXpAwardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly venueStats: PlayerVenueStatsRepository,
  ) {}

  /**
   * Awards XP once per finished session for every participant with WIN.
   * Word match + brawler (any GameSession that finishes with WIN rows).
   */
  async tryAwardSessionWinXp(sessionId: string): Promise<void> {
    const claim = await this.prisma.gameSession.updateMany({
      where: {
        id: sessionId,
        status: GameSessionStatus.FINISHED,
        winXpAwardedAt: null,
      },
      data: { winXpAwardedAt: new Date() },
    });
    if (claim.count === 0) return;

    const session = await this.prisma.gameSession.findUnique({
      where: { id: sessionId },
      select: {
        venueId: true,
        participants: { select: { playerId: true, result: true } },
      },
    });
    if (!session) return;

    const delta = session.venueId ? XP_VENUE_WIN : XP_GLOBAL_WIN;
    for (const p of session.participants) {
      if (!p.playerId || p.result !== GameParticipantResult.WIN) continue;
      if (session.venueId) {
        await this.venueStats.addVenueXp(p.playerId, session.venueId, delta);
      } else {
        await this.prisma.player.update({
          where: { id: p.playerId },
          data: { bonusXp: { increment: delta } },
        });
      }
    }
  }

  /** Solo word deck completed (one player). */
  async tryAwardSoloWordDeckComplete(sessionId: string): Promise<void> {
    const claim = await this.prisma.soloWordSession.updateMany({
      where: { id: sessionId, finishedAt: { not: null }, winXpAwarded: false },
      data: { winXpAwarded: true },
    });
    if (claim.count === 0) return;

    const row = await this.prisma.soloWordSession.findUnique({
      where: { id: sessionId },
      select: { playerId: true, venueId: true, globalPlay: true },
    });
    if (!row) return;

    const atVenue = Boolean(row.venueId && !row.globalPlay);
    const delta = atVenue ? XP_VENUE_WIN : XP_GLOBAL_WIN;
    if (atVenue && row.venueId) {
      await this.venueStats.addVenueXp(row.playerId, row.venueId, delta);
    } else {
      await this.prisma.player.update({
        where: { id: row.playerId },
        data: { bonusXp: { increment: delta } },
      });
    }
  }

  /** Daily word first correct solve for that day/scope. */
  async tryAwardDailyWordFirstSolve(params: {
    playerId: string;
    dayKey: string;
    scopeKey: string;
    venueId: string | null;
  }): Promise<void> {
    const claim = await this.prisma.playerDailyWord.updateMany({
      where: {
        playerId: params.playerId,
        dayKey: params.dayKey,
        scopeKey: params.scopeKey,
        solvedAt: { not: null },
        winXpAwarded: false,
      },
      data: { winXpAwarded: true },
    });
    if (claim.count === 0) return;

    const atVenue = Boolean(params.venueId);
    const delta = atVenue ? XP_VENUE_WIN : XP_GLOBAL_WIN;
    if (atVenue && params.venueId) {
      await this.venueStats.addVenueXp(params.playerId, params.venueId, delta);
    } else {
      await this.prisma.player.update({
        where: { id: params.playerId },
        data: { bonusXp: { increment: delta } },
      });
    }
  }
}

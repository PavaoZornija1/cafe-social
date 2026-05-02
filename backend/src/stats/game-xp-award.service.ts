import { Injectable } from '@nestjs/common';
import {
  GameParticipantResult,
  GameSessionStatus,
  GameType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PlayerVenueStatsRepository } from './player-venue-stats.repository';
import {
  BRAWLER_WIN_XP_MAX,
  BRAWLER_WIN_XP_MIN,
  BRAWLER_XP_PER_DEATH_PENALTY,
  BRAWLER_XP_PER_KILL,
  XP_GLOBAL_WIN,
  XP_VENUE_WIN,
  XP_WORD_COOP_GLOBAL,
  XP_WORD_COOP_PERFECT,
  XP_WORD_SOLO_GLOBAL,
  XP_WORD_SOLO_VENUE,
  XP_WORD_VERSUS_FIRST,
  XP_WORD_VERSUS_FIRST_GLOBAL,
  XP_WORD_VERSUS_SECOND,
  XP_WORD_VERSUS_SECOND_GLOBAL,
} from '../lib/xp-rewards';

type WordMatchConfigJson = {
  wordGameMode?: 'coop' | 'versus';
  ranked?: boolean;
};

type BrawlerMatchConfigJson = {
  ranked?: boolean;
};

const ELO_K = 32;

function eloPair(
  ratingA: number,
  ratingB: number,
  scoreA: number,
  scoreB: number,
): { newA: number; newB: number } {
  const expected = (rSelf: number, rOpp: number) =>
    1 / (1 + Math.pow(10, (rOpp - rSelf) / 400));
  const newA = Math.round(ratingA + ELO_K * (scoreA - expected(ratingA, ratingB)));
  const newB = Math.round(ratingB + ELO_K * (scoreB - expected(ratingB, ratingA)));
  return { newA, newB };
}

@Injectable()
export class GameXpAwardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly venueStats: PlayerVenueStatsRepository,
  ) {}

  private async addXp(playerId: string, venueId: string | null, delta: number): Promise<void> {
    if (delta <= 0) return;
    if (venueId) {
      await this.venueStats.addVenueXp(playerId, venueId, delta);
    } else {
      await this.prisma.player.update({
        where: { id: playerId },
        data: { bonusXp: { increment: delta } },
      });
    }
  }

  /**
   * Awards XP once per finished session.
   * Word games use mode-specific payouts; brawler uses kill/death-adjusted win XP; others use WIN + base.
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
        id: true,
        venueId: true,
        gameType: true,
        config: true,
        rankAwardedAt: true,
        participants: {
          select: {
            playerId: true,
            result: true,
            kills: true,
            deaths: true,
            score: true,
            placement: true,
          },
        },
      },
    });
    if (!session) return;

    if (session.gameType === GameType.WORD_GAME) {
      const cfg = session.config as unknown as WordMatchConfigJson | null;
      const mode = cfg?.wordGameMode;
      const atVenue = Boolean(session.venueId);

      if (mode === 'coop') {
        for (const p of session.participants) {
          if (!p.playerId || p.result !== GameParticipantResult.WIN) continue;
          const d = atVenue ? XP_WORD_COOP_PERFECT : XP_WORD_COOP_GLOBAL;
          await this.addXp(p.playerId, session.venueId, d);
        }
      } else if (mode === 'versus') {
        const humans = session.participants
          .filter((p) => p.playerId)
          .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
        for (let i = 0; i < humans.length; i++) {
          const pid = humans[i]!.playerId!;
          let d = 0;
          if (i === 0) d = atVenue ? XP_WORD_VERSUS_FIRST : XP_WORD_VERSUS_FIRST_GLOBAL;
          else if (i === 1) d = atVenue ? XP_WORD_VERSUS_SECOND : XP_WORD_VERSUS_SECOND_GLOBAL;
          await this.addXp(pid, session.venueId, d);
        }

        const ranked = Boolean(cfg?.ranked);
        if (
          ranked &&
          !session.rankAwardedAt &&
          humans.length === 2 &&
          humans[0]!.playerId &&
          humans[1]!.playerId
        ) {
          const claimRank = await this.prisma.gameSession.updateMany({
            where: { id: sessionId, rankAwardedAt: null },
            data: { rankAwardedAt: new Date() },
          });
          if (claimRank.count > 0) {
            const aId = humans[0]!.playerId!;
            const bId = humans[1]!.playerId!;
            const s0 = humans[0]!.score ?? 0;
            const s1 = humans[1]!.score ?? 0;
            let sa: number;
            let sb: number;
            if (s0 > s1) {
              sa = 1;
              sb = 0;
            } else if (s1 > s0) {
              sa = 0;
              sb = 1;
            } else {
              sa = 0.5;
              sb = 0.5;
            }
            const [pa, pb] = await Promise.all([
              this.prisma.player.findUnique({
                where: { id: aId },
                select: { competitiveRankRating: true, wordRankRating: true },
              }),
              this.prisma.player.findUnique({
                where: { id: bId },
                select: { competitiveRankRating: true, wordRankRating: true },
              }),
            ]);
            const rgA = pa?.competitiveRankRating ?? 1500;
            const rgB = pb?.competitiveRankRating ?? 1500;
            const rwA = pa?.wordRankRating ?? 1500;
            const rwB = pb?.wordRankRating ?? 1500;
            const global = eloPair(rgA, rgB, sa, sb);
            const word = eloPair(rwA, rwB, sa, sb);
            await this.prisma.player.update({
              where: { id: aId },
              data: {
                competitiveRankRating: global.newA,
                wordRankRating: word.newA,
              },
            });
            await this.prisma.player.update({
              where: { id: bId },
              data: {
                competitiveRankRating: global.newB,
                wordRankRating: word.newB,
              },
            });
          }
        }
      }
      return;
    }

    const baseXp = session.venueId ? XP_VENUE_WIN : XP_GLOBAL_WIN;
    for (const p of session.participants) {
      if (!p.playerId || p.result !== GameParticipantResult.WIN) continue;
      let delta = baseXp;
      if (session.gameType === GameType.BRAWLER) {
        const kills = p.kills ?? 0;
        const deaths = p.deaths ?? 0;
        const raw =
          baseXp + kills * BRAWLER_XP_PER_KILL - deaths * BRAWLER_XP_PER_DEATH_PENALTY;
        delta = Math.round(
          Math.max(BRAWLER_WIN_XP_MIN, Math.min(BRAWLER_WIN_XP_MAX, raw)),
        );
      }
      await this.addXp(p.playerId, session.venueId, delta);
    }

    if (session.gameType === GameType.BRAWLER) {
      const cfg = session.config as unknown as BrawlerMatchConfigJson | null;
      const ranked = Boolean(cfg?.ranked);
      if (!ranked || session.rankAwardedAt) return;

      const humans = session.participants.filter((p) => p.playerId);
      if (humans.length !== 2) return;

      const h0 = humans[0]!;
      const h1 = humans[1]!;
      if (!h0.playerId || !h1.playerId) return;
      const r0 = h0.result;
      const r1 = h1.result;
      if (r0 == null || r1 == null) return;

      const [aId, bId] = [h0.playerId, h1.playerId].sort() as [string, string];
      const ha = humans.find((h) => h.playerId === aId)!;
      const hb = humans.find((h) => h.playerId === bId)!;

      let sa: number;
      let sb: number;
      if (ha.result === GameParticipantResult.WIN && hb.result === GameParticipantResult.LOSS) {
        sa = 1;
        sb = 0;
      } else if (
        ha.result === GameParticipantResult.LOSS &&
        hb.result === GameParticipantResult.WIN
      ) {
        sa = 0;
        sb = 1;
      } else if (
        ha.result === GameParticipantResult.DRAW ||
        hb.result === GameParticipantResult.DRAW
      ) {
        sa = 0.5;
        sb = 0.5;
      } else {
        return;
      }

      const claimRank = await this.prisma.gameSession.updateMany({
        where: { id: sessionId, rankAwardedAt: null },
        data: { rankAwardedAt: new Date() },
      });
      if (claimRank.count === 0) return;

      const [pa, pb] = await Promise.all([
        this.prisma.player.findUnique({
          where: { id: aId },
          select: { competitiveRankRating: true, brawlerRankRating: true },
        }),
        this.prisma.player.findUnique({
          where: { id: bId },
          select: { competitiveRankRating: true, brawlerRankRating: true },
        }),
      ]);
      const rgA = pa?.competitiveRankRating ?? 1500;
      const rgB = pb?.competitiveRankRating ?? 1500;
      const rbA = pa?.brawlerRankRating ?? 1500;
      const rbB = pb?.brawlerRankRating ?? 1500;
      const global = eloPair(rgA, rgB, sa, sb);
      const brawl = eloPair(rbA, rbB, sa, sb);
      await this.prisma.player.update({
        where: { id: aId },
        data: {
          competitiveRankRating: global.newA,
          brawlerRankRating: brawl.newA,
        },
      });
      await this.prisma.player.update({
        where: { id: bId },
        data: {
          competitiveRankRating: global.newB,
          brawlerRankRating: brawl.newB,
        },
      });
    }
  }

  /** Solo word deck completed (one player). */
  async tryAwardSoloWordDeckComplete(sessionId: string): Promise<void> {
    const row = await this.prisma.soloWordSession.findUnique({
      where: { id: sessionId },
      select: {
        finishedAt: true,
        winXpAwarded: true,
        wordsSolved: true,
        wordIds: true,
        playerId: true,
        venueId: true,
        globalPlay: true,
      },
    });
    if (!row?.finishedAt || row.winXpAwarded) return;

    if (row.wordsSolved !== row.wordIds.length) {
      await this.prisma.soloWordSession.update({
        where: { id: sessionId },
        data: { winXpAwarded: true },
      });
      return;
    }

    const claim = await this.prisma.soloWordSession.updateMany({
      where: { id: sessionId, finishedAt: { not: null }, winXpAwarded: false },
      data: { winXpAwarded: true },
    });
    if (claim.count === 0) return;

    const atVenue = Boolean(row.venueId && !row.globalPlay);
    const delta = atVenue ? XP_WORD_SOLO_VENUE : XP_WORD_SOLO_GLOBAL;
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

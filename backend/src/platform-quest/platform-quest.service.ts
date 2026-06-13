import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  GameParticipantResult,
  GameSessionStatus,
  GameType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PlatformAutomatedRewardService } from '../reward/platform-automated-reward.service';
import { XpTierRewardService } from '../reward/xp-tier-reward.service';
import { platformQuestBundleRewardKey } from '../lib/platform-reward-key.util';
import { utcWeekDayKeyRange } from '../lib/engagement-dates';
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
import {
  bundleForPeriod,
  DAILY_PLATFORM_QUESTS,
  fullQuestKey,
  msUntilPeriodEnd,
  periodKeyFor,
  questsForPeriod,
  type PlatformQuestIcon,
  type QuestPeriod,
} from './platform-quest.definitions';

type WordMatchConfigJson = {
  wordGameMode?: 'coop' | 'versus';
};

export type PlatformQuestStatus = 'in_progress' | 'claimable' | 'claimed';

export type PlatformQuestRow = {
  key: string;
  title: string;
  subtitle: string | null;
  targetCount: number;
  progressCount: number;
  xpReward: number;
  icon: PlatformQuestIcon;
  status: PlatformQuestStatus;
  claimedXp: number | null;
};

export type PlatformQuestHubPayload = {
  period: QuestPeriod;
  periodKey: string;
  resetsInMs: number;
  availableXp: number;
  bundle: {
    key: string;
    title: string;
    xpReward: number;
    bonusLabel: string;
    targetCount: number;
    completedCount: number;
    claimed: boolean;
    canClaim: boolean;
  };
  quests: PlatformQuestRow[];
};

type ProgressMap = Record<string, { progress: number; subtitle: string | null }>;

@Injectable()
export class PlatformQuestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly platformRewards: PlatformAutomatedRewardService,
    private readonly tierRewards: XpTierRewardService,
  ) {}

  async getHub(email: string, period: QuestPeriod): Promise<PlatformQuestHubPayload> {
    const player = await this.prisma.player.findUnique({ where: { email } });
    if (!player) throw new NotFoundException('Player not found');
    return this.buildHub(player.id, period);
  }

  async claimQuest(
    email: string,
    period: QuestPeriod,
    questKey: string,
  ): Promise<PlatformQuestHubPayload> {
    const player = await this.prisma.player.findUnique({ where: { email } });
    if (!player) throw new NotFoundException('Player not found');

    const periodKey = periodKeyFor(period);
    const fullKey = fullQuestKey(period, questKey);
    const bundle = bundleForPeriod(period);
    const isBundle = questKey === bundle.key;

    const hub = await this.buildHub(player.id, period);

    if (isBundle) {
      if (!hub.bundle.canClaim) {
        throw new BadRequestException('Quest is not ready to claim');
      }
    } else {
      const quest = hub.quests.find((q) => q.key === questKey);
      if (!quest) throw new NotFoundException('Unknown quest');
      if (quest.status !== 'claimable') {
        throw new BadRequestException('Quest is not ready to claim');
      }
    }

    const xpReward = isBundle
      ? hub.bundle.xpReward
      : hub.quests.find((q) => q.key === questKey)!.xpReward;

    const existing = await this.prisma.playerPlatformQuestClaim.findUnique({
      where: {
        playerId_questKey_periodKey: {
          playerId: player.id,
          questKey: fullKey,
          periodKey,
        },
      },
    });
    if (existing) {
      throw new BadRequestException('Already claimed');
    }

    await this.prisma.$transaction([
      this.prisma.playerPlatformQuestClaim.create({
        data: {
          playerId: player.id,
          questKey: fullKey,
          periodKey,
          xpAwarded: xpReward,
        },
      }),
      this.prisma.player.update({
        where: { id: player.id },
        data: { bonusXp: { increment: xpReward } },
      }),
    ]);

    if (isBundle) {
      const rewardKey = platformQuestBundleRewardKey(period);
      await this.platformRewards.tryGrantForKey({
        playerId: player.id,
        rewardKey,
        sourceType: 'PLATFORM_QUEST',
        sourceId: fullKey,
        idempotencyKey: `${rewardKey}:${periodKey}:${player.id}`,
      });
    }

    await this.tierRewards.syncTierRewards(player.id);

    return this.buildHub(player.id, period);
  }

  private async buildHub(playerId: string, period: QuestPeriod): Promise<PlatformQuestHubPayload> {
    const periodKey = periodKeyFor(period);
    const progress = await this.computeProgress(playerId, period, periodKey);
    const claims = await this.prisma.playerPlatformQuestClaim.findMany({
      where: { playerId, periodKey },
    });
    const claimSet = new Set(claims.map((c) => c.questKey));
    const claimXp = new Map(claims.map((c) => [c.questKey, c.xpAwarded]));

    const defs = questsForPeriod(period);
    const quests: PlatformQuestRow[] = defs.map((def) => {
      const fullKey = fullQuestKey(period, def.key);
      const row = progress[def.key] ?? { progress: 0, subtitle: null };
      const claimed = claimSet.has(fullKey);
      const complete = row.progress >= def.targetCount;
      let status: PlatformQuestStatus = 'in_progress';
      if (claimed) status = 'claimed';
      else if (complete) status = 'claimable';

      return {
        key: def.key,
        title: def.title,
        subtitle: row.subtitle,
        targetCount: def.targetCount,
        progressCount: Math.min(row.progress, def.targetCount),
        xpReward: def.xpReward,
        icon: def.icon,
        status,
        claimedXp: claimed ? (claimXp.get(fullKey) ?? def.xpReward) : null,
      };
    });

    const completedCount = quests.filter(
      (q) => q.progressCount >= q.targetCount || q.status === 'claimed',
    ).length;
    const bundleDef = bundleForPeriod(period);
    const bundleFullKey = fullQuestKey(period, bundleDef.key);
    const bundleClaimed = claimSet.has(bundleFullKey);
    const bundleCanClaim =
      !bundleClaimed && completedCount >= defs.length && defs.length > 0;

    const bundleRewardKey = platformQuestBundleRewardKey(period);
    const bundleRewardLink = await this.platformRewards.findActive(bundleRewardKey);
    const bundleBonusLabel = bundleRewardLink
      ? this.platformRewards.displayLabel(bundleRewardLink)
      : bundleDef.bonusLabelFallback;

    const availableXp = quests
      .filter((q) => q.status === 'claimable')
      .reduce((sum, q) => sum + q.xpReward, 0);

    return {
      period,
      periodKey,
      resetsInMs: msUntilPeriodEnd(period),
      availableXp: availableXp + (bundleCanClaim ? bundleDef.xpReward : 0),
      bundle: {
        key: bundleDef.key,
        title: bundleDef.title,
        xpReward: bundleDef.xpReward,
        bonusLabel: bundleBonusLabel,
        targetCount: defs.length,
        completedCount,
        claimed: bundleClaimed,
        canClaim: bundleCanClaim,
      },
      quests,
    };
  }

  private async computeProgress(
    playerId: string,
    period: QuestPeriod,
    periodKey: string,
  ): Promise<ProgressMap> {
    if (period === 'daily') {
      return this.computeDailyProgress(playerId, periodKey);
    }
    return this.computeWeeklyProgress(playerId, periodKey);
  }

  private dayBounds(dayKey: string): { start: Date; end: Date } {
    const start = new Date(`${dayKey}T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { start, end };
  }

  private async computeDailyProgress(playerId: string, dayKey: string): Promise<ProgressMap> {
    const { start, end } = this.dayBounds(dayKey);

    const [
      visitToday,
      checkInToday,
      dailyWordSolved,
      wordRoomWins,
      venueMatches,
      distinctVenuesToday,
      xpToday,
    ] = await Promise.all([
      this.prisma.playerVenueVisitDay.findFirst({
        where: { playerId, dayKey },
        include: { venue: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.playerVenueCheckIn.findFirst({
        where: {
          playerId,
          lastCheckInAt: { gte: start, lt: end },
        },
        include: { venue: { select: { name: true } } },
        orderBy: { lastCheckInAt: 'desc' },
      }),
      this.prisma.playerDailyWord.findFirst({
        where: { playerId, dayKey, solvedAt: { not: null } },
      }),
      this.countWordRoomWins(playerId, start, end),
      this.countVenueMatchesFinished(playerId, start, end),
      this.prisma.playerVenueVisitDay.count({
        where: { playerId, dayKey },
      }),
      this.sumXpEarnedBetween(playerId, start, end),
    ]);

    const checkInVenueName =
      visitToday?.venue.name ?? checkInToday?.venue.name ?? null;
    const checkInProgress = visitToday || checkInToday ? 1 : 0;

    return {
      check_in: {
        progress: checkInProgress,
        subtitle:
          checkInProgress > 0 && checkInVenueName
            ? `Done at ${checkInVenueName}`
            : null,
      },
      earn_xp: { progress: xpToday, subtitle: null },
      win_word_rooms: { progress: wordRoomWins, subtitle: null },
      solve_daily_word: {
        progress: dailyWordSolved ? 1 : 0,
        subtitle: dailyWordSolved ? 'Solved today' : null,
      },
      play_match: { progress: venueMatches, subtitle: null },
      explore_venues: { progress: distinctVenuesToday, subtitle: null },
    };
  }

  private async computeWeeklyProgress(
    playerId: string,
    weekStartKey: string,
  ): Promise<ProgressMap> {
    const weekEndKey = utcWeekDayKeyRange(new Date(`${weekStartKey}T12:00:00.000Z`)).end;
    const start = new Date(`${weekStartKey}T00:00:00.000Z`);
    const end = new Date(`${weekEndKey}T23:59:59.999Z`);
    end.setUTCDate(end.getUTCDate() + 1);

    const [visitDays, wordWins, dailySolves, xpWeek] = await Promise.all([
      this.prisma.playerVenueVisitDay.groupBy({
        by: ['dayKey'],
        where: {
          playerId,
          dayKey: { gte: weekStartKey, lte: weekEndKey },
        },
      }),
      this.countAllWins(playerId, start, end),
      this.prisma.playerDailyWord.count({
        where: {
          playerId,
          dayKey: { gte: weekStartKey, lte: weekEndKey },
          solvedAt: { not: null },
        },
      }),
      this.sumXpEarnedBetween(playerId, start, end),
    ]);

    return {
      visit_days: { progress: visitDays.length, subtitle: null },
      win_games: { progress: wordWins, subtitle: null },
      solve_daily_words: { progress: dailySolves, subtitle: null },
      earn_xp_week: { progress: xpWeek, subtitle: null },
    };
  }

  private async countWordRoomWins(
    playerId: string,
    start: Date,
    end: Date,
  ): Promise<number> {
    const rows = await this.prisma.gameParticipant.findMany({
      where: {
        playerId,
        result: GameParticipantResult.WIN,
        session: {
          gameType: GameType.WORD_GAME,
          status: GameSessionStatus.FINISHED,
          winXpAwardedAt: { gte: start, lt: end },
        },
      },
      select: {
        session: {
          select: {
            id: true,
            inviteCode: true,
            partyId: true,
            _count: { select: { participants: true } },
          },
        },
      },
    });

    const sessionIds = new Set<string>();
    for (const row of rows) {
      const s = row.session;
      const isRoom =
        Boolean(s.inviteCode) ||
        Boolean(s.partyId) ||
        (s._count.participants ?? 0) > 1;
      if (isRoom) sessionIds.add(s.id);
    }
    return sessionIds.size;
  }

  private async countVenueMatchesFinished(
    playerId: string,
    start: Date,
    end: Date,
  ): Promise<number> {
    return this.prisma.gameParticipant.count({
      where: {
        playerId,
        session: {
          venueId: { not: null },
          status: GameSessionStatus.FINISHED,
          endedAt: { gte: start, lt: end },
        },
      },
    });
  }

  private async countAllWins(playerId: string, start: Date, end: Date): Promise<number> {
    const [sessionWins, soloDecks] = await Promise.all([
      this.prisma.gameParticipant.count({
        where: {
          playerId,
          result: GameParticipantResult.WIN,
          session: {
            status: GameSessionStatus.FINISHED,
            winXpAwardedAt: { gte: start, lt: end },
          },
        },
      }),
      this.prisma.soloWordSession.count({
        where: {
          playerId,
          finishedAt: { gte: start, lt: end },
          winXpAwarded: true,
        },
      }),
    ]);
    return sessionWins + soloDecks;
  }

  private async sumXpEarnedBetween(
    playerId: string,
    start: Date,
    end: Date,
  ): Promise<number> {
    const [participants, soloRows, dailyRows, questClaims] = await Promise.all([
      this.prisma.gameParticipant.findMany({
        where: {
          playerId,
          session: {
            status: GameSessionStatus.FINISHED,
            winXpAwardedAt: { gte: start, lt: end },
          },
        },
        select: {
          result: true,
          kills: true,
          deaths: true,
          score: true,
          playerId: true,
          session: {
            select: {
              gameType: true,
              venueId: true,
              config: true,
              participants: {
                select: { playerId: true, score: true },
              },
            },
          },
        },
      }),
      this.prisma.soloWordSession.findMany({
        where: {
          playerId,
          finishedAt: { gte: start, lt: end },
          winXpAwarded: true,
        },
        select: { venueId: true, globalPlay: true },
      }),
      this.prisma.playerDailyWord.findMany({
        where: {
          playerId,
          solvedAt: { gte: start, lt: end },
          winXpAwarded: true,
        },
        select: { scopeKey: true },
      }),
      this.prisma.playerPlatformQuestClaim.findMany({
        where: {
          playerId,
          claimedAt: { gte: start, lt: end },
        },
        select: { xpAwarded: true },
      }),
    ]);

    let total = questClaims.reduce((sum, c) => sum + c.xpAwarded, 0);

    for (const p of participants) {
      total += this.estimateParticipantXp(p);
    }

    for (const solo of soloRows) {
      const atVenue = Boolean(solo.venueId && !solo.globalPlay);
      total += atVenue ? XP_WORD_SOLO_VENUE : XP_WORD_SOLO_GLOBAL;
    }

    for (const daily of dailyRows) {
      const atVenue = daily.scopeKey !== 'global';
      total += atVenue ? XP_VENUE_WIN : XP_GLOBAL_WIN;
    }

    return total;
  }

  private estimateParticipantXp(p: {
    result: GameParticipantResult | null;
    kills: number | null;
    deaths: number | null;
    score: number | null;
    playerId: string | null;
    session: {
      gameType: GameType;
      venueId: string | null;
      config: unknown;
      participants: { playerId: string | null; score: number | null }[];
    };
  }): number {
    const atVenue = Boolean(p.session.venueId);
    const base = atVenue ? XP_VENUE_WIN : XP_GLOBAL_WIN;

    if (p.session.gameType === GameType.WORD_GAME) {
      const cfg = p.session.config as WordMatchConfigJson | null;
      if (cfg?.wordGameMode === 'coop') {
        if (p.result !== GameParticipantResult.WIN) return 0;
        return atVenue ? XP_WORD_COOP_PERFECT : XP_WORD_COOP_GLOBAL;
      }
      if (cfg?.wordGameMode === 'versus') {
        const humans = p.session.participants
          .filter((x) => x.playerId)
          .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
        const placement = humans.findIndex((h) => h.playerId === p.playerId);
        if (placement === 0) return atVenue ? XP_WORD_VERSUS_FIRST : XP_WORD_VERSUS_FIRST_GLOBAL;
        if (placement === 1) return atVenue ? XP_WORD_VERSUS_SECOND : XP_WORD_VERSUS_SECOND_GLOBAL;
        return 0;
      }
      if (p.result !== GameParticipantResult.WIN) return 0;
      return base;
    }

    if (p.session.gameType === GameType.BRAWLER) {
      if (p.result !== GameParticipantResult.WIN) return 0;
      const kills = p.kills ?? 0;
      const deaths = p.deaths ?? 0;
      const raw = base + kills * BRAWLER_XP_PER_KILL - deaths * BRAWLER_XP_PER_DEATH_PENALTY;
      return Math.round(Math.max(BRAWLER_WIN_XP_MIN, Math.min(BRAWLER_WIN_XP_MAX, raw)));
    }

    if (p.result !== GameParticipantResult.WIN) return 0;
    return base;
  }
}

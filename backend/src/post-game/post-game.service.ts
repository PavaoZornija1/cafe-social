import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ChallengeAutoProgressSource,
  GameParticipantResult,
  GameSessionStatus,
  GameType,
  type Prisma,
} from '@prisma/client';
import { ChallengeService } from '../challenge/challenge.service';
import type { TierProgressDto } from '../lib/xp-tier-ladder.util';
import { PlatformQuestService } from '../platform-quest/platform-quest.service';
import { PrismaService } from '../prisma/prisma.service';
import { PlatformAutomatedRewardService } from '../reward/platform-automated-reward.service';
import { XpTierRewardService } from '../reward/xp-tier-reward.service';
import { GameXpAwardService } from '../stats/game-xp-award.service';
import type {
  ChallengeBumpResult,
  PostGameMomentDto,
  PostGamePayloadDto,
  PostGameSummaryDto,
} from './post-game.types';

type WordMatchConfig = {
  wordGameMode?: 'coop' | 'versus';
  playerVenueIds?: Record<string, string>;
  ranked?: boolean;
};

type BrawlerMatchConfig = {
  playerVenueIds?: Record<string, string>;
  ranked?: boolean;
};

type ProgressionMoments = {
  afterXp: PostGameMomentDto[];
  afterChallenges: PostGameMomentDto[];
};

@Injectable()
export class PostGameService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gameXp: GameXpAwardService,
    private readonly challenges: ChallengeService,
    private readonly xpTier: XpTierRewardService,
    private readonly platformRewards: PlatformAutomatedRewardService,
    private readonly platformQuests: PlatformQuestService,
  ) {}

  async getForGameSession(sessionId: string, playerId: string): Promise<PostGamePayloadDto> {
    await this.ensureGameSessionProcessed(sessionId);
    const participant = await this.prisma.gameParticipant.findFirst({
      where: { sessionId, playerId },
      select: { postGameSnapshot: true },
    });
    if (!participant?.postGameSnapshot) {
      return this.buildFallbackGameSessionPayload(sessionId, playerId);
    }
    return participant.postGameSnapshot as unknown as PostGamePayloadDto;
  }

  async onGameSessionFinished(sessionId: string): Promise<void> {
    await this.ensureGameSessionProcessed(sessionId);
  }

  async onSoloWordFinished(
    soloSessionId: string,
    playerId: string,
  ): Promise<PostGamePayloadDto> {
    const row = await this.prisma.soloWordSession.findUnique({
      where: { id: soloSessionId },
    });
    if (!row || row.playerId !== playerId) {
      throw new NotFoundException('solo session not found');
    }
    if (!row.finishedAt) {
      throw new NotFoundException('solo session not finished');
    }

    if (row.postGameSnapshot) {
      return row.postGameSnapshot as unknown as PostGamePayloadDto;
    }

    const processStartedAt = new Date();
    const [tierBefore, questsBefore] = await Promise.all([
      this.tierProgressForPlayer(playerId),
      this.platformQuests.claimableQuestKeySet(playerId),
    ]);

    const xpAwarded = await this.gameXp.tryAwardSoloWordDeckComplete(soloSessionId);
    let challengeResults: ChallengeBumpResult[] = [];
    if (row.venueId) {
      challengeResults = await this.challenges.bumpActiveChallengesForPlayerAtVenue({
        playerId,
        venueId: row.venueId,
        trustVenuePresence: true,
        activityAtVenue: true,
        countsAsWin: row.wordsSolved === row.wordIds.length,
        source: ChallengeAutoProgressSource.WORD_MATCH,
      });
    }

    const won = row.wordsSolved === row.wordIds.length;
    const progression = await this.detectProgressionMoments({
      playerId,
      processStartedAt,
      tierBefore,
      questsBefore,
    });
    const payload = this.buildPayload({
      game: 'word',
      mode: 'solo',
      won,
      showRematch: false,
      xpAwarded,
      challengeResults,
      participants: [],
      progression,
    });

    await this.prisma.soloWordSession.update({
      where: { id: soloSessionId },
      data: { postGameSnapshot: payload as unknown as Prisma.InputJsonValue },
    });
    return payload;
  }

  private async ensureGameSessionProcessed(sessionId: string): Promise<void> {
    const session = await this.prisma.gameSession.findUnique({
      where: { id: sessionId },
      select: { id: true, status: true, postGameProcessedAt: true },
    });
    if (!session || session.status !== GameSessionStatus.FINISHED) return;
    if (session.postGameProcessedAt) return;

    const claim = await this.prisma.gameSession.updateMany({
      where: {
        id: sessionId,
        status: GameSessionStatus.FINISHED,
        postGameProcessedAt: null,
      },
      data: { postGameProcessedAt: new Date() },
    });
    if (claim.count === 0) return;

    try {
      const participants = await this.prisma.gameParticipant.findMany({
        where: { sessionId, isBot: false, playerId: { not: null } },
        select: { playerId: true },
      });
      const processStartedAt = new Date();
      const tierBeforeByPlayer: Record<string, TierProgressDto> = {};
      const questsBeforeByPlayer: Record<string, Set<string>> = {};
      await Promise.all(
        participants.map(async (row) => {
          const playerId = row.playerId!;
          tierBeforeByPlayer[playerId] = await this.tierProgressForPlayer(playerId);
          questsBeforeByPlayer[playerId] = await this.platformQuests.claimableQuestKeySet(playerId);
        }),
      );

      const xpByPlayer = await this.gameXp.tryAwardSessionWinXp(sessionId);
      const challengeResultsByPlayer = await this.bumpChallengesForGameSession(sessionId);
      const payloads = await this.buildAllGameSessionPayloads(
        sessionId,
        xpByPlayer,
        challengeResultsByPlayer,
        { processStartedAt, tierBeforeByPlayer, questsBeforeByPlayer },
      );

      await this.prisma.$transaction(async (tx) => {
        for (const [participantId, payload] of Object.entries(payloads)) {
          await tx.gameParticipant.update({
            where: { id: participantId },
            data: { postGameSnapshot: payload as unknown as Prisma.InputJsonValue },
          });
        }
      });
    } catch (err) {
      await this.prisma.gameSession.updateMany({
        where: { id: sessionId, postGameProcessedAt: { not: null } },
        data: { postGameProcessedAt: null },
      });
      throw err;
    }
  }

  private async bumpChallengesForGameSession(
    sessionId: string,
  ): Promise<Record<string, ChallengeBumpResult[]>> {
    const session = await this.prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: { participants: true },
    });
    if (!session || session.status !== GameSessionStatus.FINISHED) return {};

    const config = (session.config ?? {}) as WordMatchConfig & BrawlerMatchConfig;
    const playerVenueIds = config.playerVenueIds ?? {};
    const source =
      session.gameType === GameType.BRAWLER
        ? ChallengeAutoProgressSource.BRAWLER
        : ChallengeAutoProgressSource.WORD_MATCH;

    const out: Record<string, ChallengeBumpResult[]> = {};
    for (const p of session.participants) {
      if (!p.playerId || p.isBot) continue;
      const venueId = playerVenueIds[p.playerId] ?? session.venueId;
      if (!venueId) continue;
      const countsAsWin = p.result === GameParticipantResult.WIN;
      out[p.playerId] = await this.challenges.bumpActiveChallengesForPlayerAtVenue({
        playerId: p.playerId,
        venueId,
        trustVenuePresence: true,
        activityAtVenue: true,
        countsAsWin,
        source,
      });
    }
    return out;
  }

  private async buildAllGameSessionPayloads(
    sessionId: string,
    xpByPlayer: Record<string, number>,
    challengeResultsByPlayer: Record<string, ChallengeBumpResult[]>,
    progressionCtx: {
      processStartedAt: Date;
      tierBeforeByPlayer: Record<string, TierProgressDto>;
      questsBeforeByPlayer: Record<string, Set<string>>;
    },
  ): Promise<Record<string, PostGamePayloadDto>> {
    const session = await this.prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: {
        participants: {
          include: { player: { select: { username: true } } },
        },
      },
    });
    if (!session) return {};

    const config = (session.config ?? {}) as WordMatchConfig & BrawlerMatchConfig;
    const mode =
      session.gameType === GameType.WORD_GAME
        ? (config.wordGameMode ?? null)
        : null;
    const game = session.gameType === GameType.BRAWLER ? 'brawler' : 'word';
    const showRematch =
      session.gameType === GameType.WORD_GAME && Boolean(config.wordGameMode);

    const payloads: Record<string, PostGamePayloadDto> = {};
    for (const p of session.participants) {
      if (!p.playerId || p.isBot) continue;
      const won = p.result === GameParticipantResult.WIN;
      const xpAwarded = xpByPlayer[p.playerId] ?? 0;
      const challengeResults = challengeResultsByPlayer[p.playerId] ?? [];
      const progression = await this.detectProgressionMoments({
        playerId: p.playerId,
        processStartedAt: progressionCtx.processStartedAt,
        tierBefore: progressionCtx.tierBeforeByPlayer[p.playerId] ?? {
          tierLabel: 'Bronze',
          nextTierXpThreshold: null,
          nextTierName: null,
        },
        questsBefore: progressionCtx.questsBeforeByPlayer[p.playerId] ?? new Set(),
      });

      const participants = session.participants
        .filter((row) => !row.isBot)
        .map((row) => ({
          username: row.displayNameSnapshot ?? row.player?.username ?? 'Player',
          score: row.score ?? 0,
          result: row.result,
          isYou: row.playerId === p.playerId,
          kills: session.gameType === GameType.BRAWLER ? row.kills : null,
          deaths: session.gameType === GameType.BRAWLER ? row.deaths : null,
          xpGained:
            row.playerId === p.playerId
              ? xpAwarded
              : row.playerId
                ? (xpByPlayer[row.playerId] ?? 0)
                : 0,
        }));

      payloads[p.id] = this.buildPayload({
        game,
        mode,
        won: mode === 'coop' ? won : p.result === GameParticipantResult.WIN,
        showRematch,
        xpAwarded,
        challengeResults,
        participants,
        progression,
      });
    }
    return payloads;
  }

  private async buildFallbackGameSessionPayload(
    sessionId: string,
    playerId: string,
  ): Promise<PostGamePayloadDto> {
    const session = await this.prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: {
        participants: {
          include: { player: { select: { username: true } } },
        },
      },
    });
    if (!session) throw new NotFoundException('session not found');

    const me = session.participants.find((p) => p.playerId === playerId);
    if (!me) throw new NotFoundException('not in session');

    const config = (session.config ?? {}) as WordMatchConfig & BrawlerMatchConfig;
    const mode =
      session.gameType === GameType.WORD_GAME
        ? (config.wordGameMode ?? null)
        : null;
    const game = session.gameType === GameType.BRAWLER ? 'brawler' : 'word';

    const participants = session.participants
      .filter((row) => !row.isBot)
      .map((row) => ({
        username: row.displayNameSnapshot ?? row.player?.username ?? 'Player',
        score: row.score ?? 0,
        result: row.result,
        isYou: row.playerId === playerId,
        kills: session.gameType === GameType.BRAWLER ? row.kills : null,
        deaths: session.gameType === GameType.BRAWLER ? row.deaths : null,
        xpGained: 0,
      }));

    return this.buildPayload({
      game,
      mode,
      won:
        mode === 'coop'
          ? me.result === GameParticipantResult.WIN
          : me.result === GameParticipantResult.WIN,
      showRematch: session.gameType === GameType.WORD_GAME && Boolean(mode),
      xpAwarded: 0,
      challengeResults: [],
      participants,
    });
  }

  private async tierProgressForPlayer(playerId: string): Promise<TierProgressDto> {
    const totalXp = await this.xpTier.totalXpFor(playerId);
    return this.platformRewards.computeTierProgress(totalXp);
  }

  private async detectProgressionMoments(params: {
    playerId: string;
    processStartedAt: Date;
    tierBefore: TierProgressDto;
    questsBefore: Set<string>;
  }): Promise<ProgressionMoments> {
    const afterXp: PostGameMomentDto[] = [];
    const afterChallenges: PostGameMomentDto[] = [];

    const totalXp = await this.xpTier.totalXpFor(params.playerId);
    const tierAfter = await this.platformRewards.computeTierProgress(totalXp);
    if (tierAfter.tierLabel !== params.tierBefore.tierLabel) {
      afterXp.push({
        kind: 'tier_up',
        title: tierAfter.tierLabel,
        subtitle: 'Level up!',
        icon: 'star',
        tierLabel: tierAfter.tierLabel,
        previousTierLabel: params.tierBefore.tierLabel,
        nextTierName: tierAfter.nextTierName,
      });
    }

    const tierPerkGrants = await this.prisma.playerRewardGrant.findMany({
      where: {
        playerId: params.playerId,
        sourceType: 'TIER',
        issuedAt: { gte: params.processStartedAt },
      },
      include: { perk: { select: { title: true } } },
    });
    for (const grant of tierPerkGrants) {
      const perkTitle = grant.perk?.title;
      if (!perkTitle) continue;
      afterXp.push({
        kind: 'perk_unlocked',
        title: perkTitle,
        subtitle: 'Tier reward unlocked',
        icon: 'cafe',
        perkTitle,
      });
    }

    const claimableQuests = await this.platformQuests.listClaimableQuestsForPlayer(params.playerId);
    for (const quest of claimableQuests) {
      const key = `${quest.period}:${quest.key}`;
      if (params.questsBefore.has(key)) continue;
      afterChallenges.push({
        kind: 'platform_quest_ready',
        title: quest.title,
        subtitle: 'Ready to claim!',
        icon: 'sparkles',
        xpAmount: quest.xpReward,
      });
    }

    return { afterXp, afterChallenges };
  }

  private buildPayload(params: {
    game: 'word' | 'brawler';
    mode?: 'solo' | 'coop' | 'versus' | null;
    won: boolean;
    showRematch: boolean;
    xpAwarded: number;
    challengeResults: ChallengeBumpResult[];
    participants: PostGameSummaryDto['participants'];
    progression?: ProgressionMoments;
  }): PostGamePayloadDto {
    const moments: PostGameMomentDto[] = [];
    const progression = params.progression ?? { afterXp: [], afterChallenges: [] };

    if (params.xpAwarded > 0) {
      moments.push({
        kind: 'xp',
        title: `+${params.xpAwarded} XP`,
        subtitle: params.won ? 'Great game!' : null,
        icon: 'flash',
        xpAmount: params.xpAwarded,
      });
    }

    moments.push(...progression.afterXp);

    for (const bump of params.challengeResults) {
      if (bump.newlyCompleted) {
        moments.push({
          kind: 'challenge_complete',
          title: bump.title,
          subtitle: 'Challenge complete!',
          icon: 'trophy',
          progressCount: bump.progressCount,
          progressTarget: bump.targetCount,
          xpAmount: bump.challengeXpGain > 0 ? bump.challengeXpGain : null,
          perkTitle: bump.perkTitle,
        });
        if (bump.perkGranted && bump.perkTitle) {
          moments.push({
            kind: 'perk_unlocked',
            title: bump.perkTitle,
            subtitle: 'Added to your wallet',
            icon: 'cafe',
            perkTitle: bump.perkTitle,
          });
        }
      } else if (bump.progressCount > bump.previousCount) {
        moments.push({
          kind: 'challenge_progress',
          title: bump.title,
          subtitle: `${bump.progressCount}/${bump.targetCount}`,
          icon: 'game-controller',
          progressCount: bump.progressCount,
          progressTarget: bump.targetCount,
          xpAmount: bump.challengeXpGain > 0 ? bump.challengeXpGain : null,
          perkTitle: bump.perkTitle,
        });
      }
    }

    moments.push(...progression.afterChallenges);

    const summary: PostGameSummaryDto = {
      game: params.game,
      mode: params.mode ?? null,
      won: params.won,
      showRematch: params.showRematch,
      participants: params.participants,
    };

    return { moments, summary };
  }
}

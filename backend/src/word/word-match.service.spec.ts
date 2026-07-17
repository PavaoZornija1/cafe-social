// Stub the venue module before loading WordMatchService — its real imports pull `@turf/turf` →
// `kdbush` (ESM-only), which Jest's CJS transform can't parse. We never invoke the real instances
// here; they're injected as test doubles in the service factory below.
jest.mock('../venue/venue.service', () => ({ VenueService: class VenueService {} }));
jest.mock('../venue/venue-play-limit.service', () => ({
  VenuePlayLimitService: class VenuePlayLimitService {},
}));
jest.mock('../venue/venue-play-budget.service', () => ({
  VenuePlayBudgetService: class VenuePlayBudgetService {},
}));

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  GameParticipantResult,
  GameSessionStatus,
  GameType,
  WordMatchQueueMode,
  WordMatchQueueStatus,
} from '@prisma/client';
import { WordMatchService } from './word-match.service';

type PrismaDouble = {
  $transaction: <T>(fn: (tx: PrismaDouble) => Promise<T>) => Promise<T>;
  wordMatchQueueEntry: {
    updateMany: jest.Mock;
    create: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    count: jest.Mock;
  };
  gameSession: {
    create: jest.Mock;
    update: jest.Mock;
    findUnique: jest.Mock;
    delete: jest.Mock;
  };
  gameParticipant: {
    update: jest.Mock;
    findFirst: jest.Mock;
  };
  wordSession: { update: jest.Mock };
  wordParticipantStats: { upsert: jest.Mock };
  word: { findUnique: jest.Mock };
  player: { findUnique: jest.Mock };
};

/**
 * Builds a Prisma double whose `$transaction(fn)` runs the callback with the same root double
 * as its tx client. That lets tests assert on a single set of mocks regardless of whether
 * the production code splits work across `prisma.x` or `tx.x`.
 */
function buildPrismaDouble(): PrismaDouble {
  const base: PrismaDouble = {
    $transaction: async (fn) => fn(base),
    wordMatchQueueEntry: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    gameSession: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    gameParticipant: {
      update: jest.fn(),
      findFirst: jest.fn(),
    },
    wordSession: { update: jest.fn() },
    wordParticipantStats: { upsert: jest.fn() },
    word: { findUnique: jest.fn() },
    player: { findUnique: jest.fn() },
  };
  return base;
}

function buildService(opts: {
  prisma?: PrismaDouble;
  player?: { id: string; username: string };
  isSubscriber?: boolean;
  refreshSnapshot?: jest.Mock;
  removeSnapshot?: jest.Mock;
  readSnapshot?: jest.Mock;
  recordWordMatchStarted?: jest.Mock;
  awardSessionXp?: jest.Mock;
  postGame?: {
    onGameSessionFinished: jest.Mock;
    getForGameSession: jest.Mock;
    onSoloWordFinished: jest.Mock;
  };
  decks?: unknown[];
} = {}) {
  const prisma = opts.prisma ?? buildPrismaDouble();
  const player = opts.player ?? { id: 'player-a', username: 'Alice' };
  const players = {
    findOrCreateByEmail: jest.fn().mockResolvedValue(player),
  };
  const wordRepo = {
    findRandomSessionDeck: jest.fn().mockResolvedValue(opts.decks ?? []),
  };
  const events = { emit: jest.fn() };
  const pushNotifications = { sendToPlayers: jest.fn() };
  const venueFeed = {
    recordWordMatchStarted: opts.recordWordMatchStarted ?? jest.fn(),
  };
  const subscriptions = {
    isActiveSubscriber: jest.fn().mockResolvedValue(opts.isSubscriber ?? false),
  };
  const venues = {
    assertCoordinatesAllowedForGuestVenue: jest.fn().mockResolvedValue(undefined),
  };
  const venuePlayLimit = {
    beginWordMatchDeck: jest.fn().mockResolvedValue(undefined),
  };
  const venuePlayBudget = {
    assertHasRemainingVenuePlayBudget: jest.fn().mockResolvedValue(undefined),
  };
  const gameXp = {
    tryAwardSessionWinXp: opts.awardSessionXp ?? jest.fn().mockResolvedValue(undefined),
  };
  const liveRedis = {
    refreshSnapshot: opts.refreshSnapshot ?? jest.fn().mockResolvedValue(undefined),
    removeSnapshot: opts.removeSnapshot ?? jest.fn().mockResolvedValue(undefined),
    readSnapshot: opts.readSnapshot ?? jest.fn().mockResolvedValue(null),
  };
  const postGame = opts.postGame ?? {
    onGameSessionFinished: jest.fn().mockResolvedValue(undefined),
    getForGameSession: jest.fn().mockResolvedValue({ moments: [], summary: { game: 'word', won: false } }),
    onSoloWordFinished: jest.fn(),
  };

  const svc = new WordMatchService(
    prisma as never,
    players as never,
    wordRepo as never,
    events as never,
    pushNotifications as never,
    venueFeed as never,
    subscriptions as never,
    venues as never,
    venuePlayLimit as never,
    venuePlayBudget as never,
    liveRedis as never,
    postGame as never,
  );
  return {
    svc,
    prisma,
    players,
    wordRepo,
    events,
    subscriptions,
    venues,
    liveRedis,
    gameXp,
    postGame,
    pushNotifications,
    venueFeed,
  };
}

describe('WordMatchService.enqueueVenueWordMatch', () => {
  const baseDto = {
    venueId: 'venue-1',
    latitude: 45,
    longitude: 16,
    mode: 'versus' as const,
    difficulty: 'normal',
    wordCount: 5,
    language: 'en',
  };

  it('rejects ranked outside versus mode', async () => {
    const { svc } = buildService();
    await expect(
      svc.enqueueVenueWordMatch('alice@x', { ...baseDto, mode: 'coop', ranked: true }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires an active subscription when no venueId is supplied', async () => {
    const { svc } = buildService({ isSubscriber: false });
    await expect(
      svc.enqueueVenueWordMatch('alice@x', { ...baseDto, venueId: undefined }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('cancels any in-flight WAITING row before enqueuing the new one', async () => {
    const { svc, prisma } = buildService();
    prisma.wordMatchQueueEntry.findFirst = jest.fn().mockResolvedValue(null);
    prisma.wordMatchQueueEntry.create = jest.fn().mockResolvedValue({ id: 'q-new' });

    await svc.enqueueVenueWordMatch('alice@x', baseDto);

    expect(prisma.wordMatchQueueEntry.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          playerId: 'player-a',
          status: WordMatchQueueStatus.WAITING,
        }),
        data: { status: WordMatchQueueStatus.CANCELLED },
      }),
    );
    expect(prisma.wordMatchQueueEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          venueId: 'venue-1',
          playerId: 'player-a',
          mode: WordMatchQueueMode.VERSUS,
          ranked: false,
        }),
      }),
    );
  });

  it('allows queuing without a venue when subscriber is active', async () => {
    const { svc, prisma, venues } = buildService({ isSubscriber: true });
    prisma.wordMatchQueueEntry.findFirst = jest.fn().mockResolvedValue(null);
    prisma.wordMatchQueueEntry.create = jest.fn().mockResolvedValue({ id: 'q-new' });

    await svc.enqueueVenueWordMatch('alice@x', { ...baseDto, venueId: undefined });

    // No geofence assertion when there is no venueId.
    expect(venues.assertCoordinatesAllowedForGuestVenue).not.toHaveBeenCalled();
    expect(prisma.wordMatchQueueEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ venueId: null, playerId: 'player-a' }),
      }),
    );
  });
});

describe('WordMatchService.tryFillWordQueueWithBot (casual-only)', () => {
  it('returns null without creating a session for ranked queue rows', async () => {
    const prisma = buildPrismaDouble();
    prisma.wordMatchQueueEntry.findUnique = jest.fn().mockResolvedValue({
      id: 'q-1',
      status: WordMatchQueueStatus.WAITING,
      ranked: true,
      playerId: 'player-a',
    });
    const { svc } = buildService({ prisma });

    const result = await svc.tryFillWordQueueWithBot('q-1');

    expect(result).toBeNull();
    expect(prisma.gameSession.create).not.toHaveBeenCalled();
    expect(prisma.wordMatchQueueEntry.updateMany).not.toHaveBeenCalled();
  });

  it('returns null if the row is no longer WAITING (race lost)', async () => {
    const prisma = buildPrismaDouble();
    prisma.wordMatchQueueEntry.findUnique = jest.fn().mockResolvedValue({
      id: 'q-1',
      status: WordMatchQueueStatus.MATCHED,
      ranked: false,
      playerId: 'player-a',
    });
    const { svc } = buildService({ prisma });

    expect(await svc.tryFillWordQueueWithBot('q-1')).toBeNull();
    expect(prisma.gameSession.create).not.toHaveBeenCalled();
  });
});

describe('WordMatchService.leave', () => {
  it('auto-wins the sole remaining versus opponent and refreshes the Redis snapshot', async () => {
    const sessionId = 'session-1';
    const config = {
      wordGameMode: 'versus' as const,
      difficulty: 'normal',
      wordIds: ['w1', 'w2'],
      hostPlayerId: 'player-a',
      ranked: false,
    };
    const baseSession = {
      id: sessionId,
      gameType: GameType.WORD_GAME,
      status: GameSessionStatus.ACTIVE,
      venueId: null,
      config,
      participants: [
        { id: 'pp-a', playerId: 'player-a', leftAt: null, isBot: false, score: 0 },
        { id: 'pp-b', playerId: 'player-b', leftAt: null, isBot: false, score: 0 },
      ],
      wordSession: { sharedWordIndex: 0, wordsSolvedCount: 0 },
    };

    const prisma = buildPrismaDouble();
    let lookups = 0;
    prisma.gameSession.findUnique = jest.fn().mockImplementation(async () => {
      lookups += 1;
      // After the leaving participant's update, fresh fetch should show only one active player.
      if (lookups >= 2) {
        return {
          ...baseSession,
          participants: [
            { ...baseSession.participants[0]!, leftAt: new Date(), result: GameParticipantResult.LOSS },
            baseSession.participants[1]!,
          ],
        };
      }
      return baseSession;
    });
    const refreshSnapshot = jest.fn().mockResolvedValue(undefined);
    const onGameSessionFinished = jest.fn().mockResolvedValue(undefined);

    const { svc, postGame } = buildService({
      prisma,
      player: { id: 'player-a', username: 'Alice' },
      refreshSnapshot,
      postGame: {
        onGameSessionFinished,
        getForGameSession: jest.fn(),
        onSoloWordFinished: jest.fn(),
      },
    });

    const result = await svc.leave('alice@x', sessionId);

    expect(result).toEqual({ ok: true });
    // The leaver's row is updated with leftAt + LOSS.
    expect(prisma.gameParticipant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pp-a' },
        data: expect.objectContaining({
          leftAt: expect.any(Date),
          result: GameParticipantResult.LOSS,
        }),
      }),
    );
    // Session is finalized and the lone remaining player wins with placement 1.
    expect(prisma.gameSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: sessionId },
        data: expect.objectContaining({
          status: GameSessionStatus.FINISHED,
          endedAt: expect.any(Date),
        }),
      }),
    );
    expect(prisma.gameParticipant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pp-b' },
        data: expect.objectContaining({
          result: GameParticipantResult.WIN,
          placement: 1,
        }),
      }),
    );
    // Authoritative writes complete; Redis snapshot is then refreshed.
    expect(refreshSnapshot).toHaveBeenCalledWith(sessionId);
    expect(onGameSessionFinished).toHaveBeenCalledWith(sessionId);
  });

  it('cancels a PENDING session when the last participant leaves', async () => {
    const sessionId = 'session-1';
    const config = {
      wordGameMode: 'coop' as const,
      difficulty: 'normal',
      wordIds: ['w1'],
      hostPlayerId: 'player-a',
    };
    const baseSession = {
      id: sessionId,
      gameType: GameType.WORD_GAME,
      status: GameSessionStatus.PENDING,
      venueId: null,
      config,
      participants: [
        { id: 'pp-a', playerId: 'player-a', leftAt: null, isBot: false, score: 0 },
      ],
      wordSession: { sharedWordIndex: 0, wordsSolvedCount: 0 },
    };

    const prisma = buildPrismaDouble();
    let lookups = 0;
    prisma.gameSession.findUnique = jest.fn().mockImplementation(async () => {
      lookups += 1;
      if (lookups >= 2) {
        return {
          ...baseSession,
          participants: [{ ...baseSession.participants[0]!, leftAt: new Date() }],
        };
      }
      return baseSession;
    });

    const { svc } = buildService({ prisma });

    await svc.leave('alice@x', sessionId);

    expect(prisma.gameSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: sessionId },
        data: expect.objectContaining({
          status: GameSessionStatus.CANCELLED,
        }),
      }),
    );
  });
});

describe('WordMatchService.start ranked guard', () => {
  it('rejects ranked versus start when more than 2 humans are present', async () => {
    const sessionId = 'sess-ranked-3';
    const prisma = buildPrismaDouble();
    prisma.gameSession.findUnique = jest.fn().mockResolvedValue({
      id: sessionId,
      gameType: GameType.WORD_GAME,
      status: GameSessionStatus.PENDING,
      config: {
        wordGameMode: 'versus',
        ranked: true,
        hostPlayerId: 'player-a',
        wordIds: ['w1'],
        difficulty: 'normal',
      },
      participants: [
        { id: '1', playerId: 'player-a', leftAt: null, isBot: false },
        { id: '2', playerId: 'player-b', leftAt: null, isBot: false },
        { id: '3', playerId: 'player-c', leftAt: null, isBot: false },
      ],
      wordSession: {},
    });

    const { svc } = buildService({
      prisma,
      player: { id: 'player-a', username: 'Alice' },
    });

    await expect(svc.start('alice@x', sessionId)).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.start('alice@x', sessionId)).rejects.toThrow(
      /ranked versus requires exactly 2 players/i,
    );
  });
});

describe('WordMatchService.versusPass', () => {
  it('advances the deck cursor without leaving or awarding a point', async () => {
    const sessionId = 'sess-vs-pass';
    const config = {
      wordGameMode: 'versus' as const,
      difficulty: 'normal',
      wordIds: ['w1', 'w2', 'w3'],
      hostPlayerId: 'player-a',
      ranked: false,
    };
    const prisma = buildPrismaDouble();
    prisma.gameParticipant.findFirst = jest.fn().mockResolvedValue({
      id: 'pp-a',
      playerId: 'player-a',
      leftAt: null,
    });
    prisma.gameSession.findUnique = jest.fn().mockResolvedValue({
      id: sessionId,
      status: GameSessionStatus.ACTIVE,
      venueId: null,
      config,
      wordSession: { sharedWordIndex: 0 },
      participants: [
        {
          id: 'pp-a',
          playerId: 'player-a',
          leftAt: null,
          isBot: false,
          score: 1,
          assists: 1,
        },
        {
          id: 'pp-b',
          playerId: 'player-b',
          leftAt: null,
          isBot: false,
          score: 0,
          assists: 0,
        },
      ],
    });
    prisma.word.findUnique = jest.fn().mockResolvedValue({
      id: 'w2',
      text: 'bean',
      sentenceHint: 's',
      wordHints: [],
      emojiHints: [],
    });
    prisma.gameParticipant.update = jest.fn().mockResolvedValue({ score: 1, assists: 2 });

    const { svc } = buildService({
      prisma,
      player: { id: 'player-a', username: 'Alice' },
    });

    const result = await svc.versusPass('alice@x', sessionId, {});

    expect(result.skipped).toBe(true);
    expect(result.finished).toBe(false);
    expect(result.yourScore).toBe(1);
    expect(prisma.gameParticipant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pp-a' },
        data: { assists: 2 },
      }),
    );
    expect(prisma.gameSession.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: GameSessionStatus.FINISHED }),
      }),
    );
  });
});

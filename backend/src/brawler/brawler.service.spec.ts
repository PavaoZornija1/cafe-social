// See word-match.service.spec.ts for context — venue helpers transitively import `@turf/turf`
// which depends on the ESM-only `kdbush`; we stub them here and inject test doubles below.
jest.mock('../venue/venue.service', () => ({ VenueService: class VenueService {} }));
jest.mock('../venue/venue-play-limit.service', () => ({
  VenuePlayLimitService: class VenuePlayLimitService {},
}));
jest.mock('../venue/venue-play-budget.service', () => ({
  VenuePlayBudgetService: class VenuePlayBudgetService {},
}));

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  BrawlerMatchQueueStatus,
  GameSessionStatus,
  GameType,
} from '@prisma/client';
import { BrawlerService } from './brawler.service';

type PrismaDouble = {
  $transaction: <T>(fn: (tx: PrismaDouble) => Promise<T>) => Promise<T>;
  brawlerMatchQueueEntry: {
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
  player: { findUnique: jest.Mock };
  brawlerHero: { findMany: jest.Mock };
};

function buildPrismaDouble(): PrismaDouble {
  const base: PrismaDouble = {
    $transaction: async (fn) => fn(base),
    brawlerMatchQueueEntry: {
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
    player: { findUnique: jest.fn() },
    brawlerHero: { findMany: jest.fn() },
  };
  return base;
}

function buildService(opts: {
  prisma?: PrismaDouble;
  player?: { id: string; username: string };
  isSubscriber?: boolean;
  refreshSnapshot?: jest.Mock;
  readSession?: jest.Mock;
  heroes?: Array<{ id: string }>;
  startSession?: jest.Mock;
  findSessionById?: jest.Mock;
} = {}) {
  const prisma = opts.prisma ?? buildPrismaDouble();
  const player = opts.player ?? { id: 'player-a', username: 'Alice' };
  const players = {
    findOrCreateByEmail: jest.fn().mockResolvedValue(player),
  };
  const brawlerRepo = {
    findHeroesByIds: jest
      .fn()
      .mockResolvedValue(opts.heroes ?? [{ id: 'hero-1', name: 'Bruiser' }]),
    findEnabledPowerups: jest.fn().mockResolvedValue([
      {
        id: 'speed_boost',
        displayName: 'Haste',
        description: 'Move faster for a short time.',
        effectType: 'MOVE_SPEED_MULT',
        magnitude: 1.25,
        durationMs: 9000,
        spawnWeight: 110,
        version: 1,
      },
    ]),
    findPlayersByIds: jest.fn().mockResolvedValue([player]),
    findActiveHeroes: jest.fn().mockResolvedValue([]),
    findSessionById: opts.findSessionById ?? jest.fn(),
    startSession: opts.startSession ?? jest.fn(),
    createSession: jest.fn(),
    finalizeSession: jest.fn(),
    createEvents: jest.fn(),
  };
  const venuePlayLimit = {
    beginBrawler: jest.fn().mockResolvedValue(undefined),
  };
  const venuePlayBudget = {
    assertHasRemainingVenuePlayBudget: jest.fn().mockResolvedValue(undefined),
    assertCanStartVenuePlayAtVenueWithCoords: jest.fn().mockResolvedValue(undefined),
  };
  const venues = {
    assertCoordinatesAllowedForGuestVenue: jest.fn().mockResolvedValue(undefined),
  };
  const gameXp = {
    tryAwardSessionWinXp: jest.fn().mockResolvedValue(undefined),
  };
  const brawlerLive = {
    refreshSnapshot: opts.refreshSnapshot ?? jest.fn().mockResolvedValue(undefined),
    readSession: opts.readSession ?? jest.fn().mockResolvedValue(null),
    removeSnapshot: jest.fn().mockResolvedValue(undefined),
  };
  const brawlerArena = {
    readState: jest.fn().mockResolvedValue(null),
    writeState: jest.fn().mockImplementation(async (s: { rev: number }) => ({ ...s, rev: s.rev + 1 })),
    initState: jest.fn().mockResolvedValue({
      v: 1,
      sessionId: 'session-1',
      rev: 0,
      spawns: [],
      pickedSpawnIds: [],
      buffsByParticipant: {},
      lastSpawnAtMs: 0,
    }),
    removeState: jest.fn().mockResolvedValue(undefined),
  };
  const subscriptions = {
    isActiveSubscriber: jest.fn().mockResolvedValue(opts.isSubscriber ?? false),
  };
  const events = {
    emit: jest.fn(),
  };

  const svc = new BrawlerService(
    prisma as never,
    brawlerRepo as never,
    players as never,
    venuePlayLimit as never,
    venuePlayBudget as never,
    venues as never,
    gameXp as never,
    brawlerLive as never,
    brawlerArena as never,
    subscriptions as never,
    events as never,
  );
  return {
    svc,
    prisma,
    brawlerRepo,
    players,
    brawlerLive,
    subscriptions,
    venues,
    venuePlayLimit,
    venuePlayBudget,
  };
}

describe('BrawlerService.enqueueVenueBrawlerMatch', () => {
  const baseDto = {
    venueId: 'venue-1',
    latitude: 45,
    longitude: 16,
    brawlerHeroId: 'hero-1',
  };

  it('rejects empty hero id', async () => {
    const { svc } = buildService();
    await expect(
      svc.enqueueVenueBrawlerMatch('alice@x', { ...baseDto, brawlerHeroId: '   ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects unknown / inactive hero', async () => {
    const { svc } = buildService({ heroes: [] });
    await expect(
      svc.enqueueVenueBrawlerMatch('alice@x', baseDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires an active subscription when no venueId is supplied', async () => {
    const { svc } = buildService({ isSubscriber: false });
    await expect(
      svc.enqueueVenueBrawlerMatch('alice@x', { ...baseDto, venueId: undefined }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('cancels any existing WAITING row before creating a fresh one', async () => {
    const prisma = buildPrismaDouble();
    prisma.brawlerMatchQueueEntry.findFirst = jest.fn().mockResolvedValue(null);
    prisma.brawlerMatchQueueEntry.create = jest.fn().mockResolvedValue({ id: 'q-new' });
    const { svc } = buildService({ prisma, isSubscriber: true });

    await svc.enqueueVenueBrawlerMatch('alice@x', { ...baseDto, venueId: undefined });

    expect(prisma.brawlerMatchQueueEntry.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          playerId: 'player-a',
          status: BrawlerMatchQueueStatus.WAITING,
        }),
        data: { status: BrawlerMatchQueueStatus.CANCELLED },
      }),
    );
    expect(prisma.brawlerMatchQueueEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          venueId: null,
          playerId: 'player-a',
          ranked: false,
          brawlerHeroId: 'hero-1',
        }),
      }),
    );
  });
});

describe('BrawlerService.tryFillBrawlerQueueWithBot (casual-only)', () => {
  it('returns null and does not create a session for ranked queue rows', async () => {
    const prisma = buildPrismaDouble();
    prisma.brawlerMatchQueueEntry.findUnique = jest.fn().mockResolvedValue({
      id: 'q-1',
      status: BrawlerMatchQueueStatus.WAITING,
      ranked: true,
      playerId: 'player-a',
      brawlerHeroId: 'hero-1',
      venueId: 'venue-1',
    });
    const { svc } = buildService({ prisma });

    const result = await svc.tryFillBrawlerQueueWithBot('q-1');

    expect(result).toBeNull();
    expect(prisma.gameSession.create).not.toHaveBeenCalled();
    expect(prisma.brawlerMatchQueueEntry.updateMany).not.toHaveBeenCalled();
  });

  it('returns null when the row is no longer WAITING (race lost)', async () => {
    const prisma = buildPrismaDouble();
    prisma.brawlerMatchQueueEntry.findUnique = jest.fn().mockResolvedValue({
      id: 'q-1',
      status: BrawlerMatchQueueStatus.MATCHED,
      ranked: false,
      playerId: 'player-a',
      brawlerHeroId: 'hero-1',
      venueId: 'venue-1',
    });
    const { svc } = buildService({ prisma });

    const result = await svc.tryFillBrawlerQueueWithBot('q-1');

    expect(result).toBeNull();
    expect(prisma.gameSession.create).not.toHaveBeenCalled();
  });

  it('creates a session with one bot mirroring the human hero, then activates and refreshes Redis', async () => {
    const prisma = buildPrismaDouble();
    const heroRow = {
      id: 'hero-1',
      name: 'Bruiser',
      version: 1,
      baseHp: 100,
      moveSpeed: 200,
      dashCooldownMs: 800,
      attackDamage: 12,
      attackKnockback: 200,
      isActive: true,
    };
    prisma.brawlerMatchQueueEntry.findUnique = jest.fn().mockResolvedValue({
      id: 'q-1',
      status: BrawlerMatchQueueStatus.WAITING,
      ranked: false,
      playerId: 'player-a',
      brawlerHeroId: 'hero-1',
      venueId: 'venue-1',
    });
    prisma.player.findUnique = jest.fn().mockResolvedValue({ username: 'Alice' });
    prisma.brawlerHero.findMany = jest.fn().mockResolvedValue([heroRow]);
    prisma.gameSession.create = jest.fn().mockResolvedValue({ id: 'session-bot' });
    prisma.brawlerMatchQueueEntry.updateMany = jest.fn().mockResolvedValue({ count: 1 });

    const refreshSnapshot = jest.fn().mockResolvedValue(undefined);
    const startSession = jest.fn().mockResolvedValue({
      id: 'session-bot',
      status: GameSessionStatus.ACTIVE,
    });
    const findSessionById = jest.fn().mockResolvedValue({
      id: 'session-bot',
      gameType: GameType.BRAWLER,
      status: GameSessionStatus.PENDING,
      venueId: 'venue-1',
      config: { ranked: false, playerVenueIds: { 'player-a': 'venue-1' } },
      participants: [
        { playerId: 'player-a', isBot: false },
        { playerId: null, isBot: true },
      ],
    });
    const { svc, brawlerRepo, venuePlayLimit, venuePlayBudget } = buildService({
      prisma,
      refreshSnapshot,
      startSession,
      findSessionById,
    });

    const result = await svc.tryFillBrawlerQueueWithBot('q-1');

    expect(result).toBe('session-bot');

    // Both the human and the bot were created, mirroring the human's hero.
    const createCall = prisma.gameSession.create.mock.calls[0]![0] as {
      data: {
        gameType: typeof GameType.BRAWLER;
        venueId: string | null;
        config: { brawler?: { powerups?: Array<{ id: string }> } };
        participants: { create: Array<{ isBot: boolean; brawlerHeroId?: string }> };
      };
    };
    expect(createCall.data.gameType).toBe(GameType.BRAWLER);
    expect(createCall.data.venueId).toBe('venue-1');
    expect(createCall.data.config?.brawler?.powerups?.length).toBeGreaterThan(0);
    const created = createCall.data.participants.create;
    expect(created).toHaveLength(2);
    expect(created.filter((p) => p.isBot)).toHaveLength(1);
    // Same hero id for both — bot mirrors the human's choice.
    expect(created.every((p) => p.brawlerHeroId === 'hero-1')).toBe(true);

    // Race-safe MATCHED transition with the WAITING precondition.
    expect(prisma.brawlerMatchQueueEntry.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'q-1',
          status: BrawlerMatchQueueStatus.WAITING,
        }),
        data: expect.objectContaining({
          status: BrawlerMatchQueueStatus.MATCHED,
          matchedSessionId: 'session-bot',
        }),
      }),
    );

    expect(venuePlayBudget.assertHasRemainingVenuePlayBudget).toHaveBeenCalledWith(
      'player-a',
      'venue-1',
    );
    // Activation path: repo.startSession + per-player play limit + Redis refresh.
    expect(brawlerRepo.startSession).toHaveBeenCalledWith('session-bot');
    expect(venuePlayLimit.beginBrawler).toHaveBeenCalledWith(
      'player-a',
      'venue-1',
      'session-bot',
    );
    expect(refreshSnapshot).toHaveBeenCalledWith('session-bot');
  });

  it('rolls the session back when the WAITING → MATCHED update lost a race', async () => {
    const prisma = buildPrismaDouble();
    const heroRow = {
      id: 'hero-1',
      name: 'Bruiser',
      version: 1,
      baseHp: 100,
      moveSpeed: 200,
      dashCooldownMs: 800,
      attackDamage: 12,
      attackKnockback: 200,
      isActive: true,
    };
    prisma.brawlerMatchQueueEntry.findUnique = jest.fn().mockResolvedValue({
      id: 'q-1',
      status: BrawlerMatchQueueStatus.WAITING,
      ranked: false,
      playerId: 'player-a',
      brawlerHeroId: 'hero-1',
      venueId: null,
    });
    prisma.player.findUnique = jest.fn().mockResolvedValue({ username: 'Alice' });
    prisma.brawlerHero.findMany = jest.fn().mockResolvedValue([heroRow]);
    prisma.gameSession.create = jest.fn().mockResolvedValue({ id: 'session-bot' });
    // Concurrent matchmaker beat us to MATCHED — count 0.
    prisma.brawlerMatchQueueEntry.updateMany = jest.fn().mockResolvedValue({ count: 0 });
    prisma.gameSession.delete = jest.fn().mockResolvedValue(undefined);

    const { svc } = buildService({ prisma });

    const result = await svc.tryFillBrawlerQueueWithBot('q-1');

    expect(result).toBeNull();
    expect(prisma.gameSession.delete).toHaveBeenCalledWith({ where: { id: 'session-bot' } });
  });
});

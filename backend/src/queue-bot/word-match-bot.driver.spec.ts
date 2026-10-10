jest.mock('../venue/venue.service', () => ({
  VenueService: class VenueService {},
}));
jest.mock('../venue/venue-play-limit.service', () => ({
  VenuePlayLimitService: class VenuePlayLimitService {},
}));
jest.mock('../venue/venue-play-budget.service', () => ({
  VenuePlayBudgetService: class VenuePlayBudgetService {},
}));
jest.mock('../word/word-match.service', () => ({
  WordMatchService: class WordMatchService {},
}));

import { GameSessionStatus, GameType } from '@prisma/client';
import { WordMatchBotDriver } from './word-match-bot.driver';
import { QueueBotLockBusyError } from './queue-bot-lock';

describe('WordMatchBotDriver.rehydrateActiveSessions', () => {
  it('registers ACTIVE word sessions that still have a live bot', async () => {
    const prisma = {
      gameSession: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'sess-bot',
            status: GameSessionStatus.ACTIVE,
            gameType: GameType.WORD_GAME,
            config: { wordGameMode: 'versus', difficulty: 'normal' },
            participants: [
              { id: 'bot-1', isBot: true, leftAt: null, playerId: null },
              { id: 'hum-1', isBot: false, leftAt: null, playerId: 'p1' },
            ],
            wordSession: {},
          },
          {
            id: 'sess-no-bot',
            status: GameSessionStatus.ACTIVE,
            gameType: GameType.WORD_GAME,
            config: { wordGameMode: 'coop', difficulty: 'normal' },
            participants: [
              { id: 'hum-2', isBot: false, leftAt: null, playerId: 'p2' },
            ],
            wordSession: {},
          },
        ]),
        findUnique: jest.fn(),
      },
      $queryRawUnsafe: jest.fn(),
      $executeRawUnsafe: jest.fn(),
    };

    // register() will look up each session again
    prisma.gameSession.findUnique.mockImplementation(
      async ({ where: { id } }) => {
        if (id === 'sess-bot') {
          return {
            id: 'sess-bot',
            status: GameSessionStatus.ACTIVE,
            config: { wordGameMode: 'versus', difficulty: 'normal' },
            participants: [
              { id: 'bot-1', isBot: true, leftAt: null },
              { id: 'hum-1', isBot: false, leftAt: null, playerId: 'p1' },
            ],
            wordSession: {},
          };
        }
        return null;
      },
    );

    const wordMatch = {
      executeWordMatchBotCoopTurn: jest.fn(),
      executeWordMatchBotVersusTurn: jest.fn(),
    };

    const driver = new WordMatchBotDriver(prisma as never, wordMatch as never);
    await driver.rehydrateActiveSessions();

    expect(prisma.gameSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          gameType: GameType.WORD_GAME,
          status: GameSessionStatus.ACTIVE,
        }),
      }),
    );
    expect(driver.pendingSessionIds()).toEqual(['sess-bot']);
    driver.onModuleDestroy();
  });
});

describe('WordMatchBotDriver ticking', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  function build(mode: 'coop' | 'versus' = 'versus') {
    const session = {
      id: 's1',
      status: GameSessionStatus.ACTIVE,
      config: { wordGameMode: mode, difficulty: 'normal' },
      participants: [
        { id: 'bot-1', isBot: true, leftAt: null, wordStats: null },
      ],
      wordSession: {},
    };
    const tx = { $queryRawUnsafe: jest.fn().mockResolvedValue([{ ok: true }]) };
    const prisma = {
      $transaction: jest.fn(async (work: (tx: unknown) => Promise<unknown>) =>
        work(tx),
      ),
      $queryRawUnsafe: jest.fn(),
      $executeRawUnsafe: jest.fn(),
      gameSession: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(session),
      },
    };
    const wordMatch = {
      executeWordMatchBotCoopTurn: jest.fn().mockResolvedValue({ done: false }),
      executeWordMatchBotVersusTurn: jest
        .fn()
        .mockResolvedValue({ finished: false }),
    };
    const driver = new WordMatchBotDriver(prisma as never, wordMatch as never);
    return { driver, prisma, tx, wordMatch, session };
  }

  it('performs zero database calls on idle ticks, including after an empty startup recovery', async () => {
    const { driver, prisma, tx } = build();
    await driver.onModuleInit();
    expect(prisma.gameSession.findMany).toHaveBeenCalledTimes(1);
    jest.clearAllMocks();
    await driver.tick();
    await jest.advanceTimersByTimeAsync(60_000);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.$queryRawUnsafe).not.toHaveBeenCalled();
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
    expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
    expect(prisma.gameSession.findMany).not.toHaveBeenCalled();
    expect(prisma.gameSession.findUnique).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each(['coop', 'versus'] as const)(
    'paces live %s turns and stops the timer when the session finishes',
    async (mode) => {
      const { driver, prisma, wordMatch } = build(mode);
      await driver.register('s1');
      jest.clearAllMocks();
      await jest.advanceTimersByTimeAsync(6000);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.gameSession.findUnique).not.toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(1000);
      const turn =
        mode === 'coop'
          ? wordMatch.executeWordMatchBotCoopTurn
          : wordMatch.executeWordMatchBotVersusTurn;
      expect(turn).toHaveBeenCalledWith('s1', 'bot-1', 'correct');
      expect(turn).toHaveBeenCalledTimes(1);
      expect(prisma.gameSession.findMany).not.toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(6000);
      expect(turn).toHaveBeenCalledTimes(1);
      prisma.gameSession.findUnique.mockResolvedValue(null as never);
      await jest.advanceTimersByTimeAsync(1000);
      expect(driver.pendingSessionIds()).toEqual([]);
      expect(jest.getTimerCount()).toBe(0);
      jest.clearAllMocks();
      await driver.tick();
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.gameSession.findUnique).not.toHaveBeenCalled();
    },
  );

  it('backs off on mutation lock contention without opening an outer transaction', async () => {
    const { driver, wordMatch, prisma } = build();
    await driver.register('s1');
    wordMatch.executeWordMatchBotVersusTurn.mockRejectedValueOnce(
      new QueueBotLockBusyError(),
    );
    await jest.advanceTimersByTimeAsync(7000);
    expect(wordMatch.executeWordMatchBotVersusTurn).toHaveBeenCalledTimes(1);
    expect(driver.pendingSessionIds()).toEqual(['s1']);
    await jest.advanceTimersByTimeAsync(4000);
    expect(wordMatch.executeWordMatchBotVersusTurn).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1000);
    expect(wordMatch.executeWordMatchBotVersusTurn).toHaveBeenCalledTimes(2);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    driver.onModuleDestroy();
  });

  it('recovers sessions separately from ticks and cleans up on shutdown', async () => {
    const { driver, prisma, session } = build();
    prisma.gameSession.findMany.mockResolvedValue([session] as never);
    await driver.recoverActiveSessions();
    expect(driver.pendingSessionIds()).toEqual(['s1']);
    expect(jest.getTimerCount()).toBe(1);
    await driver.recoverActiveSessions();
    expect(jest.getTimerCount()).toBe(1);
    driver.onModuleDestroy();
    expect(jest.getTimerCount()).toBe(0);
    expect(driver.pendingSessionIds()).toEqual([]);
  });
});

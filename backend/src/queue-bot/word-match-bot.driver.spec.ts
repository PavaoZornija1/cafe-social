jest.mock('../venue/venue.service', () => ({ VenueService: class VenueService {} }));
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
    prisma.gameSession.findUnique.mockImplementation(async ({ where: { id } }) => {
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
    });

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
  });
});

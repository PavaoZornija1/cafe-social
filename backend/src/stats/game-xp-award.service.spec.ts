import { GameParticipantResult, GameSessionStatus, GameType } from '@prisma/client';
import { GameXpAwardService } from './game-xp-award.service';
import {
  XP_WORD_VERSUS_FIRST_GLOBAL,
  XP_WORD_VERSUS_SECOND_GLOBAL,
} from '../lib/xp-rewards';

describe('GameXpAwardService.tryAwardSessionWinXp — versus', () => {
  function buildService() {
    const prisma = {
      gameSession: {
        updateMany: jest.fn(),
        findUnique: jest.fn(),
      },
      player: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const venueStats = { addVenueXp: jest.fn().mockResolvedValue(undefined) };
    const tierRewards = { syncTierRewards: jest.fn().mockResolvedValue(undefined) };
    const svc = new GameXpAwardService(
      prisma as never,
      venueStats as never,
      tierRewards as never,
    );
    return { svc, prisma, venueStats, tierRewards };
  }

  it('forfeit-while-ahead: awards first XP and Elo to WIN even when LOSS has higher score', async () => {
    const { svc, prisma } = buildService();
    const sessionId = 'sess-forfeit';

    prisma.gameSession.updateMany
      .mockResolvedValueOnce({ count: 1 }) // winXp claim
      .mockResolvedValueOnce({ count: 1 }); // rank claim

    prisma.gameSession.findUnique.mockResolvedValue({
      id: sessionId,
      venueId: null,
      gameType: GameType.WORD_GAME,
      config: { wordGameMode: 'versus', ranked: true },
      rankAwardedAt: null,
      participants: [
        {
          playerId: 'player-a',
          result: GameParticipantResult.LOSS,
          kills: 0,
          deaths: 0,
          score: 3,
          placement: 2,
        },
        {
          playerId: 'player-b',
          result: GameParticipantResult.WIN,
          kills: 0,
          deaths: 0,
          score: 1,
          placement: 1,
        },
      ],
    });

    prisma.player.findUnique
      .mockResolvedValueOnce({
        competitiveRankRating: 1500,
        wordRankRating: 1500,
      })
      .mockResolvedValueOnce({
        competitiveRankRating: 1500,
        wordRankRating: 1500,
      });

    const awarded = await svc.tryAwardSessionWinXp(sessionId);

    expect(awarded['player-b']).toBe(XP_WORD_VERSUS_FIRST_GLOBAL);
    expect(awarded['player-a']).toBe(XP_WORD_VERSUS_SECOND_GLOBAL);

    // Sorted player ids for Elo: a before b alphabetically (mirrors brawler pairing).
    const ratingUpdates = prisma.player.update.mock.calls
      .map((c: [{ where: { id: string }; data: Record<string, number> }]) => c[0])
      .filter((u) => typeof u.data.wordRankRating === 'number');
    const updateA = ratingUpdates.find((u) => u.where.id === 'player-a');
    const updateB = ratingUpdates.find((u) => u.where.id === 'player-b');
    expect(updateA).toBeDefined();
    expect(updateB).toBeDefined();
    // B won → B rating up, A rating down
    expect(updateB!.data.wordRankRating).toBeGreaterThan(1500);
    expect(updateA!.data.wordRankRating).toBeLessThan(1500);
    expect(updateB!.data.competitiveRankRating).toBeGreaterThan(1500);
    expect(updateA!.data.competitiveRankRating).toBeLessThan(1500);
  });

  it('ranks WIN before LOSS when scores are equal', async () => {
    const { svc, prisma } = buildService();
    prisma.gameSession.updateMany.mockResolvedValue({ count: 1 });
    prisma.gameSession.findUnique.mockResolvedValue({
      id: 'sess-tie-score',
      venueId: null,
      gameType: GameType.WORD_GAME,
      config: { wordGameMode: 'versus', ranked: false },
      rankAwardedAt: null,
      participants: [
        {
          playerId: 'loser',
          result: GameParticipantResult.LOSS,
          kills: 0,
          deaths: 0,
          score: 2,
          placement: 2,
        },
        {
          playerId: 'winner',
          result: GameParticipantResult.WIN,
          kills: 0,
          deaths: 0,
          score: 2,
          placement: 1,
        },
      ],
    });

    const awarded = await svc.tryAwardSessionWinXp('sess-tie-score');
    expect(awarded['winner']).toBe(XP_WORD_VERSUS_FIRST_GLOBAL);
    expect(awarded['loser']).toBe(XP_WORD_VERSUS_SECOND_GLOBAL);
  });

  it('does not award when claim already taken', async () => {
    const { svc, prisma } = buildService();
    prisma.gameSession.updateMany.mockResolvedValue({ count: 0 });
    const awarded = await svc.tryAwardSessionWinXp('already');
    expect(awarded).toEqual({});
    expect(prisma.gameSession.findUnique).not.toHaveBeenCalled();
  });
});

describe('GameXpAwardService — claim gate', () => {
  it('claims FINISHED sessions with null winXpAwardedAt', async () => {
    const prisma = {
      gameSession: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUnique: jest.fn(),
      },
      player: { findUnique: jest.fn(), update: jest.fn() },
    };
    const svc = new GameXpAwardService(
      prisma as never,
      { addVenueXp: jest.fn() } as never,
      { syncTierRewards: jest.fn() } as never,
    );
    await svc.tryAwardSessionWinXp('s1');
    expect(prisma.gameSession.updateMany).toHaveBeenCalledWith({
      where: {
        id: 's1',
        status: GameSessionStatus.FINISHED,
        winXpAwardedAt: null,
      },
      data: { winXpAwardedAt: expect.any(Date) },
    });
  });
});

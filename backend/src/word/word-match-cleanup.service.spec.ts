import { GameSessionStatus, GameType } from '@prisma/client';
import { WordMatchCleanupService } from './word-match-cleanup.service';

describe('WordMatchCleanupService', () => {
  function build() {
    const prisma = {
      gameSession: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const liveRedis = {
      removeSnapshots: jest.fn().mockResolvedValue(undefined),
    };
    const svc = new WordMatchCleanupService(prisma as never, liveRedis as never);
    return { svc, prisma, liveRedis };
  }

  it('cancels stale PENDING word matches and drops Redis snapshots', async () => {
    const { svc, prisma, liveRedis } = build();
    prisma.gameSession.findMany.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]);
    prisma.gameSession.updateMany.mockResolvedValue({ count: 2 });

    await svc.expireStalePendingMatches();

    expect(prisma.gameSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          gameType: GameType.WORD_GAME,
          status: GameSessionStatus.PENDING,
        }),
      }),
    );
    expect(prisma.gameSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: GameSessionStatus.CANCELLED,
        }),
      }),
    );
    expect(liveRedis.removeSnapshots).toHaveBeenCalledWith(['p1', 'p2']);
  });

  it('cancels stale ACTIVE word matches past idle TTL', async () => {
    const { svc, prisma, liveRedis } = build();
    prisma.gameSession.findMany.mockResolvedValue([{ id: 'a1' }]);
    prisma.gameSession.updateMany.mockResolvedValue({ count: 1 });

    await svc.expireStaleActiveMatches();

    expect(prisma.gameSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          gameType: GameType.WORD_GAME,
          status: GameSessionStatus.ACTIVE,
        }),
      }),
    );
    expect(prisma.gameSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: GameSessionStatus.ACTIVE,
          id: { in: ['a1'] },
        }),
        data: expect.objectContaining({
          status: GameSessionStatus.CANCELLED,
          endedAt: expect.any(Date),
        }),
      }),
    );
    expect(liveRedis.removeSnapshots).toHaveBeenCalledWith(['a1']);
  });

  it('no-ops when no stale ACTIVE matches', async () => {
    const { svc, prisma, liveRedis } = build();
    prisma.gameSession.findMany.mockResolvedValue([]);
    await svc.expireStaleActiveMatches();
    expect(prisma.gameSession.updateMany).not.toHaveBeenCalled();
    expect(liveRedis.removeSnapshots).not.toHaveBeenCalled();
  });
});

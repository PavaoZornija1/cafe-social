jest.mock('../word/word-match.service', () => ({
  WordMatchService: class WordMatchService {},
}));
jest.mock('../brawler/brawler.service', () => ({
  BrawlerService: class BrawlerService {},
}));

import { QueueBotFillService } from './queue-bot-fill.service';

describe('QueueBotFillService', () => {
  it('runs word fill for stale WAITING rows and registers bot driver when session created', async () => {
    const prisma = {
      $queryRawUnsafe: jest.fn(),
      $executeRawUnsafe: jest.fn(),
      wordMatchQueueEntry: {
        findMany: jest.fn().mockResolvedValue([{ id: 'q1' }, { id: 'q2' }]),
      },
      brawlerMatchQueueEntry: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const wordMatch = {
      tryFillWordQueueWithBot: jest
        .fn()
        .mockResolvedValueOnce('sess-a')
        .mockResolvedValueOnce(null),
    };
    const brawler = { tryFillBrawlerQueueWithBot: jest.fn() };
    const wordBotDriver = { register: jest.fn() };

    prisma.$queryRawUnsafe.mockResolvedValue([{ ok: true }]);

    const svc = new QueueBotFillService(
      prisma as never,
      wordMatch as never,
      brawler as never,
      wordBotDriver as never,
    );

    await svc.sweep();

    expect(prisma.$queryRawUnsafe).toHaveBeenCalled();
    expect(wordMatch.tryFillWordQueueWithBot).toHaveBeenCalledWith('q1');
    expect(wordMatch.tryFillWordQueueWithBot).toHaveBeenCalledWith('q2');
    expect(wordBotDriver.register).toHaveBeenCalledWith('sess-a');
    expect(wordBotDriver.register).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRawUnsafe).toHaveBeenCalled();
  });

  it('skips sweep when advisory lock is not acquired', async () => {
    const prisma = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ ok: false }]),
      $executeRawUnsafe: jest.fn(),
      wordMatchQueueEntry: { findMany: jest.fn() },
      brawlerMatchQueueEntry: { findMany: jest.fn() },
    };
    const svc = new QueueBotFillService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await svc.sweep();

    expect(prisma.wordMatchQueueEntry.findMany).not.toHaveBeenCalled();
    expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });
});

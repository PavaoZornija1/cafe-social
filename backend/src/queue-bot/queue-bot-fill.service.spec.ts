jest.mock('../word/word-match.service', () => ({
  WordMatchService: class WordMatchService {},
}));
jest.mock('../brawler/brawler.service', () => ({
  BrawlerService: class BrawlerService {},
}));

import { QueueBotFillService } from './queue-bot-fill.service';
import { getQueueBotConfig } from './queue-bot-config';
import { QueueBotLockBusyError } from './queue-bot-lock';

function build() {
  const tx = { $queryRawUnsafe: jest.fn().mockResolvedValue([{ ok: true }]) };
  const prisma = {
    $transaction: jest.fn(async (work: (tx: unknown) => Promise<unknown>) =>
      work(tx),
    ),
    $queryRawUnsafe: jest.fn(),
    $executeRawUnsafe: jest.fn(),
    wordMatchQueueEntry: { findMany: jest.fn().mockResolvedValue([]) },
    brawlerMatchQueueEntry: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const wordMatch = {
    tryFillWordQueueWithBot: jest.fn().mockResolvedValue(null),
  };
  const brawler = {
    tryFillBrawlerQueueWithBot: jest.fn().mockResolvedValue(null),
    expireStaleBrawlerQueueEntries: jest.fn().mockResolvedValue(0),
  };
  const wordBotDriver = { register: jest.fn().mockResolvedValue(undefined) };
  const svc = new QueueBotFillService(
    prisma as never,
    wordMatch as never,
    brawler as never,
    wordBotDriver as never,
  );
  return { svc, prisma, tx, wordMatch, brawler, wordBotDriver };
}

describe('QueueBotFillService', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('performs zero database calls during an idle sweep or idle timer period', async () => {
    const { svc, prisma, tx, wordMatch, brawler } = build();
    await svc.sweep();
    await jest.advanceTimersByTimeAsync(60_000);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
    expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
    expect(tx.$queryRawUnsafe).not.toHaveBeenCalled();
    expect(prisma.wordMatchQueueEntry.findMany).not.toHaveBeenCalled();
    expect(prisma.brawlerMatchQueueEntry.findMany).not.toHaveBeenCalled();
    expect(wordMatch.tryFillWordQueueWithBot).not.toHaveBeenCalled();
    expect(brawler.tryFillBrawlerQueueWithBot).not.toHaveBeenCalled();
    expect(brawler.expireStaleBrawlerQueueEntries).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('fills only the scheduled word entry after its configured delay', async () => {
    const { svc, prisma, tx, wordMatch, wordBotDriver, brawler } = build();
    wordMatch.tryFillWordQueueWithBot.mockResolvedValue('sess-a');
    svc.schedule({ game: 'word', id: 'q1', createdAt: new Date() });
    await svc.sweep();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(
      getQueueBotConfig().wordFillAfterMs - 1,
    );
    expect(wordMatch.tryFillWordQueueWithBot).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(wordMatch.tryFillWordQueueWithBot).toHaveBeenCalledWith('q1');
    expect(wordBotDriver.register).toHaveBeenCalledWith('sess-a');
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.$queryRawUnsafe).not.toHaveBeenCalled();
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
    expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
    expect(brawler.expireStaleBrawlerQueueEntries).not.toHaveBeenCalled();
    expect(prisma.wordMatchQueueEntry.findMany).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
    jest.clearAllMocks();
    await svc.sweep();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('fills a brawler entry and does not register a word driver', async () => {
    const { svc, brawler, wordBotDriver } = build();
    svc.schedule({ game: 'brawler', id: 'b1', createdAt: new Date() });
    await jest.advanceTimersByTimeAsync(getQueueBotConfig().brawlerFillAfterMs);
    expect(brawler.tryFillBrawlerQueueWithBot).toHaveBeenCalledWith('b1');
    expect(wordBotDriver.register).not.toHaveBeenCalled();
  });

  it('does not register a driver for an entry already matched or cancelled', async () => {
    const { svc, wordMatch, wordBotDriver } = build();
    svc.schedule({ game: 'word', id: 'gone', createdAt: new Date(0) });
    await svc.sweep();
    expect(wordMatch.tryFillWordQueueWithBot).toHaveBeenCalledTimes(1);
    expect(wordBotDriver.register).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each(['failure', 'contention'])(
    'bounds retries with exponential backoff on %s and keeps processing other entries',
    async (reason) => {
      const { svc, prisma, wordMatch, brawler, wordBotDriver } = build();
      wordMatch.tryFillWordQueueWithBot.mockRejectedValue(
        reason === 'contention'
          ? new QueueBotLockBusyError()
          : new Error('broken entry'),
      );
      svc.schedule({ game: 'word', id: 'q1', createdAt: new Date(0) });
      svc.schedule({ game: 'brawler', id: 'b1', createdAt: new Date(0) });
      await svc.sweep();
      expect(wordMatch.tryFillWordQueueWithBot).toHaveBeenCalledTimes(1);
      expect(brawler.tryFillBrawlerQueueWithBot).toHaveBeenCalledWith('b1');
      await jest.advanceTimersByTimeAsync(4999);
      expect(wordMatch.tryFillWordQueueWithBot).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(1);
      expect(wordMatch.tryFillWordQueueWithBot).toHaveBeenCalledTimes(2);
      await jest.advanceTimersByTimeAsync(9999);
      expect(wordMatch.tryFillWordQueueWithBot).toHaveBeenCalledTimes(2);
      await jest.advanceTimersByTimeAsync(1);
      expect(wordMatch.tryFillWordQueueWithBot).toHaveBeenCalledTimes(3);
      expect(jest.getTimerCount()).toBe(0);
      await jest.advanceTimersByTimeAsync(60_000);
      await svc.sweep();
      expect(wordMatch.tryFillWordQueueWithBot).toHaveBeenCalledTimes(3);
      expect(wordBotDriver.register).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );

  it('recovers restart entries at their original due time and deduplicates events', async () => {
    const { svc, prisma, wordMatch, brawler } = build();
    const createdAt = new Date(
      Date.now() - getQueueBotConfig().wordFillAfterMs / 2,
    );
    prisma.wordMatchQueueEntry.findMany.mockResolvedValue([
      { id: 'q1', createdAt },
    ] as never);
    prisma.brawlerMatchQueueEntry.findMany.mockResolvedValue([
      { id: 'b1', createdAt: new Date(0) },
    ] as never);
    await svc.onApplicationBootstrap();
    await svc.recoverWaitingEntries();
    svc.schedule({ game: 'word', id: 'q1', createdAt });
    expect(jest.getTimerCount()).toBe(2);
    await jest.advanceTimersByTimeAsync(1);
    expect(brawler.tryFillBrawlerQueueWithBot).toHaveBeenCalledWith('b1');
    expect(wordMatch.tryFillWordQueueWithBot).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(
      getQueueBotConfig().wordFillAfterMs / 2,
    );
    expect(wordMatch.tryFillWordQueueWithBot).toHaveBeenCalledTimes(1);
    expect(prisma.wordMatchQueueEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'WAITING', ranked: false, partyId: null },
      }),
    );
  });

  it('handles a timer that fires while another entry is in flight', async () => {
    const { svc, wordMatch, brawler } = build();
    let finish!: (value: null) => void;
    wordMatch.tryFillWordQueueWithBot.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    svc.schedule({ game: 'word', id: 'q1', createdAt: new Date(0) });
    const running = svc.sweep();
    svc.schedule({ game: 'brawler', id: 'b1', createdAt: new Date(0) });
    await svc.sweep();
    expect(brawler.tryFillBrawlerQueueWithBot).not.toHaveBeenCalled();
    finish(null);
    await running;
    await jest.advanceTimersByTimeAsync(1);
    expect(brawler.tryFillBrawlerQueueWithBot).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('cancels timers on shutdown', async () => {
    const { svc, brawler, wordMatch } = build();
    svc.schedule({ game: 'word', id: 'q1', createdAt: new Date() });
    svc.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(60_000);
    expect(wordMatch.tryFillWordQueueWithBot).not.toHaveBeenCalled();
    expect(brawler.expireStaleBrawlerQueueEntries).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });
});

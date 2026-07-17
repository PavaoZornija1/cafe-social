jest.mock('../venue/venue.service', () => ({ VenueService: class VenueService {} }));

import { BadRequestException } from '@nestjs/common';
import { DailyWordService } from './daily-word.service';

describe('DailyWordService.guess', () => {
  function build(opts: {
    existing?: { attempts: number; solvedAt: Date | null } | null;
    wordText?: string;
  } = {}) {
    const wordText = opts.wordText ?? 'cafe';
    const existing = opts.existing === undefined
      ? { attempts: 0, solvedAt: null as Date | null }
      : opts.existing;

    const playerDailyWord = {
      upsert: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn().mockResolvedValue(existing),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    };
    const playerDailyStreak = {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({ currentStreak: 1 }),
    };
    const prisma: {
      $transaction: jest.Mock;
      word: { findUnique: jest.Mock };
      playerDailyWord: typeof playerDailyWord;
      playerDailyStreak: typeof playerDailyStreak;
      venue: { findUnique: jest.Mock };
    } = {
      $transaction: jest.fn(),
      word: {
        findUnique: jest.fn().mockResolvedValue({
          text: wordText,
          sentenceHint: 'hint',
          wordHints: [],
          emojiHints: [],
        }),
      },
      playerDailyWord,
      playerDailyStreak,
      venue: { findUnique: jest.fn() },
    };
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) =>
      fn(prisma),
    );

    const players = {
      findOrCreateByEmail: jest.fn().mockResolvedValue({
        id: 'p1',
        username: 'alice',
      }),
    };
    const words = {
      pickWordIdForDaily: jest.fn().mockResolvedValue('w1'),
    };
    const feed = { recordDailyWordSolved: jest.fn() };
    const subscriptions = { isActiveSubscriber: jest.fn().mockResolvedValue(true) };
    const venues = {
      assertCoordinatesAllowedForGuestVenue: jest.fn().mockResolvedValue(undefined),
    };
    const gameXp = { tryAwardDailyWordFirstSolve: jest.fn().mockResolvedValue(undefined) };
    const challenges = {
      bumpActiveChallengesForPlayerAtVenue: jest.fn().mockResolvedValue([]),
    };

    const svc = new DailyWordService(
      players as never,
      words as never,
      feed as never,
      prisma as never,
      subscriptions as never,
      venues as never,
      gameXp as never,
      challenges as never,
    );

    return { svc, prisma, playerDailyWord, gameXp };
  }

  it('uses CAS updateMany so concurrent wrong guesses cannot both keep the same attempts', async () => {
    const { svc, playerDailyWord } = build({
      existing: { attempts: 5, solvedAt: null },
    });

    const res = await svc.guess({
      email: 'a@x',
      dto: { scope: 'global', guess: 'wrong', language: 'en' },
    });

    expect(playerDailyWord.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          attempts: 5,
          solvedAt: null,
        }),
        data: { attempts: { increment: 1 } },
      }),
    );
    expect(res.attempts).toBe(6);
    expect(res.word).toBe('cafe');
    expect(res.solved).toBe(false);
  });

  it('reveals the answer when attempts are already exhausted', async () => {
    const { svc, playerDailyWord } = build({
      existing: { attempts: 6, solvedAt: null },
    });

    const res = await svc.guess({
      email: 'a@x',
      dto: { scope: 'global', guess: 'anything', language: 'en' },
    });

    expect(playerDailyWord.updateMany).not.toHaveBeenCalled();
    expect(res.word).toBe('cafe');
    expect(res.attempts).toBe(6);
  });

  it('rejects when CAS loses the race on a wrong guess', async () => {
    const { svc, playerDailyWord } = build({
      existing: { attempts: 2, solvedAt: null },
    });
    playerDailyWord.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      svc.guess({
        email: 'a@x',
        dto: { scope: 'global', guess: 'nope', language: 'en' },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('DailyWordService.getState', () => {
  it('reveals the word after attempts are exhausted', async () => {
    const prisma = {
      playerDailyWord: {
        findUnique: jest.fn().mockResolvedValue({ attempts: 6, solvedAt: null }),
      },
      playerDailyStreak: { findUnique: jest.fn().mockResolvedValue(null) },
      word: {
        findUnique: jest.fn().mockResolvedValue({
          text: 'latte',
          sentenceHint: 's',
          wordHints: [],
          emojiHints: [],
        }),
      },
      venue: { findUnique: jest.fn() },
    };
    const svc = new DailyWordService(
      { findOrCreateByEmail: jest.fn().mockResolvedValue({ id: 'p1' }) } as never,
      { pickWordIdForDaily: jest.fn().mockResolvedValue('w1') } as never,
      { recordDailyWordSolved: jest.fn() } as never,
      prisma as never,
      { isActiveSubscriber: jest.fn().mockResolvedValue(true) } as never,
      { assertCoordinatesAllowedForGuestVenue: jest.fn() } as never,
      { tryAwardDailyWordFirstSolve: jest.fn() } as never,
      { bumpActiveChallengesForPlayerAtVenue: jest.fn() } as never,
    );

    const state = await svc.getState({
      email: 'a@x',
      scope: 'global',
      language: 'en',
    });
    expect(state.word).toBe('latte');
    expect(state.solved).toBe(false);
    expect(state.attempts).toBe(6);
  });
});

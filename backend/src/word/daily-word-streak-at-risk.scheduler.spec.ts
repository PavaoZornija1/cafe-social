import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { utcDayKey, previousUtcDayKey } from '../lib/day-key';
import { DailyWordStreakAtRiskScheduler } from './daily-word-streak-at-risk.scheduler';

describe('DailyWordStreakAtRiskScheduler', () => {
  let scheduler: DailyWordStreakAtRiskScheduler;
  let prisma: {
    playerDailyStreak: { findMany: jest.Mock };
    playerDailyWord: { findFirst: jest.Mock };
    dailyStreakAtRiskPushLog: { findUnique: jest.Mock; create: jest.Mock };
    player: { findUnique: jest.Mock };
    playerExpoPushToken: { findMany: jest.Mock };
    venue: { findUnique: jest.Mock };
  };
  let push: { sendExpo: jest.Mock };
  let configGet: jest.Mock;

  beforeEach(async () => {
    prisma = {
      playerDailyStreak: { findMany: jest.fn() },
      playerDailyWord: { findFirst: jest.fn() },
      dailyStreakAtRiskPushLog: { findUnique: jest.fn(), create: jest.fn() },
      player: { findUnique: jest.fn() },
      playerExpoPushToken: { findMany: jest.fn() },
      venue: { findUnique: jest.fn() },
    };
    push = { sendExpo: jest.fn().mockResolvedValue(undefined) };
    configGet = jest.fn().mockReturnValue(undefined);

    const moduleRef = await Test.createTestingModule({
      providers: [
        DailyWordStreakAtRiskScheduler,
        { provide: PrismaService, useValue: prisma },
        { provide: PushService, useValue: push },
        { provide: ConfigService, useValue: { get: configGet } },
      ],
    }).compile();

    scheduler = moduleRef.get(DailyWordStreakAtRiskScheduler);
  });

  it('skips entirely when DAILY_STREAK_AT_RISK_PUSH_ENABLED=0', async () => {
    configGet.mockReturnValue('0');
    await scheduler.sendStreakAtRiskPushes();
    expect(prisma.playerDailyStreak.findMany).not.toHaveBeenCalled();
  });

  it('sends global streak-at-risk push and logs once', async () => {
    const todayKey = utcDayKey();
    const yesterdayKey = previousUtcDayKey(todayKey);

    prisma.playerDailyStreak.findMany.mockResolvedValue([
      {
        playerId: 'p1',
        scopeKey: 'global',
        currentStreak: 3,
        lastSolvedDayKey: yesterdayKey,
      },
    ]);
    prisma.playerDailyWord.findFirst.mockResolvedValue(null);
    prisma.dailyStreakAtRiskPushLog.findUnique.mockResolvedValue(null);
    prisma.player.findUnique.mockResolvedValue({
      totalPrivacy: false,
      matchActivityPush: true,
    });
    prisma.playerExpoPushToken.findMany.mockResolvedValue([
      { token: 'ExponentPushToken[abc]' },
    ]);
    prisma.dailyStreakAtRiskPushLog.create.mockResolvedValue({});

    await scheduler.sendStreakAtRiskPushes();

    expect(push.sendExpo).toHaveBeenCalledWith(
      ['ExponentPushToken[abc]'],
      expect.objectContaining({
        title: 'Keep your streak going',
        data: expect.objectContaining({
          kind: 'daily_streak_at_risk',
          scopeKey: 'global',
          streak: 3,
        }),
      }),
    );
    expect(prisma.dailyStreakAtRiskPushLog.create).toHaveBeenCalledWith({
      data: { playerId: 'p1', scopeKey: 'global', dayKey: todayKey },
    });
  });

  it('skips when player already solved today', async () => {
    const yesterdayKey = previousUtcDayKey(utcDayKey());
    prisma.playerDailyStreak.findMany.mockResolvedValue([
      {
        playerId: 'p1',
        scopeKey: 'global',
        currentStreak: 4,
        lastSolvedDayKey: yesterdayKey,
      },
    ]);
    prisma.playerDailyWord.findFirst.mockResolvedValue({ playerId: 'p1' });

    await scheduler.sendStreakAtRiskPushes();

    expect(push.sendExpo).not.toHaveBeenCalled();
  });

  it('skips when player has match activity push disabled', async () => {
    const yesterdayKey = previousUtcDayKey(utcDayKey());
    prisma.playerDailyStreak.findMany.mockResolvedValue([
      {
        playerId: 'p1',
        scopeKey: 'global',
        currentStreak: 5,
        lastSolvedDayKey: yesterdayKey,
      },
    ]);
    prisma.playerDailyWord.findFirst.mockResolvedValue(null);
    prisma.dailyStreakAtRiskPushLog.findUnique.mockResolvedValue(null);
    prisma.player.findUnique.mockResolvedValue({
      totalPrivacy: false,
      matchActivityPush: false,
    });

    await scheduler.sendStreakAtRiskPushes();

    expect(push.sendExpo).not.toHaveBeenCalled();
  });

  it('includes venue name for venue-scoped streaks', async () => {
    const todayKey = utcDayKey();
    const yesterdayKey = previousUtcDayKey(todayKey);

    prisma.playerDailyStreak.findMany.mockResolvedValue([
      {
        playerId: 'p1',
        scopeKey: 'venue-1',
        currentStreak: 2,
        lastSolvedDayKey: yesterdayKey,
      },
    ]);
    prisma.playerDailyWord.findFirst.mockResolvedValue(null);
    prisma.dailyStreakAtRiskPushLog.findUnique.mockResolvedValue(null);
    prisma.player.findUnique.mockResolvedValue({
      totalPrivacy: false,
      matchActivityPush: true,
    });
    prisma.playerExpoPushToken.findMany.mockResolvedValue([
      { token: 'ExponentPushToken[venue]' },
    ]);
    prisma.venue.findUnique.mockResolvedValue({ name: 'Pilot Café' });
    prisma.dailyStreakAtRiskPushLog.create.mockResolvedValue({});

    await scheduler.sendStreakAtRiskPushes();

    expect(push.sendExpo).toHaveBeenCalledWith(
      ['ExponentPushToken[venue]'],
      expect.objectContaining({
        body: expect.stringContaining('Pilot Café'),
        data: expect.objectContaining({
          kind: 'daily_streak_at_risk',
          venueId: 'venue-1',
        }),
      }),
    );
  });
});

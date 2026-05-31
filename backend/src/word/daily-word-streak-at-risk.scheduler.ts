import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { utcDayKey, previousUtcDayKey } from '../lib/day-key';

const MIN_STREAK = 2;

@Injectable()
export class DailyWordStreakAtRiskScheduler {
  private readonly logger = new Logger(DailyWordStreakAtRiskScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly config: ConfigService,
  ) {}

  /** Evening UTC reminder for players who solved yesterday but not today yet. */
  @Cron('0 18 * * *')
  async sendStreakAtRiskPushes(): Promise<void> {
    const raw = this.config.get<string>('DAILY_STREAK_AT_RISK_PUSH_ENABLED');
    if (raw !== undefined && raw.trim() === '0') {
      return;
    }

    const todayKey = utcDayKey();
    const yesterdayKey = previousUtcDayKey(todayKey);

    const streakRows = await this.prisma.playerDailyStreak.findMany({
      where: {
        currentStreak: { gte: MIN_STREAK },
        lastSolvedDayKey: yesterdayKey,
      },
      select: {
        playerId: true,
        scopeKey: true,
        currentStreak: true,
      },
      take: 500,
    });

    let sent = 0;
    for (const row of streakRows) {
      const alreadySolvedToday = await this.prisma.playerDailyWord.findFirst({
        where: {
          playerId: row.playerId,
          scopeKey: row.scopeKey,
          dayKey: todayKey,
          solvedAt: { not: null },
        },
        select: { playerId: true },
      });
      if (alreadySolvedToday) continue;

      const logged = await this.prisma.dailyStreakAtRiskPushLog.findUnique({
        where: {
          playerId_scopeKey_dayKey: {
            playerId: row.playerId,
            scopeKey: row.scopeKey,
            dayKey: todayKey,
          },
        },
      });
      if (logged) continue;

      const player = await this.prisma.player.findUnique({
        where: { id: row.playerId },
        select: { totalPrivacy: true, matchActivityPush: true },
      });
      if (!player || player.totalPrivacy || !player.matchActivityPush) continue;

      const tokenRows = await this.prisma.playerExpoPushToken.findMany({
        where: { playerId: row.playerId },
        select: { token: true },
      });
      if (tokenRows.length === 0) continue;

      const isVenue = row.scopeKey !== 'global';
      let venueName: string | undefined;
      if (isVenue) {
        const venue = await this.prisma.venue.findUnique({
          where: { id: row.scopeKey },
          select: { name: true },
        });
        venueName = venue?.name;
      }

      const title = 'Keep your streak going';
      const body = isVenue
        ? venueName
          ? `Your ${row.currentStreak}-day streak at ${venueName} ends tonight — solve today's word.`
          : `Your ${row.currentStreak}-day venue streak ends tonight — solve today's word.`
        : `Your ${row.currentStreak}-day daily word streak ends tonight — one puzzle left today.`;

      try {
        await this.push.sendExpo(
          [...new Set(tokenRows.map((t) => t.token))],
          {
            title,
            body,
            data: {
              kind: 'daily_streak_at_risk',
              scopeKey: row.scopeKey,
              venueId: isVenue ? row.scopeKey : '',
              streak: row.currentStreak,
            },
          },
        );
        await this.prisma.dailyStreakAtRiskPushLog.create({
          data: {
            playerId: row.playerId,
            scopeKey: row.scopeKey,
            dayKey: todayKey,
          },
        });
        sent += 1;
      } catch (e) {
        this.logger.warn(
          `Streak-at-risk push failed for ${row.playerId}/${row.scopeKey}: ${(e as Error).message}`,
        );
      }
    }

    if (streakRows.length > 0) {
      this.logger.log(
        `Daily streak at-risk pass: ${streakRows.length} candidates, ${sent} sent`,
      );
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';

const REMINDER_KIND = 'active_to_minus_24h';

@Injectable()
export class PerkExpiryReminderScheduler {
  private readonly logger = new Logger(PerkExpiryReminderScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly config: ConfigService,
  ) {}

  /** ~24h before redemption expiresAt; runs every 4h and is idempotent per redemption. */
  @Cron('0 */4 * * *')
  async sendUpcomingExpiryPushes(): Promise<void> {
    const raw = this.config.get<string>('PERK_EXPIRY_REMINDERS_ENABLED');
    if (raw !== undefined && raw.trim() === '0') {
      return;
    }

    const now = Date.now();
    const lower = new Date(now + 20 * 60 * 60 * 1000);
    const upper = new Date(now + 28 * 60 * 60 * 1000);

    const candidates = await this.prisma.venuePerkRedemption.findMany({
      where: {
        voidedAt: null,
        status: 'REDEEMABLE',
        expiresAt: { gte: lower, lte: upper },
      },
      select: {
        id: true,
        playerId: true,
        venueId: true,
        perk: { select: { title: true } },
        venue: { select: { name: true } },
      },
      take: 400,
    });

    let sent = 0;
    for (const r of candidates) {
      const existing = await this.prisma.perkExpiryReminderLog.findUnique({
        where: {
          redemptionId_kind: { redemptionId: r.id, kind: REMINDER_KIND },
        },
      });
      if (existing) continue;

      const player = await this.prisma.player.findUnique({
        where: { id: r.playerId },
        select: { totalPrivacy: true, partnerMarketingPush: true },
      });
      if (!player) continue;
      if (player.totalPrivacy) continue;
      if (!player.partnerMarketingPush) continue;

      const tokenRows = await this.prisma.playerExpoPushToken.findMany({
        where: { playerId: r.playerId },
        select: { token: true },
      });
      if (tokenRows.length === 0) continue;

      const title = 'Perk expiring soon';
      const body = `${r.perk.title} at ${r.venue.name} — open the app to redeem or check dates.`;

      try {
        await this.push.sendExpo(
          [...new Set(tokenRows.map((t) => t.token))],
          {
            title,
            body,
            data: {
              kind: 'perk_expiry_reminder',
              redemptionId: r.id,
              venueId: r.venueId,
            },
          },
        );
        await this.prisma.perkExpiryReminderLog.create({
          data: { redemptionId: r.id, kind: REMINDER_KIND },
        });
        sent += 1;
      } catch (e) {
        this.logger.warn(
          `Perk expiry push failed for redemption ${r.id}: ${(e as Error).message}`,
        );
      }
    }

    if (candidates.length > 0) {
      this.logger.log(
        `Perk expiry reminder pass: ${candidates.length} candidates, ${sent} sent`,
      );
    }
  }
}

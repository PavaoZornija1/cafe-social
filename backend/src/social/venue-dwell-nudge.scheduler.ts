import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { DiscoveryService } from './discovery.service';

/**
 * Fires dwell-based order nudges for players whose visit clock started via
 * OS geofence enter (or presence) and who never opened the app again.
 */
@Injectable()
export class VenueDwellNudgeScheduler {
  private readonly log = new Logger(VenueDwellNudgeScheduler.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly discovery: DiscoveryService,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async processDueDwellNudges(): Promise<void> {
    const enabled = this.config.get<string>('VENUE_ORDER_NUDGE_ENABLED')?.trim() !== 'false';
    if (!enabled) return;
    if (this.running) return;
    this.running = true;
    try {
      // Per-venue delays can be shorter than the global default; use a 1-minute floor.
      const earliestStarted = new Date(Date.now() - 60 * 1000);

      const rows = await this.prisma.player.findMany({
        where: {
          venueNudgeSessionVenueId: { not: null },
          venueNudgeSessionStartedAt: { lte: earliestStarted },
          totalPrivacy: false,
          partnerMarketingPush: true,
        },
        select: {
          id: true,
          venueNudgeSessionStartedAt: true,
          venueNudgeLastSentAt: true,
        },
        take: 200,
        orderBy: { venueNudgeSessionStartedAt: 'asc' },
      });

      // Skip sessions that already received a nudge (avoids re-checking every 5 minutes).
      const candidates = rows.filter((row) => {
        if (!row.venueNudgeSessionStartedAt) return false;
        if (!row.venueNudgeLastSentAt) return true;
        return (
          row.venueNudgeLastSentAt.getTime() < row.venueNudgeSessionStartedAt.getTime()
        );
      });

      for (const row of candidates) {
        await this.discovery.trySendDueVenueOrderNudge(row.id);
      }

      if (candidates.length > 0) {
        this.log.debug(`Dwell nudge pass: ${candidates.length} due`);
      }
    } finally {
      this.running = false;
    }
  }
}

import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import {
  applyVenueNudgePlaceholders,
  VenueOrderNudgeCopyService,
} from './venue-order-nudge-copy.service';

/** Presence older than this is not “currently at venue” for admin broadcast. */
const PRESENCE_FRESH_MS = 10 * 60 * 1000;

export type VenueNudgeTriggerResult = {
  pushAttemptedForPlayers: number;
  playersWithTokens: number;
  cooldownSecondsRemaining?: number;
};

@Injectable()
export class VenueNudgeAdminService {
  private readonly logger = new Logger(VenueNudgeAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly push: PushService,
    private readonly nudgeCopy: VenueOrderNudgeCopyService,
  ) {}

  /**
   * Send marketing push for a specific assignment to players currently at the venue (fresh presence).
   * Throttled per venue using `Venue.lastAdminNudgeBroadcastAt`.
   */
  async triggerNow(venueId: string, assignmentId: string): Promise<VenueNudgeTriggerResult> {
    const minSecRaw = this.config.get<string>('VENUE_NUDGE_ADMIN_TRIGGER_MIN_SECONDS')?.trim();
    const minSec = Math.max(30, Number(minSecRaw ?? '120') || 120);

    const venue = await this.prisma.venue.findUnique({
      where: { id: venueId },
      select: { id: true, lastAdminNudgeBroadcastAt: true, locked: true },
    });
    if (!venue) {
      throw new NotFoundException('Venue not found');
    }
    if (venue.locked) {
      throw new ForbiddenException('This venue is temporarily unavailable');
    }

    const last = venue.lastAdminNudgeBroadcastAt;
    const now = new Date();
    if (last) {
      const elapsedSec = (now.getTime() - last.getTime()) / 1000;
      if (elapsedSec < minSec) {
        const remaining = Math.ceil(minSec - elapsedSec);
        throw new HttpException(
          `Admin nudge throttled for this venue. Try again in ${remaining}s.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const defaultTitle =
      this.config.get<string>('VENUE_ORDER_NUDGE_TITLE')?.trim() || 'Still here?';
    const defaultBody =
      this.config.get<string>('VENUE_ORDER_NUDGE_BODY')?.trim() ||
      'Thirsty? Treat yourself to something from the menu at {{venueName}}.';

    const resolved = await this.nudgeCopy.resolveForAssignment(venueId, assignmentId, {
      title: defaultTitle,
      body: defaultBody,
    });
    if (!resolved) {
      throw new NotFoundException('Assignment not found or inactive');
    }

    const title = applyVenueNudgePlaceholders(resolved.titleRaw, resolved.venueName);
    const body = applyVenueNudgePlaceholders(resolved.bodyRaw, resolved.venueName);

    const freshAfter = new Date(now.getTime() - PRESENCE_FRESH_MS);
    const atVenue = await this.prisma.player.findMany({
      where: {
        lastPresenceVenueId: venueId,
        lastPresenceAt: { gte: freshAfter },
        totalPrivacy: false,
        partnerMarketingPush: true,
      },
      select: { id: true },
    });
    const playerIds = atVenue.map((p) => p.id);

    if (playerIds.length > 0) {
      await this.push.sendToPlayers(
        playerIds,
        undefined,
        {
          title,
          body,
          data: {
            type: 'venue_order_nudge',
            venueId,
            pushCategory: 'partner_marketing',
            trigger: 'admin',
            assignmentId: resolved.assignmentId ?? assignmentId,
            templateCode: resolved.templateCode ?? '',
            nudgeType: resolved.nudgeType ?? '',
            orderingUrl: resolved.orderingUrl,
            menuUrl: resolved.menuUrl,
          },
          sound: 'default',
        },
        { channel: 'partner_marketing' },
      );
    }

    await this.prisma.venue.update({
      where: { id: venueId },
      data: { lastAdminNudgeBroadcastAt: now },
    });

    const withTokens =
      playerIds.length > 0
        ? await this.prisma.playerExpoPushToken.count({
            where: { playerId: { in: playerIds } },
          })
        : 0;

    this.logger.log(
      `Admin venue nudge: venue=${venueId} assignment=${assignmentId} atVenue=${playerIds.length} tokens~=${withTokens}`,
    );

    return {
      pushAttemptedForPlayers: playerIds.length,
      playersWithTokens: withTokens,
    };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { utcDayKey } from '../lib/day-key';
import { loadPublicVenueOffersForVenue } from '../venue/venue-offer-public.util';
import { loadVenueAttributionConfig } from './venue-attribution.config';
import { VenuePolygonSessionService } from './venue-polygon-session.service';

export const VENUE_PROXIMITY_ARRIVAL_PUSH_TYPE = 'venue_proximity_arrival' as const;

@Injectable()
export class ProximityArrivalService {
  private readonly logger = new Logger(ProximityArrivalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly config: ConfigService,
    private readonly polygonSessions: VenuePolygonSessionService,
  ) {}

  async trySendOnEnter(params: { playerId: string; venueId: string }): Promise<void> {
    const enabled = this.config.get<string>('PROXIMITY_ARRIVAL_PUSH_ENABLED')?.trim() !== '0';
    if (!enabled) return;

    const { playerId, venueId } = params;
    const dayKey = utcDayKey();
    const cfg = loadVenueAttributionConfig(this.config);

    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      select: {
        totalPrivacy: true,
        partnerMarketingPush: true,
        lastPresenceVenueId: true,
      },
    });
    if (!player || player.totalPrivacy || !player.partnerMarketingPush) return;

    if (player.lastPresenceVenueId === venueId) return;
    if (await this.polygonSessions.hasOpenSession(playerId, venueId)) return;

    const venue = await this.prisma.venue.findUnique({
      where: { id: venueId },
      select: {
        id: true,
        name: true,
        locked: true,
        proximityAlertsEnabled: true,
        proximityAlertRadiusMeters: true,
      },
    });
    if (!venue || venue.locked || !venue.proximityAlertsEnabled) return;

    const sentTodayVenue = await this.prisma.proximityArrivalPushLog.count({
      where: { playerId, venueId, dayKey },
    });
    if (sentTodayVenue >= cfg.nudgeVenueDailyMax) return;

    const sentTodayGlobal = await this.prisma.proximityArrivalPushLog.count({
      where: { playerId, dayKey },
    });
    if (sentTodayGlobal >= cfg.nudgeGlobalDailyMax) return;

    const lastNudge = await this.prisma.proximityArrivalPushLog.findFirst({
      where: { playerId, venueId },
      orderBy: { sentAt: 'desc' },
      select: { sentAt: true },
    });
    if (lastNudge) {
      const cooldownMs = cfg.nudgeVenueCooldownMinutes * 60 * 1000;
      const sinceLast = Date.now() - lastNudge.sentAt.getTime();
      if (sinceLast < cooldownMs) {
        const lastExit = await this.polygonSessions.lastPolygonExitAt(playerId, venueId);
        if (!lastExit || lastExit.getTime() <= lastNudge.sentAt.getTime()) {
          return;
        }
      }
    }

    const { featuredOffer } = await loadPublicVenueOffersForVenue(this.prisma, venueId);
    const offerTitle = featuredOffer?.title?.trim();
    const offerBody = featuredOffer?.body?.trim();
    if (!offerTitle && !offerBody) return;

    const title = offerTitle ?? `You're near ${venue.name}`;
    const body =
      offerBody ??
      (offerTitle
        ? `Open Cafe Social to see what's on at ${venue.name}.`
        : `Open Cafe Social for today's offer at ${venue.name}.`);

    try {
      await this.push.sendToPlayers(
        [playerId],
        undefined,
        {
          title,
          body,
          data: {
            type: VENUE_PROXIMITY_ARRIVAL_PUSH_TYPE,
            pushCategory: 'partner_marketing',
            venueId: venue.id,
            venueName: venue.name,
            featuredOfferId: featuredOffer?.id ?? '',
          },
        },
        { channel: 'partner_marketing' },
      );

      await this.prisma.proximityArrivalPushLog.create({
        data: {
          playerId,
          venueId,
          dayKey,
          featuredOfferId: featuredOffer?.id ?? null,
          proximityRadiusMeters: venue.proximityAlertRadiusMeters,
        },
      });
    } catch (e) {
      this.logger.warn(
        `Proximity arrival push failed for ${playerId}/${venueId}: ${(e as Error).message}`,
      );
    }
  }
}

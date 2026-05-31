import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { utcDayKey } from '../lib/day-key';
import { loadPublicVenueOffersForVenue } from '../venue/venue-offer-public.util';

export const VENUE_PROXIMITY_ARRIVAL_PUSH_TYPE = 'venue_proximity_arrival' as const;

const GLOBAL_DAILY_CAP = 2;

@Injectable()
export class ProximityArrivalService {
  private readonly logger = new Logger(ProximityArrivalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly config: ConfigService,
  ) {}

  async trySendOnEnter(params: { playerId: string; venueId: string }): Promise<void> {
    const enabled = this.config.get<string>('PROXIMITY_ARRIVAL_PUSH_ENABLED')?.trim() !== '0';
    if (!enabled) return;

    const { playerId, venueId } = params;
    const dayKey = utcDayKey();

    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      select: {
        totalPrivacy: true,
        partnerMarketingPush: true,
        lastPresenceVenueId: true,
        lastPresenceAt: true,
      },
    });
    if (!player || player.totalPrivacy || !player.partnerMarketingPush) return;

    if (player.lastPresenceVenueId === venueId) return;

    const venue = await this.prisma.venue.findUnique({
      where: { id: venueId },
      select: {
        id: true,
        name: true,
        locked: true,
        latitude: true,
        longitude: true,
        geofencePolygon: true,
        proximityAlertsEnabled: true,
        proximityAlertRadiusMeters: true,
      },
    });
    if (!venue || venue.locked || !venue.proximityAlertsEnabled) return;

    const existing = await this.prisma.proximityArrivalPushLog.findUnique({
      where: {
        playerId_venueId_dayKey: { playerId, venueId, dayKey },
      },
    });
    if (existing) return;

    const sentToday = await this.prisma.proximityArrivalPushLog.count({
      where: { playerId, dayKey },
    });
    if (sentToday >= GLOBAL_DAILY_CAP) return;

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
        data: { playerId, venueId, dayKey },
      });
    } catch (e) {
      this.logger.warn(
        `Proximity arrival push failed for ${playerId}/${venueId}: ${(e as Error).message}`,
      );
    }
  }
}

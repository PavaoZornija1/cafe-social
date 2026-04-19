import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Venue } from '@prisma/client';
import { PlayerService } from '../player/player.service';
import { PlayerVenueRepository } from './player-venue.repository';
import { SubscriptionRepository } from './subscription.repository';
import type { PublicVenueDetectResult } from './public-detect.types';
import { VenueService } from './venue.service';
import { VenueFunnelService } from './venue-funnel.service';
import { VenueModerationService } from './venue-moderation.service';
import { PlayerVenueCheckInRepository } from './player-venue-check-in.repository';

export type VenueAccessResult = {
  venueId: string;
  isPremium: boolean;
  /** Super admin: venue suspended — no play at geofence. */
  locked: boolean;
  /** Player has a prior link to this venue (e.g. saved via QR/onboarding); not required for play. */
  visitedBefore: boolean;
  subscriptionActive: boolean;
  /**
   * True when GPS (lat/lng) places the player inside this venue’s geofence.
   * Games and venue-scoped challenges require this, regardless of subscription.
   */
  canEnterVenueContext: boolean;
  /** Venue staff / moderation ban at this location. */
  bannedFromVenue: boolean;
  /** Venue requests QR check-in before unlocking venue features (see `hasExplicitCheckIn`). */
  requiresExplicitCheckIn: boolean;
  /** GPS places the player inside this venue’s geofence. */
  isPhysicallyAtVenue: boolean;
  /** Recent `POST …/register` with GPS at this venue (default validity: 24h). */
  hasExplicitCheckIn: boolean;
};

@Injectable()
export class VenueAccessService {
  private readonly log = new Logger(VenueAccessService.name);

  constructor(
    private readonly venues: VenueService,
    private readonly players: PlayerService,
    private readonly playerVenues: PlayerVenueRepository,
    private readonly subscriptions: SubscriptionRepository,
    private readonly funnel: VenueFunnelService,
    private readonly moderation: VenueModerationService,
    private readonly explicitCheckIns: PlayerVenueCheckInRepository,
  ) {}

  /**
   * If latitude/longitude are provided, returns the venue geofence that contains the point
   * (closest match if multiple), **including locked venues** so clients can show
   * “temporarily unavailable” instead of hiding the pin. If outside all fences, or
   * coordinates are missing, returns null.
   */
  async detectVenue(
    latitude?: number,
    longitude?: number,
  ): Promise<PublicVenueDetectResult> {
    const hasCoords =
      typeof latitude === 'number' &&
      typeof longitude === 'number' &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude);

    if (!hasCoords) return null;
    const v = await this.venues.findVenueAtCoordinatesIncludingLocked(
      latitude!,
      longitude!,
    );
    if (!v) return null;
    this.funnel.safeLog({ venueId: v.id, kind: 'detect' });
    return {
      id: v.id,
      name: v.name,
      isPremium: v.isPremium,
      locked: v.locked,
      city: v.city,
      country: v.country,
    };
  }

  private computeSubscriptionActive(subscription: { active: boolean; expiresAt: Date | null } | null): boolean {
    if (!subscription) return false;
    if (!subscription.active) return false;
    if (subscription.expiresAt && subscription.expiresAt.getTime() <= Date.now()) return false;
    return true;
  }

  async registerVenueWithQr(
    venueId: string,
    email: string,
    coords?: { latitude?: number; longitude?: number },
  ): Promise<void> {
    const player = await this.players.findOrCreateByEmail(email);
    const venue = await this.venues.findOne(venueId).catch(() => null);
    if (!venue) throw new NotFoundException(`Venue ${venueId} not found`);
    if (venue.locked) {
      throw new ForbiddenException('This venue is temporarily unavailable');
    }

    await this.moderation.assertNotBanned(venueId, player.id);

    if (venue.requiresExplicitCheckIn) {
      const lat = coords?.latitude;
      const lng = coords?.longitude;
      if (
        typeof lat !== 'number' ||
        typeof lng !== 'number' ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
      ) {
        throw new BadRequestException(
          'This venue requires check-in at the location — allow location and try again after scanning.',
        );
      }
      await this.venues.assertCoordinatesAllowedForGuestVenue(venueId, lat, lng);
      await this.explicitCheckIns.upsertCheckIn(player.id, venueId);
    }

    const existing = await this.playerVenues.findByPlayerAndVenue(player.id, venueId);
    if (existing) return;

    await this.playerVenues.create({
      player: { connect: { id: player.id } },
      venue: { connect: { id: venueId } },
    });
  }

  async getVenueAccess(
    venueId: string,
    email: string,
    latitude?: number,
    longitude?: number,
  ): Promise<VenueAccessResult> {
    if (!email) throw new UnauthorizedException('Missing user email');

    const venue = await this.venues.findOne(venueId);
    const player = await this.players.findOrCreateByEmail(email);

    const bannedFromVenue = await this.moderation.isBanned(venueId, player.id);

    const playerVenue = await this.playerVenues.findByPlayerAndVenue(player.id, venueId);
    const visitedBefore = !!playerVenue;

    const subscription = await this.subscriptions.findByPlayerId(player.id);
    const subscriptionActive = this.computeSubscriptionActive(subscription);

    let isPhysicallyAtVenue = false;
    if (
      typeof latitude === 'number' &&
      typeof longitude === 'number' &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude)
    ) {
      const at = await this.venues.findVenueAtCoordinatesIncludingLocked(
        latitude,
        longitude,
      );
      isPhysicallyAtVenue = at?.id === venueId;
    }

    const requiresExplicitCheckIn = venue.requiresExplicitCheckIn;
    const hasExplicitCheckIn = requiresExplicitCheckIn
      ? await this.explicitCheckIns.hasRecentCheckIn(player.id, venueId)
      : true;

    const canEnterVenueContext =
      !venue.locked &&
      !bannedFromVenue &&
      isPhysicallyAtVenue &&
      hasExplicitCheckIn;

    if (canEnterVenueContext) {
      this.funnel.safeLog({ venueId, playerId: player.id, kind: 'enter' });
    }

    if (venue.locked && isPhysicallyAtVenue) {
      this.log.log(
        JSON.stringify({
          metric: 'player_geofence_locked_venue',
          venueId: venue.id,
          at: new Date().toISOString(),
        }),
      );
    }

    return {
      venueId: venue.id,
      isPremium: venue.isPremium,
      locked: venue.locked,
      visitedBefore,
      subscriptionActive,
      canEnterVenueContext,
      bannedFromVenue,
      requiresExplicitCheckIn,
      isPhysicallyAtVenue,
      hasExplicitCheckIn,
    };
  }
}


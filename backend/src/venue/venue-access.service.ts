import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { Venue } from '@prisma/client';
import { PlayerService } from '../player/player.service';
import { PlayerVenueRepository } from './player-venue.repository';
import { SubscriptionRepository } from './subscription.repository';
import { VenueService } from './venue.service';

export type VenueAccessResult = {
  venueId: string;
  isPremium: boolean;
  hasQrUnlock: boolean;
  subscriptionActive: boolean;
  canEnterVenueContext: boolean;
};

@Injectable()
export class VenueAccessService {
  constructor(
    private readonly venues: VenueService,
    private readonly players: PlayerService,
    private readonly playerVenues: PlayerVenueRepository,
    private readonly subscriptions: SubscriptionRepository,
  ) {}

  /**
   * If latitude/longitude are provided, returns the venue geofence that contains the point
   * (closest match if multiple). If outside all fences, returns null.
   * If coordinates are omitted (simulator / no permission), falls back to default venue.
   */
  async detectVenue(latitude?: number, longitude?: number): Promise<Venue | null> {
    const hasCoords =
      typeof latitude === 'number' &&
      typeof longitude === 'number' &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude);

    if (hasCoords) {
      return this.venues.findVenueAtCoordinates(latitude!, longitude!);
    }

    return this.venues.findDefaultVenue();
  }

  private computeSubscriptionActive(subscription: { active: boolean; expiresAt: Date | null } | null): boolean {
    if (!subscription) return false;
    if (!subscription.active) return false;
    if (subscription.expiresAt && subscription.expiresAt.getTime() <= Date.now()) return false;
    return true;
  }

  async registerVenueWithQr(venueId: string, email: string): Promise<void> {
    const player = await this.players.findOrCreateByEmail(email);
    const venue = await this.venues.findOne(venueId).catch(() => null);
    if (!venue) throw new NotFoundException(`Venue ${venueId} not found`);

    const existing = await this.playerVenues.findByPlayerAndVenue(player.id, venueId);
    if (existing) return;

    await this.playerVenues.create({
      player: { connect: { id: player.id } },
      venue: { connect: { id: venueId } },
    });
  }

  async getVenueAccess(venueId: string, email: string): Promise<VenueAccessResult> {
    if (!email) throw new UnauthorizedException('Missing user email');

    const venue = await this.venues.findOne(venueId);
    const player = await this.players.findOrCreateByEmail(email);

    const playerVenue = await this.playerVenues.findByPlayerAndVenue(player.id, venueId);
    const hasQrUnlock = !!playerVenue;

    const subscription = await this.subscriptions.findByPlayerId(player.id);
    const subscriptionActive = this.computeSubscriptionActive(subscription);

    const canEnterVenueContext = venue.isPremium ? subscriptionActive || hasQrUnlock : hasQrUnlock;

    return {
      venueId: venue.id,
      isPremium: venue.isPremium,
      hasQrUnlock,
      subscriptionActive,
      canEnterVenueContext,
    };
  }
}


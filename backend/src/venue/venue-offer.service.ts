import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VenueService } from './venue.service';
import {
  isGloballyExhausted,
  isOfferLiveForPublic,
  loadPublicVenueOffersForVenue,
  type PublicVenueOfferCard,
} from './venue-offer-public.util';

export type { PublicVenueOfferCard };

@Injectable()
export class VenueOfferService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly venues: VenueService,
  ) {}

  async listPublicForVenue(venueId: string): Promise<{
    offers: PublicVenueOfferCard[];
    featuredOffer: {
      title: string | null;
      body: string | null;
      endsAt: string | null;
      id: string;
    } | null;
  }> {
    await this.venues.findOne(venueId);
    return loadPublicVenueOffersForVenue(this.prisma, venueId);
  }

  async redeem(params: {
    playerId: string;
    venueId: string;
    offerId: string;
    latitude?: number;
    longitude?: number;
  }) {
    const hasCoords =
      typeof params.latitude === 'number' &&
      typeof params.longitude === 'number' &&
      Number.isFinite(params.latitude) &&
      Number.isFinite(params.longitude);
    if (!hasCoords) {
      throw new BadRequestException('Location (lat/lng) is required to redeem at this venue');
    }
    const at = await this.venues.findVenueAtCoordinates(params.latitude!, params.longitude!);
    if (!at || at.id !== params.venueId) {
      throw new BadRequestException('You must be at this venue to redeem this offer');
    }

    const offer = await this.prisma.venueOffer.findFirst({
      where: { id: params.offerId, venueId: params.venueId },
    });
    if (!offer) throw new NotFoundException('Offer not found for this venue');

    const now = new Date();
    if (!isOfferLiveForPublic(offer, now)) {
      throw new BadRequestException('This offer is not available');
    }
    if (isGloballyExhausted(offer)) {
      throw new BadRequestException('This offer is fully redeemed');
    }

    return this.prisma.$transaction(async (tx) => {
      const refreshed = await tx.venueOffer.findUnique({ where: { id: offer.id } });
      if (!refreshed) throw new NotFoundException('Offer not found');
      if (isGloballyExhausted(refreshed)) {
        throw new BadRequestException('This offer is fully redeemed');
      }

      const playerCount = await tx.venueOfferRedemption.count({
        where: { offerId: offer.id, playerId: params.playerId },
      });
      if (
        refreshed.maxRedemptionsPerPlayer != null &&
        playerCount >= refreshed.maxRedemptionsPerPlayer
      ) {
        throw new ConflictException('You already used this offer as many times as allowed');
      }

      const redemption = await tx.venueOfferRedemption.create({
        data: {
          offerId: offer.id,
          playerId: params.playerId,
        },
      });

      await tx.venueOffer.update({
        where: { id: offer.id },
        data: { redemptionCount: { increment: 1 } },
      });

      return {
        redemptionId: redemption.id,
        title: offer.title,
        body: offer.body,
        ctaUrl: offer.ctaUrl,
        redeemedAt: redemption.createdAt.toISOString(),
      };
    });
  }
}

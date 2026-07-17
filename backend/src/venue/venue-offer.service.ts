import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { VenueOfferFulfillment } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { VenueService } from './venue.service';
import { VenueStaffService } from '../venue-staff/venue-staff.service';
import {
  isGloballyExhausted,
  isOfferLiveForPublic,
  loadPublicVenueOffersForVenue,
  type PublicVenueOfferCard,
} from './venue-offer-public.util';

export type { PublicVenueOfferCard };

export type MemberCardPendingOffer = {
  redemptionId: string;
  offerId: string;
  title: string;
  body: string | null;
  claimedAt: string;
};

@Injectable()
export class VenueOfferService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly venues: VenueService,
    private readonly venueStaff: VenueStaffService,
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
    const venue = await this.venues.findOne(venueId);
    if (venue.locked) {
      throw new NotFoundException('Venue not found');
    }
    return loadPublicVenueOffersForVenue(this.prisma, venueId);
  }

  async listForPlayer(venueId: string, playerId: string) {
    const venue = await this.venues.findOne(venueId);
    if (venue.locked) {
      throw new NotFoundException('Venue not found');
    }
    return loadPublicVenueOffersForVenue(this.prisma, venueId, playerId);
  }

  /**
   * Guest claims a MEMBER_CARD offer (pending until staff honours via member card).
   * AUTO offers cannot be claimed — they apply passively.
   */
  async claimMemberCardOffer(params: {
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
      throw new BadRequestException('Location (lat/lng) is required to claim this offer at the venue');
    }
    await this.venues.assertCoordinatesAllowedForGuestVenue(
      params.venueId,
      params.latitude!,
      params.longitude!,
    );
    await this.venueStaff.assertCanClaimGuestRewards(params.playerId, params.venueId);

    const now = new Date();

    return this.prisma.$transaction(
      async (tx) => {
        const offer = await tx.venueOffer.findFirst({
          where: { id: params.offerId, venueId: params.venueId },
        });
        if (!offer) throw new NotFoundException('Offer not found for this venue');

        if (offer.fulfillment !== VenueOfferFulfillment.MEMBER_CARD) {
          throw new BadRequestException(
            'This offer applies automatically — no claim needed',
          );
        }

        if (!isOfferLiveForPublic(offer, now)) {
          throw new BadRequestException('This offer is not available');
        }
        if (isGloballyExhausted(offer)) {
          throw new BadRequestException('This offer is fully redeemed');
        }

        const existing = await tx.venueOfferRedemption.findFirst({
          where: {
            offerId: offer.id,
            playerId: params.playerId,
            // Retired (CANCELLED) claims never count as an active claim.
            status: { in: ['PENDING', 'FULFILLED'] },
          },
          orderBy: { createdAt: 'desc' },
        });
        if (existing) {
          return {
            redemptionId: existing.id,
            status: existing.status,
            title: offer.title,
            body: offer.body,
            alreadyClaimed: true,
          };
        }

        if (
          offer.maxRedemptionsPerPlayer != null &&
          offer.maxRedemptionsPerPlayer > 1
        ) {
          const playerCount = await tx.venueOfferRedemption.count({
            where: {
              offerId: offer.id,
              playerId: params.playerId,
              status: { in: ['PENDING', 'FULFILLED'] },
            },
          });
          if (playerCount >= offer.maxRedemptionsPerPlayer) {
            throw new ConflictException('You already used this offer as many times as allowed');
          }
        }

        const incrementResult = await tx.venueOffer.updateMany({
          where: {
            id: offer.id,
            OR: [{ maxRedemptions: null }, { redemptionCount: { lt: offer.maxRedemptions! } }],
          },
          data: { redemptionCount: { increment: 1 } },
        });
        if (incrementResult.count === 0) {
          throw new BadRequestException('This offer is fully redeemed');
        }

        const redemption = await tx.venueOfferRedemption.create({
          data: {
            offerId: offer.id,
            playerId: params.playerId,
            status: 'PENDING',
          },
        });

        return {
          redemptionId: redemption.id,
          status: redemption.status,
          title: offer.title,
          body: offer.body,
          alreadyClaimed: false,
        };
      },
      { maxWait: 5000, timeout: 10000 },
    );
  }

  /** @deprecated Use claimMemberCardOffer — kept name for route compatibility. */
  async redeem(params: {
    playerId: string;
    venueId: string;
    offerId: string;
    latitude?: number;
    longitude?: number;
  }) {
    return this.claimMemberCardOffer(params);
  }

  async listPendingMemberCardOffersForPlayer(
    venueId: string,
    playerId: string,
  ): Promise<MemberCardPendingOffer[]> {
    const rows = await this.prisma.venueOfferRedemption.findMany({
      where: {
        playerId,
        status: 'PENDING',
        offer: {
          venueId,
          fulfillment: VenueOfferFulfillment.MEMBER_CARD,
        },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        offer: { select: { id: true, title: true, body: true } },
      },
    });
    return rows.map((r) => ({
      redemptionId: r.id,
      offerId: r.offer.id,
      title: r.offer.title,
      body: r.offer.body,
      claimedAt: r.createdAt.toISOString(),
    }));
  }

  async fulfillMemberCardOffer(params: {
    venueId: string;
    redemptionId: string;
    staffPlayerId: string;
  }) {
    const row = await this.prisma.venueOfferRedemption.findUnique({
      where: { id: params.redemptionId },
      include: {
        offer: { select: { id: true, venueId: true, fulfillment: true, title: true } },
      },
    });
    if (!row || row.offer.venueId !== params.venueId) {
      throw new NotFoundException('Offer claim not found');
    }
    if (row.offer.fulfillment !== VenueOfferFulfillment.MEMBER_CARD) {
      throw new BadRequestException('This offer is not staff-fulfilled');
    }
    if (row.status === 'FULFILLED') {
      return {
        redemptionId: row.id,
        status: 'FULFILLED' as const,
        title: row.offer.title,
        alreadyFulfilled: true,
      };
    }
    if (row.status === 'CANCELLED') {
      throw new BadRequestException('This offer claim has been cancelled');
    }
    // Staff may not receive guest offers at their own venue, even when a
    // coworker performs the fulfilment.
    await this.venueStaff.assertCanClaimGuestRewards(row.playerId, params.venueId);
    if (row.playerId === params.staffPlayerId) {
      throw new BadRequestException('You cannot fulfil your own offer claim');
    }

    const updated = await this.prisma.venueOfferRedemption.update({
      where: { id: row.id },
      data: {
        status: 'FULFILLED',
        fulfilledAt: new Date(),
        fulfilledByStaffPlayerId: params.staffPlayerId,
      },
    });

    return {
      redemptionId: updated.id,
      status: 'FULFILLED' as const,
      title: row.offer.title,
      alreadyFulfilled: false,
    };
  }
}

import { VenueOfferFulfillment, VenueOfferStatus } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

export type PublicVenueOfferCard = {
  id: string;
  title: string;
  body: string | null;
  imageUrl: string | null;
  ctaUrl: string | null;
  isFeatured: boolean;
  fulfillment: VenueOfferFulfillment;
  autoXpMultiplier: number | null;
  validFrom: string | null;
  validTo: string | null;
  globallyExhausted: boolean;
  /** MEMBER_CARD only: guest claim state at this venue. */
  claimStatus: 'NONE' | 'PENDING' | 'FULFILLED' | null;
};

export function isOfferLiveForPublic(
  offer: {
    status: VenueOfferStatus;
    validFrom: Date | null;
    validTo: Date | null;
  },
  now: Date,
): boolean {
  if (offer.status !== VenueOfferStatus.ACTIVE) return false;
  if (offer.validFrom && now < offer.validFrom) return false;
  if (offer.validTo && now > offer.validTo) return false;
  return true;
}

export function isGloballyExhausted(o: {
  maxRedemptions: number | null;
  redemptionCount: number;
}): boolean {
  return o.maxRedemptions != null && o.redemptionCount >= o.maxRedemptions;
}

export async function loadPublicVenueOffersForVenue(
  prisma: PrismaService,
  venueId: string,
  playerId?: string | null,
): Promise<{
  offers: PublicVenueOfferCard[];
  featuredOffer: {
    title: string | null;
    body: string | null;
    endsAt: string | null;
    id: string;
  } | null;
}> {
  const now = new Date();
  const rows = await prisma.venueOffer.findMany({
    where: { venueId },
    orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
  });

  const claimByOfferId = new Map<string, 'PENDING' | 'FULFILLED'>();
  if (playerId) {
    const claims = await prisma.venueOfferRedemption.findMany({
      where: {
        playerId,
        offerId: { in: rows.map((r) => r.id) },
        // CANCELLED claims are retired and must not surface as active state.
        status: { in: ['PENDING', 'FULFILLED'] },
      },
      select: { offerId: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    for (const c of claims) {
      if (claimByOfferId.has(c.offerId)) continue;
      claimByOfferId.set(
        c.offerId,
        c.status === 'FULFILLED' ? 'FULFILLED' : 'PENDING',
      );
    }
  }

  const offers: PublicVenueOfferCard[] = [];

  for (const o of rows) {
    if (!isOfferLiveForPublic(o, now)) continue;
    const globallyExhausted = isGloballyExhausted(o);
    const claim = claimByOfferId.get(o.id) ?? null;
    offers.push({
      id: o.id,
      title: o.title,
      body: o.body,
      imageUrl: o.imageUrl,
      ctaUrl: o.ctaUrl,
      isFeatured: o.isFeatured,
      fulfillment: o.fulfillment,
      autoXpMultiplier: o.autoXpMultiplier,
      validFrom: o.validFrom?.toISOString() ?? null,
      validTo: o.validTo?.toISOString() ?? null,
      globallyExhausted,
      claimStatus:
        o.fulfillment === VenueOfferFulfillment.MEMBER_CARD
          ? claim ?? 'NONE'
          : null,
    });
  }

  const featuredCard =
    offers.find((c) => c.isFeatured) ?? (offers.length > 0 ? offers[0] : null);

  return {
    offers,
    featuredOffer: featuredCard
      ? {
          id: featuredCard.id,
          title: featuredCard.title,
          body: featuredCard.body,
          endsAt: featuredCard.validTo,
        }
      : null,
  };
}

/** Highest live AUTO XP multiplier at a venue (default 1). */
export async function activeVenueXpMultiplier(
  prisma: PrismaService,
  venueId: string,
  now = new Date(),
): Promise<number> {
  const rows = await prisma.venueOffer.findMany({
    where: {
      venueId,
      fulfillment: VenueOfferFulfillment.AUTO,
      status: VenueOfferStatus.ACTIVE,
      autoXpMultiplier: { not: null, gt: 1 },
    },
    select: {
      autoXpMultiplier: true,
      validFrom: true,
      validTo: true,
      status: true,
    },
  });
  let mult = 1;
  for (const o of rows) {
    if (!isOfferLiveForPublic(o, now)) continue;
    const m = o.autoXpMultiplier;
    if (typeof m === 'number' && Number.isFinite(m) && m > mult) mult = m;
  }
  return mult;
}

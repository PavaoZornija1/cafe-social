import { VenueOfferStatus } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

export type PublicVenueOfferCard = {
  id: string;
  title: string;
  body: string | null;
  imageUrl: string | null;
  ctaUrl: string | null;
  isFeatured: boolean;
  validFrom: string | null;
  validTo: string | null;
  globallyExhausted: boolean;
};

export function isOfferLiveForPublic(
  offer: {
    status: VenueOfferStatus;
    validFrom: Date | null;
    validTo: Date | null;
    maxRedemptions: number | null;
    redemptionCount: number;
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

  const offers: PublicVenueOfferCard[] = [];

  for (const o of rows) {
    if (!isOfferLiveForPublic(o, now)) continue;
    const globallyExhausted = isGloballyExhausted(o);
    offers.push({
      id: o.id,
      title: o.title,
      body: o.body,
      imageUrl: o.imageUrl,
      ctaUrl: o.ctaUrl,
      isFeatured: o.isFeatured,
      validFrom: o.validFrom?.toISOString() ?? null,
      validTo: o.validTo?.toISOString() ?? null,
      globallyExhausted,
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

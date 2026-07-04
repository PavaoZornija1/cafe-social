export type HomeVenue = { id: string; name: string; isPremium: boolean; locked?: boolean };

export type HomeVenueAccess = {
  venueId: string;
  isPremium?: boolean;
  locked?: boolean;
  lockReason?: string | null;
  visitedBefore?: boolean;
  subscriptionActive?: boolean;
  canEnterVenueContext: boolean;
  bannedFromVenue?: boolean;
  requiresExplicitCheckIn?: boolean;
  isPhysicallyAtVenue?: boolean;
  hasExplicitCheckIn?: boolean;
};

export type HomePublicOffer = {
  id: string;
  title: string;
  body: string | null;
  imageUrl: string | null;
  isFeatured: boolean;
  fulfillment?: 'AUTO' | 'MEMBER_CARD';
  autoXpMultiplier?: number | null;
  claimStatus?: 'NONE' | 'PENDING' | 'FULFILLED' | null;
  globallyExhausted?: boolean;
};

export type HomePublicCard = {
  menuUrl: string | null;
  orderingUrl: string | null;
  offers: HomePublicOffer[];
  featuredOffer: {
    id: string;
    title: string | null;
    body: string | null;
  } | null;
};

export type FriendAtVenueRow = {
  id: string;
  username: string | null;
  hereNow: boolean;
};

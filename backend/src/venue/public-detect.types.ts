/** Slim payload for GET /venue-context/detect (mobile + web). */
export type PublicVenueDetectResult = {
  id: string;
  name: string;
  isPremium: boolean;
  locked: boolean;
  city: string | null;
  country: string | null;
} | null;

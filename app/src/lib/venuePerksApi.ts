import { apiGet } from './api';

export type VenuePerkPublicTeaser = {
  id: string;
  title: string;
  subtitle: string | null;
  body: string | null;
  requiresQrUnlock: boolean;
  fullyRedeemed: boolean;
  redeemedByYou: boolean;
};

export function fetchVenuePerkTeasers(
  venueId: string,
  token: string,
): Promise<VenuePerkPublicTeaser[]> {
  return apiGet<VenuePerkPublicTeaser[]>(
    `/venue-context/${encodeURIComponent(venueId)}/perks`,
    token,
  );
}

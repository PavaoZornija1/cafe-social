import { apiGet } from './api';

export type DiscoveryVenuePin = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string | null;
  city: string | null;
  country: string | null;
  isPremium: boolean;
};

export function fetchDiscoveryVenuePins(): Promise<DiscoveryVenuePin[]> {
  return apiGet<DiscoveryVenuePin[]>('/venues/discovery/map');
}

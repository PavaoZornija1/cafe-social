import { apiGet } from './api';
import { buildDetectQuery, getCoordinatesForVenueDetect } from './locationForDetect';

export type DetectedVenue = { id: string; name: string; isPremium: boolean };

export async function fetchDetectedVenue(): Promise<DetectedVenue | null> {
  const coords = await getCoordinatesForVenueDetect();
  const q = buildDetectQuery(coords);
  return apiGet<DetectedVenue | null>(`/venue-context/detect${q}`);
}

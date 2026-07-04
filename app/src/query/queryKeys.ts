import type { Coordinates } from '../lib/locationForDetect';

/** Central query keys — invalidate via these prefixes after mutations. */
export const queryKeys = {
  me: {
    all: ['me'] as const,
    summary: () => ['me', 'summary'] as const,
    engagement: () => ['me', 'engagement'] as const,
  },
  venue: {
    all: ['venue'] as const,
    detect: () => ['venue', 'detect'] as const,
    access: (venueId: string, coords: Coordinates | null) =>
      [
        'venue',
        'access',
        venueId,
        coords ? `${coords.lat.toFixed(5)},${coords.lng.toFixed(5)}` : 'nocoords',
      ] as const,
    accessPrefix: (venueId: string) => ['venue', 'access', venueId] as const,
    offers: (venueId: string) => ['venue', 'offers', venueId] as const,
    publicCard: (venueId: string) => ['venue', 'publicCard', venueId] as const,
    challenges: (venueId: string) => ['venue', 'challenges', venueId] as const,
    hub: (venueId: string) => ['venue', 'hub', venueId] as const,
  },
  social: {
    all: ['social'] as const,
    friendsGraph: () => ['social', 'friendsGraph'] as const,
  },
  quests: {
    all: ['quests'] as const,
    hub: (period: string) => ['quests', 'hub', period] as const,
  },
  staff: {
    all: ['staff'] as const,
    venues: () => ['staff', 'venues'] as const,
  },
} as const;

import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';

import { apiGet } from '../../lib/api';
import {
  fetchMyVenueRewards,
  fetchVenuePerkTeasers,
  type VenuePerkPublicTeaser,
  type VenueRedeemableReward,
} from '../../lib/venuePerksApi';
import type { VenueAccessDto } from './useVenueAccessQuery';
import { queryKeys } from '../queryKeys';
import { useAuthToken } from '../useAuthToken';

export type VenueHubBundle = {
  access: VenueAccessDto;
  friendsVisit: { friendsWithVisitsLast30Days: number; sinceDayKey: string } | null;
  friendsAtVenue: { id: string; username: string; hereNow: boolean; lastVisitDayKey: string | null }[];
  engagement: {
    visitsThisWeek: number;
    distinctVenuesVisitedLast30Days: number;
    badges: string[];
  } | null;
  perks: VenuePerkPublicTeaser[];
  challenges: {
    id: string;
    title: string;
    description: string | null;
    targetCount: number;
    progressCount: number;
    isCompleted: boolean;
    rewardTitle: string | null;
  }[];
  peopleHereCount: number;
  myRewards: VenueRedeemableReward[];
  leaderboardPreview: { venueXp: number; player: { id: string; username: string } }[];
  offers: {
    id: string;
    title: string;
    body: string | null;
    fulfillment?: string;
    autoXpMultiplier?: number | null;
    claimStatus?: string | null;
    globallyExhausted?: boolean;
    isFeatured?: boolean;
  }[];
  feed: {
    id: string;
    kind: string;
    title: string;
    subtitle: string | null;
    actorUsername: string | null;
    createdAt: string;
  }[];
};

export function useVenueHubQuery(venueId: string | null | undefined) {
  const { isReady, requireToken } = useAuthToken();
  const id = venueId?.trim() || '';

  const query = useQuery({
    queryKey: queryKeys.venue.hub(id),
    enabled: isReady && id.length > 0,
    staleTime: 20_000,
    queryFn: async (): Promise<VenueHubBundle> => {
      const token = await requireToken();
      const access = await apiGet<VenueAccessDto>(
        `/venue-context/${encodeURIComponent(id)}/access`,
        token,
      );

      const [fv, fat, eng, perks, chList, peopleList, rewardsList, boardList, offersPayload] =
        await Promise.all([
          apiGet<{ friendsWithVisitsLast30Days: number; sinceDayKey: string }>(
            `/social/venues/${encodeURIComponent(id)}/friends-visit-summary`,
            token,
          ).catch(() => null),
          apiGet<{ friends: VenueHubBundle['friendsAtVenue'] }>(
            `/social/venues/${encodeURIComponent(id)}/friends-at-venue`,
            token,
          ).catch(() => ({ friends: [] })),
          apiGet<VenueHubBundle['engagement']>('/players/me/engagement', token).catch(
            () => null,
          ),
          fetchVenuePerkTeasers(id, token).catch(() => [] as VenuePerkPublicTeaser[]),
          apiGet<VenueHubBundle['challenges']>(
            `/venue-context/${encodeURIComponent(id)}/challenges`,
            token,
          ).catch(() => []),
          apiGet<{ id: string }[]>(
            `/social/venues/${encodeURIComponent(id)}/people-here`,
            token,
          ).catch(() => []),
          fetchMyVenueRewards(id, token).catch(() => [] as VenueRedeemableReward[]),
          apiGet<VenueHubBundle['leaderboardPreview']>(
            `/venues/${encodeURIComponent(id)}/leaderboard/xp`,
            token,
          ).catch(() => []),
          apiGet<{ offers: VenueHubBundle['offers'] }>(
            `/venue-context/${encodeURIComponent(id)}/offers`,
            token,
          ).catch(() => ({ offers: [] })),
        ]);

      let feed: VenueHubBundle['feed'] = [];
      if (access.canEnterVenueContext) {
        feed = await apiGet<VenueHubBundle['feed']>(
          `/social/venues/${encodeURIComponent(id)}/feed?limit=20`,
          token,
        ).catch(() => []);
      }

      return {
        access,
        friendsVisit: fv,
        friendsAtVenue: Array.isArray(fat.friends) ? fat.friends : [],
        engagement: eng,
        perks,
        challenges: Array.isArray(chList) ? chList : [],
        peopleHereCount: Array.isArray(peopleList) ? peopleList.length : 0,
        myRewards: Array.isArray(rewardsList) ? rewardsList : [],
        leaderboardPreview: Array.isArray(boardList) ? boardList.slice(0, 3) : [],
        offers: Array.isArray(offersPayload.offers) ? offersPayload.offers : [],
        feed: Array.isArray(feed) ? feed : [],
      };
    },
  });

  useFocusEffect(
    useCallback(() => {
      if (!isReady || !id) return;
      void query.refetch();
    }, [isReady, id, query.refetch]),
  );

  return query;
}

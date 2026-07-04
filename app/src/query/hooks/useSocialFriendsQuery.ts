import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';

import { apiGet } from '../../lib/api';
import {
  fetchSocialInbox,
  type SocialInboxFriendRequest,
  type SocialInboxPartyInvite,
} from '../../lib/socialInboxApi';
import { queryKeys } from '../queryKeys';
import { useAuthToken } from '../useAuthToken';

export type SocialFriendsGraph = {
  friends: { id: string; username: string }[];
  incoming: SocialInboxFriendRequest[];
  partyInvites: SocialInboxPartyInvite[];
  outgoing: { id: string; target: { id: string; username: string } }[];
  blocked: {
    blockedId: string;
    createdAt: string;
    blocked: { id: string; username: string };
  }[];
};

export function useSocialFriendsQuery() {
  const { isReady, requireToken } = useAuthToken();

  const query = useQuery({
    queryKey: queryKeys.social.friendsGraph(),
    enabled: isReady,
    staleTime: 15_000,
    queryFn: async (): Promise<SocialFriendsGraph> => {
      const token = await requireToken();
      const [friends, inbox, blocked] = await Promise.all([
        apiGet<{ id: string; username: string }[]>('/social/friends', token),
        fetchSocialInbox(token),
        apiGet<SocialFriendsGraph['blocked']>('/players/me/blocks', token).catch(() => []),
      ]);
      return {
        friends: Array.isArray(friends) ? friends : [],
        incoming: inbox.friendRequestsIncoming ?? [],
        partyInvites: inbox.partyInvitesIncoming ?? [],
        outgoing: inbox.friendRequestsOutgoing ?? [],
        blocked: Array.isArray(blocked) ? blocked : [],
      };
    },
  });

  useFocusEffect(
    useCallback(() => {
      if (!isReady) return;
      void query.refetch();
    }, [isReady, query.refetch]),
  );

  return query;
}

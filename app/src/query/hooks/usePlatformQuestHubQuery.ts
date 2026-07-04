import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';

import {
  fetchPlatformQuestHub,
  type PlatformQuestHubPayload,
  type QuestPeriod,
} from '../../lib/platformQuestApi';
import { queryKeys } from '../queryKeys';
import { useAuthToken } from '../useAuthToken';

export function usePlatformQuestHubQuery(period: QuestPeriod) {
  const { isReady, requireToken } = useAuthToken();

  const query = useQuery({
    queryKey: queryKeys.quests.hub(period),
    enabled: isReady,
    staleTime: 20_000,
    queryFn: async (): Promise<PlatformQuestHubPayload> => {
      const token = await requireToken();
      return fetchPlatformQuestHub(token, period);
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

import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';

import { apiGet } from '../../lib/api';
import type { MeSummaryDto } from '../../lib/meSummary';
import { syncOnboardingFromServerSummary } from '../../lib/onboardingStorage';
import { queryKeys } from '../queryKeys';
import { useAuthToken } from '../useAuthToken';

export function useMeSummaryQuery(options?: { refetchOnScreenFocus?: boolean }) {
  const { isReady, requireToken } = useAuthToken();
  const refetchOnScreenFocus = options?.refetchOnScreenFocus ?? true;

  const query = useQuery({
    queryKey: queryKeys.me.summary(),
    enabled: isReady,
    queryFn: async () => {
      const token = await requireToken();
      const summary = await apiGet<MeSummaryDto>('/players/me/summary', token);
      await syncOnboardingFromServerSummary(summary);
      return summary;
    },
  });

  useFocusEffect(
    useCallback(() => {
      if (!refetchOnScreenFocus || !isReady) return;
      void query.refetch();
    }, [refetchOnScreenFocus, isReady, query.refetch]),
  );

  return query;
}

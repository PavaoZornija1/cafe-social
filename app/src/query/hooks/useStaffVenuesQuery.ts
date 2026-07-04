import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';

import { fetchOwnerVenues, type OwnerVenueRow } from '../../lib/ownerStaffApi';
import { queryKeys } from '../queryKeys';
import { useAuthToken } from '../useAuthToken';

export function useStaffVenuesQuery() {
  const { isReady, requireToken } = useAuthToken();

  const query = useQuery({
    queryKey: queryKeys.staff.venues(),
    enabled: isReady,
    staleTime: 60_000,
    queryFn: async (): Promise<OwnerVenueRow[]> => {
      const token = await requireToken();
      const data = await fetchOwnerVenues(token);
      return data.venues ?? [];
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

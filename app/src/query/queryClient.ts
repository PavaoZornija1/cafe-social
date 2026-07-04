import { QueryClient } from '@tanstack/react-query';

export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 1,
        refetchOnReconnect: true,
        /** RN focus is wired via focusManager in QueryProvider. */
        refetchOnWindowFocus: true,
      },
    },
  });
}

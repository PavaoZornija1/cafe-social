"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { I18nProvider } from "@/i18n/I18nProvider";
import { DocumentLang } from "@/i18n/DocumentLang";

/**
 * Admin shell providers.
 * - TanStack Query: server-state caching (see https://tanstack.com/query).
 * - i18next: same languages as mobile + app translation keys + `admin.*` overlay.
 *
 * Routing stays on **Next.js App Router**. TanStack Router targets SPAs and would
 * duplicate navigation; use file-based routes + `<Link>` / `useRouter` here.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <DocumentLang />
        {children}
      </I18nProvider>
    </QueryClientProvider>
  );
}

"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { fetchPortalMe } from "../../lib/portalApi";

export default function DashboardRedirectPage() {
  const { isLoaded, getToken } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        if (!token) {
          router.replace("/sign-in");
          return;
        }
        const me = await fetchPortalMe(getToken);
        if (cancelled) return;
        if (me.needsPartnerOnboarding) {
          router.replace("/onboarding");
          return;
        }
        if (me.platformRole === "SUPER_ADMIN") {
          router.replace("/platform");
          return;
        }
        router.replace("/owner/venues");
      } catch {
        if (!cancelled) router.replace("/sign-in");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, getToken, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-lighter via-background to-white text-brand-muted flex flex-col items-center justify-center gap-3">
      <div className="h-10 w-10 rounded-xl bg-brand opacity-90 animate-pulse shadow-portal-card" aria-hidden />
      <p className="text-sm font-medium text-slate-700">Redirecting…</p>
    </div>
  );
}

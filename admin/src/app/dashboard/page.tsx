"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { usePortalMeQuery } from "@/lib/queries";

export default function DashboardRedirectPage() {
  const { isLoaded, getToken } = useAuth();
  const router = useRouter();
  const meQ = usePortalMeQuery(getToken, isLoaded);

  useEffect(() => {
    if (!isLoaded || meQ.isPending) return;
    if (meQ.isError) {
      router.replace("/sign-in");
      return;
    }
    const me = meQ.data;
    if (!me) {
      router.replace("/sign-in");
      return;
    }
    if (me.needsPartnerOnboarding) {
      router.replace("/onboarding");
      return;
    }
    if (me.platformRole === "SUPER_ADMIN") {
      router.replace("/platform");
      return;
    }
    router.replace("/owner/venues");
  }, [isLoaded, meQ.isPending, meQ.isError, meQ.data, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-lighter via-background to-white text-brand-muted flex flex-col items-center justify-center gap-3">
      <div
        className="h-10 w-10 rounded-xl bg-brand opacity-90 animate-pulse shadow-portal-card"
        aria-hidden
      />
      <p className="text-sm font-medium text-slate-700">Redirecting…</p>
    </div>
  );
}

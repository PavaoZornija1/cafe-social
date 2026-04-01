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
        if (me.platformRole === "SUPER_ADMIN") {
          router.replace("/venues");
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
    <div className="min-h-screen bg-zinc-950 text-zinc-400 flex items-center justify-center">
      Redirecting…
    </div>
  );
}

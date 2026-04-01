"use client";

import { UserButton, useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  fetchPortalMe,
  type PortalMeResponse,
} from "../lib/portalApi";

function navClass(active: boolean) {
  return `block rounded-lg px-3 py-2 text-sm font-medium ${
    active
      ? "bg-violet-950 text-violet-100 border border-violet-800"
      : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
  }`;
}

export default function PortalShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { isLoaded, getToken } = useAuth();
  const [me, setMe] = useState<PortalMeResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const token = await getToken();
      if (!token) {
        setMe(null);
        return;
      }
      const data = await fetchPortalMe(getToken);
      setMe(data);
    } catch (e) {
      setMe(null);
      setErr(e instanceof Error ? e.message : "Failed to load profile");
    }
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded) return;
    void load();
  }, [isLoaded, load]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-400 flex items-center justify-center">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex">
      <aside className="w-56 shrink-0 border-r border-zinc-800 p-4 flex flex-col gap-6">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
            Cafe Social
          </div>
          <nav className="flex flex-col gap-1">
            <Link
              href="/owner/venues"
              className={navClass(pathname?.startsWith("/owner/venues") ?? false)}
            >
              Venues & dashboard
            </Link>
            {me?.platformRole === "SUPER_ADMIN" ? (
              <>
                <Link
                  href="/venues"
                  className={navClass(
                    pathname === "/venues" ||
                      (!!pathname?.startsWith("/venues/") &&
                        !pathname?.startsWith("/owner")),
                  )}
                >
                  CMS — all venues
                </Link>
                <Link href="/words" className={navClass(pathname?.startsWith("/words") ?? false)}>
                  Word deck
                </Link>
              </>
            ) : null}
          </nav>
        </div>
        <div className="mt-auto pt-4 border-t border-zinc-800 text-xs text-zinc-500">
          {me ? (
            <p className="mb-2 truncate" title={me.email}>
              {me.email}
            </p>
          ) : null}
          {me?.platformRole === "SUPER_ADMIN" ? (
            <p className="text-violet-400 font-medium mb-2">Super admin</p>
          ) : null}
          <UserButton />
        </div>
      </aside>
      <main className="flex-1 min-w-0 overflow-auto">
        {err ? (
          <div className="m-4 rounded-lg border border-red-900 bg-red-950/40 text-red-200 text-sm p-3">
            {err}
          </div>
        ) : null}
        {children}
      </main>
    </div>
  );
}

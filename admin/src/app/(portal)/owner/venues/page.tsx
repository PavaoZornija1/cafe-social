"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";
import { apiBase } from "@/lib/api";

type VenueRow = {
  role: "EMPLOYEE" | "MANAGER" | "OWNER";
  venue: {
    id: string;
    name: string;
    city: string | null;
    country: string | null;
    address: string | null;
  };
};

export default function OwnerVenuesPage() {
  const { getToken, isLoaded } = useAuth();
  const [venues, setVenues] = useState<VenueRow[] | null>(null);
  const [platformRole, setPlatformRole] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const token = await getToken();
      if (!token) {
        setError("Not signed in.");
        return;
      }
      const res = await fetch(`${apiBase()}/owner/venues`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const t = await res.text();
        setError(t || res.statusText);
        return;
      }
      const data = (await res.json()) as {
        platformRole?: string;
        venues: VenueRow[];
      };
      setPlatformRole(data.platformRole ?? "NONE");
      setVenues(data.venues);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    }
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded) return;
    void load();
  }, [isLoaded, load]);

  return (
    <div className="bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-4">
        <h1 className="text-xl font-semibold">Venue dashboard</h1>
        <p className="text-sm text-zinc-400 mt-1">
          {platformRole === "SUPER_ADMIN"
            ? "Super admin — all venues."
            : "Analytics and redemptions for venues you manage."}
        </p>
      </header>

      <main className="p-6 max-w-2xl">
        {!isLoaded && <p className="text-zinc-400">Loading…</p>}
        {error && (
          <div className="rounded-lg border border-red-900/80 bg-red-950/40 px-4 py-3 text-red-200 text-sm">
            {error}
          </div>
        )}
        {venues && venues.length === 0 && !error && (
          <p className="text-zinc-400">
            No venues yet. A platform admin must add your Clerk email to a
            venue as OWNER, MANAGER, or EMPLOYEE.
          </p>
        )}
        {venues && venues.length > 0 && (
          <ul className="mt-6 space-y-3">
            {venues.map((row) => (
              <li key={row.venue.id}>
                <Link
                  href={`/owner/venues/${row.venue.id}`}
                  className="block rounded-xl border border-zinc-800 bg-zinc-900/50 hover:border-violet-600/50 transition px-4 py-4"
                >
                  <div className="flex justify-between gap-3 items-start">
                    <div>
                      <p className="font-medium text-zinc-100">
                        {row.venue.name}
                      </p>
                      <p className="text-sm text-zinc-500 mt-1">
                        {[row.venue.address, row.venue.city, row.venue.country]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </p>
                    </div>
                    <span className="text-xs font-mono uppercase tracking-wide text-violet-300 bg-violet-950/80 px-2 py-1 rounded">
                      {row.role}
                    </span>
                  </div>
                </Link>
                <div className="mt-2 text-sm">
                  <Link
                    href={`/staff/${row.venue.id}`}
                    className="text-emerald-400 hover:underline"
                  >
                    Today&apos;s redemptions only →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

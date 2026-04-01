"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { portalFetch } from "../../../lib/portalApi";

type Venue = {
  id: string;
  name: string;
  menuUrl: string | null;
  orderingUrl: string | null;
  featuredOfferTitle: string | null;
};

export default function VenuesPage() {
  const { isLoaded, getToken } = useAuth();
  const [rows, setRows] = useState<Venue[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    let c = false;
    (async () => {
      try {
        const data = await portalFetch<Venue[]>(getToken, "/admin/venues", {
          method: "GET",
        });
        if (!c) setRows(data);
      } catch (e) {
        if (!c) setErr((e as Error).message);
      }
    })();
    return () => {
      c = true;
    };
  }, [isLoaded, getToken]);

  if (err) {
    return (
      <div className="bg-zinc-950 text-red-300 p-8">
        {err}{" "}
        <Link href="/dashboard" className="text-violet-400 underline">
          Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-zinc-950 text-zinc-100 p-8">
      <h1 className="text-xl font-bold mb-4">All venues (CMS)</h1>
      {!rows ? (
        <p className="text-zinc-400">Loading…</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((v) => (
            <li key={v.id} className="border border-zinc-800 rounded-lg p-3">
              <div className="font-semibold">{v.name}</div>
              <div className="text-xs text-zinc-500 font-mono mt-1">{v.id}</div>
              <div className="flex gap-3 mt-2 text-sm flex-wrap">
                <Link
                  href={`/venues/${v.id}`}
                  className="text-violet-400 hover:underline"
                >
                  Edit copy & links
                </Link>
                <Link
                  href={`/perks/${v.id}`}
                  className="text-amber-400 hover:underline"
                >
                  Perks
                </Link>
                <Link
                  href={`/challenges/${v.id}`}
                  className="text-emerald-400 hover:underline"
                >
                  Challenges
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

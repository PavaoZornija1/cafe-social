"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { adminFetch } from "../../lib/adminApi";

type Venue = {
  id: string;
  name: string;
  menuUrl: string | null;
  orderingUrl: string | null;
  featuredOfferTitle: string | null;
};

export default function VenuesPage() {
  const [rows, setRows] = useState<Venue[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const data = await adminFetch<Venue[]>("/admin/venues", { method: "GET" });
        if (!c) setRows(data);
      } catch (e) {
        if (!c) setErr((e as Error).message);
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  if (err) {
    return (
      <div className="min-h-screen bg-zinc-950 text-red-300 p-8">
        {err}{" "}
        <Link href="/" className="text-violet-400 underline">
          ← Login
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
      <Link href="/" className="text-violet-400 text-sm mb-4 inline-block">
        ← Key
      </Link>
      <h1 className="text-xl font-bold mb-4">Venues</h1>
      {!rows ? (
        <p className="text-zinc-400">Loading…</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((v) => (
            <li key={v.id} className="border border-zinc-800 rounded-lg p-3">
              <div className="font-semibold">{v.name}</div>
              <div className="text-xs text-zinc-500 font-mono mt-1">{v.id}</div>
              <div className="flex gap-3 mt-2 text-sm">
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

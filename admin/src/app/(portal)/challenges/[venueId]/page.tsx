"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { portalFetch } from "../../../../lib/portalApi";

type Ch = {
  id: string;
  title: string;
  activeFrom: string | null;
  activeTo: string | null;
};

export default function ChallengesAdminPage() {
  const { venueId } = useParams<{ venueId: string }>();
  const { isLoaded, getToken } = useAuth();
  const [rows, setRows] = useState<Ch[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { from: string; to: string }>>({});

  useEffect(() => {
    if (!isLoaded || !venueId) return;
    let c = false;
    (async () => {
      try {
        const data = await portalFetch<Ch[]>(
          getToken,
          `/admin/venues/${venueId}/challenges`,
          { method: "GET" },
        );
        if (!c) {
          setRows(data);
          const e: Record<string, { from: string; to: string }> = {};
          for (const r of data) {
            e[r.id] = {
              from: r.activeFrom ? r.activeFrom.slice(0, 16) : "",
              to: r.activeTo ? r.activeTo.slice(0, 16) : "",
            };
          }
          setEdits(e);
        }
      } catch (e) {
        if (!c) setErr((e as Error).message);
      }
    })();
    return () => {
      c = true;
    };
  }, [isLoaded, venueId, getToken]);

  const patch = async (id: string) => {
    const ed = edits[id];
    if (!ed) return;
    setErr(null);
    try {
      await portalFetch(getToken, `/admin/challenges/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          activeFrom: ed.from ? new Date(ed.from).toISOString() : null,
          activeTo: ed.to ? new Date(ed.to).toISOString() : null,
        }),
      });
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
      <Link href="/venues" className="text-violet-400 text-sm">
        ← Venues
      </Link>
      <h1 className="text-xl font-bold mt-4 mb-4">Challenges (UTC window)</h1>
      {err ? <p className="text-red-400 mb-2">{err}</p> : null}
      <ul className="space-y-4 max-w-xl">
        {rows.map((r) => (
          <li key={r.id} className="border border-zinc-800 rounded p-3">
            <div className="font-medium">{r.title}</div>
            <div className="text-xs font-mono text-zinc-500">{r.id}</div>
            <div className="flex gap-2 mt-2 text-sm">
              <label className="flex-1">
                activeFrom
                <input
                  type="datetime-local"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-1"
                  value={edits[r.id]?.from ?? ""}
                  onChange={(e) =>
                    setEdits({
                      ...edits,
                      [r.id]: { ...edits[r.id]!, from: e.target.value },
                    })
                  }
                />
              </label>
              <label className="flex-1">
                activeTo
                <input
                  type="datetime-local"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-1"
                  value={edits[r.id]?.to ?? ""}
                  onChange={(e) =>
                    setEdits({
                      ...edits,
                      [r.id]: { ...edits[r.id]!, to: e.target.value },
                    })
                  }
                />
              </label>
            </div>
            <button
              type="button"
              onClick={() => void patch(r.id)}
              className="mt-2 text-xs bg-emerald-700 rounded px-2 py-1"
            >
              Save window
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

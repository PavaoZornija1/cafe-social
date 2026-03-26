"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { adminFetch } from "../../../lib/adminApi";

type Perk = {
  id: string;
  code: string;
  title: string;
  redemptionCount: number;
};

export default function PerksAdminPage() {
  const { venueId } = useParams<{ venueId: string }>();
  const [rows, setRows] = useState<Perk[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [requiresQr, setRequiresQr] = useState(false);

  useEffect(() => {
    if (!venueId) return;
    let c = false;
    (async () => {
      try {
        const data = await adminFetch<Perk[]>(`/admin/venues/${venueId}/perks`, {
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
  }, [venueId]);

  const create = async () => {
    if (!venueId) return;
    setErr(null);
    try {
      await adminFetch(`/admin/venues/${venueId}/perks`, {
        method: "POST",
        body: JSON.stringify({
          code,
          title,
          requiresQrUnlock: requiresQr,
        }),
      });
      setCode("");
      setTitle("");
      const data = await adminFetch<Perk[]>(`/admin/venues/${venueId}/perks`, {
        method: "GET",
      });
      setRows(data);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const remove = async (id: string) => {
    setErr(null);
    try {
      await adminFetch(`/admin/perks/${id}`, { method: "DELETE" });
      const data = await adminFetch<Perk[]>(`/admin/venues/${venueId}/perks`, {
        method: "GET",
      });
      setRows(data);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8 max-w-lg">
      <Link href="/venues" className="text-violet-400 text-sm">
        ← Venues
      </Link>
      <h1 className="text-xl font-bold mt-4 mb-4">Perk codes</h1>
      {err ? <p className="text-red-400 text-sm mb-2">{err}</p> : null}
      <div className="border border-zinc-800 rounded p-3 mb-4 space-y-2">
        <input
          className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm"
          placeholder="CODE (e.g. COFFEE10)"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <input
          className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm"
          placeholder="Title shown after redeem"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={requiresQr}
            onChange={(e) => setRequiresQr(e.target.checked)}
          />
          Requires QR unlock
        </label>
        <button
          type="button"
          onClick={() => void create()}
          className="bg-amber-600 rounded px-3 py-1 text-sm font-medium"
        >
          Create
        </button>
      </div>
      <ul className="space-y-2 text-sm">
        {rows.map((p) => (
          <li
            key={p.id}
            className="flex justify-between items-center border border-zinc-800 rounded px-2 py-1"
          >
            <span>
              <span className="font-mono text-amber-200">{p.code}</span> — {p.title}{" "}
              <span className="text-zinc-500">({p.redemptionCount})</span>
            </span>
            <button
              type="button"
              onClick={() => void remove(p.id)}
              className="text-red-400 text-xs"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

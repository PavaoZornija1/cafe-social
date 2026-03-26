"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useState } from "react";

const apiBase =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) ||
  "http://localhost:3001/api";

type Row = {
  staffVerificationCode: string;
  redeemedAt: string;
  perkCode: string;
  perkTitle: string;
};

type ResponseOk = {
  venueName: string;
  date: string;
  redemptions: Row[];
};

function todayUtcYmd(): string {
  const n = new Date();
  const y = n.getUTCFullYear();
  const m = String(n.getUTCMonth() + 1).padStart(2, "0");
  const d = String(n.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function StaffPortalPage() {
  const { venueId } = useParams<{ venueId: string }>();
  const [pin, setPin] = useState("");
  const [date, setDate] = useState(todayUtcYmd);
  const [data, setData] = useState<ResponseOk | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!venueId) return;
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch(
        `${apiBase}/staff/venues/${venueId}/redemptions?date=${encodeURIComponent(date)}`,
        {
          headers: { "X-Venue-Staff-Pin": pin.trim() },
        },
      );
      const text = await res.text();
      if (!res.ok) throw new Error(text || res.statusText);
      setData(JSON.parse(text) as ResponseOk);
    } catch (e) {
      setData(null);
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [venueId, date, pin]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 max-w-lg mx-auto">
      <Link href="/venues" className="text-violet-400 text-sm">
        ← Venues (manager)
      </Link>
      <h1 className="text-xl font-bold mt-4 mb-1">Staff — perk checks</h1>
      <p className="text-xs text-zinc-500 mb-4 font-mono">{venueId}</p>
      <p className="text-sm text-zinc-400 mb-4">
        Enter the venue PIN from the manager. Ask the guest for their{" "}
        <strong className="text-zinc-200">8-character code</strong> after they tap Redeem — it
        must appear on this list for today (UTC date).
      </p>
      <div className="space-y-3 border border-zinc-800 rounded-lg p-3 mb-4">
        <label className="block text-sm">
          Staff PIN
          <input
            type="password"
            autoComplete="off"
            className="mt-1 w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 font-mono"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          Date (UTC, YYYY-MM-DD)
          <input
            type="text"
            className="mt-1 w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 font-mono"
            value={date}
            onChange={(e) => setDate(e.target.value.trim())}
          />
        </label>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading || !pin.trim()}
          className="w-full bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 rounded py-2 font-semibold"
        >
          {loading ? "Loading…" : "Load redemptions"}
        </button>
      </div>
      {err ? <p className="text-red-400 text-sm mb-3">{err}</p> : null}
      {data ? (
        <div>
          <h2 className="font-semibold text-zinc-200">{data.venueName}</h2>
          <p className="text-xs text-zinc-500 mb-2">{data.date} UTC · newest first</p>
          {data.redemptions.length === 0 ? (
            <p className="text-zinc-500 text-sm">No redemptions for this day.</p>
          ) : (
            <ul className="space-y-2">
              {data.redemptions.map((r) => (
                <li
                  key={`${r.staffVerificationCode}-${r.redeemedAt}`}
                  className="border border-zinc-800 rounded p-2 text-sm"
                >
                  <div className="font-mono text-amber-200 text-lg font-bold">
                    {r.staffVerificationCode}
                  </div>
                  <div className="text-zinc-400 text-xs">{r.redeemedAt}</div>
                  <div>
                    {r.perkCode} — {r.perkTitle}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

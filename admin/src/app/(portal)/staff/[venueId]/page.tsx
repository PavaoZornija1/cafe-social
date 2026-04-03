"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { portalFetch } from "../../../../lib/portalApi";

type Row = {
  redemptionId: string;
  staffVerificationCode: string;
  redeemedAt: string;
  perkCode: string;
  perkTitle: string;
  voidedAt: string | null;
  voidReason: string | null;
  staffAcknowledgedAt: string | null;
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

export default function StaffRedemptionsPage() {
  const { venueId } = useParams<{ venueId: string }>();
  const { isLoaded, getToken } = useAuth();
  const [date, setDate] = useState(todayUtcYmd);
  const [data, setData] = useState<ResponseOk | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!venueId) return;
    setErr(null);
    setLoading(true);
    try {
      const q = new URLSearchParams({ date });
      const parsed = await portalFetch<ResponseOk>(
        getToken,
        `/owner/venues/${venueId}/redemptions?${q}`,
        { method: "GET" },
      );
      setData(parsed);
    } catch (e) {
      setData(null);
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [venueId, date, getToken]);

  useEffect(() => {
    if (!isLoaded || !venueId) return;
    void load();
  }, [isLoaded, venueId, load]);

  return (
    <div className="bg-slate-50 text-slate-900 p-6 max-w-lg">
      <Link href="/owner/venues" className="text-brand text-sm">
        ← My venues
      </Link>
      <h1 className="text-xl font-bold mt-4 mb-1">Today&apos;s redemptions</h1>
      <p className="text-xs text-slate-500 mb-4 font-mono">{venueId}</p>
      <p className="text-sm text-slate-600 mb-4">
        Signed in with your staff account. Match the guest&apos;s{" "}
        <strong className="text-slate-800">8-character code</strong> after they
        redeem — it must appear on this list for the selected UTC date.
      </p>
      <div className="space-y-3 border border-slate-200 rounded-lg p-3 mb-4">
        <label className="block text-sm">
          Date (UTC, YYYY-MM-DD)
          <input
            type="text"
            className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1 font-mono"
            value={date}
            onChange={(e) => setDate(e.target.value.trim())}
          />
        </label>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="w-full bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 rounded py-2 font-semibold"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>
      {err ? <p className="text-red-600 text-sm mb-3">{err}</p> : null}
      {data ? (
        <div>
          <h2 className="font-semibold text-slate-800">{data.venueName}</h2>
          <p className="text-xs text-slate-500 mb-2">
            {data.date} UTC · newest first
          </p>
          {data.redemptions.length === 0 ? (
            <p className="text-slate-500 text-sm">No redemptions for this day.</p>
          ) : (
            <ul className="space-y-2">
              {data.redemptions.map((r) => (
                <li
                  key={r.redemptionId}
                  className="border border-slate-200 rounded p-2 text-sm"
                >
                  <div className="font-mono text-amber-900 text-lg font-bold">
                    {r.staffVerificationCode}
                  </div>
                  <div className="text-slate-600 text-xs">{r.redeemedAt}</div>
                  <div>
                    {r.perkCode} — {r.perkTitle}
                  </div>
                  {r.voidedAt ? (
                    <div className="text-red-600 text-xs mt-1">
                      Voided {r.voidedAt}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

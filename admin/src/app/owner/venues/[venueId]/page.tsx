"use client";

import Link from "next/link";
import { UserButton, useAuth } from "@clerk/nextjs";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiBase } from "@/lib/api";

type VenueRow = {
  role: "EMPLOYEE" | "MANAGER" | "OWNER";
  venue: { id: string; name: string };
};

type Analytics = {
  venueId: string;
  analyticsTimeZone: string | null;
  period: { days: number; startDay: string; endDay: string };
  redemptions: {
    total: number;
    voided: number;
    byDay: { day: string; count: number }[];
    byHourUtc: { hour: number; count: number }[];
    byHourVenue: { hour: number; count: number }[] | null;
    perPerk: { perkId: string; code: string; title: string; count: number }[];
  };
  visits: {
    uniquePlayers: number;
    totalVisitDays: number;
    byDay: { day: string; count: number }[];
  };
  funnel: {
    uniqueVisitors: number;
    uniqueRedeemers: number;
    totalRedemptions: number;
    visitToRedeemPercent: number;
  };
  feedEvents: {
    total: number;
    byKind: Record<string, number>;
  };
};

type RedemptionsPayload = {
  venueName: string;
  date: string;
  redemptions: {
    redemptionId: string;
    staffVerificationCode: string;
    redeemedAt: string;
    perkCode: string;
    perkTitle: string;
    voidedAt: string | null;
    voidReason: string | null;
    staffAcknowledgedAt: string | null;
  }[];
};

type CampaignRow = {
  id: string;
  name: string;
  title: string;
  body: string;
  segmentDays: number;
  status: string;
  recipientCount: number | null;
  pushSentCount: number;
  sentAt: string | null;
  lastError: string | null;
  createdAt: string;
};

type ReceiptSummary = {
  id: string;
  playerId: string;
  status: string;
  notePlayer: string | null;
  staffNote: string | null;
  abuseFlag: boolean;
  retentionUntil: string | null;
  createdAt: string;
  player: { email: string; username: string };
};

type ReceiptDetail = ReceiptSummary & {
  imageData: string;
  mimeType: string;
};

function todayUtc(): string {
  const n = new Date();
  const y = n.getUTCFullYear();
  const m = String(n.getUTCMonth() + 1).padStart(2, "0");
  const d = String(n.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function OwnerVenueDetailPage() {
  const params = useParams();
  const venueId = params.venueId as string;
  const { getToken, isLoaded } = useAuth();

  const [role, setRole] = useState<VenueRow["role"] | null>(null);
  const [venueName, setVenueName] = useState<string>("");
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [redemptions, setRedemptions] = useState<RedemptionsPayload | null>(null);
  const [dateYmd, setDateYmd] = useState(todayUtc);
  const [days, setDays] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [campName, setCampName] = useState("");
  const [campTitle, setCampTitle] = useState("");
  const [campBody, setCampBody] = useState("");
  const [campSeg, setCampSeg] = useState(30);
  const [campBusy, setCampBusy] = useState(false);

  const [receipts, setReceipts] = useState<ReceiptSummary[]>([]);
  const [receiptDetail, setReceiptDetail] = useState<ReceiptDetail | null>(null);
  const [receiptBusy, setReceiptBusy] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const canAnalytics = useMemo(
    () => role === "OWNER" || role === "MANAGER",
    [role],
  );

  const loadVenueMeta = useCallback(async () => {
    const token = await getToken();
    if (!token) return null;
    const res = await fetch(`${apiBase()}/owner/venues`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { venues: VenueRow[] };
    return data.venues.find((v) => v.venue.id === venueId) ?? null;
  }, [getToken, venueId]);

  const loadAnalytics = useCallback(async () => {
    const token = await getToken();
    if (!token) throw new Error("Not signed in");
    const res = await fetch(
      `${apiBase()}/owner/venues/${venueId}/analytics?days=${days}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || res.statusText);
    }
    return (await res.json()) as Analytics;
  }, [getToken, venueId, days]);

  const loadRedemptions = useCallback(async () => {
    const token = await getToken();
    if (!token) throw new Error("Not signed in");
    const q = new URLSearchParams({ date: dateYmd });
    const res = await fetch(
      `${apiBase()}/owner/venues/${venueId}/redemptions?${q}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || res.statusText);
    }
    return (await res.json()) as RedemptionsPayload;
  }, [getToken, venueId, dateYmd]);

  const loadCampaigns = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const res = await fetch(`${apiBase()}/owner/venues/${venueId}/campaigns`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    setCampaigns((await res.json()) as CampaignRow[]);
  }, [getToken, venueId]);

  const loadReceipts = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const res = await fetch(`${apiBase()}/owner/venues/${venueId}/receipts`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    setReceipts((await res.json()) as ReceiptSummary[]);
  }, [getToken, venueId]);

  useEffect(() => {
    if (!isLoaded || !venueId) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const meta = await loadVenueMeta();
        if (cancelled) return;
        if (!meta) {
          setError(
            "You do not have access to this venue or it does not exist.",
          );
          setRole(null);
          setLoading(false);
          return;
        }
        setRole(meta.role);
        setVenueName(meta.venue.name);

        if (meta.role === "OWNER" || meta.role === "MANAGER") {
          const a = await loadAnalytics();
          if (cancelled) return;
          setAnalytics(a);
          await loadCampaigns();
          await loadReceipts();
        } else {
          setAnalytics(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, venueId, loadVenueMeta, loadAnalytics, loadCampaigns, loadReceipts]);

  useEffect(() => {
    if (!isLoaded || !venueId || !canAnalytics) return;
    let cancelled = false;
    (async () => {
      try {
        const a = await loadAnalytics();
        if (!cancelled) setAnalytics(a);
      } catch {
        /* keep prior */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [days, canAnalytics, isLoaded, venueId, loadAnalytics]);

  useEffect(() => {
    if (!isLoaded || !venueId || role == null) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await loadRedemptions();
        if (!cancelled) setRedemptions(r);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Failed to load redemptions",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dateYmd, venueId, isLoaded, role, loadRedemptions]);

  const downloadCsv = async () => {
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Sign in required");
      const res = await fetch(
        `${apiBase()}/owner/venues/${venueId}/analytics/export.csv?days=${days}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `redemptions-${venueId.slice(0, 8)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "CSV download failed");
    }
  };

  const createCampaign = async () => {
    setCampBusy(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Sign in");
      const res = await fetch(
        `${apiBase()}/owner/venues/${venueId}/campaigns`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: campName,
            title: campTitle,
            body: campBody,
            segmentDays: campSeg,
          }),
        },
      );
      if (!res.ok) throw new Error(await res.text());
      setCampName("");
      setCampTitle("");
      setCampBody("");
      await loadCampaigns();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Campaign failed");
    } finally {
      setCampBusy(false);
    }
  };

  const sendCampaign = async (campaignId: string) => {
    setCampBusy(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Sign in");
      const res = await fetch(
        `${apiBase()}/owner/venues/${venueId}/campaigns/${campaignId}/send`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) throw new Error(await res.text());
      await loadCampaigns();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setCampBusy(false);
    }
  };

  const openReceipt = async (id: string) => {
    setReceiptBusy(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Sign in");
      const res = await fetch(
        `${apiBase()}/owner/venues/${venueId}/receipts/${id}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error(await res.text());
      setReceiptDetail((await res.json()) as ReceiptDetail);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load receipt failed");
    } finally {
      setReceiptBusy(false);
    }
  };

  const reviewReceipt = async (
    status: "APPROVED" | "REJECTED",
    rid: string,
  ) => {
    setReceiptBusy(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Sign in");
      const res = await fetch(
        `${apiBase()}/owner/venues/${venueId}/receipts/${rid}/review`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status, staffNote: "" }),
        },
      );
      if (!res.ok) throw new Error(await res.text());
      setReceiptDetail(null);
      await loadReceipts();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed");
    } finally {
      setReceiptBusy(false);
    }
  };

  const ackRedemption = async (redemptionId: string) => {
    setActionBusy(redemptionId);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(
        `${apiBase()}/owner/venues/${venueId}/redemptions/${redemptionId}/acknowledge`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) throw new Error(await res.text());
      setRedemptions(await loadRedemptions());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ack failed");
    } finally {
      setActionBusy(null);
    }
  };

  const voidRedemption = async (redemptionId: string) => {
    if (!voidReason.trim()) {
      setError("Enter a void reason (manager/owner).");
      return;
    }
    setActionBusy(redemptionId);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(
        `${apiBase()}/owner/venues/${venueId}/redemptions/${redemptionId}/void`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reason: voidReason.trim() }),
        },
      );
      if (!res.ok) throw new Error(await res.text());
      setVoidReason("");
      setRedemptions(await loadRedemptions());
      if (canAnalytics) {
        try {
          setAnalytics(await loadAnalytics());
        } catch {
          /* */
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Void failed");
    } finally {
      setActionBusy(null);
    }
  };

  const title = venueName || "Venue";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between gap-4">
        <div>
          <Link
            href="/owner/venues"
            className="text-sm text-violet-400 hover:text-violet-300"
          >
            ← All venues
          </Link>
          <h1 className="text-xl font-semibold mt-2">
            {title}
            {role && (
              <span className="ml-3 text-xs font-mono uppercase tracking-wide text-violet-300 align-middle">
                {role}
              </span>
            )}
          </h1>
        </div>
        <UserButton />
      </header>

      <main className="p-6 max-w-4xl mx-auto space-y-10 pb-24">
        {loading && <p className="text-zinc-400">Loading…</p>}
        {error && (
          <div className="rounded-lg border border-red-900/80 bg-red-950/40 px-4 py-3 text-red-200 text-sm">
            {error}
          </div>
        )}

        {canAnalytics && analytics && !error && (
          <section>
            <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
              <h2 className="text-lg font-medium">Analytics</h2>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void downloadCsv()}
                  className="text-sm bg-emerald-900/50 border border-emerald-800 text-emerald-200 px-3 py-1 rounded-lg hover:bg-emerald-900/70"
                >
                  Download CSV
                </button>
                <label className="text-sm text-zinc-400 flex items-center gap-2">
                  Period (days)
                  <select
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value))}
                    className="bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-zinc-100"
                  >
                    {[7, 14, 30, 60, 90].map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <p className="text-xs text-zinc-500 mb-4">
              UTC range {analytics.period.startDay} → {analytics.period.endDay}
              {analytics.analyticsTimeZone
                ? ` · Venue TZ: ${analytics.analyticsTimeZone}`
                : ""}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <p className="text-sm text-zinc-400">Active redemptions</p>
                <p className="text-2xl font-semibold mt-1">
                  {analytics.redemptions.total}
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  Voided: {analytics.redemptions.voided}
                </p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <p className="text-sm text-zinc-400">Unique visitors</p>
                <p className="text-2xl font-semibold mt-1">
                  {analytics.visits.uniquePlayers}
                </p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <p className="text-sm text-zinc-400">Funnel</p>
                <p className="text-lg font-semibold mt-1">
                  {analytics.funnel.uniqueRedeemers} /{" "}
                  {analytics.funnel.uniqueVisitors} redeemers
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  ≈ {analytics.funnel.visitToRedeemPercent}% of visitors
                  redeemed
                </p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <p className="text-sm text-zinc-400">Feed events</p>
                <p className="text-2xl font-semibold mt-1">
                  {analytics.feedEvents.total}
                </p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-zinc-300 mb-2">
                  Per perk
                </h3>
                <div className="max-h-48 overflow-auto rounded-lg border border-zinc-800">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-900 sticky top-0 text-zinc-500">
                      <tr>
                        <th className="p-2 text-left">Perk</th>
                        <th className="p-2 text-left">Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.redemptions.perPerk.map((p) => (
                        <tr key={p.perkId} className="border-t border-zinc-800">
                          <td className="p-2">
                            {p.title}{" "}
                            <span className="text-zinc-500 text-xs">
                              ({p.code})
                            </span>
                          </td>
                          <td className="p-2">{p.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-zinc-300 mb-2">
                  Redemptions by hour (UTC)
                </h3>
                <div className="max-h-48 overflow-auto rounded-lg border border-zinc-800 text-xs font-mono p-2 text-zinc-400">
                  {analytics.redemptions.byHourUtc
                    .filter((h) => h.count > 0)
                    .map((h) => (
                      <div key={h.hour}>
                        {String(h.hour).padStart(2, "0")}:00 — {h.count}
                      </div>
                    ))}
                </div>
              </div>
            </div>
            {analytics.redemptions.byHourVenue && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-zinc-300 mb-2">
                  Redemptions by hour (venue TZ)
                </h3>
                <div className="max-h-48 overflow-auto rounded-lg border border-zinc-800 text-xs font-mono p-2 text-zinc-400">
                  {analytics.redemptions.byHourVenue
                    .filter((h) => h.count > 0)
                    .map((h) => (
                      <div key={h.hour}>
                        {String(h.hour).padStart(2, "0")}:00 — {h.count}
                      </div>
                    ))}
                </div>
              </div>
            )}
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-zinc-300 mb-2">
                  Redemptions by day
                </h3>
                <div className="max-h-56 overflow-auto rounded-lg border border-zinc-800">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-900 sticky top-0">
                      <tr className="text-left text-zinc-500">
                        <th className="p-2 font-medium">Day (UTC)</th>
                        <th className="p-2 font-medium">Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.redemptions.byDay
                        .filter((r) => r.count > 0)
                        .map((r) => (
                          <tr
                            key={r.day}
                            className="border-t border-zinc-800/80"
                          >
                            <td className="p-2 font-mono text-zinc-300">
                              {r.day}
                            </td>
                            <td className="p-2">{r.count}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-zinc-300 mb-2">
                  Visit days by day
                </h3>
                <div className="max-h-56 overflow-auto rounded-lg border border-zinc-800">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-900 sticky top-0">
                      <tr className="text-left text-zinc-500">
                        <th className="p-2 font-medium">Day (UTC)</th>
                        <th className="p-2 font-medium">Visits</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.visits.byDay
                        .filter((r) => r.count > 0)
                        .map((r) => (
                          <tr
                            key={r.day}
                            className="border-t border-zinc-800/80"
                          >
                            <td className="p-2 font-mono text-zinc-300">
                              {r.day}
                            </td>
                            <td className="p-2">{r.count}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        )}

        {canAnalytics && (
          <section className="border border-zinc-800 rounded-xl p-4 space-y-4">
            <h2 className="text-lg font-medium">Marketing campaigns</h2>
            <p className="text-xs text-zinc-500">
              Push to players who visited this venue in the last N UTC days.
              Only sends to accounts with partner marketing on and not in total
              privacy (server-side).
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm"
                placeholder="Internal name"
                value={campName}
                onChange={(e) => setCampName(e.target.value)}
              />
              <input
                type="number"
                min={1}
                max={365}
                className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm"
                value={campSeg}
                onChange={(e) => setCampSeg(Number(e.target.value))}
              />
              <input
                className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm sm:col-span-2"
                placeholder="Notification title"
                value={campTitle}
                onChange={(e) => setCampTitle(e.target.value)}
              />
              <textarea
                className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm min-h-[80px] sm:col-span-2"
                placeholder="Notification body"
                value={campBody}
                onChange={(e) => setCampBody(e.target.value)}
              />
            </div>
            <button
              type="button"
              disabled={campBusy}
              onClick={() => void createCampaign()}
              className="bg-violet-700 hover:bg-violet-600 disabled:opacity-50 rounded-lg px-4 py-2 text-sm font-semibold"
            >
              Save draft campaign
            </button>
            <ul className="divide-y divide-zinc-800 border border-zinc-800 rounded-lg overflow-hidden">
              {campaigns.map((c) => (
                <li
                  key={c.id}
                  className="p-3 flex flex-wrap gap-3 items-center justify-between bg-zinc-900/30"
                >
                  <div>
                    <p className="font-medium text-zinc-200">{c.name}</p>
                    <p className="text-xs text-zinc-500">
                      {c.status} · segment {c.segmentDays}d
                      {c.recipientCount != null
                        ? ` · recipients ${c.recipientCount}`
                        : ""}
                    </p>
                    {c.lastError ? (
                      <p className="text-xs text-red-400 mt-1">{c.lastError}</p>
                    ) : null}
                  </div>
                  {c.status !== "COMPLETED" ? (
                    <button
                      type="button"
                      disabled={campBusy}
                      onClick={() => void sendCampaign(c.id)}
                      className="text-sm bg-amber-900/40 border border-amber-800 text-amber-200 px-3 py-1 rounded-lg"
                    >
                      Send now
                    </button>
                  ) : (
                    <span className="text-xs text-zinc-500">Sent</span>
                  )}
                </li>
              ))}
              {campaigns.length === 0 ? (
                <li className="p-4 text-zinc-500 text-sm">No campaigns yet.</li>
              ) : null}
            </ul>
          </section>
        )}

        {canAnalytics && (
          <section className="border border-zinc-800 rounded-xl p-4 space-y-4">
            <h2 className="text-lg font-medium">Receipt submissions</h2>
            <p className="text-xs text-zinc-500">
              90-day retention target per submission. Approve or reject from
              detail view.
            </p>
            <button
              type="button"
              onClick={() => void loadReceipts()}
              className="text-sm text-violet-400"
            >
              Refresh list
            </button>
            <ul className="divide-y divide-zinc-800 border border-zinc-800 rounded-lg">
              {receipts.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className="w-full text-left p-3 hover:bg-zinc-900/50 flex justify-between gap-2"
                    onClick={() => void openReceipt(r.id)}
                  >
                    <span className="text-sm text-zinc-300">
                      {r.player.email} · {r.status}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {new Date(r.createdAt).toISOString()}
                    </span>
                  </button>
                </li>
              ))}
              {receipts.length === 0 ? (
                <li className="p-4 text-zinc-500 text-sm">No receipts.</li>
              ) : null}
            </ul>
            {receiptDetail && (
              <div className="border border-zinc-700 rounded-lg p-4 space-y-3 bg-zinc-900/40">
                <p className="text-sm text-zinc-400">
                  {receiptDetail.player.email} — {receiptDetail.status}
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={receiptDetail.imageData}
                  alt="Receipt"
                  className="max-h-64 rounded border border-zinc-700"
                />
                {receiptDetail.status === "PENDING" && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={receiptBusy}
                      onClick={() =>
                        void reviewReceipt("APPROVED", receiptDetail.id)
                      }
                      className="bg-emerald-800 text-white px-3 py-2 rounded-lg text-sm"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={receiptBusy}
                      onClick={() =>
                        void reviewReceipt("REJECTED", receiptDetail.id)
                      }
                      className="bg-red-900/80 text-red-100 px-3 py-2 rounded-lg text-sm"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => setReceiptDetail(null)}
                      className="text-zinc-400 text-sm px-2"
                    >
                      Close
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {redemptions && !error && (
          <section>
            <h2 className="text-lg font-medium mb-4">Perk redemptions</h2>
            {canAnalytics && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <input
                  className="bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-sm flex-1 min-w-[200px]"
                  placeholder="Void reason (managers)"
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                />
              </div>
            )}
            <div className="flex flex-wrap items-center gap-4 mb-4">
              <label className="text-sm text-zinc-400 flex items-center gap-2">
                Date (UTC)
                <input
                  type="date"
                  value={dateYmd}
                  onChange={(e) => setDateYmd(e.target.value)}
                  className="bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-zinc-100"
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  void (async () => {
                    try {
                      const r = await loadRedemptions();
                      setRedemptions(r);
                      setError(null);
                    } catch (e) {
                      setError(
                        e instanceof Error ? e.message : "Failed to refresh",
                      );
                    }
                  })();
                }}
                className="text-sm bg-zinc-800 hover:bg-zinc-700 px-3 py-1 rounded-lg"
              >
                Refresh
              </button>
            </div>
            <div className="rounded-xl border border-zinc-800 overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="bg-zinc-900 text-zinc-500 text-left">
                  <tr>
                    <th className="p-3 font-medium">Staff code</th>
                    <th className="p-3 font-medium">Time (UTC)</th>
                    <th className="p-3 font-medium">Perk</th>
                    <th className="p-3 font-medium">Status</th>
                    {role ? <th className="p-3 font-medium">Actions</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {redemptions.redemptions.map((r) => (
                    <tr
                      key={r.redemptionId}
                      className={`border-t border-zinc-800 ${r.voidedAt ? "opacity-50" : ""}`}
                    >
                      <td className="p-3 font-mono text-amber-200">
                        {r.staffVerificationCode}
                      </td>
                      <td className="p-3 text-zinc-400">
                        {new Date(r.redeemedAt).toISOString()}
                      </td>
                      <td className="p-3">
                        <span className="text-zinc-200">{r.perkTitle}</span>
                        <span className="text-zinc-500 text-xs ml-2">
                          ({r.perkCode})
                        </span>
                      </td>
                      <td className="p-3 text-xs text-zinc-500">
                        {r.voidedAt
                          ? `Voided`
                          : r.staffAcknowledgedAt
                            ? `Ack`
                            : "—"}
                      </td>
                      <td className="p-3">
                        {!r.voidedAt && role ? (
                          <div className="flex flex-col gap-1">
                            <button
                              type="button"
                              disabled={!!actionBusy || !!r.staffAcknowledgedAt}
                              onClick={() => void ackRedemption(r.redemptionId)}
                              className="text-xs text-violet-400 text-left"
                            >
                              Acknowledge
                            </button>
                            {canAnalytics ? (
                              <button
                                type="button"
                                disabled={!!actionBusy}
                                onClick={() =>
                                  void voidRedemption(r.redemptionId)
                                }
                                className="text-xs text-red-400 text-left"
                              >
                                Void
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {redemptions.redemptions.length === 0 && (
                <p className="p-6 text-zinc-500">No redemptions for this day.</p>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

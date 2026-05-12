"use client";

import type { OwnerVenueAnalytics, OwnerVenueCampaignRow } from "@/lib/queries";

function formatCountDelta(cur: number, prev: number): string {
  if (prev === 0 && cur === 0) return "—";
  if (prev === 0) return "vs prior: new";
  const pct = Math.round(((cur - prev) / prev) * 1000) / 10;
  const sign = pct > 0 ? "+" : "";
  return `vs prior: ${sign}${pct}%`;
}

function formatPointsDelta(cur: number, prev: number): string {
  const d = Math.round((cur - prev) * 10) / 10;
  const sign = d > 0 ? "+" : "";
  return `vs prior: ${sign}${d} pp`;
}

function sumCampaignPushesInUtcRange(
  campaigns: OwnerVenueCampaignRow[],
  startDay: string,
  endDay: string,
): number {
  let n = 0;
  for (const c of campaigns) {
    if (!c.sentAt) continue;
    const d = c.sentAt.slice(0, 10);
    if (d >= startDay && d <= endDay) n += c.pushSentCount;
  }
  return n;
}

export function OwnerAnalyticsRoiSnapshot({
  current,
  previous,
  previousLoading,
  campaigns,
}: {
  current: OwnerVenueAnalytics;
  previous: OwnerVenueAnalytics | null | undefined;
  previousLoading: boolean;
  campaigns: OwnerVenueCampaignRow[];
}) {
  const { startDay, endDay } = current.period;
  const pushes = sumCampaignPushesInUtcRange(campaigns, startDay, endDay);
  const prevPushes = previous
    ? sumCampaignPushesInUtcRange(campaigns, previous.period.startDay, previous.period.endDay)
    : null;

  const v = current.visits.uniquePlayers;
  const v0 = previous?.visits.uniquePlayers;
  const r = current.redemptions.total;
  const r0 = previous?.redemptions.total;
  const conv = current.funnel.visitToRedeemPercent;
  const conv0 = previous?.funnel.visitToRedeemPercent;
  const repPct = current.visits.loyalty.shareRepeatVisitorsPercent;
  const repPct0 = previous?.visits.loyalty.shareRepeatVisitorsPercent;

  return (
    <div className="mb-6 rounded-2xl border border-brand/20 bg-gradient-to-br from-brand-light/80 to-white p-5 shadow-portal-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-slate-900 tracking-tight">At a glance (ROI)</h3>
        <p className="text-xs text-slate-500">
          {startDay} → {endDay} UTC
          {previousLoading ? " · loading comparison…" : previous ? " · vs prior period" : ""}
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        <div className="rounded-xl border border-slate-200/90 bg-white/90 p-3">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Unique visitors</p>
          <p className="text-2xl font-semibold text-slate-900 mt-0.5">{v}</p>
          <p className="text-xs text-slate-500 mt-1">
            {previous == null ? "—" : formatCountDelta(v, v0 ?? 0)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200/90 bg-white/90 p-3">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Redemptions</p>
          <p className="text-2xl font-semibold text-slate-900 mt-0.5">{r}</p>
          <p className="text-xs text-slate-500 mt-1">
            {previous == null ? "—" : formatCountDelta(r, r0 ?? 0)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200/90 bg-white/90 p-3">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Visit → redeem</p>
          <p className="text-2xl font-semibold text-slate-900 mt-0.5">{conv}%</p>
          <p className="text-xs text-slate-500 mt-1">
            {previous == null ? "—" : formatPointsDelta(conv, conv0 ?? 0)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200/90 bg-white/90 p-3">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Repeat share</p>
          <p className="text-2xl font-semibold text-slate-900 mt-0.5">{repPct}%</p>
          <p className="text-xs text-slate-500 mt-1">
            {previous == null ? "—" : formatPointsDelta(repPct, repPct0 ?? 0)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200/90 bg-white/90 p-3">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Campaign pushes</p>
          <p className="text-2xl font-semibold text-slate-900 mt-0.5">{pushes}</p>
          <p className="text-xs text-slate-500 mt-1">
            {previous == null
              ? "Sent in this range (logged sends)"
              : formatCountDelta(pushes, prevPushes ?? 0)}
          </p>
        </div>
      </div>
      <p className="text-xs text-slate-500 mt-3">
        Comparison uses the immediately preceding UTC window of the same length. Campaign row sums{" "}
        <code className="text-slate-600">pushSentCount</code> for sends whose <code className="text-slate-600">sentAt</code>{" "}
        falls in the period (approximate uplift vs operations).
      </p>
    </div>
  );
}

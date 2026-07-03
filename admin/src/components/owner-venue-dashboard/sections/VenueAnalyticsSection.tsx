"use client";

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { OwnerAnalyticsCharts } from "@/components/OwnerAnalyticsCharts";
import { OwnerAnalyticsRoiSnapshot } from "@/components/OwnerAnalyticsRoiSnapshot";
import { OwnerAttributionSnapshot } from "@/components/OwnerAttributionSnapshot";
import { DayCountCards, HourCountCards, PerkCountCards } from "@/components/TableRowCards";
import { ownerFetch } from "@/lib/portalApi";
import {
  ownerAnalyticsQueryString,
  useOwnerVenueAnalyticsQuery,
  useOwnerVenueCampaignsQuery,
  useOwnerVenueGeofenceDwellQuery,
} from "@/lib/queries";
import {
  previousComparisonUtcRange,
  resolveFrontendAnalyticsPeriod,
} from "@/lib/analyticsPeriodClient";
import { useOwnerVenueDashboard } from "../OwnerVenueDashboardContext";


const perkCol = createColumnHelper<{
  perkId: string;
  code: string;
  title: string;
  count: number;
}>();
const dayCountCol = createColumnHelper<{ day: string; count: number }>();
const hourCol = createColumnHelper<{ hour: number; count: number }>();

export function VenueAnalyticsSection() {
  const { t } = useTranslation();
  const {
    venueId,
    getToken,
    isLoaded,
    metaRow,
    canAnalytics,
    accessError,
    setBannerError,
  } = useOwnerVenueDashboard();

  const [days, setDays] = useState(30);
  const [analyticsFromYmd, setAnalyticsFromYmd] = useState("");
  const [analyticsToYmd, setAnalyticsToYmd] = useState("");

  const analyticsQ = useOwnerVenueAnalyticsQuery(
    venueId,
    days,
    getToken,
    Boolean(isLoaded && metaRow && canAnalytics),
    analyticsFromYmd.trim() || undefined,
    analyticsToYmd.trim() || undefined,
  );
  const analyticsComparisonRange = useMemo(() => {
    const cur = resolveFrontendAnalyticsPeriod(
      days,
      analyticsFromYmd.trim() || undefined,
      analyticsToYmd.trim() || undefined,
    );
    return previousComparisonUtcRange(cur.startDay, cur.endDay);
  }, [days, analyticsFromYmd, analyticsToYmd]);

  const analyticsPrevQ = useOwnerVenueAnalyticsQuery(
    venueId,
    days,
    getToken,
    Boolean(isLoaded && metaRow && canAnalytics),
    analyticsComparisonRange.from,
    analyticsComparisonRange.to,
  );
  const geofenceDwellQ = useOwnerVenueGeofenceDwellQuery(
    venueId,
    days,
    getToken,
    Boolean(isLoaded && metaRow && canAnalytics),
    analyticsFromYmd.trim() || undefined,
    analyticsToYmd.trim() || undefined,
  );
  const campaignsQ = useOwnerVenueCampaignsQuery(
    venueId,
    getToken,
    Boolean(isLoaded && metaRow && canAnalytics),
  );

  const analytics = analyticsQ.data ?? null;

  const hourSeriesForCharts = useMemo(() => {
    if (!analytics) return null;
    return analytics.analyticsTimeZone && analytics.redemptions.byHourVenue
      ? analytics.redemptions.byHourVenue
      : analytics.redemptions.byHourUtc;
  }, [analytics]);

  const perkRows = useMemo(() => analytics?.redemptions.perPerk ?? [], [analytics]);
  const redeemDayRows = useMemo(
    () => analytics?.redemptions.byDay.filter((r) => r.count > 0) ?? [],
    [analytics],
  );
  const visitDayRows = useMemo(
    () => analytics?.visits.byDay.filter((r) => r.count > 0) ?? [],
    [analytics],
  );
  const hourUtcRows = useMemo(
    () => analytics?.redemptions.byHourUtc.filter((h) => h.count > 0) ?? [],
    [analytics],
  );
  const hourVenueRows = useMemo(
    () => analytics?.redemptions.byHourVenue?.filter((h) => h.count > 0) ?? [],
    [analytics],
  );

  const perkColumns = useMemo(
    () => [
      perkCol.display({
        id: "p",
        header: t("admin.partnerVenueDetail.analytics.perPerk"),
        cell: ({ row }) => (
          <span>
            {row.original.title}{" "}
            <span className="text-slate-500 text-xs">({row.original.code})</span>
          </span>
        ),
      }),
      perkCol.accessor("issuedCount", {
        header: t("admin.partnerVenueDetail.analytics.issuedCount"),
        cell: (c) => <span>{c.getValue()}</span>,
      }),
      perkCol.accessor("fulfilledCount", {
        header: t("admin.partnerVenueDetail.analytics.fulfilledCount"),
        cell: (c) => <span>{c.getValue()}</span>,
      }),
    ],
    [t],
  );

  const perkTable = useReactTable({
    data: perkRows,
    columns: perkColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (r) => r.perkId,
  });

  const dayCountColumns = useMemo(
    () => [
      dayCountCol.accessor("day", {
        header: t("admin.partnerVenueDetail.analytics.dayUtc"),
        cell: (c) => <span className="font-mono text-slate-800">{c.getValue()}</span>,
      }),
      dayCountCol.accessor("count", { header: t("admin.partnerVenueDetail.analytics.count") }),
    ],
    [t],
  );

  const redeemDayTable = useReactTable({
    data: redeemDayRows,
    columns: dayCountColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (r) => r.day,
  });

  const visitDayTable = useReactTable({
    data: visitDayRows,
    columns: dayCountColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (r) => r.day,
  });

  const hourColumns = useMemo(
    () => [
      hourCol.display({
        id: "h",
        header: t("admin.partnerVenueDetail.analytics.hour"),
        cell: ({ row }) => (
          <span>
            {String(row.original.hour).padStart(2, "0")}:00 — {row.original.count}
          </span>
        ),
      }),
    ],
    [t],
  );

  const hourUtcTable = useReactTable({
    data: hourUtcRows,
    columns: hourColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (r) => String(r.hour),
  });

  const hourVenueTable = useReactTable({
    data: hourVenueRows,
    columns: hourColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (r) => String(r.hour),
  });

  const venueAnalyticsQs = () =>
    ownerAnalyticsQueryString(
      days,
      analyticsFromYmd.trim() || undefined,
      analyticsToYmd.trim() || undefined,
    );

  const downloadCsv = async () => {
    setBannerError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error(t("admin.partnerVenueDetail.common.signInRequired"));
      const res = await ownerFetch(
        getToken,
        `/owner/venues/${venueId}/analytics/export.csv?${venueAnalyticsQs()}`,
        { method: "GET" },
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
      setBannerError(
        e instanceof Error ? e.message : t("admin.partnerVenueDetail.common.csvDownloadFailed"),
      );
    }
  };

  const downloadFunnelCsv = async () => {
    setBannerError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error(t("admin.partnerVenueDetail.common.signInRequired"));
      const res = await ownerFetch(
        getToken,
        `/owner/venues/${venueId}/analytics/funnel-export.csv?${venueAnalyticsQs()}`,
        { method: "GET" },
      );
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `funnel-events-${venueId.slice(0, 8)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setBannerError(
        e instanceof Error ? e.message : t("admin.partnerVenueDetail.common.csvDownloadFailed"),
      );
    }
  };

  const downloadGeofenceCsv = async () => {
    setBannerError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error(t("admin.partnerVenueDetail.common.signInRequired"));
      const res = await ownerFetch(
        getToken,
        `/owner/venues/${venueId}/analytics/geofence-events.csv?${venueAnalyticsQs()}`,
        { method: "GET" },
      );
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `geofence-events-${venueId.slice(0, 8)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setBannerError(
        e instanceof Error ? e.message : t("admin.partnerVenueDetail.common.csvDownloadFailed"),
      );
    }
  };

  const showAnalyticsPending = canAnalytics && metaRow && analyticsQ.isLoading;

  if (!metaRow) return null;

  return (
    <section>
                {showAnalyticsPending ? (
                  <p className="text-slate-600 text-sm mb-4">
                    {t("admin.partnerVenueDetail.common.loadingAnalytics")}
                  </p>
                ) : null}
                {analytics && !accessError && (
                  <>
                    <div className="flex flex-col gap-4 mb-4">
                      <h2 className="text-lg font-medium">
                        {t("admin.partnerVenueDetail.analytics.title")}
                      </h2>
                      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-3">
                        <button
                          type="button"
                          onClick={() => void downloadCsv()}
                          className="text-sm bg-emerald-50 border border-emerald-300 text-emerald-900 px-3 py-2 rounded-lg hover:bg-emerald-100 w-full sm:w-auto"
                        >
                          {t("admin.partnerVenueDetail.analytics.redemptionsCsv")}
                        </button>
                        <button
                          type="button"
                          onClick={() => void downloadFunnelCsv()}
                          className="text-sm bg-emerald-50 border border-emerald-300 text-emerald-900 px-3 py-2 rounded-lg hover:bg-emerald-100 w-full sm:w-auto"
                        >
                          {t("admin.partnerVenueDetail.analytics.funnelCsv")}
                        </button>
                        <button
                          type="button"
                          onClick={() => void downloadGeofenceCsv()}
                          className="text-sm bg-indigo-50 border border-indigo-300 text-indigo-900 px-3 py-2 rounded-lg hover:bg-indigo-100 w-full sm:w-auto"
                        >
                          {t("admin.partnerVenueDetail.analytics.geofenceCsv")}
                        </button>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3">
                        <label className="text-sm text-slate-600 flex flex-col sm:flex-row sm:items-center gap-1.5 w-full sm:w-auto">
                          {t("admin.partnerVenueDetail.analytics.periodDays")}
                          <select
                            value={days}
                            onChange={(e) => setDays(Number(e.target.value))}
                            className="sm:ml-2 bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-slate-900 w-full sm:w-auto"
                          >
                            {[7, 14, 30, 60, 90].map((d) => (
                              <option key={d} value={d}>
                                {d}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="text-sm text-slate-600 flex flex-col sm:flex-row sm:items-center gap-1.5 w-full sm:w-auto">
                          {t("admin.partnerVenueDetail.common.from")}
                          <input
                            type="date"
                            value={analyticsFromYmd}
                            onChange={(e) => setAnalyticsFromYmd(e.target.value)}
                            className="sm:ml-2 bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-slate-900 w-full sm:w-auto"
                          />
                        </label>
                        <label className="text-sm text-slate-600 flex flex-col sm:flex-row sm:items-center gap-1.5 w-full sm:w-auto">
                          {t("admin.partnerVenueDetail.common.to")}
                          <input
                            type="date"
                            value={analyticsToYmd}
                            onChange={(e) => setAnalyticsToYmd(e.target.value)}
                            className="sm:ml-2 bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-slate-900 w-full sm:w-auto"
                          />
                        </label>
                        <button
                          type="button"
                          className="text-xs text-slate-500 hover:underline self-start"
                          onClick={() => {
                            setAnalyticsFromYmd("");
                            setAnalyticsToYmd("");
                          }}
                        >
                          {t("admin.partnerVenueDetail.common.clearRange")}
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 mb-2">
                      {t("admin.partnerVenueDetail.analytics.rangeHint")}
                    </p>
                    <p className="text-xs text-slate-500 mb-4">
                      {t("admin.partnerVenueDetail.analytics.utcRange", {
                        start: analytics.period.startDay,
                        end: analytics.period.endDay,
                      })}
                      {analytics.analyticsTimeZone
                        ? t("admin.partnerVenueDetail.analytics.venueTz", {
                            tz: analytics.analyticsTimeZone,
                          })
                        : ""}
                    </p>
                    <OwnerAnalyticsRoiSnapshot
                      current={analytics}
                      previous={analyticsPrevQ.data}
                      previousLoading={analyticsPrevQ.isLoading}
                      campaigns={campaignsQ.data ?? []}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-sm text-slate-600">
                          {t("admin.partnerVenueDetail.analytics.activeRedemptions")}
                        </p>
                        <p className="text-2xl font-semibold mt-1">{analytics.redemptions.issued}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {t("admin.partnerVenueDetail.analytics.voided", {
                            count: analytics.redemptions.voided,
                          })}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-sm text-slate-600">
                          {t("admin.partnerVenueDetail.analytics.fulfilledRedemptions")}
                        </p>
                        <p className="text-2xl font-semibold mt-1">
                          {analytics.redemptions.fulfilled}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-sm text-slate-600">
                          {t("admin.partnerVenueDetail.analytics.offerClaimsPending")}
                        </p>
                        <p className="text-2xl font-semibold mt-1">
                          {analytics.offerClaims?.pending ?? 0}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {t("admin.partnerVenueDetail.analytics.offerClaimsFulfilled", {
                            count: analytics.offerClaims?.fulfilled ?? 0,
                          })}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-sm text-slate-600">
                          {t("admin.partnerVenueDetail.analytics.uniqueVisitors")}
                        </p>
                        <p className="text-2xl font-semibold mt-1">
                          {analytics.visits.uniquePlayers}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-sm text-slate-600">
                          {t("admin.partnerVenueDetail.analytics.repeatVisitors")}
                        </p>
                        <p className="text-2xl font-semibold mt-1">
                          {analytics.visits.loyalty.repeatVisitPlayers}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {t("admin.partnerVenueDetail.analytics.repeatVisitorsHint", {
                            percent: analytics.visits.loyalty.shareRepeatVisitorsPercent,
                          })}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-sm text-slate-600">
                          {t("admin.partnerVenueDetail.analytics.avgVisitDaysPerPlayer")}
                        </p>
                        <p className="text-2xl font-semibold mt-1">
                          {analytics.visits.loyalty.avgVisitDaysPerPlayer}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-sm text-slate-600">
                          {t("admin.partnerVenueDetail.analytics.funnel")}
                        </p>
                        <p className="text-lg font-semibold mt-1">
                          {t("admin.partnerVenueDetail.analytics.funnelRedeemers", {
                            redeemers: analytics.funnel.uniqueRedeemers,
                            visitors: analytics.funnel.uniqueVisitors,
                          })}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {t("admin.partnerVenueDetail.analytics.funnelVisitorsRedeemed", {
                            percent: analytics.funnel.visitToRedeemPercent,
                          })}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-sm text-slate-600">
                          {t("admin.partnerVenueDetail.analytics.feedEvents")}
                        </p>
                        <p className="text-2xl font-semibold mt-1">{analytics.feedEvents.total}</p>
                      </div>
                    </div>
    
                    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
                      <h3 className="text-sm font-semibold text-slate-800 mb-3">
                        {t("admin.partnerVenueDetail.analytics.funnelJourneyTitle")}
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-slate-500">
                            {t("admin.partnerVenueDetail.analytics.detectImpressions")}
                          </p>
                          <p className="text-lg font-semibold text-slate-900">
                            {analytics.funnelJourney.detectImpressions}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">
                            {t("admin.partnerVenueDetail.analytics.uniqueEntered")}
                          </p>
                          <p className="text-lg font-semibold text-slate-900">
                            {analytics.funnelJourney.uniqueEntered}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">
                            {t("admin.partnerVenueDetail.analytics.uniquePlayed")}
                          </p>
                          <p className="text-lg font-semibold text-slate-900">
                            {analytics.funnelJourney.uniquePlayed}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">
                            {t("admin.partnerVenueDetail.analytics.uniqueRedeemed")}
                          </p>
                          <p className="text-lg font-semibold text-slate-900">
                            {analytics.funnelJourney.uniqueRedeemed}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 mt-3">
                        {t("admin.partnerVenueDetail.analytics.funnelJourneyRates", {
                          enterToPlay: analytics.funnelJourney.enterToPlayPercent,
                          playToRedeem: analytics.funnelJourney.playToRedeemPercent,
                          enteredToRedeem: analytics.funnelJourney.enteredToRedeemPercent,
                        })}
                      </p>
                    </div>
    
                    <OwnerAttributionSnapshot attribution={analytics.attribution} />
    
                    {geofenceDwellQ.data ? (
                      <div className="mb-6 rounded-xl border border-indigo-200 bg-indigo-50/50 p-4">
                        <h3 className="text-sm font-semibold text-slate-800 mb-2">
                          {t("admin.partnerVenueDetail.analytics.geofenceTitle")}
                        </h3>
                        <p className="text-xs text-slate-600 mb-3">
                          {t("admin.partnerVenueDetail.analytics.geofenceLead")}
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                          <div>
                            <p className="text-xs text-slate-500">
                              {t("admin.partnerVenueDetail.analytics.geofenceEnterExitEvents")}
                            </p>
                            <p className="text-lg font-semibold text-slate-900">
                              {geofenceDwellQ.data.geofenceEnterEvents} /{" "}
                              {geofenceDwellQ.data.geofenceExitEvents}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">
                              {t("admin.partnerVenueDetail.analytics.geofencePlayersWithEvent")}
                            </p>
                            <p className="text-lg font-semibold text-slate-900">
                              {geofenceDwellQ.data.uniquePlayersWithGeofenceEvent}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">
                              {t("admin.partnerVenueDetail.analytics.geofenceCompletedSessions")}
                            </p>
                            <p className="text-lg font-semibold text-slate-900">
                              {geofenceDwellQ.data.completedVisitSessions}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">
                              {t("admin.partnerVenueDetail.analytics.geofenceOpenAtPeriodEnd")}
                            </p>
                            <p className="text-lg font-semibold text-slate-900">
                              {geofenceDwellQ.data.openSessionsAtPeriodEnd}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-slate-600 mt-3">
                          {t("admin.partnerVenueDetail.analytics.geofenceAvgDwell")}{" "}
                          <strong>{geofenceDwellQ.data.avgDwellSecondsCompletedSessions}s</strong>
                          {geofenceDwellQ.data.medianDwellSecondsCompleted != null
                            ? t("admin.partnerVenueDetail.analytics.geofenceMedianDwell", {
                                seconds: geofenceDwellQ.data.medianDwellSecondsCompleted,
                              })
                            : null}
                          {t("admin.partnerVenueDetail.analytics.geofenceCalendarRows", {
                            count: geofenceDwellQ.data.calendarVisitDayRows,
                          })}
                        </p>
                      </div>
                    ) : geofenceDwellQ.isLoading ? (
                      <p className="text-xs text-slate-500 mb-4">
                        {t("admin.partnerVenueDetail.common.loadingGeofenceDwell")}
                      </p>
                    ) : null}
    
                    <OwnerAnalyticsCharts
                      visitsByDay={analytics.visits.byDay}
                      redemptionsByDay={analytics.redemptions.byDay}
                      byHour={hourSeriesForCharts}
                    />
    
                    <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div>
                        <h3 className="text-sm font-medium text-slate-800 mb-2">
                          {t("admin.partnerVenueDetail.analytics.perPerk")}
                        </h3>
                        <PerkCountCards rows={perkRows} />
                        <div className="hidden md:block max-h-48 overflow-auto rounded-lg border border-slate-200">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-100 sticky top-0 text-slate-600">
                              {perkTable.getHeaderGroups().map((hg) => (
                                <tr key={hg.id}>
                                  {hg.headers.map((h) => (
                                    <th key={h.id} className="p-2 text-left">
                                      {flexRender(h.column.columnDef.header, h.getContext())}
                                    </th>
                                  ))}
                                </tr>
                              ))}
                            </thead>
                            <tbody>
                              {perkTable.getRowModel().rows.map((row) => (
                                <tr key={row.id} className="border-t border-slate-200">
                                  {row.getVisibleCells().map((cell) => (
                                    <td key={cell.id} className="p-2">
                                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-slate-800 mb-2">
                          {t("admin.partnerVenueDetail.analytics.redemptionsByHourUtc")}
                        </h3>
                        <HourCountCards rows={hourUtcRows} />
                        <div className="hidden md:block max-h-48 overflow-auto rounded-lg border border-slate-200 text-xs font-mono p-2 text-slate-600">
                          <table className="w-full">
                            <tbody>
                              {hourUtcTable.getRowModel().rows.map((row) => (
                                <tr key={row.id}>
                                  <td className="py-0.5">
                                    {flexRender(
                                      row.getVisibleCells()[0].column.columnDef.cell,
                                      row.getVisibleCells()[0].getContext(),
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                    {analytics.redemptions.byHourVenue && (
                      <div className="mt-6">
                        <h3 className="text-sm font-medium text-slate-800 mb-2">
                          {t("admin.partnerVenueDetail.analytics.redemptionsByHourVenueTz")}
                        </h3>
                        <HourCountCards rows={hourVenueRows} />
                        <div className="hidden md:block max-h-48 overflow-auto rounded-lg border border-slate-200 text-xs font-mono p-2 text-slate-600">
                          <table className="w-full">
                            <tbody>
                              {hourVenueTable.getRowModel().rows.map((row) => (
                                <tr key={row.id}>
                                  <td className="py-0.5">
                                    {flexRender(
                                      row.getVisibleCells()[0].column.columnDef.cell,
                                      row.getVisibleCells()[0].getContext(),
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div>
                        <h3 className="text-sm font-medium text-slate-800 mb-2">
                          {t("admin.partnerVenueDetail.analytics.redemptionsByDay")}
                        </h3>
                        <DayCountCards rows={redeemDayRows} />
                        <div className="hidden md:block max-h-56 overflow-auto rounded-lg border border-slate-200">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-100 sticky top-0">
                              <tr className="text-left text-slate-500">
                                {redeemDayTable.getHeaderGroups()[0]?.headers.map((h) => (
                                  <th key={h.id} className="p-2 font-medium">
                                    {flexRender(h.column.columnDef.header, h.getContext())}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {redeemDayTable.getRowModel().rows.map((row) => (
                                <tr key={row.id} className="border-t border-slate-200">
                                  {row.getVisibleCells().map((cell) => (
                                    <td key={cell.id} className="p-2">
                                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-slate-800 mb-2">
                          {t("admin.partnerVenueDetail.analytics.visitDaysByDay")}
                        </h3>
                        <DayCountCards rows={visitDayRows} />
                        <div className="hidden md:block max-h-56 overflow-auto rounded-lg border border-slate-200">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-100 sticky top-0">
                              <tr className="text-left text-slate-500">
                                {visitDayTable.getHeaderGroups()[0]?.headers.map((h) => (
                                  <th key={h.id} className="p-2 font-medium">
                                    {flexRender(h.column.columnDef.header, h.getContext())}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {visitDayTable.getRowModel().rows.map((row) => (
                                <tr key={row.id} className="border-t border-slate-200">
                                  {row.getVisibleCells().map((cell) => (
                                    <td key={cell.id} className="p-2">
                                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </section>
  );
}

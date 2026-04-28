"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { OwnerAnalyticsCharts } from "@/components/OwnerAnalyticsCharts";
import {
  type OwnerOrganizationAnalytics,
  type OwnerVenueAnalytics,
  useOwnerOrganizationAnalyticsQuery,
  useOwnerVenueAnalyticsQuery,
  useOwnerVenuesListQuery,
} from "@/lib/queries";

type VenueListRow = {
  role: string;
  venue: {
    id: string;
    name: string;
    organizationId: string | null;
    organization: { name: string } | null;
  };
};

type Scope =
  | { kind: "org"; id: string; label: string }
  | { kind: "venue"; id: string; label: string };

function roleCanAnalytics(role: string): boolean {
  return role === "OWNER" || role === "MANAGER";
}

function buildScopes(rows: VenueListRow[]): Scope[] {
  const scopes: Scope[] = [];
  const seenOrg = new Set<string>();
  for (const r of rows) {
    if (!roleCanAnalytics(r.role)) continue;
    const oid = r.venue.organizationId;
    if (oid && !seenOrg.has(oid)) {
      seenOrg.add(oid);
      scopes.push({
        kind: "org",
        id: oid,
        label: `Roll-up · ${r.venue.organization?.name ?? "Organization"}`,
      });
    }
  }
  for (const r of rows) {
    if (!roleCanAnalytics(r.role)) continue;
    scopes.push({
      kind: "venue",
      id: r.venue.id,
      label: r.venue.name,
    });
  }
  return scopes;
}

const perkOrgCol = createColumnHelper<
  OwnerOrganizationAnalytics["redemptions"]["perPerk"][number]
>();
const perkVenueCol = createColumnHelper<OwnerVenueAnalytics["redemptions"]["perPerk"][number]>();

export function PartnerAnalyticsHub() {
  const { t } = useTranslation();
  const { getToken, isLoaded } = useAuth();
  const searchParams = useSearchParams();
  const listQ = useOwnerVenuesListQuery(getToken, Boolean(isLoaded));
  const [days, setDays] = useState(30);
  const [fromYmd, setFromYmd] = useState("");
  const [toYmd, setToYmd] = useState("");
  const [scopeIdx, setScopeIdx] = useState(0);

  const scopes = useMemo(() => {
    const rows = (listQ.data?.venues ?? []) as VenueListRow[];
    return buildScopes(rows);
  }, [listQ.data?.venues]);

  useEffect(() => {
    if (scopes.length === 0) return;
    const v = searchParams.get("venue");
    const o = searchParams.get("org");
    if (v) {
      const i = scopes.findIndex((s) => s.kind === "venue" && s.id === v);
      if (i >= 0) setScopeIdx(i);
      return;
    }
    if (o) {
      const i = scopes.findIndex((s) => s.kind === "org" && s.id === o);
      if (i >= 0) setScopeIdx(i);
    }
  }, [searchParams, scopes]);

  useEffect(() => {
    if (scopeIdx >= scopes.length) setScopeIdx(0);
  }, [scopeIdx, scopes.length]);

  const scope = scopes[scopeIdx] ?? null;

  const orgQ = useOwnerOrganizationAnalyticsQuery(
    scope?.kind === "org" ? scope.id : undefined,
    days,
    getToken,
    Boolean(isLoaded && scope?.kind === "org"),
    fromYmd.trim() || undefined,
    toYmd.trim() || undefined,
  );

  const venueQ = useOwnerVenueAnalyticsQuery(
    scope?.kind === "venue" ? scope.id : undefined,
    days,
    getToken,
    Boolean(isLoaded && scope?.kind === "venue"),
    fromYmd.trim() || undefined,
    toYmd.trim() || undefined,
  );

  const canAny = scopes.length > 0;
  const loadErr =
    (orgQ.isError && orgQ.error instanceof Error ? orgQ.error.message : null) ??
    (venueQ.isError && venueQ.error instanceof Error ? venueQ.error.message : null);

  const orgAnalytics = orgQ.data ?? null;
  const venueAnalytics = venueQ.data ?? null;

  const hourOrg = useMemo(() => {
    if (!orgAnalytics) return null;
    return orgAnalytics.analyticsTimeZone && orgAnalytics.redemptions.byHourVenue
      ? orgAnalytics.redemptions.byHourVenue
      : orgAnalytics.redemptions.byHourUtc;
  }, [orgAnalytics]);

  const hourVenue = useMemo(() => {
    if (!venueAnalytics) return null;
    return venueAnalytics.analyticsTimeZone && venueAnalytics.redemptions.byHourVenue
      ? venueAnalytics.redemptions.byHourVenue
      : venueAnalytics.redemptions.byHourUtc;
  }, [venueAnalytics]);

  const orgPerkRows = useMemo(
    () => orgAnalytics?.redemptions.perPerk.slice(0, 12) ?? [],
    [orgAnalytics],
  );
  const orgPerkTable = useReactTable({
    data: orgPerkRows,
    columns: useMemo(
      () => [
        perkOrgCol.display({
          id: "perk",
          header: "Perk",
          cell: ({ row }) => (
            <span>
              <span className="font-mono text-brand">{row.original.code}</span>{" "}
              <span className="text-slate-800">{row.original.title}</span>
            </span>
          ),
        }),
        perkOrgCol.accessor("count", {
          header: "Count",
          cell: (c) => <span className="text-slate-600">{c.getValue()}</span>,
        }),
      ],
      [],
    ),
    getCoreRowModel: getCoreRowModel(),
    getRowId: (r) => r.perkId,
  });

  const venuePerkRows = useMemo(
    () => venueAnalytics?.redemptions.perPerk.slice(0, 12) ?? [],
    [venueAnalytics],
  );
  const venuePerkTable = useReactTable({
    data: venuePerkRows,
    columns: useMemo(
      () => [
        perkVenueCol.display({
          id: "perk",
          header: "Perk",
          cell: ({ row }) => (
            <span>
              <span className="font-mono text-brand">{row.original.code}</span>{" "}
              <span className="text-slate-800">{row.original.title}</span>
            </span>
          ),
        }),
        perkVenueCol.accessor("count", {
          header: "Count",
          cell: (c) => <span className="text-slate-600">{c.getValue()}</span>,
        }),
      ],
      [],
    ),
    getCoreRowModel: getCoreRowModel(),
    getRowId: (r) => r.perkId,
  });

  if (!isLoaded || listQ.isPending) {
    return <p className="text-slate-600 text-sm p-6">{t("common.loading")}</p>;
  }

  if (!canAny) {
    return (
      <div className="max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          {t("admin.partnerAnalytics.noAccessTitle")}
        </h2>
        <p className="text-sm text-slate-600 mt-2 leading-relaxed">
          {t("admin.partnerAnalytics.noAccessBody")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <label className="block text-sm text-slate-700 min-w-[min(100%,16rem)]">
          <span className="font-medium text-slate-800">{t("admin.partnerAnalytics.scopeLabel")}</span>
          <select
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
            value={scopeIdx}
            onChange={(e) => setScopeIdx(Number(e.target.value))}
          >
            {scopes.map((s, i) => (
              <option key={`${s.kind}-${s.id}`} value={i}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-600">
          {t("admin.partnerAnalytics.periodDays")}
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="ml-2 bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-slate-900"
          >
            {[7, 14, 30, 60, 90].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-600">
          {t("admin.partnerAnalytics.from")}
          <input
            type="date"
            value={fromYmd}
            onChange={(e) => setFromYmd(e.target.value)}
            className="ml-2 bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-slate-900"
          />
        </label>
        <label className="text-sm text-slate-600">
          {t("admin.partnerAnalytics.to")}
          <input
            type="date"
            value={toYmd}
            onChange={(e) => setToYmd(e.target.value)}
            className="ml-2 bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-slate-900"
          />
        </label>
        <button
          type="button"
          className="text-xs text-slate-500 hover:underline pb-1"
          onClick={() => {
            setFromYmd("");
            setToYmd("");
          }}
        >
          {t("admin.partnerAnalytics.clearRange")}
        </button>
      </div>
      <p className="text-xs text-slate-500">{t("admin.partnerAnalytics.rangeHint")}</p>

      {scope?.kind === "venue" ? (
        <p className="text-sm">
          <Link href={`/owner/venues/${scope.id}`} className="text-brand font-medium hover:underline">
            {t("admin.partnerAnalytics.openVenueDashboard")}
          </Link>
        </p>
      ) : null}

      {loadErr ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {loadErr}
        </div>
      ) : null}

      {scope?.kind === "org" && orgAnalytics && orgAnalytics.venueCount > 0 ? (
        <>
          <p className="text-xs text-slate-500">
            {orgAnalytics.period.startDay} → {orgAnalytics.period.endDay}
            {orgAnalytics.analyticsTimeZone
              ? ` · ${t("admin.partnerAnalytics.sampleTz")}: ${orgAnalytics.analyticsTimeZone}`
              : ""}
          </p>
          <p className="text-sm text-slate-600">
            {t("admin.partnerAnalytics.rollingVenues", { count: orgAnalytics.venueCount })}:{" "}
            {orgAnalytics.venues.map((v) => v.name).join(" · ")}
          </p>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">
              {t("admin.partnerAnalytics.funnelJourneyTitle")}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-xs text-slate-500">{t("admin.partnerAnalytics.detectImp")}</p>
                <p className="text-lg font-semibold text-slate-900">
                  {orgAnalytics.funnelJourney.detectImpressions}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">{t("admin.partnerAnalytics.uniqueEntered")}</p>
                <p className="text-lg font-semibold text-slate-900">
                  {orgAnalytics.funnelJourney.uniqueEntered}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">{t("admin.partnerAnalytics.uniquePlayed")}</p>
                <p className="text-lg font-semibold text-slate-900">
                  {orgAnalytics.funnelJourney.uniquePlayed}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">{t("admin.partnerAnalytics.uniqueRedeemed")}</p>
                <p className="text-lg font-semibold text-slate-900">
                  {orgAnalytics.funnelJourney.uniqueRedeemed}
                </p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <p className="text-xs text-slate-500">{t("admin.partnerAnalytics.uniquePlayersOrg")}</p>
              <p className="text-xl font-semibold text-slate-900">{orgAnalytics.visits.uniquePlayers}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <p className="text-xs text-slate-500">{t("admin.partnerAnalytics.redemptions")}</p>
              <p className="text-xl font-semibold text-slate-900">{orgAnalytics.redemptions.total}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <p className="text-xs text-slate-500">{t("admin.partnerAnalytics.visitRedeemPct")}</p>
              <p className="text-xl font-semibold text-slate-900">
                {orgAnalytics.funnel.visitToRedeemPercent}%
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <p className="text-xs text-slate-500">{t("admin.partnerAnalytics.playerDays")}</p>
              <p className="text-xl font-semibold text-slate-900">
                {orgAnalytics.visits.uniquePlayerDays}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <p className="text-xs text-slate-500">{t("admin.partnerAnalytics.repeatVisitors")}</p>
              <p className="text-xl font-semibold text-slate-900">
                {orgAnalytics.visits.loyalty.repeatVisitPlayers}
              </p>
            </div>
          </div>
          <OwnerAnalyticsCharts
            title={t("admin.partnerAnalytics.orgTrendsTitle")}
            visitsByDay={orgAnalytics.visits.byDay}
            redemptionsByDay={orgAnalytics.redemptions.byDay}
            byHour={hourOrg}
          />
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            <table className="min-w-full text-sm">
              <thead>
                {orgPerkTable.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} className="bg-slate-50 border-b border-slate-200">
                    {hg.headers.map((h) => (
                      <th
                        key={h.id}
                        className="text-left px-3 py-2 text-xs font-semibold text-slate-600"
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {orgPerkTable.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 last:border-0">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-2">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {scope?.kind === "org" && orgAnalytics && orgAnalytics.venueCount === 0 ? (
        <p className="text-slate-600 text-sm">{t("admin.partnerAnalytics.noVenuesInOrg")}</p>
      ) : null}

      {scope?.kind === "venue" && venueAnalytics ? (
        <>
          <p className="text-xs text-slate-500">
            {venueAnalytics.period.startDay} → {venueAnalytics.period.endDay}
            {venueAnalytics.analyticsTimeZone
              ? ` · ${t("admin.partnerAnalytics.venueTz")}: ${venueAnalytics.analyticsTimeZone}`
              : ""}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-600">{t("admin.partnerAnalytics.activeRedemptions")}</p>
              <p className="text-2xl font-semibold mt-1">{venueAnalytics.redemptions.total}</p>
              <p className="text-xs text-slate-500 mt-1">
                {t("admin.partnerAnalytics.voided")}: {venueAnalytics.redemptions.voided}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-600">{t("admin.partnerAnalytics.uniqueVisitors")}</p>
              <p className="text-2xl font-semibold mt-1">{venueAnalytics.visits.uniquePlayers}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-600">{t("admin.partnerAnalytics.funnel")}</p>
              <p className="text-lg font-semibold mt-1">
                {venueAnalytics.funnel.uniqueRedeemers} / {venueAnalytics.funnel.uniqueVisitors}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                ≈ {venueAnalytics.funnel.visitToRedeemPercent}%{" "}
                {t("admin.partnerAnalytics.visitorsRedeemed")}
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">
              {t("admin.partnerAnalytics.funnelJourneyTitle")}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-xs text-slate-500">{t("admin.partnerAnalytics.detectImp")}</p>
                <p className="text-lg font-semibold text-slate-900">
                  {venueAnalytics.funnelJourney.detectImpressions}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">{t("admin.partnerAnalytics.uniqueEntered")}</p>
                <p className="text-lg font-semibold text-slate-900">
                  {venueAnalytics.funnelJourney.uniqueEntered}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">{t("admin.partnerAnalytics.uniquePlayed")}</p>
                <p className="text-lg font-semibold text-slate-900">
                  {venueAnalytics.funnelJourney.uniquePlayed}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">{t("admin.partnerAnalytics.uniqueRedeemed")}</p>
                <p className="text-lg font-semibold text-slate-900">
                  {venueAnalytics.funnelJourney.uniqueRedeemed}
                </p>
              </div>
            </div>
          </div>
          <OwnerAnalyticsCharts
            title={t("admin.partnerAnalytics.venueTrendsTitle")}
            visitsByDay={venueAnalytics.visits.byDay}
            redemptionsByDay={venueAnalytics.redemptions.byDay}
            byHour={hourVenue}
          />
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            <table className="min-w-full text-sm">
              <thead>
                {venuePerkTable.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} className="bg-slate-50 border-b border-slate-200">
                    {hg.headers.map((h) => (
                      <th
                        key={h.id}
                        className="text-left px-3 py-2 text-xs font-semibold text-slate-600"
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {venuePerkTable.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 last:border-0">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-2">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {scope?.kind === "org" && orgQ.isLoading ? (
        <p className="text-slate-600 text-sm">{t("admin.partnerAnalytics.loading")}</p>
      ) : null}
      {scope?.kind === "venue" && venueQ.isLoading ? (
        <p className="text-slate-600 text-sm">{t("admin.partnerAnalytics.loading")}</p>
      ) : null}
    </div>
  );
}

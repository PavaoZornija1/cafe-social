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
import { OwnerAttributionSnapshot } from "@/components/OwnerAttributionSnapshot";
import { PerkCountCards } from "@/components/TableRowCards";
import {
  PortalAlert,
  PortalCard,
  PortalSkeleton,
  PortalStatCard,
  portalInputClass,
  portalLabelClass,
  portalSelectClass,
} from "@/components/portal/PortalPageUi";
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

function buildScopes(
  rows: VenueListRow[],
  rollupLabel: (orgName: string) => string,
): Scope[] {
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
        label: rollupLabel(r.venue.organization?.name ?? ""),
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
    return buildScopes(rows, (orgName) =>
      t("admin.partnerAnalytics.rollupScope", {
        name: orgName || t("admin.partnerVenues.organizationFallback"),
      }),
    );
  }, [listQ.data?.venues, t]);

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
          header: () => t("admin.partnerOrgRollup.columns.perk"),
          cell: ({ row }) => (
            <span>
              <span className="font-mono text-brand">{row.original.code}</span>{" "}
              <span className="text-slate-800">{row.original.title}</span>
            </span>
          ),
        }),
        perkOrgCol.accessor("count", {
          header: () => t("admin.partnerOrgRollup.columns.count"),
          cell: (c) => <span className="text-slate-600">{c.getValue()}</span>,
        }),
      ],
      [t],
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
          header: () => t("admin.partnerOrgRollup.columns.perk"),
          cell: ({ row }) => (
            <span>
              <span className="font-mono text-brand">{row.original.code}</span>{" "}
              <span className="text-slate-800">{row.original.title}</span>
            </span>
          ),
        }),
        perkVenueCol.accessor("count", {
          header: () => t("admin.partnerOrgRollup.columns.count"),
          cell: (c) => <span className="text-slate-600">{c.getValue()}</span>,
        }),
      ],
      [t],
    ),
    getCoreRowModel: getCoreRowModel(),
    getRowId: (r) => r.perkId,
  });

  if (!isLoaded || listQ.isPending) {
    return <PortalSkeleton rows={2} />;
  }

  if (!canAny) {
    return (
      <PortalCard>
        <h2 className="text-lg font-semibold text-slate-900">
          {t("admin.partnerAnalytics.noAccessTitle")}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          {t("admin.partnerAnalytics.noAccessBody")}
        </p>
      </PortalCard>
    );
  }

  return (
    <div className="space-y-6">
      <PortalCard className="border-slate-200/70 bg-gradient-to-br from-white via-white to-brand-lighter/30">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex min-w-0 flex-col gap-1.5 lg:col-span-2">
            <span className={portalLabelClass}>{t("admin.partnerAnalytics.scopeLabel")}</span>
            <select
              className={portalSelectClass}
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
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className={portalLabelClass}>{t("admin.partnerAnalytics.periodDays")}</span>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className={portalSelectClass}
            >
              {[7, 14, 30, 60, 90].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="button"
              className="text-xs font-medium text-brand-muted transition-colors hover:text-brand"
              onClick={() => {
                setFromYmd("");
                setToYmd("");
              }}
            >
              {t("admin.partnerAnalytics.clearRange")}
            </button>
          </div>
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className={portalLabelClass}>{t("admin.partnerAnalytics.from")}</span>
            <input
              type="date"
              value={fromYmd}
              onChange={(e) => setFromYmd(e.target.value)}
              className={portalInputClass}
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className={portalLabelClass}>{t("admin.partnerAnalytics.to")}</span>
            <input
              type="date"
              value={toYmd}
              onChange={(e) => setToYmd(e.target.value)}
              className={portalInputClass}
            />
          </label>
        </div>
        <p className="mt-3 text-xs text-slate-500">{t("admin.partnerAnalytics.rangeHint")}</p>
      </PortalCard>

      {scope?.kind === "venue" ? (
        <p className="text-sm">
          <Link
            href={`/owner/venues/${scope.id}/analytics`}
            className="font-medium text-brand hover:text-brand-hover"
          >
            {t("admin.partnerAnalytics.openVenueDashboard")}
          </Link>
        </p>
      ) : null}

      {loadErr ? (
        <PortalAlert tone="error">{loadErr}</PortalAlert>
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
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-portal-card">
            <h3 className="mb-4 text-sm font-semibold text-slate-900">
              {t("admin.partnerAnalytics.funnelJourneyTitle")}
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <PortalStatCard
                label={t("admin.partnerAnalytics.detectImp")}
                value={orgAnalytics.funnelJourney.detectImpressions}
                className="shadow-none"
              />
              <PortalStatCard
                label={t("admin.partnerAnalytics.uniqueEntered")}
                value={orgAnalytics.funnelJourney.uniqueEntered}
                className="shadow-none"
              />
              <PortalStatCard
                label={t("admin.partnerAnalytics.uniquePlayed")}
                value={orgAnalytics.funnelJourney.uniquePlayed}
                className="shadow-none"
              />
              <PortalStatCard
                label={t("admin.partnerAnalytics.uniqueRedeemed")}
                value={orgAnalytics.funnelJourney.uniqueRedeemed}
                className="shadow-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <PortalStatCard
              label={t("admin.partnerAnalytics.uniquePlayersOrg")}
              value={orgAnalytics.visits.uniquePlayers}
            />
            <PortalStatCard
              label={t("admin.partnerAnalytics.redemptionsIssued")}
              value={orgAnalytics.redemptions.issued}
            />
            <PortalStatCard
              label={t("admin.partnerAnalytics.redemptionsFulfilled")}
              value={orgAnalytics.redemptions.fulfilled}
            />
            <PortalStatCard
              label={t("admin.partnerAnalytics.visitRedeemPct")}
              value={`${orgAnalytics.funnel.visitToRedeemPercent}%`}
            />
            <PortalStatCard
              label={t("admin.partnerAnalytics.playerDays")}
              value={orgAnalytics.visits.uniquePlayerDays}
            />
            <PortalStatCard
              label={t("admin.partnerAnalytics.repeatVisitors")}
              value={orgAnalytics.visits.loyalty.repeatVisitPlayers}
            />
          </div>
          <OwnerAttributionSnapshot attribution={orgAnalytics.attribution} />
          <OwnerAnalyticsCharts
            title={t("admin.partnerAnalytics.orgTrendsTitle")}
            visitsByDay={orgAnalytics.visits.byDay}
            redemptionsByDay={orgAnalytics.redemptions.byDay}
            byHour={hourOrg}
          />
          <PerkCountCards rows={orgPerkRows} />
          <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-portal-card">
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <PortalStatCard
              label={t("admin.partnerAnalytics.activeRedemptions")}
              value={venueAnalytics.redemptions.issued}
              hint={`${t("admin.partnerAnalytics.voided")}: ${venueAnalytics.redemptions.voided}`}
            />
            <PortalStatCard
              label={t("admin.partnerAnalytics.redemptionsFulfilled")}
              value={venueAnalytics.redemptions.fulfilled}
            />
            <PortalStatCard
              label={t("admin.partnerAnalytics.uniqueVisitors")}
              value={venueAnalytics.visits.uniquePlayers}
            />
            <PortalStatCard
              label={t("admin.partnerAnalytics.funnel")}
              value={`${venueAnalytics.funnel.uniqueRedeemers} / ${venueAnalytics.funnel.uniqueVisitors}`}
              hint={`≈ ${venueAnalytics.funnel.visitToRedeemPercent}% ${t("admin.partnerAnalytics.visitorsRedeemed")}`}
            />
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-portal-card">
            <h3 className="mb-4 text-sm font-semibold text-slate-900">
              {t("admin.partnerAnalytics.funnelJourneyTitle")}
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <PortalStatCard
                label={t("admin.partnerAnalytics.detectImp")}
                value={venueAnalytics.funnelJourney.detectImpressions}
                className="shadow-none"
              />
              <PortalStatCard
                label={t("admin.partnerAnalytics.uniqueEntered")}
                value={venueAnalytics.funnelJourney.uniqueEntered}
                className="shadow-none"
              />
              <PortalStatCard
                label={t("admin.partnerAnalytics.uniquePlayed")}
                value={venueAnalytics.funnelJourney.uniquePlayed}
                className="shadow-none"
              />
              <PortalStatCard
                label={t("admin.partnerAnalytics.uniqueRedeemed")}
                value={venueAnalytics.funnelJourney.uniqueRedeemed}
                className="shadow-none"
              />
            </div>
          </div>
          <OwnerAttributionSnapshot attribution={venueAnalytics.attribution} />
          <OwnerAnalyticsCharts
            title={t("admin.partnerAnalytics.venueTrendsTitle")}
            visitsByDay={venueAnalytics.visits.byDay}
            redemptionsByDay={venueAnalytics.redemptions.byDay}
            byHour={hourVenue}
          />
          <PerkCountCards rows={venuePerkRows} />
          <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-portal-card">
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

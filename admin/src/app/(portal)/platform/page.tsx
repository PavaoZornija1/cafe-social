"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useTranslation } from "react-i18next";
import { usePlatformMetrics } from "@/lib/queries/usePlatformMetrics";

function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: "default" | "amber" | "rose";
}) {
  const border =
    tone === "amber"
      ? "border-amber-200/90 bg-amber-50/80"
      : tone === "rose"
        ? "border-rose-200/90 bg-rose-50/80"
        : "border-slate-200/90 bg-white";
  return (
    <div className={`rounded-2xl border px-4 py-4 shadow-sm ${border}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-900">{value}</p>
      {hint ? <p className="mt-2 text-xs text-slate-600 leading-snug">{hint}</p> : null}
    </div>
  );
}

function LayoutPanel({
  title,
  orgCount,
  venueCount,
  lockedCount,
  pastDueOrgs,
  canceledBillingOrgs,
}: {
  title: string;
  orgCount: number;
  venueCount: number;
  lockedCount: number;
  pastDueOrgs: number;
  canceledBillingOrgs: number;
}) {
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white px-4 py-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-slate-600">{t("admin.platform.layoutOrganizations")}</dt>
          <dd className="tabular-nums font-medium text-slate-900">{orgCount}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-600">{t("admin.platform.layoutVenues")}</dt>
          <dd className="tabular-nums font-medium text-slate-900">{venueCount}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-600">{t("admin.platform.layoutLockedVenues")}</dt>
          <dd className="tabular-nums font-medium text-slate-900">{lockedCount}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-600">{t("admin.platform.layoutPastDueOrgs")}</dt>
          <dd
            className={`tabular-nums font-medium ${
              pastDueOrgs > 0 ? "text-amber-800" : "text-slate-900"
            }`}
          >
            {pastDueOrgs}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-600">{t("admin.platform.layoutCanceledOrgs")}</dt>
          <dd
            className={`tabular-nums font-medium ${
              canceledBillingOrgs > 0 ? "text-rose-800" : "text-slate-900"
            }`}
          >
            {canceledBillingOrgs}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export default function PlatformDashboardPage() {
  const { isLoaded, getToken } = useAuth();
  const { t } = useTranslation();
  const q = usePlatformMetrics(getToken, isLoaded);

  return (
    <div className="bg-slate-50 text-slate-900 min-h-full p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">{t("admin.platform.title")}</h1>
        <p className="text-sm text-slate-600 mt-2 max-w-2xl leading-relaxed">
          {t("admin.platform.lead")}{" "}
          <Link href="/organizations" className="text-brand font-medium hover:underline">
            {t("admin.platform.leadOrgs")}
          </Link>{" "}
          {t("admin.platform.leadMid")}{" "}
          <Link href="/venues" className="text-brand font-medium hover:underline">
            {t("admin.platform.leadVenues")}
          </Link>{" "}
          {t("admin.platform.leadTail")}{" "}
          <strong className="text-slate-800">{t("admin.platform.leadStrong")}</strong>{" "}
          {t("admin.platform.leadEnd")}
        </p>
        <p className="text-sm text-slate-500 mt-3 max-w-2xl leading-relaxed">
          {t("admin.platform.layoutExplainer")}
        </p>
      </div>

      {q.isError ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {q.error instanceof Error ? q.error.message : t("admin.platform.loadError")}
        </div>
      ) : null}

      {q.isLoading ? (
        <p className="text-slate-600">{t("admin.platform.loading")}</p>
      ) : q.data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label={t("admin.platform.metricOrgs")}
              value={q.data.organizationCount}
              hint={t("admin.platform.metricOrgsHint")}
            />
            <StatCard
              label={t("admin.platform.metricVenues")}
              value={q.data.venueCount}
              hint={t("admin.platform.metricVenuesHint")}
            />
            <StatCard
              label={t("admin.platform.metricLocked")}
              value={q.data.lockedVenueCount}
              hint={t("admin.platform.metricLockedHint")}
            />
            <StatCard
              label={t("admin.platform.metricPastDue")}
              value={q.data.pastDueOrUnpaidOrgCount}
              hint={t("admin.platform.metricPastDueHint")}
              tone={q.data.pastDueOrUnpaidOrgCount > 0 ? "amber" : "default"}
            />
            <StatCard
              label={t("admin.platform.metricCanceled")}
              value={q.data.canceledBillingOrgCount}
              hint={t("admin.platform.metricCanceledHint")}
              tone={q.data.canceledBillingOrgCount > 0 ? "rose" : "default"}
            />
            <StatCard
              label={t("admin.platform.metricVenuesNoOrg")}
              value={q.data.venuesWithoutOrganization}
              hint={t("admin.platform.metricVenuesNoOrgHint")}
              tone={q.data.venuesWithoutOrganization > 0 ? "amber" : "default"}
            />
          </div>

          <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide mt-10 mb-3">
            {t("admin.platform.sectionByLayout")}
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <LayoutPanel
              title={t("admin.platform.panelSingleTitle")}
              orgCount={q.data.singleLocationOrganizationCount}
              venueCount={q.data.venuesInSingleLocationOrganizations}
              lockedCount={q.data.lockedVenuesInSingleLocationOrganizations}
              pastDueOrgs={q.data.pastDueOrUnpaidSingleLocationOrgCount}
              canceledBillingOrgs={q.data.canceledBillingSingleLocationOrgCount}
            />
            <LayoutPanel
              title={t("admin.platform.panelMultiTitle")}
              orgCount={q.data.multiLocationOrganizationCount}
              venueCount={q.data.venuesInMultiLocationOrganizations}
              lockedCount={q.data.lockedVenuesInMultiLocationOrganizations}
              pastDueOrgs={q.data.pastDueOrUnpaidMultiLocationOrgCount}
              canceledBillingOrgs={q.data.canceledBillingMultiLocationOrgCount}
            />
          </div>
          <p className="mt-4 text-xs text-slate-500 leading-relaxed max-w-3xl">
            {t("admin.platform.layoutFootnote")}
          </p>
        </>
      ) : null}
    </div>
  );
}

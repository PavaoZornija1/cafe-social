"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useTranslation } from "react-i18next";
import {
  PortalAlert,
  PortalCard,
  PortalPageHeader,
  PortalPageLayout,
  PortalSkeleton,
  PortalStatCard,
} from "@/components/portal/PortalPageUi";
import { usePlatformMetrics } from "@/lib/queries/usePlatformMetrics";

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
    <PortalCard>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <dl className="mt-4 space-y-2.5 text-sm">
        {[
          { label: t("admin.platform.layoutOrganizations"), value: orgCount },
          { label: t("admin.platform.layoutVenues"), value: venueCount },
          { label: t("admin.platform.layoutLockedVenues"), value: lockedCount },
          {
            label: t("admin.platform.layoutPastDueOrgs"),
            value: pastDueOrgs,
            warn: pastDueOrgs > 0,
          },
          {
            label: t("admin.platform.layoutCanceledOrgs"),
            value: canceledBillingOrgs,
            danger: canceledBillingOrgs > 0,
          },
        ].map((row) => (
          <div key={row.label} className="flex justify-between gap-4 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
            <dt className="text-slate-600">{row.label}</dt>
            <dd
              className={`tabular-nums font-medium ${
                row.danger ? "text-rose-800" : row.warn ? "text-amber-800" : "text-slate-900"
              }`}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </PortalCard>
  );
}

export default function PlatformDashboardPage() {
  const { isLoaded, getToken } = useAuth();
  const { t } = useTranslation();
  const q = usePlatformMetrics(getToken, isLoaded);

  return (
    <PortalPageLayout>
      <PortalPageHeader
        title={t("admin.platform.title")}
        lead={
          <>
            {t("admin.platform.lead")}{" "}
            <Link href="/organizations" className="font-medium text-brand hover:text-brand-hover">
              {t("admin.platform.leadOrgs")}
            </Link>{" "}
            {t("admin.platform.leadMid")}{" "}
            <Link href="/venues" className="font-medium text-brand hover:text-brand-hover">
              {t("admin.platform.leadVenues")}
            </Link>{" "}
            {t("admin.platform.leadTail")}{" "}
            <strong className="text-slate-800">{t("admin.platform.leadStrong")}</strong>{" "}
            {t("admin.platform.leadEnd")}
            <span className="mt-2 block text-slate-500">{t("admin.platform.layoutExplainer")}</span>
          </>
        }
      />

      {q.isError ? (
        <PortalAlert tone="error" className="mb-6">
          {q.error instanceof Error ? q.error.message : t("admin.platform.loadError")}
        </PortalAlert>
      ) : null}

      {q.isLoading ? (
        <PortalSkeleton rows={3} />
      ) : q.data ? (
        <div className="space-y-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <PortalStatCard
              label={t("admin.platform.metricOrgs")}
              value={q.data.organizationCount}
              hint={t("admin.platform.metricOrgsHint")}
            />
            <PortalStatCard
              label={t("admin.platform.metricVenues")}
              value={q.data.venueCount}
              hint={t("admin.platform.metricVenuesHint")}
            />
            <PortalStatCard
              label={t("admin.platform.metricLocked")}
              value={q.data.lockedVenueCount}
              hint={t("admin.platform.metricLockedHint")}
            />
            <PortalStatCard
              label={t("admin.platform.metricPastDue")}
              value={q.data.pastDueOrUnpaidOrgCount}
              hint={t("admin.platform.metricPastDueHint")}
              className={
                q.data.pastDueOrUnpaidOrgCount > 0
                  ? "border-amber-200/80 bg-gradient-to-br from-amber-50/60 to-white"
                  : undefined
              }
            />
            <PortalStatCard
              label={t("admin.platform.metricCanceled")}
              value={q.data.canceledBillingOrgCount}
              hint={t("admin.platform.metricCanceledHint")}
              className={
                q.data.canceledBillingOrgCount > 0
                  ? "border-rose-200/80 bg-gradient-to-br from-rose-50/60 to-white"
                  : undefined
              }
            />
            <PortalStatCard
              label={t("admin.platform.metricVenuesNoOrg")}
              value={q.data.venuesWithoutOrganization}
              hint={t("admin.platform.metricVenuesNoOrgHint")}
              className={
                q.data.venuesWithoutOrganization > 0
                  ? "border-amber-200/80 bg-gradient-to-br from-amber-50/60 to-white"
                  : undefined
              }
            />
          </div>

          <div>
            <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
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
            <p className="mt-4 max-w-3xl text-xs leading-relaxed text-slate-500">
              {t("admin.platform.layoutFootnote")}
            </p>
          </div>
        </div>
      ) : null}
    </PortalPageLayout>
  );
}

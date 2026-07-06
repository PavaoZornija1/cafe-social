"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { PartnerReadOnlyBanner } from "@/components/PartnerReadOnlyBanner";
import { partnerBillingStatusLabel } from "@/lib/partnerBillingLabels";
import { useOwnerVenueDashboard } from "./OwnerVenueDashboardContext";
import {
  BuildingIcon,
  ChevronLeftIcon,
  CreditCardIcon,
  ExternalLinkIcon,
  VenueAlert,
  VenueDashboardCard,
  VenueRoleBadge,
} from "./venueDashboardUi";

function ShellSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-hidden>
      <div className="h-36 rounded-2xl bg-slate-200/70" />
      <div className="h-12 rounded-2xl bg-slate-200/50" />
      <div className="h-48 rounded-2xl bg-slate-200/40" />
    </div>
  );
}

export function OwnerVenueDashboardShell({
  nav,
  children,
}: {
  nav?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const {
    venueId,
    role,
    title,
    isOwner,
    organizationRollupId,
    orgBilling,
    hidePartnerFinancialUi,
    shellLoading,
    listErr,
    accessError,
    bannerError,
    readOnlyNotice,
  } = useOwnerVenueDashboard();

  const trialExpired =
    orgBilling?.trialEndsAt &&
    orgBilling.platformBillingStatus !== "ACTIVE" &&
    orgBilling.platformBillingStatus !== "ACTIVE_CANCELING" &&
    new Date(orgBilling.trialEndsAt).getTime() <= Date.now();

  const trialActive =
    orgBilling?.trialEndsAt &&
    orgBilling.platformBillingStatus !== "ACTIVE" &&
    orgBilling.platformBillingStatus !== "ACTIVE_CANCELING" &&
    !trialExpired;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-6 lg:py-8">
      <VenueDashboardCard className="relative mb-6 overflow-hidden border-slate-200/70 p-0">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-br from-brand/[0.08] via-brand-lighter/50 to-transparent"
          aria-hidden
        />
        <div className="relative px-5 py-5 sm:px-6 sm:py-6">
          <Link
            href="/owner/venues"
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-muted transition-colors hover:text-brand"
          >
            <ChevronLeftIcon className="h-4 w-4" />
            {t("admin.partnerVenueDetail.header.allVenues")}
          </Link>

          <div className="mt-4 flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-[1.65rem]">
                  {title}
                </h1>
                {role ? (
                  <VenueRoleBadge
                    role={role}
                    label={t(`admin.partnerVenueDetail.roles.${role}`)}
                  />
                ) : null}
              </div>

              {role === "EMPLOYEE" ? (
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
                  {t("admin.partnerVenueDetail.header.staffLeadBeforeLink")}{" "}
                  <Link
                    href={`/staff/${venueId}`}
                    className="font-medium text-emerald-700 underline decoration-emerald-300 underline-offset-2 hover:text-emerald-800"
                  >
                    {t("admin.partnerVenueDetail.header.todayList")}
                  </Link>{" "}
                  {t("admin.partnerVenueDetail.header.staffLeadAfterLink")}
                </p>
              ) : null}
              {role === "MANAGER" ? (
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
                  {t("admin.partnerVenueDetail.header.managerLead")}
                </p>
              ) : null}
              {isOwner ? (
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
                  {t("admin.partnerVenueDetail.header.ownerLead")}
                </p>
              ) : null}
            </div>
          </div>

          {organizationRollupId ? (
            <div className="mt-4">
              <Link
                href={`/owner/organizations/${organizationRollupId}`}
                className="inline-flex items-center gap-2 rounded-xl border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-sm font-medium text-amber-900 transition-colors hover:border-amber-300 hover:bg-amber-50"
              >
                <BuildingIcon className="h-4 w-4 shrink-0" />
                {t("admin.partnerVenueDetail.header.organizationRollupLink")}
              </Link>
            </div>
          ) : null}

          {isOwner && orgBilling && !hidePartnerFinancialUi ? (
            <div className="mt-4 rounded-xl border border-slate-200/80 bg-slate-50/80 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                  <CreditCardIcon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  {orgBilling.billingPortalUrl ? (
                    <p className="text-sm">
                      <a
                        href={orgBilling.billingPortalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 font-medium text-brand hover:text-brand-hover"
                      >
                        {t("admin.partnerVenueDetail.header.subscriptionBillingPortal")}
                        <ExternalLinkIcon className="h-3.5 w-3.5" />
                      </a>
                      <span className="mt-1 block text-slate-500 sm:mt-0 sm:ml-2 sm:inline">
                        {orgBilling.platformBillingPlan ??
                          t("admin.partnerVenueDetail.header.billingPlanFallback")}{" "}
                        · {partnerBillingStatusLabel(t, orgBilling.platformBillingStatus)}
                        {orgBilling.platformBillingRenewsAt
                          ? t("admin.partnerVenueDetail.header.billingRenews", {
                              date: orgBilling.platformBillingRenewsAt.slice(0, 10),
                            })
                          : ""}
                        {orgBilling.platformBillingStatus === "ACTIVE_CANCELING"
                          ? t("admin.partnerVenueDetail.header.billingEndsAtPeriodEnd")
                          : ""}
                        {orgBilling.platformBillingStatus === "CANCELED"
                          ? t("admin.partnerVenueDetail.header.billingCanceledSupport")
                          : ""}
                      </span>
                    </p>
                  ) : (
                    <p className="text-sm text-slate-500">
                      {t("admin.partnerVenueDetail.header.billingPortalMissing")}
                    </p>
                  )}
                  <p className="text-xs leading-relaxed text-slate-600">
                    <strong className="font-semibold text-slate-800">
                      {t("admin.partnerVenueDetail.header.commercialClarityTitle")}
                    </strong>{" "}
                    {t("admin.partnerVenueDetail.header.commercialClarityBody")}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </VenueDashboardCard>

      {shellLoading ? <ShellSkeleton /> : null}

      {!shellLoading && (listErr || accessError || bannerError) ? (
        <VenueAlert tone="error" className="mb-5">
          {listErr ?? accessError ?? bannerError}
        </VenueAlert>
      ) : null}

      {!shellLoading && readOnlyNotice ? (
        <div className="mb-5">
          <PartnerReadOnlyBanner notice={readOnlyNotice} />
        </div>
      ) : null}

      {!shellLoading && trialExpired ? (
        <VenueAlert tone="error" className="mb-5">
          {t("admin.partnerVenueDetail.header.trialExpiredBanner")}
        </VenueAlert>
      ) : null}

      {!shellLoading && trialActive ? (
        <VenueAlert tone="warning" className="mb-5">
          {t("admin.partnerVenueDetail.header.trialActiveBanner", {
            date: orgBilling!.trialEndsAt!.slice(0, 10),
          })}
        </VenueAlert>
      ) : null}

      {!shellLoading ? (
        <>
          {nav}
          <div className="min-w-0 space-y-6 sm:space-y-8">{children}</div>
        </>
      ) : null}
    </div>
  );
}

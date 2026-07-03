"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { useTranslation } from "react-i18next";
import { PartnerReadOnlyBanner } from "@/components/PartnerReadOnlyBanner";
import { partnerBillingStatusLabel } from "@/lib/partnerBillingLabels";
import { useOwnerVenueDashboard } from "./OwnerVenueDashboardContext";

export function OwnerVenueDashboardShell({ children }: { children: ReactNode }) {
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Link href="/owner/venues" className="text-sm text-brand hover:text-brand">
            {t("admin.partnerVenueDetail.header.allVenues")}
          </Link>
          <h1 className="text-xl font-semibold mt-2">
            {title}
            {role ? (
              <span className="ml-3 text-xs font-mono uppercase tracking-wide text-brand align-middle">
                {role ? t(`admin.partnerVenueDetail.roles.${role}`) : null}
              </span>
            ) : null}
          </h1>
          {role === "EMPLOYEE" ? (
            <p className="text-sm text-slate-500 mt-1 max-w-xl">
              {t("admin.partnerVenueDetail.header.staffLeadBeforeLink")}{" "}
              <Link href={`/staff/${venueId}`} className="text-emerald-700 hover:underline">
                {t("admin.partnerVenueDetail.header.todayList")}
              </Link>{" "}
              {t("admin.partnerVenueDetail.header.staffLeadAfterLink")}
            </p>
          ) : null}
          {role === "MANAGER" ? (
            <p className="text-sm text-slate-500 mt-1 max-w-xl">
              {t("admin.partnerVenueDetail.header.managerLead")}
            </p>
          ) : null}
          {isOwner ? (
            <p className="text-sm text-slate-500 mt-1 max-w-xl">
              {t("admin.partnerVenueDetail.header.ownerLead")}
            </p>
          ) : null}
          {organizationRollupId ? (
            <p className="text-sm mt-2">
              <Link
                href={`/owner/organizations/${organizationRollupId}`}
                className="text-amber-700 hover:underline"
              >
                {t("admin.partnerVenueDetail.header.organizationRollupLink")}
              </Link>
            </p>
          ) : null}
          {isOwner && orgBilling && !hidePartnerFinancialUi ? (
            <>
              {orgBilling.billingPortalUrl ? (
                <p className="text-sm mt-2">
                  <a
                    href={orgBilling.billingPortalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-700 hover:underline"
                  >
                    {t("admin.partnerVenueDetail.header.subscriptionBillingPortal")}
                  </a>
                  <span className="text-slate-500 ml-2">
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
                <p className="text-sm mt-2 text-slate-500">
                  {t("admin.partnerVenueDetail.header.billingPortalMissing")}
                </p>
              )}
              <p className="text-xs text-slate-600 max-w-2xl mt-2 leading-relaxed">
                <strong>{t("admin.partnerVenueDetail.header.commercialClarityTitle")}</strong>{" "}
                {t("admin.partnerVenueDetail.header.commercialClarityBody")}
              </p>
            </>
          ) : null}
        </div>
        <div className="hidden lg:block shrink-0">
          <UserButton />
        </div>
      </header>

      <main className="p-4 sm:p-6 max-w-4xl mx-auto space-y-8 sm:space-y-10 w-full min-w-0">
        {shellLoading ? (
          <p className="text-slate-600">{t("admin.partnerVenueDetail.common.loading")}</p>
        ) : null}
        {(listErr || accessError || bannerError) && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm">
            {listErr ?? accessError ?? bannerError}
          </div>
        )}
        {readOnlyNotice ? <PartnerReadOnlyBanner notice={readOnlyNotice} /> : null}
        {orgBilling?.trialEndsAt &&
        orgBilling.platformBillingStatus !== "ACTIVE" &&
        orgBilling.platformBillingStatus !== "ACTIVE_CANCELING" ? (
          <div
            className={
              new Date(orgBilling.trialEndsAt).getTime() <= Date.now()
                ? "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
                : "rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
            }
          >
            {new Date(orgBilling.trialEndsAt).getTime() <= Date.now()
              ? t("admin.partnerVenueDetail.header.trialExpiredBanner")
              : t("admin.partnerVenueDetail.header.trialActiveBanner", {
                  date: orgBilling.trialEndsAt.slice(0, 10),
                })}
          </div>
        ) : null}
        {children}
      </main>
    </div>
  );
}

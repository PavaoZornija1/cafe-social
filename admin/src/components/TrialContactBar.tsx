"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { isPartnerOrgBillingActive } from "@/lib/partnerBillingStatus";

type OrgLike = {
  trialEndsAt: string | null;
  platformBillingStatus: string;
  name: string;
} | null;

export function TrialContactBar({
  organizations,
}: {
  organizations: OrgLike[];
}) {
  const { t } = useTranslation();

  const nonPayingWithTrial = organizations.filter(
    (o) =>
      o &&
      o.trialEndsAt &&
      !isPartnerOrgBillingActive(o.platformBillingStatus),
  ) as NonNullable<OrgLike>[];

  if (nonPayingWithTrial.length === 0) return null;

  const now = Date.now();
  const endedTrialOrgs = nonPayingWithTrial.filter(
    (o) => new Date(o.trialEndsAt!).getTime() <= now,
  );
  const activeTrialOrgs = nonPayingWithTrial.filter(
    (o) => new Date(o.trialEndsAt!).getTime() > now,
  );

  const cta = (
    <Link
      href="/owner/subscriptions"
      className="shrink-0 inline-flex items-center justify-center rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-brand-foreground shadow-md shadow-brand/25 transition hover:bg-brand-hover hover:shadow-lg hover:shadow-brand/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      {t("admin.trialBar.manageSubscription")}
    </Link>
  );

  if (endedTrialOrgs.length > 0) {
    return (
      <div className="border-b border-amber-200/90 bg-gradient-to-r from-amber-50 via-amber-50/95 to-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-3.5">
          <p className="text-sm font-medium text-amber-950 leading-snug max-w-3xl">
            {t("admin.trialBar.trialEndedLead")}
            {endedTrialOrgs.length === 1 ? ` (${endedTrialOrgs[0]!.name})` : ""}.{" "}
            {t("admin.trialBar.trialEndedTail")}
          </p>
          {cta}
        </div>
      </div>
    );
  }

  const end = activeTrialOrgs[0]!.trialEndsAt
    ? new Date(activeTrialOrgs[0]!.trialEndsAt)
    : null;
  const daysLeft =
    end != null
      ? Math.max(
          0,
          Math.ceil((end.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
        )
      : null;

  return (
    <div className="border-b border-brand-light/80 bg-gradient-to-r from-brand-light/95 via-brand-light/80 to-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-3.5">
        <p className="text-sm font-medium text-slate-800 leading-snug max-w-3xl">
          {t("admin.trialBar.activeLead")}
          {daysLeft !== null
            ? t("admin.trialBar.daysLeft", { count: daysLeft })
            : ""}
          {activeTrialOrgs.length === 1 ? ` (${activeTrialOrgs[0]!.name})` : ""}.{" "}
          {t("admin.trialBar.activeTail")}
        </p>
        {cta}
      </div>
    </div>
  );
}

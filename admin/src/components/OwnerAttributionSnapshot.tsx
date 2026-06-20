"use client";

import { useTranslation } from "react-i18next";
import type { OwnerVenueAnalytics } from "@/lib/queries";

type Props = {
  attribution: OwnerVenueAnalytics["attribution"];
};

export function OwnerAttributionSnapshot({ attribution }: Props) {
  const { t } = useTranslation();

  const cards = [
    {
      label: t("admin.partnerAnalytics.attribution.proximityNudges"),
      value: attribution.proximityNudges,
      hint: t("admin.partnerAnalytics.attribution.proximityNudgesHint"),
    },
    {
      label: t("admin.partnerAnalytics.attribution.areaRingEnters"),
      value: attribution.areaRingEnters,
      hint: t("admin.partnerAnalytics.attribution.areaRingEntersHint"),
    },
    {
      label: t("admin.partnerAnalytics.attribution.polygonSessions"),
      value: attribution.polygonSessions,
      hint: t("admin.partnerAnalytics.attribution.polygonSessionsHint"),
    },
    {
      label: t("admin.partnerAnalytics.attribution.attributedVisits"),
      value: attribution.attributedVisits,
      hint: t("admin.partnerAnalytics.attribution.attributedVisitsHint"),
    },
    {
      label: t("admin.partnerAnalytics.attribution.billableVisits"),
      value: attribution.billableVisits,
      hint: t("admin.partnerAnalytics.attribution.billableVisitsHint"),
    },
    {
      label: t("admin.partnerAnalytics.attribution.stripeReported"),
      value: attribution.stripeReportedVisits,
      hint: t("admin.partnerAnalytics.attribution.stripeReportedHint"),
    },
  ];

  return (
    <div className="mt-6 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">
          {t("admin.partnerAnalytics.attribution.title")}
        </h3>
        <p className="text-xs text-slate-600 mt-1">
          {t("admin.partnerAnalytics.attribution.lead")}
        </p>
        {attribution.proximityNudges > 0 ? (
          <p className="text-xs text-slate-500 mt-1">
            {t("admin.partnerAnalytics.attribution.nudgeToBillable", {
              percent: attribution.nudgeToBillablePercent,
            })}
          </p>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm"
          >
            <p className="text-xs font-medium text-slate-600">{c.label}</p>
            <p className="text-2xl font-semibold text-slate-900 mt-1">{c.value}</p>
            <p className="text-xs text-slate-500 mt-1">{c.hint}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

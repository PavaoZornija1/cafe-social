"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useTranslation } from "react-i18next";
import { PartnerAnalyticsHub } from "@/components/PartnerAnalyticsHub";

function PartnerAnalyticsPageInner() {
  const { t } = useTranslation();
  return (
    <div className="bg-slate-50 text-slate-900 min-h-full">
      <header className="border-b border-slate-200 px-6 py-4">
        <Link href="/owner/venues" className="text-sm text-brand hover:underline">
          {t("admin.partnerAnalytics.backVenues")}
        </Link>
        <h1 className="text-xl font-semibold mt-2">{t("admin.partnerAnalytics.pageTitle")}</h1>
        <p className="text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
          {t("admin.partnerAnalytics.pageLead")}
        </p>
      </header>
      <main className="p-6 max-w-5xl">
        <PartnerAnalyticsHub />
      </main>
    </div>
  );
}

export default function PartnerAnalyticsPage() {
  const { t } = useTranslation();
  return (
    <Suspense
      fallback={<p className="p-8 text-slate-600 text-sm">{t("common.loading")}</p>}
    >
      <PartnerAnalyticsPageInner />
    </Suspense>
  );
}

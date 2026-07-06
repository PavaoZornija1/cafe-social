"use client";

import { Suspense } from "react";
import { useTranslation } from "react-i18next";
import { PartnerAnalyticsHub } from "@/components/PartnerAnalyticsHub";
import { PortalPageHeader, PortalPageLayout, PortalSkeleton } from "@/components/portal/PortalPageUi";

function PartnerAnalyticsPageInner() {
  const { t } = useTranslation();
  return (
    <PortalPageLayout>
      <PortalPageHeader
        backHref="/owner/venues"
        backLabel={t("admin.partnerAnalytics.backVenues")}
        title={t("admin.partnerAnalytics.pageTitle")}
        lead={t("admin.partnerAnalytics.pageLead")}
      />
      <PartnerAnalyticsHub />
    </PortalPageLayout>
  );
}

export default function PartnerAnalyticsPage() {
  const { t } = useTranslation();
  return (
    <Suspense fallback={<PortalPageLayout maxWidth="6xl"><PortalSkeleton /></PortalPageLayout>}>
      <PartnerAnalyticsPageInner />
    </Suspense>
  );
}

"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { PortalCard, PortalPageLayout, PortalSkeleton } from "@/components/portal/PortalPageUi";
import { usePortalMeQuery } from "@/lib/queries";
import { redirectToPartnersApply } from "@/lib/partnersApplyUrl";

export default function ApplicationPendingPage() {
  const { t } = useTranslation();
  const { isLoaded, getToken } = useAuth();
  const router = useRouter();
  const meQ = usePortalMeQuery(getToken, isLoaded);

  useEffect(() => {
    if (!isLoaded || meQ.isPending) return;
    const me = meQ.data;
    if (!me) {
      router.replace("/sign-in");
      return;
    }
    if (me.platformRole === "SUPER_ADMIN" || (me.venues?.length ?? 0) > 0) {
      router.replace(me.platformRole === "SUPER_ADMIN" ? "/platform" : "/owner/venues");
      return;
    }
    if (me.partnerApplication?.status === "REJECTED") {
      redirectToPartnersApply();
      return;
    }
    if (me.partnerApplication?.status !== "PENDING" && me.needsPartnerOnboarding) {
      redirectToPartnersApply();
    }
  }, [isLoaded, meQ.isPending, meQ.data, router]);

  if (!isLoaded || meQ.isPending) {
    return (
      <PortalPageLayout>
        <PortalSkeleton rows={4} />
      </PortalPageLayout>
    );
  }

  return (
    <PortalPageLayout>
      <div className="mx-auto max-w-lg py-12">
        <PortalCard className="text-center px-6 py-10">
          <h1 className="text-xl font-semibold text-slate-900">
            {t("admin.applicationPending.title")}
          </h1>
          <p className="mt-4 text-sm text-slate-600 leading-relaxed">
            {t("admin.applicationPending.body")}
          </p>
          <p className="mt-6 text-xs text-slate-500">
            {t("admin.applicationPending.hint")}{" "}
            <Link href="/sign-in" className="text-brand hover:underline">
              {t("admin.applicationPending.signInLink")}
            </Link>
          </p>
        </PortalCard>
      </div>
    </PortalPageLayout>
  );
}

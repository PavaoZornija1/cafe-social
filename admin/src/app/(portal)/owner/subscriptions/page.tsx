"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { isPartnerOrgBillingActive } from "@/lib/partnerBillingStatus";
import { partnerBillingStatusLabel } from "@/lib/partnerBillingLabels";
import { partnerHasOwnerAccess } from "@/lib/partnerRoles";
import {
  queryKeys,
  useOwnerOrganizationBillingPortalMutation,
  useOwnerOrganizationCheckoutMutation,
  useOwnerOrganizationPpvCheckoutMutation,
  useOwnerVenuesListQuery,
} from "@/lib/queries";
import {
  PortalAlert,
  PortalBadge,
  PortalCard,
  PortalPageHeader,
  PortalPageLayout,
  PortalSkeleton,
  portalButtonPrimaryClass,
  portalButtonSecondaryClass,
} from "@/components/portal/PortalPageUi";

type VenueRow = {
  role: "EMPLOYEE" | "MANAGER" | "OWNER";
  venue: {
    id: string;
    name: string;
    organizationId: string | null;
    organization: {
      id: string;
      name: string;
      billingPortalUrl: string | null;
      platformBillingPlan: string | null;
      platformBillingModel: string;
      platformBillingStatus: string;
      platformBillingRenewsAt: string | null;
      platformBillingSyncedAt: string | null;
      trialEndsAt: string | null;
    } | null;
  };
};

type OrgCard = {
  id: string;
  name: string;
  billingPortalUrl: string | null;
  platformBillingPlan: string | null;
  platformBillingModel: string;
  platformBillingStatus: string;
  platformBillingRenewsAt: string | null;
  trialEndsAt: string | null;
  venueNames: string[];
  canManageBilling: boolean;
};

function formatShortDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
  } catch {
    return iso;
  }
}

function PartnerSubscriptionsInner() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const { getToken, isLoaded } = useAuth();
  const venuesQ = useOwnerVenuesListQuery(getToken, Boolean(isLoaded));
  const portalMut = useOwnerOrganizationBillingPortalMutation(getToken);
  const checkoutMut = useOwnerOrganizationCheckoutMutation(getToken);
  const ppvCheckoutMut = useOwnerOrganizationPpvCheckoutMutation(getToken);
  const [portalErr, setPortalErr] = useState<string | null>(null);
  const [checkoutOrgId, setCheckoutOrgId] = useState<string | null>(null);
  const [ppvCheckoutOrgId, setPpvCheckoutOrgId] = useState<string | null>(null);
  const publicPriceId = process.env.NEXT_PUBLIC_STRIPE_PARTNER_PRICE_ID?.trim() ?? "";

  const refreshBilling = () => {
    void qc.invalidateQueries({ queryKey: queryKeys.owner.venuesList });
    void qc.invalidateQueries({ queryKey: queryKeys.portal.me });
  };

  const billingFlash = searchParams.get("billing");

  useEffect(() => {
    if (venuesQ.isLoading || venuesQ.isError) return;
    const venues = (venuesQ.data?.venues ?? []) as VenueRow[];
    if (!partnerHasOwnerAccess(venues)) {
      router.replace("/owner/venues");
    }
  }, [venuesQ.data, venuesQ.isError, venuesQ.isLoading, router]);

  useEffect(() => {
    if (billingFlash === "success") {
      void qc.invalidateQueries({ queryKey: queryKeys.owner.venuesList });
      void qc.invalidateQueries({ queryKey: queryKeys.portal.me });
    }
  }, [billingFlash, qc]);

  const orgCards = useMemo((): OrgCard[] => {
    const rows = (venuesQ.data?.venues ?? []) as VenueRow[];
    const m = new Map<string, OrgCard>();
    for (const r of rows) {
      const o = r.venue.organization;
      if (!o) continue;
      const existing = m.get(o.id);
      // Stripe billing mutations are OWNER-only on the API.
      const can = r.role === "OWNER";
      if (!existing) {
        m.set(o.id, {
          id: o.id,
          name: o.name,
          billingPortalUrl: o.billingPortalUrl,
          platformBillingPlan: o.platformBillingPlan,
          platformBillingModel: o.platformBillingModel ?? "SUBSCRIPTION",
          platformBillingStatus: o.platformBillingStatus,
          platformBillingRenewsAt: o.platformBillingRenewsAt,
          trialEndsAt: o.trialEndsAt,
          venueNames: [r.venue.name],
          canManageBilling: can,
        });
      } else {
        if (!existing.venueNames.includes(r.venue.name)) {
          existing.venueNames.push(r.venue.name);
        }
        if (can) existing.canManageBilling = true;
      }
    }
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [venuesQ.data]);

  const openPortal = async (organizationId: string) => {
    setPortalErr(null);
    try {
      const { url } = await portalMut.mutateAsync(organizationId);
      window.location.href = url;
    } catch (e) {
      setPortalErr((e as Error).message);
    }
  };

  const openHostedCheckout = async (organizationId: string) => {
    setPortalErr(null);
    setCheckoutOrgId(organizationId);
    try {
      const { url } = await checkoutMut.mutateAsync({
        organizationId,
        priceId: publicPriceId || undefined,
      });
      window.location.href = url;
    } catch (e) {
      setPortalErr((e as Error).message);
      setCheckoutOrgId(null);
    }
  };

  const openPpvCheckout = async (organizationId: string) => {
    setPortalErr(null);
    setPpvCheckoutOrgId(organizationId);
    try {
      const { url } = await ppvCheckoutMut.mutateAsync(organizationId);
      window.location.href = url;
    } catch (e) {
      setPortalErr((e as Error).message);
      setPpvCheckoutOrgId(null);
    }
  };

  const dismissBillingFlash = () => {
    router.replace("/owner/subscriptions");
  };

  return (
    <PortalPageLayout maxWidth="3xl">
      <PortalPageHeader
        backHref="/owner/venues"
        backLabel={t("admin.partnerSubscriptions.backVenues")}
        title={t("admin.partnerSubscriptions.title")}
        lead={t("admin.partnerSubscriptions.lead")}
      />

      <div className="space-y-5">
        {billingFlash === "success" ? (
          <PortalAlert
            tone="success"
            title={t("admin.partnerSubscriptions.billingSuccess")}
            actions={
              <>
                <button
                  type="button"
                  onClick={refreshBilling}
                  className="text-xs font-semibold text-emerald-900 underline hover:no-underline"
                >
                  {t("admin.partnerSubscriptions.refreshStatus")}
                </button>
                <button
                  type="button"
                  onClick={() => dismissBillingFlash()}
                  className="text-xs font-semibold text-emerald-900 underline hover:no-underline"
                >
                  {t("admin.partnerSubscriptions.dismiss")}
                </button>
              </>
            }
          />
        ) : null}
        {billingFlash === "cancel" ? (
          <PortalAlert
            tone="info"
            actions={
              <button
                type="button"
                onClick={() => dismissBillingFlash()}
                className="text-xs font-semibold text-brand underline hover:no-underline"
              >
                {t("admin.partnerSubscriptions.dismiss")}
              </button>
            }
          >
            {t("admin.partnerSubscriptions.billingCancel")}
          </PortalAlert>
        ) : null}

        {!isLoaded || venuesQ.isPending ? <PortalSkeleton rows={2} /> : null}
        {venuesQ.isError && venuesQ.error instanceof Error ? (
          <PortalAlert tone="error">{venuesQ.error.message}</PortalAlert>
        ) : null}
        {portalErr ? <PortalAlert tone="error">{portalErr}</PortalAlert> : null}

        <PortalCard className="border-brand/15 bg-gradient-to-br from-brand-lighter/40 to-white">
          <h2 className="text-sm font-semibold text-slate-900">
            {t("admin.partnerSubscriptions.sectionHowItWorks")}
          </h2>
          <ol className="mt-3 list-decimal space-y-2 pl-4 text-sm leading-relaxed text-slate-600">
            <li>{t("admin.partnerSubscriptions.stepCheckout")}</li>
            <li>{t("admin.partnerSubscriptions.stepPortal")}</li>
          </ol>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            {t("admin.partnerSubscriptions.stripeExplainer")}
          </p>
        </PortalCard>

        {orgCards.length === 0 && !venuesQ.isPending ? (
          <p className="text-sm text-slate-600">{t("admin.partnerSubscriptions.noOrgs")}</p>
        ) : null}

        {orgCards.map((org) => {
          const billingActive = isPartnerOrgBillingActive(org.platformBillingStatus);
          return (
            <PortalCard key={org.id} className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-slate-900">{org.name}</h2>
                  <details className="mt-1 text-xs text-slate-500">
                    <summary className="cursor-pointer transition-colors hover:text-slate-700">
                      {t("admin.partnerSubscriptions.orgIdLabel")}
                    </summary>
                    <p className="mt-1 break-all font-mono">{org.id}</p>
                  </details>
                  <p className="mt-3 text-sm text-slate-600">
                    {t("admin.partnerSubscriptions.venuesLabel")}: {org.venueNames.join(" · ")}
                  </p>
                </div>
                <PortalBadge tone={billingActive ? "success" : "warning"}>
                  {partnerBillingStatusLabel(t, org.platformBillingStatus)}
                </PortalBadge>
              </div>
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  {
                    label: t("admin.partnerSubscriptions.billingModel"),
                    value:
                      org.platformBillingModel === "PAY_PER_VISIT"
                        ? t("admin.partnerSubscriptions.billingModelPpv")
                        : t("admin.partnerSubscriptions.billingModelSubscription"),
                  },
                  {
                    label: t("admin.partnerSubscriptions.plan"),
                    value: org.platformBillingPlan ?? "—",
                  },
                  {
                    label: t("admin.partnerSubscriptions.trialEnds"),
                    value: formatShortDate(org.trialEndsAt),
                  },
                  {
                    label: t("admin.partnerSubscriptions.renews"),
                    value: formatShortDate(org.platformBillingRenewsAt),
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5"
                  >
                    <dt className="text-xs font-medium text-slate-500">{item.label}</dt>
                    <dd className="mt-0.5 font-medium text-slate-900">{item.value}</dd>
                  </div>
                ))}
              </dl>

              {org.canManageBilling ? (
                <div className="space-y-4 border-t border-slate-100 pt-5">
                  {!billingActive ? (
                    <div className="space-y-4">
                      <p className="text-sm font-semibold text-slate-900">
                        {t("admin.partnerSubscriptions.choosePlanTitle")}
                      </p>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                          <h3 className="text-sm font-semibold text-slate-900">
                            {t("admin.partnerSubscriptions.billingModelSubscription")}
                          </h3>
                          <p className="mt-2 text-xs leading-relaxed text-slate-600">
                            {t("admin.partnerSubscriptions.subscriptionCardBody")}
                          </p>
                          <div className="mt-4 flex flex-col gap-2">
                            <button
                              type="button"
                              disabled={checkoutMut.isPending && checkoutOrgId === org.id}
                              onClick={() => void openHostedCheckout(org.id)}
                              className={portalButtonPrimaryClass}
                            >
                              {checkoutMut.isPending && checkoutOrgId === org.id
                                ? t("admin.partnerSubscriptions.hostedCheckoutBusy")
                                : t("admin.partnerSubscriptions.subscribeHostedCta")}
                            </button>
                            <Link
                              href={`/owner/subscriptions/pay?organizationId=${encodeURIComponent(org.id)}`}
                              className="text-center text-xs font-medium text-brand hover:text-brand-hover"
                            >
                              {t("admin.partnerSubscriptions.subscribeEmbeddedCta")}
                            </Link>
                          </div>
                        </div>
                        <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/70 to-white p-4 shadow-sm">
                          <h3 className="text-sm font-semibold text-emerald-950">
                            {t("admin.partnerSubscriptions.billingModelPpv")}
                          </h3>
                          <p className="mt-2 text-xs leading-relaxed text-emerald-900/90">
                            {t("admin.partnerSubscriptions.ppvCardBody")}
                          </p>
                          <div className="mt-4 flex flex-col gap-2">
                            <button
                              type="button"
                              disabled={ppvCheckoutMut.isPending && ppvCheckoutOrgId === org.id}
                              onClick={() => void openPpvCheckout(org.id)}
                              className="inline-flex justify-center rounded-xl border border-emerald-600 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-900 transition-colors hover:bg-emerald-50 disabled:opacity-50"
                            >
                              {ppvCheckoutMut.isPending && ppvCheckoutOrgId === org.id
                                ? t("admin.partnerSubscriptions.hostedCheckoutBusy")
                                : t("admin.partnerSubscriptions.subscribePpvCta")}
                            </button>
                            <Link
                              href={`/owner/analytics?org=${encodeURIComponent(org.id)}`}
                              className="text-center text-xs font-medium text-emerald-800 hover:text-emerald-900"
                            >
                              {t("admin.partnerSubscriptions.ppvAnalyticsLink")}
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : org.platformBillingModel === "PAY_PER_VISIT" ? (
                    <p className="text-sm text-slate-600">
                      <Link
                        href={`/owner/analytics?org=${encodeURIComponent(org.id)}`}
                        className="font-medium text-emerald-700 hover:text-emerald-800"
                      >
                        {t("admin.partnerSubscriptions.ppvActiveAnalyticsLink")}
                      </Link>
                    </p>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={refreshBilling}
                      className={portalButtonSecondaryClass}
                    >
                      {t("admin.partnerSubscriptions.refreshStatus")}
                    </button>
                    <button
                      type="button"
                      disabled={portalMut.isPending}
                      onClick={() => void openPortal(org.id)}
                      className={billingActive ? portalButtonPrimaryClass : portalButtonSecondaryClass}
                    >
                      {t("admin.partnerSubscriptions.openStripePortal")}
                    </button>
                    {org.billingPortalUrl ? (
                      <a
                        href={org.billingPortalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={portalButtonSecondaryClass}
                      >
                        {t("admin.partnerSubscriptions.savedPortalLink")}
                      </a>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="border-t border-slate-100 pt-5 text-sm text-slate-600">
                  {t("admin.partnerSubscriptions.askOwner")}
                </p>
              )}
            </PortalCard>
          );
        })}
      </div>
    </PortalPageLayout>
  );
}

export default function PartnerSubscriptionsPage() {
  return (
    <Suspense
      fallback={
        <PortalPageLayout maxWidth="3xl">
          <PortalSkeleton />
        </PortalPageLayout>
      }
    >
      <PartnerSubscriptionsInner />
    </Suspense>
  );
}

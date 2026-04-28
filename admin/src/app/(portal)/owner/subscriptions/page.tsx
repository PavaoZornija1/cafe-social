"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { isPartnerOrgBillingActive } from "@/lib/partnerBillingStatus";
import {
  queryKeys,
  useOwnerOrganizationBillingPortalMutation,
  useOwnerOrganizationCheckoutMutation,
  useOwnerVenuesListQuery,
} from "@/lib/queries";

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
  const [portalErr, setPortalErr] = useState<string | null>(null);
  const [checkoutErr, setCheckoutErr] = useState<string | null>(null);

  const billingFlash = searchParams.get("billing");
  const publicPriceId = process.env.NEXT_PUBLIC_STRIPE_PARTNER_PRICE_ID?.trim() ?? "";

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
      const can = r.role === "OWNER" || r.role === "MANAGER";
      if (!existing) {
        m.set(o.id, {
          id: o.id,
          name: o.name,
          billingPortalUrl: o.billingPortalUrl,
          platformBillingPlan: o.platformBillingPlan,
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
    setCheckoutErr(null);
    try {
      const { url } = await portalMut.mutateAsync(organizationId);
      window.location.href = url;
    } catch (e) {
      setPortalErr((e as Error).message);
    }
  };

  const openCheckout = async (organizationId: string) => {
    setPortalErr(null);
    setCheckoutErr(null);
    try {
      const { url } = await checkoutMut.mutateAsync({
        organizationId,
        priceId: publicPriceId || undefined,
      });
      window.location.href = url;
    } catch (e) {
      setCheckoutErr((e as Error).message);
    }
  };

  const dismissBillingFlash = () => {
    router.replace("/owner/subscriptions");
  };

  return (
    <div className="bg-slate-50 text-slate-900 min-h-full">
      <header className="border-b border-slate-200 px-6 py-4">
        <Link href="/owner/venues" className="text-sm text-brand hover:underline">
          {t("admin.partnerSubscriptions.backVenues")}
        </Link>
        <h1 className="text-xl font-semibold mt-2">{t("admin.partnerSubscriptions.title")}</h1>
        <p className="text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
          {t("admin.partnerSubscriptions.lead")}
        </p>
      </header>
      <main className="p-6 max-w-3xl space-y-6">
        {billingFlash === "success" ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-950 flex flex-wrap items-center justify-between gap-3">
            <p className="font-medium">{t("admin.partnerSubscriptions.billingSuccess")}</p>
            <button
              type="button"
              onClick={() => dismissBillingFlash()}
              className="text-xs font-semibold text-emerald-900 underline hover:no-underline"
            >
              {t("admin.partnerSubscriptions.dismiss")}
            </button>
          </div>
        ) : null}
        {billingFlash === "cancel" ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 flex flex-wrap items-center justify-between gap-3">
            <p>{t("admin.partnerSubscriptions.billingCancel")}</p>
            <button
              type="button"
              onClick={() => dismissBillingFlash()}
              className="text-xs font-semibold text-brand underline hover:no-underline"
            >
              {t("admin.partnerSubscriptions.dismiss")}
            </button>
          </div>
        ) : null}

        {!isLoaded || venuesQ.isPending ? (
          <p className="text-slate-600 text-sm">{t("common.loading")}</p>
        ) : null}
        {venuesQ.isError && venuesQ.error instanceof Error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {venuesQ.error.message}
          </div>
        ) : null}
        {portalErr ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {portalErr}
          </div>
        ) : null}
        {checkoutErr ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {checkoutErr}
          </div>
        ) : null}

        <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.04]">
          <h2 className="text-sm font-semibold text-slate-900">
            {t("admin.partnerSubscriptions.sectionHowItWorks")}
          </h2>
          <ol className="mt-3 space-y-2 text-sm text-slate-600 list-decimal list-inside leading-relaxed">
            <li>{t("admin.partnerSubscriptions.stepCheckout")}</li>
            <li>{t("admin.partnerSubscriptions.stepPortal")}</li>
          </ol>
          <p className="text-sm text-slate-600 mt-3 leading-relaxed">
            {t("admin.partnerSubscriptions.stripeExplainer")}
          </p>
        </section>

        {orgCards.length === 0 && !venuesQ.isPending ? (
          <p className="text-slate-600 text-sm">{t("admin.partnerSubscriptions.noOrgs")}</p>
        ) : null}

        {orgCards.map((org) => {
          const billingActive = isPartnerOrgBillingActive(org.platformBillingStatus);
          return (
            <section
              key={org.id}
              className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm ring-1 ring-slate-900/[0.04]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{org.name}</h2>
                  <p className="text-xs text-slate-500 mt-1 font-mono">{org.id}</p>
                  <p className="text-sm text-slate-600 mt-3">
                    {t("admin.partnerSubscriptions.venuesLabel")}: {org.venueNames.join(" · ")}
                  </p>
                </div>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
                  {org.platformBillingStatus}
                </span>
              </div>
              <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-slate-50 px-3 py-2 border border-slate-100">
                  <dt className="text-xs font-medium text-slate-500">
                    {t("admin.partnerSubscriptions.plan")}
                  </dt>
                  <dd className="font-medium text-slate-900 mt-0.5">
                    {org.platformBillingPlan ?? "—"}
                  </dd>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2 border border-slate-100">
                  <dt className="text-xs font-medium text-slate-500">
                    {t("admin.partnerSubscriptions.trialEnds")}
                  </dt>
                  <dd className="font-medium text-slate-900 mt-0.5">
                    {formatShortDate(org.trialEndsAt)}
                  </dd>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2 border border-slate-100">
                  <dt className="text-xs font-medium text-slate-500">
                    {t("admin.partnerSubscriptions.renews")}
                  </dt>
                  <dd className="font-medium text-slate-900 mt-0.5">
                    {formatShortDate(org.platformBillingRenewsAt)}
                  </dd>
                </div>
              </dl>

              {org.canManageBilling ? (
                <div className="mt-5 space-y-3">
                  {!billingActive ? (
                    <div className="rounded-xl border border-brand/25 bg-brand-light/50 px-4 py-3">
                      <p className="text-sm font-semibold text-slate-900">
                        {t("admin.partnerSubscriptions.subscribeTitle")}
                      </p>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        {t("admin.partnerSubscriptions.subscribeHint")}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link
                          href={`/owner/subscriptions/pay?organizationId=${encodeURIComponent(org.id)}`}
                          className="inline-flex rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground shadow-md shadow-brand/25 hover:bg-brand-hover transition-colors"
                        >
                          {t("admin.partnerSubscriptions.subscribeEmbeddedCta")}
                        </Link>
                        <button
                          type="button"
                          disabled={checkoutMut.isPending}
                          onClick={() => void openCheckout(org.id)}
                          className="inline-flex rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                        >
                          {checkoutMut.isPending
                            ? t("common.loading")
                            : t("admin.partnerSubscriptions.subscribeHostedCta")}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-3 items-center">
                    {billingActive ? (
                      <button
                        type="button"
                        disabled={portalMut.isPending}
                        onClick={() => void openPortal(org.id)}
                        className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground shadow-md shadow-brand/20 hover:bg-brand-hover disabled:opacity-50 transition-colors"
                      >
                        {t("admin.partnerSubscriptions.openStripePortal")}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={portalMut.isPending}
                        onClick={() => void openPortal(org.id)}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                      >
                        {t("admin.partnerSubscriptions.openStripePortal")}
                      </button>
                    )}
                    {org.billingPortalUrl ? (
                      <a
                        href={org.billingPortalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 transition-colors"
                      >
                        {t("admin.partnerSubscriptions.savedPortalLink")}
                      </a>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="mt-5 text-sm text-slate-600">{t("admin.partnerSubscriptions.askOwner")}</p>
              )}
            </section>
          );
        })}
      </main>
    </div>
  );
}

export default function PartnerSubscriptionsPage() {
  const { t } = useTranslation();
  return (
    <Suspense
      fallback={<p className="p-8 text-slate-600 text-sm">{t("common.loading")}</p>}
    >
      <PartnerSubscriptionsInner />
    </Suspense>
  );
}

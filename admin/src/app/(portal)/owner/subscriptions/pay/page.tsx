"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useQueryClient } from "@tanstack/react-query";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  PortalAlert,
  PortalCard,
  PortalPageHeader,
  PortalPageLayout,
  PortalSkeleton,
  portalButtonPrimaryClass,
} from "@/components/portal/PortalPageUi";
import {
  queryKeys,
  useOwnerOrganizationElementsSubscriptionSetupQuery,
} from "@/lib/queries";

function PaymentStepForm() {
  const { t } = useTranslation();
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setMessage(null);
    const returnUrl = `${window.location.origin}/owner/subscriptions?billing=success`;
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: returnUrl,
      },
    });
    setBusy(false);
    if (error) {
      setMessage(error.message ?? t("admin.partnerSubscriptionPay.paymentFailed"));
    }
  };

  return (
    <form onSubmit={(ev) => void handleSubmit(ev)} className="space-y-5">
      <PortalCard className="p-4">
        <PaymentElement />
      </PortalCard>
      {message ? <PortalAlert tone="error">{message}</PortalAlert> : null}
      <button
        type="submit"
        disabled={!stripe || !elements || busy}
        className={`w-full sm:w-auto ${portalButtonPrimaryClass}`}
      >
        {busy ? t("common.loading") : t("admin.partnerSubscriptionPay.submit")}
      </button>
    </form>
  );
}

function PartnerSubscriptionPayInner() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const { getToken, isLoaded } = useAuth();
  const organizationId = searchParams.get("organizationId");
  const publicPriceId = process.env.NEXT_PUBLIC_STRIPE_PARTNER_PRICE_ID?.trim() ?? "";

  const setupQ = useOwnerOrganizationElementsSubscriptionSetupQuery(
    getToken,
    organizationId,
    publicPriceId || undefined,
    Boolean(isLoaded && organizationId),
  );

  useEffect(() => {
    const d = setupQ.data;
    if (!d) return;
    if (
      !d.clientSecret &&
      (d.subscriptionStatus === "active" || d.subscriptionStatus === "trialing")
    ) {
      void qc.invalidateQueries({ queryKey: queryKeys.owner.venuesList });
      void qc.invalidateQueries({ queryKey: queryKeys.portal.me });
      router.replace("/owner/subscriptions?billing=success");
    }
  }, [setupQ.data, qc, router]);

  const stripePromise = useMemo(() => {
    if (!setupQ.data?.publishableKey) return null;
    return loadStripe(setupQ.data.publishableKey);
  }, [setupQ.data?.publishableKey]);

  if (!organizationId) {
    return (
      <PortalPageLayout maxWidth="lg">
        <PortalCard>
          <p className="text-slate-800">{t("admin.partnerSubscriptionPay.missingOrg")}</p>
          <Link
            href="/owner/subscriptions"
            className="mt-4 inline-block text-sm font-semibold text-brand hover:text-brand-hover"
          >
            {t("admin.partnerSubscriptionPay.back")}
          </Link>
        </PortalCard>
      </PortalPageLayout>
    );
  }

  if (!isLoaded || setupQ.isPending) {
    return (
      <PortalPageLayout maxWidth="lg">
        <PortalSkeleton rows={2} />
      </PortalPageLayout>
    );
  }

  if (setupQ.isError) {
    return (
      <PortalPageLayout maxWidth="lg">
        <PortalAlert tone="error">
          {setupQ.error instanceof Error
            ? setupQ.error.message
            : t("admin.partnerSubscriptionPay.loadError")}
        </PortalAlert>
        <Link
          href="/owner/subscriptions"
          className="mt-4 inline-block text-sm font-semibold text-brand hover:text-brand-hover"
        >
          {t("admin.partnerSubscriptionPay.back")}
        </Link>
      </PortalPageLayout>
    );
  }

  const data = setupQ.data;
  if (!data) {
    return null;
  }

  if (!data.clientSecret) {
    if (data.subscriptionStatus === "active" || data.subscriptionStatus === "trialing") {
      return (
        <PortalPageLayout maxWidth="lg">
          <p className="text-sm text-slate-600">{t("admin.partnerSubscriptionPay.noPaymentStep")}</p>
        </PortalPageLayout>
      );
    }
    return (
      <PortalPageLayout maxWidth="lg">
        <PortalCard>
          <p className="text-sm text-slate-800">{t("admin.partnerSubscriptionPay.unexpectedNoSecret")}</p>
          <Link
            href="/owner/subscriptions"
            className="mt-4 inline-block text-sm font-semibold text-brand hover:text-brand-hover"
          >
            {t("admin.partnerSubscriptionPay.back")}
          </Link>
        </PortalCard>
      </PortalPageLayout>
    );
  }

  if (!stripePromise) {
    return null;
  }

  return (
    <PortalPageLayout maxWidth="lg">
      <PortalPageHeader
        backHref="/owner/subscriptions"
        backLabel={t("admin.partnerSubscriptionPay.back")}
        title={t("admin.partnerSubscriptionPay.title")}
        lead={t("admin.partnerSubscriptionPay.lead")}
      />
      <Elements
        stripe={stripePromise}
        options={{
          clientSecret: data.clientSecret,
          appearance: {
            theme: "stripe",
            variables: {
              colorPrimary: "#143368",
              borderRadius: "12px",
            },
          },
        }}
      >
        <PaymentStepForm />
      </Elements>
    </PortalPageLayout>
  );
}

export default function PartnerSubscriptionPayPage() {
  return (
    <Suspense
      fallback={
        <PortalPageLayout maxWidth="lg">
          <PortalSkeleton />
        </PortalPageLayout>
      }
    >
      <PartnerSubscriptionPayInner />
    </Suspense>
  );
}

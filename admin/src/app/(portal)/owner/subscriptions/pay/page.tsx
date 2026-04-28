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
      setMessage(error.message ?? "Payment failed");
    }
  };

  return (
    <form onSubmit={(ev) => void handleSubmit(ev)} className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <PaymentElement />
      </div>
      {message ? <p className="text-sm text-red-700">{message}</p> : null}
      <button
        type="submit"
        disabled={!stripe || !elements || busy}
        className="w-full sm:w-auto rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground shadow-md shadow-brand/25 hover:bg-brand-hover disabled:opacity-50 transition-colors"
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
      <div className="bg-slate-50 min-h-full p-6 max-w-lg">
        <p className="text-slate-800">{t("admin.partnerSubscriptionPay.missingOrg")}</p>
        <Link href="/owner/subscriptions" className="mt-4 inline-block text-sm font-semibold text-brand hover:underline">
          {t("admin.partnerSubscriptionPay.back")}
        </Link>
      </div>
    );
  }

  if (!isLoaded || setupQ.isPending) {
    return (
      <div className="bg-slate-50 min-h-full p-8">
        <p className="text-slate-600 text-sm">{t("admin.partnerSubscriptionPay.loading")}</p>
      </div>
    );
  }

  if (setupQ.isError) {
    return (
      <div className="bg-slate-50 min-h-full p-6 max-w-lg space-y-4">
        <p className="text-red-800 text-sm">
          {setupQ.error instanceof Error ? setupQ.error.message : t("admin.partnerSubscriptionPay.loadError")}
        </p>
        <Link href="/owner/subscriptions" className="inline-block text-sm font-semibold text-brand hover:underline">
          {t("admin.partnerSubscriptionPay.back")}
        </Link>
      </div>
    );
  }

  const data = setupQ.data;
  if (!data) {
    return null;
  }

  if (!data.clientSecret) {
    if (data.subscriptionStatus === "active" || data.subscriptionStatus === "trialing") {
      return (
        <div className="bg-slate-50 min-h-full p-8">
          <p className="text-slate-600 text-sm">{t("admin.partnerSubscriptionPay.noPaymentStep")}</p>
        </div>
      );
    }
    return (
      <div className="bg-slate-50 min-h-full p-6 max-w-lg space-y-4">
        <p className="text-slate-800 text-sm">{t("admin.partnerSubscriptionPay.unexpectedNoSecret")}</p>
        <Link href="/owner/subscriptions" className="inline-block text-sm font-semibold text-brand hover:underline">
          {t("admin.partnerSubscriptionPay.back")}
        </Link>
      </div>
    );
  }

  if (!stripePromise) {
    return null;
  }

  return (
    <div className="bg-slate-50 text-slate-900 min-h-full">
      <header className="border-b border-slate-200 px-6 py-4">
        <Link href="/owner/subscriptions" className="text-sm text-brand hover:underline">
          {t("admin.partnerSubscriptionPay.back")}
        </Link>
        <h1 className="text-xl font-semibold mt-2">{t("admin.partnerSubscriptionPay.title")}</h1>
        <p className="text-sm text-slate-600 mt-1 max-w-xl leading-relaxed">{t("admin.partnerSubscriptionPay.lead")}</p>
      </header>
      <main className="p-6 max-w-lg">
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
      </main>
    </div>
  );
}

export default function PartnerSubscriptionPayPage() {
  const { t } = useTranslation();
  return (
    <Suspense
      fallback={
        <div className="bg-slate-50 min-h-full p-8">
          <p className="text-slate-600 text-sm">{t("common.loading")}</p>
        </div>
      }
    >
      <PartnerSubscriptionPayInner />
    </Suspense>
  );
}

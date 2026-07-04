import type { Metadata } from "next";
import { LegalPageShell } from "@/components/legal/LegalPageShell";
import { legalConfig } from "@/lib/legalConfig";

export const metadata: Metadata = {
  title: "Terms of service",
  description: "Terms governing use of Cafe Social apps and partner portal.",
};

export default function TermsOfServicePage() {
  const { companyName, contactEmail, effectiveDate, appName } = legalConfig();

  return (
    <LegalPageShell title="Terms of service">
      <p className="text-sm text-slate-500">Effective date: {effectiveDate}</p>

      <h2>Agreement</h2>
      <p>
        By using the {appName} mobile applications or partner portal operated by {companyName}{" "}
        (“we”, “us”), you agree to these terms. If you do not agree, do not use the services.
      </p>

      <h2>The service</h2>
      <p>
        {appName} provides location-aware social gaming and loyalty features at partner venues,
        including games, challenges, offers, rewards, and related social tools. Partner venues
        use the portal to configure venues, staff, challenges, perks, and offers.
      </p>

      <h2>Accounts</h2>
      <p>
        You must provide accurate account information and keep credentials secure. You are
        responsible for activity under your account. We may suspend accounts that abuse the
        service, violate venue rules, or break the law.
      </p>

      <h2>Venue presence & fair play</h2>
      <p>
        Some features require you to be physically at a partner venue (geofence and/or check-in).
        You agree not to spoof location, share staff codes fraudulently, or otherwise abuse
        rewards. Partners may ban guests from their venues for misconduct.
      </p>

      <h2>Subscriptions & purchases</h2>
      <p>
        Optional guest subscriptions and in-app purchases are billed by Apple or Google through
        their stores (and related providers such as RevenueCat). Partner organization billing is
        separate and governed by your partner agreement and Stripe portal where applicable.
        Refunds for store purchases follow Apple/Google policies.
      </p>

      <h2>Partner trial & access</h2>
      <p>
        Partner venues on trial may lose guest-facing access when the trial ends without an
        active subscription. We may suspend venues for non-payment, policy violations, or
        operational reasons.
      </p>

      <h2>Rewards & offers</h2>
      <p>
        Perks and offers are provided by partner venues or the platform as described in the app.
        Staff-honoured rewards require presentation of the correct code or member card. We are
        not responsible for partner fulfilment of physical goods (for example food and drink)
        beyond providing the digital claim tools.
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>No harassment, fraud, or illegal activity</li>
        <li>No reverse engineering or scraping beyond normal app use</li>
        <li>No interference with other users or venue operations</li>
      </ul>

      <h2>Disclaimers</h2>
      <p>
        The service is provided “as is” to the extent permitted by law. We do not guarantee
        uninterrupted availability or that every partner venue will remain active.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, {companyName} is not liable for indirect,
        incidental, or consequential damages arising from use of the service. Our total
        liability for any claim is limited to the amounts you paid us for the service in the
        twelve months before the claim (or zero if you paid nothing).
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms. Continued use after changes take effect constitutes
        acceptance of the updated terms. Material changes may be communicated in-app or by
        email when appropriate.
      </p>

      <h2>Contact</h2>
      <p>
        Questions:{" "}
        <a href={`mailto:${contactEmail}`} className="text-brand hover:underline">
          {contactEmail}
        </a>
        .
      </p>

      <p className="text-sm text-slate-500">
        This page is served publicly from the {companyName} partner portal. Configure branding
        with <code className="text-xs">NEXT_PUBLIC_LEGAL_*</code> environment variables.
      </p>
    </LegalPageShell>
  );
}

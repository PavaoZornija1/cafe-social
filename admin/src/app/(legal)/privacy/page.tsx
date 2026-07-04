import type { Metadata } from "next";
import { LegalPageShell } from "@/components/legal/LegalPageShell";
import { legalConfig } from "@/lib/legalConfig";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "How Cafe Social collects and uses personal data.",
};

export default function PrivacyPolicyPage() {
  const { companyName, contactEmail, effectiveDate, appName } = legalConfig();

  return (
    <LegalPageShell title="Privacy policy">
      <p className="text-sm text-slate-500">Effective date: {effectiveDate}</p>

      <h2>Who we are</h2>
      <p>
        {companyName} (“we”, “us”) operates the {appName} mobile applications and partner
        portal. This policy explains what data we collect and how we use it when you use our
        guest app, staff tools, or partner portal.
      </p>

      <h2>Data we collect</h2>
      <ul>
        <li>
          <strong>Account data</strong> — identity and authentication via Clerk (email or
          sign-in provider identifiers). We create a player profile linked to your account.
        </li>
        <li>
          <strong>Location</strong> — device location only to detect whether you are inside or
          near a partner venue geofence (for games, check-in, offers, and related features). If
          you grant “Always” location, the OS may report approximate enter/exit while the app is
          in the background so we can record visit days and optional partner notifications. We do
          not sell location data or use continuous background GPS for advertising.
        </li>
        <li>
          <strong>Usage & gameplay</strong> — game sessions, challenge progress, XP, visits to
          partner venues, and similar activity needed to run the product.
        </li>
        <li>
          <strong>Notifications</strong> — push tokens if you allow notifications (match
          activity and optional partner marketing, which you can disable in Settings).
        </li>
        <li>
          <strong>Purchases</strong> — subscription and in-app purchase status via Apple /
          Google and RevenueCat (we receive entitlements, not full card numbers).
        </li>
        <li>
          <strong>Partner portal</strong> — staff and owner accounts, venue configuration, and
          redemption records needed to operate partner venues.
        </li>
      </ul>

      <h2>How we use data</h2>
      <ul>
        <li>Provide venue-aware games, challenges, offers, and social features</li>
        <li>Verify presence at partner venues and prevent abuse</li>
        <li>Issue and honour rewards (perks, offers) with partner staff</li>
        <li>Send notifications you have enabled</li>
        <li>Operate subscriptions and partner billing</li>
        <li>Improve reliability and security of the service</li>
      </ul>

      <h2>Sharing</h2>
      <p>
        We share data with service providers that help us run the product (for example Clerk for
        auth, hosting providers, push notification services, and RevenueCat for subscriptions).
        Partner venues see activity and redemptions related to their location (for example staff
        verification codes and member-card scans at that venue). We do not sell personal data.
      </p>

      <h2>Retention</h2>
      <p>
        We keep account and gameplay data while your account is active and as needed for
        operations, legal obligations, and dispute resolution. You can delete your account in the
        guest app under Settings → Account → Delete my account. That removes your player profile
        and Clerk sign-in from our systems. Historical game sessions may retain anonymized
        participation (no linked profile). Deleting your account does not cancel an App Store or
        Google Play subscription — manage billing in your store account. You may also contact us
        (see below) to request deletion.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>Location permission can be denied; some venue features will not work without it</li>
        <li>Partner marketing notifications can be turned off in Settings</li>
        <li>Total privacy / discoverability controls limit social visibility</li>
        <li>Delete your account in Settings (guest app)</li>
      </ul>

      <h2>Children</h2>
      <p>
        {appName} is not directed at children under 13 (or the minimum age required in your
        country). We do not knowingly collect data from children.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about this policy:{" "}
        <a href={`mailto:${contactEmail}`} className="text-brand hover:underline">
          {contactEmail}
        </a>
        .
      </p>

      <p className="text-sm text-slate-500">
        This page is provided by the {companyName} partner portal for App Store and Play Store
        listings and in-app legal links. Update branding via{" "}
        <code className="text-xs">NEXT_PUBLIC_LEGAL_*</code> environment variables.
      </p>
    </LegalPageShell>
  );
}

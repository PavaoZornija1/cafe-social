import type { Metadata } from "next";
import { LegalPageShell } from "@/components/legal/LegalPageShell";
import { legalConfig } from "@/lib/legalConfig";

export const metadata: Metadata = {
  title: "Delete your account",
  description:
    "How to delete your Cafe Social account and what data is removed or retained.",
};

/**
 * Google Play requires a publicly reachable URL (no sign-in, no app install)
 * describing account deletion for any app that lets users create an account.
 * Apple looks for the same when an app offers account creation.
 */
export default function DeleteAccountPage() {
  const { companyName, contactEmail, appName } = legalConfig();

  return (
    <LegalPageShell title="Delete your account">
      <p>
        You can delete your {appName} account at any time. Deleting removes your player
        profile and your sign-in from our systems.
      </p>

      <h2>Delete from inside the app</h2>
      <p>This is the fastest route and takes effect immediately:</p>
      <ul>
        <li>
          Open {appName} and go to <strong>Me</strong> → the gear icon (
          <strong>Settings</strong>)
        </li>
        <li>
          Scroll to <strong>Account</strong>
        </li>
        <li>
          Tap <strong>Delete my account</strong> and confirm
        </li>
      </ul>

      <h2>Request deletion by email</h2>
      <p>
        If you can no longer sign in or have uninstalled the app, email{" "}
        <a href={`mailto:${contactEmail}?subject=Account%20deletion%20request`}>
          {contactEmail}
        </a>{" "}
        from the address on your account, with the subject{" "}
        <strong>Account deletion request</strong>. We will verify ownership and delete the
        account. Expect a response within 30 days.
      </p>

      <h2>What is deleted</h2>
      <ul>
        <li>Your player profile — username, email address and display details</li>
        <li>Your sign-in credentials and linked Apple or Google accounts</li>
        <li>Your XP, tier, streaks and per-venue progress</li>
        <li>Your friends, friend requests and party memberships</li>
        <li>Your push notification tokens and notification preferences</li>
        <li>Your member QR code and any unredeemed perk codes</li>
      </ul>

      <h2>What is retained, and for how long</h2>
      <ul>
        <li>
          <strong>Anonymised game participation</strong> — past matches keep a record that a
          game was played, with no link back to your profile. Retained indefinitely as
          aggregate product data.
        </li>
        <li>
          <strong>Redemption and transaction records</strong> — where a perk or offer was
          redeemed at a partner venue, we retain the record as required for accounting and
          dispute resolution, typically up to 7 years.
        </li>
        <li>
          <strong>Records we must keep by law</strong> — retained only for as long as the
          applicable obligation requires.
        </li>
      </ul>

      <h2>Your subscription is separate</h2>
      <p>
        Deleting your account does <strong>not</strong> cancel a Cafe Social Pro subscription.
        Subscriptions are billed by Apple or Google, not by {companyName}. Cancel it before
        deleting your account:
      </p>
      <ul>
        <li>
          <strong>iOS</strong> — Settings → your name → Subscriptions → Cafe Social Pro →
          Cancel
        </li>
        <li>
          <strong>Android</strong> — Google Play → profile icon → Payments &amp; subscriptions
          → Subscriptions → Cafe Social Pro → Cancel
        </li>
      </ul>

      <h2>Questions</h2>
      <p>
        Contact <a href={`mailto:${contactEmail}`}>{contactEmail}</a>. See also our{" "}
        <a href="/privacy">privacy policy</a>.
      </p>
    </LegalPageShell>
  );
}

import type { TFunction } from "i18next";

const BILLING_STATUS_KEYS = [
  "NONE",
  "TRIALING",
  "ACTIVE",
  "ACTIVE_CANCELING",
  "PAST_DUE",
  "CANCELED",
] as const;

export type PartnerBillingStatusCode = (typeof BILLING_STATUS_KEYS)[number];

function normalizeBillingStatus(status: string): PartnerBillingStatusCode {
  const s = status?.trim().toUpperCase() ?? "NONE";
  return (BILLING_STATUS_KEYS as readonly string[]).includes(s)
    ? (s as PartnerBillingStatusCode)
    : "NONE";
}

/** Human-readable billing status for partner-facing UI. */
export function partnerBillingStatusLabel(t: TFunction, status: string): string {
  const code = normalizeBillingStatus(status);
  return t(`admin.partnerBillingStatus.${code}`);
}

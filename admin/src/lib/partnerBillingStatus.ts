/** Aligns with partner trial / Stripe-backed org billing in the backend. */
export function isPartnerOrgBillingActive(status: string): boolean {
  const s = status?.trim().toUpperCase() ?? "NONE";
  return (
    s === "ACTIVE" ||
    s === "ACTIVE_CANCELING" ||
    s === "TRIALING" ||
    s === "PAST_DUE"
  );
}

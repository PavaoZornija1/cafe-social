export type VenueMetaRow = {
  role: "EMPLOYEE" | "MANAGER" | "OWNER";
  venue: {
    id: string;
    name: string;
    organizationId: string | null;
    locked: boolean;
    lockReason: string | null;
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

export type RedemptionRow = {
  redemptionId: string;
  staffVerificationCode: string;
  issuedAt: string;
  redeemedAt: string | null;
  expiresAt: string;
  status: string;
  perkCode: string;
  perkTitle: string;
  voidedAt: string | null;
  voidReason: string | null;
};

export type VenueDashboardSectionKey =
  | "playbook"
  | "analytics"
  | "moderation"
  | "team"
  | "campaigns"
  | "receipts"
  | "redemptions";

export const VENUE_DASHBOARD_SECTIONS: VenueDashboardSectionKey[] = [
  "playbook",
  "analytics",
  "moderation",
  "team",
  "campaigns",
  "receipts",
  "redemptions",
];

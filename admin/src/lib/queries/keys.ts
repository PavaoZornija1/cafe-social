import type { AdminOrganizationsListParams, AdminVenuesListParams } from "./list-params";

/** Stable TanStack Query keys for the admin app (see https://tanstack.com/query/latest/docs/framework/react/guides/query-keys). */

export const queryKeys = {
  portal: {
    me: ["portal", "me"] as const,
  },
  admin: {
    dashboardMetrics: ["admin", "dashboard", "metrics"] as const,
    organizations: ["admin", "organizations"] as const,
    organizationsList: (p: AdminOrganizationsListParams) =>
      ["admin", "organizations", "list", p] as const,
    organization: (id: string) => ["admin", "organizations", id] as const,
    venues: ["admin", "venues"] as const,
    venuesList: (p: AdminVenuesListParams) => ["admin", "venues", "list", p] as const,
    venueTypeCatalog: ["admin", "venue-types", "catalog"] as const,
    venue: (id: string) => ["admin", "venues", id] as const,
    venueStaff: (id: string) => ["admin", "venues", id, "staff"] as const,
    words: (take: number) => ["admin", "words", take] as const,
    perks: (venueId: string) => ["admin", "venues", venueId, "perks"] as const,
    offers: (venueId: string) => ["admin", "venues", venueId, "offers"] as const,
    challenges: (venueId: string) => ["admin", "venues", venueId, "challenges"] as const,
    nudgeTemplates: ["admin", "nudge-templates"] as const,
    venueNudgeAssignments: (venueId: string) =>
      ["admin", "venues", venueId, "nudge-assignments"] as const,
  },
  owner: {
    superAdminVenuePicker: ["owner", "super-admin", "venue-picker"] as const,
    venuesList: ["owner", "venues", "list"] as const,
    venueMeta: (venueId: string, contextRev: number) =>
      ["owner", "venues", venueId, "meta", contextRev] as const,
    venueAnalytics: (venueId: string, days: number, from?: string, to?: string) =>
      ["owner", "venues", venueId, "analytics", days, from ?? "", to ?? ""] as const,
    venueRedemptions: (venueId: string, dateYmd: string) =>
      ["owner", "venues", venueId, "redemptions", dateYmd] as const,
    venueCampaigns: (venueId: string) => ["owner", "venues", venueId, "campaigns"] as const,
    venueReceipts: (venueId: string) => ["owner", "venues", venueId, "receipts"] as const,
    venueReceipt: (venueId: string, receiptId: string) =>
      ["owner", "venues", venueId, "receipts", receiptId] as const,
    venueStaffInvites: (venueId: string) =>
      ["owner", "venues", venueId, "staff-invites"] as const,
    venueModerationReports: (venueId: string) =>
      ["owner", "venues", venueId, "moderation", "reports"] as const,
    venueModerationBans: (venueId: string) =>
      ["owner", "venues", venueId, "moderation", "bans"] as const,
    orgAnalytics: (organizationId: string, days: number, from?: string, to?: string) =>
      ["owner", "organizations", organizationId, "analytics", days, from ?? "", to ?? ""] as const,
  },
} as const;

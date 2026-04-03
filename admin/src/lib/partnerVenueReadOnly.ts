/** Mirrors backend `isPayingPartnerOrg` for portal UI. */
export function isPayingPartnerStatus(status: string): boolean {
  const s = status?.trim().toUpperCase() ?? "NONE";
  return (
    s === "ACTIVE" ||
    s === "ACTIVE_CANCELING" ||
    s === "TRIALING" ||
    s === "PAST_DUE"
  );
}

const TRIAL_LOCK_REASON = "AUTO_TRIAL_EXPIRED";

/** Org-level trial/billing only (e.g. franchise rollup without a single venue row). */
export function partnerOrganizationMutationsBlockedReason(
  org: {
    trialEndsAt: string | null;
    platformBillingStatus: string;
  } | null,
): string | null {
  if (
    !org?.trialEndsAt ||
    isPayingPartnerStatus(org.platformBillingStatus)
  ) {
    return null;
  }
  if (new Date(org.trialEndsAt).getTime() <= Date.now()) {
    return "Your trial has ended. Subscribe to make changes.";
  }
  return null;
}

export function uniquePartnerReadOnlyMessages(
  venues: Parameters<typeof partnerVenueMutationsBlockedReason>[0][],
  platformRole: string | null | undefined,
  actingPartnerVenueId?: string | null,
): string[] {
  if (platformRole === "SUPER_ADMIN" && !actingPartnerVenueId?.trim()) {
    return [];
  }
  const seen = new Set<string>();
  for (const venue of venues) {
    const m = partnerVenueMutationsBlockedReason(venue);
    if (m) seen.add(m);
  }
  return [...seen];
}

export function partnerVenueMutationsBlockedReason(venue: {
  locked: boolean;
  lockReason: string | null;
  organization: {
    platformBillingStatus: string;
    trialEndsAt: string | null;
  } | null;
}): string | null {
  if (venue.locked) {
    if (venue.lockReason === TRIAL_LOCK_REASON) {
      return "This location isn’t active on Cafe Social for players right now (trial ended or billing needed). Renew to unlock the venue and editing here.";
    }
    return venue.lockReason?.trim()
      ? venue.lockReason.trim()
      : "This venue is locked — editing is disabled.";
  }
  const org = venue.organization;
  if (org?.trialEndsAt && !isPayingPartnerStatus(org.platformBillingStatus)) {
    if (new Date(org.trialEndsAt).getTime() <= Date.now()) {
      return "Your trial has ended. Subscribe to make changes.";
    }
  }
  return null;
}

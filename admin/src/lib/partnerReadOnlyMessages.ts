/** i18n keys under admin.partnerReadOnly — resolved in PartnerReadOnlyBanner. */
export type PartnerReadOnlyMessageKey =
  | "admin.partnerReadOnly.trialEnded"
  | "admin.partnerReadOnly.venueLockedTrial"
  | "admin.partnerReadOnly.venueLockedGeneric";

export type PartnerReadOnlyNotice =
  | { kind: "key"; key: PartnerReadOnlyMessageKey }
  | { kind: "text"; text: string };

const TRIAL_LOCK_REASON = "AUTO_TRIAL_EXPIRED";

export function isPayingPartnerStatus(status: string): boolean {
  const s = status?.trim().toUpperCase() ?? "NONE";
  return (
    s === "ACTIVE" ||
    s === "ACTIVE_CANCELING" ||
    s === "TRIALING" ||
    s === "PAST_DUE"
  );
}

export function partnerOrganizationMutationsBlockedNotice(
  org: {
    trialEndsAt: string | null;
    platformBillingStatus: string;
  } | null,
): PartnerReadOnlyNotice | null {
  if (!org?.trialEndsAt || isPayingPartnerStatus(org.platformBillingStatus)) {
    return null;
  }
  if (new Date(org.trialEndsAt).getTime() <= Date.now()) {
    return { kind: "key", key: "admin.partnerReadOnly.trialEnded" };
  }
  return null;
}

export function uniquePartnerReadOnlyNotices(
  venues: Parameters<typeof partnerVenueMutationsBlockedNotice>[0][],
  platformRole: string | null | undefined,
  actingPartnerVenueId?: string | null,
): PartnerReadOnlyNotice[] {
  if (platformRole === "SUPER_ADMIN" && !actingPartnerVenueId?.trim()) {
    return [];
  }
  const seen = new Set<string>();
  const out: PartnerReadOnlyNotice[] = [];
  for (const venue of venues) {
    const notice = partnerVenueMutationsBlockedNotice(venue);
    if (!notice) continue;
    const id = notice.kind === "key" ? notice.key : notice.text;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(notice);
  }
  return out;
}

export function partnerVenueMutationsBlockedNotice(venue: {
  locked: boolean;
  lockReason: string | null;
  organization: {
    platformBillingStatus: string;
    trialEndsAt: string | null;
  } | null;
}): PartnerReadOnlyNotice | null {
  if (venue.locked) {
    if (venue.lockReason === TRIAL_LOCK_REASON) {
      return { kind: "key", key: "admin.partnerReadOnly.venueLockedTrial" };
    }
    const custom = venue.lockReason?.trim();
    if (custom) {
      return { kind: "text", text: custom };
    }
    return { kind: "key", key: "admin.partnerReadOnly.venueLockedGeneric" };
  }
  const org = venue.organization;
  if (org?.trialEndsAt && !isPayingPartnerStatus(org.platformBillingStatus)) {
    if (new Date(org.trialEndsAt).getTime() <= Date.now()) {
      return { kind: "key", key: "admin.partnerReadOnly.trialEnded" };
    }
  }
  return null;
}

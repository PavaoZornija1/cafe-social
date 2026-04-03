"use client";

function isPayingPartnerStatus(status: string): boolean {
  const s = status?.trim().toUpperCase() ?? "NONE";
  return (
    s === "ACTIVE" ||
    s === "ACTIVE_CANCELING" ||
    s === "TRIALING" ||
    s === "PAST_DUE"
  );
}

type OrgLike = {
  trialEndsAt: string | null;
  platformBillingStatus: string;
  name: string;
} | null;

export function TrialContactBar({
  organizations,
}: {
  organizations: OrgLike[];
}) {
  const salesHref =
    process.env.NEXT_PUBLIC_SALES_CONTACT_URL?.trim() ||
    "mailto:sales@cafesocial.example?subject=Cafe%20Social%20partner%20trial";

  const nonPayingWithTrial = organizations.filter(
    (o) =>
      o &&
      o.trialEndsAt &&
      !isPayingPartnerStatus(o.platformBillingStatus),
  ) as NonNullable<OrgLike>[];

  if (nonPayingWithTrial.length === 0) return null;

  const now = Date.now();
  const endedTrialOrgs = nonPayingWithTrial.filter(
    (o) => new Date(o.trialEndsAt!).getTime() <= now,
  );
  const activeTrialOrgs = nonPayingWithTrial.filter(
    (o) => new Date(o.trialEndsAt!).getTime() > now,
  );

  if (endedTrialOrgs.length > 0) {
    return (
      <div className="border-b border-amber-300/90 bg-amber-50 px-5 py-3 text-sm flex flex-wrap items-center justify-between gap-3">
        <p className="font-medium text-amber-950">
          Your trial has ended
          {endedTrialOrgs.length === 1 ? ` (${endedTrialOrgs[0]!.name})` : ""}.
          Subscribe or contact us to restore partner editing and venue play.
        </p>
        <a
          href={salesHref}
          className="shrink-0 rounded-lg bg-amber-800 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-amber-900 transition-colors"
        >
          Contact sales / billing
        </a>
      </div>
    );
  }

  const end = activeTrialOrgs[0]!.trialEndsAt
    ? new Date(activeTrialOrgs[0]!.trialEndsAt)
    : null;
  const daysLeft =
    end != null
      ? Math.max(
          0,
          Math.ceil((end.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
        )
      : null;

  return (
    <div className="border-b border-brand-light bg-brand-light/90 text-brand px-5 py-3 text-sm flex flex-wrap items-center justify-between gap-3">
      <p className="font-medium text-slate-800">
        Trial active
        {daysLeft !== null ? ` · about ${daysLeft} day${daysLeft === 1 ? "" : "s"} left` : ""}
        {activeTrialOrgs.length === 1 ? ` (${activeTrialOrgs[0]!.name})` : ""}.
        One location included — upgrade to add more.
      </p>
      <a
        href={salesHref}
        className="shrink-0 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground shadow-sm hover:bg-brand-hover transition-colors"
      >
        Contact sales
      </a>
    </div>
  );
}

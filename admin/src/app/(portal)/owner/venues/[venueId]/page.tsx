"use client";

import Link from "next/link";
import { UserButton, useAuth } from "@clerk/nextjs";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ownerFetch } from "@/lib/portalApi";
import { PORTAL_VENUE_CONTEXT_EVENT } from "@/lib/portalVenueContext";
import { OwnerAnalyticsCharts } from "@/components/OwnerAnalyticsCharts";
import { PartnerReadOnlyBanner } from "@/components/PartnerReadOnlyBanner";
import { partnerVenueMutationsBlockedReason } from "@/lib/partnerVenueReadOnly";

type VenueRow = {
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

type StaffInviteRow = {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  invitedBy: { id: string; email: string; username: string };
};

type Analytics = {
  venueId: string;
  analyticsTimeZone: string | null;
  period: { days: number; startDay: string; endDay: string };
  redemptions: {
    total: number;
    voided: number;
    byDay: { day: string; count: number }[];
    byHourUtc: { hour: number; count: number }[];
    byHourVenue: { hour: number; count: number }[] | null;
    perPerk: { perkId: string; code: string; title: string; count: number }[];
  };
  visits: {
    uniquePlayers: number;
    totalVisitDays: number;
    byDay: { day: string; count: number }[];
  };
  funnel: {
    uniqueVisitors: number;
    uniqueRedeemers: number;
    totalRedemptions: number;
    visitToRedeemPercent: number;
  };
  feedEvents: {
    total: number;
    byKind: Record<string, number>;
  };
};

type RedemptionsPayload = {
  venueName: string;
  date: string;
  redemptions: {
    redemptionId: string;
    staffVerificationCode: string;
    redeemedAt: string;
    perkCode: string;
    perkTitle: string;
    voidedAt: string | null;
    voidReason: string | null;
    staffAcknowledgedAt: string | null;
  }[];
};

type CampaignRow = {
  id: string;
  name: string;
  title: string;
  body: string;
  segmentDays: number;
  status: string;
  recipientCount: number | null;
  pushSentCount: number;
  sentAt: string | null;
  lastError: string | null;
  createdAt: string;
};

type ReceiptSummary = {
  id: string;
  playerId: string;
  status: string;
  notePlayer: string | null;
  staffNote: string | null;
  abuseFlag: boolean;
  retentionUntil: string | null;
  createdAt: string;
  player: { email: string; username: string };
};

type ReceiptDetail = ReceiptSummary & {
  imageData: string;
  mimeType: string;
};

function todayUtc(): string {
  const n = new Date();
  const y = n.getUTCFullYear();
  const m = String(n.getUTCMonth() + 1).padStart(2, "0");
  const d = String(n.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function OwnerVenueDetailPage() {
  const params = useParams();
  const venueId = params.venueId as string;
  const { getToken, isLoaded } = useAuth();

  const [role, setRole] = useState<VenueRow["role"] | null>(null);
  const [venueName, setVenueName] = useState<string>("");
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [redemptions, setRedemptions] = useState<RedemptionsPayload | null>(null);
  const [dateYmd, setDateYmd] = useState(todayUtc);
  const [days, setDays] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [campName, setCampName] = useState("");
  const [campTitle, setCampTitle] = useState("");
  const [campBody, setCampBody] = useState("");
  const [campSeg, setCampSeg] = useState(30);
  const [campBusy, setCampBusy] = useState(false);

  const [receipts, setReceipts] = useState<ReceiptSummary[]>([]);
  const [receiptDetail, setReceiptDetail] = useState<ReceiptDetail | null>(null);
  const [receiptBusy, setReceiptBusy] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const [franchiseId, setFranchiseId] = useState<string | null>(null);
  const [orgBilling, setOrgBilling] = useState<
    VenueRow["venue"]["organization"] | null
  >(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"EMPLOYEE" | "MANAGER">(
    "EMPLOYEE",
  );
  const [invites, setInvites] = useState<StaffInviteRow[]>([]);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [lastCreatedToken, setLastCreatedToken] = useState<string | null>(null);
  const [platformRole, setPlatformRole] = useState<string | null>(null);
  const [actingPartnerVenueId, setActingPartnerVenueId] = useState<string | null>(
    null,
  );
  const [venueLocked, setVenueLocked] = useState(false);
  const [venueLockReason, setVenueLockReason] = useState<string | null>(null);
  const [contextRev, setContextRev] = useState(0);
  const [clerkInviteNotice, setClerkInviteNotice] = useState<string | null>(
    null,
  );

  const canAnalytics = useMemo(
    () => role === "OWNER" || role === "MANAGER",
    [role],
  );
  const isOwner = role === "OWNER";
  const hidePartnerFinancialUi =
    platformRole === "SUPER_ADMIN" && Boolean(actingPartnerVenueId);

  const readOnlyMessage = useMemo(() => {
    if (platformRole === "SUPER_ADMIN" && !actingPartnerVenueId) {
      return null;
    }
    return partnerVenueMutationsBlockedReason({
      locked: venueLocked,
      lockReason: venueLockReason,
      organization: orgBilling
        ? {
            platformBillingStatus: orgBilling.platformBillingStatus,
            trialEndsAt: orgBilling.trialEndsAt ?? null,
          }
        : null,
    });
  }, [
    platformRole,
    actingPartnerVenueId,
    venueLocked,
    venueLockReason,
    orgBilling,
  ]);
  const readOnlyDisabled = Boolean(readOnlyMessage);

  const loadVenueMeta = useCallback(async () => {
    const token = await getToken();
    if (!token) return null;
    const res = await ownerFetch(getToken, "/owner/venues", { method: "GET" });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      venues: VenueRow[];
      platformRole: string;
      actingPartnerVenueId?: string | null;
    };
    setPlatformRole(data.platformRole);
    setActingPartnerVenueId(data.actingPartnerVenueId ?? null);
    const row = data.venues.find((v) => v.venue.id === venueId) ?? null;
    return row;
  }, [getToken, venueId]);

  const loadAnalytics = useCallback(async () => {
    const token = await getToken();
    if (!token) throw new Error("Not signed in");
    const res = await ownerFetch(
      getToken,
      `/owner/venues/${venueId}/analytics?days=${days}`,
      { method: "GET" },
    );
    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || res.statusText);
    }
    return (await res.json()) as Analytics;
  }, [getToken, venueId, days]);

  const loadRedemptions = useCallback(async () => {
    const token = await getToken();
    if (!token) throw new Error("Not signed in");
    const q = new URLSearchParams({ date: dateYmd });
    const res = await ownerFetch(
      getToken,
      `/owner/venues/${venueId}/redemptions?${q}`,
      { method: "GET" },
    );
    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || res.statusText);
    }
    return (await res.json()) as RedemptionsPayload;
  }, [getToken, venueId, dateYmd]);

  const loadCampaigns = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const res = await ownerFetch(getToken, `/owner/venues/${venueId}/campaigns`, {
      method: "GET",
    });
    if (!res.ok) return;
    setCampaigns((await res.json()) as CampaignRow[]);
  }, [getToken, venueId]);

  const loadStaffInvites = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const res = await ownerFetch(
      getToken,
      `/owner/venues/${venueId}/staff-invites`,
      { method: "GET" },
    );
    if (!res.ok) return;
    setInvites((await res.json()) as StaffInviteRow[]);
  }, [getToken, venueId]);

  const loadReceipts = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const res = await ownerFetch(getToken, `/owner/venues/${venueId}/receipts`, {
      method: "GET",
    });
    if (!res.ok) return;
    setReceipts((await res.json()) as ReceiptSummary[]);
  }, [getToken, venueId]);

  useEffect(() => {
    const fn = () => setContextRev((r) => r + 1);
    window.addEventListener(PORTAL_VENUE_CONTEXT_EVENT, fn);
    return () => window.removeEventListener(PORTAL_VENUE_CONTEXT_EVENT, fn);
  }, []);

  useEffect(() => {
    if (!isLoaded || !venueId) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const meta = await loadVenueMeta();
        if (cancelled) return;
        if (!meta) {
          setError(
            "You do not have access to this venue or it does not exist.",
          );
          setRole(null);
          setVenueLocked(false);
          setVenueLockReason(null);
          setLoading(false);
          return;
        }
        setRole(meta.role);
        setVenueName(meta.venue.name);
        setFranchiseId(meta.venue.organizationId);
        setOrgBilling(meta.venue.organization);
        setVenueLocked(meta.venue.locked);
        setVenueLockReason(meta.venue.lockReason ?? null);

        if (meta.role === "OWNER" || meta.role === "MANAGER") {
          const a = await loadAnalytics();
          if (cancelled) return;
          setAnalytics(a);
          await loadCampaigns();
          await loadReceipts();
        } else {
          setAnalytics(null);
        }
        if (meta.role === "OWNER") {
          await loadStaffInvites();
        } else {
          setInvites([]);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isLoaded,
    venueId,
    loadVenueMeta,
    loadAnalytics,
    loadCampaigns,
    loadReceipts,
    loadStaffInvites,
    contextRev,
  ]);

  useEffect(() => {
    if (!isLoaded || !venueId || !canAnalytics) return;
    let cancelled = false;
    (async () => {
      try {
        const a = await loadAnalytics();
        if (!cancelled) setAnalytics(a);
      } catch {
        /* keep prior */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [days, canAnalytics, isLoaded, venueId, loadAnalytics]);

  useEffect(() => {
    if (!isLoaded || !venueId || role == null) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await loadRedemptions();
        if (!cancelled) setRedemptions(r);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Failed to load redemptions",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dateYmd, venueId, isLoaded, role, loadRedemptions]);

  const downloadCsv = async () => {
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Sign in required");
      const res = await ownerFetch(
        getToken,
        `/owner/venues/${venueId}/analytics/export.csv?days=${days}`,
        { method: "GET" },
      );
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `redemptions-${venueId.slice(0, 8)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "CSV download failed");
    }
  };

  const createCampaign = async () => {
    setCampBusy(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Sign in");
      const res = await ownerFetch(
        getToken,
        `/owner/venues/${venueId}/campaigns`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: campName,
            title: campTitle,
            body: campBody,
            segmentDays: campSeg,
          }),
        },
      );
      if (!res.ok) throw new Error(await res.text());
      setCampName("");
      setCampTitle("");
      setCampBody("");
      await loadCampaigns();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Campaign failed");
    } finally {
      setCampBusy(false);
    }
  };

  const sendCampaign = async (campaignId: string) => {
    setCampBusy(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Sign in");
      const res = await ownerFetch(
        getToken,
        `/owner/venues/${venueId}/campaigns/${campaignId}/send`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error(await res.text());
      await loadCampaigns();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setCampBusy(false);
    }
  };

  const openReceipt = async (id: string) => {
    setReceiptBusy(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Sign in");
      const res = await ownerFetch(
        getToken,
        `/owner/venues/${venueId}/receipts/${id}`,
        { method: "GET" },
      );
      if (!res.ok) throw new Error(await res.text());
      setReceiptDetail((await res.json()) as ReceiptDetail);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load receipt failed");
    } finally {
      setReceiptBusy(false);
    }
  };

  const reviewReceipt = async (
    status: "APPROVED" | "REJECTED",
    rid: string,
  ) => {
    setReceiptBusy(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Sign in");
      const res = await ownerFetch(
        getToken,
        `/owner/venues/${venueId}/receipts/${rid}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, staffNote: "" }),
        },
      );
      if (!res.ok) throw new Error(await res.text());
      setReceiptDetail(null);
      await loadReceipts();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed");
    } finally {
      setReceiptBusy(false);
    }
  };

  const ackRedemption = async (redemptionId: string) => {
    setActionBusy(redemptionId);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await ownerFetch(
        getToken,
        `/owner/venues/${venueId}/redemptions/${redemptionId}/acknowledge`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error(await res.text());
      setRedemptions(await loadRedemptions());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ack failed");
    } finally {
      setActionBusy(null);
    }
  };

  const createStaffInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviteBusy(true);
    setError(null);
    setLastCreatedToken(null);
    setClerkInviteNotice(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Sign in");
      const res = await ownerFetch(
        getToken,
        `/owner/venues/${venueId}/staff-invites`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
        },
      );
      const text = await res.text();
      if (!res.ok) throw new Error(text || res.statusText);
      const data = text
        ? (JSON.parse(text) as {
            token?: string;
            clerkInvitationSent?: boolean;
            clerkInvitationError?: string;
          })
        : {};
      if (data.token) setLastCreatedToken(data.token);
      if (data.clerkInvitationSent) {
        setClerkInviteNotice(
          "Clerk sent an invitation email with a sign-up link to this address (when your project has email delivery enabled).",
        );
      } else if (data.clerkInvitationError) {
        setClerkInviteNotice(
          `Clerk did not send email (${data.clerkInvitationError.slice(0, 120)}). Share the manual link below.`,
        );
      } else {
        setClerkInviteNotice(
          "Configure CLERK_SECRET_KEY and ADMIN_PORTAL_ORIGIN on the API to email invites via Clerk; otherwise share the link below.",
        );
      }
      setInviteEmail("");
      await loadStaffInvites();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invite failed");
    } finally {
      setInviteBusy(false);
    }
  };

  const cancelStaffInvite = async (inviteId: string) => {
    setInviteBusy(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await ownerFetch(
        getToken,
        `/owner/venues/${venueId}/staff-invites/${inviteId}/cancel`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error(await res.text());
      await loadStaffInvites();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setInviteBusy(false);
    }
  };

  const voidRedemption = async (redemptionId: string) => {
    if (!voidReason.trim()) {
      setError("Enter a void reason (manager/owner).");
      return;
    }
    setActionBusy(redemptionId);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await ownerFetch(
        getToken,
        `/owner/venues/${venueId}/redemptions/${redemptionId}/void`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: voidReason.trim() }),
        },
      );
      if (!res.ok) throw new Error(await res.text());
      setVoidReason("");
      setRedemptions(await loadRedemptions());
      if (canAnalytics) {
        try {
          setAnalytics(await loadAnalytics());
        } catch {
          /* */
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Void failed");
    } finally {
      setActionBusy(null);
    }
  };

  const title = venueName || "Venue";

  const hourSeriesForCharts = useMemo(() => {
    if (!analytics) return null;
    return analytics.analyticsTimeZone && analytics.redemptions.byHourVenue
      ? analytics.redemptions.byHourVenue
      : analytics.redemptions.byHourUtc;
  }, [analytics]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-4">
        <div>
          <Link
            href="/owner/venues"
            className="text-sm text-brand hover:text-brand"
          >
            ← All venues
          </Link>
          <h1 className="text-xl font-semibold mt-2">
            {title}
            {role && (
              <span className="ml-3 text-xs font-mono uppercase tracking-wide text-brand align-middle">
                {role}
              </span>
            )}
          </h1>
          {role === "EMPLOYEE" ? (
            <p className="text-sm text-slate-500 mt-1 max-w-xl">
              Staff view — verify redemptions and acknowledgments. Open{" "}
              <Link href={`/staff/${venueId}`} className="text-emerald-700 hover:underline">
                Today&apos;s list
              </Link>{" "}
              for a focused screen.
            </p>
          ) : null}
          {role === "MANAGER" ? (
            <p className="text-sm text-slate-500 mt-1 max-w-xl">
              Manager — analytics, campaigns, receipts, and redemptions. Team
              invites are owner-only.
            </p>
          ) : null}
          {isOwner ? (
            <p className="text-sm text-slate-500 mt-1 max-w-xl">
              Owner — includes staff invitations and subscription links when your
              org has a billing portal URL.
            </p>
          ) : null}
          {franchiseId ? (
            <p className="text-sm mt-2">
              <Link
                href={`/owner/organizations/${franchiseId}`}
                className="text-amber-700 hover:underline"
              >
                Franchise rollup (all locations) →
              </Link>
            </p>
          ) : null}
          {isOwner && orgBilling?.billingPortalUrl && !hidePartnerFinancialUi ? (
            <p className="text-sm mt-2">
              <a
                href={orgBilling.billingPortalUrl}
                target="_blank"
                rel="noreferrer"
                className="text-emerald-700 hover:underline"
              >
                Subscription / billing portal →
              </a>
              <span className="text-slate-500 ml-2">
                {orgBilling.platformBillingPlan ?? "—"} ·{" "}
                {orgBilling.platformBillingStatus}
                {orgBilling.platformBillingRenewsAt
                  ? ` · renews ${orgBilling.platformBillingRenewsAt.slice(0, 10)}`
                  : ""}
                {orgBilling.platformBillingStatus === "ACTIVE_CANCELING"
                  ? " · ends at period end"
                  : ""}
                {orgBilling.platformBillingStatus === "CANCELED"
                  ? " · contact support to restore franchise billing"
                  : ""}
              </span>
            </p>
          ) : null}
        </div>
        <UserButton />
      </header>

      <main className="p-6 max-w-4xl mx-auto space-y-10 pb-24">
        {loading && <p className="text-slate-600">Loading…</p>}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm">
            {error}
          </div>
        )}
        {readOnlyMessage ? (
          <PartnerReadOnlyBanner message={readOnlyMessage} />
        ) : null}

        {canAnalytics && analytics && !error && (
          <section>
            <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
              <h2 className="text-lg font-medium">Analytics</h2>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={readOnlyDisabled}
                  onClick={() => void downloadCsv()}
                  className="text-sm bg-emerald-50 border border-emerald-300 text-emerald-900 px-3 py-1 rounded-lg hover:bg-emerald-100 disabled:opacity-50"
                >
                  Download CSV
                </button>
                <label className="text-sm text-slate-600 flex items-center gap-2">
                  Period (days)
                  <select
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value))}
                    className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-slate-900"
                  >
                    {[7, 14, 30, 60, 90].map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              UTC range {analytics.period.startDay} → {analytics.period.endDay}
              {analytics.analyticsTimeZone
                ? ` · Venue TZ: ${analytics.analyticsTimeZone}`
                : ""}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-600">Active redemptions</p>
                <p className="text-2xl font-semibold mt-1">
                  {analytics.redemptions.total}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Voided: {analytics.redemptions.voided}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-600">Unique visitors</p>
                <p className="text-2xl font-semibold mt-1">
                  {analytics.visits.uniquePlayers}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-600">Funnel</p>
                <p className="text-lg font-semibold mt-1">
                  {analytics.funnel.uniqueRedeemers} /{" "}
                  {analytics.funnel.uniqueVisitors} redeemers
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  ≈ {analytics.funnel.visitToRedeemPercent}% of visitors
                  redeemed
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-600">Feed events</p>
                <p className="text-2xl font-semibold mt-1">
                  {analytics.feedEvents.total}
                </p>
              </div>
            </div>

            <OwnerAnalyticsCharts
              visitsByDay={analytics.visits.byDay}
              redemptionsByDay={analytics.redemptions.byDay}
              byHour={hourSeriesForCharts}
            />

            <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-slate-800 mb-2">
                  Per perk
                </h3>
                <div className="max-h-48 overflow-auto rounded-lg border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100 sticky top-0 text-slate-600">
                      <tr>
                        <th className="p-2 text-left">Perk</th>
                        <th className="p-2 text-left">Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.redemptions.perPerk.map((p) => (
                        <tr key={p.perkId} className="border-t border-slate-200">
                          <td className="p-2">
                            {p.title}{" "}
                            <span className="text-slate-500 text-xs">
                              ({p.code})
                            </span>
                          </td>
                          <td className="p-2">{p.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-slate-800 mb-2">
                  Redemptions by hour (UTC)
                </h3>
                <div className="max-h-48 overflow-auto rounded-lg border border-slate-200 text-xs font-mono p-2 text-slate-600">
                  {analytics.redemptions.byHourUtc
                    .filter((h) => h.count > 0)
                    .map((h) => (
                      <div key={h.hour}>
                        {String(h.hour).padStart(2, "0")}:00 — {h.count}
                      </div>
                    ))}
                </div>
              </div>
            </div>
            {analytics.redemptions.byHourVenue && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-slate-800 mb-2">
                  Redemptions by hour (venue TZ)
                </h3>
                <div className="max-h-48 overflow-auto rounded-lg border border-slate-200 text-xs font-mono p-2 text-slate-600">
                  {analytics.redemptions.byHourVenue
                    .filter((h) => h.count > 0)
                    .map((h) => (
                      <div key={h.hour}>
                        {String(h.hour).padStart(2, "0")}:00 — {h.count}
                      </div>
                    ))}
                </div>
              </div>
            )}
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-slate-800 mb-2">
                  Redemptions by day
                </h3>
                <div className="max-h-56 overflow-auto rounded-lg border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100 sticky top-0">
                      <tr className="text-left text-slate-500">
                        <th className="p-2 font-medium">Day (UTC)</th>
                        <th className="p-2 font-medium">Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.redemptions.byDay
                        .filter((r) => r.count > 0)
                        .map((r) => (
                          <tr
                            key={r.day}
                            className="border-t border-slate-200"
                          >
                            <td className="p-2 font-mono text-slate-800">
                              {r.day}
                            </td>
                            <td className="p-2">{r.count}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-slate-800 mb-2">
                  Visit days by day
                </h3>
                <div className="max-h-56 overflow-auto rounded-lg border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100 sticky top-0">
                      <tr className="text-left text-slate-500">
                        <th className="p-2 font-medium">Day (UTC)</th>
                        <th className="p-2 font-medium">Visits</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.visits.byDay
                        .filter((r) => r.count > 0)
                        .map((r) => (
                          <tr
                            key={r.day}
                            className="border-t border-slate-200"
                          >
                            <td className="p-2 font-mono text-slate-800">
                              {r.day}
                            </td>
                            <td className="p-2">{r.count}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        )}

        {isOwner && (
          <section className="border border-slate-200 rounded-xl p-4 space-y-4">
            <h2 className="text-lg font-medium">Staff invites</h2>
            <p className="text-xs text-slate-500">
              We create a venue invite and, when the API has{" "}
              <code className="text-slate-600">CLERK_SECRET_KEY</code> +{" "}
              <code className="text-slate-600">ADMIN_PORTAL_ORIGIN</code>, Clerk
              emails a sign-up link. The invitee must use the same email, then
              complete{" "}
              <Link href="/owner/accept-invite" className="text-brand hover:underline">
                Accept invite
              </Link>
              .
            </p>
            {clerkInviteNotice ? (
              <p className="text-xs text-amber-900 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
                {clerkInviteNotice}
              </p>
            ) : null}
            {lastCreatedToken && typeof window !== "undefined" ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs">
                <p className="text-emerald-800 font-medium mb-1">Invite link (copy now)</p>
                <code className="text-slate-800 break-all block select-all">
                  {`${window.location.origin}/owner/accept-invite?token=${lastCreatedToken}`}
                </code>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2 items-end">
              <label className="block text-sm text-slate-600 flex-1 min-w-[200px]">
                Email
                <input
                  type="email"
                  disabled={readOnlyDisabled}
                  className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm disabled:opacity-60"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="staff@venue.com"
                />
              </label>
              <label className="block text-sm text-slate-600">
                Role
                <select
                  disabled={readOnlyDisabled}
                  className="mt-1 block w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm disabled:opacity-60"
                  value={inviteRole}
                  onChange={(e) =>
                    setInviteRole(e.target.value as "EMPLOYEE" | "MANAGER")
                  }
                >
                  <option value="EMPLOYEE">EMPLOYEE</option>
                  {role === "OWNER" ? (
                    <option value="MANAGER">MANAGER</option>
                  ) : null}
                </select>
              </label>
              <button
                type="button"
                disabled={
                  readOnlyDisabled || inviteBusy || !inviteEmail.trim()
                }
                onClick={() => void createStaffInvite()}
                className="bg-slate-200 hover:bg-slate-300 disabled:opacity-50 rounded-lg px-4 py-2 text-sm h-[38px]"
              >
                Send invite
              </button>
            </div>
            <ul className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden text-sm">
              {invites.length === 0 ? (
                <li className="p-3 text-slate-500">
                  No invite history yet for this venue.
                </li>
              ) : (
                invites.map((inv) => (
                  <li
                    key={inv.id}
                    className="p-3 flex flex-wrap gap-2 justify-between items-center bg-brand-light/60"
                  >
                    <div>
                      <span className="text-slate-800">{inv.email}</span>
                      <span className="text-xs font-mono text-brand ml-2">
                        {inv.role}
                      </span>
                      <p className="text-xs text-slate-500 mt-1">
                        {inv.status} · expires{" "}
                        {new Date(inv.expiresAt).toISOString().slice(0, 10)} · by{" "}
                        {inv.invitedBy.email}
                      </p>
                    </div>
                    {inv.status === "PENDING" ? (
                      <button
                        type="button"
                        disabled={readOnlyDisabled || inviteBusy}
                        onClick={() => void cancelStaffInvite(inv.id)}
                        className="text-xs text-red-600 hover:underline disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
          </section>
        )}

        {canAnalytics && (
          <section className="border border-slate-200 rounded-xl p-4 space-y-4">
            <h2 className="text-lg font-medium">Marketing campaigns</h2>
            <p className="text-xs text-slate-500">
              Push to players who visited this venue in the last N UTC days.
              Only sends to accounts with partner marketing on and not in total
              privacy (server-side).
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                disabled={readOnlyDisabled}
                className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm disabled:opacity-60"
                placeholder="Internal name"
                value={campName}
                onChange={(e) => setCampName(e.target.value)}
              />
              <input
                type="number"
                min={1}
                max={365}
                disabled={readOnlyDisabled}
                className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm disabled:opacity-60"
                value={campSeg}
                onChange={(e) => setCampSeg(Number(e.target.value))}
              />
              <input
                disabled={readOnlyDisabled}
                className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm sm:col-span-2 disabled:opacity-60"
                placeholder="Notification title"
                value={campTitle}
                onChange={(e) => setCampTitle(e.target.value)}
              />
              <textarea
                disabled={readOnlyDisabled}
                className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-[80px] sm:col-span-2 disabled:opacity-60"
                placeholder="Notification body"
                value={campBody}
                onChange={(e) => setCampBody(e.target.value)}
              />
            </div>
            <button
              type="button"
              disabled={readOnlyDisabled || campBusy}
              onClick={() => void createCampaign()}
              className="bg-brand hover:bg-brand-hover disabled:opacity-50 rounded-lg px-4 py-2 text-sm font-semibold"
            >
              Save draft campaign
            </button>
            <ul className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden">
              {campaigns.map((c) => (
                <li
                  key={c.id}
                  className="p-3 flex flex-wrap gap-3 items-center justify-between bg-brand-light/60"
                >
                  <div>
                    <p className="font-medium text-slate-800">{c.name}</p>
                    <p className="text-xs text-slate-500">
                      {c.status} · segment {c.segmentDays}d
                      {c.recipientCount != null
                        ? ` · recipients ${c.recipientCount}`
                        : ""}
                    </p>
                    {c.lastError ? (
                      <p className="text-xs text-red-600 mt-1">{c.lastError}</p>
                    ) : null}
                  </div>
                  {c.status !== "COMPLETED" ? (
                    <button
                      type="button"
                      disabled={readOnlyDisabled || campBusy}
                      onClick={() => void sendCampaign(c.id)}
                      className="text-sm bg-amber-50 border border-amber-300 text-amber-900 px-3 py-1 rounded-lg disabled:opacity-50"
                    >
                      Send now
                    </button>
                  ) : (
                    <span className="text-xs text-slate-500">Sent</span>
                  )}
                </li>
              ))}
              {campaigns.length === 0 ? (
                <li className="p-4 text-slate-500 text-sm">No campaigns yet.</li>
              ) : null}
            </ul>
          </section>
        )}

        {canAnalytics && (
          <section className="border border-slate-200 rounded-xl p-4 space-y-4">
            <h2 className="text-lg font-medium">Receipt submissions</h2>
            <p className="text-xs text-slate-500">
              90-day retention target per submission. Approve or reject from
              detail view.
            </p>
            <button
              type="button"
              onClick={() => void loadReceipts()}
              className="text-sm text-brand"
            >
              Refresh list
            </button>
            <ul className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
              {receipts.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className="w-full text-left p-3 hover:bg-slate-100 flex justify-between gap-2"
                    onClick={() => void openReceipt(r.id)}
                  >
                    <span className="text-sm text-slate-800">
                      {r.player.email} · {r.status}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(r.createdAt).toISOString()}
                    </span>
                  </button>
                </li>
              ))}
              {receipts.length === 0 ? (
                <li className="p-4 text-slate-500 text-sm">No receipts.</li>
              ) : null}
            </ul>
            {receiptDetail && (
              <div className="border border-slate-300 rounded-lg p-4 space-y-3 bg-slate-50">
                <p className="text-sm text-slate-600">
                  {receiptDetail.player.email} — {receiptDetail.status}
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={receiptDetail.imageData}
                  alt="Receipt"
                  className="max-h-64 rounded border border-slate-300"
                />
                {receiptDetail.status === "PENDING" && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={readOnlyDisabled || receiptBusy}
                      onClick={() =>
                        void reviewReceipt("APPROVED", receiptDetail.id)
                      }
                      className="bg-emerald-800 text-white px-3 py-2 rounded-lg text-sm disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={readOnlyDisabled || receiptBusy}
                      onClick={() =>
                        void reviewReceipt("REJECTED", receiptDetail.id)
                      }
                      className="bg-red-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => setReceiptDetail(null)}
                      className="text-slate-600 text-sm px-2"
                    >
                      Close
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {redemptions && !error && (
          <section>
            <h2 className="text-lg font-medium mb-4">Perk redemptions</h2>
            {canAnalytics && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <input
                  disabled={readOnlyDisabled}
                  className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-sm flex-1 min-w-[200px] disabled:opacity-60"
                  placeholder="Void reason (managers)"
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                />
              </div>
            )}
            <div className="flex flex-wrap items-center gap-4 mb-4">
              <label className="text-sm text-slate-600 flex items-center gap-2">
                Date (UTC)
                <input
                  type="date"
                  value={dateYmd}
                  onChange={(e) => setDateYmd(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-slate-900"
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  void (async () => {
                    try {
                      const r = await loadRedemptions();
                      setRedemptions(r);
                      setError(null);
                    } catch (e) {
                      setError(
                        e instanceof Error ? e.message : "Failed to refresh",
                      );
                    }
                  })();
                }}
                className="text-sm bg-slate-200 hover:bg-slate-300 px-3 py-1 rounded-lg"
              >
                Refresh
              </button>
            </div>
            <div className="rounded-xl border border-slate-200 overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="bg-slate-100 text-slate-600 text-left">
                  <tr>
                    <th className="p-3 font-medium">Staff code</th>
                    <th className="p-3 font-medium">Time (UTC)</th>
                    <th className="p-3 font-medium">Perk</th>
                    <th className="p-3 font-medium">Status</th>
                    {role ? <th className="p-3 font-medium">Actions</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {redemptions.redemptions.map((r) => (
                    <tr
                      key={r.redemptionId}
                      className={`border-t border-slate-200 ${r.voidedAt ? "opacity-50" : ""}`}
                    >
                      <td className="p-3 font-mono text-amber-900">
                        {r.staffVerificationCode}
                      </td>
                      <td className="p-3 text-slate-600">
                        {new Date(r.redeemedAt).toISOString()}
                      </td>
                      <td className="p-3">
                        <span className="text-slate-800">{r.perkTitle}</span>
                        <span className="text-slate-500 text-xs ml-2">
                          ({r.perkCode})
                        </span>
                      </td>
                      <td className="p-3 text-xs text-slate-500">
                        {r.voidedAt
                          ? `Voided`
                          : r.staffAcknowledgedAt
                            ? `Ack`
                            : "—"}
                      </td>
                      <td className="p-3">
                        {!r.voidedAt && role ? (
                          <div className="flex flex-col gap-1">
                            <button
                              type="button"
                              disabled={
                                readOnlyDisabled ||
                                !!actionBusy ||
                                !!r.staffAcknowledgedAt
                              }
                              onClick={() => void ackRedemption(r.redemptionId)}
                              className="text-xs text-brand text-left disabled:opacity-50"
                            >
                              Acknowledge
                            </button>
                            {canAnalytics ? (
                              <button
                                type="button"
                                disabled={readOnlyDisabled || !!actionBusy}
                                onClick={() =>
                                  void voidRedemption(r.redemptionId)
                                }
                                className="text-xs text-red-600 text-left disabled:opacity-50"
                              >
                                Void
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {redemptions.redemptions.length === 0 && (
                <p className="p-6 text-slate-500">No redemptions for this day.</p>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

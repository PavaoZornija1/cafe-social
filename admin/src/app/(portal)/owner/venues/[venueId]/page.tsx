"use client";

import Link from "next/link";
import { UserButton, useAuth } from "@clerk/nextjs";
import { useForm } from "@tanstack/react-form";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ownerFetch } from "@/lib/portalApi";
import { PORTAL_VENUE_CONTEXT_EVENT } from "@/lib/portalVenueContext";
import { OwnerAnalyticsCharts } from "@/components/OwnerAnalyticsCharts";
import { PartnerReadOnlyBanner } from "@/components/PartnerReadOnlyBanner";
import { partnerVenueMutationsBlockedReason } from "@/lib/partnerVenueReadOnly";
import {
  invalidateOwnerVenuePartnerQueries,
  ownerAnalyticsQueryString,
  type OwnerReceiptSummary,
  type OwnerStaffInviteRow,
  type OwnerVenueCampaignRow,
  useOwnerAckRedemptionMutation,
  useOwnerVenueBanPlayerMutation,
  useOwnerCancelStaffInviteMutation,
  useOwnerCreateCampaignMutation,
  useOwnerCreateStaffInviteMutation,
  useOwnerVenueDismissReportMutation,
  useOwnerReceiptDetailQuery,
  useOwnerReviewReceiptMutation,
  useOwnerSendCampaignMutation,
  useOwnerVenueUnbanPlayerMutation,
  useOwnerVenueAnalyticsQuery,
  useOwnerVenueModerationBansQuery,
  useOwnerVenueCampaignsQuery,
  useOwnerVenueReceiptsQuery,
  useOwnerVenueModerationReportsQuery,
  useOwnerVenueStaffInvitesQuery,
  useOwnerVenuesListQuery,
  useOwnerVoidRedemptionMutation,
  useStaffRedemptionsQuery,
} from "@/lib/queries";

type VenueMetaRow = {
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

type RedemptionRow = {
  redemptionId: string;
  staffVerificationCode: string;
  redeemedAt: string;
  perkCode: string;
  perkTitle: string;
  voidedAt: string | null;
  voidReason: string | null;
  staffAcknowledgedAt: string | null;
};

function todayUtc(): string {
  const n = new Date();
  const y = n.getUTCFullYear();
  const m = String(n.getUTCMonth() + 1).padStart(2, "0");
  const d = String(n.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const redemptionCol = createColumnHelper<RedemptionRow>();
const inviteCol = createColumnHelper<OwnerStaffInviteRow>();
const campaignCol = createColumnHelper<OwnerVenueCampaignRow>();
const receiptCol = createColumnHelper<OwnerReceiptSummary>();
const perkCol = createColumnHelper<{
  perkId: string;
  code: string;
  title: string;
  count: number;
}>();
const dayCountCol = createColumnHelper<{ day: string; count: number }>();
const hourCol = createColumnHelper<{ hour: number; count: number }>();

export default function OwnerVenueDetailPage() {
  const params = useParams();
  const venueId = params.venueId as string;
  const { getToken, isLoaded } = useAuth();
  const qc = useQueryClient();

  const [dateYmd, setDateYmd] = useState(todayUtc);
  const [days, setDays] = useState(30);
  const [analyticsFromYmd, setAnalyticsFromYmd] = useState("");
  const [analyticsToYmd, setAnalyticsToYmd] = useState("");
  const [modBanPlayerId, setModBanPlayerId] = useState("");
  const [modBanReason, setModBanReason] = useState("");
  const [voidReason, setVoidReason] = useState("");
  const [receiptIdOpen, setReceiptIdOpen] = useState<string | null>(null);
  const [lastCreatedToken, setLastCreatedToken] = useState<string | null>(null);
  const [clerkInviteNotice, setClerkInviteNotice] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);

  const venuesListQ = useOwnerVenuesListQuery(getToken, Boolean(isLoaded));

  const metaRow = useMemo((): VenueMetaRow | null => {
    const rows = venuesListQ.data?.venues;
    if (!rows) return null;
    const hit = rows.find((v) => v.venue.id === venueId);
    return (hit as VenueMetaRow | undefined) ?? null;
  }, [venuesListQ.data, venueId]);

  const role = metaRow?.role ?? null;
  const venueName = metaRow?.venue.name ?? "";
  const organizationRollupId = metaRow?.venue.organizationId ?? null;
  const orgBilling = metaRow?.venue.organization ?? null;
  const venueLocked = metaRow?.venue.locked ?? false;
  const venueLockReason = metaRow?.venue.lockReason ?? null;
  const platformRole = venuesListQ.data?.platformRole ?? null;
  const actingPartnerVenueId = venuesListQ.data?.actingPartnerVenueId ?? null;

  const canAnalytics = role === "OWNER" || role === "MANAGER";
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
  }, [platformRole, actingPartnerVenueId, venueLocked, venueLockReason, orgBilling]);
  const readOnlyDisabled = Boolean(readOnlyMessage);

  useEffect(() => {
    const fn = () => invalidateOwnerVenuePartnerQueries(qc, venueId);
    window.addEventListener(PORTAL_VENUE_CONTEXT_EVENT, fn);
    return () => window.removeEventListener(PORTAL_VENUE_CONTEXT_EVENT, fn);
  }, [qc, venueId]);

  const analyticsQ = useOwnerVenueAnalyticsQuery(
    venueId,
    days,
    getToken,
    Boolean(isLoaded && metaRow && canAnalytics),
    analyticsFromYmd.trim() || undefined,
    analyticsToYmd.trim() || undefined,
  );
  const modReportsQ = useOwnerVenueModerationReportsQuery(
    venueId,
    getToken,
    Boolean(isLoaded && metaRow && canAnalytics),
  );
  const modBansQ = useOwnerVenueModerationBansQuery(
    venueId,
    getToken,
    Boolean(isLoaded && metaRow && canAnalytics),
  );
  const dismissReportMut = useOwnerVenueDismissReportMutation(venueId, getToken);
  const banPlayerMut = useOwnerVenueBanPlayerMutation(venueId, getToken);
  const unbanPlayerMut = useOwnerVenueUnbanPlayerMutation(venueId, getToken);
  const campaignsQ = useOwnerVenueCampaignsQuery(
    venueId,
    getToken,
    Boolean(isLoaded && metaRow && canAnalytics),
  );
  const receiptsQ = useOwnerVenueReceiptsQuery(
    venueId,
    getToken,
    Boolean(isLoaded && metaRow && canAnalytics),
  );
  const invitesQ = useOwnerVenueStaffInvitesQuery(
    venueId,
    getToken,
    Boolean(isLoaded && metaRow && isOwner),
  );
  const redemptionsQ = useStaffRedemptionsQuery(
    venueId,
    dateYmd,
    getToken,
    Boolean(isLoaded && venueId && metaRow),
  );
  const receiptDetailQ = useOwnerReceiptDetailQuery(
    venueId,
    receiptIdOpen,
    getToken,
    Boolean(receiptIdOpen),
  );

  const createCampMut = useOwnerCreateCampaignMutation(venueId, getToken);
  const sendCampMut = useOwnerSendCampaignMutation(venueId, getToken);
  const createInviteMut = useOwnerCreateStaffInviteMutation(venueId, getToken);
  const cancelInviteMut = useOwnerCancelStaffInviteMutation(venueId, getToken);
  const ackMut = useOwnerAckRedemptionMutation(venueId, dateYmd, getToken);
  const voidMut = useOwnerVoidRedemptionMutation(venueId, dateYmd, days, getToken);
  const reviewMut = useOwnerReviewReceiptMutation(venueId, getToken);

  const inviteForm = useForm({
    defaultValues: {
      email: "",
      role: "EMPLOYEE" as "EMPLOYEE" | "MANAGER",
    },
    onSubmit: async ({ value, formApi }) => {
      setBannerError(null);
      setLastCreatedToken(null);
      setClerkInviteNotice(null);
      const data = (await createInviteMut.mutateAsync({
        email: value.email.trim(),
        role: value.role,
      })) ?? {};
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
      formApi.reset();
    },
  });

  const campaignForm = useForm({
    defaultValues: {
      name: "",
      title: "",
      body: "",
      segmentDays: 30,
    },
    onSubmit: async ({ value, formApi }) => {
      setBannerError(null);
      await createCampMut.mutateAsync({
        name: value.name,
        title: value.title,
        body: value.body,
        segmentDays: value.segmentDays,
      });
      formApi.reset();
    },
  });

  const analytics = analyticsQ.data ?? null;
  const campaigns = campaignsQ.data ?? [];
  const receipts = receiptsQ.data ?? [];
  const invites = invitesQ.data ?? [];
  const redemptionsPayload = redemptionsQ.data ?? null;
  const redemptionRows = redemptionsPayload?.redemptions ?? [];

  const hourSeriesForCharts = useMemo(() => {
    if (!analytics) return null;
    return analytics.analyticsTimeZone && analytics.redemptions.byHourVenue
      ? analytics.redemptions.byHourVenue
      : analytics.redemptions.byHourUtc;
  }, [analytics]);

  const perkRows = useMemo(() => analytics?.redemptions.perPerk ?? [], [analytics]);
  const redeemDayRows = useMemo(
    () => analytics?.redemptions.byDay.filter((r) => r.count > 0) ?? [],
    [analytics],
  );
  const visitDayRows = useMemo(
    () => analytics?.visits.byDay.filter((r) => r.count > 0) ?? [],
    [analytics],
  );
  const hourUtcRows = useMemo(
    () => analytics?.redemptions.byHourUtc.filter((h) => h.count > 0) ?? [],
    [analytics],
  );
  const hourVenueRows = useMemo(
    () => analytics?.redemptions.byHourVenue?.filter((h) => h.count > 0) ?? [],
    [analytics],
  );

  const handleVoid = useCallback(
    async (redemptionId: string) => {
      if (!voidReason.trim()) {
        setBannerError("Enter a void reason (manager/owner).");
        return;
      }
      setBannerError(null);
      await voidMut.mutateAsync({ redemptionId, reason: voidReason.trim() });
      setVoidReason("");
    },
    [voidReason, voidMut],
  );

  const redemptionColumns = useMemo(
    () => [
      redemptionCol.accessor("staffVerificationCode", {
        header: "Staff code",
        cell: (c) => (
          <span className="font-mono text-amber-900">{c.getValue()}</span>
        ),
      }),
      redemptionCol.accessor("redeemedAt", {
        header: "Time (UTC)",
        cell: (c) => (
          <span className="text-slate-600">{new Date(c.getValue()).toISOString()}</span>
        ),
      }),
      redemptionCol.display({
        id: "perk",
        header: "Perk",
        cell: ({ row }) => (
          <span>
            <span className="text-slate-800">{row.original.perkTitle}</span>
            <span className="text-slate-500 text-xs ml-2">({row.original.perkCode})</span>
          </span>
        ),
      }),
      redemptionCol.display({
        id: "status",
        header: "Status",
        cell: ({ row }) => (
          <span className="text-xs text-slate-500">
            {row.original.voidedAt
              ? "Voided"
              : row.original.staffAcknowledgedAt
                ? "Ack"
                : "—"}
          </span>
        ),
      }),
      redemptionCol.display({
        id: "actions",
        header: "Actions",
        cell: ({ row }) =>
          !row.original.voidedAt && role ? (
            <div className="flex flex-col gap-1">
              <button
                type="button"
                disabled={
                  readOnlyDisabled ||
                  ackMut.isPending ||
                  voidMut.isPending ||
                  !!row.original.staffAcknowledgedAt
                }
                onClick={() => void ackMut.mutateAsync(row.original.redemptionId)}
                className="text-xs text-brand text-left disabled:opacity-50"
              >
                Acknowledge
              </button>
              {canAnalytics ? (
                <button
                  type="button"
                  disabled={readOnlyDisabled || ackMut.isPending || voidMut.isPending}
                  onClick={() => void handleVoid(row.original.redemptionId)}
                  className="text-xs text-red-600 text-left disabled:opacity-50"
                >
                  Void
                </button>
              ) : null}
            </div>
          ) : null,
      }),
    ],
    [role, canAnalytics, readOnlyDisabled, ackMut, voidMut, handleVoid],
  );

  const redemptionTable = useReactTable({
    data: redemptionRows,
    columns: redemptionColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (r) => r.redemptionId,
  });

  const inviteColumns = useMemo(
    () => [
      inviteCol.display({
        id: "who",
        header: "Invite",
        cell: ({ row }) => (
          <div>
            <span className="text-slate-800">{row.original.email}</span>
            <span className="text-xs font-mono text-brand ml-2">{row.original.role}</span>
            <p className="text-xs text-slate-500 mt-1">
              {row.original.status} · expires{" "}
              {new Date(row.original.expiresAt).toISOString().slice(0, 10)} · by{" "}
              {row.original.invitedBy.email}
            </p>
          </div>
        ),
      }),
      inviteCol.display({
        id: "cancel",
        header: "",
        cell: ({ row }) =>
          row.original.status === "PENDING" ? (
            <button
              type="button"
              disabled={readOnlyDisabled || cancelInviteMut.isPending}
              onClick={() => void cancelInviteMut.mutateAsync(row.original.id)}
              className="text-xs text-red-600 hover:underline disabled:opacity-50"
            >
              Cancel
            </button>
          ) : null,
      }),
    ],
    [readOnlyDisabled, cancelInviteMut],
  );

  const inviteTable = useReactTable({
    data: invites,
    columns: inviteColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (r) => r.id,
  });

  const campaignColumns = useMemo(
    () => [
      campaignCol.display({
        id: "info",
        header: "Campaign",
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-slate-800">{row.original.name}</p>
            <p className="text-xs text-slate-500">
              {row.original.status} · segment {row.original.segmentDays}d
              {row.original.recipientCount != null
                ? ` · recipients ${row.original.recipientCount}`
                : ""}
            </p>
            {row.original.lastError ? (
              <p className="text-xs text-red-600 mt-1">{row.original.lastError}</p>
            ) : null}
          </div>
        ),
      }),
      campaignCol.display({
        id: "send",
        header: "",
        cell: ({ row }) =>
          row.original.status !== "COMPLETED" ? (
            <button
              type="button"
              disabled={readOnlyDisabled || sendCampMut.isPending}
              onClick={() => void sendCampMut.mutateAsync(row.original.id)}
              className="text-sm bg-amber-50 border border-amber-300 text-amber-900 px-3 py-1 rounded-lg disabled:opacity-50"
            >
              Send now
            </button>
          ) : (
            <span className="text-xs text-slate-500">Sent</span>
          ),
      }),
    ],
    [readOnlyDisabled, sendCampMut],
  );

  const campaignTable = useReactTable({
    data: campaigns,
    columns: campaignColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (r) => r.id,
  });

  const receiptColumns = useMemo(
    () => [
      receiptCol.display({
        id: "sum",
        header: "Submission",
        cell: ({ row }) => (
          <span className="text-sm text-slate-800">
            {row.original.player.email} · {row.original.status}
          </span>
        ),
      }),
      receiptCol.accessor("createdAt", {
        header: "Created",
        cell: (c) => (
          <span className="text-xs text-slate-500">{new Date(c.getValue()).toISOString()}</span>
        ),
      }),
      receiptCol.display({
        id: "open",
        header: "",
        cell: ({ row }) => (
          <button
            type="button"
            className="text-sm text-brand"
            onClick={() => setReceiptIdOpen(row.original.id)}
          >
            Open
          </button>
        ),
      }),
    ],
    [],
  );

  const receiptTable = useReactTable({
    data: receipts,
    columns: receiptColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (r) => r.id,
  });

  const perkColumns = useMemo(
    () => [
      perkCol.display({
        id: "p",
        header: "Perk",
        cell: ({ row }) => (
          <span>
            {row.original.title}{" "}
            <span className="text-slate-500 text-xs">({row.original.code})</span>
          </span>
        ),
      }),
      perkCol.accessor("count", {
        header: "Count",
        cell: (c) => <span>{c.getValue()}</span>,
      }),
    ],
    [],
  );

  const perkTable = useReactTable({
    data: perkRows,
    columns: perkColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (r) => r.perkId,
  });

  const dayCountColumns = useMemo(
    () => [
      dayCountCol.accessor("day", {
        header: "Day (UTC)",
        cell: (c) => <span className="font-mono text-slate-800">{c.getValue()}</span>,
      }),
      dayCountCol.accessor("count", { header: "Count" }),
    ],
    [],
  );

  const redeemDayTable = useReactTable({
    data: redeemDayRows,
    columns: dayCountColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (r) => r.day,
  });

  const visitDayTable = useReactTable({
    data: visitDayRows,
    columns: dayCountColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (r) => r.day,
  });

  const hourColumns = useMemo(
    () => [
      hourCol.display({
        id: "h",
        header: "Hour",
        cell: ({ row }) => (
          <span>
            {String(row.original.hour).padStart(2, "0")}:00 — {row.original.count}
          </span>
        ),
      }),
    ],
    [],
  );

  const hourUtcTable = useReactTable({
    data: hourUtcRows,
    columns: hourColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (r) => String(r.hour),
  });

  const hourVenueTable = useReactTable({
    data: hourVenueRows,
    columns: hourColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (r) => String(r.hour),
  });

  const venueAnalyticsQs = () =>
    ownerAnalyticsQueryString(
      days,
      analyticsFromYmd.trim() || undefined,
      analyticsToYmd.trim() || undefined,
    );

  const downloadCsv = async () => {
    setBannerError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Sign in required");
      const res = await ownerFetch(
        getToken,
        `/owner/venues/${venueId}/analytics/export.csv?${venueAnalyticsQs()}`,
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
      setBannerError(e instanceof Error ? e.message : "CSV download failed");
    }
  };

  const downloadFunnelCsv = async () => {
    setBannerError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Sign in required");
      const res = await ownerFetch(
        getToken,
        `/owner/venues/${venueId}/analytics/funnel-export.csv?${venueAnalyticsQs()}`,
        { method: "GET" },
      );
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `funnel-events-${venueId.slice(0, 8)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setBannerError(e instanceof Error ? e.message : "CSV download failed");
    }
  };

  const accessError =
    venuesListQ.isSuccess && !metaRow
      ? "You do not have access to this venue or it does not exist."
      : null;

  const listErr =
    venuesListQ.isError && venuesListQ.error instanceof Error
      ? venuesListQ.error.message
      : null;

  const shellLoading = venuesListQ.isPending;
  const title = venueName || "Venue";

  const showAnalyticsPending = canAnalytics && metaRow && analyticsQ.isLoading;

  async function reviewReceipt(status: "APPROVED" | "REJECTED", rid: string) {
    setBannerError(null);
    await reviewMut.mutateAsync({ receiptId: rid, status });
    setReceiptIdOpen(null);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-4">
        <div>
          <Link href="/owner/venues" className="text-sm text-brand hover:text-brand">
            ← All venues
          </Link>
          <h1 className="text-xl font-semibold mt-2">
            {title}
            {role ? (
              <span className="ml-3 text-xs font-mono uppercase tracking-wide text-brand align-middle">
                {role}
              </span>
            ) : null}
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
              Manager — analytics, campaigns, receipts, and redemptions. Team invites are
              owner-only.
            </p>
          ) : null}
          {isOwner ? (
            <p className="text-sm text-slate-500 mt-1 max-w-xl">
              Owner — includes staff invitations and subscription links when your org has a billing
              portal URL.
            </p>
          ) : null}
          {organizationRollupId ? (
            <p className="text-sm mt-2">
              <Link
                href={`/owner/organizations/${organizationRollupId}`}
                className="text-amber-700 hover:underline"
              >
                Organization roll-up (all locations) →
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
                {orgBilling.platformBillingPlan ?? "—"} · {orgBilling.platformBillingStatus}
                {orgBilling.platformBillingRenewsAt
                  ? ` · renews ${orgBilling.platformBillingRenewsAt.slice(0, 10)}`
                  : ""}
                {orgBilling.platformBillingStatus === "ACTIVE_CANCELING"
                  ? " · ends at period end"
                  : ""}
                {orgBilling.platformBillingStatus === "CANCELED"
                  ? " · contact support to restore organization billing"
                  : ""}
              </span>
            </p>
          ) : null}
        </div>
        <UserButton />
      </header>

      <main className="p-6 max-w-4xl mx-auto space-y-10 pb-24">
        {shellLoading ? <p className="text-slate-600">Loading…</p> : null}
        {(listErr || accessError || bannerError || redemptionsQ.isError) && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm">
            {listErr ??
              accessError ??
              bannerError ??
              (redemptionsQ.error instanceof Error ? redemptionsQ.error.message : null)}
          </div>
        )}
        {readOnlyMessage ? <PartnerReadOnlyBanner message={readOnlyMessage} /> : null}

        {canAnalytics && metaRow && (
          <section>
            {showAnalyticsPending ? (
              <p className="text-slate-600 text-sm mb-4">Loading analytics…</p>
            ) : null}
            {analytics && !accessError && (
              <>
                <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
                  <h2 className="text-lg font-medium">Analytics</h2>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={readOnlyDisabled}
                      onClick={() => void downloadCsv()}
                      className="text-sm bg-emerald-50 border border-emerald-300 text-emerald-900 px-3 py-1 rounded-lg hover:bg-emerald-100 disabled:opacity-50"
                    >
                      Redemptions CSV
                    </button>
                    <button
                      type="button"
                      disabled={readOnlyDisabled}
                      onClick={() => void downloadFunnelCsv()}
                      className="text-sm bg-emerald-50 border border-emerald-300 text-emerald-900 px-3 py-1 rounded-lg hover:bg-emerald-100 disabled:opacity-50"
                    >
                      Funnel CSV
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
                    <label className="text-sm text-slate-600 flex items-center gap-2">
                      From
                      <input
                        type="date"
                        value={analyticsFromYmd}
                        onChange={(e) => setAnalyticsFromYmd(e.target.value)}
                        className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-slate-900"
                      />
                    </label>
                    <label className="text-sm text-slate-600 flex items-center gap-2">
                      To
                      <input
                        type="date"
                        value={analyticsToYmd}
                        onChange={(e) => setAnalyticsToYmd(e.target.value)}
                        className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-slate-900"
                      />
                    </label>
                    <button
                      type="button"
                      className="text-xs text-slate-500 hover:underline"
                      onClick={() => {
                        setAnalyticsFromYmd("");
                        setAnalyticsToYmd("");
                      }}
                    >
                      Clear range
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mb-2">
                  Custom from/to overrides the rolling window when both are set (UTC dates).
                </p>
                <p className="text-xs text-slate-500 mb-4">
                  UTC range {analytics.period.startDay} → {analytics.period.endDay}
                  {analytics.analyticsTimeZone
                    ? ` · Venue TZ: ${analytics.analyticsTimeZone}`
                    : ""}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm text-slate-600">Active redemptions</p>
                    <p className="text-2xl font-semibold mt-1">{analytics.redemptions.total}</p>
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
                      {analytics.funnel.uniqueRedeemers} / {analytics.funnel.uniqueVisitors}{" "}
                      redeemers
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      ≈ {analytics.funnel.visitToRedeemPercent}% of visitors redeemed
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm text-slate-600">Feed events</p>
                    <p className="text-2xl font-semibold mt-1">{analytics.feedEvents.total}</p>
                  </div>
                </div>

                <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="text-sm font-semibold text-slate-800 mb-3">
                    Funnel journey (detect → enter → play → redeem)
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-slate-500">Detect impressions</p>
                      <p className="text-lg font-semibold text-slate-900">
                        {analytics.funnelJourney.detectImpressions}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Unique entered</p>
                      <p className="text-lg font-semibold text-slate-900">
                        {analytics.funnelJourney.uniqueEntered}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Unique played</p>
                      <p className="text-lg font-semibold text-slate-900">
                        {analytics.funnelJourney.uniquePlayed}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Unique redeemed</p>
                      <p className="text-lg font-semibold text-slate-900">
                        {analytics.funnelJourney.uniqueRedeemed}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-3">
                    Enter→play {analytics.funnelJourney.enterToPlayPercent}% · play→redeem{" "}
                    {analytics.funnelJourney.playToRedeemPercent}% · entered→redeem{" "}
                    {analytics.funnelJourney.enteredToRedeemPercent}%
                  </p>
                </div>

                <OwnerAnalyticsCharts
                  visitsByDay={analytics.visits.byDay}
                  redemptionsByDay={analytics.redemptions.byDay}
                  byHour={hourSeriesForCharts}
                />

                <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-medium text-slate-800 mb-2">Per perk</h3>
                    <div className="max-h-48 overflow-auto rounded-lg border border-slate-200">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-100 sticky top-0 text-slate-600">
                          {perkTable.getHeaderGroups().map((hg) => (
                            <tr key={hg.id}>
                              {hg.headers.map((h) => (
                                <th key={h.id} className="p-2 text-left">
                                  {flexRender(h.column.columnDef.header, h.getContext())}
                                </th>
                              ))}
                            </tr>
                          ))}
                        </thead>
                        <tbody>
                          {perkTable.getRowModel().rows.map((row) => (
                            <tr key={row.id} className="border-t border-slate-200">
                              {row.getVisibleCells().map((cell) => (
                                <td key={cell.id} className="p-2">
                                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </td>
                              ))}
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
                      <table className="w-full">
                        <tbody>
                          {hourUtcTable.getRowModel().rows.map((row) => (
                            <tr key={row.id}>
                              <td className="py-0.5">
                                {flexRender(
                                  row.getVisibleCells()[0].column.columnDef.cell,
                                  row.getVisibleCells()[0].getContext(),
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                {analytics.redemptions.byHourVenue && (
                  <div className="mt-6">
                    <h3 className="text-sm font-medium text-slate-800 mb-2">
                      Redemptions by hour (venue TZ)
                    </h3>
                    <div className="max-h-48 overflow-auto rounded-lg border border-slate-200 text-xs font-mono p-2 text-slate-600">
                      <table className="w-full">
                        <tbody>
                          {hourVenueTable.getRowModel().rows.map((row) => (
                            <tr key={row.id}>
                              <td className="py-0.5">
                                {flexRender(
                                  row.getVisibleCells()[0].column.columnDef.cell,
                                  row.getVisibleCells()[0].getContext(),
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-medium text-slate-800 mb-2">Redemptions by day</h3>
                    <div className="max-h-56 overflow-auto rounded-lg border border-slate-200">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-100 sticky top-0">
                          <tr className="text-left text-slate-500">
                            {redeemDayTable.getHeaderGroups()[0]?.headers.map((h) => (
                              <th key={h.id} className="p-2 font-medium">
                                {flexRender(h.column.columnDef.header, h.getContext())}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {redeemDayTable.getRowModel().rows.map((row) => (
                            <tr key={row.id} className="border-t border-slate-200">
                              {row.getVisibleCells().map((cell) => (
                                <td key={cell.id} className="p-2">
                                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-slate-800 mb-2">Visit days by day</h3>
                    <div className="max-h-56 overflow-auto rounded-lg border border-slate-200">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-100 sticky top-0">
                          <tr className="text-left text-slate-500">
                            {visitDayTable.getHeaderGroups()[0]?.headers.map((h) => (
                              <th key={h.id} className="p-2 font-medium">
                                {flexRender(h.column.columnDef.header, h.getContext())}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {visitDayTable.getRowModel().rows.map((row) => (
                            <tr key={row.id} className="border-t border-slate-200">
                              {row.getVisibleCells().map((cell) => (
                                <td key={cell.id} className="p-2">
                                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </>
            )}
          </section>
        )}

        {canAnalytics && metaRow && (
          <section className="border border-slate-200 rounded-xl p-4 space-y-4">
            <h2 className="text-lg font-medium">Moderation</h2>
            <p className="text-xs text-slate-500">
              Open player reports and venue bans. Banning blocks play and redemptions at this
              location. Dismiss clears a report without banning.
            </p>
            {modReportsQ.isError ? (
              <p className="text-sm text-red-700">
                {modReportsQ.error instanceof Error ? modReportsQ.error.message : "Reports failed"}
              </p>
            ) : null}
            <div>
              <h3 className="text-sm font-medium text-slate-800 mb-2">Recent reports</h3>
              {(modReportsQ.data ?? []).length === 0 ? (
                <p className="text-sm text-slate-500">No open reports.</p>
              ) : (
                <ul className="text-sm space-y-2 divide-y divide-slate-100">
                  {(modReportsQ.data ?? []).map((r) => (
                    <li key={r.id} className="pt-2 first:pt-0">
                      <p className="text-slate-800">
                        <span className="font-mono text-xs">{r.reportedPlayer.email}</span>{" "}
                        <span className="text-slate-500">
                          (@{r.reportedPlayer.username} · {r.reportedPlayer.id.slice(0, 8)}…)
                        </span>
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Reason: {r.reason}
                        {r.note ? ` — ${r.note}` : ""}
                      </p>
                      <p className="text-xs text-slate-500">
                        By {r.reporter.email} · {new Date(r.createdAt).toLocaleString()}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <button
                          type="button"
                          disabled={readOnlyDisabled || dismissReportMut.isPending}
                          onClick={() => void dismissReportMut.mutateAsync(r.id)}
                          className="text-xs border border-slate-300 rounded px-2 py-1 hover:bg-slate-50 disabled:opacity-50"
                        >
                          Dismiss
                        </button>
                        <button
                          type="button"
                          disabled={readOnlyDisabled || banPlayerMut.isPending}
                          onClick={() =>
                            void banPlayerMut.mutateAsync({
                              playerId: r.reportedPlayerId,
                              reason: `Report: ${r.reason}`.slice(0, 512),
                            })
                          }
                          className="text-xs border border-amber-300 text-amber-900 rounded px-2 py-1 hover:bg-amber-50 disabled:opacity-50"
                        >
                          Ban player
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-800 mb-2">Active bans</h3>
              {(modBansQ.data ?? []).length === 0 ? (
                <p className="text-sm text-slate-500">No bans at this venue.</p>
              ) : (
                <ul className="text-sm space-y-2">
                  {(modBansQ.data ?? []).map((b) => (
                    <li
                      key={b.id}
                      className="flex flex-wrap items-center justify-between gap-2 border border-slate-100 rounded-lg px-3 py-2"
                    >
                      <span>
                        <span className="font-mono text-xs">{b.player.email}</span>{" "}
                        <span className="text-slate-500 text-xs">
                          {b.player.id.slice(0, 8)}…
                        </span>
                        {b.reason ? (
                          <span className="block text-xs text-slate-600 mt-0.5">{b.reason}</span>
                        ) : null}
                      </span>
                      <button
                        type="button"
                        disabled={readOnlyDisabled || unbanPlayerMut.isPending}
                        onClick={() => void unbanPlayerMut.mutateAsync(b.playerId)}
                        className="text-xs text-emerald-800 hover:underline disabled:opacity-50"
                      >
                        Remove ban
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="border-t border-slate-100 pt-4">
              <h3 className="text-sm font-medium text-slate-800 mb-2">Ban by player ID</h3>
              <div className="flex flex-wrap gap-2 items-end">
                <label className="text-sm text-slate-600 flex-1 min-w-[200px]">
                  Player UUID
                  <input
                    className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono"
                    value={modBanPlayerId}
                    onChange={(e) => setModBanPlayerId(e.target.value)}
                    placeholder="00000000-0000-…"
                  />
                </label>
                <label className="text-sm text-slate-600 flex-1 min-w-[180px]">
                  Reason (optional)
                  <input
                    className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    value={modBanReason}
                    onChange={(e) => setModBanReason(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  disabled={
                    readOnlyDisabled ||
                    banPlayerMut.isPending ||
                    !/^[0-9a-f-]{36}$/i.test(modBanPlayerId.trim())
                  }
                  onClick={async () => {
                    await banPlayerMut.mutateAsync({
                      playerId: modBanPlayerId.trim(),
                      reason: modBanReason.trim() || null,
                    });
                    setModBanPlayerId("");
                    setModBanReason("");
                  }}
                  className="bg-amber-100 border border-amber-300 text-amber-950 rounded-lg px-3 py-2 text-sm h-[38px] disabled:opacity-50"
                >
                  Ban
                </button>
              </div>
            </div>
          </section>
        )}

        {isOwner && metaRow && (
          <section className="border border-slate-200 rounded-xl p-4 space-y-4">
            <h2 className="text-lg font-medium">Staff invites</h2>
            <p className="text-xs text-slate-500">
              We create a venue invite and, when the API has{" "}
              <code className="text-slate-600">CLERK_SECRET_KEY</code> +{" "}
              <code className="text-slate-600">ADMIN_PORTAL_ORIGIN</code>, Clerk emails a sign-up
              link. The invitee must use the same email, then complete{" "}
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
            <form
              className="flex flex-wrap gap-2 items-end"
              onSubmit={(e) => {
                e.preventDefault();
                void inviteForm.handleSubmit();
              }}
            >
              <inviteForm.Field name="email">
                {(field) => (
                  <label className="block text-sm text-slate-600 flex-1 min-w-[200px]">
                    Email
                    <input
                      type="email"
                      disabled={readOnlyDisabled}
                      className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm disabled:opacity-60"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      placeholder="staff@venue.com"
                    />
                  </label>
                )}
              </inviteForm.Field>
              <inviteForm.Field name="role">
                {(field) => (
                  <label className="block text-sm text-slate-600">
                    Role
                    <select
                      disabled={readOnlyDisabled}
                      className="mt-1 block w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm disabled:opacity-60"
                      value={field.state.value}
                      onChange={(e) =>
                        field.handleChange(e.target.value as "EMPLOYEE" | "MANAGER")
                      }
                      onBlur={field.handleBlur}
                    >
                      <option value="EMPLOYEE">EMPLOYEE</option>
                      {role === "OWNER" ? <option value="MANAGER">MANAGER</option> : null}
                    </select>
                  </label>
                )}
              </inviteForm.Field>
              <inviteForm.Subscribe selector={(s) => s.values.email}>
                {(email) => (
                  <button
                    type="submit"
                    disabled={
                      readOnlyDisabled || createInviteMut.isPending || !email.trim()
                    }
                    className="bg-slate-200 hover:bg-slate-300 disabled:opacity-50 rounded-lg px-4 py-2 text-sm h-[38px]"
                  >
                    Send invite
                  </button>
                )}
              </inviteForm.Subscribe>
            </form>
            <div className="border border-slate-200 rounded-lg overflow-hidden text-sm">
              {invites.length === 0 ? (
                <p className="p-3 text-slate-500">No invite history yet for this venue.</p>
              ) : (
                <table className="w-full">
                  <tbody>
                    {inviteTable.getRowModel().rows.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-slate-200 last:border-0 bg-brand-light/60"
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="p-3">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        )}

        {canAnalytics && metaRow && (
          <section className="border border-slate-200 rounded-xl p-4 space-y-4">
            <h2 className="text-lg font-medium">Marketing campaigns</h2>
            <p className="text-xs text-slate-500">
              Push to players who visited this venue in the last N UTC days. Only sends to accounts
              with partner marketing on and not in total privacy (server-side).
            </p>
            <form
              className="grid gap-2 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                void campaignForm.handleSubmit();
              }}
            >
              <campaignForm.Field name="name">
                {(field) => (
                  <input
                    disabled={readOnlyDisabled}
                    className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm disabled:opacity-60"
                    placeholder="Internal name"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                )}
              </campaignForm.Field>
              <campaignForm.Field name="segmentDays">
                {(field) => (
                  <input
                    type="number"
                    min={1}
                    max={365}
                    disabled={readOnlyDisabled}
                    className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm disabled:opacity-60"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(Number(e.target.value))}
                    onBlur={field.handleBlur}
                  />
                )}
              </campaignForm.Field>
              <campaignForm.Field name="title">
                {(field) => (
                  <input
                    disabled={readOnlyDisabled}
                    className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm sm:col-span-2 disabled:opacity-60"
                    placeholder="Notification title"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                )}
              </campaignForm.Field>
              <campaignForm.Field name="body">
                {(field) => (
                  <textarea
                    disabled={readOnlyDisabled}
                    className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-[80px] sm:col-span-2 disabled:opacity-60"
                    placeholder="Notification body"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                )}
              </campaignForm.Field>
              <button
                type="submit"
                disabled={readOnlyDisabled || createCampMut.isPending}
                className="bg-brand hover:bg-brand-hover disabled:opacity-50 rounded-lg px-4 py-2 text-sm font-semibold sm:col-span-2 justify-self-start"
              >
                Save draft campaign
              </button>
            </form>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              {campaigns.length === 0 ? (
                <p className="p-4 text-slate-500 text-sm">No campaigns yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {campaignTable.getRowModel().rows.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-slate-200 last:border-0 bg-brand-light/60"
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="p-3">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        )}

        {canAnalytics && metaRow && (
          <section className="border border-slate-200 rounded-xl p-4 space-y-4">
            <h2 className="text-lg font-medium">Receipt submissions</h2>
            <p className="text-xs text-slate-500">
              90-day retention target per submission. Approve or reject from detail view.
            </p>
            <button
              type="button"
              onClick={() => void receiptsQ.refetch()}
              className="text-sm text-brand"
            >
              Refresh list
            </button>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              {receipts.length === 0 ? (
                <p className="p-4 text-slate-500 text-sm">No receipts.</p>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {receiptTable.getRowModel().rows.map((row) => (
                      <tr key={row.id} className="border-b border-slate-200 last:border-0">
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className={cell.column.id === "sum" ? "p-3" : "p-3"}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {receiptIdOpen ? (
              <div className="border border-slate-300 rounded-lg p-4 space-y-3 bg-slate-50">
                {receiptDetailQ.isPending ? (
                  <p className="text-sm text-slate-500">Loading receipt…</p>
                ) : null}
                {receiptDetailQ.isError && receiptDetailQ.error instanceof Error ? (
                  <p className="text-sm text-red-700">{receiptDetailQ.error.message}</p>
                ) : null}
                {receiptDetailQ.data ? (
                  <>
                    <p className="text-sm text-slate-600">
                      {receiptDetailQ.data.player.email} — {receiptDetailQ.data.status}
                    </p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={receiptDetailQ.data.imageData}
                      alt="Receipt"
                      className="max-h-64 rounded border border-slate-300"
                    />
                    {receiptDetailQ.data.status === "PENDING" ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={readOnlyDisabled || reviewMut.isPending}
                          onClick={() =>
                            void reviewReceipt("APPROVED", receiptDetailQ.data!.id)
                          }
                          className="bg-emerald-800 text-white px-3 py-2 rounded-lg text-sm disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={readOnlyDisabled || reviewMut.isPending}
                          onClick={() =>
                            void reviewReceipt("REJECTED", receiptDetailQ.data!.id)
                          }
                          className="bg-red-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => setReceiptIdOpen(null)}
                          className="text-slate-600 text-sm px-2"
                        >
                          Close
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setReceiptIdOpen(null)}
                        className="text-slate-600 text-sm px-2"
                      >
                        Close
                      </button>
                    )}
                  </>
                ) : null}
              </div>
            ) : null}
          </section>
        )}

        {redemptionsPayload && metaRow && (
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
                onClick={() => void redemptionsQ.refetch()}
                className="text-sm bg-slate-200 hover:bg-slate-300 px-3 py-1 rounded-lg"
              >
                Refresh
              </button>
            </div>
            <div className="rounded-xl border border-slate-200 overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="bg-slate-100 text-slate-600 text-left">
                  {redemptionTable.getHeaderGroups().map((hg) => (
                    <tr key={hg.id}>
                      {hg.headers.map((h) => (
                        <th key={h.id} className="p-3 font-medium">
                          {flexRender(h.column.columnDef.header, h.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {redemptionTable.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className={`border-t border-slate-200 ${row.original.voidedAt ? "opacity-50" : ""}`}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="p-3">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {redemptionRows.length === 0 && (
                <p className="p-6 text-slate-500">No redemptions for this day.</p>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

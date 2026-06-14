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
import { useTranslation } from "react-i18next";
import { ownerFetch } from "@/lib/portalApi";
import { PORTAL_VENUE_CONTEXT_EVENT } from "@/lib/portalVenueContext";
import { OwnerAnalyticsCharts } from "@/components/OwnerAnalyticsCharts";
import { OwnerAnalyticsRoiSnapshot } from "@/components/OwnerAnalyticsRoiSnapshot";
import { PartnerReadOnlyBanner } from "@/components/PartnerReadOnlyBanner";
import { DayCountCards, HourCountCards, PerkCountCards, TableRowCards } from "@/components/TableRowCards";
import { partnerVenueMutationsBlockedNotice } from "@/lib/partnerReadOnlyMessages";
import {
  invalidateOwnerVenuePartnerQueries,
  ownerAnalyticsQueryString,
  type OwnerCampaignBindingRow,
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
  useOwnerVenueGeofenceDwellQuery,
  useOwnerVenueModerationAuditQuery,
  useOwnerVenueModerationBansQuery,
  useOwnerAddCampaignBindingMutation,
  useOwnerCampaignBindingsQuery,
  useOwnerDeleteCampaignBindingMutation,
  useOwnerVenueCampaignsQuery,
  useOwnerVenueReceiptsQuery,
  useOwnerVenueModerationReportsQuery,
  useOwnerVenueBanAppealsQuery,
  useOwnerVenueResolveBanAppealMutation,
  useOwnerVenueStaffInvitesQuery,
  useOwnerVenuesListQuery,
  useOwnerVoidRedemptionMutation,
  useStaffRedemptionsQuery,
} from "@/lib/queries";
import { CAMPAIGN_COPY_TEMPLATES } from "@/lib/campaignCopyTemplates";
import {
  previousComparisonUtcRange,
  resolveFrontendAnalyticsPeriod,
} from "@/lib/analyticsPeriodClient";

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
  issuedAt: string;
  redeemedAt: string | null;
  expiresAt: string;
  status: string;
  perkCode: string;
  perkTitle: string;
  voidedAt: string | null;
  voidReason: string | null;
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

const CAMPAIGN_BINDING_TYPES = ["CHALLENGE", "VENUE_PERK", "VENUE_OFFER"] as const;

function CampaignBindingsEditor({
  venueId,
  campaignId,
  getToken,
  readOnlyDisabled,
}: {
  venueId: string;
  campaignId: string;
  getToken: () => Promise<string | null>;
  readOnlyDisabled: boolean;
}) {
  const { t } = useTranslation();
  const bindingsQ = useOwnerCampaignBindingsQuery(venueId, campaignId, getToken, true);
  const addMut = useOwnerAddCampaignBindingMutation(venueId, campaignId, getToken);
  const delMut = useOwnerDeleteCampaignBindingMutation(venueId, campaignId, getToken);
  const [entityType, setEntityType] = useState<(typeof CAMPAIGN_BINDING_TYPES)[number]>(
    "CHALLENGE",
  );
  const [entityId, setEntityId] = useState("");

  const rows = bindingsQ.data ?? [];

  return (
    <div className="border-t border-slate-200 bg-slate-50 p-4 space-y-3 text-sm">
      <p className="text-xs text-slate-600">
        {t("admin.partnerVenueDetail.bindings.lead")}
      </p>
      {bindingsQ.isPending ? (
        <p className="text-slate-500">{t("admin.partnerVenueDetail.bindings.loadingBindings")}</p>
      ) : null}
      {bindingsQ.isError && bindingsQ.error instanceof Error ? (
        <p className="text-red-700 text-xs">{bindingsQ.error.message}</p>
      ) : null}
      {rows.length === 0 && !bindingsQ.isPending ? (
        <p className="text-xs text-slate-500">{t("admin.partnerVenueDetail.bindings.noBindings")}</p>
      ) : null}
      <ul className="space-y-1">
        {rows.map((b: OwnerCampaignBindingRow) => (
          <li
            key={b.id}
            className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-800"
          >
            <span>
              <span className="font-medium">{b.entityType}</span>{" "}
              <code className="bg-white px-1 rounded border border-slate-200">{b.entityId}</code>
            </span>
            <button
              type="button"
              disabled={readOnlyDisabled || delMut.isPending}
              className="text-red-700 hover:underline disabled:opacity-50"
              onClick={() => void delMut.mutateAsync(b.id)}
            >
              {t("admin.partnerVenueDetail.bindings.remove")}
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2 items-end pt-2 border-t border-slate-200">
        <label className="text-xs text-slate-600 flex flex-col gap-1">
          {t("admin.partnerVenueDetail.bindings.type")}
          <select
            className="border border-slate-300 rounded px-2 py-1 text-sm bg-white"
            value={entityType}
            disabled={readOnlyDisabled}
            onChange={(e) =>
              setEntityType(e.target.value as (typeof CAMPAIGN_BINDING_TYPES)[number])
            }
          >
            {CAMPAIGN_BINDING_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-600 flex flex-col gap-1 min-w-[200px] flex-1">
          {t("admin.partnerVenueDetail.bindings.entityUuid")}
          <input
            className="border border-slate-300 rounded px-2 py-1 text-sm bg-white font-mono"
            placeholder={t("admin.partnerVenueDetail.bindings.entityUuidPlaceholder")}
            value={entityId}
            disabled={readOnlyDisabled}
            onChange={(e) => setEntityId(e.target.value.trim())}
          />
        </label>
        <button
          type="button"
          disabled={readOnlyDisabled || addMut.isPending || !entityId}
          className="bg-brand text-white text-sm px-3 py-2 rounded-lg disabled:opacity-50"
          onClick={() => {
            void addMut.mutateAsync({ entityType, entityId }).then(() => setEntityId(""));
          }}
        >
          {t("admin.partnerVenueDetail.bindings.addBinding")}
        </button>
      </div>
    </div>
  );
}

export default function OwnerVenueDetailPage() {
  const { t } = useTranslation();
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
  const [appealsIncludeResolved, setAppealsIncludeResolved] = useState(false);
  const [appealsFromYmd, setAppealsFromYmd] = useState("");
  const [appealsToYmd, setAppealsToYmd] = useState("");
  const [appealStaffNote, setAppealStaffNote] = useState<Record<string, string>>({});
  const [appealStaffMessage, setAppealStaffMessage] = useState<Record<string, string>>({});
  const [appealNotifyPlayer, setAppealNotifyPlayer] = useState<Record<string, boolean>>({});
  const [reportDismissNotes, setReportDismissNotes] = useState<Record<string, string>>({});
  const [auditOpen, setAuditOpen] = useState(false);
  const [bindingsCampaignId, setBindingsCampaignId] = useState<string | null>(null);

  const STAFF_NOTE_TEMPLATES = [
    t("admin.partnerVenueDetail.moderation.noteTemplateReviewed"),
    t("admin.partnerVenueDetail.moderation.noteTemplateResolvedInformally"),
    t("admin.partnerVenueDetail.moderation.noteTemplateEscalating"),
    t("admin.partnerVenueDetail.moderation.noteTemplateDuplicate"),
  ];

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

  const readOnlyNotice = useMemo(() => {
    if (platformRole === "SUPER_ADMIN" && !actingPartnerVenueId) {
      return null;
    }
    return partnerVenueMutationsBlockedNotice({
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
  const readOnlyDisabled = Boolean(readOnlyNotice);

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
  const analyticsComparisonRange = useMemo(() => {
    const cur = resolveFrontendAnalyticsPeriod(
      days,
      analyticsFromYmd.trim() || undefined,
      analyticsToYmd.trim() || undefined,
    );
    return previousComparisonUtcRange(cur.startDay, cur.endDay);
  }, [days, analyticsFromYmd, analyticsToYmd]);

  const analyticsPrevQ = useOwnerVenueAnalyticsQuery(
    venueId,
    days,
    getToken,
    Boolean(isLoaded && metaRow && canAnalytics),
    analyticsComparisonRange.from,
    analyticsComparisonRange.to,
  );
  const geofenceDwellQ = useOwnerVenueGeofenceDwellQuery(
    venueId,
    days,
    getToken,
    Boolean(isLoaded && metaRow && canAnalytics),
    analyticsFromYmd.trim() || undefined,
    analyticsToYmd.trim() || undefined,
  );
  const moderationAuditQ = useOwnerVenueModerationAuditQuery(
    venueId,
    getToken,
    Boolean(isLoaded && metaRow && canAnalytics && auditOpen),
    80,
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
  const modAppealsQ = useOwnerVenueBanAppealsQuery(
    venueId,
    getToken,
    Boolean(isLoaded && metaRow && canAnalytics),
    {
      includeResolved: appealsIncludeResolved,
      fromYmd: appealsFromYmd.trim() || undefined,
      toYmd: appealsToYmd.trim() || undefined,
    },
  );

  const bannedPlayerIds = useMemo(() => {
    const rows = modBansQ.data ?? [];
    return new Set(rows.map((b) => b.playerId));
  }, [modBansQ.data]);
  const resolveAppealMut = useOwnerVenueResolveBanAppealMutation(venueId, getToken);
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
          t("admin.partnerVenueDetail.staffInvites.clerkSentNotice"),
        );
      } else if (data.clerkInvitationError) {
        setClerkInviteNotice(
          t("admin.partnerVenueDetail.staffInvites.clerkErrorNotice", {
            error: data.clerkInvitationError.slice(0, 120),
          }),
        );
      } else {
        setClerkInviteNotice(
          t("admin.partnerVenueDetail.staffInvites.clerkMissingConfigNotice"),
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
        setBannerError(t("admin.partnerVenueDetail.redemptions.enterVoidReasonError"));
        return;
      }
      setBannerError(null);
      await voidMut.mutateAsync({ redemptionId, reason: voidReason.trim() });
      setVoidReason("");
    },
    [voidReason, voidMut, t],
  );

  const redemptionColumns = useMemo(
    () => [
      redemptionCol.accessor("staffVerificationCode", {
        header: t("admin.partnerVenueDetail.redemptions.staffCode"),
        cell: (c) => (
          <span className="font-mono text-amber-900">{c.getValue()}</span>
        ),
      }),
      redemptionCol.accessor("issuedAt", {
        header: t("admin.partnerVenueDetail.redemptions.timeUtc"),
        cell: (c) => (
          <span className="text-slate-600">{new Date(c.getValue()).toISOString()}</span>
        ),
      }),
      redemptionCol.display({
        id: "perk",
        header: t("admin.partnerVenueDetail.redemptions.perk"),
        cell: ({ row }) => (
          <span>
            <span className="text-slate-800">{row.original.perkTitle}</span>
            <span className="text-slate-500 text-xs ml-2">({row.original.perkCode})</span>
          </span>
        ),
      }),
      redemptionCol.display({
        id: "status",
        header: t("admin.partnerVenueDetail.redemptions.status"),
        cell: ({ row }) => (
          <span className="text-xs text-slate-500">
            {row.original.status}
          </span>
        ),
      }),
      redemptionCol.display({
        id: "actions",
        header: t("admin.partnerVenueDetail.redemptions.actions"),
        cell: ({ row }) =>
          !row.original.voidedAt && role ? (
            <div className="flex flex-col gap-1">
              <button
                type="button"
                disabled={
                  readOnlyDisabled ||
                  ackMut.isPending ||
                  voidMut.isPending ||
                  row.original.status === "REDEEMED"
                }
                onClick={() => void ackMut.mutateAsync(row.original.redemptionId)}
                className="text-xs text-brand text-left disabled:opacity-50"
              >
                {t("admin.partnerVenueDetail.redemptions.acknowledge")}
              </button>
              {canAnalytics ? (
                <button
                  type="button"
                  disabled={readOnlyDisabled || ackMut.isPending || voidMut.isPending}
                  onClick={() => void handleVoid(row.original.redemptionId)}
                  className="text-xs text-red-600 text-left disabled:opacity-50"
                >
                  {t("admin.partnerVenueDetail.redemptions.void")}
                </button>
              ) : null}
            </div>
          ) : null,
      }),
    ],
    [role, canAnalytics, readOnlyDisabled, ackMut, voidMut, handleVoid, t],
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
        header: t("admin.partnerVenueDetail.staffInvites.invite"),
        cell: ({ row }) => (
          <div>
            <span className="text-slate-800">{row.original.email}</span>
            <span className="text-xs font-mono text-brand ml-2">
              {t(`admin.partnerVenueDetail.roles.${row.original.role}`)}
            </span>
            <p className="text-xs text-slate-500 mt-1">
              {t("admin.partnerVenueDetail.staffInvites.expiresBy", {
                status: row.original.status,
                date: new Date(row.original.expiresAt).toISOString().slice(0, 10),
                inviter: row.original.invitedBy.email,
              })}
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
              {t("admin.partnerVenueDetail.staffInvites.cancelInvite")}
            </button>
          ) : null,
      }),
    ],
    [readOnlyDisabled, cancelInviteMut, t],
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
        header: t("admin.partnerVenueDetail.campaigns.campaign"),
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-slate-800">{row.original.name}</p>
            <p className="text-xs text-slate-500">
              {t("admin.partnerVenueDetail.campaigns.campaignStatusSegment", {
                status: row.original.status,
                days: row.original.segmentDays,
              })}
              {row.original.recipientCount != null
                ? t("admin.partnerVenueDetail.campaigns.campaignRecipients", {
                    count: row.original.recipientCount,
                  })
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
              {t("admin.partnerVenueDetail.campaigns.sendNow")}
            </button>
          ) : (
            <span className="text-xs text-slate-500">
              {t("admin.partnerVenueDetail.common.statusSent")}
            </span>
          ),
      }),
      campaignCol.display({
        id: "bindings",
        header: "",
        cell: ({ row }) => (
          <button
            type="button"
            className="text-sm text-brand"
            onClick={() =>
              setBindingsCampaignId((prev) =>
                prev === row.original.id ? null : row.original.id,
              )
            }
          >
            {bindingsCampaignId === row.original.id
              ? t("admin.partnerVenueDetail.campaigns.hideBindings")
              : t("admin.partnerVenueDetail.campaigns.bindings")}
          </button>
        ),
      }),
    ],
    [readOnlyDisabled, sendCampMut, bindingsCampaignId, t],
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
        header: t("admin.partnerVenueDetail.receipts.submission"),
        cell: ({ row }) => (
          <span className="text-sm text-slate-800">
            {row.original.player.email} · {row.original.status}
          </span>
        ),
      }),
      receiptCol.accessor("createdAt", {
        header: t("admin.partnerVenueDetail.receipts.created"),
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
            {t("admin.partnerVenueDetail.common.open")}
          </button>
        ),
      }),
    ],
    [t],
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
        header: t("admin.partnerVenueDetail.analytics.perPerk"),
        cell: ({ row }) => (
          <span>
            {row.original.title}{" "}
            <span className="text-slate-500 text-xs">({row.original.code})</span>
          </span>
        ),
      }),
      perkCol.accessor("count", {
        header: t("admin.partnerVenueDetail.analytics.count"),
        cell: (c) => <span>{c.getValue()}</span>,
      }),
    ],
    [t],
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
        header: t("admin.partnerVenueDetail.analytics.dayUtc"),
        cell: (c) => <span className="font-mono text-slate-800">{c.getValue()}</span>,
      }),
      dayCountCol.accessor("count", { header: t("admin.partnerVenueDetail.analytics.count") }),
    ],
    [t],
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
        header: t("admin.partnerVenueDetail.analytics.hour"),
        cell: ({ row }) => (
          <span>
            {String(row.original.hour).padStart(2, "0")}:00 — {row.original.count}
          </span>
        ),
      }),
    ],
    [t],
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
      if (!token) throw new Error(t("admin.partnerVenueDetail.common.signInRequired"));
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
      setBannerError(
        e instanceof Error ? e.message : t("admin.partnerVenueDetail.common.csvDownloadFailed"),
      );
    }
  };

  const downloadFunnelCsv = async () => {
    setBannerError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error(t("admin.partnerVenueDetail.common.signInRequired"));
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
      setBannerError(
        e instanceof Error ? e.message : t("admin.partnerVenueDetail.common.csvDownloadFailed"),
      );
    }
  };

  const downloadGeofenceCsv = async () => {
    setBannerError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error(t("admin.partnerVenueDetail.common.signInRequired"));
      const res = await ownerFetch(
        getToken,
        `/owner/venues/${venueId}/analytics/geofence-events.csv?${venueAnalyticsQs()}`,
        { method: "GET" },
      );
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `geofence-events-${venueId.slice(0, 8)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setBannerError(
        e instanceof Error ? e.message : t("admin.partnerVenueDetail.common.csvDownloadFailed"),
      );
    }
  };

  const accessError =
    venuesListQ.isSuccess && !metaRow
      ? t("admin.partnerVenueDetail.header.accessError")
      : null;

  const listErr =
    venuesListQ.isError && venuesListQ.error instanceof Error
      ? venuesListQ.error.message
      : null;

  const shellLoading = venuesListQ.isPending;
  const title = venueName || t("admin.partnerVenueDetail.header.fallbackVenueTitle");

  const showAnalyticsPending = canAnalytics && metaRow && analyticsQ.isLoading;

  async function reviewReceipt(status: "APPROVED" | "REJECTED", rid: string) {
    setBannerError(null);
    await reviewMut.mutateAsync({ receiptId: rid, status });
    setReceiptIdOpen(null);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Link href="/owner/venues" className="text-sm text-brand hover:text-brand">
            {t("admin.partnerVenueDetail.header.allVenues")}
          </Link>
          <h1 className="text-xl font-semibold mt-2">
            {title}
            {role ? (
              <span className="ml-3 text-xs font-mono uppercase tracking-wide text-brand align-middle">
                {role ? t(`admin.partnerVenueDetail.roles.${role}`) : null}
              </span>
            ) : null}
          </h1>
          {role === "EMPLOYEE" ? (
            <p className="text-sm text-slate-500 mt-1 max-w-xl">
              {t("admin.partnerVenueDetail.header.staffLeadBeforeLink")}{" "}
              <Link href={`/staff/${venueId}`} className="text-emerald-700 hover:underline">
                {t("admin.partnerVenueDetail.header.todayList")}
              </Link>{" "}
              {t("admin.partnerVenueDetail.header.staffLeadAfterLink")}
            </p>
          ) : null}
          {role === "MANAGER" ? (
            <p className="text-sm text-slate-500 mt-1 max-w-xl">
              {t("admin.partnerVenueDetail.header.managerLead")}
            </p>
          ) : null}
          {isOwner ? (
            <p className="text-sm text-slate-500 mt-1 max-w-xl">
              {t("admin.partnerVenueDetail.header.ownerLead")}
            </p>
          ) : null}
          {organizationRollupId ? (
            <p className="text-sm mt-2">
              <Link
                href={`/owner/organizations/${organizationRollupId}`}
                className="text-amber-700 hover:underline"
              >
                {t("admin.partnerVenueDetail.header.organizationRollupLink")}
              </Link>
            </p>
          ) : null}
          {isOwner && orgBilling && !hidePartnerFinancialUi ? (
            <>
              {orgBilling.billingPortalUrl ? (
                <p className="text-sm mt-2">
                  <a
                    href={orgBilling.billingPortalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-700 hover:underline"
                  >
                    {t("admin.partnerVenueDetail.header.subscriptionBillingPortal")}
                  </a>
                  <span className="text-slate-500 ml-2">
                    {orgBilling.platformBillingPlan ??
                      t("admin.partnerVenueDetail.header.billingPlanFallback")}{" "}
                    · {orgBilling.platformBillingStatus}
                    {orgBilling.platformBillingRenewsAt
                      ? t("admin.partnerVenueDetail.header.billingRenews", {
                          date: orgBilling.platformBillingRenewsAt.slice(0, 10),
                        })
                      : ""}
                    {orgBilling.platformBillingStatus === "ACTIVE_CANCELING"
                      ? t("admin.partnerVenueDetail.header.billingEndsAtPeriodEnd")
                      : ""}
                    {orgBilling.platformBillingStatus === "CANCELED"
                      ? t("admin.partnerVenueDetail.header.billingCanceledSupport")
                      : ""}
                  </span>
                </p>
              ) : (
                <p className="text-sm mt-2 text-slate-500">
                  {t("admin.partnerVenueDetail.header.billingPortalMissing")}
                </p>
              )}
              <p className="text-xs text-slate-600 max-w-2xl mt-2 leading-relaxed">
                <strong>{t("admin.partnerVenueDetail.header.commercialClarityTitle")}</strong>{" "}
                {t("admin.partnerVenueDetail.header.commercialClarityBody")}
              </p>
            </>
          ) : null}
        </div>
        <div className="hidden lg:block shrink-0">
          <UserButton />
        </div>
      </header>

      <main className="p-4 sm:p-6 max-w-4xl mx-auto space-y-8 sm:space-y-10 w-full min-w-0">
        {shellLoading ? (
          <p className="text-slate-600">{t("admin.partnerVenueDetail.common.loading")}</p>
        ) : null}
        {(listErr || accessError || bannerError || redemptionsQ.isError) && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm">
            {listErr ??
              accessError ??
              bannerError ??
              (redemptionsQ.error instanceof Error ? redemptionsQ.error.message : null)}
          </div>
        )}
        {readOnlyNotice ? <PartnerReadOnlyBanner notice={readOnlyNotice} /> : null}

        {canAnalytics && metaRow && (
          <section className="border border-emerald-200 rounded-xl p-4 space-y-3 bg-emerald-50/40">
            <h2 className="text-lg font-medium text-slate-900">
              {t("admin.partnerVenueDetail.playbook.title")}
            </h2>
            <p className="text-sm text-slate-700">
              {t("admin.partnerVenueDetail.playbook.leadBeforePath")}{" "}
              <code className="text-xs bg-white/80 px-1 rounded border border-emerald-200">
                {t("admin.partnerVenueDetail.playbook.briefPath")}
              </code>{" "}
              {t("admin.partnerVenueDetail.playbook.leadAfterPath")}
            </p>
            <ol className="list-decimal list-inside text-sm text-slate-700 space-y-1.5">
              <li>
                <strong>{t("admin.partnerVenueDetail.playbook.step1Title")}</strong> —{" "}
                {t("admin.partnerVenueDetail.playbook.step1Body")}
              </li>
              <li>
                <strong>{t("admin.partnerVenueDetail.playbook.step2Title")}</strong> —{" "}
                {t("admin.partnerVenueDetail.playbook.step2BeforeDeepLink")}{" "}
                <code className="text-xs bg-white/80 px-1 rounded break-all">
                  cafesocial://unlock?venueId={venueId}
                </code>{" "}
                {t("admin.partnerVenueDetail.playbook.step2AfterDeepLink")}
              </li>
              <li>
                <strong>{t("admin.partnerVenueDetail.playbook.step3Title")}</strong> —{" "}
                {t("admin.partnerVenueDetail.playbook.step3Body")}
              </li>
              <li>
                <strong>{t("admin.partnerVenueDetail.playbook.step4Title")}</strong> —{" "}
                {t("admin.partnerVenueDetail.playbook.step4Body")}
              </li>
              <li>
                <strong>{t("admin.partnerVenueDetail.playbook.step5Title")}</strong> —{" "}
                {t("admin.partnerVenueDetail.playbook.step5Body")}
              </li>
            </ol>
            <p className="text-xs text-slate-600">
              {t("admin.partnerVenueDetail.playbook.orderNudgeHint")}
            </p>
          </section>
        )}

        {canAnalytics && metaRow && (
          <section>
            {showAnalyticsPending ? (
              <p className="text-slate-600 text-sm mb-4">
                {t("admin.partnerVenueDetail.common.loadingAnalytics")}
              </p>
            ) : null}
            {analytics && !accessError && (
              <>
                <div className="flex flex-col gap-4 mb-4">
                  <h2 className="text-lg font-medium">
                    {t("admin.partnerVenueDetail.analytics.title")}
                  </h2>
                  <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-3">
                    <button
                      type="button"
                      disabled={readOnlyDisabled}
                      onClick={() => void downloadCsv()}
                      className="text-sm bg-emerald-50 border border-emerald-300 text-emerald-900 px-3 py-2 rounded-lg hover:bg-emerald-100 disabled:opacity-50 w-full sm:w-auto"
                    >
                      {t("admin.partnerVenueDetail.analytics.redemptionsCsv")}
                    </button>
                    <button
                      type="button"
                      disabled={readOnlyDisabled}
                      onClick={() => void downloadFunnelCsv()}
                      className="text-sm bg-emerald-50 border border-emerald-300 text-emerald-900 px-3 py-2 rounded-lg hover:bg-emerald-100 disabled:opacity-50 w-full sm:w-auto"
                    >
                      {t("admin.partnerVenueDetail.analytics.funnelCsv")}
                    </button>
                    <button
                      type="button"
                      disabled={readOnlyDisabled}
                      onClick={() => void downloadGeofenceCsv()}
                      className="text-sm bg-indigo-50 border border-indigo-300 text-indigo-900 px-3 py-2 rounded-lg hover:bg-indigo-100 disabled:opacity-50 w-full sm:w-auto"
                    >
                      {t("admin.partnerVenueDetail.analytics.geofenceCsv")}
                    </button>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3">
                    <label className="text-sm text-slate-600 flex flex-col sm:flex-row sm:items-center gap-1.5 w-full sm:w-auto">
                      {t("admin.partnerVenueDetail.analytics.periodDays")}
                      <select
                        value={days}
                        onChange={(e) => setDays(Number(e.target.value))}
                        className="sm:ml-2 bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-slate-900 w-full sm:w-auto"
                      >
                        {[7, 14, 30, 60, 90].map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm text-slate-600 flex flex-col sm:flex-row sm:items-center gap-1.5 w-full sm:w-auto">
                      {t("admin.partnerVenueDetail.common.from")}
                      <input
                        type="date"
                        value={analyticsFromYmd}
                        onChange={(e) => setAnalyticsFromYmd(e.target.value)}
                        className="sm:ml-2 bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-slate-900 w-full sm:w-auto"
                      />
                    </label>
                    <label className="text-sm text-slate-600 flex flex-col sm:flex-row sm:items-center gap-1.5 w-full sm:w-auto">
                      {t("admin.partnerVenueDetail.common.to")}
                      <input
                        type="date"
                        value={analyticsToYmd}
                        onChange={(e) => setAnalyticsToYmd(e.target.value)}
                        className="sm:ml-2 bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-slate-900 w-full sm:w-auto"
                      />
                    </label>
                    <button
                      type="button"
                      className="text-xs text-slate-500 hover:underline self-start"
                      onClick={() => {
                        setAnalyticsFromYmd("");
                        setAnalyticsToYmd("");
                      }}
                    >
                      {t("admin.partnerVenueDetail.common.clearRange")}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mb-2">
                  {t("admin.partnerVenueDetail.analytics.rangeHint")}
                </p>
                <p className="text-xs text-slate-500 mb-4">
                  {t("admin.partnerVenueDetail.analytics.utcRange", {
                    start: analytics.period.startDay,
                    end: analytics.period.endDay,
                  })}
                  {analytics.analyticsTimeZone
                    ? t("admin.partnerVenueDetail.analytics.venueTz", {
                        tz: analytics.analyticsTimeZone,
                      })
                    : ""}
                </p>
                <OwnerAnalyticsRoiSnapshot
                  current={analytics}
                  previous={analyticsPrevQ.data}
                  previousLoading={analyticsPrevQ.isLoading}
                  campaigns={campaignsQ.data ?? []}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm text-slate-600">
                      {t("admin.partnerVenueDetail.analytics.activeRedemptions")}
                    </p>
                    <p className="text-2xl font-semibold mt-1">{analytics.redemptions.total}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {t("admin.partnerVenueDetail.analytics.voided", {
                        count: analytics.redemptions.voided,
                      })}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm text-slate-600">
                      {t("admin.partnerVenueDetail.analytics.uniqueVisitors")}
                    </p>
                    <p className="text-2xl font-semibold mt-1">
                      {analytics.visits.uniquePlayers}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm text-slate-600">
                      {t("admin.partnerVenueDetail.analytics.repeatVisitors")}
                    </p>
                    <p className="text-2xl font-semibold mt-1">
                      {analytics.visits.loyalty.repeatVisitPlayers}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {t("admin.partnerVenueDetail.analytics.repeatVisitorsHint", {
                        percent: analytics.visits.loyalty.shareRepeatVisitorsPercent,
                      })}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm text-slate-600">
                      {t("admin.partnerVenueDetail.analytics.avgVisitDaysPerPlayer")}
                    </p>
                    <p className="text-2xl font-semibold mt-1">
                      {analytics.visits.loyalty.avgVisitDaysPerPlayer}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm text-slate-600">
                      {t("admin.partnerVenueDetail.analytics.funnel")}
                    </p>
                    <p className="text-lg font-semibold mt-1">
                      {t("admin.partnerVenueDetail.analytics.funnelRedeemers", {
                        redeemers: analytics.funnel.uniqueRedeemers,
                        visitors: analytics.funnel.uniqueVisitors,
                      })}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {t("admin.partnerVenueDetail.analytics.funnelVisitorsRedeemed", {
                        percent: analytics.funnel.visitToRedeemPercent,
                      })}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm text-slate-600">
                      {t("admin.partnerVenueDetail.analytics.feedEvents")}
                    </p>
                    <p className="text-2xl font-semibold mt-1">{analytics.feedEvents.total}</p>
                  </div>
                </div>

                <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="text-sm font-semibold text-slate-800 mb-3">
                    {t("admin.partnerVenueDetail.analytics.funnelJourneyTitle")}
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-slate-500">
                        {t("admin.partnerVenueDetail.analytics.detectImpressions")}
                      </p>
                      <p className="text-lg font-semibold text-slate-900">
                        {analytics.funnelJourney.detectImpressions}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">
                        {t("admin.partnerVenueDetail.analytics.uniqueEntered")}
                      </p>
                      <p className="text-lg font-semibold text-slate-900">
                        {analytics.funnelJourney.uniqueEntered}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">
                        {t("admin.partnerVenueDetail.analytics.uniquePlayed")}
                      </p>
                      <p className="text-lg font-semibold text-slate-900">
                        {analytics.funnelJourney.uniquePlayed}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">
                        {t("admin.partnerVenueDetail.analytics.uniqueRedeemed")}
                      </p>
                      <p className="text-lg font-semibold text-slate-900">
                        {analytics.funnelJourney.uniqueRedeemed}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-3">
                    {t("admin.partnerVenueDetail.analytics.funnelJourneyRates", {
                      enterToPlay: analytics.funnelJourney.enterToPlayPercent,
                      playToRedeem: analytics.funnelJourney.playToRedeemPercent,
                      enteredToRedeem: analytics.funnelJourney.enteredToRedeemPercent,
                    })}
                  </p>
                </div>

                {geofenceDwellQ.data ? (
                  <div className="mb-6 rounded-xl border border-indigo-200 bg-indigo-50/50 p-4">
                    <h3 className="text-sm font-semibold text-slate-800 mb-2">
                      {t("admin.partnerVenueDetail.analytics.geofenceTitle")}
                    </h3>
                    <p className="text-xs text-slate-600 mb-3">
                      {t("admin.partnerVenueDetail.analytics.geofenceLead")}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-slate-500">
                          {t("admin.partnerVenueDetail.analytics.geofenceEnterExitEvents")}
                        </p>
                        <p className="text-lg font-semibold text-slate-900">
                          {geofenceDwellQ.data.geofenceEnterEvents} /{" "}
                          {geofenceDwellQ.data.geofenceExitEvents}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">
                          {t("admin.partnerVenueDetail.analytics.geofencePlayersWithEvent")}
                        </p>
                        <p className="text-lg font-semibold text-slate-900">
                          {geofenceDwellQ.data.uniquePlayersWithGeofenceEvent}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">
                          {t("admin.partnerVenueDetail.analytics.geofenceCompletedSessions")}
                        </p>
                        <p className="text-lg font-semibold text-slate-900">
                          {geofenceDwellQ.data.completedVisitSessions}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">
                          {t("admin.partnerVenueDetail.analytics.geofenceOpenAtPeriodEnd")}
                        </p>
                        <p className="text-lg font-semibold text-slate-900">
                          {geofenceDwellQ.data.openSessionsAtPeriodEnd}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 mt-3">
                      {t("admin.partnerVenueDetail.analytics.geofenceAvgDwell")}{" "}
                      <strong>{geofenceDwellQ.data.avgDwellSecondsCompletedSessions}s</strong>
                      {geofenceDwellQ.data.medianDwellSecondsCompleted != null
                        ? t("admin.partnerVenueDetail.analytics.geofenceMedianDwell", {
                            seconds: geofenceDwellQ.data.medianDwellSecondsCompleted,
                          })
                        : null}
                      {t("admin.partnerVenueDetail.analytics.geofenceCalendarRows", {
                        count: geofenceDwellQ.data.calendarVisitDayRows,
                      })}
                    </p>
                  </div>
                ) : geofenceDwellQ.isLoading ? (
                  <p className="text-xs text-slate-500 mb-4">
                    {t("admin.partnerVenueDetail.common.loadingGeofenceDwell")}
                  </p>
                ) : null}

                <OwnerAnalyticsCharts
                  visitsByDay={analytics.visits.byDay}
                  redemptionsByDay={analytics.redemptions.byDay}
                  byHour={hourSeriesForCharts}
                />

                <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-medium text-slate-800 mb-2">
                      {t("admin.partnerVenueDetail.analytics.perPerk")}
                    </h3>
                    <PerkCountCards rows={perkRows} />
                    <div className="hidden md:block max-h-48 overflow-auto rounded-lg border border-slate-200">
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
                      {t("admin.partnerVenueDetail.analytics.redemptionsByHourUtc")}
                    </h3>
                    <HourCountCards rows={hourUtcRows} />
                    <div className="hidden md:block max-h-48 overflow-auto rounded-lg border border-slate-200 text-xs font-mono p-2 text-slate-600">
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
                      {t("admin.partnerVenueDetail.analytics.redemptionsByHourVenueTz")}
                    </h3>
                    <HourCountCards rows={hourVenueRows} />
                    <div className="hidden md:block max-h-48 overflow-auto rounded-lg border border-slate-200 text-xs font-mono p-2 text-slate-600">
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
                    <h3 className="text-sm font-medium text-slate-800 mb-2">
                      {t("admin.partnerVenueDetail.analytics.redemptionsByDay")}
                    </h3>
                    <DayCountCards rows={redeemDayRows} />
                    <div className="hidden md:block max-h-56 overflow-auto rounded-lg border border-slate-200">
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
                    <h3 className="text-sm font-medium text-slate-800 mb-2">
                      {t("admin.partnerVenueDetail.analytics.visitDaysByDay")}
                    </h3>
                    <DayCountCards rows={visitDayRows} />
                    <div className="hidden md:block max-h-56 overflow-auto rounded-lg border border-slate-200">
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
            <h2 className="text-lg font-medium">{t("admin.partnerVenueDetail.moderation.title")}</h2>
            <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-slate-800">
              <p className="font-medium text-slate-900">
                {t("admin.partnerVenueDetail.moderation.trustSafetyTitle")}
              </p>
              <p className="text-xs text-slate-700 mt-1">
                {t("admin.partnerVenueDetail.moderation.trustSafetyBody")}
              </p>
            </div>
            <p className="text-xs text-slate-500">
              {t("admin.partnerVenueDetail.moderation.lead")}
            </p>
            {modReportsQ.isError ? (
              <p className="text-sm text-red-700">
                {modReportsQ.error instanceof Error
                  ? modReportsQ.error.message
                  : t("admin.partnerVenueDetail.moderation.reportsFailed")}
              </p>
            ) : null}
            <div>
              <h3 className="text-sm font-medium text-slate-800 mb-2">
                {t("admin.partnerVenueDetail.moderation.recentReports")}
              </h3>
              {(modReportsQ.data ?? []).length === 0 ? (
                <p className="text-sm text-slate-500">
                  {t("admin.partnerVenueDetail.moderation.noOpenReports")}
                </p>
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
                        {t("admin.partnerVenueDetail.moderation.reason", { reason: r.reason })}
                        {r.note ? ` — ${r.note}` : ""}
                      </p>
                      <p className="text-xs text-slate-500">
                        {t("admin.partnerVenueDetail.moderation.reportedBy", {
                          email: r.reporter.email,
                          date: new Date(r.createdAt).toLocaleString(),
                        })}
                      </p>
                      <label className="block text-xs text-slate-600 mt-2">
                        {t("admin.partnerVenueDetail.moderation.dismissalNoteLabel")}
                        <textarea
                          className="mt-0.5 w-full max-w-md text-sm border border-slate-200 rounded px-2 py-1 bg-white"
                          rows={2}
                          value={reportDismissNotes[r.id] ?? ""}
                          onChange={(e) =>
                            setReportDismissNotes((m) => ({ ...m, [r.id]: e.target.value }))
                          }
                        />
                      </label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <button
                          type="button"
                          disabled={readOnlyDisabled || dismissReportMut.isPending}
                          onClick={() =>
                            void dismissReportMut.mutateAsync({
                              reportId: r.id,
                              dismissalNoteToReporter: reportDismissNotes[r.id],
                            })
                          }
                          className="text-xs border border-slate-300 rounded px-2 py-1 hover:bg-slate-50 disabled:opacity-50"
                        >
                          {t("admin.partnerVenueDetail.moderation.dismiss")}
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
                          {t("admin.partnerVenueDetail.moderation.banPlayer")}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-800 mb-2">
                {t("admin.partnerVenueDetail.moderation.activeBans")}
              </h3>
              {(modBansQ.data ?? []).length === 0 ? (
                <p className="text-sm text-slate-500">{t("admin.partnerVenueDetail.moderation.noBans")}</p>
              ) : (
                <ul className="text-sm space-y-2">
                  {(modBansQ.data ?? []).map((b) => (
                    <li
                      key={b.id}
                      id={`ban-row-${b.playerId}`}
                      className="flex flex-wrap items-center justify-between gap-2 border border-slate-100 rounded-lg px-3 py-2 scroll-mt-24"
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
                        {t("admin.partnerVenueDetail.moderation.removeBan")}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <h3 className="text-sm font-medium text-slate-800">
                  {t("admin.partnerVenueDetail.moderation.banAppeals")}
                </h3>
                <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={appealsIncludeResolved}
                    onChange={(e) => setAppealsIncludeResolved(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  {t("admin.partnerVenueDetail.moderation.showResolvedHistory")}
                </label>
              </div>
              <div className="flex flex-wrap gap-3 mb-3 text-xs text-slate-600">
                <label>
                  {t("admin.partnerVenueDetail.moderation.fromUtc")}
                  <input
                    type="text"
                    placeholder={t("admin.partnerVenueDetail.moderation.datePlaceholder")}
                    className="mt-0.5 block bg-white border border-slate-300 rounded px-2 py-1 font-mono"
                    value={appealsFromYmd}
                    onChange={(e) => setAppealsFromYmd(e.target.value.trim())}
                  />
                </label>
                <label>
                  {t("admin.partnerVenueDetail.moderation.toUtc")}
                  <input
                    type="text"
                    placeholder={t("admin.partnerVenueDetail.moderation.datePlaceholder")}
                    className="mt-0.5 block bg-white border border-slate-300 rounded px-2 py-1 font-mono"
                    value={appealsToYmd}
                    onChange={(e) => setAppealsToYmd(e.target.value.trim())}
                  />
                </label>
              </div>
              <p className="text-xs text-slate-500 mb-2">
                {t("admin.partnerVenueDetail.moderation.appealsLead")}
              </p>
              {modAppealsQ.isError ? (
                <p className="text-sm text-red-700">
                  {modAppealsQ.error instanceof Error
                    ? modAppealsQ.error.message
                    : t("admin.partnerVenueDetail.moderation.appealsFailed")}
                </p>
              ) : null}
              {(modAppealsQ.data ?? []).length === 0 ? (
                <p className="text-sm text-slate-500">
                  {appealsIncludeResolved
                    ? t("admin.partnerVenueDetail.moderation.noAppealsOnFile")
                    : t("admin.partnerVenueDetail.moderation.noOpenAppeals")}
                </p>
              ) : (
                <ul className="text-sm space-y-3 divide-y divide-slate-100">
                  {(modAppealsQ.data ?? []).map((a) => {
                    const isOpen = a.status === "open";
                    const noteVal = appealStaffNote[a.id] ?? "";
                    const msgVal = appealStaffMessage[a.id] ?? "";
                    const notifyVal = appealNotifyPlayer[a.id] ?? true;
                    const resolve = async (outcome: "dismissed" | "upheld" | "lifted") => {
                      await resolveAppealMut.mutateAsync({
                        appealId: a.id,
                        body: {
                          outcome,
                          staffNote: noteVal.trim() || undefined,
                          staffMessageToPlayer: msgVal.trim() || undefined,
                          notifyPlayer: notifyVal,
                        },
                      });
                    };
                    return (
                      <li key={a.id} className="pt-3 first:pt-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${
                              a.status === "open"
                                ? "bg-amber-100 text-amber-900"
                                : a.status === "lifted"
                                  ? "bg-emerald-100 text-emerald-900"
                                  : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {a.status}
                          </span>
                          {a.playerNotifiedAt ? (
                            <span className="text-[10px] text-slate-500">
                              {t("admin.partnerVenueDetail.moderation.playerNotified")}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-slate-800 mt-1">
                          <span className="font-mono text-xs">{a.player.email}</span>{" "}
                          <span className="text-slate-500">
                            (@{a.player.username} · {a.player.id.slice(0, 8)}…)
                          </span>
                        </p>
                        <p className="text-xs text-slate-600 mt-0.5 whitespace-pre-wrap">{a.message}</p>
                        <p className="text-xs text-slate-500">
                          {t("admin.partnerVenueDetail.moderation.submittedAt", {
                            date: new Date(a.createdAt).toLocaleString(),
                          })}
                        </p>
                        {bannedPlayerIds.has(a.playerId) ? (
                          <a
                            href={`#ban-row-${a.playerId}`}
                            className="text-xs text-blue-700 hover:underline mt-1 inline-block"
                          >
                            {t("admin.partnerVenueDetail.moderation.viewActiveBan")}
                          </a>
                        ) : null}
                        {a.resolvedAt ? (
                          <p className="text-xs text-slate-500 mt-0.5">
                            {a.resolvedBy
                              ? t("admin.partnerVenueDetail.moderation.resolvedAtBy", {
                                  date: new Date(a.resolvedAt).toLocaleString(),
                                  username: a.resolvedBy.username,
                                  email: a.resolvedBy.email,
                                })
                              : t("admin.partnerVenueDetail.moderation.resolvedAt", {
                                  date: new Date(a.resolvedAt).toLocaleString(),
                                })}
                          </p>
                        ) : null}
                        {a.staffNote ? (
                          <p className="text-xs text-slate-600 mt-1">
                            <span className="font-medium">
                              {t("admin.partnerVenueDetail.moderation.staffNote")}
                            </span>{" "}
                            {a.staffNote}
                          </p>
                        ) : null}
                        {a.staffMessageToPlayer ? (
                          <p className="text-xs text-slate-600 mt-0.5">
                            <span className="font-medium">
                              {t("admin.partnerVenueDetail.moderation.messageToPlayer")}
                            </span>{" "}
                            {a.staffMessageToPlayer}
                          </p>
                        ) : null}
                        {isOpen ? (
                          <div className="mt-2 space-y-2 border border-slate-100 rounded-lg p-2 bg-slate-50/80">
                            <div className="flex flex-wrap gap-1">
                              <span className="text-[10px] text-slate-500 w-full">
                                {t("admin.partnerVenueDetail.moderation.noteTemplates")}
                              </span>
                              {STAFF_NOTE_TEMPLATES.map((tpl) => (
                                <button
                                  key={tpl}
                                  type="button"
                                  className="text-[10px] border border-slate-200 rounded px-1.5 py-0.5 bg-white hover:bg-slate-100"
                                  onClick={() =>
                                    setAppealStaffNote((m) => ({ ...m, [a.id]: tpl }))
                                  }
                                >
                                  {tpl.length > 42 ? `${tpl.slice(0, 42)}…` : tpl}
                                </button>
                              ))}
                            </div>
                            <label className="block text-xs text-slate-600">
                              {t("admin.partnerVenueDetail.moderation.internalNoteLabel")}
                              <textarea
                                className="mt-0.5 w-full text-sm border border-slate-200 rounded px-2 py-1 bg-white"
                                rows={2}
                                value={noteVal}
                                onChange={(e) =>
                                  setAppealStaffNote((m) => ({ ...m, [a.id]: e.target.value }))
                                }
                              />
                            </label>
                            <label className="block text-xs text-slate-600">
                              {t("admin.partnerVenueDetail.moderation.playerMessageLabel")}
                              <textarea
                                className="mt-0.5 w-full text-sm border border-slate-200 rounded px-2 py-1 bg-white"
                                rows={2}
                                value={msgVal}
                                onChange={(e) =>
                                  setAppealStaffMessage((m) => ({ ...m, [a.id]: e.target.value }))
                                }
                              />
                            </label>
                            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={notifyVal}
                                onChange={(e) =>
                                  setAppealNotifyPlayer((m) => ({ ...m, [a.id]: e.target.checked }))
                                }
                                className="rounded border-slate-300"
                              />
                              {t("admin.partnerVenueDetail.moderation.notifyPlayer")}
                            </label>
                            <div className="flex flex-wrap gap-2 pt-1">
                              <button
                                type="button"
                                disabled={readOnlyDisabled || resolveAppealMut.isPending}
                                onClick={() => void resolve("lifted")}
                                className="text-xs bg-emerald-100 border border-emerald-300 text-emerald-950 rounded px-2 py-1 hover:bg-emerald-200 disabled:opacity-50"
                              >
                                {t("admin.partnerVenueDetail.moderation.liftBan")}
                              </button>
                              <button
                                type="button"
                                disabled={readOnlyDisabled || resolveAppealMut.isPending}
                                onClick={() => void resolve("upheld")}
                                className="text-xs bg-slate-200 border border-slate-300 text-slate-900 rounded px-2 py-1 hover:bg-slate-300 disabled:opacity-50"
                              >
                                {t("admin.partnerVenueDetail.moderation.upholdBan")}
                              </button>
                              <button
                                type="button"
                                disabled={readOnlyDisabled || resolveAppealMut.isPending}
                                onClick={() => void resolve("dismissed")}
                                className="text-xs border border-slate-300 rounded px-2 py-1 hover:bg-white disabled:opacity-50"
                              >
                                {t("admin.partnerVenueDetail.moderation.dismissAppeal")}
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="border-t border-slate-100 pt-4">
              <h3 className="text-sm font-medium text-slate-800 mb-2">
                {t("admin.partnerVenueDetail.moderation.banByPlayerId")}
              </h3>
              <div className="flex flex-wrap gap-2 items-end">
                <label className="text-sm text-slate-600 flex-1 min-w-[200px]">
                  {t("admin.partnerVenueDetail.moderation.playerUuid")}
                  <input
                    className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono"
                    value={modBanPlayerId}
                    onChange={(e) => setModBanPlayerId(e.target.value)}
                    placeholder={t("admin.partnerVenueDetail.moderation.playerUuidPlaceholder")}
                  />
                </label>
                <label className="text-sm text-slate-600 flex-1 min-w-[180px]">
                  {t("admin.partnerVenueDetail.moderation.banReasonOptional")}
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
                  {t("admin.partnerVenueDetail.moderation.ban")}
                </button>
              </div>
            </div>
            <div className="border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setAuditOpen((v) => !v)}
                className="text-sm font-medium text-slate-800 hover:text-slate-950"
              >
                {t("admin.partnerVenueDetail.moderation.auditLog")} {auditOpen ? "▼" : "▶"}
              </button>
              {auditOpen ? (
                moderationAuditQ.isLoading ? (
                  <p className="text-xs text-slate-500 mt-2">
                    {t("admin.partnerVenueDetail.common.loadingAudit")}
                  </p>
                ) : (
                  <ul className="mt-2 text-xs space-y-2 max-h-64 overflow-auto text-slate-700">
                    {(moderationAuditQ.data ?? []).length === 0 ? (
                      <li className="text-slate-500">
                        {t("admin.partnerVenueDetail.moderation.noAuditEntries")}
                      </li>
                    ) : (
                      (moderationAuditQ.data ?? []).map((row) => (
                        <li key={row.id} className="border-b border-slate-100 pb-2 font-mono">
                          <span className="text-slate-500">
                            {new Date(row.createdAt).toLocaleString()}
                          </span>
                          {" · "}
                          {row.action}
                          {row.entityId ? ` · ${row.entityId}` : ""}
                          {row.actor
                            ? ` · ${row.actor.username}`
                            : row.actorPlayerId
                              ? ` · staff ${row.actorPlayerId.slice(0, 8)}…`
                              : ""}
                        </li>
                      ))
                    )}
                  </ul>
                )
              ) : null}
            </div>
          </section>
        )}

        {isOwner && metaRow && (
          <section className="border border-slate-200 rounded-xl p-4 space-y-4">
            <h2 className="text-lg font-medium">{t("admin.partnerVenueDetail.staffInvites.title")}</h2>
            <p className="text-xs text-slate-500">
              {t("admin.partnerVenueDetail.staffInvites.leadBeforeSecret")}{" "}
              <code className="text-slate-600">CLERK_SECRET_KEY</code> +{" "}
              <code className="text-slate-600">ADMIN_PORTAL_ORIGIN</code>
              {t("admin.partnerVenueDetail.staffInvites.leadBeforeAcceptInvite")}{" "}
              <Link href="/owner/accept-invite" className="text-brand hover:underline">
                {t("admin.partnerVenueDetail.staffInvites.acceptInvite")}
              </Link>
              {t("admin.partnerVenueDetail.staffInvites.leadAfterAcceptInvite")}
            </p>
            {clerkInviteNotice ? (
              <p className="text-xs text-amber-900 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
                {clerkInviteNotice}
              </p>
            ) : null}
            {lastCreatedToken && typeof window !== "undefined" ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs">
                <p className="text-emerald-800 font-medium mb-1">
                  {t("admin.partnerVenueDetail.staffInvites.inviteLinkTitle")}
                </p>
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
                    {t("admin.partnerVenueDetail.staffInvites.email")}
                    <input
                      type="email"
                      disabled={readOnlyDisabled}
                      className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm disabled:opacity-60"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      placeholder={t("admin.partnerVenueDetail.staffInvites.emailPlaceholder")}
                    />
                  </label>
                )}
              </inviteForm.Field>
              <inviteForm.Field name="role">
                {(field) => (
                  <label className="block text-sm text-slate-600">
                    {t("admin.partnerVenueDetail.staffInvites.role")}
                    <select
                      disabled={readOnlyDisabled}
                      className="mt-1 block w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm disabled:opacity-60"
                      value={field.state.value}
                      onChange={(e) =>
                        field.handleChange(e.target.value as "EMPLOYEE" | "MANAGER")
                      }
                      onBlur={field.handleBlur}
                    >
                      <option value="EMPLOYEE">
                        {t("admin.partnerVenueDetail.roles.EMPLOYEE")}
                      </option>
                      {role === "OWNER" ? (
                        <option value="MANAGER">{t("admin.partnerVenueDetail.roles.MANAGER")}</option>
                      ) : null}
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
                    {t("admin.partnerVenueDetail.staffInvites.sendInvite")}
                  </button>
                )}
              </inviteForm.Subscribe>
            </form>
            <div className="border border-slate-200 rounded-lg overflow-hidden text-sm">
              {invites.length === 0 ? (
                <p className="p-3 text-slate-500">
                  {t("admin.partnerVenueDetail.staffInvites.noInviteHistory")}
                </p>
              ) : (
                <>
                  <TableRowCards
                    rows={inviteTable.getRowModel().rows}
                    leadCellId="who"
                    actionCellIds={["cancel"]}
                  />
                  <div className="hidden md:block">
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
                  </div>
                </>
              )}
            </div>
          </section>
        )}

        {canAnalytics && metaRow && (
          <section className="border border-slate-200 rounded-xl p-4 space-y-4">
            <h2 className="text-lg font-medium">{t("admin.partnerVenueDetail.campaigns.title")}</h2>
            <p className="text-xs text-slate-500">
              {t("admin.partnerVenueDetail.campaigns.lead")}
            </p>
            <p className="text-xs text-slate-600">
              {t("admin.partnerVenueDetail.campaigns.orderNudgeLead")}
            </p>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-700 mb-2">
                {t("admin.partnerVenueDetail.campaigns.suggestedCopyTitle")}
              </p>
              <div className="flex flex-wrap gap-2">
                {CAMPAIGN_COPY_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    disabled={readOnlyDisabled}
                    onClick={() => {
                      campaignForm.setFieldValue("name", tpl.name);
                      campaignForm.setFieldValue("title", tpl.title);
                      campaignForm.setFieldValue("body", tpl.body);
                      campaignForm.setFieldValue("segmentDays", tpl.segmentDays);
                    }}
                    className="text-xs border border-slate-300 rounded-full px-3 py-1 bg-white hover:bg-slate-100 disabled:opacity-50"
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>
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
                    placeholder={t("admin.partnerVenueDetail.campaigns.internalNamePlaceholder")}
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
                    placeholder={t("admin.partnerVenueDetail.campaigns.notificationTitlePlaceholder")}
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
                    placeholder={t("admin.partnerVenueDetail.campaigns.notificationBodyPlaceholder")}
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
                {t("admin.partnerVenueDetail.campaigns.saveDraft")}
              </button>
            </form>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              {campaigns.length === 0 ? (
                <p className="p-4 text-slate-500 text-sm">
                  {t("admin.partnerVenueDetail.campaigns.noCampaigns")}
                </p>
              ) : (
                <>
                  <TableRowCards
                    rows={campaignTable.getRowModel().rows}
                    leadCellId="info"
                    actionCellIds={["send", "bindings"]}
                  />
                  <div className="hidden md:block">
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
                  </div>
                  {bindingsCampaignId ? (
                    <CampaignBindingsEditor
                      key={bindingsCampaignId}
                      venueId={venueId}
                      campaignId={bindingsCampaignId}
                      getToken={getToken}
                      readOnlyDisabled={readOnlyDisabled}
                    />
                  ) : null}
                </>
              )}
            </div>
          </section>
        )}

        {canAnalytics && metaRow && (
          <section className="border border-slate-200 rounded-xl p-4 space-y-4">
            <h2 className="text-lg font-medium">{t("admin.partnerVenueDetail.receipts.title")}</h2>
            <p className="text-xs text-slate-500">
              {t("admin.partnerVenueDetail.receipts.lead")}
            </p>
            <button
              type="button"
              onClick={() => void receiptsQ.refetch()}
              className="text-sm text-brand"
            >
              {t("admin.partnerVenueDetail.receipts.refreshList")}
            </button>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              {receipts.length === 0 ? (
                <p className="p-4 text-slate-500 text-sm">
                  {t("admin.partnerVenueDetail.receipts.noReceipts")}
                </p>
              ) : (
                <>
                  <TableRowCards
                    rows={receiptTable.getRowModel().rows}
                    leadCellId="sum"
                    actionCellIds={["open"]}
                    showBodyLabels
                  />
                  <div className="hidden md:block">
                    <table className="w-full text-sm">
                      <tbody>
                        {receiptTable.getRowModel().rows.map((row) => (
                          <tr key={row.id} className="border-b border-slate-200 last:border-0">
                            {row.getVisibleCells().map((cell) => (
                              <td key={cell.id} className="p-3">
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
            {receiptIdOpen ? (
              <div className="border border-slate-300 rounded-lg p-4 space-y-3 bg-slate-50">
                {receiptDetailQ.isPending ? (
                  <p className="text-sm text-slate-500">
                    {t("admin.partnerVenueDetail.common.loadingReceipt")}
                  </p>
                ) : null}
                {receiptDetailQ.isError && receiptDetailQ.error instanceof Error ? (
                  <p className="text-sm text-red-700">{receiptDetailQ.error.message}</p>
                ) : null}
                {receiptDetailQ.data ? (
                  <>
                    <p className="text-sm text-slate-600">
                      {t("admin.partnerVenueDetail.receipts.playerStatus", {
                        email: receiptDetailQ.data.player.email,
                        status: receiptDetailQ.data.status,
                      })}
                    </p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={receiptDetailQ.data.imageData}
                      alt={t("admin.partnerVenueDetail.receipts.receiptAlt")}
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
                          {t("admin.partnerVenueDetail.receipts.approve")}
                        </button>
                        <button
                          type="button"
                          disabled={readOnlyDisabled || reviewMut.isPending}
                          onClick={() =>
                            void reviewReceipt("REJECTED", receiptDetailQ.data!.id)
                          }
                          className="bg-red-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
                        >
                          {t("admin.partnerVenueDetail.receipts.reject")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setReceiptIdOpen(null)}
                          className="text-slate-600 text-sm px-2"
                        >
                          {t("admin.partnerVenueDetail.common.close")}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setReceiptIdOpen(null)}
                        className="text-slate-600 text-sm px-2"
                      >
                        {t("admin.partnerVenueDetail.common.close")}
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
            <h2 className="text-lg font-medium mb-2">{t("admin.partnerVenueDetail.redemptions.title")}</h2>
            <p className="text-sm text-slate-600 mb-4 max-w-2xl">
              {t("admin.partnerVenueDetail.redemptions.lead")}
            </p>
            {canAnalytics && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <input
                  disabled={readOnlyDisabled}
                  className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-sm flex-1 min-w-[200px] disabled:opacity-60"
                  placeholder={t("admin.partnerVenueDetail.redemptions.voidReasonPlaceholder")}
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                />
              </div>
            )}
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 mb-4">
              <label className="text-sm text-slate-600 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
                {t("admin.partnerVenueDetail.redemptions.dateUtc")}
                <input
                  type="date"
                  value={dateYmd}
                  onChange={(e) => setDateYmd(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 w-full sm:w-auto"
                />
              </label>
              <button
                type="button"
                onClick={() => void redemptionsQ.refetch()}
                className="text-sm bg-slate-200 hover:bg-slate-300 px-4 py-2 rounded-lg w-full sm:w-auto"
              >
                {t("admin.partnerVenueDetail.common.refresh")}
              </button>
            </div>
            <TableRowCards
              rows={redemptionTable.getRowModel().rows}
              leadCellId="staffVerificationCode"
              leadStyle="code"
              actionCellIds={["actions"]}
              rowClassName={(row) => (row.original.voidedAt ? "opacity-50" : "")}
            />
            {redemptionRows.length === 0 ? (
              <p className="p-6 text-slate-500 md:hidden rounded-xl border border-slate-200 bg-white">
                {t("admin.partnerVenueDetail.redemptions.noRedemptionsForDay")}
              </p>
            ) : null}
            <div className="hidden md:block rounded-xl border border-slate-200 overflow-x-auto">
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
              {redemptionRows.length === 0 ? (
                <p className="p-6 text-slate-500">
                  {t("admin.partnerVenueDetail.redemptions.noRedemptionsForDay")}
                </p>
              ) : null}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

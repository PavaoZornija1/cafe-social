"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useOwnerVenueBanPlayerMutation,
  useOwnerVenueDismissReportMutation,
  useOwnerVenueModerationAuditQuery,
  useOwnerVenueModerationBansQuery,
  useOwnerVenueBanAppealsQuery,
  useOwnerVenueModerationReportsQuery,
  useOwnerVenueResolveBanAppealMutation,
  useOwnerVenueUnbanPlayerMutation,
} from "@/lib/queries";
import { useOwnerVenueDashboard } from "../OwnerVenueDashboardContext";

export function VenueModerationSection() {
  const { t } = useTranslation();
  const {
    venueId,
    getToken,
    isLoaded,
    metaRow,
    canAnalytics,
    readOnlyDisabled,
  } = useOwnerVenueDashboard();

  const [modBanPlayerId, setModBanPlayerId] = useState("");
  const [modBanReason, setModBanReason] = useState("");
  const [appealsIncludeResolved, setAppealsIncludeResolved] = useState(false);
  const [appealsFromYmd, setAppealsFromYmd] = useState("");
  const [appealsToYmd, setAppealsToYmd] = useState("");
  const [appealStaffNote, setAppealStaffNote] = useState<Record<string, string>>({});
  const [appealStaffMessage, setAppealStaffMessage] = useState<Record<string, string>>({});
  const [appealNotifyPlayer, setAppealNotifyPlayer] = useState<Record<string, boolean>>({});
  const [reportDismissNotes, setReportDismissNotes] = useState<Record<string, string>>({});
  const [auditOpen, setAuditOpen] = useState(false);

  const STAFF_NOTE_TEMPLATES = [
    t("admin.partnerVenueDetail.moderation.noteTemplateReviewed"),
    t("admin.partnerVenueDetail.moderation.noteTemplateResolvedInformally"),
    t("admin.partnerVenueDetail.moderation.noteTemplateEscalating"),
    t("admin.partnerVenueDetail.moderation.noteTemplateDuplicate"),
  ];

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

  if (!metaRow) return null;

  return (
    <section className="border border-slate-200 rounded-xl p-4 space-y-4 scroll-mt-24">
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
                        type="date"
                        className="mt-0.5 block bg-white border border-slate-300 rounded px-2 py-1 font-mono"
                        value={appealsFromYmd}
                        onChange={(e) => setAppealsFromYmd(e.target.value)}
                      />
                    </label>
                    <label>
                      {t("admin.partnerVenueDetail.moderation.toUtc")}
                      <input
                        type="date"
                        className="mt-0.5 block bg-white border border-slate-300 rounded px-2 py-1 font-mono"
                        value={appealsToYmd}
                        onChange={(e) => setAppealsToYmd(e.target.value)}
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
                                {t(`admin.partnerVenueDetail.moderation.appealStatus.${a.status as "open" | "lifted" | "upheld" | "dismissed"}`, {
                                  defaultValue: a.status,
                                })}
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
  );
}

"use client";

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { TableRowCards } from "@/components/TableRowCards";
import {
  useOwnerAckRedemptionMutation,
  useOwnerVoidRedemptionMutation,
  useStaffRedemptionsQuery,
} from "@/lib/queries";
import type { RedemptionRow } from "../types";
import { todayUtc } from "../utils";
import { useOwnerVenueDashboard } from "../OwnerVenueDashboardContext";

const redemptionCol = createColumnHelper<RedemptionRow>();

export function VenueRedemptionsSection() {
  const { t } = useTranslation();
  const {
    venueId,
    getToken,
    isLoaded,
    metaRow,
    role,
    canAnalytics,
    readOnlyDisabled,
    setBannerError,
  } = useOwnerVenueDashboard();

  const [dateYmd, setDateYmd] = useState(todayUtc);
  const [voidReason, setVoidReason] = useState("");

  const redemptionsQ = useStaffRedemptionsQuery(
    venueId,
    dateYmd,
    getToken,
    Boolean(isLoaded && venueId && metaRow),
  );
  const ackMut = useOwnerAckRedemptionMutation(venueId, dateYmd, getToken);
  const voidMut = useOwnerVoidRedemptionMutation(venueId, dateYmd, 30, getToken);

  const redemptionsPayload = redemptionsQ.data ?? null;
  const redemptionRows = redemptionsPayload?.redemptions ?? [];

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

  if (!metaRow || !redemptionsPayload) return null;

  return (
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
  );
}

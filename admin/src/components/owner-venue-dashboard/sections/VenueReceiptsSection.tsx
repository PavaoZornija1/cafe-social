"use client";

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { TableRowCards } from "@/components/TableRowCards";
import {
  type OwnerReceiptSummary,
  useOwnerReceiptDetailQuery,
  useOwnerReviewReceiptMutation,
  useOwnerVenueReceiptsQuery,
} from "@/lib/queries";
import { useOwnerVenueDashboard } from "../OwnerVenueDashboardContext";

const receiptCol = createColumnHelper<OwnerReceiptSummary>();

export function VenueReceiptsSection() {
  const { t } = useTranslation();
  const {
    venueId,
    getToken,
    isLoaded,
    metaRow,
    canAnalytics,
    readOnlyDisabled,
    setBannerError,
  } = useOwnerVenueDashboard();

  const [receiptIdOpen, setReceiptIdOpen] = useState<string | null>(null);

  const receiptsQ = useOwnerVenueReceiptsQuery(
    venueId,
    getToken,
    Boolean(isLoaded && metaRow && canAnalytics),
  );
  const receiptDetailQ = useOwnerReceiptDetailQuery(
    venueId,
    receiptIdOpen,
    getToken,
    Boolean(receiptIdOpen),
  );
  const reviewMut = useOwnerReviewReceiptMutation(venueId, getToken);

  const receipts = receiptsQ.data ?? [];

  async function reviewReceipt(status: "APPROVED" | "REJECTED", rid: string) {
    setBannerError(null);
    await reviewMut.mutateAsync({ receiptId: rid, status });
    setReceiptIdOpen(null);
  }

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

  if (!metaRow) return null;

  return (
    <section className="border border-slate-200 rounded-xl p-4 space-y-4 scroll-mt-24">
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
                        {receiptDetailQ.data.linkedRedemptionId ? (
                          <p className="text-sm text-amber-800 font-medium">
                            {t("admin.partnerVenueDetail.receipts.linkedRedemption", {
                              id: receiptDetailQ.data.linkedRedemptionId,
                            })}
                          </p>
                        ) : null}
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
  );
}

"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useParams } from "next/navigation";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useStaffRedemptionsQuery } from "@/lib/queries";

type Row = {
  redemptionId: string;
  staffVerificationCode: string;
  playerUsername: string;
  issuedAt: string;
  redeemedAt: string | null;
  expiresAt: string;
  status: string;
  perkCode: string;
  perkTitle: string;
  voidedAt: string | null;
  voidReason: string | null;
};

const colHelper = createColumnHelper<Row>();

function todayUtcYmd(): string {
  const n = new Date();
  const y = n.getUTCFullYear();
  const m = String(n.getUTCMonth() + 1).padStart(2, "0");
  const d = String(n.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function statusPresentation(
  row: Row,
  t: (key: string) => string,
): { label: string; className: string } {
  if (row.voidedAt) {
    return {
      label: t("admin.staffRedemptions.statusVoided"),
      className: "text-red-600",
    };
  }
  switch (row.status) {
    case "LOCKED":
      return {
        label: t("admin.staffRedemptions.statusLocked"),
        className: "text-amber-700",
      };
    case "REDEEMED":
      return {
        label: t("admin.staffRedemptions.statusRedeemed"),
        className: "text-slate-600",
      };
    case "EXPIRED":
      return {
        label: t("admin.staffRedemptions.statusExpired"),
        className: "text-slate-500",
      };
    default:
      return {
        label: t("admin.staffRedemptions.statusActive"),
        className: "text-emerald-700",
      };
  }
}

export default function StaffRedemptionsPage() {
  const { t } = useTranslation();
  const { venueId } = useParams<{ venueId: string }>();
  const { isLoaded, getToken } = useAuth();
  const [date, setDate] = useState(todayUtcYmd);

  const q = useStaffRedemptionsQuery(venueId, date, getToken, isLoaded && Boolean(venueId));

  const rows = q.data?.redemptions ?? [];

  const columns = useMemo(
    () => [
      colHelper.accessor("staffVerificationCode", {
        header: t("admin.staffRedemptions.columns.code"),
        cell: (c) => (
          <span className="font-mono text-amber-900 text-lg font-bold">{c.getValue()}</span>
        ),
      }),
      colHelper.accessor("playerUsername", {
        header: t("admin.staffRedemptions.columns.player"),
        cell: (c) => <span className="text-slate-700 text-sm font-medium">{c.getValue()}</span>,
      }),
      colHelper.accessor("issuedAt", {
        header: t("admin.staffRedemptions.columns.redeemed"),
        cell: (c) => <span className="text-slate-600 text-xs">{c.getValue()}</span>,
      }),
      colHelper.display({
        id: "perk",
        header: t("admin.staffRedemptions.columns.perk"),
        cell: ({ row }) => (
          <span>
            {row.original.perkCode} — {row.original.perkTitle}
          </span>
        ),
      }),
      colHelper.display({
        id: "void",
        header: t("admin.staffRedemptions.columns.status"),
        cell: ({ row }) => {
          const { label, className } = statusPresentation(row.original, t);
          return <span className={`text-xs font-semibold ${className}`}>{label}</span>;
        },
      }),
    ],
    [t],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="bg-slate-50 text-slate-900 px-4 py-5 sm:p-6 max-w-4xl mx-auto w-full">
      <Link href="/owner/venues" className="text-brand text-sm font-medium">
        {t("admin.staffRedemptions.backVenues")}
      </Link>
      <h1 className="text-xl font-bold mt-4 mb-1">{t("admin.staffRedemptions.title")}</h1>
      <p className="text-sm text-slate-600 mb-4 leading-relaxed">
        {t("admin.staffRedemptions.leadStart")}{" "}
        <strong className="text-slate-800">{t("admin.staffRedemptions.codeLabel")}</strong>{" "}
        {t("admin.staffRedemptions.leadEnd")}
      </p>

      <div className="space-y-3 border border-slate-200 rounded-xl bg-white p-4 mb-5 max-w-lg shadow-sm">
        <label className="block text-sm font-medium text-slate-800">
          {t("admin.staffRedemptions.dateLabel")}
          <input
            type="date"
            className="mt-1.5 w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-base"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <button
          type="button"
          onClick={() => void q.refetch()}
          disabled={q.isFetching}
          className="w-full bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 rounded-xl py-3 font-semibold text-white text-sm"
        >
          {q.isFetching ? t("common.loading") : t("admin.staffRedemptions.refresh")}
        </button>
      </div>

      {q.isError && q.error instanceof Error ? (
        <p className="text-red-700 text-sm mb-4">{q.error.message}</p>
      ) : null}

      {q.isLoading ? (
        <p className="text-slate-500 text-sm">{t("common.loading")}</p>
      ) : rows.length === 0 ? (
        <p className="text-slate-500 text-sm">{t("admin.staffRedemptions.emptyDay")}</p>
      ) : (
        <div className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-sm">
          <p className="text-xs text-slate-500 px-4 pt-3">{t("admin.staffRedemptions.newestFirst")}</p>
          <div className="md:hidden divide-y divide-slate-100">
            {rows.map((row) => {
              const { label, className } = statusPresentation(row, t);
              return (
                <div key={row.redemptionId} className="p-4 space-y-2">
                  <div className="font-mono text-amber-900 text-lg font-bold">
                    {row.staffVerificationCode}
                  </div>
                  <div className="text-sm text-slate-700">{row.playerUsername}</div>
                  <div className="text-xs text-slate-500">{row.issuedAt}</div>
                  <div className="text-sm">
                    {row.perkCode} — {row.perkTitle}
                  </div>
                  <span className={`text-xs font-semibold ${className}`}>{label}</span>
                </div>
              );
            })}
          </div>
          <table className="hidden md:table w-full text-sm">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b border-slate-200 bg-slate-50">
                  {hg.headers.map((h) => (
                    <th key={h.id} className="text-left p-3 font-semibold text-slate-700">
                      {h.isPlaceholder
                        ? null
                        : flexRender(h.column.columnDef.header, h.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 last:border-0">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="p-3 align-top">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

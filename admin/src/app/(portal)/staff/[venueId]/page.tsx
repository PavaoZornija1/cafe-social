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
        cell: ({ row }) =>
          row.original.voidedAt ? (
            <span className="text-red-600 text-xs">
              {t("admin.staffRedemptions.statusVoided")} {row.original.voidedAt}
            </span>
          ) : (
            <span className="text-emerald-700 text-xs">{t("admin.staffRedemptions.statusActive")}</span>
          ),
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
        <p className="text-red-600 text-sm mb-3">{q.error.message}</p>
      ) : null}

      {q.data ? (
        <div>
          <h2 className="font-semibold text-slate-800 text-lg">{q.data.venueName}</h2>
          <p className="text-xs text-slate-500 mb-4">
            {q.data.date} UTC · {t("admin.staffRedemptions.newestFirst")}
          </p>
          {rows.length === 0 ? (
            <p className="text-slate-500 text-sm">{t("admin.staffRedemptions.emptyDay")}</p>
          ) : (
            <>
              <ul className="md:hidden space-y-3">
                {rows.map((row) => (
                  <li
                    key={row.redemptionId}
                    className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${row.voidedAt ? "opacity-60" : ""}`}
                  >
                    <p className="font-mono text-3xl font-bold tracking-wide text-amber-900">
                      {row.staffVerificationCode}
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-900">
                      {row.perkCode} — {row.perkTitle}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{row.issuedAt}</p>
                    {row.voidedAt ? (
                      <p className="mt-2 text-xs font-medium text-red-600">
                        {t("admin.staffRedemptions.statusVoided")}
                      </p>
                    ) : (
                      <p className="mt-2 text-xs font-medium text-emerald-700">
                        {t("admin.staffRedemptions.statusActive")}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
              <div className="hidden md:block rounded-xl border border-slate-200 bg-white overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    {table.getHeaderGroups().map((hg) => (
                      <tr key={hg.id} className="border-b border-slate-200 bg-slate-50">
                        {hg.headers.map((h) => (
                          <th
                            key={h.id}
                            className="text-left px-3 py-2 text-xs uppercase text-slate-500"
                          >
                            {flexRender(h.column.columnDef.header, h.getContext())}
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody>
                    {table.getRowModel().rows.map((row) => (
                      <tr key={row.id} className="border-b border-slate-100">
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="px-3 py-2">
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
      ) : q.isPending ? (
        <p className="text-slate-600">{t("common.loading")}</p>
      ) : null}
    </div>
  );
}

"use client";

import Link from "next/link";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmModal } from "@/components/ConfirmModal";
import { TableRowCards } from "@/components/TableRowCards";
import {
  usePatchChallengeMutation,
  useVenueChallengesQuery,
  useVenuePerksQuery,
} from "@/lib/queries";

type Ch = {
  id: string;
  title: string;
  activeFrom: string | null;
  activeTo: string | null;
  rewardPerkId: string | null;
};

const colHelper = createColumnHelper<Ch>();

const fieldLbl = "text-[11px] font-semibold uppercase tracking-wide text-slate-500";
const fieldDt =
  "w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";
const btnRow =
  "rounded-lg bg-slate-800 px-3 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-slate-900 disabled:opacity-50";

type Props = {
  venueId: string;
  getToken: () => Promise<string | null>;
  enabled: boolean;
  variant?: "page" | "embedded";
};

export function VenueChallengesSection({
  venueId,
  getToken,
  enabled,
  variant = "page",
}: Props) {
  const { t } = useTranslation();
  const q = useVenueChallengesQuery(venueId, getToken, enabled && Boolean(venueId));
  const perksQ = useVenuePerksQuery(venueId, getToken, enabled && Boolean(venueId));
  const patchMut = usePatchChallengeMutation(getToken, venueId);
  const [edits, setEdits] = useState<Record<string, { from: string; to: string }>>({});
  const [saveChallenge, setSaveChallenge] = useState<{
    id: string;
    title: string;
    from: string;
    to: string;
  } | null>(null);

  useEffect(() => {
    if (!q.data) return;
    const e: Record<string, { from: string; to: string }> = {};
    for (const r of q.data) {
      e[r.id] = {
        from: r.activeFrom ? r.activeFrom.slice(0, 16) : "",
        to: r.activeTo ? r.activeTo.slice(0, 16) : "",
      };
    }
    setEdits(e);
  }, [q.data]);

  const columns = useMemo(
    () => [
      colHelper.accessor("title", {
        header: t("admin.venueCms.challenges.colChallenge"),
        cell: (info) => (
          <div>
            <div className="font-medium">{info.getValue()}</div>
            <div className="text-xs font-mono text-slate-500">{info.row.original.id}</div>
          </div>
        ),
      }),
      colHelper.display({
        id: "reward",
        header: t("admin.venueCms.challenges.colReward"),
        cell: ({ row }) => {
          const r = row.original;
          const perks = perksQ.data ?? [];
          return (
            <label className="flex w-full sm:min-w-[200px] sm:max-w-[320px] flex-col gap-1">
              <span className={fieldLbl}>{t("admin.venueCms.challenges.rewardPerkLabel")}</span>
              <select
                className={fieldDt}
                disabled={patchMut.isPending || perksQ.isPending}
                value={r.rewardPerkId ?? ""}
                onChange={async (e) => {
                  const v = e.target.value;
                  await patchMut.mutateAsync({
                    id: r.id,
                    body: { rewardPerkId: v === "" ? null : v },
                  });
                }}
              >
                <option value="">{t("admin.venueCms.common.none")}</option>
                {perks.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({p.code})
                  </option>
                ))}
              </select>
            </label>
          );
        },
      }),
      colHelper.display({
        id: "window",
        header: t("admin.venueCms.challenges.colWindow"),
        cell: ({ row }) => {
          const r = row.original;
          const ed = edits[r.id];
          return (
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3 text-sm">
              <label className="flex w-full sm:min-w-[160px] sm:flex-1 flex-col gap-1">
                <span className={fieldLbl}>{t("admin.venueCms.challenges.activeFromUtc")}</span>
                <input
                  type="datetime-local"
                  className={fieldDt}
                  value={ed?.from ?? ""}
                  onChange={(e) =>
                    setEdits((prev) => ({
                      ...prev,
                      [r.id]: { ...prev[r.id]!, from: e.target.value },
                    }))
                  }
                />
              </label>
              <label className="flex w-full sm:min-w-[160px] sm:flex-1 flex-col gap-1">
                <span className={fieldLbl}>{t("admin.venueCms.challenges.activeToUtc")}</span>
                <input
                  type="datetime-local"
                  className={fieldDt}
                  value={ed?.to ?? ""}
                  onChange={(e) =>
                    setEdits((prev) => ({
                      ...prev,
                      [r.id]: { ...prev[r.id]!, to: e.target.value },
                    }))
                  }
                />
              </label>
              <button
                type="button"
                disabled={patchMut.isPending}
                onClick={() => {
                  const eRow = edits[r.id];
                  if (!eRow) return;
                  setSaveChallenge({
                    id: r.id,
                    title: r.title,
                    from: eRow.from,
                    to: eRow.to,
                  });
                }}
                className={`h-[38px] shrink-0 ${btnRow}`}
              >
                {t("admin.venueCms.common.saveEllipsis")}
              </button>
            </div>
          );
        },
      }),
    ],
    [edits, patchMut.isPending, perksQ.data, perksQ.isPending, t],
  );

  const table = useReactTable({
    data: q.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const err = q.isError && q.error instanceof Error ? q.error.message : null;
  const embedded = variant === "embedded";
  const challengeCount = (q.data ?? []).length;

  return (
    <section
      className={
        embedded
          ? "mb-8 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.04] md:p-6"
          : "min-h-screen bg-slate-50 px-4 py-6 sm:p-8 text-slate-900"
      }
    >
      {embedded ? (
        <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              {t("admin.venueCms.challenges.embeddedTitle")}
            </h2>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
              {t("admin.venueCms.challenges.embeddedLead")}
            </p>
          </div>
          <span
            className={
              challengeCount > 0
                ? "inline-flex shrink-0 items-center rounded-full border border-slate-200/90 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700"
                : "inline-flex shrink-0 items-center rounded-full border border-slate-200/90 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500"
            }
          >
            {challengeCount === 0
              ? t("admin.venueCms.challenges.badgeNone")
              : t("admin.venueCms.challenges.badgeCount", { count: challengeCount })}
          </span>
        </div>
      ) : (
        <>
          <Link href="/venues" className="text-brand text-sm">
            {t("admin.venueCms.common.backVenues")}
          </Link>
          <h1 className="text-xl font-bold mt-4 mb-4">{t("admin.venueCms.challenges.pageTitle")}</h1>
        </>
      )}

      {err ? (
        <div
          className="mb-4 rounded-xl border border-red-200/90 bg-red-50/90 px-4 py-3 text-sm text-red-900"
          role="alert"
        >
          {err}
        </div>
      ) : null}
      {patchMut.isError && patchMut.error instanceof Error ? (
        <div
          className="mb-4 rounded-xl border border-red-200/90 bg-red-50/90 px-4 py-3 text-sm text-red-900"
          role="alert"
        >
          {patchMut.error.message}
        </div>
      ) : null}

      {embedded ? (
        <p className={fieldLbl}>{t("admin.venueCms.challenges.scheduleWindows")}</p>
      ) : null}
      {q.isPending && !q.data ? (
        <p
          className={
            embedded
              ? "mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-3 py-4 text-sm text-slate-500"
              : "text-sm text-slate-600"
          }
        >
          {t("admin.venueCms.challenges.loading")}
        </p>
      ) : (
        <>
          <TableRowCards rows={table.getRowModel().rows} leadCellId="title" actionCellIds={["window"]} />
          <div
            className={
              embedded
                ? "hidden md:block mt-3 overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-sm"
                : "hidden md:block max-w-4xl overflow-x-auto rounded-xl border border-slate-200 bg-white"
            }
          >
            <table className="min-w-full text-sm">
            <thead className="bg-slate-50/90">
              {table.getHeaderGroups().map((hg) => (
                <tr
                  key={hg.id}
                  className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  {hg.headers.map((h) => (
                    <th key={h.id} className="px-3 py-2.5 pr-3 text-left">
                      {flexRender(h.column.columnDef.header, h.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="border-t border-slate-100 px-3 py-6 text-center text-sm text-slate-500"
                  >
                    {t("admin.venueCms.challenges.empty")}
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 align-top">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
          {(q.data ?? []).length === 0 ? (
            <p
              className={
                embedded
                  ? "md:hidden mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-3 py-4 text-sm text-slate-500 text-center"
                  : "md:hidden rounded-lg border border-slate-200 px-3 py-6 text-sm text-slate-500 text-center"
              }
            >
              No challenges for this venue.
            </p>
          ) : null}
        </>
      )}

      <ConfirmModal
        open={saveChallenge !== null}
        onClose={() => setSaveChallenge(null)}
        title={t("admin.venueCms.challenges.saveWindowTitle")}
        description={
          saveChallenge ? (
            <p>
              {t("admin.venueCms.challenges.saveWindowBody", {
                title: saveChallenge.title,
                from: saveChallenge.from || "—",
                to: saveChallenge.to || "—",
              })}
            </p>
          ) : null
        }
        confirmLabel={t("admin.venueCms.common.save")}
        onConfirm={async () => {
          if (!saveChallenge) return;
          await patchMut.mutateAsync({
            id: saveChallenge.id,
            body: {
              activeFrom: saveChallenge.from ? new Date(saveChallenge.from).toISOString() : null,
              activeTo: saveChallenge.to ? new Date(saveChallenge.to).toISOString() : null,
            },
          });
          setSaveChallenge(null);
        }}
      />

      {!embedded ? null : (
        <p className="text-xs text-slate-500 mt-3">
          {t("admin.venueCms.common.standalonePage")}{" "}
          <Link href={`/challenges/${venueId}`} className="text-brand hover:underline font-medium">
            {t("admin.venueCms.challenges.openFullWidth")}
          </Link>
        </p>
      )}
    </section>
  );
}

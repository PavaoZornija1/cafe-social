"use client";

import Link from "next/link";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";
import { ConfirmModal } from "@/components/ConfirmModal";
import { usePatchChallengeMutation, useVenueChallengesQuery } from "@/lib/queries";

type Ch = {
  id: string;
  title: string;
  activeFrom: string | null;
  activeTo: string | null;
};

const colHelper = createColumnHelper<Ch>();

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
  const q = useVenueChallengesQuery(venueId, getToken, enabled && Boolean(venueId));
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
        header: "Challenge",
        cell: (info) => (
          <div>
            <div className="font-medium">{info.getValue()}</div>
            <div className="text-xs font-mono text-slate-500">{info.row.original.id}</div>
          </div>
        ),
      }),
      colHelper.display({
        id: "window",
        header: "UTC window",
        cell: ({ row }) => {
          const r = row.original;
          const ed = edits[r.id];
          return (
            <div className="flex gap-2 text-sm flex-wrap items-end">
              <label className="flex-1 min-w-[140px]">
                activeFrom
                <input
                  type="datetime-local"
                  className="w-full bg-white border border-slate-300 rounded px-1 mt-0.5"
                  value={ed?.from ?? ""}
                  onChange={(e) =>
                    setEdits((prev) => ({
                      ...prev,
                      [r.id]: { ...prev[r.id]!, from: e.target.value },
                    }))
                  }
                />
              </label>
              <label className="flex-1 min-w-[140px]">
                activeTo
                <input
                  type="datetime-local"
                  className="w-full bg-white border border-slate-300 rounded px-1 mt-0.5"
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
                className="text-xs bg-emerald-700 text-white rounded px-2 py-1.5 h-fit"
              >
                Save…
              </button>
            </div>
          );
        },
      }),
    ],
    [edits, patchMut.isPending],
  );

  const table = useReactTable({
    data: q.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const err = q.isError && q.error instanceof Error ? q.error.message : null;
  const embedded = variant === "embedded";

  return (
    <section
      className={
        embedded
          ? "rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm"
          : "min-h-screen bg-slate-50 text-slate-900 p-8"
      }
    >
      {embedded ? (
        <header className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900 tracking-tight">
            Challenges
          </h2>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Goals and schedules for this venue. Times are stored in UTC; adjust windows with care
            for your audience.
          </p>
        </header>
      ) : (
        <>
          <Link href="/venues" className="text-brand text-sm">
            ← Venues
          </Link>
          <h1 className="text-xl font-bold mt-4 mb-4">Challenges (UTC window)</h1>
        </>
      )}

      {err ? <p className="text-red-600 mb-2">{err}</p> : null}
      {patchMut.isError && patchMut.error instanceof Error ? (
        <p className="text-red-600 mb-2 text-sm">{patchMut.error.message}</p>
      ) : null}

      {q.isPending && !q.data ? (
        <p className="text-slate-600 text-sm">Loading challenges…</p>
      ) : (
        <div
          className={
            embedded
              ? "rounded-xl border border-slate-200 bg-white overflow-x-auto"
              : "rounded-xl border border-slate-200 bg-white overflow-x-auto max-w-4xl"
          }
        >
          <table className="min-w-full text-sm">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b border-slate-200 bg-slate-50">
                  {hg.headers.map((h) => (
                    <th key={h.id} className="text-left px-3 py-2 text-xs uppercase text-slate-500">
                      {flexRender(h.column.columnDef.header, h.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 align-top">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        open={saveChallenge !== null}
        onClose={() => setSaveChallenge(null)}
        title="Save challenge UTC window?"
        description={
          saveChallenge ? (
            <p>
              Update schedule for{" "}
              <span className="font-semibold text-slate-900">{saveChallenge.title}</span>
              :{" "}
              <span className="font-mono text-xs text-slate-700">
                {saveChallenge.from || "—"} → {saveChallenge.to || "—"}
              </span>
            </p>
          ) : null
        }
        confirmLabel="Save"
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
          Standalone page:{" "}
          <Link href={`/challenges/${venueId}`} className="text-brand hover:underline font-medium">
            Open challenges in full width
          </Link>
        </p>
      )}
    </section>
  );
}

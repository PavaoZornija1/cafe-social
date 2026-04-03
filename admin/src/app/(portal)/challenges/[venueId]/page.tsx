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
import { useEffect, useMemo, useState } from "react";
import { usePatchChallengeMutation, useVenueChallengesQuery } from "@/lib/queries";

type Ch = {
  id: string;
  title: string;
  activeFrom: string | null;
  activeTo: string | null;
};

const colHelper = createColumnHelper<Ch>();

export default function ChallengesAdminPage() {
  const { venueId } = useParams<{ venueId: string }>();
  const { isLoaded, getToken } = useAuth();
  const q = useVenueChallengesQuery(venueId, getToken, isLoaded && Boolean(venueId));
  const patchMut = usePatchChallengeMutation(getToken, venueId);
  const [edits, setEdits] = useState<Record<string, { from: string; to: string }>>({});

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
                  const e = edits[r.id];
                  if (!e) return;
                  void patchMut.mutateAsync({
                    id: r.id,
                    body: {
                      activeFrom: e.from ? new Date(e.from).toISOString() : null,
                      activeTo: e.to ? new Date(e.to).toISOString() : null,
                    },
                  });
                }}
                className="text-xs bg-emerald-700 text-white rounded px-2 py-1.5 h-fit"
              >
                Save
              </button>
            </div>
          );
        },
      }),
    ],
    [edits, patchMut],
  );

  const table = useReactTable({
    data: q.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const err = q.isError && q.error instanceof Error ? q.error.message : null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-8">
      <Link href="/venues" className="text-brand text-sm">
        ← Venues
      </Link>
      <h1 className="text-xl font-bold mt-4 mb-4">Challenges (UTC window)</h1>
      {err ? <p className="text-red-600 mb-2">{err}</p> : null}
      {patchMut.isError && patchMut.error instanceof Error ? (
        <p className="text-red-600 mb-2 text-sm">{patchMut.error.message}</p>
      ) : null}
      {q.isPending && !q.data ? (
        <p>Loading…</p>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto max-w-4xl">
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
    </div>
  );
}

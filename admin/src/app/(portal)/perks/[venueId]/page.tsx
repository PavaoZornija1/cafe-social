"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useParams } from "next/navigation";
import { useForm } from "@tanstack/react-form";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo } from "react";
import {
  useCreatePerkMutation,
  useDeletePerkMutation,
  useVenuePerksQuery,
} from "@/lib/queries";

type Perk = {
  id: string;
  code: string;
  title: string;
  redemptionCount: number;
};

const colHelper = createColumnHelper<Perk>();

export default function PerksAdminPage() {
  const { venueId } = useParams<{ venueId: string }>();
  const { isLoaded, getToken } = useAuth();
  const perksQ = useVenuePerksQuery(venueId, getToken, isLoaded && Boolean(venueId));
  const createMut = useCreatePerkMutation(venueId, getToken);
  const deleteMut = useDeletePerkMutation(venueId, getToken);

  const form = useForm({
    defaultValues: { code: "", title: "", requiresQr: false },
    onSubmit: async ({ value }) => {
      await createMut.mutateAsync({
        code: value.code,
        title: value.title,
        requiresQrUnlock: value.requiresQr,
      });
      form.reset();
    },
  });

  const columns = useMemo(
    () => [
      colHelper.display({
        id: "perk",
        header: "Perk",
        cell: ({ row }) => (
          <span>
            <span className="font-mono text-amber-900">{row.original.code}</span> —{" "}
            {row.original.title}{" "}
            <span className="text-slate-500">({row.original.redemptionCount})</span>
          </span>
        ),
      }),
      colHelper.display({
        id: "del",
        header: "",
        cell: ({ row }) => (
          <button
            type="button"
            disabled={deleteMut.isPending}
            onClick={() => void deleteMut.mutateAsync(row.original.id)}
            className="text-red-600 text-xs"
          >
            Delete
          </button>
        ),
      }),
    ],
    [],
  );

  const table = useReactTable({
    data: perksQ.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const err =
    perksQ.isError && perksQ.error instanceof Error
      ? perksQ.error.message
      : createMut.error instanceof Error
        ? createMut.error.message
        : deleteMut.error instanceof Error
          ? deleteMut.error.message
          : null;

  if (!venueId) return null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-8 max-w-3xl">
      <Link href="/venues" className="text-brand text-sm">
        ← Venues
      </Link>
      <h1 className="text-xl font-bold mt-4 mb-4">Perk codes</h1>
      {err ? <p className="text-red-600 text-sm mb-2">{err}</p> : null}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
        className="border border-slate-200 rounded p-3 mb-4 space-y-2 max-w-lg"
      >
        <form.Field name="code">
          {(f) => (
            <input
              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-sm"
              placeholder="CODE (e.g. COFFEE10)"
              value={f.state.value}
              onChange={(e) => f.handleChange(e.target.value)}
            />
          )}
        </form.Field>
        <form.Field name="title">
          {(f) => (
            <input
              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-sm"
              placeholder="Title shown after redeem"
              value={f.state.value}
              onChange={(e) => f.handleChange(e.target.value)}
            />
          )}
        </form.Field>
        <form.Field name="requiresQr">
          {(f) => (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={f.state.value}
                onChange={(e) => f.handleChange(e.target.checked)}
              />
              Requires QR unlock
            </label>
          )}
        </form.Field>
        <button
          type="submit"
          disabled={createMut.isPending}
          className="bg-amber-600 rounded px-3 py-1 text-sm font-medium disabled:opacity-50"
        >
          Create
        </button>
      </form>
      {perksQ.isPending && !perksQ.data ? (
        <p className="text-slate-600">Loading…</p>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
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
      )}
    </div>
  );
}

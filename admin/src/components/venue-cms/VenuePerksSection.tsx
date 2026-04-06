"use client";

import Link from "next/link";
import { useForm } from "@tanstack/react-form";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { ConfirmModal } from "@/components/ConfirmModal";
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

type Props = {
  venueId: string;
  getToken: () => Promise<string | null>;
  enabled: boolean;
  variant?: "page" | "embedded";
};

export function VenuePerksSection({
  venueId,
  getToken,
  enabled,
  variant = "page",
}: Props) {
  const perksQ = useVenuePerksQuery(venueId, getToken, enabled && Boolean(venueId));
  const createMut = useCreatePerkMutation(venueId, getToken);
  const deleteMut = useDeletePerkMutation(venueId, getToken);
  const [deleteTarget, setDeleteTarget] = useState<Perk | null>(null);

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
            onClick={() => setDeleteTarget(row.original)}
            className="text-red-600 text-xs"
          >
            Delete
          </button>
        ),
      }),
    ],
    [deleteMut.isPending],
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

  const embedded = variant === "embedded";

  return (
    <section
      className={
        embedded
          ? "rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm"
          : "min-h-screen bg-slate-50 text-slate-900 p-8 max-w-3xl"
      }
    >
      {embedded ? (
        <header className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900 tracking-tight">
            Perks &amp; redeem codes
          </h2>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Codes guests claim in the app (redemption counts shown). Separate from marketing offers
            above.
          </p>
        </header>
      ) : (
        <>
          <Link href="/venues" className="text-brand text-sm">
            ← Venues
          </Link>
          <h1 className="text-xl font-bold mt-4 mb-4">Perk codes</h1>
        </>
      )}

      {err ? <p className="text-red-600 text-sm mb-2">{err}</p> : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
        className="border border-slate-200 rounded-lg p-3 mb-4 space-y-2 max-w-lg bg-slate-50/80"
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
          className="bg-amber-600 rounded px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
        >
          Create…
        </button>
      </form>

      <ConfirmModal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete perk?"
        variant="danger"
        description={
          deleteTarget ? (
            <p>
              Delete{" "}
              <span className="font-mono font-semibold text-slate-900">{deleteTarget.code}</span> —{" "}
              {deleteTarget.title}? This cannot be undone.
            </p>
          ) : null
        }
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteMut.mutateAsync(deleteTarget.id);
        }}
      />

      {perksQ.isPending && !perksQ.data ? (
        <p className="text-slate-600 text-sm">Loading perks…</p>
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

      {!embedded ? null : (
        <p className="text-xs text-slate-500 mt-3">
          Standalone page:{" "}
          <Link href={`/perks/${venueId}`} className="text-brand hover:underline font-medium">
            Open perks in full width
          </Link>
        </p>
      )}
    </section>
  );
}

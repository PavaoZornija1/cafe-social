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

const fieldCol = "flex min-w-0 flex-col gap-1.5";
const fieldLbl = "text-xs font-semibold uppercase tracking-wide text-slate-500";
const fieldInp =
  "w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";
const btnPrimary =
  "rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-900 disabled:opacity-50";

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
            className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
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
  const perkCount = (perksQ.data ?? []).length;

  return (
    <section
      className={
        embedded
          ? "mb-8 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.04] md:p-6"
          : "min-h-screen max-w-3xl bg-slate-50 p-8 text-slate-900"
      }
    >
      {embedded ? (
        <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Perks &amp; redeem codes</h2>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
              Codes guests claim in the app (redemption counts shown). Separate from marketing offers
              on this page.
            </p>
          </div>
          <span
            className={
              perkCount > 0
                ? "inline-flex shrink-0 items-center rounded-full border border-slate-200/90 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700"
                : "inline-flex shrink-0 items-center rounded-full border border-slate-200/90 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500"
            }
          >
            {perkCount === 0 ? "No perks" : `${perkCount} perk${perkCount === 1 ? "" : "s"}`}
          </span>
        </div>
      ) : (
        <>
          <Link href="/venues" className="text-brand text-sm">
            ← Venues
          </Link>
          <h1 className="text-xl font-bold mt-4 mb-4">Perk codes</h1>
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

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
        className={
          embedded
            ? "mb-6 rounded-xl border border-slate-200/90 bg-slate-50/70 p-4 shadow-sm md:p-5"
            : "mb-4 max-w-lg space-y-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3"
        }
      >
        <p className={embedded ? fieldLbl : "text-xs font-semibold text-slate-700"}>
          {embedded ? "Create perk" : "New perk"}
        </p>
        <div className={embedded ? "mt-4 space-y-4" : "mt-2 space-y-2"}>
          <form.Field name="code">
            {(f) => (
              <label className={fieldCol}>
                <span className={fieldLbl}>Code</span>
                <input
                  className={`${fieldInp} font-mono text-xs`}
                  placeholder="e.g. COFFEE10"
                  value={f.state.value}
                  onChange={(e) => f.handleChange(e.target.value)}
                  autoComplete="off"
                />
              </label>
            )}
          </form.Field>
          <form.Field name="title">
            {(f) => (
              <label className={fieldCol}>
                <span className={fieldLbl}>Title</span>
                <input
                  className={fieldInp}
                  placeholder="Shown after redeem"
                  value={f.state.value}
                  onChange={(e) => f.handleChange(e.target.value)}
                />
              </label>
            )}
          </form.Field>
          <form.Field name="requiresQr">
            {(f) => (
              <label className="inline-flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 shadow-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/30"
                  checked={f.state.value}
                  onChange={(e) => f.handleChange(e.target.checked)}
                />
                Requires QR unlock
              </label>
            )}
          </form.Field>
        </div>
        <button
          type="submit"
          disabled={createMut.isPending}
          className={`h-[42px] w-full sm:w-auto ${embedded ? "mt-4" : "mt-3"} ${btnPrimary}`}
        >
          {createMut.isPending ? "Creating…" : embedded ? "Create perk" : "Create…"}
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

      {embedded ? (
        <p className={fieldLbl}>Existing perks</p>
      ) : null}
      {perksQ.isPending && !perksQ.data ? (
        <p
          className={
            embedded
              ? "mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-3 py-4 text-sm text-slate-500"
              : "text-sm text-slate-600"
          }
        >
          Loading perks…
        </p>
      ) : (
        <div
          className={
            embedded
              ? "mt-3 overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-sm"
              : "overflow-x-auto rounded-xl border border-slate-200 bg-white"
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
                    colSpan={2}
                    className="border-t border-slate-100 px-3 py-6 text-center text-sm text-slate-500"
                  >
                    No perks yet.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-2.5 align-top">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
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

"use client";

import { useForm } from "@tanstack/react-form";
import { useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ConfirmModal } from "@/components/ConfirmModal";
import { IsoDateTimePicker } from "@/components/IsoDateTimePicker";
import {
  type AdminVenueOfferRow,
  useCreateVenueOfferMutation,
  useDeleteVenueOfferMutation,
  usePatchVenueOfferMutation,
  useVenueOffersQuery,
} from "@/lib/queries";

const colHelper = createColumnHelper<AdminVenueOfferRow>();

type Props = {
  venueId: string;
  getToken: () => Promise<string | null>;
  enabled: boolean;
};

function numOrNull(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function VenueOffersSection({ venueId, getToken, enabled }: Props) {
  const offersQ = useVenueOffersQuery(venueId, getToken, enabled && Boolean(venueId));
  const createMut = useCreateVenueOfferMutation(venueId, getToken);
  const patchMut = usePatchVenueOfferMutation(venueId, getToken);
  const deleteMut = useDeleteVenueOfferMutation(venueId, getToken);
  const [deleteTarget, setDeleteTarget] = useState<AdminVenueOfferRow | null>(null);
  const [editTarget, setEditTarget] = useState<AdminVenueOfferRow | null>(null);

  const createForm = useForm({
    defaultValues: {
      title: "",
      body: "",
      ctaUrl: "",
      imageUrl: "",
      status: "ACTIVE" as AdminVenueOfferRow["status"],
      isFeatured: false,
      validFrom: "",
      validTo: "",
      maxRedemptions: "",
      maxRedemptionsPerPlayer: "1",
    },
    onSubmit: async ({ value }) => {
      await createMut.mutateAsync({
        title: value.title.trim(),
        body: value.body.trim() || null,
        ctaUrl: value.ctaUrl.trim() || null,
        imageUrl: value.imageUrl.trim() || null,
        status: value.status,
        isFeatured: value.isFeatured,
        validFrom: value.validFrom.trim() || null,
        validTo: value.validTo.trim() || null,
        maxRedemptions: numOrNull(value.maxRedemptions),
        maxRedemptionsPerPlayer: numOrNull(value.maxRedemptionsPerPlayer),
      });
      createForm.reset();
    },
  });

  const editForm = useForm({
    defaultValues: {
      title: "",
      body: "",
      ctaUrl: "",
      imageUrl: "",
      status: "ACTIVE" as AdminVenueOfferRow["status"],
      isFeatured: false,
      validFrom: "",
      validTo: "",
      maxRedemptions: "",
      maxRedemptionsPerPlayer: "",
    },
    onSubmit: async ({ value }) => {
      if (!editTarget) return;
      await patchMut.mutateAsync({
        offerId: editTarget.id,
        body: {
          title: value.title.trim(),
          body: value.body.trim() || null,
          ctaUrl: value.ctaUrl.trim() || null,
          imageUrl: value.imageUrl.trim() || null,
          status: value.status,
          isFeatured: value.isFeatured,
          validFrom: value.validFrom.trim() || null,
          validTo: value.validTo.trim() || null,
          maxRedemptions: numOrNull(value.maxRedemptions),
          maxRedemptionsPerPlayer: numOrNull(value.maxRedemptionsPerPlayer),
        },
      });
      setEditTarget(null);
    },
  });

  const startEdit = (row: AdminVenueOfferRow) => {
    setEditTarget(row);
    editForm.reset({
      title: row.title,
      body: row.body ?? "",
      ctaUrl: row.ctaUrl ?? "",
      imageUrl: row.imageUrl ?? "",
      status: row.status,
      isFeatured: row.isFeatured,
      validFrom: row.validFrom ?? "",
      validTo: row.validTo ?? "",
      maxRedemptions: row.maxRedemptions != null ? String(row.maxRedemptions) : "",
      maxRedemptionsPerPlayer:
        row.maxRedemptionsPerPlayer != null ? String(row.maxRedemptionsPerPlayer) : "",
    });
  };

  const columns = useMemo(
    () => [
      colHelper.accessor("title", {
        header: "Offer",
        cell: ({ getValue, row }) => (
          <div>
            <div className="font-medium text-slate-900">{getValue()}</div>
            <div className="text-xs text-slate-500">
              {row.original.isFeatured ? "Featured · " : ""}
              {row.original.status}
              {" · "}
              {row.original.redemptionCount}
              {row.original.maxRedemptions != null
                ? ` / ${row.original.maxRedemptions}`
                : ""}{" "}
              redemptions
            </div>
          </div>
        ),
      }),
      colHelper.display({
        id: "status",
        header: "Status",
        cell: ({ row }) => (
          <select
            className="bg-white border border-slate-300 rounded px-2 py-1 text-xs"
            disabled={patchMut.isPending}
            value={row.original.status}
            onChange={(e) =>
              void patchMut.mutateAsync({
                offerId: row.original.id,
                body: { status: e.target.value },
              })
            }
          >
            <option value="DRAFT">DRAFT</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
        ),
      }),
      colHelper.display({
        id: "feat",
        header: "Spotlight",
        cell: ({ row }) => (
          <label className="flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={row.original.isFeatured}
              disabled={patchMut.isPending}
              onChange={(e) =>
                void patchMut.mutateAsync({
                  offerId: row.original.id,
                  body: { isFeatured: e.target.checked },
                })
              }
            />
            Featured
          </label>
        ),
      }),
      colHelper.display({
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex gap-2">
            <button
              type="button"
              className="text-brand text-xs font-medium"
              onClick={() => startEdit(row.original)}
            >
              Edit
            </button>
            <button
              type="button"
              disabled={deleteMut.isPending}
              className="text-red-600 text-xs"
              onClick={() => setDeleteTarget(row.original)}
            >
              Delete
            </button>
          </div>
        ),
      }),
    ],
    [deleteMut.isPending, patchMut],
  );

  const table = useReactTable({
    data: offersQ.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const formErr =
    createMut.error instanceof Error
      ? createMut.error.message
      : patchMut.error instanceof Error
        ? patchMut.error.message
        : null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm mb-6">
      <header className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900 tracking-tight">Offers &amp; promos</h2>
        <p className="text-sm text-slate-600 mt-1 max-w-2xl">
          Guest-facing offers on the home card (separate from perk codes). Only{" "}
          <strong className="font-medium">ACTIVE</strong> rows inside their date window appear in
          the app. Mark one as <strong className="font-medium">Featured</strong> for the spotlight
          slot; guests can redeem when you set per-player or global caps.
        </p>
      </header>

      {offersQ.isError && offersQ.error instanceof Error ? (
        <p className="text-red-600 text-sm mb-2">{offersQ.error.message}</p>
      ) : null}
      {formErr ? <p className="text-red-600 text-sm mb-2">{formErr}</p> : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void createForm.handleSubmit();
        }}
        className="border border-slate-200 rounded-lg p-3 mb-4 space-y-2 bg-slate-50/80"
      >
        <p className="text-xs font-semibold text-slate-700">Create offer</p>
        <createForm.Field name="title">
          {(f) => (
            <input
              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-sm"
              placeholder="Headline"
              value={f.state.value}
              onChange={(e) => f.handleChange(e.target.value)}
            />
          )}
        </createForm.Field>
        <createForm.Field name="body">
          {(f) => (
            <textarea
              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-sm min-h-[64px]"
              placeholder="Message (optional)"
              value={f.state.value}
              onChange={(e) => f.handleChange(e.target.value)}
            />
          )}
        </createForm.Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <createForm.Field name="ctaUrl">
            {(f) => (
              <input
                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-sm"
                placeholder="CTA URL (optional)"
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
              />
            )}
          </createForm.Field>
          <createForm.Field name="imageUrl">
            {(f) => (
              <input
                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-sm"
                placeholder="Image URL (optional)"
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
              />
            )}
          </createForm.Field>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <createForm.Field name="status">
            {(f) => (
              <label className="text-xs text-slate-600 flex items-center gap-1">
                Status
                <select
                  className="bg-white border border-slate-300 rounded px-2 py-1 text-sm"
                  value={f.state.value}
                  onChange={(e) =>
                    f.handleChange(e.target.value as AdminVenueOfferRow["status"])
                  }
                >
                  <option value="DRAFT">DRAFT</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </label>
            )}
          </createForm.Field>
          <createForm.Field name="isFeatured">
            {(f) => (
              <label className="flex items-center gap-1.5 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={f.state.value}
                  onChange={(e) => f.handleChange(e.target.checked)}
                />
                Featured spotlight
              </label>
            )}
          </createForm.Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <createForm.Field name="validFrom">
            {(f) => (
              <label className="block text-xs text-slate-600">
                Valid from (optional)
                <IsoDateTimePicker
                  value={f.state.value}
                  onChange={(iso) => f.handleChange(iso)}
                  disabled={createMut.isPending}
                />
              </label>
            )}
          </createForm.Field>
          <createForm.Field name="validTo">
            {(f) => (
              <label className="block text-xs text-slate-600">
                Valid to (optional)
                <IsoDateTimePicker
                  value={f.state.value}
                  onChange={(iso) => f.handleChange(iso)}
                  disabled={createMut.isPending}
                />
              </label>
            )}
          </createForm.Field>
        </div>
        <div className="flex flex-wrap gap-3">
          <createForm.Field name="maxRedemptions">
            {(f) => (
              <label className="text-xs text-slate-600">
                Max total redemptions (blank = unlimited)
                <input
                  type="number"
                  min={0}
                  className="mt-0.5 block w-40 bg-white border border-slate-300 rounded px-2 py-1 text-sm"
                  value={f.state.value}
                  onChange={(e) => f.handleChange(e.target.value)}
                />
              </label>
            )}
          </createForm.Field>
          <createForm.Field name="maxRedemptionsPerPlayer">
            {(f) => (
              <label className="text-xs text-slate-600">
                Max per guest (blank = unlimited)
                <input
                  type="number"
                  min={0}
                  className="mt-0.5 block w-40 bg-white border border-slate-300 rounded px-2 py-1 text-sm"
                  value={f.state.value}
                  onChange={(e) => f.handleChange(e.target.value)}
                />
              </label>
            )}
          </createForm.Field>
        </div>
        <button
          type="submit"
          disabled={createMut.isPending}
          className="bg-violet-600 rounded px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
        >
          Add offer
        </button>
      </form>

      {editTarget ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void editForm.handleSubmit();
          }}
          className="border border-violet-200 bg-violet-50/40 rounded-lg p-4 mb-4 space-y-2"
        >
          <div className="flex justify-between items-center gap-2">
            <p className="text-sm font-semibold text-slate-900">Edit "{editTarget.title}"</p>
            <button
              type="button"
              className="text-xs text-slate-600"
              onClick={() => setEditTarget(null)}
            >
              Cancel
            </button>
          </div>
          <editForm.Field name="title">
            {(f) => (
              <input
                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-sm"
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
              />
            )}
          </editForm.Field>
          <editForm.Field name="body">
            {(f) => (
              <textarea
                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-sm min-h-[64px]"
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
              />
            )}
          </editForm.Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <editForm.Field name="ctaUrl">
              {(f) => (
                <input
                  className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-sm"
                  placeholder="CTA URL"
                  value={f.state.value}
                  onChange={(e) => f.handleChange(e.target.value)}
                />
              )}
            </editForm.Field>
            <editForm.Field name="imageUrl">
              {(f) => (
                <input
                  className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-sm"
                  placeholder="Image URL"
                  value={f.state.value}
                  onChange={(e) => f.handleChange(e.target.value)}
                />
              )}
            </editForm.Field>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <editForm.Field name="status">
              {(f) => (
                <select
                  className="bg-white border border-slate-300 rounded px-2 py-1 text-sm"
                  value={f.state.value}
                  onChange={(e) =>
                    f.handleChange(e.target.value as AdminVenueOfferRow["status"])
                  }
                >
                  <option value="DRAFT">DRAFT</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              )}
            </editForm.Field>
            <editForm.Field name="isFeatured">
              {(f) => (
                <label className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={f.state.value}
                    onChange={(e) => f.handleChange(e.target.checked)}
                  />
                  Featured
                </label>
              )}
            </editForm.Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <editForm.Field name="validFrom">
              {(f) => (
                <label className="block text-xs text-slate-600">
                  Valid from
                  <IsoDateTimePicker
                    value={f.state.value}
                    onChange={(iso) => f.handleChange(iso)}
                    disabled={patchMut.isPending}
                  />
                </label>
              )}
            </editForm.Field>
            <editForm.Field name="validTo">
              {(f) => (
                <label className="block text-xs text-slate-600">
                  Valid to
                  <IsoDateTimePicker
                    value={f.state.value}
                    onChange={(iso) => f.handleChange(iso)}
                    disabled={patchMut.isPending}
                  />
                </label>
              )}
            </editForm.Field>
          </div>
          <div className="flex flex-wrap gap-3">
            <editForm.Field name="maxRedemptions">
              {(f) => (
                <label className="text-xs">
                  Max total
                  <input
                    type="number"
                    min={0}
                    className="mt-0.5 block w-36 bg-white border border-slate-300 rounded px-2 py-1 text-sm"
                    value={f.state.value}
                    onChange={(e) => f.handleChange(e.target.value)}
                  />
                </label>
              )}
            </editForm.Field>
            <editForm.Field name="maxRedemptionsPerPlayer">
              {(f) => (
                <label className="text-xs">
                  Max / guest
                  <input
                    type="number"
                    min={0}
                    className="mt-0.5 block w-36 bg-white border border-slate-300 rounded px-2 py-1 text-sm"
                    value={f.state.value}
                    onChange={(e) => f.handleChange(e.target.value)}
                  />
                </label>
              )}
            </editForm.Field>
          </div>
          <button
            type="submit"
            disabled={patchMut.isPending}
            className="bg-slate-900 text-white rounded px-3 py-1 text-sm disabled:opacity-50"
          >
            Save changes
          </button>
        </form>
      ) : null}

      <ConfirmModal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete offer?"
        variant="danger"
        description={
          deleteTarget ? (
            <p>
              Remove <span className="font-semibold">{deleteTarget.title}</span>? This cannot be
              undone.
            </p>
          ) : null
        }
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteMut.mutateAsync(deleteTarget.id);
        }}
      />

      {offersQ.isPending && !offersQ.data ? (
        <p className="text-slate-600 text-sm">Loading offers…</p>
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
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-slate-500 text-center">
                    No offers yet.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-2 align-top">
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
    </section>
  );
}

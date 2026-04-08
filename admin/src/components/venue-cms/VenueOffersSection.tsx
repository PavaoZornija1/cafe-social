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

const fieldCol = "flex min-w-0 flex-col gap-1.5";
const fieldLbl = "text-xs font-semibold uppercase tracking-wide text-slate-500";
const fieldInp =
  "w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";
/** Matches text inputs / checkbox row height in forms (native select ignores vertical padding inconsistently). */
const fieldSelect =
  "w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 h-[42px] box-border py-0 pr-9 leading-none";
const fieldToggleRow =
  "inline-flex h-[42px] w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm sm:w-auto";
const fieldInpXs =
  "rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";
const btnPrimary =
  "rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-900 disabled:opacity-50";
const btnBrand =
  "rounded-lg bg-brand px-3 py-2 text-sm font-medium text-brand-foreground shadow-sm transition-colors disabled:opacity-50";
const btnGhost =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50";

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
            className={`${fieldInpXs} max-w-[9rem]`}
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
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1.5 text-xs font-medium text-slate-700">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 rounded border-slate-300 text-brand focus:ring-brand/30"
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
              className="text-xs font-medium text-brand hover:underline"
              onClick={() => startEdit(row.original)}
            >
              Edit
            </button>
            <button
              type="button"
              disabled={deleteMut.isPending}
              className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
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

  const offerCount = (offersQ.data ?? []).length;

  return (
    <section className="mb-8 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.04] md:p-6">
      <div className="space-y-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Offers &amp; promos</h2>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
              Guest-facing offers on the home card (separate from perk codes). Only{" "}
              <strong className="font-medium text-slate-700">ACTIVE</strong> rows inside their date
              window appear in the app. Mark one as{" "}
              <strong className="font-medium text-slate-700">Featured</strong> for the spotlight slot;
              guests can redeem when you set per-player or global caps.
            </p>
          </div>
          <span
            className={
              offerCount > 0
                ? "inline-flex shrink-0 items-center rounded-full border border-slate-200/90 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700"
                : "inline-flex shrink-0 items-center rounded-full border border-slate-200/90 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500"
            }
          >
            {offerCount === 0
              ? "No offers"
              : `${offerCount} offer${offerCount === 1 ? "" : "s"}`}
          </span>
        </div>

        {offersQ.isError && offersQ.error instanceof Error ? (
          <div
            className="rounded-xl border border-red-200/90 bg-red-50/90 px-4 py-3 text-sm text-red-900"
            role="alert"
          >
            {offersQ.error.message}
          </div>
        ) : null}
        {formErr ? (
          <div
            className="rounded-xl border border-red-200/90 bg-red-50/90 px-4 py-3 text-sm text-red-900"
            role="alert"
          >
            {formErr}
          </div>
        ) : null}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void createForm.handleSubmit();
          }}
          className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-4 shadow-sm md:p-5"
        >
          <p className={fieldLbl}>Create offer</p>
          <div className="mt-4 space-y-4">
            <createForm.Field name="title">
              {(f) => (
                <label className={fieldCol}>
                  <span className={fieldLbl}>Headline</span>
                  <input
                    className={fieldInp}
                    placeholder="e.g. Free pastry with any drink"
                    value={f.state.value}
                    onChange={(e) => f.handleChange(e.target.value)}
                  />
                </label>
              )}
            </createForm.Field>
            <createForm.Field name="body">
              {(f) => (
                <label className={fieldCol}>
                  <span className={fieldLbl}>Message (optional)</span>
                  <textarea
                    className={`${fieldInp} min-h-[72px]`}
                    placeholder="Short description for the card"
                    value={f.state.value}
                    onChange={(e) => f.handleChange(e.target.value)}
                  />
                </label>
              )}
            </createForm.Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
              <createForm.Field name="ctaUrl">
                {(f) => (
                  <label className={fieldCol}>
                    <span className={fieldLbl}>CTA URL (optional)</span>
                    <input
                      className={fieldInp}
                      inputMode="url"
                      autoComplete="url"
                      placeholder="https://…"
                      value={f.state.value}
                      onChange={(e) => f.handleChange(e.target.value)}
                    />
                  </label>
                )}
              </createForm.Field>
              <createForm.Field name="imageUrl">
                {(f) => (
                  <label className={fieldCol}>
                    <span className={fieldLbl}>Image URL (optional)</span>
                    <input
                      className={fieldInp}
                      inputMode="url"
                      autoComplete="url"
                      placeholder="https://…"
                      value={f.state.value}
                      onChange={(e) => f.handleChange(e.target.value)}
                    />
                  </label>
                )}
              </createForm.Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 sm:items-end">
              <createForm.Field name="status">
                {(f) => (
                  <label className={fieldCol}>
                    <span className={fieldLbl}>Status</span>
                    <select
                      className={fieldSelect}
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
                  <label className={fieldCol}>
                    <span className={fieldLbl}>Spotlight</span>
                    <span className={fieldToggleRow}>
                      <input
                        type="checkbox"
                        className="h-4 w-4 shrink-0 rounded border-slate-300 text-brand focus:ring-brand/30"
                        checked={f.state.value}
                        onChange={(e) => f.handleChange(e.target.checked)}
                      />
                      Featured
                    </span>
                  </label>
                )}
              </createForm.Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
              <createForm.Field name="validFrom">
                {(f) => (
                  <label className={fieldCol}>
                    <span className={fieldLbl}>Valid from (optional)</span>
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
                  <label className={fieldCol}>
                    <span className={fieldLbl}>Valid to (optional)</span>
                    <IsoDateTimePicker
                      value={f.state.value}
                      onChange={(iso) => f.handleChange(iso)}
                      disabled={createMut.isPending}
                    />
                  </label>
                )}
              </createForm.Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
              <createForm.Field name="maxRedemptions">
                {(f) => (
                  <label className={fieldCol}>
                    <span className={fieldLbl}>Max total redemptions</span>
                    <input
                      type="number"
                      min={0}
                      className={`${fieldInp} max-w-xs`}
                      placeholder="Blank = unlimited"
                      value={f.state.value}
                      onChange={(e) => f.handleChange(e.target.value)}
                    />
                  </label>
                )}
              </createForm.Field>
              <createForm.Field name="maxRedemptionsPerPlayer">
                {(f) => (
                  <label className={fieldCol}>
                    <span className={fieldLbl}>Max per guest</span>
                    <input
                      type="number"
                      min={0}
                      className={`${fieldInp} max-w-xs`}
                      placeholder="Blank = unlimited"
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
              className={`h-[42px] ${btnPrimary}`}
            >
              {createMut.isPending ? "Adding…" : "Add offer"}
            </button>
          </div>
        </form>

        {editTarget ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void editForm.handleSubmit();
            }}
            className="rounded-xl border border-brand/25 bg-brand-light/25 p-4 shadow-sm md:p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <p className="text-sm font-semibold text-slate-900">
                Edit &quot;{editTarget.title}&quot;
              </p>
              <button
                type="button"
                className={btnGhost}
                onClick={() => setEditTarget(null)}
              >
                Cancel
              </button>
            </div>
            <div className="mt-4 space-y-4">
              <editForm.Field name="title">
                {(f) => (
                  <label className={fieldCol}>
                    <span className={fieldLbl}>Headline</span>
                    <input
                      className={fieldInp}
                      value={f.state.value}
                      onChange={(e) => f.handleChange(e.target.value)}
                    />
                  </label>
                )}
              </editForm.Field>
              <editForm.Field name="body">
                {(f) => (
                  <label className={fieldCol}>
                    <span className={fieldLbl}>Message</span>
                    <textarea
                      className={`${fieldInp} min-h-[72px]`}
                      value={f.state.value}
                      onChange={(e) => f.handleChange(e.target.value)}
                    />
                  </label>
                )}
              </editForm.Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
                <editForm.Field name="ctaUrl">
                  {(f) => (
                    <label className={fieldCol}>
                      <span className={fieldLbl}>CTA URL</span>
                      <input
                        className={fieldInp}
                        inputMode="url"
                        autoComplete="url"
                        placeholder="https://…"
                        value={f.state.value}
                        onChange={(e) => f.handleChange(e.target.value)}
                      />
                    </label>
                  )}
                </editForm.Field>
                <editForm.Field name="imageUrl">
                  {(f) => (
                    <label className={fieldCol}>
                      <span className={fieldLbl}>Image URL</span>
                      <input
                        className={fieldInp}
                        inputMode="url"
                        autoComplete="url"
                        placeholder="https://…"
                        value={f.state.value}
                        onChange={(e) => f.handleChange(e.target.value)}
                      />
                    </label>
                  )}
                </editForm.Field>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 sm:items-end">
                <editForm.Field name="status">
                  {(f) => (
                    <label className={fieldCol}>
                      <span className={fieldLbl}>Status</span>
                      <select
                        className={fieldSelect}
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
                </editForm.Field>
                <editForm.Field name="isFeatured">
                  {(f) => (
                    <label className={fieldCol}>
                      <span className={fieldLbl}>Spotlight</span>
                      <span className={fieldToggleRow}>
                        <input
                          type="checkbox"
                          className="h-4 w-4 shrink-0 rounded border-slate-300 text-brand focus:ring-brand/30"
                          checked={f.state.value}
                          onChange={(e) => f.handleChange(e.target.checked)}
                        />
                        Featured
                      </span>
                    </label>
                  )}
                </editForm.Field>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
                <editForm.Field name="validFrom">
                  {(f) => (
                    <label className={fieldCol}>
                      <span className={fieldLbl}>Valid from</span>
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
                    <label className={fieldCol}>
                      <span className={fieldLbl}>Valid to</span>
                      <IsoDateTimePicker
                        value={f.state.value}
                        onChange={(iso) => f.handleChange(iso)}
                        disabled={patchMut.isPending}
                      />
                    </label>
                  )}
                </editForm.Field>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
                <editForm.Field name="maxRedemptions">
                  {(f) => (
                    <label className={fieldCol}>
                      <span className={fieldLbl}>Max total</span>
                      <input
                        type="number"
                        min={0}
                        className={`${fieldInp} max-w-xs`}
                        placeholder="Blank = unlimited"
                        value={f.state.value}
                        onChange={(e) => f.handleChange(e.target.value)}
                      />
                    </label>
                  )}
                </editForm.Field>
                <editForm.Field name="maxRedemptionsPerPlayer">
                  {(f) => (
                    <label className={fieldCol}>
                      <span className={fieldLbl}>Max per guest</span>
                      <input
                        type="number"
                        min={0}
                        className={`${fieldInp} max-w-xs`}
                        placeholder="Blank = unlimited"
                        value={f.state.value}
                        onChange={(e) => f.handleChange(e.target.value)}
                      />
                    </label>
                  )}
                </editForm.Field>
              </div>
              <button type="submit" disabled={patchMut.isPending} className={btnBrand}>
                {patchMut.isPending ? "Saving…" : "Save changes"}
              </button>
            </div>
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

        <div>
          <p className={fieldLbl}>Existing offers</p>
          {offersQ.isPending && !offersQ.data ? (
            <p className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-3 py-4 text-sm text-slate-500">
              Loading offers…
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-sm">
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
                      <td colSpan={4} className="border-t border-slate-100 px-3 py-6 text-center text-sm text-slate-500">
                        No offers yet.
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
        </div>
      </div>
    </section>
  );
}

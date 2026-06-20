"use client";

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmModal } from "@/components/ConfirmModal";
import { TableRowCards } from "@/components/TableRowCards";
import { useVenueCmsEditor } from "@/components/venue-cms-editor/VenueCmsEditorContext";
import {
  type AdminVenueStaffRow,
  useAdminVenueStaffQuery,
  useAdminVenueStaffRemoveMutation,
  useAdminVenueStaffUpsertMutation,
} from "@/lib/queries";

const staffColHelper = createColumnHelper<AdminVenueStaffRow>();

const staffFieldText =
  "w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 h-[42px] box-border py-0 leading-none";
const staffFieldSelect =
  "w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 h-[42px] box-border py-0 pr-9 leading-none";

export function VenueCmsStaffSection() {
  const { t } = useTranslation();
  const { venueId, getToken, isLoaded } = useVenueCmsEditor();

  const [pageErr, setPageErr] = useState<string | null>(null);
  const [staffEmail, setStaffEmail] = useState("");
  const [staffRole, setStaffRole] = useState<AdminVenueStaffRow["role"]>("EMPLOYEE");
  const [staffRemoveTarget, setStaffRemoveTarget] = useState<AdminVenueStaffRow | null>(null);
  const [addStaffConfirmOpen, setAddStaffConfirmOpen] = useState(false);

  const staffQ = useAdminVenueStaffQuery(venueId, getToken, Boolean(isLoaded && venueId));
  const staffAddMut = useAdminVenueStaffUpsertMutation(venueId, getToken);
  const staffRemoveMut = useAdminVenueStaffRemoveMutation(venueId, getToken);

  const staffRows = staffQ.data ?? [];

  const staffColumns = useMemo(
    () => [
      staffColHelper.accessor((row) => row.player.email, {
        id: "email",
        header: t("admin.venueCms.common.email"),
        cell: (cell) => <span className="text-slate-800">{cell.getValue()}</span>,
      }),
      staffColHelper.accessor("role", {
        header: t("admin.venueCms.common.role"),
        cell: (cell) => (
          <span className="font-mono text-xs text-brand">{cell.getValue()}</span>
        ),
      }),
      staffColHelper.display({
        id: "rm",
        header: "",
        cell: ({ row }) => (
          <button
            type="button"
            disabled={staffRemoveMut.isPending || staffAddMut.isPending}
            onClick={() => setStaffRemoveTarget(row.original)}
            className="text-xs text-red-600 hover:text-red-800"
          >
            {t("admin.venueCms.common.remove")}
          </button>
        ),
      }),
    ],
    [staffAddMut.isPending, staffRemoveMut.isPending, t],
  );

  const staffTable = useReactTable({
    data: staffRows,
    columns: staffColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });

  const addStaff = async () => {
    if (!venueId || !staffEmail.trim()) return;
    setAddStaffConfirmOpen(true);
  };

  const runAddStaff = async () => {
    if (!venueId || !staffEmail.trim()) return;
    setPageErr(null);
    try {
      await staffAddMut.mutateAsync({
        email: staffEmail.trim(),
        role: staffRole,
      });
      setStaffEmail("");
    } catch (error) {
      setPageErr((error as Error).message);
      throw error;
    }
  };

  const staffLoadErr =
    staffQ.isError && staffQ.error instanceof Error ? staffQ.error.message : null;

  return (
    <>
      <section className="mb-8 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.04] md:p-6">
        <div className="space-y-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">{t("admin.venueCms.editor.staffTitle")}</h2>
              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
                {t("admin.venueCms.editor.staffLead")}
              </p>
            </div>
            <span
              className={
                staffRows.length > 0
                  ? "inline-flex shrink-0 items-center rounded-full border border-slate-200/90 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700"
                  : "inline-flex shrink-0 items-center rounded-full border border-slate-200/90 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500"
              }
            >
              {staffRows.length === 0
                ? t("admin.venueCms.editor.staffBadgeNone")
                : t("admin.venueCms.editor.staffBadgeCount", { count: staffRows.length })}
            </span>
          </div>

          {staffLoadErr ? (
            <div
              className="rounded-xl border border-red-200/90 bg-red-50/90 px-4 py-3 text-sm text-red-900"
              role="alert"
            >
              {staffLoadErr}
            </div>
          ) : null}
          {pageErr ? (
            <div
              className="rounded-xl border border-red-200/90 bg-red-50/90 px-4 py-3 text-sm text-red-900"
              role="alert"
            >
              {pageErr}
            </div>
          ) : null}

          <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-4 shadow-sm md:p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t("admin.venueCms.editor.addOrUpdateAccess")}
            </p>
            <div className="mt-3 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
                <label className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t("admin.venueCms.common.email")}
                  </span>
                  <input
                    type="email"
                    className={staffFieldText}
                    value={staffEmail}
                    onChange={(event) => setStaffEmail(event.target.value)}
                    placeholder={t("admin.venueCms.editor.staffEmailPlaceholder")}
                    autoComplete="email"
                  />
                </label>
                <label className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t("admin.venueCms.editor.staffRoleLabel")}
                  </span>
                  <select
                    className={staffFieldSelect}
                    value={staffRole}
                    onChange={(event) =>
                      setStaffRole(event.target.value as AdminVenueStaffRow["role"])
                    }
                  >
                    <option value="EMPLOYEE">EMPLOYEE</option>
                    <option value="MANAGER">MANAGER</option>
                    <option value="OWNER">OWNER</option>
                  </select>
                </label>
              </div>
              <button
                type="button"
                disabled={staffAddMut.isPending}
                onClick={() => void addStaff()}
                className="h-[42px] w-full rounded-lg bg-slate-800 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-900 disabled:opacity-50 sm:w-auto"
              >
                {staffAddMut.isPending
                  ? t("admin.venueCms.common.working")
                  : t("admin.venueCms.common.addUpdate")}
              </button>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t("admin.venueCms.editor.currentAccess")}
            </p>
            <div className="mt-3 rounded-xl border border-slate-200/90 bg-white shadow-sm">
              {staffRows.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-slate-500">
                  {t("admin.venueCms.editor.noStaff")}
                </p>
              ) : (
                <>
                  <TableRowCards
                    rows={staffTable.getRowModel().rows}
                    leadCellId="email"
                    actionCellIds={["rm"]}
                  />
                  <div className="hidden overflow-x-auto md:block">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50/90">
                        {staffTable.getHeaderGroups().map((headerGroup) => (
                          <tr
                            key={headerGroup.id}
                            className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                          >
                            {headerGroup.headers.map((header) => (
                              <th key={header.id} className="px-3 py-2.5 pr-3 text-left">
                                {flexRender(header.column.columnDef.header, header.getContext())}
                              </th>
                            ))}
                          </tr>
                        ))}
                      </thead>
                      <tbody>
                        {staffTable.getRowModel().rows.map((row) => (
                          <tr key={row.id} className="border-b border-slate-100">
                            {row.getVisibleCells().map((cell) => (
                              <td key={cell.id} className="px-3 py-2.5 align-top">
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
          </div>
        </div>
      </section>

      <ConfirmModal
        open={staffRemoveTarget !== null}
        onClose={() => setStaffRemoveTarget(null)}
        title={t("admin.venueCms.editor.removeStaffTitle")}
        variant="danger"
        description={
          staffRemoveTarget ? (
            <p>
              {t("admin.venueCms.editor.removeStaffBody", {
                email: staffRemoveTarget.player.email,
                role: staffRemoveTarget.role,
              })}
            </p>
          ) : null
        }
        confirmLabel={t("admin.venueCms.common.remove")}
        onConfirm={async () => {
          if (!staffRemoveTarget || !venueId) return;
          setPageErr(null);
          try {
            await staffRemoveMut.mutateAsync(staffRemoveTarget.playerId);
          } catch (error) {
            setPageErr((error as Error).message);
            throw error;
          }
        }}
      />

      <ConfirmModal
        open={addStaffConfirmOpen}
        onClose={() => setAddStaffConfirmOpen(false)}
        title={t("admin.venueCms.editor.inviteConfirmTitle")}
        description={
          <p>
            {t("admin.venueCms.editor.inviteConfirmBody", {
              email: staffEmail.trim(),
              role: staffRole,
            })}
          </p>
        }
        confirmLabel={t("admin.venueCms.common.addUpdate")}
        onConfirm={runAddStaff}
      />
    </>
  );
}

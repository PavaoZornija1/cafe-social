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
import { useTranslation } from "react-i18next";
import { TableRowCards } from "@/components/TableRowCards";
import {
  type OwnerStaffInviteRow,
  useOwnerCancelStaffInviteMutation,
  useOwnerCreateStaffInviteMutation,
  useOwnerVenueStaffInvitesQuery,
} from "@/lib/queries";
import { useOwnerVenueDashboard } from "../OwnerVenueDashboardContext";

const inviteCol = createColumnHelper<OwnerStaffInviteRow>();

export function VenueTeamSection() {
  const { t } = useTranslation();
  const {
    venueId,
    getToken,
    isLoaded,
    metaRow,
    role,
    isOwner,
    readOnlyDisabled,
    setBannerError,
  } = useOwnerVenueDashboard();

  const [lastCreatedToken, setLastCreatedToken] = useState<string | null>(null);
  const [clerkInviteNotice, setClerkInviteNotice] = useState<string | null>(null);

  const invitesQ = useOwnerVenueStaffInvitesQuery(
    venueId,
    getToken,
    Boolean(isLoaded && metaRow && isOwner),
  );
  const createInviteMut = useOwnerCreateStaffInviteMutation(venueId, getToken);
  const cancelInviteMut = useOwnerCancelStaffInviteMutation(venueId, getToken);
  const inviteForm = useForm({
    defaultValues: {
      email: "",
      role: "EMPLOYEE" as "EMPLOYEE" | "MANAGER",
    },
    onSubmit: async ({ value, formApi }) => {
      setBannerError(null);
      setLastCreatedToken(null);
      setClerkInviteNotice(null);
      const data = (await createInviteMut.mutateAsync({
        email: value.email.trim(),
        role: value.role,
      })) ?? {};
      if (data.token) setLastCreatedToken(data.token);
      if (data.clerkInvitationSent) {
        setClerkInviteNotice(
          t("admin.partnerVenueDetail.staffInvites.clerkSentNotice"),
        );
      } else if (data.clerkInvitationError) {
        setClerkInviteNotice(
          t("admin.partnerVenueDetail.staffInvites.clerkErrorNotice", {
            error: data.clerkInvitationError.slice(0, 120),
          }),
        );
      } else {
        setClerkInviteNotice(
          t("admin.partnerVenueDetail.staffInvites.clerkMissingConfigNotice"),
        );
      }
      formApi.reset();
    },
  });

  const invites = invitesQ.data ?? [];

  const inviteColumns = useMemo(
    () => [
      inviteCol.display({
        id: "who",
        header: t("admin.partnerVenueDetail.staffInvites.invite"),
        cell: ({ row }) => (
          <div>
            <span className="text-slate-800">{row.original.email}</span>
            <span className="text-xs font-mono text-brand ml-2">
              {t(`admin.partnerVenueDetail.roles.${row.original.role}`)}
            </span>
            <p className="text-xs text-slate-500 mt-1">
              {t("admin.partnerVenueDetail.staffInvites.expiresBy", {
                status: row.original.status,
                date: new Date(row.original.expiresAt).toISOString().slice(0, 10),
                inviter: row.original.invitedBy.email,
              })}
            </p>
          </div>
        ),
      }),
      inviteCol.display({
        id: "cancel",
        header: "",
        cell: ({ row }) =>
          row.original.status === "PENDING" ? (
            <button
              type="button"
              disabled={readOnlyDisabled || cancelInviteMut.isPending}
              onClick={() => void cancelInviteMut.mutateAsync(row.original.id)}
              className="text-xs text-red-600 hover:underline disabled:opacity-50"
            >
              {t("admin.partnerVenueDetail.staffInvites.cancelInvite")}
            </button>
          ) : null,
      }),
    ],
    [readOnlyDisabled, cancelInviteMut, t],
  );

  const inviteTable = useReactTable({
    data: invites,
    columns: inviteColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (r) => r.id,
  });

  if (!metaRow) return null;

  return (
    <section className="border border-slate-200 rounded-xl p-4 space-y-4 scroll-mt-24">
                <h2 className="text-lg font-medium">{t("admin.partnerVenueDetail.staffInvites.title")}</h2>
                <p className="text-xs text-slate-500">
                  {t("admin.partnerVenueDetail.staffInvites.leadBeforeSecret")}{" "}
                  <code className="text-slate-600">CLERK_SECRET_KEY</code> +{" "}
                  <code className="text-slate-600">ADMIN_PORTAL_ORIGIN</code>
                  {t("admin.partnerVenueDetail.staffInvites.leadBeforeAcceptInvite")}{" "}
                  <Link href="/owner/accept-invite" className="text-brand hover:underline">
                    {t("admin.partnerVenueDetail.staffInvites.acceptInvite")}
                  </Link>
                  {t("admin.partnerVenueDetail.staffInvites.leadAfterAcceptInvite")}
                </p>
                {clerkInviteNotice ? (
                  <p className="text-xs text-amber-900 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
                    {clerkInviteNotice}
                  </p>
                ) : null}
                {lastCreatedToken && typeof window !== "undefined" ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs">
                    <p className="text-emerald-800 font-medium mb-1">
                      {t("admin.partnerVenueDetail.staffInvites.inviteLinkTitle")}
                    </p>
                    <code className="text-slate-800 break-all block select-all">
                      {`${window.location.origin}/owner/accept-invite?token=${lastCreatedToken}`}
                    </code>
                  </div>
                ) : null}
                <form
                  className="flex flex-wrap gap-2 items-end"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void inviteForm.handleSubmit();
                  }}
                >
                  <inviteForm.Field name="email">
                    {(field) => (
                      <label className="block text-sm text-slate-600 flex-1 min-w-[200px]">
                        {t("admin.partnerVenueDetail.staffInvites.email")}
                        <input
                          type="email"
                          disabled={readOnlyDisabled}
                          className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm disabled:opacity-60"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                          placeholder={t("admin.partnerVenueDetail.staffInvites.emailPlaceholder")}
                        />
                      </label>
                    )}
                  </inviteForm.Field>
                  <inviteForm.Field name="role">
                    {(field) => (
                      <label className="block text-sm text-slate-600">
                        {t("admin.partnerVenueDetail.staffInvites.role")}
                        <select
                          disabled={readOnlyDisabled}
                          className="mt-1 block w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm disabled:opacity-60"
                          value={field.state.value}
                          onChange={(e) =>
                            field.handleChange(e.target.value as "EMPLOYEE" | "MANAGER")
                          }
                          onBlur={field.handleBlur}
                        >
                          <option value="EMPLOYEE">
                            {t("admin.partnerVenueDetail.roles.EMPLOYEE")}
                          </option>
                          {role === "OWNER" ? (
                            <option value="MANAGER">{t("admin.partnerVenueDetail.roles.MANAGER")}</option>
                          ) : null}
                        </select>
                      </label>
                    )}
                  </inviteForm.Field>
                  <inviteForm.Subscribe selector={(s) => s.values.email}>
                    {(email) => (
                      <button
                        type="submit"
                        disabled={
                          readOnlyDisabled || createInviteMut.isPending || !email.trim()
                        }
                        className="bg-slate-200 hover:bg-slate-300 disabled:opacity-50 rounded-lg px-4 py-2 text-sm h-[38px]"
                      >
                        {t("admin.partnerVenueDetail.staffInvites.sendInvite")}
                      </button>
                    )}
                  </inviteForm.Subscribe>
                </form>
                <div className="border border-slate-200 rounded-lg overflow-hidden text-sm">
                  {invites.length === 0 ? (
                    <p className="p-3 text-slate-500">
                      {t("admin.partnerVenueDetail.staffInvites.noInviteHistory")}
                    </p>
                  ) : (
                    <>
                      <TableRowCards
                        rows={inviteTable.getRowModel().rows}
                        leadCellId="who"
                        actionCellIds={["cancel"]}
                      />
                      <div className="hidden md:block">
                        <table className="w-full">
                          <tbody>
                            {inviteTable.getRowModel().rows.map((row) => (
                              <tr
                                key={row.id}
                                className="border-b border-slate-200 last:border-0 bg-brand-light/60"
                              >
                                {row.getVisibleCells().map((cell) => (
                                  <td key={cell.id} className="p-3">
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
              </section>
  );
}

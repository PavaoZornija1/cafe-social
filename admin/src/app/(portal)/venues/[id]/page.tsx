"use client";

import { useAuth } from "@clerk/nextjs";
import { useForm } from "@tanstack/react-form";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  type AdminVenueDetail,
  type AdminVenueStaffRow,
  useAdminOrganizationsQuery,
  useAdminVenueDetailQuery,
  useAdminVenuePatchMutation,
  useAdminVenueStaffQuery,
  useAdminVenueStaffRemoveMutation,
  useAdminVenueStaffUpsertMutation,
} from "@/lib/queries";

type OrgOption = { id: string; name: string };

type VenueEditForm = {
  menuUrl: string;
  orderingUrl: string;
  orderNudgeTitle: string;
  orderNudgeBody: string;
  featuredOfferTitle: string;
  featuredOfferBody: string;
  featuredOfferEndsAt: string;
  analyticsTimeZone: string;
  organizationId: string;
  locked: boolean;
  lockReason: string;
};

const staffColHelper = createColumnHelper<AdminVenueStaffRow>();

function venueToForm(v: AdminVenueDetail): VenueEditForm {
  return {
    menuUrl: v.menuUrl ?? "",
    orderingUrl: v.orderingUrl ?? "",
    orderNudgeTitle: v.orderNudgeTitle ?? "",
    orderNudgeBody: v.orderNudgeBody ?? "",
    featuredOfferTitle: v.featuredOfferTitle ?? "",
    featuredOfferBody: v.featuredOfferBody ?? "",
    featuredOfferEndsAt: v.featuredOfferEndsAt ?? "",
    analyticsTimeZone: v.analyticsTimeZone ?? "",
    organizationId: v.organizationId ?? "",
    locked: v.locked ?? false,
    lockReason: v.lockReason ?? "",
  };
}

export default function EditVenuePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isLoaded, getToken } = useAuth();
  const [pageErr, setPageErr] = useState<string | null>(null);
  const [staffEmail, setStaffEmail] = useState("");
  const [staffRole, setStaffRole] = useState<AdminVenueStaffRow["role"]>("EMPLOYEE");
  const seededVenueId = useRef<string | null>(null);

  const venueQ = useAdminVenueDetailQuery(id, getToken, Boolean(isLoaded && id));
  const orgsQ = useAdminOrganizationsQuery(getToken, isLoaded);
  const staffQ = useAdminVenueStaffQuery(id, getToken, Boolean(isLoaded && id));
  const patchMut = useAdminVenuePatchMutation(id, getToken);
  const staffAddMut = useAdminVenueStaffUpsertMutation(id, getToken);
  const staffRemoveMut = useAdminVenueStaffRemoveMutation(id, getToken);

  const orgs: OrgOption[] = useMemo(
    () => (orgsQ.data ?? []).map((o) => ({ id: o.id, name: o.name })),
    [orgsQ.data],
  );

  const venueForm = useForm({
    defaultValues: {
      menuUrl: "",
      orderingUrl: "",
      orderNudgeTitle: "",
      orderNudgeBody: "",
      featuredOfferTitle: "",
      featuredOfferBody: "",
      featuredOfferEndsAt: "",
      analyticsTimeZone: "",
      organizationId: "",
      locked: false,
      lockReason: "",
    } as VenueEditForm,
    onSubmit: async ({ value }) => {
      setPageErr(null);
      try {
        await patchMut.mutateAsync({
          menuUrl: value.menuUrl || null,
          orderingUrl: value.orderingUrl || null,
          orderNudgeTitle: value.orderNudgeTitle || null,
          orderNudgeBody: value.orderNudgeBody || null,
          featuredOfferTitle: value.featuredOfferTitle || null,
          featuredOfferBody: value.featuredOfferBody || null,
          featuredOfferEndsAt: value.featuredOfferEndsAt || null,
          analyticsTimeZone: value.analyticsTimeZone?.trim() || null,
          organizationId: value.organizationId || null,
          locked: value.locked,
          lockReason: value.lockReason?.trim() || null,
        });
        router.push("/venues");
      } catch (e) {
        setPageErr((e as Error).message);
      }
    },
  });

  useEffect(() => {
    if (!venueQ.data) return;
    const merged = {
      ...venueQ.data,
      organizationId: venueQ.data.organizationId ?? null,
      locked: venueQ.data.locked ?? false,
      lockReason: venueQ.data.lockReason ?? null,
    } as AdminVenueDetail;
    if (seededVenueId.current !== merged.id) {
      seededVenueId.current = merged.id;
      venueForm.reset(venueToForm(merged));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once per venue id; form API stable
  }, [venueQ.data]);

  const staffRows = staffQ.data ?? [];

  const staffColumns = useMemo(
    () => [
      staffColHelper.accessor((r) => r.player.email, {
        id: "email",
        header: "Email",
        cell: (c) => <span className="text-slate-800">{c.getValue()}</span>,
      }),
      staffColHelper.accessor("role", {
        header: "Role",
        cell: (c) => (
          <span className="text-xs font-mono text-brand">{c.getValue()}</span>
        ),
      }),
      staffColHelper.display({
        id: "rm",
        header: "",
        cell: ({ row }) => (
          <button
            type="button"
            disabled={staffRemoveMut.isPending || staffAddMut.isPending}
            onClick={() => void staffRemoveMut.mutateAsync(row.original.playerId)}
            className="text-red-600 hover:text-red-800 text-xs"
          >
            Remove
          </button>
        ),
      }),
    ],
    [staffAddMut.isPending, staffRemoveMut.isPending],
  );

  const staffTable = useReactTable({
    data: staffRows,
    columns: staffColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (r) => r.id,
  });

  const loadErr =
    venueQ.isError && venueQ.error instanceof Error ? venueQ.error.message : pageErr;

  if (loadErr && !venueQ.data) {
    return (
      <div className="bg-slate-50 text-red-700 p-8">
        {loadErr}{" "}
        <Link href="/venues" className="text-brand">
          Back
        </Link>
      </div>
    );
  }
  if (!venueQ.data) {
    return (
      <div className="bg-slate-50 text-slate-900 p-8">Loading…</div>
    );
  }

  const v = venueQ.data;

  const addStaff = async () => {
    if (!id || !staffEmail.trim()) return;
    setPageErr(null);
    try {
      await staffAddMut.mutateAsync({
        email: staffEmail.trim(),
        role: staffRole,
      });
      setStaffEmail("");
    } catch (e) {
      setPageErr((e as Error).message);
    }
  };

  return (
    <form
      className="bg-slate-50 text-slate-900 p-8 max-w-2xl"
      onSubmit={(e) => {
        e.preventDefault();
        void venueForm.handleSubmit();
      }}
    >
      <Link href="/venues" className="text-brand text-sm">
        ← Venues
      </Link>
      <h1 className="text-xl font-bold mt-4 mb-1">{v.name}</h1>
      <p className="text-xs text-slate-500 font-mono mb-6">{v.id}</p>

      <venueForm.Field name="organizationId">
        {(field) => (
          <label className="block mb-3">
            <span className="text-sm text-slate-600">Franchise / organization</span>
            <select
              className="mt-1 w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
            >
              <option value="">— None —</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">
              Manage orgs under{" "}
              <Link href="/organizations" className="text-brand hover:underline">
                Organizations
              </Link>
              .
            </p>
          </label>
        )}
      </venueForm.Field>

      <venueForm.Field name="locked">
        {(field) => (
          <label className="flex items-center gap-2 mb-3">
            <input
              type="checkbox"
              checked={field.state.value}
              onChange={(e) => {
                const next = e.target.checked;
                if (next && !field.state.value) {
                  if (
                    !window.confirm(
                      "Lock this venue? Save to apply — players lose access until unlocked.",
                    )
                  ) {
                    return;
                  }
                }
                field.handleChange(next);
              }}
            />
            <span className="text-sm text-slate-800">Locked (suspend play & map)</span>
          </label>
        )}
      </venueForm.Field>

      <venueForm.Field name="lockReason">
        {(field) => (
          <label className="block mb-3">
            <span className="text-sm text-slate-600">Lock reason (optional)</span>
            <input
              className="mt-1 w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
            />
          </label>
        )}
      </venueForm.Field>

      <venueForm.Field name="menuUrl">
        {(field) => (
          <label className="block mb-3">
            <span className="text-sm text-slate-600">Menu URL</span>
            <input
              className="mt-1 w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
            />
          </label>
        )}
      </venueForm.Field>

      <venueForm.Field name="orderingUrl">
        {(field) => (
          <label className="block mb-3">
            <span className="text-sm text-slate-600">Ordering URL</span>
            <input
              className="mt-1 w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
            />
          </label>
        )}
      </venueForm.Field>

      <venueForm.Field name="orderNudgeTitle">
        {(field) => (
          <label className="block mb-3">
            <span className="text-sm text-slate-600">
              {"Order nudge title ({{venueName}} ok)"}
            </span>
            <input
              className="mt-1 w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
            />
          </label>
        )}
      </venueForm.Field>

      <venueForm.Field name="orderNudgeBody">
        {(field) => (
          <label className="block mb-3">
            <span className="text-sm text-slate-600">Order nudge body</span>
            <textarea
              className="mt-1 w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm min-h-[72px]"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
            />
          </label>
        )}
      </venueForm.Field>

      <venueForm.Field name="featuredOfferTitle">
        {(field) => (
          <label className="block mb-3">
            <span className="text-sm text-slate-600">Featured offer title</span>
            <input
              className="mt-1 w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
            />
          </label>
        )}
      </venueForm.Field>

      <venueForm.Field name="featuredOfferBody">
        {(field) => (
          <label className="block mb-3">
            <span className="text-sm text-slate-600">Featured offer body</span>
            <textarea
              className="mt-1 w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm min-h-[72px]"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
            />
          </label>
        )}
      </venueForm.Field>

      <venueForm.Field name="featuredOfferEndsAt">
        {(field) => (
          <label className="block mb-3">
            <span className="text-sm text-slate-600">Featured offer ends at (ISO, optional)</span>
            <input
              className="mt-1 w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
            />
          </label>
        )}
      </venueForm.Field>

      <venueForm.Field name="analyticsTimeZone">
        {(field) => (
          <label className="block mb-3">
            <span className="text-sm text-slate-600">
              Analytics timezone (IANA, optional — hour-of-day charts for owners)
            </span>
            <input
              className="mt-1 w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              placeholder="e.g. Europe/Zagreb"
            />
          </label>
        )}
      </venueForm.Field>

      <div className="border border-slate-300 rounded-lg p-4 mb-4 space-y-3">
        <p className="text-sm text-slate-800 font-semibold">
          Owner / manager / employee (Clerk)
        </p>
        <p className="text-xs text-slate-500">
          Invite people with their real sign-in email. They use this partner portal with the same
          Clerk project: employees see verification lists; managers and owners see analytics and
          campaigns.
        </p>
        <div className="flex flex-wrap gap-2 items-end">
          <label className="block text-sm text-slate-600 flex-1 min-w-[200px]">
            Email
            <input
              type="email"
              className="mt-1 w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm"
              value={staffEmail}
              onChange={(e) => setStaffEmail(e.target.value)}
              placeholder="owner@venue.com"
            />
          </label>
          <label className="block text-sm text-slate-600">
            Role
            <select
              className="mt-1 block w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm"
              value={staffRole}
              onChange={(e) => setStaffRole(e.target.value as AdminVenueStaffRow["role"])}
            >
              <option value="EMPLOYEE">EMPLOYEE</option>
              <option value="MANAGER">MANAGER</option>
              <option value="OWNER">OWNER</option>
            </select>
          </label>
          <button
            type="button"
            disabled={staffAddMut.isPending}
            onClick={() => void addStaff()}
            className="bg-slate-200 hover:bg-slate-300 disabled:opacity-50 rounded-lg px-4 py-2 text-sm h-[38px]"
          >
            Add / update
          </button>
        </div>
        <div className="rounded border border-slate-200 overflow-x-auto bg-white">
          {staffRows.length === 0 ? (
            <p className="text-sm text-slate-500 p-3">No staff yet.</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                {staffTable.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} className="border-b border-slate-200 bg-slate-50">
                    {hg.headers.map((h) => (
                      <th
                        key={h.id}
                        className="text-left px-3 py-2 text-xs uppercase text-slate-500"
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {staffTable.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 bg-slate-50">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-2">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {pageErr ? <p className="text-red-600 text-sm mb-2">{pageErr}</p> : null}
      <button
        type="submit"
        disabled={patchMut.isPending}
        className="mt-4 w-full bg-brand hover:bg-brand-hover disabled:opacity-50 rounded-lg py-2 font-semibold"
      >
        {patchMut.isPending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

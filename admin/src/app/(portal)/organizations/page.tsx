"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useForm } from "@tanstack/react-form";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useAdminOrganizationsQuery,
  useCreateOrganizationMutation,
  usePortalMeQuery,
} from "@/lib/queries";

type OrgRow = {
  id: string;
  name: string;
  slug: string | null;
  locationKind: string;
  trialEndsAt: string | null;
  platformBillingPlan: string | null;
  platformBillingStatus: string;
  platformBillingRenewsAt: string | null;
  billingPortalUrl: string | null;
  _count?: { venues: number };
};

const colHelper = createColumnHelper<OrgRow>();

function formatShortDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      dateStyle: "medium",
    });
  } catch {
    return iso;
  }
}

export default function OrganizationsPage() {
  const { t } = useTranslation();
  const { isLoaded, getToken } = useAuth();
  const [formErr, setFormErr] = useState<string | null>(null);

  const meQ = usePortalMeQuery(getToken, isLoaded);
  const portalGate =
    meQ.isPending && !meQ.data
      ? "loading"
      : meQ.data?.platformRole === "SUPER_ADMIN"
        ? "super_admin"
        : "partner";

  const orgsQ = useAdminOrganizationsQuery(getToken, portalGate === "super_admin");
  const createMut = useCreateOrganizationMutation(getToken);

  const createOrgForm = useForm({
    defaultValues: { name: "" },
    onSubmit: async ({ value }) => {
      const trimmed = value.name.trim();
      if (!trimmed) return;
      setFormErr(null);
      try {
        await createMut.mutateAsync(trimmed);
        createOrgForm.reset();
      } catch (e) {
        setFormErr((e as Error).message);
      }
    },
  });

  const rows = orgsQ.data ?? null;
  const listErr =
    orgsQ.isError && orgsQ.error instanceof Error ? orgsQ.error.message : null;

  const columns = useMemo(
    () => [
      colHelper.accessor("name", {
        header: t("admin.organizations.colOrg"),
        cell: (info) => (
          <div>
            <p className="font-medium text-slate-900">{info.getValue()}</p>
            <p className="text-[11px] font-mono text-slate-500 mt-0.5">{info.row.original.id}</p>
          </div>
        ),
      }),
      colHelper.accessor("locationKind", {
        header: t("admin.organizations.colScope"),
        cell: (info) => (
          <span className="text-xs text-slate-700">{info.getValue().replace(/_/g, " ")}</span>
        ),
      }),
      colHelper.display({
        id: "venues",
        header: t("admin.organizations.colVenues"),
        cell: ({ row }) => (
          <span className="tabular-nums text-slate-800">{row.original._count?.venues ?? 0}</span>
        ),
      }),
      colHelper.accessor("platformBillingStatus", {
        header: t("admin.organizations.colBilling"),
        cell: (info) => {
          const r = info.row.original;
          return (
            <div className="text-xs">
              <span className="font-medium text-slate-800">{info.getValue()}</span>
              {r.platformBillingPlan ? (
                <span className="text-slate-600"> · {r.platformBillingPlan}</span>
              ) : null}
            </div>
          );
        },
      }),
      colHelper.accessor("trialEndsAt", {
        header: t("admin.organizations.colTrial"),
        cell: (info) => (
          <span className="text-xs text-slate-700">{formatShortDate(info.getValue())}</span>
        ),
      }),
      colHelper.display({
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Link
            href={`/organizations/${row.original.id}`}
            className="text-sm text-brand font-medium hover:underline whitespace-nowrap"
          >
            {t("admin.organizations.open")}
          </Link>
        ),
      }),
    ],
    [t],
  );

  const table = useReactTable({
    data: rows ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: { sorting: [{ id: "name", desc: false }] },
  });

  if (!isLoaded) {
    return (
      <div className="bg-slate-50 text-slate-600 p-8">
        <p>{t("admin.organizations.loading")}</p>
      </div>
    );
  }

  if (portalGate === "loading") {
    return (
      <div className="bg-slate-50 text-slate-600 p-8">
        <p>{t("admin.organizations.loading")}</p>
      </div>
    );
  }

  if (portalGate !== "super_admin") {
    return (
      <div className="bg-slate-50 text-slate-900 p-8 max-w-lg">
        <h1 className="text-xl font-semibold">{t("admin.organizations.gateTitle")}</h1>
        <p className="text-sm text-slate-600 mt-3">{t("admin.organizations.gateBody")}</p>
        <Link
          href="/owner/venues"
          className="inline-block mt-6 text-sm text-brand font-medium hover:underline"
        >
          {t("admin.organizations.gateBack")}
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 text-slate-900 p-6 md:p-8 min-h-full">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap justify-between gap-4 mb-6">
          <div>
            <Link href="/platform" className="text-brand text-sm hover:underline">
              {t("admin.organizations.backPlatform")}
            </Link>
            <h1 className="text-xl font-bold mt-2">{t("admin.organizations.title")}</h1>
            <p className="text-sm text-slate-500 mt-1 max-w-xl">{t("admin.organizations.subtitle")}</p>
          </div>
        </div>

        {(listErr || formErr) && (
          <div className="mb-4 text-sm text-red-800 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
            {listErr ?? formErr}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void createOrgForm.handleSubmit();
          }}
          className="border border-slate-200 rounded-xl p-4 mb-8 flex flex-wrap gap-2 items-end bg-white shadow-sm"
        >
          <createOrgForm.Field name="name">
            {(field) => (
              <label className="block flex-1 min-w-[200px] text-sm text-slate-600">
                {t("admin.organizations.createLabel")}
                <input
                  className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder={t("admin.organizations.createPlaceholder")}
                  autoComplete="off"
                />
              </label>
            )}
          </createOrgForm.Field>
          <button
            type="submit"
            disabled={createMut.isPending}
            className="bg-brand hover:bg-brand-hover disabled:opacity-50 rounded-lg px-4 py-2 text-sm font-medium h-[38px] text-brand-foreground"
          >
            {t("admin.organizations.createButton")}
          </button>
        </form>

        {orgsQ.isPending && !rows ? (
          <p className="text-slate-500">{t("admin.organizations.loading")}</p>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} className="border-b border-slate-200 bg-slate-50/90">
                    {hg.headers.map((h) => (
                      <th
                        key={h.id}
                        className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500"
                      >
                        {h.isPlaceholder
                          ? null
                          : flexRender(h.column.columnDef.header, h.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-slate-100 hover:bg-brand-light/40 transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 align-top">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {(rows?.length ?? 0) === 0 && !orgsQ.isPending ? (
              <p className="px-4 py-8 text-center text-slate-500 text-sm">
                {t("admin.organizations.empty")}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

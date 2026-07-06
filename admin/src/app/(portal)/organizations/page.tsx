"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useForm } from "@tanstack/react-form";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmModal } from "@/components/ConfirmModal";
import { TableRowCards } from "@/components/TableRowCards";
import {
  type AdminOrganizationsListParams,
  useAdminOrganizationsListQuery,
  useCreateOrganizationMutation,
  usePortalMeQuery,
} from "@/lib/queries";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import {
  PortalAlert,
  PortalCard,
  PortalPageHeader,
  PortalPageLayout,
  PortalSkeleton,
  portalButtonPrimaryClass,
  portalButtonSecondaryClass,
  portalInputClass,
  portalLabelClass,
  portalSelectClass,
} from "@/components/portal/PortalPageUi";

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

const PAGE_SIZE = 25;

const fieldCol = "flex min-w-0 flex-col gap-1.5";
const fieldInp = `${portalInputClass} h-[42px] box-border py-0 leading-none`;
const fieldSelect = `${portalSelectClass} h-[42px] box-border py-0 pr-9 leading-none w-full min-w-0`;

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
  const [createConfirmOpen, setCreateConfirmOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [locationKind, setLocationKind] = useState<
    "" | "SINGLE_LOCATION" | "MULTI_LOCATION"
  >("");
  const [billingInput, setBillingInput] = useState("");

  const debouncedSearch = useDebouncedValue(searchInput, 350);
  const debouncedBilling = useDebouncedValue(billingInput, 350);

  const meQ = usePortalMeQuery(getToken, isLoaded);
  const portalGate =
    meQ.isPending && !meQ.data
      ? "loading"
      : meQ.data?.platformRole === "SUPER_ADMIN"
        ? "super_admin"
        : "partner";

  const listParams = useMemo((): AdminOrganizationsListParams => {
    return {
      page,
      limit: PAGE_SIZE,
      search: debouncedSearch.trim() || undefined,
      locationKind: locationKind || "",
      billingStatus: debouncedBilling.trim() || undefined,
    };
  }, [page, debouncedSearch, locationKind, debouncedBilling]);

  const orgsQ = useAdminOrganizationsListQuery(
    getToken,
    portalGate === "super_admin",
    listParams,
  );

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, locationKind, debouncedBilling]);

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
        throw e;
      }
    },
  });

  const rows = orgsQ.data?.items ?? [];
  const total = orgsQ.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasActiveFilters = Boolean(
    debouncedSearch.trim() || locationKind || debouncedBilling.trim(),
  );
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
        cell: (info) => {
          const raw = info.getValue();
          const label =
            raw === "MULTI_LOCATION"
              ? t("admin.organizations.locationKindMulti")
              : t("admin.organizations.locationKindSingle");
          return <span className="text-xs text-slate-700">{label}</span>;
        },
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
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const showInitialLoading = orgsQ.isLoading && !orgsQ.data;

  if (!isLoaded) {
    return (
      <PortalPageLayout>
        <PortalSkeleton />
      </PortalPageLayout>
    );
  }

  if (portalGate === "loading") {
    return (
      <PortalPageLayout>
        <PortalSkeleton />
      </PortalPageLayout>
    );
  }

  if (portalGate !== "super_admin") {
    return (
      <PortalPageLayout maxWidth="lg">
        <PortalCard>
          <h1 className="text-xl font-semibold text-slate-900">{t("admin.organizations.gateTitle")}</h1>
          <p className="mt-3 text-sm text-slate-600">{t("admin.organizations.gateBody")}</p>
          <Link
            href="/owner/venues"
            className="mt-6 inline-block text-sm font-medium text-brand hover:text-brand-hover"
          >
            {t("admin.organizations.gateBack")}
          </Link>
        </PortalCard>
      </PortalPageLayout>
    );
  }

  return (
    <PortalPageLayout>
      <PortalPageHeader
        backHref="/platform"
        backLabel={t("admin.organizations.backPlatform")}
        title={t("admin.organizations.title")}
        lead={t("admin.organizations.subtitle")}
        meta={
          <p className="text-sm text-slate-500">
            {showInitialLoading
              ? t("admin.organizations.loading")
              : t("admin.organizations.pageRange", {
                  from: total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1,
                  to: Math.min(page * PAGE_SIZE, total),
                  total,
                })}
          </p>
        }
      />

      {(listErr || formErr) ? (
        <PortalAlert tone="error" className="mb-5">
          {listErr ?? formErr}
        </PortalAlert>
      ) : null}

      <PortalCard className="mb-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!createOrgForm.state.values.name.trim()) return;
            setCreateConfirmOpen(true);
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <createOrgForm.Field name="name">
            {(field) => (
              <label className="block min-w-[200px] flex-1">
                <span className={portalLabelClass}>{t("admin.organizations.createLabel")}</span>
                <input
                  className={`${portalInputClass} mt-1.5`}
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
            className={portalButtonPrimaryClass}
          >
            {t("admin.organizations.createButton")}
          </button>
        </form>
      </PortalCard>

      <ConfirmModal
        open={createConfirmOpen}
        onClose={() => setCreateConfirmOpen(false)}
        title={t("admin.organizations.createConfirmTitle")}
        description={
          <p>
            {t("admin.organizations.createConfirmBody")}{" "}
            <span className="font-semibold text-slate-900">
              {createOrgForm.state.values.name.trim() || "—"}
            </span>
            ?
          </p>
        }
        confirmLabel={t("admin.organizations.createButton")}
        onConfirm={() => createOrgForm.handleSubmit()}
      />

      {showInitialLoading ? (
        <PortalSkeleton rows={2} />
      ) : (
        <>
          <PortalCard className="mb-6 border-slate-200/70 bg-gradient-to-br from-white via-white to-brand-lighter/20">
            <div className="space-y-5">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  {t("admin.organizations.filtersTitle")}
                </h2>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">
                  {t("admin.organizations.filtersHint")}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
                <label className={fieldCol}>
                  <span className={portalLabelClass}>{t("admin.organizations.filterSearchName")}</span>
                  <input
                    className={fieldInp}
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder={t("admin.organizations.filterSearchPlaceholder")}
                    autoComplete="off"
                  />
                </label>
                <label className={fieldCol}>
                  <span className={portalLabelClass}>{t("admin.organizations.filterScope")}</span>
                  <select
                    className={fieldSelect}
                    value={locationKind}
                    onChange={(e) =>
                      setLocationKind(
                        e.target.value as "" | "SINGLE_LOCATION" | "MULTI_LOCATION",
                      )
                    }
                  >
                    <option value="">{t("admin.organizations.filterScopeAny")}</option>
                    <option value="SINGLE_LOCATION">
                      {t("admin.organizations.filterScopeSingle")}
                    </option>
                    <option value="MULTI_LOCATION">
                      {t("admin.organizations.filterScopeMulti")}
                    </option>
                  </select>
                </label>
                <label className={`${fieldCol} sm:col-span-2 lg:col-span-1`}>
                  <span className={portalLabelClass}>{t("admin.organizations.filterBilling")}</span>
                  <input
                    className={fieldInp}
                    value={billingInput}
                    onChange={(e) => setBillingInput(e.target.value)}
                    placeholder={t("admin.organizations.filterBillingPlaceholder")}
                    autoComplete="off"
                  />
                </label>
              </div>
            </div>
          </PortalCard>
          <TableRowCards
            rows={table.getRowModel().rows}
            leadCellId="name"
            actionCellIds={["actions"]}
            showBodyLabels
          />
          {total === 0 && !orgsQ.isFetching ? (
            <p className="md:hidden rounded-2xl border border-slate-200/80 bg-white px-4 py-8 text-center text-sm text-slate-500 shadow-portal-card">
              {hasActiveFilters ? t("admin.organizations.noMatch") : t("admin.organizations.empty")}
            </p>
          ) : null}
          <div className="relative hidden overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-portal-card md:block">
            {orgsQ.isFetching && orgsQ.data ? (
              <div className="absolute right-3 top-2 z-10 text-xs text-slate-500">
                {t("admin.organizations.loading")}
              </div>
            ) : null}
            <table className="min-w-full text-sm">
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} className="border-b border-slate-200 bg-brand-lighter/40">
                    {hg.headers.map((h) => (
                      <th
                        key={h.id}
                        className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500"
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
                    className="border-b border-slate-100 transition-colors last:border-0 hover:bg-brand-lighter/30"
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
            {total === 0 && !orgsQ.isFetching ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">
                {hasActiveFilters ? t("admin.organizations.noMatch") : t("admin.organizations.empty")}
              </p>
            ) : null}
          </div>
          {total > 0 ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-600">
                {t("admin.organizations.pageStatus", {
                  page,
                  pages: totalPages,
                  total,
                })}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className={portalButtonSecondaryClass}
                >
                  {t("admin.organizations.pagePrev")}
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className={portalButtonSecondaryClass}
                >
                  {t("admin.organizations.pageNext")}
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </PortalPageLayout>
  );
}

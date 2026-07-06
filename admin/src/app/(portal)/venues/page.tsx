"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type AdminVenueListRow,
  type AdminVenuesListParams,
  type AdminOrganizationsListParams,
  useAdminOrganizationsListQuery,
  useAdminVenuesListQuery,
  usePortalMeQuery,
} from "@/lib/queries";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { getCountrySelectOptions } from "@/lib/geo/countryOptions";
import {
  FilterableSelect,
  type FilterableOption,
} from "@/components/ui/FilterableSelect";
import { TableRowCards } from "@/components/TableRowCards";
import {
  PortalAlert,
  PortalCard,
  PortalPageHeader,
  PortalPageLayout,
  PortalSkeleton,
  portalButtonSecondaryClass,
  portalInputClass,
  portalLabelClass,
} from "@/components/portal/PortalPageUi";

const colHelper = createColumnHelper<AdminVenueListRow>();

const PAGE_SIZE = 25;

export default function VenuesPage() {
  const { t } = useTranslation();
  const { isLoaded, getToken } = useAuth();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [cityQ, setCityQ] = useState("");
  const [lockedOnly, setLockedOnly] = useState(false);
  const [orgFilter, setOrgFilter] = useState<string>("");
  const [countryIsoFilters, setCountryIsoFilters] = useState<string[]>([]);

  const debouncedSearch = useDebouncedValue(q, 350);
  const debouncedLocation = useDebouncedValue(cityQ, 350);

  const meQ = usePortalMeQuery(getToken, isLoaded);
  const isSuperAdmin = meQ.data?.platformRole === "SUPER_ADMIN";

  const orgsFilterParams = useMemo(
    (): AdminOrganizationsListParams => ({
      page: 1,
      limit: 500,
      search: undefined,
      locationKind: "",
      billingStatus: "",
    }),
    [],
  );

  const orgsForFilterQ = useAdminOrganizationsListQuery(
    getToken,
    isLoaded && isSuperAdmin,
    orgsFilterParams,
  );

  const venuesListParams = useMemo((): AdminVenuesListParams => {
    return {
      page,
      limit: PAGE_SIZE,
      search: debouncedSearch.trim() || undefined,
      location: debouncedLocation.trim() || undefined,
      lockedOnly,
      organizationId: orgFilter || undefined,
      countries: isSuperAdmin && countryIsoFilters.length ? countryIsoFilters : undefined,
    };
  }, [
    page,
    debouncedSearch,
    debouncedLocation,
    lockedOnly,
    orgFilter,
    countryIsoFilters,
    isSuperAdmin,
  ]);

  const venuesQ = useAdminVenuesListQuery(getToken, isLoaded, venuesListParams);

  const orgs = useMemo(
    () => (orgsForFilterQ.data?.items ?? []).map((o) => ({ id: o.id, name: o.name })),
    [orgsForFilterQ.data],
  );

  const orgNameById = useMemo(() => new Map(orgs.map((o) => [o.id, o.name])), [orgs]);

  const countryIsoKey = useMemo(() => countryIsoFilters.join(","), [countryIsoFilters]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, debouncedLocation, lockedOnly, orgFilter, countryIsoKey]);

  const countryOptions = useMemo(() => getCountrySelectOptions(), []);
  const orgSelectOptions = useMemo<FilterableOption[]>(
    () => [
      { value: "", label: t("admin.venues.filterOrgAny") },
      { value: "__none__", label: t("admin.venues.filterOrgNone") },
      ...orgs.map((o) => ({ value: o.id, label: o.name })),
    ],
    [orgs, t],
  );
  const selectedOrgOption = useMemo(
    () => orgSelectOptions.find((o) => o.value === orgFilter) ?? orgSelectOptions[0]!,
    [orgSelectOptions, orgFilter],
  );
  const selectedCountryOptions = useMemo(
    () =>
      countryIsoFilters
        .map((iso) => countryOptions.find((o) => o.value === iso))
        .filter((o): o is FilterableOption => Boolean(o)),
    [countryIsoFilters, countryOptions],
  );

  const items = venuesQ.data?.items ?? [];
  const total = venuesQ.data?.total ?? 0;
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const hasActiveFilters = Boolean(
    debouncedSearch.trim() ||
    debouncedLocation.trim() ||
    lockedOnly ||
    orgFilter ||
    (isSuperAdmin && countryIsoFilters.length > 0),
  );

  const listErr =
    (venuesQ.isError && venuesQ.error instanceof Error ? venuesQ.error.message : null) ??
    (orgsForFilterQ.isError && orgsForFilterQ.error instanceof Error
      ? orgsForFilterQ.error.message
      : null);

  const columns = useMemo(
    () => [
      colHelper.accessor("name", {
        header: t("admin.venues.colVenue"),
        cell: (info) => {
          const v = info.row.original;
          return (
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-slate-900">{info.getValue()}</p>
                {v.locked ? (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-red-800 border border-red-200 rounded px-1.5 py-0.5">
                    {t("admin.venues.lockedBadge")}
                  </span>
                ) : null}
              </div>
              <p className="text-[11px] font-mono text-slate-500 mt-0.5">{v.id}</p>
            </div>
          );
        },
      }),
      colHelper.display({
        id: "location",
        header: t("admin.venues.colLocation"),
        cell: ({ row }) => (
          <span className="text-xs text-slate-700">
            {[row.original.city, row.original.country].filter(Boolean).join(" · ") || "—"}
          </span>
        ),
      }),
      colHelper.display({
        id: "organization",
        header: t("admin.venues.colOrganization"),
        cell: ({ row }) => {
          const oid = row.original.organizationId;
          const label =
            row.original.organization?.name ??
            (oid ? (orgNameById.get(oid) ?? oid) : null);
          return <span className="text-xs text-slate-700">{label ?? "—"}</span>;
        },
      }),
      colHelper.display({
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Link
            href={`/venues/${row.original.id}`}
            className="text-sm text-brand font-medium hover:underline whitespace-nowrap"
          >
            {t("admin.organizations.open")}
          </Link>
        ),
      }),
    ],
    [t, orgNameById],
  );

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (!isLoaded) {
    return (
      <PortalPageLayout>
        <PortalSkeleton />
      </PortalPageLayout>
    );
  }

  if (meQ.isPending && !meQ.data) {
    return (
      <PortalPageLayout>
        <PortalSkeleton />
      </PortalPageLayout>
    );
  }

  const showInitialLoading = venuesQ.isLoading && !venuesQ.data;

  return (
    <PortalPageLayout>
      <PortalPageHeader
        backHref={isSuperAdmin ? "/platform" : "/owner/venues"}
        backLabel={isSuperAdmin ? t("admin.venues.backPlatform") : t("admin.venues.backPartner")}
        title={t("admin.venues.title")}
        lead={isSuperAdmin ? t("admin.venues.subtitleSuper") : t("admin.venues.subtitlePartner")}
        meta={
          <p className="text-sm text-slate-500">
            {showInitialLoading
              ? t("admin.venues.loading")
              : t("admin.venues.pageRange", { from, to, total })}
          </p>
        }
      />

      {listErr ? (
        <PortalAlert tone="error" className="mb-5">
          {listErr}{" "}
          <Link
            href={isSuperAdmin ? "/platform" : "/owner/venues"}
            className="font-medium text-brand hover:text-brand-hover"
          >
            {isSuperAdmin
              ? t("admin.venues.loadErrorBackSuper")
              : t("admin.venues.loadErrorBackPartner")}
          </Link>
        </PortalAlert>
      ) : null}

      {showInitialLoading ? (
        <PortalSkeleton rows={2} />
      ) : (
        <>
          <PortalCard className="mb-6 border-slate-200/70 bg-gradient-to-br from-white via-white to-brand-lighter/20">
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
                <label className="flex min-w-0 flex-col gap-1.5">
                  <span className={portalLabelClass}>{t("admin.venues.filterSearchName")}</span>
                  <input
                    className={portalInputClass}
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder={t("admin.venues.filterSearchPlaceholder")}
                  />
                </label>
                <label className="flex min-w-0 flex-col gap-1.5">
                  <span className={portalLabelClass}>{t("admin.venues.filterCityCountry")}</span>
                  <input
                    className={portalInputClass}
                    value={cityQ}
                    onChange={(e) => setCityQ(e.target.value)}
                    placeholder={t("admin.venues.filterCityPlaceholder")}
                  />
                </label>
              </div>

              <div
                className={`grid grid-cols-1 gap-4 lg:gap-5 ${isSuperAdmin ? "lg:grid-cols-2" : ""}`}
              >
                <label className="flex min-w-0 flex-col gap-1.5">
                  <span className={portalLabelClass}>{t("admin.venues.filterOrganization")}</span>
                  <FilterableSelect<FilterableOption, false>
                    containerClassName="w-full"
                    options={orgSelectOptions}
                    value={selectedOrgOption}
                    onChange={(opt) => setOrgFilter(opt?.value ?? "")}
                    placeholder={t("admin.venues.filterOrgPlaceholder")}
                    isClearable={false}
                  />
                </label>
                {isSuperAdmin ? (
                  <label className="flex min-w-0 flex-col gap-1.5">
                    <span className={portalLabelClass}>{t("admin.venues.filterCountries")}</span>
                    <FilterableSelect<FilterableOption, true>
                      isMulti
                      containerClassName="w-full"
                      options={countryOptions}
                      value={selectedCountryOptions}
                      onChange={(opts) =>
                        setCountryIsoFilters((opts ?? []).map((o) => o.value))
                      }
                      placeholder={t("admin.venues.filterCountriesPlaceholder")}
                      closeMenuOnSelect={false}
                    />
                    <span className="text-xs font-normal leading-snug text-slate-500">
                      {t("admin.venues.filterCountriesHint")}
                    </span>
                  </label>
                ) : null}
              </div>

              <div className="border-t border-slate-100 pt-4">
                <label className="inline-flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100/90">
                  <input
                    type="checkbox"
                    checked={lockedOnly}
                    onChange={(e) => setLockedOnly(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/30"
                  />
                  {t("admin.venues.filterLockedOnly")}
                </label>
              </div>
            </div>
          </PortalCard>
          <TableRowCards rows={table.getRowModel().rows} leadCellId="name" />
          {total === 0 && !venuesQ.isFetching ? (
            <p className="md:hidden rounded-2xl border border-slate-200/80 bg-white px-4 py-8 text-center text-sm text-slate-500 shadow-portal-card">
              {hasActiveFilters ? t("admin.venues.noMatch") : t("admin.venues.empty")}
            </p>
          ) : null}
          <div className="relative hidden overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-portal-card md:block">
            {venuesQ.isFetching && venuesQ.data ? (
              <div className="absolute right-3 top-2 z-10 text-xs text-slate-500">
                {t("admin.venues.loading")}
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
            {total === 0 && !venuesQ.isFetching ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">
                {hasActiveFilters ? t("admin.venues.noMatch") : t("admin.venues.empty")}
              </p>
            ) : null}
          </div>
          {total > 0 ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-600">
                {t("admin.venues.pageStatus", {
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
                  {t("admin.venues.pagePrev")}
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className={portalButtonSecondaryClass}
                >
                  {t("admin.venues.pageNext")}
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </PortalPageLayout>
  );
}

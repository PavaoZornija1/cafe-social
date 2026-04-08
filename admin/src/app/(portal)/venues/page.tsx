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
      <div className="bg-slate-50 text-slate-600 p-8">
        <p>{t("admin.venues.loading")}</p>
      </div>
    );
  }

  if (meQ.isPending && !meQ.data) {
    return (
      <div className="bg-slate-50 text-slate-600 p-8">
        <p>{t("admin.venues.loading")}</p>
      </div>
    );
  }

  const showInitialLoading = venuesQ.isLoading && !venuesQ.data;

  return (
    <div className="bg-slate-50 text-slate-900 p-6 md:p-8 min-h-full">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Link
            href={isSuperAdmin ? "/platform" : "/owner/venues"}
            className="text-brand text-sm hover:underline"
          >
            {isSuperAdmin ? t("admin.venues.backPlatform") : t("admin.venues.backPartner")}
          </Link>
          <h1 className="text-xl font-bold mt-2">{t("admin.venues.title")}</h1>
          <p className="text-sm text-slate-500 mt-1 max-w-xl">
            {isSuperAdmin ? t("admin.venues.subtitleSuper") : t("admin.venues.subtitlePartner")}
          </p>
          <p className="text-sm text-slate-500 mt-2">
            {showInitialLoading
              ? t("admin.venues.loading")
              : t("admin.venues.pageRange", { from, to, total })}
          </p>
        </div>

        {listErr ? (
          <div className="mb-4 text-sm text-red-800 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
            {listErr}{" "}
            <Link
              href={isSuperAdmin ? "/platform" : "/owner/venues"}
              className="text-brand font-medium hover:underline"
            >
              {isSuperAdmin
                ? t("admin.venues.loadErrorBackSuper")
                : t("admin.venues.loadErrorBackPartner")}
            </Link>
          </div>
        ) : null}

        {showInitialLoading ? (
          <p className="text-slate-500">{t("admin.venues.loading")}</p>
        ) : (
          <>
            <section className="mb-8 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.04] md:p-6">
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
                  <label className="flex min-w-0 flex-col gap-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t("admin.venues.filterSearchName")}
                    </span>
                    <input
                      className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder={t("admin.venues.filterSearchPlaceholder")}
                    />
                  </label>
                  <label className="flex min-w-0 flex-col gap-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t("admin.venues.filterCityCountry")}
                    </span>
                    <input
                      className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
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
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t("admin.venues.filterOrganization")}
                    </span>
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
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {t("admin.venues.filterCountries")}
                      </span>
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
                  <label className="inline-flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100/90">
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
            </section>
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-x-auto relative">
              {venuesQ.isFetching && venuesQ.data ? (
                <div className="absolute top-2 right-3 text-xs text-slate-500 z-10">
                  {t("admin.venues.loading")}
                </div>
              ) : null}
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
              {total === 0 && !venuesQ.isFetching ? (
                <p className="px-4 py-8 text-center text-slate-500 text-sm">
                  {hasActiveFilters ? t("admin.venues.noMatch") : t("admin.venues.empty")}
                </p>
              ) : null}
            </div>
            {total > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
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
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 disabled:opacity-40 hover:bg-slate-50"
                  >
                    {t("admin.venues.pagePrev")}
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 disabled:opacity-40 hover:bg-slate-50"
                  >
                    {t("admin.venues.pageNext")}
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

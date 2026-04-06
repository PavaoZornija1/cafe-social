"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import {
  type AdminVenueListRow,
  useAdminOrganizationsQuery,
  useAdminVenuesQuery,
  usePortalMeQuery,
} from "@/lib/queries";
import { getCountrySelectOptions } from "@/lib/geo/countryOptions";
import {
  FilterableSelect,
  type FilterableOption,
} from "@/components/ui/FilterableSelect";

const colHelper = createColumnHelper<AdminVenueListRow>();

export default function VenuesPage() {
  const { isLoaded, getToken } = useAuth();
  const [q, setQ] = useState("");
  const [cityQ, setCityQ] = useState("");
  const [lockedOnly, setLockedOnly] = useState(false);
  const [orgFilter, setOrgFilter] = useState<string>("");
  const [countryIsoFilters, setCountryIsoFilters] = useState<string[]>([]);

  const meQ = usePortalMeQuery(getToken, isLoaded);
  const isSuperAdmin = meQ.data?.platformRole === "SUPER_ADMIN";

  const venuesQ = useAdminVenuesQuery(getToken, isLoaded);
  const orgsQ = useAdminOrganizationsQuery(getToken, isLoaded && isSuperAdmin);

  const rows = venuesQ.data ?? null;
  const orgs = useMemo(
    () => (orgsQ.data ?? []).map((o) => ({ id: o.id, name: o.name })),
    [orgsQ.data],
  );

  const orgNameById = useMemo(() => new Map(orgs.map((o) => [o.id, o.name])), [orgs]);

  const countryOptions = useMemo(() => getCountrySelectOptions(), []);
  const orgSelectOptions = useMemo<FilterableOption[]>(
    () => [
      { value: "", label: "Any organization" },
      { value: "__none__", label: "Not in any org" },
      ...orgs.map((o) => ({ value: o.id, label: o.name })),
    ],
    [orgs],
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

  const filtered = useMemo(() => {
    if (!rows) return [];
    const qq = q.trim().toLowerCase();
    const cq = cityQ.trim().toLowerCase();
    return rows.filter((v) => {
      if (lockedOnly && !v.locked) return false;
      if (orgFilter === "__none__") {
        if (v.organizationId) return false;
      } else if (orgFilter && v.organizationId !== orgFilter) return false;
      if (qq && !v.name.toLowerCase().includes(qq)) return false;
      if (cq) {
        const c = (v.city ?? "").toLowerCase();
        const co = (v.country ?? "").toLowerCase();
        if (!c.includes(cq) && !co.includes(cq)) return false;
      }
      if (countryIsoFilters.length) {
        const iso = (v.country ?? "").trim().toUpperCase();
        if (!iso || !countryIsoFilters.includes(iso)) return false;
      }
      return true;
    });
  }, [rows, q, cityQ, lockedOnly, orgFilter, countryIsoFilters]);

  const columns = useMemo(
    () => [
      colHelper.accessor("name", {
        header: "Venue",
        cell: (info) => {
          const v = info.row.original;
          return (
            <div>
              <div className="font-semibold flex flex-wrap items-center gap-2">
                {info.getValue()}
                {v.locked ? (
                  <span className="text-[10px] uppercase text-red-700 border border-red-200 rounded px-1.5">
                    locked
                  </span>
                ) : null}
              </div>
              <div className="text-xs text-slate-500 font-mono mt-1">{v.id}</div>
            </div>
          );
        },
      }),
      colHelper.display({
        id: "location",
        header: "Location",
        cell: ({ row }) => (
          <span className="text-xs text-slate-600">
            {[row.original.city, row.original.country].filter(Boolean).join(" · ") || "—"}
          </span>
        ),
      }),
      colHelper.display({
        id: "organization",
        header: "Organization",
        cell: ({ row }) => {
          const oid = row.original.organizationId;
          return (
            <span className="text-xs text-brand">
              {oid ? (orgNameById.get(oid) ?? "org") : "—"}
            </span>
          );
        },
      }),
      colHelper.display({
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const v = row.original;
          return (
            <div className="flex gap-3 text-sm flex-wrap">
              <Link href={`/venues/${v.id}`} className="text-brand hover:underline">
                Edit copy & links
              </Link>
              <Link href={`/perks/${v.id}`} className="text-amber-700 hover:underline">
                Perks
              </Link>
              <Link href={`/challenges/${v.id}`} className="text-emerald-700 hover:underline">
                Challenges
              </Link>
            </div>
          );
        },
      }),
    ],
    [orgNameById],
  );

  const table = useReactTable({
    data: filtered,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const err =
    venuesQ.isError && venuesQ.error instanceof Error
      ? venuesQ.error.message
      : orgsQ.isError && orgsQ.error instanceof Error
        ? orgsQ.error.message
        : null;

  if (err) {
    return (
      <div className="bg-slate-50 text-red-700 p-8">
        {err}{" "}
        <Link href={isSuperAdmin ? "/platform" : "/owner/venues"} className="text-brand underline">
          {isSuperAdmin ? "Platform" : "Partner venues"}
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 text-slate-900 p-8">
      <h1 className="text-xl font-bold mb-2">
        {isSuperAdmin ? "All venues (CMS)" : "Your locations (CMS)"}
      </h1>
      <p className="text-sm text-slate-500 mb-4">
        {isSuperAdmin
          ? "Platform scope — every venue in the product."
          : "Scoped to venues where you are owner or manager."}{" "}
        {rows ? `${filtered.length} of ${rows.length} shown` : "Loading…"}
      </p>
      {venuesQ.isPending && !rows ? (
        <p className="text-slate-600">Loading…</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-3 mb-6 items-end border border-slate-200 rounded-xl p-4 bg-brand-light/60">
            <label className="text-sm text-slate-600">
              Search name
              <input
                className="mt-1 block w-48 bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Café…"
              />
            </label>
            <label className="text-sm text-slate-600">
              City / country
              <input
                className="mt-1 block w-40 bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                value={cityQ}
                onChange={(e) => setCityQ(e.target.value)}
                placeholder="Zagreb…"
              />
            </label>
            <label className="text-sm text-slate-600 flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={lockedOnly}
                onChange={(e) => setLockedOnly(e.target.checked)}
              />
              Locked only
            </label>
            <label className="text-sm text-slate-600 block min-w-[13rem]">
              Organization
              <FilterableSelect<FilterableOption, false>
                containerClassName="mt-1"
                options={orgSelectOptions}
                value={selectedOrgOption}
                onChange={(opt) => setOrgFilter(opt?.value ?? "")}
                placeholder="Search…"
                isClearable={false}
              />
            </label>
            {isSuperAdmin ? (
              <label className="text-sm text-slate-600 block min-w-[14rem] max-w-[min(100%,22rem)]">
                Countries
                <FilterableSelect<FilterableOption, true>
                  isMulti
                  containerClassName="mt-1"
                  options={countryOptions}
                  value={selectedCountryOptions}
                  onChange={(opts) =>
                    setCountryIsoFilters((opts ?? []).map((o) => o.value))
                  }
                  placeholder="Any country"
                  closeMenuOnSelect={false}
                />
                <span className="mt-1 block text-xs font-normal text-slate-500">
                  Venue must match one of the selected ISO countries (empty = all).
                </span>
              </label>
            ) : null}
          </div>
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
                  <tr key={row.id} className="border-b border-slate-100 hover:bg-brand-light/30">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 align-top">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 ? (
            <p className="text-slate-500 mt-6 text-sm">No venues match filters.</p>
          ) : null}
        </>
      )}
    </div>
  );
}

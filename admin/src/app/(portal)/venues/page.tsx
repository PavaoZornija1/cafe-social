"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useMemo, useState } from "react";
import { fetchPortalMe, portalFetch } from "../../../lib/portalApi";

type Venue = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  menuUrl: string | null;
  orderingUrl: string | null;
  featuredOfferTitle: string | null;
  locked?: boolean;
  organizationId?: string | null;
};

type OrgOpt = { id: string; name: string };

export default function VenuesPage() {
  const { isLoaded, getToken } = useAuth();
  const [rows, setRows] = useState<Venue[] | null>(null);
  const [orgs, setOrgs] = useState<OrgOpt[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [cityQ, setCityQ] = useState("");
  const [lockedOnly, setLockedOnly] = useState(false);
  const [orgFilter, setOrgFilter] = useState<string>("");

  useEffect(() => {
    if (!isLoaded) return;
    let c = false;
    (async () => {
      try {
        const me = await fetchPortalMe(getToken);
        if (!c) setIsSuperAdmin(me.platformRole === "SUPER_ADMIN");
        const [venueData, orgData] = await Promise.all([
          portalFetch<Venue[]>(getToken, "/admin/venues", { method: "GET" }),
          me.platformRole === "SUPER_ADMIN"
            ? portalFetch<{ id: string; name: string }[]>(getToken, "/admin/organizations", {
                method: "GET",
              }).catch(() => [] as { id: string; name: string }[])
            : Promise.resolve([] as { id: string; name: string }[]),
        ]);
        if (!c) {
          setRows(venueData);
          setOrgs(orgData.map((o) => ({ id: o.id, name: o.name })));
        }
      } catch (e) {
        if (!c) setErr((e as Error).message);
      }
    })();
    return () => {
      c = true;
    };
  }, [isLoaded, getToken]);

  const orgNameById = useMemo(() => new Map(orgs.map((o) => [o.id, o.name])), [orgs]);

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
      return true;
    });
  }, [rows, q, cityQ, lockedOnly, orgFilter]);

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
      {!rows ? (
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
            <label className="text-sm text-slate-600">
              Organization
              <select
                className="mt-1 block w-52 bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                value={orgFilter}
                onChange={(e) => setOrgFilter(e.target.value)}
              >
                <option value="">Any</option>
                <option value="__none__">Not in any org</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <ul className="space-y-3">
            {filtered.map((v) => (
              <li key={v.id} className="border border-slate-200 rounded-lg p-3">
                <div className="font-semibold flex flex-wrap items-center gap-2">
                  {v.name}
                  {v.locked ? (
                    <span className="text-[10px] uppercase text-red-700 border border-red-200 rounded px-1.5">
                      locked
                    </span>
                  ) : null}
                </div>
                <div className="text-xs text-slate-500 font-mono mt-1">{v.id}</div>
                <div className="text-xs text-slate-600 mt-1">
                  {[v.city, v.country].filter(Boolean).join(" · ") || "—"}
                  {v.organizationId ? (
                    <span className="text-brand ml-2">
                      · {orgNameById.get(v.organizationId) ?? "org"}
                    </span>
                  ) : null}
                </div>
                <div className="flex gap-3 mt-2 text-sm flex-wrap">
                  <Link
                    href={`/venues/${v.id}`}
                    className="text-brand hover:underline"
                  >
                    Edit copy & links
                  </Link>
                  <Link
                    href={`/perks/${v.id}`}
                    className="text-amber-700 hover:underline"
                  >
                    Perks
                  </Link>
                  <Link
                    href={`/challenges/${v.id}`}
                    className="text-emerald-700 hover:underline"
                  >
                    Challenges
                  </Link>
                </div>
              </li>
            ))}
          </ul>
          {filtered.length === 0 ? (
            <p className="text-slate-500 mt-6 text-sm">No venues match filters.</p>
          ) : null}
        </>
      )}
    </div>
  );
}

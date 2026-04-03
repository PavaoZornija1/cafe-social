"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { portalFetch } from "../../../../lib/portalApi";

type VenueStaffRow = {
  id: string;
  playerId: string;
  role: "EMPLOYEE" | "MANAGER" | "OWNER";
  player: { id: string; email: string; username: string };
};

type Venue = {
  id: string;
  name: string;
  menuUrl: string | null;
  orderingUrl: string | null;
  orderNudgeTitle: string | null;
  orderNudgeBody: string | null;
  featuredOfferTitle: string | null;
  featuredOfferBody: string | null;
  featuredOfferEndsAt: string | null;
  analyticsTimeZone?: string | null;
  organizationId: string | null;
  locked: boolean;
  lockReason: string | null;
};

type OrgOption = { id: string; name: string };

export default function EditVenuePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isLoaded, getToken } = useAuth();
  const [v, setV] = useState<Venue | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [staffList, setStaffList] = useState<VenueStaffRow[]>([]);
  const [staffEmail, setStaffEmail] = useState("");
  const [staffRole, setStaffRole] = useState<VenueStaffRow["role"]>("EMPLOYEE");
  const [staffBusy, setStaffBusy] = useState(false);
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const lockedWhenLoaded = useRef(false);

  useEffect(() => {
    if (!isLoaded || !id) return;
    let c = false;
    (async () => {
      try {
        const data = await portalFetch<Venue>(getToken, `/admin/venues/${id}`, {
          method: "GET",
        });
        if (!c) {
          const merged = {
            ...data,
            organizationId: data.organizationId ?? null,
            locked: data.locked ?? false,
            lockReason: data.lockReason ?? null,
          };
          lockedWhenLoaded.current = merged.locked;
          setV(merged);
        }
      } catch (e) {
        if (!c) setErr((e as Error).message);
      }
    })();
    return () => {
      c = true;
    };
  }, [isLoaded, id, getToken]);

  useEffect(() => {
    if (!isLoaded) return;
    let c = false;
    (async () => {
      try {
        const list = await portalFetch<
          { id: string; name: string }[]
        >(getToken, "/admin/organizations", {
          method: "GET",
        });
        if (!c) setOrgs(list.map((o) => ({ id: o.id, name: o.name })));
      } catch {
        if (!c) setOrgs([]);
      }
    })();
    return () => {
      c = true;
    };
  }, [isLoaded, getToken]);

  useEffect(() => {
    if (!isLoaded || !id) return;
    let c = false;
    (async () => {
      try {
        const rows = await portalFetch<VenueStaffRow[]>(
          getToken,
          `/admin/venues/${id}/staff`,
          { method: "GET" },
        );
        if (!c) setStaffList(rows);
      } catch {
        if (!c) setStaffList([]);
      }
    })();
    return () => {
      c = true;
    };
  }, [isLoaded, id, getToken]);

  const save = async () => {
    if (!v || !id) return;
    setSaving(true);
    setErr(null);
    try {
      const body: Record<string, unknown> = {
        menuUrl: v.menuUrl || null,
        orderingUrl: v.orderingUrl || null,
        orderNudgeTitle: v.orderNudgeTitle || null,
        orderNudgeBody: v.orderNudgeBody || null,
        featuredOfferTitle: v.featuredOfferTitle || null,
        featuredOfferBody: v.featuredOfferBody || null,
        featuredOfferEndsAt: v.featuredOfferEndsAt || null,
        analyticsTimeZone: v.analyticsTimeZone?.trim() || null,
        organizationId: v.organizationId || null,
        locked: v.locked,
        lockReason: v.lockReason?.trim() || null,
      };
      await portalFetch(getToken, `/admin/venues/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      lockedWhenLoaded.current = v.locked;
      router.push("/venues");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const refreshStaff = async () => {
    if (!id) return;
    const rows = await portalFetch<VenueStaffRow[]>(
      getToken,
      `/admin/venues/${id}/staff`,
      { method: "GET" },
    );
    setStaffList(rows);
  };

  const addStaff = async () => {
    if (!id || !staffEmail.trim()) return;
    setStaffBusy(true);
    setErr(null);
    try {
      await portalFetch(getToken, `/admin/venues/${id}/staff`, {
        method: "POST",
        body: JSON.stringify({
          email: staffEmail.trim(),
          role: staffRole,
        }),
      });
      setStaffEmail("");
      await refreshStaff();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setStaffBusy(false);
    }
  };

  const removeStaffMember = async (playerId: string) => {
    if (!id) return;
    setStaffBusy(true);
    setErr(null);
    try {
      await portalFetch(getToken, `/admin/venues/${id}/staff/${playerId}`, {
        method: "DELETE",
      });
      await refreshStaff();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setStaffBusy(false);
    }
  };

  if (err && !v) {
    return (
      <div className="bg-slate-50 text-red-700 p-8">
        {err}{" "}
        <Link href="/venues" className="text-brand">
          Back
        </Link>
      </div>
    );
  }
  if (!v) {
    return (
      <div className="bg-slate-50 text-slate-900 p-8">Loading…</div>
    );
  }

  const field = (
    label: string,
    key: keyof Venue,
    multiline?: boolean,
  ) => (
    <label className="block mb-3">
      <span className="text-sm text-slate-600">{label}</span>
      {multiline ? (
        <textarea
          className="mt-1 w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm min-h-[72px]"
          value={(v[key] as string) ?? ""}
          onChange={(e) => setV({ ...v, [key]: e.target.value })}
        />
      ) : (
        <input
          className="mt-1 w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm"
          value={(v[key] as string) ?? ""}
          onChange={(e) => setV({ ...v, [key]: e.target.value })}
        />
      )}
    </label>
  );

  return (
    <div className="bg-slate-50 text-slate-900 p-8 max-w-2xl">
      <Link href="/venues" className="text-brand text-sm">
        ← Venues
      </Link>
      <h1 className="text-xl font-bold mt-4 mb-1">{v.name}</h1>
      <p className="text-xs text-slate-500 font-mono mb-6">{v.id}</p>
      <label className="block mb-3">
        <span className="text-sm text-slate-600">Franchise / organization</span>
        <select
          className="mt-1 w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm"
          value={v.organizationId ?? ""}
          onChange={(e) =>
            setV({
              ...v,
              organizationId: e.target.value || null,
            })
          }
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
      <label className="flex items-center gap-2 mb-3">
        <input
          type="checkbox"
          checked={v.locked}
          onChange={(e) => {
            const next = e.target.checked;
            if (next && !v.locked) {
              if (
                !window.confirm(
                  "Lock this venue? Save to apply — players lose access until unlocked.",
                )
              ) {
                return;
              }
            }
            setV({ ...v, locked: next });
          }}
        />
        <span className="text-sm text-slate-800">Locked (suspend play & map)</span>
      </label>
      {field("Lock reason (optional)", "lockReason")}
      {field("Menu URL", "menuUrl")}
      {field("Ordering URL", "orderingUrl")}
      {field("Order nudge title ({{venueName}} ok)", "orderNudgeTitle")}
      {field("Order nudge body", "orderNudgeBody", true)}
      {field("Featured offer title", "featuredOfferTitle")}
      {field("Featured offer body", "featuredOfferBody", true)}
      {field("Featured offer ends at (ISO, optional)", "featuredOfferEndsAt")}
      <label className="block mb-3">
        <span className="text-sm text-slate-600">
          Analytics timezone (IANA, optional — hour-of-day charts for owners)
        </span>
        <input
          className="mt-1 w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm"
          value={v.analyticsTimeZone ?? ""}
          onChange={(e) =>
            setV({ ...v, analyticsTimeZone: e.target.value || null })
          }
          placeholder="e.g. Europe/Zagreb"
        />
      </label>
      <div className="border border-slate-300 rounded-lg p-4 mb-4 space-y-3">
        <p className="text-sm text-slate-800 font-semibold">
          Owner / manager / employee (Clerk)
        </p>
        <p className="text-xs text-slate-500">
          Invite people with their real sign-in email. They use this partner
          portal with the same Clerk project: employees see verification lists;
          managers and owners see analytics and campaigns.
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
              onChange={(e) =>
                setStaffRole(e.target.value as VenueStaffRow["role"])
              }
            >
              <option value="EMPLOYEE">EMPLOYEE</option>
              <option value="MANAGER">MANAGER</option>
              <option value="OWNER">OWNER</option>
            </select>
          </label>
          <button
            type="button"
            disabled={staffBusy}
            onClick={() => void addStaff()}
            className="bg-slate-200 hover:bg-slate-300 disabled:opacity-50 rounded-lg px-4 py-2 text-sm h-[38px]"
          >
            Add / update
          </button>
        </div>
        <ul className="divide-y divide-slate-200 rounded border border-slate-200 overflow-hidden">
          {staffList.length === 0 ? (
            <li className="text-sm text-slate-500 p-3">No staff yet.</li>
          ) : (
            staffList.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center gap-2 justify-between p-3 text-sm bg-slate-50"
              >
                <span className="text-slate-800">{s.player.email}</span>
                <span className="text-xs font-mono text-brand">
                  {s.role}
                </span>
                <button
                  type="button"
                  disabled={staffBusy}
                  onClick={() => void removeStaffMember(s.playerId)}
                  className="text-red-600 hover:text-red-800 text-xs"
                >
                  Remove
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
      {err ? <p className="text-red-600 text-sm mb-2">{err}</p> : null}
      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        className="mt-4 w-full bg-brand hover:bg-brand-hover disabled:opacity-50 rounded-lg py-2 font-semibold"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { adminFetch } from "../../../lib/adminApi";

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
  staffPortalConfigured?: boolean;
  analyticsTimeZone?: string | null;
};

export default function EditVenuePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [v, setV] = useState<Venue | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newStaffPin, setNewStaffPin] = useState("");
  const [clearStaffPin, setClearStaffPin] = useState(false);
  const [staffList, setStaffList] = useState<VenueStaffRow[]>([]);
  const [staffEmail, setStaffEmail] = useState("");
  const [staffRole, setStaffRole] = useState<VenueStaffRow["role"]>("EMPLOYEE");
  const [staffBusy, setStaffBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    let c = false;
    (async () => {
      try {
        const data = await adminFetch<Venue>(`/admin/venues/${id}`, {
          method: "GET",
        });
        if (!c) setV(data);
      } catch (e) {
        if (!c) setErr((e as Error).message);
      }
    })();
    return () => {
      c = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let c = false;
    (async () => {
      try {
        const rows = await adminFetch<VenueStaffRow[]>(
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
  }, [id]);

  const save = async () => {
    if (!v || !id) return;
    setSaving(true);
    setErr(null);
    try {
      if (clearStaffPin && newStaffPin.trim().length >= 4) {
        setErr("Choose either a new PIN or clear — not both.");
        setSaving(false);
        return;
      }
      const body: Record<string, unknown> = {
        menuUrl: v.menuUrl || null,
        orderingUrl: v.orderingUrl || null,
        orderNudgeTitle: v.orderNudgeTitle || null,
        orderNudgeBody: v.orderNudgeBody || null,
        featuredOfferTitle: v.featuredOfferTitle || null,
        featuredOfferBody: v.featuredOfferBody || null,
        featuredOfferEndsAt: v.featuredOfferEndsAt || null,
        analyticsTimeZone: v.analyticsTimeZone?.trim() || null,
      };
      if (clearStaffPin) body.clearStaffPortalPin = true;
      else if (newStaffPin.trim().length >= 4) body.staffPortalPin = newStaffPin.trim();
      await adminFetch(`/admin/venues/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setNewStaffPin("");
      setClearStaffPin(false);
      router.push("/venues");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const refreshStaff = async () => {
    if (!id) return;
    const rows = await adminFetch<VenueStaffRow[]>(
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
      await adminFetch(`/admin/venues/${id}/staff`, {
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
      await adminFetch(`/admin/venues/${id}/staff/${playerId}`, {
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
      <div className="min-h-screen bg-zinc-950 text-red-300 p-8">
        {err}{" "}
        <Link href="/venues" className="text-violet-400">
          Back
        </Link>
      </div>
    );
  }
  if (!v) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">Loading…</div>
    );
  }

  const field = (
    label: string,
    key: keyof Venue,
    multiline?: boolean,
  ) => (
    <label className="block mb-3">
      <span className="text-sm text-zinc-400">{label}</span>
      {multiline ? (
        <textarea
          className="mt-1 w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm min-h-[72px]"
          value={(v[key] as string) ?? ""}
          onChange={(e) => setV({ ...v, [key]: e.target.value })}
        />
      ) : (
        <input
          className="mt-1 w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
          value={(v[key] as string) ?? ""}
          onChange={(e) => setV({ ...v, [key]: e.target.value })}
        />
      )}
    </label>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8 max-w-2xl mx-auto">
      <Link href="/venues" className="text-violet-400 text-sm">
        ← Venues
      </Link>
      <h1 className="text-xl font-bold mt-4 mb-1">{v.name}</h1>
      <p className="text-xs text-zinc-500 font-mono mb-6">{v.id}</p>
      {field("Menu URL", "menuUrl")}
      {field("Ordering URL", "orderingUrl")}
      {field("Order nudge title ({{venueName}} ok)", "orderNudgeTitle")}
      {field("Order nudge body", "orderNudgeBody", true)}
      {field("Featured offer title", "featuredOfferTitle")}
      {field("Featured offer body", "featuredOfferBody", true)}
      {field("Featured offer ends at (ISO, optional)", "featuredOfferEndsAt")}
      <label className="block mb-3">
        <span className="text-sm text-zinc-400">
          Analytics timezone (IANA, optional — hour-of-day charts for owners)
        </span>
        <input
          className="mt-1 w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
          value={v.analyticsTimeZone ?? ""}
          onChange={(e) =>
            setV({ ...v, analyticsTimeZone: e.target.value || null })
          }
          placeholder="e.g. Europe/Zagreb"
        />
      </label>
      <div className="border border-zinc-700 rounded-lg p-4 mb-4 mt-6 space-y-3">
        <p className="text-sm text-zinc-300 font-semibold">Staff tablet — perk verification</p>
        <p className="text-xs text-zinc-500">
          Set a 4–10 digit PIN. Baristas open the staff page (no admin key), enter PIN, and
          match the guest&apos;s 8-character code after redeem.
        </p>
        <p className="text-xs text-amber-200">
          PIN status:{" "}
          {v.staffPortalConfigured ? "configured ✓" : "not set — verification portal disabled"}
        </p>
        <Link
          href={`/staff/${v.id}`}
          className="text-emerald-400 text-sm inline-block"
        >
          Open staff verification page →
        </Link>
        <label className="block text-sm text-zinc-400">
          New staff PIN (digits only, leave blank to leave unchanged)
          <input
            type="password"
            autoComplete="off"
            className="mt-1 w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
            value={newStaffPin}
            onChange={(e) => setNewStaffPin(e.target.value.replace(/\D/g, "").slice(0, 10))}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-400">
          <input
            type="checkbox"
            checked={clearStaffPin}
            onChange={(e) => setClearStaffPin(e.target.checked)}
          />
          Clear staff PIN on save
        </label>
      </div>
      <div className="border border-zinc-700 rounded-lg p-4 mb-4 space-y-3">
        <p className="text-sm text-zinc-300 font-semibold">
          Owner / manager / employee (Clerk)
        </p>
        <p className="text-xs text-zinc-500">
          Invite people with their real sign-in email. They use the{" "}
          <strong className="text-zinc-400">Venue owner portal</strong> with the
          same Clerk project: managers and owners see analytics; employees see
          perk verification lists.
        </p>
        <div className="flex flex-wrap gap-2 items-end">
          <label className="block text-sm text-zinc-400 flex-1 min-w-[200px]">
            Email
            <input
              type="email"
              className="mt-1 w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
              value={staffEmail}
              onChange={(e) => setStaffEmail(e.target.value)}
              placeholder="owner@venue.com"
            />
          </label>
          <label className="block text-sm text-zinc-400">
            Role
            <select
              className="mt-1 block w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
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
            className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded-lg px-4 py-2 text-sm h-[38px]"
          >
            Add / update
          </button>
        </div>
        <ul className="divide-y divide-zinc-800 rounded border border-zinc-800 overflow-hidden">
          {staffList.length === 0 ? (
            <li className="text-sm text-zinc-500 p-3">No staff yet.</li>
          ) : (
            staffList.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center gap-2 justify-between p-3 text-sm bg-zinc-900/40"
              >
                <span className="text-zinc-300">{s.player.email}</span>
                <span className="text-xs font-mono text-violet-300">
                  {s.role}
                </span>
                <button
                  type="button"
                  disabled={staffBusy}
                  onClick={() => void removeStaffMember(s.playerId)}
                  className="text-red-400 hover:text-red-300 text-xs"
                >
                  Remove
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
      {err ? <p className="text-red-400 text-sm mb-2">{err}</p> : null}
      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        className="mt-4 w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-lg py-2 font-semibold"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}

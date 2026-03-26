"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { adminFetch } from "../../../lib/adminApi";

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
};

export default function EditVenuePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [v, setV] = useState<Venue | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  const save = async () => {
    if (!v || !id) return;
    setSaving(true);
    setErr(null);
    try {
      await adminFetch(`/admin/venues/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          menuUrl: v.menuUrl || null,
          orderingUrl: v.orderingUrl || null,
          orderNudgeTitle: v.orderNudgeTitle || null,
          orderNudgeBody: v.orderNudgeBody || null,
          featuredOfferTitle: v.featuredOfferTitle || null,
          featuredOfferBody: v.featuredOfferBody || null,
          featuredOfferEndsAt: v.featuredOfferEndsAt || null,
        }),
      });
      router.push("/venues");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
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
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8 max-w-xl mx-auto">
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

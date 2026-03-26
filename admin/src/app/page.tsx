"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AdminHome() {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const k = sessionStorage.getItem("adminApiKey") ?? "";
    setKey(k);
    setReady(true);
  }, []);

  const save = () => {
    sessionStorage.setItem("adminApiKey", key.trim());
    router.push("/venues");
  };

  if (!ready) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">Loading…</div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-2">Cafe Social — Partner CMS</h1>
      <p className="text-zinc-400 text-sm mb-6">
        Set your backend <code className="text-amber-200">ADMIN_API_KEY</code>{" "}
        value here. It is stored only in this browser (sessionStorage).
      </p>
      <label className="block text-sm font-medium text-zinc-300 mb-2">
        Admin API key
      </label>
      <input
        type="password"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 mb-4 font-mono text-sm"
        placeholder="Same as ADMIN_API_KEY on the API"
        autoComplete="off"
      />
      <button
        type="button"
        onClick={save}
        className="w-full bg-violet-600 hover:bg-violet-500 rounded-lg py-2 font-semibold"
      >
        Continue
      </button>
      <nav className="mt-8 flex flex-col gap-2 text-violet-400 text-sm">
        <Link href="/owner">Venue owner / manager portal (Clerk) →</Link>
        <Link href="/venues">Venues, menus & offers →</Link>
        <Link href="/words">Word deck →</Link>
        <span className="text-zinc-500 text-xs mt-2">
          Staff tablets: open <strong className="text-zinc-400">/staff/&lt;venueId&gt;</strong> after the
          manager sets a venue PIN (edit venue).
        </span>
      </nav>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { ownerFetch } from '@/lib/portalApi';

function AcceptStaffInviteInner() {
  const searchParams = useSearchParams();
  const initial = searchParams.get('token') ?? '';
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [token, setToken] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setToken(initial);
  }, [initial]);

  const submit = useCallback(async () => {
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      const t = await getToken();
      if (!t) throw new Error('Sign in first with the invited email.');
      const res = await ownerFetch(getToken, '/owner/accept-staff-invite', {
        method: 'POST',
        body: JSON.stringify({ token: token.trim() }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || res.statusText);
      const data = text ? JSON.parse(text) : {};
      setMsg(
        `You're on the team for ${data.venueName ?? 'the venue'} as ${data.role ?? 'staff'}.`,
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }, [getToken, token]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-8 max-w-lg mx-auto">
      <Link href="/owner/venues" className="text-sm text-brand hover:underline">
        ← Venues
      </Link>
      <h1 className="text-xl font-semibold mt-4">Accept staff invite</h1>
      <p className="text-sm text-slate-600 mt-2">
        Sign in with the same email the invitation was sent to, paste the token from your invite
        link, then confirm.
      </p>
      {!isLoaded ? (
        <p className="mt-4 text-slate-500">Loading…</p>
      ) : !isSignedIn ? (
        <p className="mt-4 text-amber-800 text-sm">Sign in using Clerk first.</p>
      ) : (
        <>
          <label className="block mt-6 text-sm text-slate-600">
            Invite token
            <textarea
              className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono min-h-[100px]"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste token"
            />
          </label>
          <button
            type="button"
            disabled={busy || !token.trim()}
            onClick={() => void submit()}
            className="mt-4 w-full bg-brand hover:bg-brand-hover disabled:opacity-50 rounded-lg py-2 font-medium"
          >
            {busy ? 'Working…' : 'Accept invite'}
          </button>
        </>
      )}
      {msg ? (
        <p className="mt-4 text-emerald-300 text-sm">{msg}</p>
      ) : null}
      {err ? (
        <p className="mt-4 text-red-700 text-sm">{err}</p>
      ) : null}
    </div>
  );
}

export default function AcceptStaffInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 text-slate-600 p-8">Loading…</div>
      }
    >
      <AcceptStaffInviteInner />
    </Suspense>
  );
}

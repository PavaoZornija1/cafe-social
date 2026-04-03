'use client';

import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { useForm } from '@tanstack/react-form';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { useAcceptStaffInviteMutation } from '@/lib/queries';

function AcceptStaffInviteInner() {
  const searchParams = useSearchParams();
  const initial = searchParams.get('token') ?? '';
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const acceptMut = useAcceptStaffInviteMutation(getToken);

  const form = useForm({
    defaultValues: { token: initial },
    onSubmit: async ({ value, formApi }) => {
      await acceptMut.mutateAsync(value.token.trim());
      formApi.reset({ token: '' });
    },
  });

  useEffect(() => {
    form.reset({ token: initial });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync URL token to form; form API stable
  }, [initial]);

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
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
        >
          <form.Field name="token">
            {(field) => (
              <label className="block text-sm text-slate-600">
                Invite token
                <textarea
                  className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono min-h-[100px]"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="Paste token"
                />
              </label>
            )}
          </form.Field>
          <button
            type="submit"
            disabled={acceptMut.isPending || !form.state.values.token.trim()}
            className="w-full bg-brand hover:bg-brand-hover disabled:opacity-50 rounded-lg py-2 font-medium"
          >
            {acceptMut.isPending ? 'Working…' : 'Accept invite'}
          </button>
        </form>
      )}
      {acceptMut.isSuccess && acceptMut.data ? (
        <p className="mt-4 text-emerald-800 text-sm">
          {`You're on the team for ${acceptMut.data.venueName ?? 'the venue'} as ${acceptMut.data.role ?? 'staff'}.`}
        </p>
      ) : null}
      {acceptMut.isError && acceptMut.error instanceof Error ? (
        <p className="mt-4 text-red-700 text-sm">{acceptMut.error.message}</p>
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

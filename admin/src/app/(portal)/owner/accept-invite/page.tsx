'use client';

import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { useForm } from '@tanstack/react-form';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { venuePortalHomePath } from '@/lib/partnerRoles';
import { useAcceptStaffInviteMutation, usePortalMeQuery } from '@/lib/queries';

function AcceptStaffInviteInner() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const initial = searchParams.get('token') ?? '';
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const meQ = usePortalMeQuery(getToken, isLoaded);
  const acceptMut = useAcceptStaffInviteMutation(getToken);
  const needsOnboarding = Boolean(meQ.data?.needsPartnerOnboarding);

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

  const successData = acceptMut.isSuccess ? acceptMut.data : null;
  const successRole = successData?.role as 'EMPLOYEE' | 'MANAGER' | 'OWNER' | undefined;
  const successHref =
    successData?.venueId && successRole
      ? venuePortalHomePath(successRole, successData.venueId)
      : '/owner/venues';

  return (
    <div className="min-h-full bg-slate-50 text-slate-900 px-4 py-6 sm:p-8 max-w-lg mx-auto w-full">
      <Link
        href={needsOnboarding ? '/onboarding' : '/owner/venues'}
        className="text-sm text-brand hover:underline font-medium"
      >
        {needsOnboarding
          ? t('admin.partnerOnboarding.backToSetup')
          : t('admin.partnerOnboarding.backToVenues')}
      </Link>
      <h1 className="text-xl font-semibold mt-4">{t('admin.partnerAcceptInvite.title')}</h1>
      <p className="text-sm text-slate-600 mt-2 leading-relaxed">
        {t('admin.partnerAcceptInvite.lead')}
      </p>
      {!isLoaded ? (
        <p className="mt-4 text-slate-500">{t('common.loading')}</p>
      ) : !isSignedIn ? (
        <p className="mt-4 text-amber-800 text-sm">{t('admin.partnerAcceptInvite.signInFirst')}</p>
      ) : successData ? (
        <div className="mt-6 space-y-4">
          <p className="text-emerald-800 text-sm leading-relaxed">
            {t('admin.partnerAcceptInvite.success', {
              venueName: successData.venueName ?? t('admin.partnerVenueDetail.header.fallbackVenueTitle'),
              role: successRole
                ? t(`admin.partnerVenueDetail.roles.${successRole}`)
                : t('admin.partnerVenueDetail.roles.EMPLOYEE'),
            })}
          </p>
          <Link
            href={successHref}
            className="inline-flex rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground shadow-md shadow-brand/20 hover:bg-brand-hover transition-colors"
          >
            {successData.venueId
              ? t('admin.partnerAcceptInvite.goToLocation')
              : t('admin.partnerAcceptInvite.goToLocations')}
          </Link>
        </div>
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
              <label className="block text-sm font-medium text-slate-800">
                {t('admin.partnerAcceptInvite.tokenLabel')}
                <textarea
                  className="mt-1.5 w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-mono min-h-[100px]"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder={t('admin.partnerAcceptInvite.tokenPlaceholder')}
                />
              </label>
            )}
          </form.Field>
          <button
            type="submit"
            disabled={acceptMut.isPending || !form.state.values.token.trim()}
            className="w-full bg-brand hover:bg-brand-hover disabled:opacity-50 rounded-xl py-3 font-semibold text-brand-foreground text-sm"
          >
            {acceptMut.isPending
              ? t('admin.partnerAcceptInvite.working')
              : t('admin.partnerAcceptInvite.submit')}
          </button>
        </form>
      )}
      {acceptMut.isError && acceptMut.error instanceof Error ? (
        <p className="mt-4 text-red-700 text-sm">{acceptMut.error.message}</p>
      ) : null}
    </div>
  );
}

export default function AcceptStaffInvitePage() {
  const { t } = useTranslation();
  return (
    <Suspense
      fallback={
        <div className="min-h-full bg-slate-50 text-slate-600 px-4 py-8">{t('common.loading')}</div>
      }
    >
      <AcceptStaffInviteInner />
    </Suspense>
  );
}

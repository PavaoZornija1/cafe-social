"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useOwnerVenueDashboard } from "../OwnerVenueDashboardContext";
import { VenueDashboardCard } from "../venueDashboardUi";

const STEPS = [
  { titleKey: "step1Title", bodyKey: "step1Body" },
  { titleKey: "step2Title", bodyKey: "step2Body", hasDeepLink: true },
  { titleKey: "step3Title", bodyKey: "step3Body", hasLinks: true },
  { titleKey: "step4Title", bodyKey: "step4Body" },
  { titleKey: "step5Title", bodyKey: "step5Body" },
] as const;

export function VenuePlaybookSection() {
  const { t } = useTranslation();
  const { venueId, metaRow } = useOwnerVenueDashboard();
  if (!metaRow) return null;

  return (
    <section className="space-y-5 scroll-mt-28">
      <VenueDashboardCard className="relative overflow-hidden border-emerald-200/70 bg-gradient-to-br from-emerald-50/60 via-white to-white">
        <div
          className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-emerald-200/30 blur-2xl"
          aria-hidden
        />
        <div className="relative">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700/80">
            {t("admin.partnerVenueDetail.sectionNav.playbook")}
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
            {t("admin.partnerVenueDetail.playbook.title")}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
            {t("admin.partnerVenueDetail.playbook.lead")}
          </p>
        </div>
      </VenueDashboardCard>

      <ol className="grid gap-3 sm:gap-4">
        {STEPS.map((step, index) => (
          <li key={step.titleKey}>
            <VenueDashboardCard className="flex gap-4 sm:gap-5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand text-sm font-bold text-brand-foreground shadow-md shadow-brand/20">
                {index + 1}
              </div>
              <div className="min-w-0 space-y-1.5">
                <h3 className="font-semibold text-slate-900">
                  {t(`admin.partnerVenueDetail.playbook.${step.titleKey}`)}
                </h3>
                {"hasDeepLink" in step && step.hasDeepLink ? (
                  <p className="text-sm leading-relaxed text-slate-600">
                    {t("admin.partnerVenueDetail.playbook.step2BeforeDeepLink")}{" "}
                    <code className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs text-slate-800 break-all">
                      cafesocial://unlock?venueId={venueId}
                    </code>{" "}
                    {t("admin.partnerVenueDetail.playbook.step2AfterDeepLink")}
                  </p>
                ) : "hasLinks" in step && step.hasLinks ? (
                  <p className="text-sm leading-relaxed text-slate-600">
                    {t("admin.partnerVenueDetail.playbook.step3BeforeLinks")}{" "}
                    <Link
                      href={`/owner/venues/${venueId}/perks`}
                      className="font-medium text-brand hover:text-brand-hover"
                    >
                      {t("admin.partnerVenueDetail.playbook.step3PerksLink")}
                    </Link>
                    {" · "}
                    <Link
                      href={`/owner/venues/${venueId}/challenges`}
                      className="font-medium text-brand hover:text-brand-hover"
                    >
                      {t("admin.partnerVenueDetail.playbook.step3ChallengesLink")}
                    </Link>
                    {" · "}
                    <Link
                      href={`/owner/venues/${venueId}/offers`}
                      className="font-medium text-brand hover:text-brand-hover"
                    >
                      {t("admin.partnerVenueDetail.playbook.step3OffersLink")}
                    </Link>
                    {t("admin.partnerVenueDetail.playbook.step3AfterLinks")}
                  </p>
                ) : (
                  <p className="text-sm leading-relaxed text-slate-600">
                    {t(`admin.partnerVenueDetail.playbook.${step.bodyKey}`)}
                  </p>
                )}
              </div>
            </VenueDashboardCard>
          </li>
        ))}
      </ol>

      <div className="grid gap-4 sm:grid-cols-2">
        <VenueDashboardCard>
          <h3 className="text-sm font-semibold text-slate-900">
            {t("admin.partnerVenueDetail.playbook.glossaryTitle")}
          </h3>
          <ul className="mt-3 space-y-2 text-xs leading-relaxed text-slate-600">
            <li className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand/60" />
              {t("admin.partnerVenueDetail.playbook.glossaryChallenges")}
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand/60" />
              {t("admin.partnerVenueDetail.playbook.glossaryPerks")}
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand/60" />
              {t("admin.partnerVenueDetail.playbook.glossaryOffers")}
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand/60" />
              {t("admin.partnerVenueDetail.playbook.glossaryPlatform")}
            </li>
          </ul>
        </VenueDashboardCard>

        <VenueDashboardCard>
          <h3 className="text-sm font-semibold text-slate-900">
            {t("admin.partnerVenueDetail.playbook.staffTitle")}
          </h3>
          <ul className="mt-3 space-y-2 text-xs leading-relaxed text-slate-600">
            <li className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500/70" />
              {t("admin.partnerVenueDetail.playbook.staffPerkCode")}
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500/70" />
              {t("admin.partnerVenueDetail.playbook.staffMemberCard")}
            </li>
          </ul>
        </VenueDashboardCard>
      </div>

      <VenueDashboardCard className="border-amber-200/70 bg-gradient-to-br from-amber-50/50 to-white">
        <h3 className="text-sm font-semibold text-slate-900">
          {t("admin.partnerVenueDetail.playbook.trialTitle")}
        </h3>
        <p className="mt-2 text-xs leading-relaxed text-slate-600">
          {t("admin.partnerVenueDetail.playbook.trialBody")}
        </p>
      </VenueDashboardCard>

      <p className="px-1 text-xs text-slate-500">
        {t("admin.partnerVenueDetail.playbook.orderNudgeHint")}
      </p>
    </section>
  );
}

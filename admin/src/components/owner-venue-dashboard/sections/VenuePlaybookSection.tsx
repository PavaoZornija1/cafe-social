"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useOwnerVenueDashboard } from "../OwnerVenueDashboardContext";

export function VenuePlaybookSection() {
  const { t } = useTranslation();
  const { venueId, metaRow } = useOwnerVenueDashboard();
  if (!metaRow) return null;
  return (
    <section className="border border-emerald-200 rounded-xl p-4 space-y-3 bg-emerald-50/40 scroll-mt-24">
                <h2 className="text-lg font-medium text-slate-900">
                  {t("admin.partnerVenueDetail.playbook.title")}
                </h2>
                <p className="text-sm text-slate-700">{t("admin.partnerVenueDetail.playbook.lead")}</p>
                <ol className="list-decimal list-inside text-sm text-slate-700 space-y-1.5">
                  <li>
                    <strong>{t("admin.partnerVenueDetail.playbook.step1Title")}</strong> —{" "}
                    {t("admin.partnerVenueDetail.playbook.step1Body")}
                  </li>
                  <li>
                    <strong>{t("admin.partnerVenueDetail.playbook.step2Title")}</strong> —{" "}
                    {t("admin.partnerVenueDetail.playbook.step2BeforeDeepLink")}{" "}
                    <code className="text-xs bg-white/80 px-1 rounded break-all">
                      cafesocial://unlock?venueId={venueId}
                    </code>{" "}
                    {t("admin.partnerVenueDetail.playbook.step2AfterDeepLink")}
                  </li>
                  <li>
                    <strong>{t("admin.partnerVenueDetail.playbook.step3Title")}</strong> —{" "}
                    {t("admin.partnerVenueDetail.playbook.step3BeforeLinks")}{" "}
                    <Link
                      href={`/owner/venues/${venueId}/perks`}
                      className="text-brand font-medium hover:underline"
                    >
                      {t("admin.partnerVenueDetail.playbook.step3PerksLink")}
                    </Link>
                    {" · "}
                    <Link
                      href={`/owner/venues/${venueId}/challenges`}
                      className="text-brand font-medium hover:underline"
                    >
                      {t("admin.partnerVenueDetail.playbook.step3ChallengesLink")}
                    </Link>
                    {" · "}
                    <Link
                      href={`/owner/venues/${venueId}/offers`}
                      className="text-brand font-medium hover:underline"
                    >
                      {t("admin.partnerVenueDetail.playbook.step3OffersLink")}
                    </Link>
                    {t("admin.partnerVenueDetail.playbook.step3AfterLinks")}
                  </li>
                  <li>
                    <strong>{t("admin.partnerVenueDetail.playbook.step4Title")}</strong> —{" "}
                    {t("admin.partnerVenueDetail.playbook.step4Body")}
                  </li>
                  <li>
                    <strong>{t("admin.partnerVenueDetail.playbook.step5Title")}</strong> —{" "}
                    {t("admin.partnerVenueDetail.playbook.step5Body")}
                  </li>
                </ol>

                <div className="rounded-lg border border-emerald-200/80 bg-white/80 p-3 space-y-2">
                  <h3 className="text-sm font-semibold text-slate-900">
                    {t("admin.partnerVenueDetail.playbook.glossaryTitle")}
                  </h3>
                  <ul className="list-disc list-inside text-xs text-slate-700 space-y-1">
                    <li>{t("admin.partnerVenueDetail.playbook.glossaryChallenges")}</li>
                    <li>{t("admin.partnerVenueDetail.playbook.glossaryPerks")}</li>
                    <li>{t("admin.partnerVenueDetail.playbook.glossaryOffers")}</li>
                    <li>{t("admin.partnerVenueDetail.playbook.glossaryPlatform")}</li>
                  </ul>
                </div>

                <div className="rounded-lg border border-emerald-200/80 bg-white/80 p-3 space-y-2">
                  <h3 className="text-sm font-semibold text-slate-900">
                    {t("admin.partnerVenueDetail.playbook.staffTitle")}
                  </h3>
                  <ul className="list-disc list-inside text-xs text-slate-700 space-y-1">
                    <li>{t("admin.partnerVenueDetail.playbook.staffPerkCode")}</li>
                    <li>{t("admin.partnerVenueDetail.playbook.staffMemberCard")}</li>
                  </ul>
                </div>

                <div className="rounded-lg border border-amber-200/80 bg-amber-50/50 p-3 space-y-1">
                  <h3 className="text-sm font-semibold text-slate-900">
                    {t("admin.partnerVenueDetail.playbook.trialTitle")}
                  </h3>
                  <p className="text-xs text-slate-700">
                    {t("admin.partnerVenueDetail.playbook.trialBody")}
                  </p>
                </div>

                <p className="text-xs text-slate-600">
                  {t("admin.partnerVenueDetail.playbook.orderNudgeHint")}
                </p>
              </section>
  );
}

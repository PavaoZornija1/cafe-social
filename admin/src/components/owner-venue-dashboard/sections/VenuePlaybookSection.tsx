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
                <p className="text-xs text-slate-600">
                  {t("admin.partnerVenueDetail.playbook.orderNudgeHint")}
                </p>
              </section>
  );
}

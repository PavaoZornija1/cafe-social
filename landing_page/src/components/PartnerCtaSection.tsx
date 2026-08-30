"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { siteConfig } from "@/lib/config";
import { Reveal } from "./Reveal";
import { SectionShell } from "./SectionHeader";
import { GlowCard } from "./GlowCard";

const benefitKeys = ["visits", "brand", "staff", "pilot"] as const;

export function PartnerCtaSection() {
  const t = useTranslations("partnerCta");

  return (
    <SectionShell id="for-cafes" background="dark" className="text-white">
      <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
        <Reveal>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">
            {t("eyebrow")}
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{t("title")}</h2>
          <p className="mt-4 text-lg leading-relaxed text-white/80">{t("body")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/partners"
              className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-primary-dark transition hover:bg-white/90"
            >
              {t("ctaPage")}
            </Link>
            <a
              href={`mailto:${siteConfig.contactEmail}`}
              className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              {t("ctaEmail")}
            </a>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <ul className="space-y-4">
            {benefitKeys.map((key) => (
              <GlowCard
                as="li"
                key={key}
                variant="dark"
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-white/90"
              >
                {t(`benefits.${key}`)}
              </GlowCard>
            ))}
          </ul>
        </Reveal>
      </div>
    </SectionShell>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { Reveal } from "./Reveal";
import { SectionHeader, SectionShell } from "./SectionHeader";
import { GlowCard } from "./GlowCard";

const stepKeys = ["checkIn", "games", "loyalty", "subscription"] as const;

export function ProductStorySection() {
  const t = useTranslations("productStory");

  return (
    <SectionShell id="how-it-works" background="cream">
      <SectionHeader eyebrow={t("eyebrow")} title={t("title")} />

      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        {stepKeys.map((key, index) => (
          <Reveal key={key} delay={index * 0.08}>
            <GlowCard
              as="article"
              effect="glance"
              className="overflow-hidden rounded-3xl border border-border bg-surface p-6"
            >
              <span className="text-5xl font-bold text-primary/15">
                {t(`steps.${key}.number`)}
              </span>
              <h3 className="mt-4 text-2xl font-bold text-foreground">
                {t(`steps.${key}.title`)}
              </h3>
              <p className="mt-3 leading-relaxed text-text-secondary">
                {t(`steps.${key}.body`)}
              </p>
            </GlowCard>
          </Reveal>
        ))}
      </div>
    </SectionShell>
  );
}

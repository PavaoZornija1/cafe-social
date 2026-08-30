"use client";

import { useTranslations } from "next-intl";
import { Reveal } from "./Reveal";
import { SectionHeader, SectionShell } from "./SectionHeader";
import { GlowCard } from "./GlowCard";

const valueKeys = ["table", "venue", "social", "partners"] as const;

export function ValuesSection() {
  const t = useTranslations("values");

  return (
    <SectionShell background="cream">
      <SectionHeader eyebrow={t("eyebrow")} title={t("title")} align="center" />

      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {valueKeys.map((key, index) => (
          <Reveal key={key} delay={index * 0.06}>
            <GlowCard as="article" className="rounded-3xl border border-border bg-surface p-6">
              <p className="text-sm font-bold text-honey">{t(`items.${key}.number`)}</p>
              <h3 className="mt-3 text-2xl font-bold text-foreground">
                {t(`items.${key}.title`)}
              </h3>
              <p className="mt-3 leading-relaxed text-text-secondary">
                {t(`items.${key}.body`)}
              </p>
            </GlowCard>
          </Reveal>
        ))}
      </div>
    </SectionShell>
  );
}

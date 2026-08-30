"use client";

import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useMotionSafe } from "@/lib/motion";
import { SectionHeader, SectionShell } from "./SectionHeader";
import { GlowCard } from "./GlowCard";

const stepKeys = ["arrive", "play", "earn", "return"] as const;

export function VisitStepsSection() {
  const t = useTranslations("visitSteps");
  const { reduced } = useMotionSafe();

  return (
    <SectionShell background="surface">
      <SectionHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        subtitle={t("subtitle")}
      />

      <div className="relative mt-12">
        <motion.div
          className="landing-timeline-line absolute left-[12.5%] top-6 hidden h-[calc(100%-3rem)] w-0.5 origin-top rounded-full lg:block"
          initial={reduced ? false : { scaleY: 0 }}
          whileInView={{ scaleY: 1 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />

        <ol className="grid gap-6 lg:grid-cols-4">
          {stepKeys.map((key, index) => (
            <GlowCard
              as="li"
              key={key}
              scrollGlance
              className="rounded-3xl border border-border bg-background p-6"
            >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary-muted text-sm font-bold text-primary">
                  {index + 1}
                </span>
                <h3 className="mt-4 text-xl font-bold text-foreground">
                  {t(`steps.${key}.title`)}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                  {t(`steps.${key}.body`)}
                </p>
              </GlowCard>
          ))}
        </ol>
      </div>
    </SectionShell>
  );
}

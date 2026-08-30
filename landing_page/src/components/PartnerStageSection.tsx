"use client";

import { useTranslations } from "next-intl";
import { partnerVenueSlots } from "@/lib/config";
import { Reveal } from "./Reveal";
import { SectionHeader, SectionShell } from "./SectionHeader";
import { GlowCard } from "./GlowCard";
import { LandingButton } from "./LandingButton";

export function PartnerStageSection() {
  const t = useTranslations("partnerStage");

  return (
    <SectionShell background="surface">
      <SectionHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        subtitle={t("subtitle")}
        align="center"
      />

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {partnerVenueSlots.map((slot, index) => (
          <Reveal key={slot.id} delay={index * 0.06}>
            <GlowCard scrollGlance className="flex h-full min-h-[180px] flex-col justify-between rounded-3xl border border-border bg-background p-5">
              <span className="text-sm font-bold text-text-muted">{slot.id}</span>
              <div>
                <p className="text-lg font-bold text-foreground">
                  {slot.status === "pilot" ? t("pilotLabel") : t("openLabel")}
                </p>
                {slot.status === "pilot" ? (
                  <p className="mt-2 text-sm text-text-secondary">Sarajevo pilot</p>
                ) : null}
              </div>
            </GlowCard>
          </Reveal>
        ))}
      </div>

      <Reveal className="mt-10 flex justify-center" delay={0.2}>
        <LandingButton href="/partners" variant="secondary">
          {t("cta")}
        </LandingButton>
      </Reveal>
    </SectionShell>
  );
}

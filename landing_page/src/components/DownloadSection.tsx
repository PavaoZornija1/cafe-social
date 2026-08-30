"use client";

import { useTranslations } from "next-intl";
import { Reveal } from "./Reveal";
import { SectionHeader, SectionShell } from "./SectionHeader";
import { StoreBadges } from "./StoreBadges";
import { LandingButton } from "./LandingButton";

export function DownloadSection() {
  const t = useTranslations("download");

  return (
    <SectionShell id="download" background="muted">
      <SectionHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        subtitle={t("subtitle")}
        align="center"
      />

      <Reveal className="mt-10 flex flex-col items-center gap-6" delay={0.08}>
        <StoreBadges className="justify-center" />
        <LandingButton href="/partners" variant="ghost">
          {t("partnerLink")} →
        </LandingButton>
      </Reveal>
    </SectionShell>
  );
}

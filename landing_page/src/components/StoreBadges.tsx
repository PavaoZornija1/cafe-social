"use client";

import { useTranslations } from "next-intl";
import { siteConfig } from "@/lib/config";

export function StoreBadges({ className = "" }: { className?: string }) {
  const t = useTranslations("download");
  const hasAppStore = Boolean(siteConfig.appStoreUrl);
  const hasPlayStore = Boolean(siteConfig.playStoreUrl);

  const badgeClass =
    "landing-card inline-flex min-w-[168px] items-center justify-center rounded-2xl border border-border bg-surface px-5 py-3 text-sm font-semibold shadow-landing-card transition";

  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      {hasAppStore ? (
        <a href={siteConfig.appStoreUrl} className={badgeClass} target="_blank" rel="noreferrer">
          {t("appStore")}
        </a>
      ) : (
        <span className={`${badgeClass} cursor-not-allowed opacity-70`} aria-disabled="true">
          {t("appStore")} · {t("comingSoon")}
        </span>
      )}
      {hasPlayStore ? (
        <a href={siteConfig.playStoreUrl} className={badgeClass} target="_blank" rel="noreferrer">
          {t("playStore")}
        </a>
      ) : (
        <span className={`${badgeClass} cursor-not-allowed opacity-70`} aria-disabled="true">
          {t("playStore")} · {t("comingSoon")}
        </span>
      )}
    </div>
  );
}

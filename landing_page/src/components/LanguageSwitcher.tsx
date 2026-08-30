"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { localeLabels, type Locale, routing } from "@/i18n/routing";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();

  return (
    <label className={`inline-flex items-center gap-2 ${compact ? "text-sm" : ""}`}>
      {!compact ? (
        <span className="sr-only">Language</span>
      ) : null}
      <select
        aria-label="Language"
        value={locale}
        onChange={(event) => {
          const nextLocale = event.target.value as Locale;
          router.replace(pathname, { locale: nextLocale });
        }}
        className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground shadow-sm outline-none transition hover:border-primary/30 focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        {routing.locales.map((code) => (
          <option key={code} value={code}>
            {localeLabels[code]}
          </option>
        ))}
      </select>
    </label>
  );
}

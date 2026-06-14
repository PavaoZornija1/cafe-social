import { de, enUS, es, hr, type Locale } from "date-fns/locale";
import { registerLocale } from "react-datepicker";
import { isAppLanguage, type AppLanguage } from "./types";

const ADMIN_DATE_FNS_LOCALES: Record<AppLanguage, Locale> = {
  en: enUS,
  de,
  es,
  hr,
};

for (const [code, locale] of Object.entries(ADMIN_DATE_FNS_LOCALES) as [AppLanguage, Locale][]) {
  registerLocale(code, locale);
}

/** Map active i18n language to a registered react-datepicker / date-fns locale code. */
export function adminDatePickerLocale(language: string): AppLanguage {
  const base = language.split("-")[0]?.toLowerCase() ?? "en";
  return isAppLanguage(base) ? base : "en";
}

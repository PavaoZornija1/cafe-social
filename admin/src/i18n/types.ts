export type AppLanguage = "en" | "de" | "es" | "hr";

export const LANGUAGE_OPTIONS: { code: AppLanguage; nativeName: string }[] = [
  { code: "en", nativeName: "English" },
  { code: "de", nativeName: "Deutsch" },
  { code: "es", nativeName: "Español" },
  { code: "hr", nativeName: "Hrvatski" },
];

export function isAppLanguage(code: string): code is AppLanguage {
  return (["en", "de", "es", "hr"] as const).includes(code as AppLanguage);
}

import deApp from "../../../app/src/i18n/locales/de.json";
import enApp from "../../../app/src/i18n/locales/en.json";
import esApp from "../../../app/src/i18n/locales/es.json";
import hrApp from "../../../app/src/i18n/locales/hr.json";
import deOverlay from "./overlays/de.json";
import enOverlay from "./overlays/en.json";
import esOverlay from "./overlays/es.json";
import hrOverlay from "./overlays/hr.json";
import { ADMIN_LOCALE_STORAGE_KEY } from "./constants";
import type { AppLanguage } from "./types";
import { isAppLanguage } from "./types";

function merge(
  app: Record<string, unknown>,
  admin: Record<string, unknown>,
): Record<string, unknown> {
  return { ...app, admin };
}

export function buildResources() {
  return {
    en: { translation: merge(enApp as Record<string, unknown>, enOverlay as Record<string, unknown>) },
    de: { translation: merge(deApp as Record<string, unknown>, deOverlay as Record<string, unknown>) },
    es: { translation: merge(esApp as Record<string, unknown>, esOverlay as Record<string, unknown>) },
    hr: { translation: merge(hrApp as Record<string, unknown>, hrOverlay as Record<string, unknown>) },
  } as const;
}

export function getInitialAdminLanguage(): AppLanguage {
  if (typeof window === "undefined") return "en";
  try {
    const saved = localStorage.getItem(ADMIN_LOCALE_STORAGE_KEY);
    if (saved && isAppLanguage(saved)) return saved;
    const nav = navigator.language.split("-")[0]?.toLowerCase() ?? "en";
    if (isAppLanguage(nav)) return nav;
  } catch {
    /* ignore */
  }
  return "en";
}

export async function persistAdminLanguage(code: AppLanguage): Promise<void> {
  if (typeof window === "undefined") return;
  localStorage.setItem(ADMIN_LOCALE_STORAGE_KEY, code);
}

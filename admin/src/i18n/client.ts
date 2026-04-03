"use client";

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { buildResources, getInitialAdminLanguage } from "./resources";

let initPromise: Promise<unknown> | null = null;

/** Single init for the browser — same languages + keys as mobile, plus `admin.*` portal overlay. */
export function ensureAdminI18n(): Promise<void> {
  if (i18n.isInitialized) return Promise.resolve();
  if (!initPromise) {
    initPromise = i18n.use(initReactI18next).init({
      resources: buildResources() as unknown as Record<
        string,
        { translation: Record<string, unknown> }
      >,
      lng: getInitialAdminLanguage(),
      fallbackLng: "en",
      interpolation: { escapeValue: false },
      compatibilityJSON: "v4",
    });
  }
  return initPromise.then(() => undefined);
}

export default i18n;

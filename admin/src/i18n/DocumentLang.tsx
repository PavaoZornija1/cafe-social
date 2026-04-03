"use client";

import { useEffect } from "react";
import { useTranslation } from "react-i18next";

/** Keeps `<html lang>` in sync with the active admin locale. */
export function DocumentLang() {
  const { i18n } = useTranslation();
  useEffect(() => {
    const base = i18n.language?.split("-")[0]?.toLowerCase() || "en";
    document.documentElement.lang = base;
  }, [i18n.language]);
  return null;
}

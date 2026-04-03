"use client";

import { useTranslation } from "react-i18next";
import { LANGUAGE_OPTIONS, type AppLanguage } from "./types";
import { setAdminLanguage } from "./adminLanguage";

export function AdminLanguageSelect() {
  const { t, i18n } = useTranslation();
  return (
    <label className="block text-[11px] text-slate-600 mb-2">
      <span className="font-medium text-slate-700">{t("admin.shell.language")}</span>
      <select
        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900"
        value={i18n.language.split("-")[0] as AppLanguage}
        onChange={(e) => {
          const code = e.target.value as AppLanguage;
          void setAdminLanguage(code);
        }}
      >
        {LANGUAGE_OPTIONS.map((o) => (
          <option key={o.code} value={o.code}>
            {o.nativeName}
          </option>
        ))}
      </select>
    </label>
  );
}

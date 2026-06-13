"use client";

import { useTranslation } from "react-i18next";
import { LANGUAGE_OPTIONS, type AppLanguage } from "./types";
import { setAdminLanguage } from "./adminLanguage";

type AdminLanguageSelectProps = {
  /** Stacked label + select (sidebar). Inline row for top header bars. */
  variant?: "default" | "compact";
};

export function AdminLanguageSelect({ variant = "default" }: AdminLanguageSelectProps) {
  const { t, i18n } = useTranslation();
  const select = (
    <select
      className={
        variant === "compact"
          ? "h-9 min-w-[6.5rem] rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900"
          : "mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900"
      }
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
  );

  if (variant === "compact") {
    return (
      <label className="flex items-center gap-2 shrink-0">
        <span className="text-[11px] font-medium text-slate-600 whitespace-nowrap">
          {t("admin.shell.language")}
        </span>
        {select}
      </label>
    );
  }

  return (
    <label className="block text-[11px] text-slate-600 mb-2">
      <span className="font-medium text-slate-700">{t("admin.shell.language")}</span>
      {select}
    </label>
  );
}

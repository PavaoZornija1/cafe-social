"use client";

import { useTranslation } from "react-i18next";
import {
  dispatchPortalVenueContextChanged,
  setStoredPortalVenueContext,
} from "@/lib/portalVenueContext";
import { useSuperAdminVenuePickerQuery } from "@/lib/queries";

export function SuperAdminVenuePicker({
  getToken,
  actingVenueId,
  onChanged,
}: {
  getToken: () => Promise<string | null>;
  actingVenueId: string | null;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const q = useSuperAdminVenuePickerQuery(getToken, true);

  return (
    <div className="rounded-xl border border-amber-200/90 bg-amber-50/50 px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-900 mb-1">
        {t("admin.picker.title")}
      </p>
      <label className="block text-xs text-slate-700">
        {t("admin.picker.label")}
        <select
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900"
          value={actingVenueId ?? ""}
          disabled={q.isPending}
          onChange={(e) => {
            const v = e.target.value.trim();
            setStoredPortalVenueContext(v || null);
            dispatchPortalVenueContextChanged();
            onChanged();
          }}
        >
          <option value="">{t("admin.picker.placeholder")}</option>
          {(q.data ?? []).map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
              {v.city ? ` · ${v.city}` : ""}
              {v.country ? ` (${v.country})` : ""}
            </option>
          ))}
        </select>
      </label>
      <p className="text-[11px] text-slate-600 mt-2 leading-snug">{t("admin.picker.hint")}</p>
    </div>
  );
}

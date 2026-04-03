"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  dispatchPortalVenueContextChanged,
  setStoredPortalVenueContext,
} from "@/lib/portalVenueContext";
import { portalFetch } from "@/lib/portalApi";

type VenueOption = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
};

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
  const [options, setOptions] = useState<VenueOption[]>([]);

  const loadOptions = useCallback(async () => {
    try {
      const rows = await portalFetch<VenueOption[]>(
        getToken,
        "/owner/super-admin/venue-picker",
        { method: "GET" },
      );
      setOptions(rows);
    } catch {
      setOptions([]);
    }
  }, [getToken]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

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
          onChange={(e) => {
            const v = e.target.value.trim();
            setStoredPortalVenueContext(v || null);
            dispatchPortalVenueContextChanged();
            onChanged();
          }}
        >
          <option value="">{t("admin.picker.placeholder")}</option>
          {options.map((v) => (
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

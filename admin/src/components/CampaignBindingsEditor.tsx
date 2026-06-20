"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type OwnerCampaignBindingRow,
  useOwnerAddCampaignBindingMutation,
  useOwnerCampaignBindingsQuery,
  useOwnerDeleteCampaignBindingMutation,
  useVenueChallengesQuery,
  useVenueOffersQuery,
  useVenuePerksQuery,
} from "@/lib/queries";

const CAMPAIGN_BINDING_TYPES = ["CHALLENGE", "VENUE_PERK", "VENUE_OFFER"] as const;

type BindingType = (typeof CAMPAIGN_BINDING_TYPES)[number];

type EntityOption = { id: string; label: string };

type Props = {
  venueId: string;
  campaignId: string;
  getToken: () => Promise<string | null>;
  readOnlyDisabled: boolean;
};

export function CampaignBindingsEditor({
  venueId,
  campaignId,
  getToken,
  readOnlyDisabled,
}: Props) {
  const { t } = useTranslation();
  const bindingsQ = useOwnerCampaignBindingsQuery(venueId, campaignId, getToken, true);
  const perksQ = useVenuePerksQuery(venueId, getToken, true);
  const offersQ = useVenueOffersQuery(venueId, getToken, true);
  const challengesQ = useVenueChallengesQuery(venueId, getToken, true);
  const addMut = useOwnerAddCampaignBindingMutation(venueId, campaignId, getToken);
  const delMut = useOwnerDeleteCampaignBindingMutation(venueId, campaignId, getToken);
  const [entityType, setEntityType] = useState<BindingType>("CHALLENGE");
  const [entityId, setEntityId] = useState("");

  const rows = bindingsQ.data ?? [];

  const entityOptions = useMemo((): EntityOption[] => {
    switch (entityType) {
      case "VENUE_PERK":
        return (perksQ.data ?? []).map((p) => ({
          id: p.id,
          label: `${p.code} — ${p.title}`,
        }));
      case "VENUE_OFFER":
        return (offersQ.data ?? []).map((o) => ({
          id: o.id,
          label: o.title,
        }));
      case "CHALLENGE":
        return (challengesQ.data ?? []).map((c) => ({
          id: c.id,
          label: c.title,
        }));
      default:
        return [];
    }
  }, [entityType, perksQ.data, offersQ.data, challengesQ.data]);

  const entitiesLoading =
    (entityType === "VENUE_PERK" && perksQ.isPending) ||
    (entityType === "VENUE_OFFER" && offersQ.isPending) ||
    (entityType === "CHALLENGE" && challengesQ.isPending);

  const boundEntityLabel = (row: OwnerCampaignBindingRow): string | null => {
    const type = row.entityType as BindingType;
    if (type === "VENUE_PERK") {
      const p = perksQ.data?.find((x) => x.id === row.entityId);
      return p ? `${p.code} — ${p.title}` : null;
    }
    if (type === "VENUE_OFFER") {
      return offersQ.data?.find((x) => x.id === row.entityId)?.title ?? null;
    }
    if (type === "CHALLENGE") {
      return challengesQ.data?.find((x) => x.id === row.entityId)?.title ?? null;
    }
    return null;
  };

  return (
    <div className="border-t border-slate-200 bg-slate-50 p-4 space-y-3 text-sm">
      <p className="text-xs text-slate-600">{t("admin.partnerVenueDetail.bindings.lead")}</p>
      {bindingsQ.isPending ? (
        <p className="text-slate-500">{t("admin.partnerVenueDetail.bindings.loadingBindings")}</p>
      ) : null}
      {bindingsQ.isError && bindingsQ.error instanceof Error ? (
        <p className="text-red-700 text-xs">{bindingsQ.error.message}</p>
      ) : null}
      {rows.length === 0 && !bindingsQ.isPending ? (
        <p className="text-xs text-slate-500">{t("admin.partnerVenueDetail.bindings.noBindings")}</p>
      ) : null}
      <ul className="space-y-1">
        {rows.map((b: OwnerCampaignBindingRow) => {
          const label = boundEntityLabel(b);
          return (
            <li
              key={b.id}
              className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-800"
            >
              <span>
                <span className="font-medium">
                  {t(`admin.partnerVenueDetail.bindings.types.${b.entityType as BindingType}`)}
                </span>
                {label ? (
                  <span className="ml-1 text-slate-700">{label}</span>
                ) : (
                  <code className="ml-1 bg-white px-1 rounded border border-slate-200">
                    {b.entityId}
                  </code>
                )}
              </span>
              <button
                type="button"
                disabled={readOnlyDisabled || delMut.isPending}
                className="text-red-700 hover:underline disabled:opacity-50"
                onClick={() => void delMut.mutateAsync(b.id)}
              >
                {t("admin.partnerVenueDetail.bindings.remove")}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap gap-2 items-end pt-2 border-t border-slate-200">
        <label className="text-xs text-slate-600 flex flex-col gap-1">
          {t("admin.partnerVenueDetail.bindings.type")}
          <select
            className="border border-slate-300 rounded px-2 py-1 text-sm bg-white"
            value={entityType}
            disabled={readOnlyDisabled}
            onChange={(e) => {
              setEntityType(e.target.value as BindingType);
              setEntityId("");
            }}
          >
            {CAMPAIGN_BINDING_TYPES.map((bt) => (
              <option key={bt} value={bt}>
                {t(`admin.partnerVenueDetail.bindings.types.${bt}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-600 flex flex-col gap-1 min-w-[200px] flex-1">
          {t("admin.partnerVenueDetail.bindings.selectEntity")}
          <select
            className="border border-slate-300 rounded px-2 py-1 text-sm bg-white"
            value={entityId}
            disabled={readOnlyDisabled || entitiesLoading}
            onChange={(e) => setEntityId(e.target.value)}
          >
            <option value="">
              {entitiesLoading
                ? t("admin.partnerVenueDetail.bindings.loadingEntities")
                : t("admin.partnerVenueDetail.bindings.selectEntityPlaceholder")}
            </option>
            {entityOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={readOnlyDisabled || addMut.isPending || !entityId}
          className="bg-brand text-white text-sm px-3 py-2 rounded-lg disabled:opacity-50"
          onClick={() => {
            void addMut.mutateAsync({ entityType, entityId }).then(() => setEntityId(""));
          }}
        >
          {t("admin.partnerVenueDetail.bindings.addBinding")}
        </button>
      </div>
    </div>
  );
}

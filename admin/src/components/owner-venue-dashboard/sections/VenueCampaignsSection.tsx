"use client";

import { useForm } from "@tanstack/react-form";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CampaignBindingsEditor } from "@/components/CampaignBindingsEditor";
import { TableRowCards } from "@/components/TableRowCards";
import { getCampaignCopyTemplates } from "@/lib/campaignCopyTemplates";
import {
  type OwnerVenueCampaignRow,
  useOwnerCreateCampaignMutation,
  useOwnerSendCampaignMutation,
  useOwnerVenueCampaignsQuery,
} from "@/lib/queries";
import { useOwnerVenueDashboard } from "../OwnerVenueDashboardContext";

const campaignCol = createColumnHelper<OwnerVenueCampaignRow>();

export function VenueCampaignsSection() {
  const { t } = useTranslation();
  const {
    venueId,
    getToken,
    isLoaded,
    metaRow,
    canAnalytics,
    readOnlyDisabled,
    setBannerError,
  } = useOwnerVenueDashboard();

  const [bindingsCampaignId, setBindingsCampaignId] = useState<string | null>(null);

  const campaignCopyTemplates = useMemo(() => getCampaignCopyTemplates(t), [t]);

  const campaignsQ = useOwnerVenueCampaignsQuery(
    venueId,
    getToken,
    Boolean(isLoaded && metaRow && canAnalytics),
  );
  const createCampMut = useOwnerCreateCampaignMutation(venueId, getToken);
  const sendCampMut = useOwnerSendCampaignMutation(venueId, getToken);
  const campaignForm = useForm({
    defaultValues: {
      name: "",
      title: "",
      body: "",
      segmentDays: 30,
    },
    onSubmit: async ({ value, formApi }) => {
      setBannerError(null);
      await createCampMut.mutateAsync({
        name: value.name,
        title: value.title,
        body: value.body,
        segmentDays: value.segmentDays,
      });
      formApi.reset();
    },
  });

  const campaigns = campaignsQ.data ?? [];

  const campaignColumns = useMemo(
    () => [
      campaignCol.display({
        id: "info",
        header: t("admin.partnerVenueDetail.campaigns.campaign"),
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-slate-800">{row.original.name}</p>
            <p className="text-xs text-slate-500">
              {t("admin.partnerVenueDetail.campaigns.campaignStatusSegment", {
                status: row.original.status,
                days: row.original.segmentDays,
              })}
              {row.original.recipientCount != null
                ? t("admin.partnerVenueDetail.campaigns.campaignRecipients", {
                    count: row.original.recipientCount,
                  })
                : ""}
            </p>
            {row.original.lastError ? (
              <p className="text-xs text-red-600 mt-1">{row.original.lastError}</p>
            ) : null}
          </div>
        ),
      }),
      campaignCol.display({
        id: "send",
        header: "",
        cell: ({ row }) =>
          row.original.status !== "COMPLETED" ? (
            <button
              type="button"
              disabled={readOnlyDisabled || sendCampMut.isPending}
              onClick={() => void sendCampMut.mutateAsync(row.original.id)}
              className="text-sm bg-amber-50 border border-amber-300 text-amber-900 px-3 py-1 rounded-lg disabled:opacity-50"
            >
              {t("admin.partnerVenueDetail.campaigns.sendNow")}
            </button>
          ) : (
            <span className="text-xs text-slate-500">
              {t("admin.partnerVenueDetail.common.statusSent")}
            </span>
          ),
      }),
      campaignCol.display({
        id: "bindings",
        header: "",
        cell: ({ row }) => (
          <button
            type="button"
            className="text-sm text-brand"
            onClick={() =>
              setBindingsCampaignId((prev) =>
                prev === row.original.id ? null : row.original.id,
              )
            }
          >
            {bindingsCampaignId === row.original.id
              ? t("admin.partnerVenueDetail.campaigns.hideBindings")
              : t("admin.partnerVenueDetail.campaigns.bindings")}
          </button>
        ),
      }),
    ],
    [readOnlyDisabled, sendCampMut, bindingsCampaignId, t],
  );

  const campaignTable = useReactTable({
    data: campaigns,
    columns: campaignColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (r) => r.id,
  });

  if (!metaRow) return null;

  return (
    <section className="border border-slate-200 rounded-xl p-4 space-y-4 scroll-mt-24">
                <h2 className="text-lg font-medium">{t("admin.partnerVenueDetail.campaigns.title")}</h2>
                <p className="text-xs text-slate-500">
                  {t("admin.partnerVenueDetail.campaigns.lead")}
                </p>
                <p className="text-xs text-slate-600">
                  {t("admin.partnerVenueDetail.campaigns.orderNudgeLead")}
                </p>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-medium text-slate-700 mb-2">
                    {t("admin.partnerVenueDetail.campaigns.suggestedCopyTitle")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {campaignCopyTemplates.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        disabled={readOnlyDisabled}
                        onClick={() => {
                          campaignForm.setFieldValue("name", tpl.name);
                          campaignForm.setFieldValue("title", tpl.title);
                          campaignForm.setFieldValue("body", tpl.body);
                          campaignForm.setFieldValue("segmentDays", tpl.segmentDays);
                        }}
                        className="text-xs border border-slate-300 rounded-full px-3 py-1 bg-white hover:bg-slate-100 disabled:opacity-50"
                      >
                        {tpl.label}
                      </button>
                    ))}
                  </div>
                </div>
                <form
                  className="grid gap-2 sm:grid-cols-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void campaignForm.handleSubmit();
                  }}
                >
                  <campaignForm.Field name="name">
                    {(field) => (
                      <input
                        disabled={readOnlyDisabled}
                        className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm disabled:opacity-60"
                        placeholder={t("admin.partnerVenueDetail.campaigns.internalNamePlaceholder")}
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                      />
                    )}
                  </campaignForm.Field>
                  <campaignForm.Field name="segmentDays">
                    {(field) => (
                      <input
                        type="number"
                        min={1}
                        max={365}
                        disabled={readOnlyDisabled}
                        className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm disabled:opacity-60"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(Number(e.target.value))}
                        onBlur={field.handleBlur}
                      />
                    )}
                  </campaignForm.Field>
                  <campaignForm.Field name="title">
                    {(field) => (
                      <input
                        disabled={readOnlyDisabled}
                        className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm sm:col-span-2 disabled:opacity-60"
                        placeholder={t("admin.partnerVenueDetail.campaigns.notificationTitlePlaceholder")}
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                      />
                    )}
                  </campaignForm.Field>
                  <campaignForm.Field name="body">
                    {(field) => (
                      <textarea
                        disabled={readOnlyDisabled}
                        className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-[80px] sm:col-span-2 disabled:opacity-60"
                        placeholder={t("admin.partnerVenueDetail.campaigns.notificationBodyPlaceholder")}
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                      />
                    )}
                  </campaignForm.Field>
                  <button
                    type="submit"
                    disabled={readOnlyDisabled || createCampMut.isPending}
                    className="bg-brand hover:bg-brand-hover disabled:opacity-50 rounded-lg px-4 py-2 text-sm font-semibold sm:col-span-2 justify-self-start"
                  >
                    {t("admin.partnerVenueDetail.campaigns.saveDraft")}
                  </button>
                </form>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  {campaigns.length === 0 ? (
                    <p className="p-4 text-slate-500 text-sm">
                      {t("admin.partnerVenueDetail.campaigns.noCampaigns")}
                    </p>
                  ) : (
                    <>
                      <TableRowCards
                        rows={campaignTable.getRowModel().rows}
                        leadCellId="info"
                        actionCellIds={["send", "bindings"]}
                      />
                      <div className="hidden md:block">
                        <table className="w-full text-sm">
                          <tbody>
                            {campaignTable.getRowModel().rows.map((row) => (
                              <tr
                                key={row.id}
                                className="border-b border-slate-200 last:border-0 bg-brand-light/60"
                              >
                                {row.getVisibleCells().map((cell) => (
                                  <td key={cell.id} className="p-3">
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {bindingsCampaignId ? (
                        <CampaignBindingsEditor
                          key={bindingsCampaignId}
                          venueId={venueId}
                          campaignId={bindingsCampaignId}
                          getToken={getToken}
                          readOnlyDisabled={readOnlyDisabled}
                        />
                      ) : null}
                    </>
                  )}
                </div>
              </section>
  );
}

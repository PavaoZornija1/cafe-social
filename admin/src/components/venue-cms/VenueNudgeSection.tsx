"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type AdminNudgeTemplateRow,
  useAdminNudgeTemplateCreateMutation,
  useAdminNudgeTemplatePatchMutation,
  useAdminNudgeTemplatesQuery,
  useVenueNudgeAssignmentCreateMutation,
  useVenueNudgeAssignmentDeleteMutation,
  useVenueNudgeAssignmentPatchMutation,
  useVenueNudgeAssignmentsQuery,
  useVenueNudgeTriggerMutation,
} from "@/lib/queries";

type Props = {
  venueId: string;
  getToken: () => Promise<string | null>;
  enabled: boolean;
  isSuperAdmin: boolean;
};

const fieldCol = "flex min-w-0 flex-col gap-1.5";
const fieldLbl = "text-xs font-semibold uppercase tracking-wide text-slate-500";
const fieldInp =
  "w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";
const btnPrimary =
  "rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-900 disabled:opacity-50";
const btnBrand =
  "rounded-lg bg-brand px-3 py-2 text-sm font-medium text-brand-foreground shadow-sm transition-colors disabled:opacity-50";
const btnGhost =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50";

export function VenueNudgeSection({ venueId, getToken, enabled, isSuperAdmin }: Props) {
  const { t } = useTranslation();
  const templatesQ = useAdminNudgeTemplatesQuery(getToken, enabled);
  const assignmentsQ = useVenueNudgeAssignmentsQuery(venueId, getToken, enabled);

  const createTplMut = useAdminNudgeTemplateCreateMutation(getToken);
  const patchTplMut = useAdminNudgeTemplatePatchMutation(getToken);
  const createAsmMut = useVenueNudgeAssignmentCreateMutation(venueId, getToken);
  const patchAsmMut = useVenueNudgeAssignmentPatchMutation(venueId, getToken);
  const deleteAsmMut = useVenueNudgeAssignmentDeleteMutation(venueId, getToken);
  const triggerMut = useVenueNudgeTriggerMutation(venueId, getToken);

  const [tplErr, setTplErr] = useState<string | null>(null);
  const [asmErr, setAsmErr] = useState<string | null>(null);
  const [triggerMsg, setTriggerMsg] = useState<string | null>(null);

  const [newTpl, setNewTpl] = useState({
    code: "",
    nudgeType: "ORDER_DRINK",
    titleTemplate: "Still at {{venueName}}?",
    bodyTemplate: "Order something from the menu while you’re here.",
    description: "",
    defaultAfterMinutes: "" as string,
    sortPriority: "100",
  });

  const [editTplId, setEditTplId] = useState<string | null>(null);
  const [editTplDraft, setEditTplDraft] = useState({
    nudgeType: "",
    titleTemplate: "",
    bodyTemplate: "",
    description: "",
    defaultAfterMinutes: "" as string,
    sortPriority: "",
    active: true,
  });

  const [attachDraft, setAttachDraft] = useState({
    templateId: "",
    sortOrder: "100",
    titleOverride: "",
    bodyOverride: "",
    afterMinutesOverride: "" as string,
  });

  const [editAsmId, setEditAsmId] = useState<string | null>(null);
  const [editAsmDraft, setEditAsmDraft] = useState({
    sortOrder: "",
    titleOverride: "",
    bodyOverride: "",
    afterMinutesOverride: "" as string,
    enabled: true,
  });

  const templates = templatesQ.data ?? [];
  const assignments = assignmentsQ.data ?? [];

  const unassignedTemplates = useMemo(() => {
    const tpl = templatesQ.data ?? [];
    const asm = assignmentsQ.data ?? [];
    const used = new Set(asm.map((a) => a.templateId));
    return tpl.filter((t) => t.active && !used.has(t.id));
  }, [templatesQ.data, assignmentsQ.data]);

  // Partners can attach/customize nudges but cannot author templates (super-admin only).
  // When nothing is attachable, show a managed-by note instead of an empty picker.
  const partnerNoAttachable = !isSuperAdmin && unassignedTemplates.length === 0;

  const startEditTpl = (t: AdminNudgeTemplateRow) => {
    setEditTplId(t.id);
    setEditTplDraft({
      nudgeType: t.nudgeType,
      titleTemplate: t.titleTemplate,
      bodyTemplate: t.bodyTemplate,
      description: t.description ?? "",
      defaultAfterMinutes: t.defaultAfterMinutes != null ? String(t.defaultAfterMinutes) : "",
      sortPriority: String(t.sortPriority),
      active: t.active,
    });
    setTplErr(null);
  };

  const saveTpl = async () => {
    if (!editTplId) return;
    setTplErr(null);
    try {
      await patchTplMut.mutateAsync({
        id: editTplId,
        body: {
          nudgeType: editTplDraft.nudgeType.trim(),
          titleTemplate: editTplDraft.titleTemplate.trim(),
          bodyTemplate: editTplDraft.bodyTemplate.trim(),
          description: editTplDraft.description.trim() || null,
          defaultAfterMinutes:
            editTplDraft.defaultAfterMinutes.trim() === ""
              ? null
              : Number(editTplDraft.defaultAfterMinutes),
          sortPriority: Number(editTplDraft.sortPriority) || 100,
          active: editTplDraft.active,
        },
      });
      setEditTplId(null);
    } catch (e) {
      setTplErr((e as Error).message);
    }
  };

  const createTpl = async () => {
    setTplErr(null);
    try {
      await createTplMut.mutateAsync({
        code: newTpl.code.trim(),
        nudgeType: newTpl.nudgeType.trim(),
        titleTemplate: newTpl.titleTemplate.trim(),
        bodyTemplate: newTpl.bodyTemplate.trim(),
        description: newTpl.description.trim() || null,
        defaultAfterMinutes:
          newTpl.defaultAfterMinutes.trim() === "" ? null : Number(newTpl.defaultAfterMinutes),
        sortPriority: Number(newTpl.sortPriority) || 100,
        active: true,
      });
      setNewTpl({
        code: "",
        nudgeType: "ORDER_DRINK",
        titleTemplate: "Still at {{venueName}}?",
        bodyTemplate: "Order something from the menu while you’re here.",
        description: "",
        defaultAfterMinutes: "",
        sortPriority: "100",
      });
    } catch (e) {
      setTplErr((e as Error).message);
    }
  };

  const submitAttach = async () => {
    setAsmErr(null);
    if (!attachDraft.templateId) {
      setAsmErr(t("admin.venueCms.nudges.chooseTemplateError"));
      return;
    }
    try {
      await createAsmMut.mutateAsync({
        templateId: attachDraft.templateId,
        sortOrder: Number(attachDraft.sortOrder) || 100,
        titleOverride: attachDraft.titleOverride.trim() || null,
        bodyOverride: attachDraft.bodyOverride.trim() || null,
        afterMinutesOverride:
          attachDraft.afterMinutesOverride.trim() === ""
            ? null
            : Number(attachDraft.afterMinutesOverride),
        enabled: true,
      });
      setAttachDraft({
        templateId: "",
        sortOrder: "100",
        titleOverride: "",
        bodyOverride: "",
        afterMinutesOverride: "",
      });
    } catch (e) {
      setAsmErr((e as Error).message);
    }
  };

  const startEditAsm = (a: (typeof assignments)[0]) => {
    setEditAsmId(a.id);
    setEditAsmDraft({
      sortOrder: String(a.sortOrder),
      titleOverride: a.titleOverride ?? "",
      bodyOverride: a.bodyOverride ?? "",
      afterMinutesOverride:
        a.afterMinutesOverride != null ? String(a.afterMinutesOverride) : "",
      enabled: a.enabled,
    });
  };

  const saveAsm = async () => {
    if (!editAsmId) return;
    setAsmErr(null);
    try {
      await patchAsmMut.mutateAsync({
        assignmentId: editAsmId,
        body: {
          sortOrder: Number(editAsmDraft.sortOrder) || 100,
          titleOverride: editAsmDraft.titleOverride.trim() || null,
          bodyOverride: editAsmDraft.bodyOverride.trim() || null,
          afterMinutesOverride:
            editAsmDraft.afterMinutesOverride.trim() === ""
              ? null
              : Number(editAsmDraft.afterMinutesOverride),
          enabled: editAsmDraft.enabled,
        },
      });
      setEditAsmId(null);
    } catch (e) {
      setAsmErr((e as Error).message);
    }
  };

  const removeAsm = async (id: string) => {
    if (!confirm(t("admin.venueCms.nudges.removeConfirm"))) return;
    setAsmErr(null);
    try {
      await deleteAsmMut.mutateAsync(id);
    } catch (e) {
      setAsmErr((e as Error).message);
    }
  };

  const triggerNow = async (assignmentId: string) => {
    setTriggerMsg(null);
    setAsmErr(null);
    try {
      const r = await triggerMut.mutateAsync(assignmentId);
      setTriggerMsg(
        t("admin.venueCms.nudges.triggerResult", {
          attempted: r.pushAttemptedForPlayers,
          tokens: r.playersWithTokens,
        }),
      );
    } catch (e) {
      setAsmErr((e as Error).message);
    }
  };

  return (
    <section className="mb-8 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.04] md:p-6">
      <div className="space-y-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{t("admin.venueCms.nudges.title")}</h2>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
              {t("admin.venueCms.nudges.lead")}
            </p>
          </div>
          <span
            className={
              assignments.length > 0
                ? "inline-flex shrink-0 items-center rounded-full border border-slate-200/90 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700"
                : "inline-flex shrink-0 items-center rounded-full border border-slate-200/90 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500"
            }
          >
            {assignments.length === 0
              ? t("admin.venueCms.nudges.badgeNone")
              : t("admin.venueCms.nudges.badgeCount", { count: assignments.length })}
          </span>
        </div>

        <div className="rounded-xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-slate-900 shadow-sm">
          <p className="text-xs leading-relaxed text-amber-950">
            {t("admin.venueCms.nudges.autoExplainer")}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-amber-950/95">
            {t("admin.venueCms.nudges.triggerExplainer")}
          </p>
        </div>

        {isSuperAdmin ? (
          <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-4 shadow-sm md:p-5">
            <div className="space-y-5">
              <div>
                <h3 className={fieldLbl}>{t("admin.venueCms.nudges.libraryTitle")}</h3>
                <p className="mt-1 text-xs leading-snug text-slate-500">
                  {t("admin.venueCms.nudges.libraryLead")}
                </p>
              </div>
              {tplErr ? (
                <div
                  className="rounded-xl border border-red-200/90 bg-red-50/90 px-4 py-3 text-sm text-red-900"
                  role="alert"
                >
                  {tplErr}
                </div>
              ) : null}

              <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("admin.venueCms.nudges.newTemplate")}</p>
                <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className={fieldCol}>
                    <span className={fieldLbl}>{t("admin.venueCms.common.code")}</span>
                    <input
                      className={`${fieldInp} font-mono text-xs`}
                      value={newTpl.code}
                      onChange={(e) => setNewTpl((s) => ({ ...s, code: e.target.value }))}
                      placeholder={t("admin.venueCms.nudges.codePlaceholder")}
                    />
                  </label>
                  <label className={fieldCol}>
                    <span className={fieldLbl}>{t("admin.venueCms.nudges.nudgeTypeAnalytics")}</span>
                    <input
                      className={fieldInp}
                      value={newTpl.nudgeType}
                      onChange={(e) => setNewTpl((s) => ({ ...s, nudgeType: e.target.value }))}
                    />
                  </label>
                  <label className={`${fieldCol} sm:col-span-2`}>
                    <span className={fieldLbl}>{t("admin.venueCms.nudges.titleTemplate")}</span>
                    <input
                      className={fieldInp}
                      value={newTpl.titleTemplate}
                      onChange={(e) => setNewTpl((s) => ({ ...s, titleTemplate: e.target.value }))}
                    />
                  </label>
                  <label className={`${fieldCol} sm:col-span-2`}>
                    <span className={fieldLbl}>{t("admin.venueCms.nudges.bodyTemplate")}</span>
                    <textarea
                      className={`${fieldInp} min-h-[56px]`}
                      value={newTpl.bodyTemplate}
                      onChange={(e) => setNewTpl((s) => ({ ...s, bodyTemplate: e.target.value }))}
                    />
                  </label>
                  <label className={`${fieldCol} sm:col-span-2`}>
                    <span className={fieldLbl}>{t("admin.venueCms.nudges.descriptionInternal")}</span>
                    <input
                      className={fieldInp}
                      value={newTpl.description}
                      onChange={(e) => setNewTpl((s) => ({ ...s, description: e.target.value }))}
                    />
                  </label>
                  <label className={fieldCol}>
                    <span className={fieldLbl}>{t("admin.venueCms.nudges.defaultDwellMinutes")}</span>
                    <input
                      className={fieldInp}
                      value={newTpl.defaultAfterMinutes}
                      onChange={(e) => setNewTpl((s) => ({ ...s, defaultAfterMinutes: e.target.value }))}
                      placeholder={t("admin.venueCms.nudges.dwellPlaceholder")}
                    />
                  </label>
                  <label className={fieldCol}>
                    <span className={fieldLbl}>{t("admin.venueCms.nudges.sortPriority")}</span>
                    <input
                      className={fieldInp}
                      value={newTpl.sortPriority}
                      onChange={(e) => setNewTpl((s) => ({ ...s, sortPriority: e.target.value }))}
                    />
                  </label>
                </div>
                <button
                  type="button"
                  disabled={createTplMut.isPending}
                  onClick={() => void createTpl()}
                  className={`mt-4 h-[42px] ${btnPrimary}`}
                >
                  {createTplMut.isPending ? t("admin.venueCms.common.creating") : t("admin.venueCms.nudges.createTemplate")}
                </button>
              </div>

              <ul className="md:hidden space-y-3">
                {templates.map((tpl) => (
                  <li
                    key={tpl.id}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-2"
                  >
                    <p className="font-mono text-sm font-semibold text-slate-900">{tpl.code}</p>
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                      <span>
                        <span className="font-medium text-slate-500">{t("admin.venueCms.common.type")}</span>{" "}
                        {tpl.nudgeType}
                      </span>
                      <span>
                        <span className="font-medium text-slate-500">{t("admin.venueCms.common.active")}</span>{" "}
                        {tpl.active ? t("admin.venueCms.common.yes") : t("admin.venueCms.common.no")}
                      </span>
                      <span>
                        <span className="font-medium text-slate-500">{t("admin.venueCms.nudges.colDwellMin")}</span>{" "}
                        {tpl.defaultAfterMinutes ?? "—"} min
                      </span>
                      <span>
                        <span className="font-medium text-slate-500">{t("admin.venueCms.nudges.colVenues")}</span>{" "}
                        {tpl._count?.venueAssignments ?? "—"}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => startEditTpl(tpl)}
                      className="text-brand text-xs font-medium hover:underline pt-1"
                    >
                      {t("admin.venueCms.common.edit")}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-sm">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50/90">
                    <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2.5 pr-3">{t("admin.venueCms.common.code")}</th>
                      <th className="px-3 py-2.5 pr-3">{t("admin.venueCms.nudges.colType")}</th>
                      <th className="px-3 py-2.5 pr-3">{t("admin.venueCms.nudges.colActive")}</th>
                      <th className="px-3 py-2.5 pr-3">{t("admin.venueCms.nudges.colDwellMin")}</th>
                      <th className="px-3 py-2.5 pr-3">{t("admin.venueCms.nudges.colVenues")}</th>
                      <th className="px-3 py-2.5 pr-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {templates.map((tpl) => (
                      <tr key={tpl.id} className="border-b border-slate-100 align-top">
                        <td className="px-3 py-2.5 pr-3 font-mono text-xs">{tpl.code}</td>
                        <td className="px-3 py-2.5 pr-3 text-xs">{tpl.nudgeType}</td>
                        <td className="px-3 py-2.5 pr-3">
                          {tpl.active ? t("admin.venueCms.common.yes") : t("admin.venueCms.common.no")}
                        </td>
                        <td className="px-3 py-2.5 pr-3 tabular-nums">
                          {tpl.defaultAfterMinutes ?? "—"}
                        </td>
                        <td className="px-3 py-2.5 pr-3 tabular-nums">
                          {tpl._count?.venueAssignments ?? "—"}
                        </td>
                        <td className="px-3 py-2.5 pr-3">
                          <button
                            type="button"
                            onClick={() => startEditTpl(tpl)}
                            className="text-brand text-xs font-medium hover:underline"
                          >
                            {t("admin.venueCms.common.edit")}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {editTplId ? (
                <div className="rounded-xl border border-brand/25 bg-brand-light/25 p-4 shadow-sm md:p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    {t("admin.venueCms.nudges.editTemplate")}
                  </p>
                  <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className={fieldCol}>
                      <span className={fieldLbl}>{t("admin.venueCms.nudges.editNudgeType")}</span>
                      <input
                        className={fieldInp}
                        value={editTplDraft.nudgeType}
                        onChange={(e) =>
                          setEditTplDraft((s) => ({ ...s, nudgeType: e.target.value }))
                        }
                      />
                    </label>
                    <label className="inline-flex cursor-pointer items-center gap-2.5 self-end rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 shadow-sm sm:mb-0.5">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/30"
                        checked={editTplDraft.active}
                        onChange={(e) =>
                          setEditTplDraft((s) => ({ ...s, active: e.target.checked }))
                        }
                      />
                      {t("admin.venueCms.common.active")}
                    </label>
                    <label className={`${fieldCol} sm:col-span-2`}>
                      <span className={fieldLbl}>{t("admin.venueCms.common.title")}</span>
                      <input
                        className={fieldInp}
                        value={editTplDraft.titleTemplate}
                        onChange={(e) =>
                          setEditTplDraft((s) => ({ ...s, titleTemplate: e.target.value }))
                        }
                      />
                    </label>
                    <label className={`${fieldCol} sm:col-span-2`}>
                      <span className={fieldLbl}>{t("admin.venueCms.nudges.bodyTemplate")}</span>
                      <textarea
                        className={`${fieldInp} min-h-[56px]`}
                        value={editTplDraft.bodyTemplate}
                        onChange={(e) =>
                          setEditTplDraft((s) => ({ ...s, bodyTemplate: e.target.value }))
                        }
                      />
                    </label>
                    <label className={`${fieldCol} sm:col-span-2`}>
                      <span className={fieldLbl}>{t("admin.venueCms.nudges.descriptionShort")}</span>
                      <input
                        className={fieldInp}
                        value={editTplDraft.description}
                        onChange={(e) =>
                          setEditTplDraft((s) => ({ ...s, description: e.target.value }))
                        }
                      />
                    </label>
                    <label className={fieldCol}>
                      <span className={fieldLbl}>{t("admin.venueCms.nudges.defaultDwellMinutes")}</span>
                      <input
                        className={fieldInp}
                        value={editTplDraft.defaultAfterMinutes}
                        onChange={(e) =>
                          setEditTplDraft((s) => ({
                            ...s,
                            defaultAfterMinutes: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className={fieldCol}>
                      <span className={fieldLbl}>{t("admin.venueCms.nudges.sortPriority")}</span>
                      <input
                        className={fieldInp}
                        value={editTplDraft.sortPriority}
                        onChange={(e) =>
                          setEditTplDraft((s) => ({ ...s, sortPriority: e.target.value }))
                        }
                      />
                    </label>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={patchTplMut.isPending}
                      onClick={() => void saveTpl()}
                      className={btnBrand}
                    >
                      {patchTplMut.isPending ? t("admin.venueCms.common.saving") : t("admin.venueCms.nudges.saveTemplate")}
                    </button>
                    <button type="button" onClick={() => setEditTplId(null)} className={btnGhost}>
                      {t("admin.venueCms.common.cancel")}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-4 shadow-sm md:p-5">
          <div className="space-y-4">
            <div>
              <h3 className={fieldLbl}>{t("admin.venueCms.nudges.assignmentsTitle")}</h3>
              <p className="mt-1 text-xs leading-snug text-slate-500">
                {t("admin.venueCms.nudges.assignmentsLead")}
              </p>
            </div>
            {asmErr ? (
              <div
                className="rounded-xl border border-red-200/90 bg-red-50/90 px-4 py-3 text-sm text-red-900"
                role="alert"
              >
                {asmErr}
              </div>
            ) : null}
            {triggerMsg ? (
              <div
                className="rounded-xl border border-emerald-200/90 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-900"
                role="status"
              >
                {triggerMsg}
              </div>
            ) : null}

            {partnerNoAttachable ? (
              <div className="rounded-xl border border-slate-200/80 bg-white/90 px-4 py-4 text-xs leading-relaxed text-slate-600 shadow-sm">
                {t("admin.venueCms.nudges.partnerManagedEmpty")}
              </div>
            ) : (
            <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 shadow-sm">
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_5.5rem] sm:items-end">
                  <label className={fieldCol}>
                    <span className={fieldLbl}>{t("admin.venueCms.nudges.attachTemplate")}</span>
                    <select
                      className={fieldInp}
                      value={attachDraft.templateId}
                      onChange={(e) => setAttachDraft((s) => ({ ...s, templateId: e.target.value }))}
                    >
                      <option value="">{t("admin.venueCms.nudges.selectTemplate")}</option>
                      {unassignedTemplates.map((tpl) => (
                        <option key={tpl.id} value={tpl.id}>
                          {tpl.code} ({tpl.nudgeType})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={fieldCol}>
                    <span className={fieldLbl}>{t("admin.venueCms.common.sort")}</span>
                    <input
                      className={fieldInp}
                      value={attachDraft.sortOrder}
                      onChange={(e) => setAttachDraft((s) => ({ ...s, sortOrder: e.target.value }))}
                    />
                  </label>
                </div>
                <p className="text-xs text-slate-500">
                  {t("admin.venueCms.nudges.overridesHint")}
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <input
                    className={fieldInp}
                    placeholder={t("admin.venueCms.nudges.titleOverridePlaceholder")}
                    value={attachDraft.titleOverride}
                    onChange={(e) => setAttachDraft((s) => ({ ...s, titleOverride: e.target.value }))}
                  />
                  <input
                    className={fieldInp}
                    placeholder={t("admin.venueCms.nudges.bodyOverridePlaceholder")}
                    value={attachDraft.bodyOverride}
                    onChange={(e) => setAttachDraft((s) => ({ ...s, bodyOverride: e.target.value }))}
                  />
                  <input
                    className={fieldInp}
                    placeholder={t("admin.venueCms.nudges.dwellOverridePlaceholder")}
                    value={attachDraft.afterMinutesOverride}
                    onChange={(e) =>
                      setAttachDraft((s) => ({ ...s, afterMinutesOverride: e.target.value }))
                    }
                  />
                </div>
                <button
                  type="button"
                  disabled={createAsmMut.isPending}
                  onClick={() => void submitAttach()}
                  className={`h-[42px] w-full sm:w-auto ${btnPrimary}`}
                >
                  {createAsmMut.isPending ? t("admin.venueCms.common.adding") : t("admin.venueCms.nudges.addTemplate")}
                </button>
              </div>
            </div>
            )}

            <ul className="md:hidden space-y-3">
              {assignments.map((a) => (
                <li
                  key={a.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-2"
                >
                  <div>
                    <p className="font-mono text-sm font-semibold text-slate-900">{a.template.code}</p>
                    <p className="text-xs text-slate-500">{a.template.nudgeType}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                    <span>
                      <span className="font-medium text-slate-500">{t("admin.venueCms.common.sort")}</span> {a.sortOrder}
                    </span>
                    <span>
                      <span className="font-medium text-slate-500">{t("admin.venueCms.common.on")}</span>{" "}
                      {a.enabled ? t("admin.venueCms.common.yes") : t("admin.venueCms.common.no")}
                    </span>
                  </div>
                  {a.titleOverride || a.bodyOverride || a.afterMinutesOverride != null ? (
                    <div className="text-xs text-slate-600 space-y-0.5">
                      {a.titleOverride ? (
                        <p>{t("admin.venueCms.nudges.overrideTitle", { value: a.titleOverride })}</p>
                      ) : null}
                      {a.bodyOverride ? (
                        <p>{t("admin.venueCms.nudges.overrideBody", { value: a.bodyOverride })}</p>
                      ) : null}
                      {a.afterMinutesOverride != null ? (
                        <p>{t("admin.venueCms.nudges.overrideDwell", { minutes: a.afterMinutesOverride })}</p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">{t("admin.venueCms.common.noOverrides")}</p>
                  )}
                  <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => startEditAsm(a)}
                      className="text-xs font-medium text-brand hover:underline"
                    >
                      {t("admin.venueCms.common.edit")}
                    </button>
                    {isSuperAdmin ? (
                      <button
                        type="button"
                        disabled={triggerMut.isPending}
                        onClick={() => void triggerNow(a.id)}
                        className="text-xs font-medium text-amber-900 hover:underline"
                      >
                        {t("admin.venueCms.common.triggerNow")}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void removeAsm(a.id)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      {t("admin.venueCms.common.remove")}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            {assignments.length === 0 ? (
              <p className="md:hidden rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-3 py-4 text-xs text-slate-500 text-center">
                {t("admin.venueCms.nudges.emptyAssignments")}
              </p>
            ) : null}
            <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-sm">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50/90">
                  <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2.5 pr-3">{t("admin.venueCms.nudges.colTemplate")}</th>
                    <th className="px-3 py-2.5 pr-3">{t("admin.venueCms.common.sort")}</th>
                    <th className="px-3 py-2.5 pr-3">{t("admin.venueCms.common.on")}</th>
                    <th className="px-3 py-2.5 pr-3">{t("admin.venueCms.nudges.colOverrides")}</th>
                    <th className="px-3 py-2.5 pr-3" />
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((a) => (
                    <tr key={a.id} className="border-b border-slate-100 align-top">
                      <td className="px-3 py-2.5 pr-3">
                        <span className="font-mono text-xs">{a.template.code}</span>
                        <span className="block text-xs text-slate-500">{a.template.nudgeType}</span>
                      </td>
                      <td className="px-3 py-2.5 pr-3 tabular-nums">{a.sortOrder}</td>
                      <td className="px-3 py-2.5 pr-3">{a.enabled ? "yes" : "no"}</td>
                      <td className="max-w-[14rem] px-3 py-2.5 pr-3 text-xs text-slate-600">
                        {a.titleOverride || a.bodyOverride || a.afterMinutesOverride != null ? (
                          <>
                            {a.titleOverride ? (
                              <span className="block">title: {a.titleOverride}</span>
                            ) : null}
                            {a.bodyOverride ? (
                              <span className="block">body: {a.bodyOverride}</span>
                            ) : null}
                            {a.afterMinutesOverride != null ? (
                              <span className="block">{a.afterMinutesOverride} min dwell</span>
                            ) : null}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 pr-3">
                        <button
                          type="button"
                          onClick={() => startEditAsm(a)}
                          className="mr-2 text-xs font-medium text-brand hover:underline"
                        >
                          Edit
                        </button>
                        {isSuperAdmin ? (
                          <button
                            type="button"
                            disabled={triggerMut.isPending}
                            onClick={() => void triggerNow(a.id)}
                            className="mr-2 text-xs font-medium text-amber-900 hover:underline"
                          >
                            {t("admin.venueCms.common.triggerNow")}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void removeAsm(a.id)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {assignments.length === 0 ? (
                <p className="border-t border-slate-100 px-3 py-4 text-xs text-slate-500">
                  {t("admin.venueCms.nudges.emptyAssignments")}
                </p>
              ) : null}
            </div>

            {editAsmId ? (
              <div className="rounded-xl border border-brand/25 bg-brand-light/25 p-4 shadow-sm md:p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  {t("admin.venueCms.nudges.editAssignment")}
                </p>
                <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className={fieldCol}>
                    <span className={fieldLbl}>{t("admin.venueCms.nudges.sortOrder")}</span>
                    <input
                      className={fieldInp}
                      value={editAsmDraft.sortOrder}
                      onChange={(e) =>
                        setEditAsmDraft((s) => ({ ...s, sortOrder: e.target.value }))
                      }
                    />
                  </label>
                  <label className="inline-flex cursor-pointer items-center gap-2.5 self-end rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 shadow-sm sm:mb-0.5">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/30"
                      checked={editAsmDraft.enabled}
                      onChange={(e) =>
                        setEditAsmDraft((s) => ({ ...s, enabled: e.target.checked }))
                      }
                    />
                    {t("admin.venueCms.nudges.enabled")}
                  </label>
                  <label className={`${fieldCol} sm:col-span-2`}>
                    <span className={fieldLbl}>{t("admin.venueCms.nudges.titleOverridePlaceholder")}</span>
                    <input
                      className={fieldInp}
                      value={editAsmDraft.titleOverride}
                      onChange={(e) =>
                        setEditAsmDraft((s) => ({ ...s, titleOverride: e.target.value }))
                      }
                    />
                  </label>
                  <label className={`${fieldCol} sm:col-span-2`}>
                    <span className={fieldLbl}>{t("admin.venueCms.nudges.bodyOverridePlaceholder")}</span>
                    <textarea
                      className={`${fieldInp} min-h-[48px]`}
                      value={editAsmDraft.bodyOverride}
                      onChange={(e) =>
                        setEditAsmDraft((s) => ({ ...s, bodyOverride: e.target.value }))
                      }
                    />
                  </label>
                  <label className={fieldCol}>
                    <span className={fieldLbl}>{t("admin.venueCms.nudges.dwellMinutesOverride")}</span>
                    <input
                      className={fieldInp}
                      value={editAsmDraft.afterMinutesOverride}
                      onChange={(e) =>
                        setEditAsmDraft((s) => ({
                          ...s,
                          afterMinutesOverride: e.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={patchAsmMut.isPending}
                    onClick={() => void saveAsm()}
                    className={btnBrand}
                  >
                    {patchAsmMut.isPending ? t("admin.venueCms.common.saving") : t("admin.venueCms.common.save")}
                  </button>
                  <button type="button" onClick={() => setEditAsmId(null)} className={btnGhost}>
                    {t("admin.venueCms.common.cancel")}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

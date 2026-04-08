"use client";

import { useMemo, useState } from "react";
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
      setAsmErr("Choose a nudge template.");
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
    if (!confirm("Remove this nudge from the venue?")) return;
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
        `Sent to ${r.pushAttemptedForPlayers} player(s) currently at this venue (approx. ${r.playersWithTokens} with push tokens).`,
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
            <h2 className="text-sm font-semibold text-slate-900">Venue nudges</h2>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
              Marketing pushes tied to on-site dwell. Resolution order: assignment overrides → venue-wide
              fallback (super admin) → template → env defaults; category templates apply when nothing is
              attached.
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
              ? "None attached"
              : `${assignments.length} attached`}
          </span>
        </div>

        <div className="rounded-xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-slate-900 shadow-sm">
          <p className="text-xs leading-relaxed text-amber-950">
            <strong className="font-semibold">Automatic:</strong> while a guest is on site, after their
            dwell time (lowest <span className="font-mono text-[11px]">sort order</span> assignment wins —
            use per-assignment or template default minutes, else global{" "}
            <span className="font-mono text-[11px]">VENUE_ORDER_NUDGE_AFTER_MINUTES</span>), we send{" "}
            <strong className="font-semibold">one</strong> push per visit using that row&apos;s copy
            (assignment overrides → venue-wide fallback fields below → template → env). If this venue has{" "}
            <strong className="font-semibold">no</strong> assignments, legacy matching by{" "}
            <strong className="font-semibold">venue categories</strong> still applies.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-amber-950/95">
            <strong className="font-semibold">Trigger now (super admin):</strong> sends the selected
            assignment&apos;s copy immediately to players with <strong className="font-semibold">fresh presence</strong>{" "}
            at this venue (last ~10 minutes), respecting privacy/marketing prefs. Throttled per venue
            (default 120s,{" "}
            <span className="font-mono text-[11px]">VENUE_NUDGE_ADMIN_TRIGGER_MIN_SECONDS</span>).
          </p>
        </div>

        {isSuperAdmin ? (
          <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-4 shadow-sm md:p-5">
            <div className="space-y-5">
              <div>
                <h3 className={fieldLbl}>Global nudge library</h3>
                <p className="mt-1 text-xs leading-snug text-slate-500">
                  Reusable templates. Attach them to this venue below; optional{" "}
                  <span className="font-mono text-[11px] text-slate-600">VenueType</span> links in the DB
                  still drive defaults when a venue has no assignments.
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
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">New template</p>
                <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className={fieldCol}>
                    <span className={fieldLbl}>Code</span>
                    <input
                      className={`${fieldInp} font-mono text-xs`}
                      value={newTpl.code}
                      onChange={(e) => setNewTpl((s) => ({ ...s, code: e.target.value }))}
                      placeholder="LATTE_REMINDER_V1"
                    />
                  </label>
                  <label className={fieldCol}>
                    <span className={fieldLbl}>Nudge type (analytics)</span>
                    <input
                      className={fieldInp}
                      value={newTpl.nudgeType}
                      onChange={(e) => setNewTpl((s) => ({ ...s, nudgeType: e.target.value }))}
                    />
                  </label>
                  <label className={`${fieldCol} sm:col-span-2`}>
                    <span className={fieldLbl}>Title template</span>
                    <input
                      className={fieldInp}
                      value={newTpl.titleTemplate}
                      onChange={(e) => setNewTpl((s) => ({ ...s, titleTemplate: e.target.value }))}
                    />
                  </label>
                  <label className={`${fieldCol} sm:col-span-2`}>
                    <span className={fieldLbl}>Body template</span>
                    <textarea
                      className={`${fieldInp} min-h-[56px]`}
                      value={newTpl.bodyTemplate}
                      onChange={(e) => setNewTpl((s) => ({ ...s, bodyTemplate: e.target.value }))}
                    />
                  </label>
                  <label className={`${fieldCol} sm:col-span-2`}>
                    <span className={fieldLbl}>Description (internal)</span>
                    <input
                      className={fieldInp}
                      value={newTpl.description}
                      onChange={(e) => setNewTpl((s) => ({ ...s, description: e.target.value }))}
                    />
                  </label>
                  <label className={fieldCol}>
                    <span className={fieldLbl}>Default dwell minutes</span>
                    <input
                      className={fieldInp}
                      value={newTpl.defaultAfterMinutes}
                      onChange={(e) => setNewTpl((s) => ({ ...s, defaultAfterMinutes: e.target.value }))}
                      placeholder="e.g. 30"
                    />
                  </label>
                  <label className={fieldCol}>
                    <span className={fieldLbl}>Sort priority</span>
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
                  {createTplMut.isPending ? "Creating…" : "Create template"}
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-sm">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50/90">
                    <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2.5 pr-3">Code</th>
                      <th className="px-3 py-2.5 pr-3">Type</th>
                      <th className="px-3 py-2.5 pr-3">Active</th>
                      <th className="px-3 py-2.5 pr-3">Dwell min</th>
                      <th className="px-3 py-2.5 pr-3">Venues</th>
                      <th className="px-3 py-2.5 pr-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {templates.map((t) => (
                      <tr key={t.id} className="border-b border-slate-100 align-top">
                        <td className="px-3 py-2.5 pr-3 font-mono text-xs">{t.code}</td>
                        <td className="px-3 py-2.5 pr-3 text-xs">{t.nudgeType}</td>
                        <td className="px-3 py-2.5 pr-3">{t.active ? "yes" : "no"}</td>
                        <td className="px-3 py-2.5 pr-3 tabular-nums">
                          {t.defaultAfterMinutes ?? "—"}
                        </td>
                        <td className="px-3 py-2.5 pr-3 tabular-nums">
                          {t._count?.venueAssignments ?? "—"}
                        </td>
                        <td className="px-3 py-2.5 pr-3">
                          <button
                            type="button"
                            onClick={() => startEditTpl(t)}
                            className="text-brand text-xs font-medium hover:underline"
                          >
                            Edit
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
                    Edit template
                  </p>
                  <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className={fieldCol}>
                      <span className={fieldLbl}>Nudge type</span>
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
                      Active
                    </label>
                    <label className={`${fieldCol} sm:col-span-2`}>
                      <span className={fieldLbl}>Title</span>
                      <input
                        className={fieldInp}
                        value={editTplDraft.titleTemplate}
                        onChange={(e) =>
                          setEditTplDraft((s) => ({ ...s, titleTemplate: e.target.value }))
                        }
                      />
                    </label>
                    <label className={`${fieldCol} sm:col-span-2`}>
                      <span className={fieldLbl}>Body</span>
                      <textarea
                        className={`${fieldInp} min-h-[56px]`}
                        value={editTplDraft.bodyTemplate}
                        onChange={(e) =>
                          setEditTplDraft((s) => ({ ...s, bodyTemplate: e.target.value }))
                        }
                      />
                    </label>
                    <label className={`${fieldCol} sm:col-span-2`}>
                      <span className={fieldLbl}>Description</span>
                      <input
                        className={fieldInp}
                        value={editTplDraft.description}
                        onChange={(e) =>
                          setEditTplDraft((s) => ({ ...s, description: e.target.value }))
                        }
                      />
                    </label>
                    <label className={fieldCol}>
                      <span className={fieldLbl}>Default dwell min</span>
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
                      <span className={fieldLbl}>Sort priority</span>
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
                      {patchTplMut.isPending ? "Saving…" : "Save template"}
                    </button>
                    <button type="button" onClick={() => setEditTplId(null)} className={btnGhost}>
                      Cancel
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
              <h3 className={fieldLbl}>Nudges on this venue</h3>
              <p className="mt-1 text-xs leading-snug text-slate-500">
                Lower <span className="font-mono text-[11px]">sort order</span> runs first for automatic
                dwell selection. Per-row overrides replace template text or dwell minutes for this venue
                only.
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

            <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 shadow-sm">
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_5.5rem] sm:items-end">
                  <label className={fieldCol}>
                    <span className={fieldLbl}>Attach template</span>
                    <select
                      className={fieldInp}
                      value={attachDraft.templateId}
                      onChange={(e) => setAttachDraft((s) => ({ ...s, templateId: e.target.value }))}
                    >
                      <option value="">— Select —</option>
                      {unassignedTemplates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.code} ({t.nudgeType})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={fieldCol}>
                    <span className={fieldLbl}>Sort</span>
                    <input
                      className={fieldInp}
                      value={attachDraft.sortOrder}
                      onChange={(e) => setAttachDraft((s) => ({ ...s, sortOrder: e.target.value }))}
                    />
                  </label>
                </div>
                <p className="text-xs text-slate-500">
                  Optional overrides when adding (leave blank for template defaults):
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <input
                    className={fieldInp}
                    placeholder="Title override"
                    value={attachDraft.titleOverride}
                    onChange={(e) => setAttachDraft((s) => ({ ...s, titleOverride: e.target.value }))}
                  />
                  <input
                    className={fieldInp}
                    placeholder="Body override"
                    value={attachDraft.bodyOverride}
                    onChange={(e) => setAttachDraft((s) => ({ ...s, bodyOverride: e.target.value }))}
                  />
                  <input
                    className={fieldInp}
                    placeholder="Dwell min"
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
                  {createAsmMut.isPending ? "Adding…" : "Add template"}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-sm">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50/90">
                  <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2.5 pr-3">Template</th>
                    <th className="px-3 py-2.5 pr-3">Sort</th>
                    <th className="px-3 py-2.5 pr-3">On</th>
                    <th className="px-3 py-2.5 pr-3">Overrides</th>
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
                            Trigger now
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
                  No nudges attached — legacy category templates may still apply.
                </p>
              ) : null}
            </div>

            {editAsmId ? (
              <div className="rounded-xl border border-brand/25 bg-brand-light/25 p-4 shadow-sm md:p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Edit assignment
                </p>
                <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className={fieldCol}>
                    <span className={fieldLbl}>Sort order</span>
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
                    Enabled
                  </label>
                  <label className={`${fieldCol} sm:col-span-2`}>
                    <span className={fieldLbl}>Title override</span>
                    <input
                      className={fieldInp}
                      value={editAsmDraft.titleOverride}
                      onChange={(e) =>
                        setEditAsmDraft((s) => ({ ...s, titleOverride: e.target.value }))
                      }
                    />
                  </label>
                  <label className={`${fieldCol} sm:col-span-2`}>
                    <span className={fieldLbl}>Body override</span>
                    <textarea
                      className={`${fieldInp} min-h-[48px]`}
                      value={editAsmDraft.bodyOverride}
                      onChange={(e) =>
                        setEditAsmDraft((s) => ({ ...s, bodyOverride: e.target.value }))
                      }
                    />
                  </label>
                  <label className={fieldCol}>
                    <span className={fieldLbl}>Dwell minutes override</span>
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
                    {patchAsmMut.isPending ? "Saving…" : "Save"}
                  </button>
                  <button type="button" onClick={() => setEditAsmId(null)} className={btnGhost}>
                    Cancel
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

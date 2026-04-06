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
    <div className="space-y-8 mb-8">
      <div className="rounded-xl border border-slate-200 bg-amber-50/80 border-amber-100 p-4">
        <h2 className="text-sm font-semibold text-slate-900">Venue nudges (marketing push)</h2>
        <p className="text-xs text-slate-700 mt-2 leading-relaxed">
          <strong>Automatic:</strong> while a guest is on site, after their dwell time (lowest{" "}
          <span className="font-mono">sort order</span> assignment wins — use per-assignment or
          template default minutes, else global <span className="font-mono">VENUE_ORDER_NUDGE_AFTER_MINUTES</span>
          ), we send <strong>one</strong> push per visit using that row&apos;s copy (assignment overrides →
          venue-wide fallback fields below → template → env). If this venue has <strong>no</strong>{" "}
          assignments, legacy matching by <strong>venue categories</strong> still applies.
        </p>
        <p className="text-xs text-slate-700 mt-2 leading-relaxed">
          <strong>Trigger now (super admin):</strong> sends the selected assignment&apos;s copy immediately
          to players with <strong>fresh presence</strong> at this venue (last ~10 minutes), respecting
          privacy/marketing prefs. Throttled per venue (default 120s,{" "}
          <span className="font-mono">VENUE_NUDGE_ADMIN_TRIGGER_MIN_SECONDS</span>).
        </p>
      </div>

      {isSuperAdmin ? (
        <div className="rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Global nudge library</h3>
          <p className="text-xs text-slate-600 mt-1">
            Reusable templates. Attach them to this venue below; optional{" "}
            <span className="font-mono">VenueType</span> links in the DB still drive defaults when a venue
            has no assignments.
          </p>
          {tplErr ? <p className="text-xs text-red-600 mt-2">{tplErr}</p> : null}

          <div className="mt-4 border border-slate-100 rounded-lg p-3 bg-slate-50/80">
            <p className="text-xs font-semibold text-slate-700 mb-2">New template</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs text-slate-600 block">
                Code
                <input
                  className="mt-0.5 w-full border rounded px-2 py-1 text-sm font-mono"
                  value={newTpl.code}
                  onChange={(e) => setNewTpl((s) => ({ ...s, code: e.target.value }))}
                  placeholder="LATTE_REMINDER_V1"
                />
              </label>
              <label className="text-xs text-slate-600 block">
                Nudge type (analytics bucket)
                <input
                  className="mt-0.5 w-full border rounded px-2 py-1 text-sm"
                  value={newTpl.nudgeType}
                  onChange={(e) => setNewTpl((s) => ({ ...s, nudgeType: e.target.value }))}
                />
              </label>
              <label className="text-xs text-slate-600 block sm:col-span-2">
                Title template
                <input
                  className="mt-0.5 w-full border rounded px-2 py-1 text-sm"
                  value={newTpl.titleTemplate}
                  onChange={(e) => setNewTpl((s) => ({ ...s, titleTemplate: e.target.value }))}
                />
              </label>
              <label className="text-xs text-slate-600 block sm:col-span-2">
                Body template
                <textarea
                  className="mt-0.5 w-full border rounded px-2 py-1 text-sm min-h-[56px]"
                  value={newTpl.bodyTemplate}
                  onChange={(e) => setNewTpl((s) => ({ ...s, bodyTemplate: e.target.value }))}
                />
              </label>
              <label className="text-xs text-slate-600 block sm:col-span-2">
                Description (internal)
                <input
                  className="mt-0.5 w-full border rounded px-2 py-1 text-sm"
                  value={newTpl.description}
                  onChange={(e) => setNewTpl((s) => ({ ...s, description: e.target.value }))}
                />
              </label>
              <label className="text-xs text-slate-600 block">
                Default dwell minutes
                <input
                  className="mt-0.5 w-full border rounded px-2 py-1 text-sm"
                  value={newTpl.defaultAfterMinutes}
                  onChange={(e) => setNewTpl((s) => ({ ...s, defaultAfterMinutes: e.target.value }))}
                  placeholder="30 = use only if assignment omits override"
                />
              </label>
              <label className="text-xs text-slate-600 block">
                Sort priority
                <input
                  className="mt-0.5 w-full border rounded px-2 py-1 text-sm"
                  value={newTpl.sortPriority}
                  onChange={(e) => setNewTpl((s) => ({ ...s, sortPriority: e.target.value }))}
                />
              </label>
            </div>
            <button
              type="button"
              disabled={createTplMut.isPending}
              onClick={() => void createTpl()}
              className="mt-2 text-sm bg-slate-800 text-white rounded-lg px-3 py-1.5 disabled:opacity-50"
            >
              {createTplMut.isPending ? "Creating…" : "Create template"}
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                  <th className="py-2 pr-3">Code</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Active</th>
                  <th className="py-2 pr-3">Dwell min</th>
                  <th className="py-2 pr-3">Venues</th>
                  <th className="py-2 pr-3" />
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id} className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-3 font-mono text-xs">{t.code}</td>
                    <td className="py-2 pr-3 text-xs">{t.nudgeType}</td>
                    <td className="py-2 pr-3">{t.active ? "yes" : "no"}</td>
                    <td className="py-2 pr-3 tabular-nums">
                      {t.defaultAfterMinutes ?? "—"}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">
                      {t._count?.venueAssignments ?? "—"}
                    </td>
                    <td className="py-2 pr-3">
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
            <div className="mt-4 border border-brand/30 rounded-lg p-3 bg-brand-light/30">
              <p className="text-xs font-semibold text-slate-800 mb-2">Edit template</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-xs text-slate-600 block">
                  Nudge type
                  <input
                    className="mt-0.5 w-full border rounded px-2 py-1 text-sm"
                    value={editTplDraft.nudgeType}
                    onChange={(e) =>
                      setEditTplDraft((s) => ({ ...s, nudgeType: e.target.value }))
                    }
                  />
                </label>
                <label className="text-xs text-slate-600 flex items-center gap-2 mt-5">
                  <input
                    type="checkbox"
                    checked={editTplDraft.active}
                    onChange={(e) =>
                      setEditTplDraft((s) => ({ ...s, active: e.target.checked }))
                    }
                  />
                  Active
                </label>
                <label className="text-xs text-slate-600 block sm:col-span-2">
                  Title
                  <input
                    className="mt-0.5 w-full border rounded px-2 py-1 text-sm"
                    value={editTplDraft.titleTemplate}
                    onChange={(e) =>
                      setEditTplDraft((s) => ({ ...s, titleTemplate: e.target.value }))
                    }
                  />
                </label>
                <label className="text-xs text-slate-600 block sm:col-span-2">
                  Body
                  <textarea
                    className="mt-0.5 w-full border rounded px-2 py-1 text-sm min-h-[56px]"
                    value={editTplDraft.bodyTemplate}
                    onChange={(e) =>
                      setEditTplDraft((s) => ({ ...s, bodyTemplate: e.target.value }))
                    }
                  />
                </label>
                <label className="text-xs text-slate-600 block sm:col-span-2">
                  Description
                  <input
                    className="mt-0.5 w-full border rounded px-2 py-1 text-sm"
                    value={editTplDraft.description}
                    onChange={(e) =>
                      setEditTplDraft((s) => ({ ...s, description: e.target.value }))
                    }
                  />
                </label>
                <label className="text-xs text-slate-600 block">
                  Default dwell min
                  <input
                    className="mt-0.5 w-full border rounded px-2 py-1 text-sm"
                    value={editTplDraft.defaultAfterMinutes}
                    onChange={(e) =>
                      setEditTplDraft((s) => ({
                        ...s,
                        defaultAfterMinutes: e.target.value,
                      }))
                    }
                  />
                </label>
                <label className="text-xs text-slate-600 block">
                  Sort priority
                  <input
                    className="mt-0.5 w-full border rounded px-2 py-1 text-sm"
                    value={editTplDraft.sortPriority}
                    onChange={(e) =>
                      setEditTplDraft((s) => ({ ...s, sortPriority: e.target.value }))
                    }
                  />
                </label>
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  disabled={patchTplMut.isPending}
                  onClick={() => void saveTpl()}
                  className="text-sm bg-brand text-brand-foreground rounded-lg px-3 py-1.5 disabled:opacity-50"
                >
                  Save template
                </button>
                <button
                  type="button"
                  onClick={() => setEditTplId(null)}
                  className="text-sm border border-slate-300 rounded-lg px-3 py-1.5"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Nudges on this venue</h3>
        <p className="text-xs text-slate-600 mt-1">
          Lower <span className="font-mono">sort order</span> runs first for automatic dwell selection.
          Per-row overrides replace template text or dwell minutes for this venue only.
        </p>
        {asmErr ? <p className="text-xs text-red-600 mt-2">{asmErr}</p> : null}
        {triggerMsg ? <p className="text-xs text-green-800 mt-2">{triggerMsg}</p> : null}

        <div className="mt-3 flex flex-wrap gap-2 items-end border border-slate-100 rounded-lg p-3 bg-slate-50/80">
          <label className="text-xs text-slate-600 block min-w-[12rem] flex-1">
            Attach template
            <select
              className="mt-0.5 w-full border rounded px-2 py-1.5 text-sm bg-white"
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
          <label className="text-xs text-slate-600 block w-24">
            Sort
            <input
              className="mt-0.5 w-full border rounded px-2 py-1 text-sm"
              value={attachDraft.sortOrder}
              onChange={(e) => setAttachDraft((s) => ({ ...s, sortOrder: e.target.value }))}
            />
          </label>
          <button
            type="button"
            disabled={createAsmMut.isPending}
            onClick={() => void submitAttach()}
            className="text-sm bg-slate-800 text-white rounded-lg px-3 py-2 disabled:opacity-50 h-[34px]"
          >
            Add
          </button>
        </div>
        <p className="text-[11px] text-slate-500 mt-2">
          Optional overrides when adding (leave blank to use template defaults):
        </p>
        <div className="flex flex-wrap gap-2 mt-1">
          <input
            className="border rounded px-2 py-1 text-xs flex-1 min-w-[8rem]"
            placeholder="Title override"
            value={attachDraft.titleOverride}
            onChange={(e) => setAttachDraft((s) => ({ ...s, titleOverride: e.target.value }))}
          />
          <input
            className="border rounded px-2 py-1 text-xs flex-1 min-w-[8rem]"
            placeholder="Body override"
            value={attachDraft.bodyOverride}
            onChange={(e) => setAttachDraft((s) => ({ ...s, bodyOverride: e.target.value }))}
          />
          <input
            className="border rounded px-2 py-1 text-xs w-28"
            placeholder="Dwell min"
            value={attachDraft.afterMinutesOverride}
            onChange={(e) =>
              setAttachDraft((s) => ({ ...s, afterMinutesOverride: e.target.value }))
            }
          />
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <th className="py-2 pr-3">Template</th>
                <th className="py-2 pr-3">Sort</th>
                <th className="py-2 pr-3">On</th>
                <th className="py-2 pr-3">Overrides</th>
                <th className="py-2 pr-3" />
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-3">
                    <span className="font-mono text-xs">{a.template.code}</span>
                    <span className="text-xs text-slate-500 block">{a.template.nudgeType}</span>
                  </td>
                  <td className="py-2 pr-3 tabular-nums">{a.sortOrder}</td>
                  <td className="py-2 pr-3">{a.enabled ? "yes" : "no"}</td>
                  <td className="py-2 pr-3 text-xs text-slate-600 max-w-[14rem]">
                    {a.titleOverride || a.bodyOverride || a.afterMinutesOverride != null ? (
                      <>
                        {a.titleOverride ? <span className="block">title: {a.titleOverride}</span> : null}
                        {a.bodyOverride ? <span className="block">body: {a.bodyOverride}</span> : null}
                        {a.afterMinutesOverride != null ? (
                          <span className="block">{a.afterMinutesOverride} min dwell</span>
                        ) : null}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => startEditAsm(a)}
                      className="text-brand text-xs font-medium hover:underline mr-2"
                    >
                      Edit
                    </button>
                    {isSuperAdmin ? (
                      <button
                        type="button"
                        disabled={triggerMut.isPending}
                        onClick={() => void triggerNow(a.id)}
                        className="text-amber-900 text-xs font-medium hover:underline mr-2"
                      >
                        Trigger now
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void removeAsm(a.id)}
                      className="text-red-600 text-xs hover:underline"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {assignments.length === 0 ? (
            <p className="text-xs text-slate-500 py-4">No nudges attached — legacy category templates may still apply.</p>
          ) : null}
        </div>

        {editAsmId ? (
          <div className="mt-4 border border-brand/30 rounded-lg p-3 bg-brand-light/30">
            <p className="text-xs font-semibold text-slate-800 mb-2">Edit assignment</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs text-slate-600 block">
                Sort order
                <input
                  className="mt-0.5 w-full border rounded px-2 py-1 text-sm"
                  value={editAsmDraft.sortOrder}
                  onChange={(e) =>
                    setEditAsmDraft((s) => ({ ...s, sortOrder: e.target.value }))
                  }
                />
              </label>
              <label className="text-xs text-slate-600 flex items-center gap-2 mt-5">
                <input
                  type="checkbox"
                  checked={editAsmDraft.enabled}
                  onChange={(e) =>
                    setEditAsmDraft((s) => ({ ...s, enabled: e.target.checked }))
                  }
                />
                Enabled
              </label>
              <label className="text-xs text-slate-600 block sm:col-span-2">
                Title override
                <input
                  className="mt-0.5 w-full border rounded px-2 py-1 text-sm"
                  value={editAsmDraft.titleOverride}
                  onChange={(e) =>
                    setEditAsmDraft((s) => ({ ...s, titleOverride: e.target.value }))
                  }
                />
              </label>
              <label className="text-xs text-slate-600 block sm:col-span-2">
                Body override
                <textarea
                  className="mt-0.5 w-full border rounded px-2 py-1 text-sm min-h-[48px]"
                  value={editAsmDraft.bodyOverride}
                  onChange={(e) =>
                    setEditAsmDraft((s) => ({ ...s, bodyOverride: e.target.value }))
                  }
                />
              </label>
              <label className="text-xs text-slate-600 block">
                Dwell minutes override
                <input
                  className="mt-0.5 w-full border rounded px-2 py-1 text-sm"
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
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                disabled={patchAsmMut.isPending}
                onClick={() => void saveAsm()}
                className="text-sm bg-brand text-brand-foreground rounded-lg px-3 py-1.5 disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditAsmId(null)}
                className="text-sm border border-slate-300 rounded-lg px-3 py-1.5"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

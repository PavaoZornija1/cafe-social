"use client";

import Link from "next/link";
import { useForm } from "@tanstack/react-form";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmModal } from "@/components/ConfirmModal";
import {
  type AdminChallengeRow,
  useCreateChallengeMutation,
  useDeleteChallengeMutation,
  usePatchChallengeMutation,
  useVenueChallengesQuery,
  useVenuePerksQuery,
} from "@/lib/queries";

const fieldLbl = "text-[11px] font-semibold uppercase tracking-wide text-slate-500";
const fieldDt =
  "w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";
const btnRow =
  "rounded-lg bg-slate-800 px-3 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-slate-900 disabled:opacity-50";
const btnDanger =
  "rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50";

const AUTO_SOURCES = ["WORD_MATCH", "BRAWLER", "DAILY_WORD", "PRESENCE", "MANUAL"] as const;
const SCHEDULE_TYPES = ["ALWAYS", "FIXED_RANGE", "DAILY_RECURRING"] as const;

function minutesToTimeInput(m: number | null | undefined): string {
  if (m == null) return "";
  const h = Math.floor(m / 60) % 24;
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function timeInputToMinutes(v: string): number | null {
  const parts = v.trim().split(":");
  if (parts.length !== 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function dailyPreviewLabel(start: number | null, end: number | null, tz?: string): string {
  if (start == null || end == null) return "";
  const tzLabel = tz?.trim() || "UTC";
  return `${minutesToTimeInput(start)}–${minutesToTimeInput(end)} (${tzLabel})`;
}

type Props = {
  venueId: string;
  getToken: () => Promise<string | null>;
  enabled: boolean;
  variant?: "page" | "embedded";
  venueTimeZone?: string | null;
};

function ChallengeEditorCard({
  row,
  perks,
  venueTimeZone,
  onSave,
  onDelete,
  busy,
}: {
  row: AdminChallengeRow;
  perks: { id: string; title: string; code: string }[];
  venueTimeZone?: string | null;
  onSave: (id: string, body: Record<string, unknown>) => Promise<void>;
  onDelete: (row: AdminChallengeRow) => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState({
    title: row.title,
    description: row.description ?? "",
    autoProgressSource: row.autoProgressSource,
    targetCount: row.targetCount,
    scheduleType: row.scheduleType,
    activeFrom: row.activeFrom ? row.activeFrom.slice(0, 16) : "",
    activeTo: row.activeTo ? row.activeTo.slice(0, 16) : "",
    dailyStart: minutesToTimeInput(row.dailyStartMinutes),
    dailyEnd: minutesToTimeInput(row.dailyEndMinutes),
    rewardPerkId: row.rewardPerkId ?? "",
    locationRequired: row.locationRequired,
    rewardVenueSpecific: row.rewardVenueSpecific,
    resetsWeekly: row.resetsWeekly,
    requiresWin: row.requiresWin,
  });

  const dailyPreview =
    draft.scheduleType === "DAILY_RECURRING"
      ? dailyPreviewLabel(
          timeInputToMinutes(draft.dailyStart),
          timeInputToMinutes(draft.dailyEnd),
          venueTimeZone ?? undefined,
        )
      : "";

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-slate-900">{row.title}</p>
          <p className="text-xs font-mono text-slate-500">{row.id}</p>
        </div>
        <button type="button" className={btnDanger} disabled={busy} onClick={() => onDelete(row)}>
          {t("admin.venueCms.common.delete")}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className={fieldLbl}>{t("admin.venueCms.challenges.fieldTitle")}</span>
          <input
            className={fieldDt}
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className={fieldLbl}>{t("admin.venueCms.challenges.fieldDescription")}</span>
          <textarea
            className={fieldDt}
            rows={2}
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={fieldLbl}>{t("admin.venueCms.challenges.fieldSource")}</span>
          <select
            className={fieldDt}
            value={draft.autoProgressSource}
            onChange={(e) => setDraft((d) => ({ ...d, autoProgressSource: e.target.value }))}
          >
            {AUTO_SOURCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={fieldLbl}>{t("admin.venueCms.challenges.fieldTarget")}</span>
          <input
            type="number"
            min={1}
            className={fieldDt}
            value={draft.targetCount}
            onChange={(e) =>
              setDraft((d) => ({ ...d, targetCount: Math.max(1, Number(e.target.value) || 1) }))
            }
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={fieldLbl}>{t("admin.venueCms.challenges.fieldSchedule")}</span>
          <select
            className={fieldDt}
            value={draft.scheduleType}
            onChange={(e) => setDraft((d) => ({ ...d, scheduleType: e.target.value }))}
          >
            {SCHEDULE_TYPES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={fieldLbl}>{t("admin.venueCms.challenges.rewardPerkLabel")}</span>
          <select
            className={fieldDt}
            value={draft.rewardPerkId}
            onChange={(e) => setDraft((d) => ({ ...d, rewardPerkId: e.target.value }))}
          >
            <option value="">{t("admin.venueCms.common.none")}</option>
            {perks.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} ({p.code})
              </option>
            ))}
          </select>
        </label>
      </div>

      {draft.scheduleType === "FIXED_RANGE" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className={fieldLbl}>{t("admin.venueCms.challenges.activeFromUtc")}</span>
            <input
              type="datetime-local"
              className={fieldDt}
              value={draft.activeFrom}
              onChange={(e) => setDraft((d) => ({ ...d, activeFrom: e.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={fieldLbl}>{t("admin.venueCms.challenges.activeToUtc")}</span>
            <input
              type="datetime-local"
              className={fieldDt}
              value={draft.activeTo}
              onChange={(e) => setDraft((d) => ({ ...d, activeTo: e.target.value }))}
            />
          </label>
        </div>
      ) : null}

      {draft.scheduleType === "DAILY_RECURRING" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className={fieldLbl}>{t("admin.venueCms.challenges.dailyStartLocal")}</span>
            <input
              type="time"
              className={fieldDt}
              value={draft.dailyStart}
              onChange={(e) => setDraft((d) => ({ ...d, dailyStart: e.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={fieldLbl}>{t("admin.venueCms.challenges.dailyEndLocal")}</span>
            <input
              type="time"
              className={fieldDt}
              value={draft.dailyEnd}
              onChange={(e) => setDraft((d) => ({ ...d, dailyEnd: e.target.value }))}
            />
          </label>
          {dailyPreview ? (
            <p className="sm:col-span-2 text-xs text-slate-600">
              {t("admin.venueCms.challenges.localPreview", { window: dailyPreview })}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={draft.locationRequired}
            onChange={(e) => setDraft((d) => ({ ...d, locationRequired: e.target.checked }))}
          />
          {t("admin.venueCms.challenges.flagLocation")}
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={draft.rewardVenueSpecific}
            onChange={(e) => setDraft((d) => ({ ...d, rewardVenueSpecific: e.target.checked }))}
          />
          {t("admin.venueCms.challenges.flagVenueReward")}
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={draft.resetsWeekly}
            onChange={(e) => setDraft((d) => ({ ...d, resetsWeekly: e.target.checked }))}
          />
          {t("admin.venueCms.challenges.flagWeekly")}
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={draft.requiresWin}
            onChange={(e) => setDraft((d) => ({ ...d, requiresWin: e.target.checked }))}
          />
          {t("admin.venueCms.challenges.flagRequiresWin")}
        </label>
      </div>

      <button
        type="button"
        disabled={busy}
        className={btnRow}
        onClick={() =>
          void onSave(row.id, {
            title: draft.title.trim(),
            description: draft.description.trim() || null,
            autoProgressSource: draft.autoProgressSource,
            targetCount: draft.targetCount,
            scheduleType: draft.scheduleType,
            activeFrom: draft.activeFrom ? new Date(draft.activeFrom).toISOString() : null,
            activeTo: draft.activeTo ? new Date(draft.activeTo).toISOString() : null,
            dailyStartMinutes: timeInputToMinutes(draft.dailyStart),
            dailyEndMinutes: timeInputToMinutes(draft.dailyEnd),
            rewardPerkId: draft.rewardPerkId || null,
            locationRequired: draft.locationRequired,
            rewardVenueSpecific: draft.rewardVenueSpecific,
            resetsWeekly: draft.resetsWeekly,
            requiresWin: draft.requiresWin,
          })
        }
      >
        {t("admin.venueCms.common.save")}
      </button>
    </article>
  );
}

export function VenueChallengesSection({
  venueId,
  getToken,
  enabled,
  variant = "page",
  venueTimeZone,
}: Props) {
  const { t } = useTranslation();
  const q = useVenueChallengesQuery(venueId, getToken, enabled && Boolean(venueId));
  const perksQ = useVenuePerksQuery(venueId, getToken, enabled && Boolean(venueId));
  const createMut = useCreateChallengeMutation(venueId, getToken);
  const patchMut = usePatchChallengeMutation(getToken, venueId);
  const deleteMut = useDeleteChallengeMutation(getToken, venueId);
  const [deleteTarget, setDeleteTarget] = useState<AdminChallengeRow | null>(null);

  const form = useForm({
    defaultValues: {
      title: "",
      description: "",
      autoProgressSource: "WORD_MATCH",
      targetCount: 1,
      scheduleType: "ALWAYS",
      dailyStart: "14:00",
      dailyEnd: "15:00",
    },
    onSubmit: async ({ value }) => {
      await createMut.mutateAsync({
        title: value.title.trim(),
        description: value.description.trim() || null,
        autoProgressSource: value.autoProgressSource,
        targetCount: value.targetCount,
        scheduleType: value.scheduleType,
        dailyStartMinutes:
          value.scheduleType === "DAILY_RECURRING"
            ? timeInputToMinutes(value.dailyStart)
            : null,
        dailyEndMinutes:
          value.scheduleType === "DAILY_RECURRING" ? timeInputToMinutes(value.dailyEnd) : null,
        locationRequired: false,
        rewardVenueSpecific: true,
        resetsWeekly: false,
        requiresWin: false,
      });
      form.reset();
    },
  });

  const perks = useMemo(() => perksQ.data ?? [], [perksQ.data]);
  const busy = createMut.isPending || patchMut.isPending || deleteMut.isPending;
  const err =
    (q.isError && q.error instanceof Error ? q.error.message : null) ||
    (createMut.error instanceof Error ? createMut.error.message : null) ||
    (patchMut.error instanceof Error ? patchMut.error.message : null);

  const embedded = variant === "embedded";
  const challengeCount = (q.data ?? []).length;

  return (
    <section
      className={
        embedded
          ? "mb-8 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.04] md:p-6"
          : "min-h-screen bg-slate-50 px-4 py-6 sm:p-8 text-slate-900"
      }
    >
      {embedded ? (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-slate-900">
            {t("admin.venueCms.challenges.embeddedTitle")}
          </h2>
          <p className="mt-1 text-xs text-slate-500">{t("admin.venueCms.challenges.embeddedLead")}</p>
        </div>
      ) : (
        <>
          <Link href="/venues" className="text-brand text-sm">
            {t("admin.venueCms.common.backVenues")}
          </Link>
          <h1 className="text-xl font-bold mt-4 mb-4">{t("admin.venueCms.challenges.pageTitle")}</h1>
        </>
      )}

      {err ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
          {err}
        </div>
      ) : null}

      <form
        className="mb-6 rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
      >
        <p className="text-sm font-semibold text-slate-800">{t("admin.venueCms.challenges.createTitle")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <form.Field name="title">
            {(field) => (
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className={fieldLbl}>{t("admin.venueCms.challenges.fieldTitle")}</span>
                <input
                  className={fieldDt}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  required
                />
              </label>
            )}
          </form.Field>
          <form.Field name="autoProgressSource">
            {(field) => (
              <label className="flex flex-col gap-1">
                <span className={fieldLbl}>{t("admin.venueCms.challenges.fieldSource")}</span>
                <select
                  className={fieldDt}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                >
                  {AUTO_SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </form.Field>
          <form.Field name="targetCount">
            {(field) => (
              <label className="flex flex-col gap-1">
                <span className={fieldLbl}>{t("admin.venueCms.challenges.fieldTarget")}</span>
                <input
                  type="number"
                  min={1}
                  className={fieldDt}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(Math.max(1, Number(e.target.value) || 1))}
                />
              </label>
            )}
          </form.Field>
          <form.Field name="scheduleType">
            {(field) => (
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className={fieldLbl}>{t("admin.venueCms.challenges.fieldSchedule")}</span>
                <select
                  className={fieldDt}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                >
                  {SCHEDULE_TYPES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </form.Field>
        </div>
        <form.Subscribe selector={(s) => s.values.scheduleType}>
          {(scheduleType) =>
            scheduleType === "DAILY_RECURRING" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <form.Field name="dailyStart">
                  {(field) => (
                    <label className="flex flex-col gap-1">
                      <span className={fieldLbl}>{t("admin.venueCms.challenges.dailyStartLocal")}</span>
                      <input
                        type="time"
                        className={fieldDt}
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                    </label>
                  )}
                </form.Field>
                <form.Field name="dailyEnd">
                  {(field) => (
                    <label className="flex flex-col gap-1">
                      <span className={fieldLbl}>{t("admin.venueCms.challenges.dailyEndLocal")}</span>
                      <input
                        type="time"
                        className={fieldDt}
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                    </label>
                  )}
                </form.Field>
              </div>
            ) : null
          }
        </form.Subscribe>
        <button type="submit" disabled={busy} className={btnRow}>
          {t("admin.venueCms.challenges.createCta")}
        </button>
      </form>

      {q.isPending && !q.data ? (
        <p className="text-sm text-slate-600">{t("admin.venueCms.challenges.loading")}</p>
      ) : (q.data ?? []).length === 0 ? (
        <p className="text-sm text-slate-500">{t("admin.venueCms.challenges.empty")}</p>
      ) : (
        <div className="space-y-4">
          {(q.data ?? []).map((row) => (
            <ChallengeEditorCard
              key={row.id}
              row={row}
              perks={perks}
              venueTimeZone={venueTimeZone}
              busy={busy}
              onDelete={setDeleteTarget}
              onSave={async (id, body) => {
                await patchMut.mutateAsync({ id, body });
              }}
            />
          ))}
        </div>
      )}

      <ConfirmModal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t("admin.venueCms.challenges.deleteTitle")}
        description={
          deleteTarget ? (
            <p>{t("admin.venueCms.challenges.deleteBody", { title: deleteTarget.title })}</p>
          ) : null
        }
        confirmLabel={t("admin.venueCms.common.delete")}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteMut.mutateAsync(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />

      {!embedded ? null : (
        <p className="text-xs text-slate-500 mt-3">
          {t("admin.venueCms.challenges.badgeCount", { count: challengeCount })}
        </p>
      )}
    </section>
  );
}

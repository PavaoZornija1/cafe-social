"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useForm } from "@tanstack/react-form";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmModal } from "@/components/ConfirmModal";
import {
  PortalAlert,
  PortalCard,
  PortalPageHeader,
  PortalPageLayout,
  PortalSkeleton,
  portalButtonPrimaryClass,
  portalInputClass,
  portalLabelClass,
} from "@/components/portal/PortalPageUi";
import { TableRowCards } from "@/components/TableRowCards";
import { useAddWordMutation, useWordsQuery } from "@/lib/queries";

type WordRow = { id: string; text: string; language: string; category: string };

const colHelper = createColumnHelper<WordRow>();
const WORDS_TAKE = 80;

export default function WordsPage() {
  const { t } = useTranslation();
  const { isLoaded, getToken } = useAuth();
  const wordsQ = useWordsQuery(getToken, isLoaded, WORDS_TAKE);
  const addMut = useAddWordMutation(getToken, WORDS_TAKE);
  const [addWordConfirmOpen, setAddWordConfirmOpen] = useState(false);

  const addForm = useForm({
    defaultValues: {
      text: "",
      language: "en",
      category: "DRINK_FOOD",
      sentenceHint: "",
      wordHints: "coffee, drink",
      emojiHints: "☕",
    },
    onSubmit: async ({ value }) => {
      await addMut.mutateAsync({
        text: value.text,
        language: value.language,
        category: value.category,
        sentenceHint: value.sentenceHint,
        wordHints: value.wordHints
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        emojiHints: value.emojiHints
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      addForm.reset();
    },
  });

  const rows = useMemo(() => (wordsQ.data ?? []).slice(0, 40), [wordsQ.data]);

  const columns = useMemo(
    () => [
      colHelper.accessor("language", {
        header: t("admin.words.colLang"),
        cell: (c) => <span className="font-mono text-xs text-brand">{c.getValue()}</span>,
      }),
      colHelper.accessor("text", {
        header: t("admin.words.colText"),
        cell: (c) => <span className="font-mono text-sm text-slate-900">{c.getValue()}</span>,
      }),
      colHelper.accessor("category", {
        header: t("admin.words.colCategory"),
        cell: (c) => <span className="text-xs text-slate-600">{c.getValue()}</span>,
      }),
    ],
    [t],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const err =
    wordsQ.isError && wordsQ.error instanceof Error ? wordsQ.error.message : null;

  if (err && !wordsQ.data) {
    return (
      <PortalPageLayout maxWidth="3xl">
        <PortalAlert tone="error">
          {err}{" "}
          <Link href="/platform" className="font-medium text-brand hover:text-brand-hover">
            {t("admin.words.dashboard")}
          </Link>
        </PortalAlert>
      </PortalPageLayout>
    );
  }

  return (
    <PortalPageLayout maxWidth="3xl">
      <PortalPageHeader
        backHref="/platform"
        backLabel={t("admin.words.backDashboard")}
        title={t("admin.words.title")}
      />

      <PortalCard className="mb-6 border-brand/15 bg-gradient-to-br from-brand-lighter/30 to-white">
        <h2 className="text-sm font-semibold text-slate-900">{t("admin.words.addWord")}</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setAddWordConfirmOpen(true);
          }}
          className="mt-4 grid gap-3 sm:grid-cols-2"
        >
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className={portalLabelClass}>{t("admin.words.placeholderText")}</span>
            <addForm.Field name="text">
              {(f) => (
                <input
                  className={portalInputClass}
                  placeholder={t("admin.words.placeholderText")}
                  value={f.state.value}
                  onChange={(e) => f.handleChange(e.target.value)}
                />
              )}
            </addForm.Field>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={portalLabelClass}>{t("admin.words.placeholderLanguage")}</span>
            <addForm.Field name="language">
              {(f) => (
                <input
                  className={portalInputClass}
                  placeholder={t("admin.words.placeholderLanguage")}
                  value={f.state.value}
                  onChange={(e) => f.handleChange(e.target.value)}
                />
              )}
            </addForm.Field>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={portalLabelClass}>{t("admin.words.placeholderCategory")}</span>
            <addForm.Field name="category">
              {(f) => (
                <input
                  className={portalInputClass}
                  placeholder={t("admin.words.placeholderCategory")}
                  value={f.state.value}
                  onChange={(e) => f.handleChange(e.target.value)}
                />
              )}
            </addForm.Field>
          </label>
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className={portalLabelClass}>{t("admin.words.placeholderSentenceHint")}</span>
            <addForm.Field name="sentenceHint">
              {(f) => (
                <input
                  className={portalInputClass}
                  placeholder={t("admin.words.placeholderSentenceHint")}
                  value={f.state.value}
                  onChange={(e) => f.handleChange(e.target.value)}
                />
              )}
            </addForm.Field>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={portalLabelClass}>{t("admin.words.placeholderWordHints")}</span>
            <addForm.Field name="wordHints">
              {(f) => (
                <input
                  className={portalInputClass}
                  placeholder={t("admin.words.placeholderWordHints")}
                  value={f.state.value}
                  onChange={(e) => f.handleChange(e.target.value)}
                />
              )}
            </addForm.Field>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={portalLabelClass}>{t("admin.words.placeholderEmojiHints")}</span>
            <addForm.Field name="emojiHints">
              {(f) => (
                <input
                  className={portalInputClass}
                  placeholder={t("admin.words.placeholderEmojiHints")}
                  value={f.state.value}
                  onChange={(e) => f.handleChange(e.target.value)}
                />
              )}
            </addForm.Field>
          </label>
          {addMut.isError && addMut.error instanceof Error ? (
            <PortalAlert tone="error" className="sm:col-span-2">
              {addMut.error.message}
            </PortalAlert>
          ) : null}
          <div className="sm:col-span-2">
            <button type="submit" disabled={addMut.isPending} className={portalButtonPrimaryClass}>
              {t("admin.words.addSubmit")}
            </button>
          </div>
        </form>
      </PortalCard>

      <ConfirmModal
        open={addWordConfirmOpen}
        onClose={() => setAddWordConfirmOpen(false)}
        title={t("admin.words.confirmTitle")}
        description={
          <p>
            {t("admin.words.confirmBody", {
              text: addForm.state.values.text || "—",
              language: addForm.state.values.language,
              category: addForm.state.values.category,
            })}
          </p>
        }
        confirmLabel={t("admin.words.confirmLabel")}
        onConfirm={() => addForm.handleSubmit()}
      />

      {wordsQ.isPending && !wordsQ.data ? (
        <PortalSkeleton rows={2} />
      ) : (
        <>
          <TableRowCards
            rows={table.getRowModel().rows}
            leadCellId="text"
            showBodyLabels
            leadStyle="default"
          />
          <div className="mt-4 hidden overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-portal-card md:block">
            <table className="min-w-full text-sm">
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} className="border-b border-slate-200 bg-brand-lighter/40">
                    {hg.headers.map((h) => (
                      <th
                        key={h.id}
                        className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500"
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-slate-100 transition-colors last:border-0 hover:bg-brand-lighter/30"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </PortalPageLayout>
  );
}

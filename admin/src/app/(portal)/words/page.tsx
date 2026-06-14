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
        cell: (c) => <span className="font-mono text-xs">{c.getValue()}</span>,
      }),
      colHelper.accessor("text", {
        header: t("admin.words.colText"),
        cell: (c) => <span className="font-mono text-sm">{c.getValue()}</span>,
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
      <div className="bg-slate-50 text-red-700 px-4 py-6 sm:p-8">
        {err}{" "}
        <Link href="/dashboard" className="text-brand">
          {t("admin.words.dashboard")}
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 text-slate-900 px-4 py-6 sm:p-8 max-w-3xl mx-auto w-full">
      <Link href="/dashboard" className="text-brand text-sm">
        {t("admin.words.backDashboard")}
      </Link>
      <h1 className="text-xl font-bold mt-4 mb-4">{t("admin.words.title")}</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setAddWordConfirmOpen(true);
        }}
        className="border border-slate-200 rounded-lg p-4 mb-6 space-y-2 max-w-lg"
      >
        <p className="text-sm text-slate-600">{t("admin.words.addWord")}</p>
        <addForm.Field name="text">
          {(f) => (
            <input
              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-sm"
              placeholder={t("admin.words.placeholderText")}
              value={f.state.value}
              onChange={(e) => f.handleChange(e.target.value)}
            />
          )}
        </addForm.Field>
        <addForm.Field name="language">
          {(f) => (
            <input
              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-sm"
              placeholder={t("admin.words.placeholderLanguage")}
              value={f.state.value}
              onChange={(e) => f.handleChange(e.target.value)}
            />
          )}
        </addForm.Field>
        <addForm.Field name="category">
          {(f) => (
            <input
              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-sm"
              placeholder={t("admin.words.placeholderCategory")}
              value={f.state.value}
              onChange={(e) => f.handleChange(e.target.value)}
            />
          )}
        </addForm.Field>
        <addForm.Field name="sentenceHint">
          {(f) => (
            <input
              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-sm"
              placeholder={t("admin.words.placeholderSentenceHint")}
              value={f.state.value}
              onChange={(e) => f.handleChange(e.target.value)}
            />
          )}
        </addForm.Field>
        <addForm.Field name="wordHints">
          {(f) => (
            <input
              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-sm"
              placeholder={t("admin.words.placeholderWordHints")}
              value={f.state.value}
              onChange={(e) => f.handleChange(e.target.value)}
            />
          )}
        </addForm.Field>
        <addForm.Field name="emojiHints">
          {(f) => (
            <input
              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-sm"
              placeholder={t("admin.words.placeholderEmojiHints")}
              value={f.state.value}
              onChange={(e) => f.handleChange(e.target.value)}
            />
          )}
        </addForm.Field>
        {addMut.isError && addMut.error instanceof Error ? (
          <p className="text-red-600 text-sm">{addMut.error.message}</p>
        ) : null}
        <button
          type="submit"
          disabled={addMut.isPending}
          className="bg-brand border border-brand-active text-white rounded px-3 py-1 text-sm font-medium hover:bg-brand-hover disabled:opacity-50"
        >
          {t("admin.words.addSubmit")}
        </button>
      </form>

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
        <p>{t("admin.words.loading")}</p>
      ) : (
        <>
          <TableRowCards
            rows={table.getRowModel().rows}
            leadCellId="text"
            showBodyLabels
            leadStyle="default"
          />
          <div className="hidden md:block rounded-xl border border-slate-200 bg-white overflow-x-auto max-w-3xl">
            <table className="min-w-full text-sm">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b border-slate-200 bg-slate-50">
                  {hg.headers.map((h) => (
                    <th key={h.id} className="text-left px-3 py-2 text-xs uppercase text-slate-500">
                      {flexRender(h.column.columnDef.header, h.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2">
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
    </div>
  );
}

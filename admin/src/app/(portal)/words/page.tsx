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
import { ConfirmModal } from "@/components/ConfirmModal";
import { useAddWordMutation, useWordsQuery } from "@/lib/queries";

type WordRow = { id: string; text: string; language: string; category: string };

const colHelper = createColumnHelper<WordRow>();
const WORDS_TAKE = 80;

export default function WordsPage() {
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
        header: "Lang",
        cell: (c) => <span className="font-mono text-xs">{c.getValue()}</span>,
      }),
      colHelper.accessor("text", {
        header: "Text",
        cell: (c) => <span className="font-mono text-sm">{c.getValue()}</span>,
      }),
      colHelper.accessor("category", {
        header: "Category",
        cell: (c) => <span className="text-xs text-slate-600">{c.getValue()}</span>,
      }),
    ],
    [],
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
      <div className="bg-slate-50 text-red-700 p-8">
        {err}{" "}
        <Link href="/dashboard" className="text-brand">
          Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 text-slate-900 p-8">
      <Link href="/dashboard" className="text-brand text-sm">
        ← Dashboard
      </Link>
      <h1 className="text-xl font-bold mt-4 mb-4">Words</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setAddWordConfirmOpen(true);
        }}
        className="border border-slate-200 rounded-lg p-4 mb-6 space-y-2 max-w-lg"
      >
        <p className="text-sm text-slate-600">Add word</p>
        <addForm.Field name="text">
          {(f) => (
            <input
              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-sm"
              placeholder="text"
              value={f.state.value}
              onChange={(e) => f.handleChange(e.target.value)}
            />
          )}
        </addForm.Field>
        <addForm.Field name="language">
          {(f) => (
            <input
              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-sm"
              placeholder="language"
              value={f.state.value}
              onChange={(e) => f.handleChange(e.target.value)}
            />
          )}
        </addForm.Field>
        <addForm.Field name="category">
          {(f) => (
            <input
              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-sm"
              placeholder="category (enum, e.g. DRINK_FOOD)"
              value={f.state.value}
              onChange={(e) => f.handleChange(e.target.value)}
            />
          )}
        </addForm.Field>
        <addForm.Field name="sentenceHint">
          {(f) => (
            <input
              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-sm"
              placeholder="sentence hint"
              value={f.state.value}
              onChange={(e) => f.handleChange(e.target.value)}
            />
          )}
        </addForm.Field>
        <addForm.Field name="wordHints">
          {(f) => (
            <input
              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-sm"
              placeholder="word hints comma-separated"
              value={f.state.value}
              onChange={(e) => f.handleChange(e.target.value)}
            />
          )}
        </addForm.Field>
        <addForm.Field name="emojiHints">
          {(f) => (
            <input
              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-sm"
              placeholder="emoji hints comma-separated"
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
          Add…
        </button>
      </form>

      <ConfirmModal
        open={addWordConfirmOpen}
        onClose={() => setAddWordConfirmOpen(false)}
        title="Add word?"
        description={
          <p>
            Add{" "}
            <span className="font-mono font-semibold text-slate-900">
              {addForm.state.values.text || "—"}
            </span>{" "}
            <span className="text-slate-600">
              ({addForm.state.values.language}) · {addForm.state.values.category}
            </span>
          </p>
        }
        confirmLabel="Add word"
        onConfirm={() => addForm.handleSubmit()}
      />
      {wordsQ.isPending && !wordsQ.data ? (
        <p>Loading…</p>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto max-w-3xl">
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
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { portalFetch } from "../../../lib/portalApi";

type WordRow = { id: string; text: string; language: string; category: string };

export default function WordsPage() {
  const { isLoaded, getToken } = useAuth();
  const [rows, setRows] = useState<WordRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [language, setLanguage] = useState("en");
  const [category, setCategory] = useState("DRINK_FOOD");
  const [sentenceHint, setSentenceHint] = useState("");
  const [wordHints, setWordHints] = useState("coffee, drink");
  const [emojiHints, setEmojiHints] = useState("☕");

  useEffect(() => {
    if (!isLoaded) return;
    let c = false;
    (async () => {
      try {
        const data = await portalFetch<WordRow[]>(
          getToken,
          "/admin/words?take=80",
          { method: "GET" },
        );
        if (!c) setRows(data);
      } catch (e) {
        if (!c) setErr((e as Error).message);
      }
    })();
    return () => {
      c = true;
    };
  }, [isLoaded, getToken]);

  const add = async () => {
    setErr(null);
    try {
      await portalFetch(getToken, "/admin/words", {
        method: "POST",
        body: JSON.stringify({
          text,
          language,
          category,
          sentenceHint,
          wordHints: wordHints.split(",").map((s) => s.trim()).filter(Boolean),
          emojiHints: emojiHints.split(",").map((s) => s.trim()).filter(Boolean),
        }),
      });
      setText("");
      const data = await portalFetch<WordRow[]>(
        getToken,
        "/admin/words?take=80",
        { method: "GET" },
      );
      setRows(data);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  if (err && !rows) {
    return (
      <div className="bg-zinc-950 text-red-300 p-8">
        {err}{" "}
        <Link href="/dashboard" className="text-violet-400">
          Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-zinc-950 text-zinc-100 p-8">
      <Link href="/dashboard" className="text-violet-400 text-sm">
        ← Dashboard
      </Link>
      <h1 className="text-xl font-bold mt-4 mb-4">Words</h1>
      <div className="border border-zinc-800 rounded-lg p-4 mb-6 space-y-2 max-w-lg">
        <p className="text-sm text-zinc-400">Add word</p>
        <input
          className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm"
          placeholder="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <input
          className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm"
          placeholder="language"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
        />
        <input
          className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm"
          placeholder="category (enum, e.g. DRINK_FOOD)"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
        <input
          className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm"
          placeholder="sentence hint"
          value={sentenceHint}
          onChange={(e) => setSentenceHint(e.target.value)}
        />
        <input
          className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm"
          placeholder="word hints comma-separated"
          value={wordHints}
          onChange={(e) => setWordHints(e.target.value)}
        />
        <input
          className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm"
          placeholder="emoji hints comma-separated"
          value={emojiHints}
          onChange={(e) => setEmojiHints(e.target.value)}
        />
        {err ? <p className="text-red-400 text-sm">{err}</p> : null}
        <button
          type="button"
          onClick={() => void add()}
          className="bg-violet-600 rounded px-3 py-1 text-sm font-medium"
        >
          Add
        </button>
      </div>
      {!rows ? (
        <p>Loading…</p>
      ) : (
        <ul className="text-sm font-mono text-zinc-300 space-y-1">
          {rows.slice(0, 40).map((w) => (
            <li key={w.id}>
              {w.language} · {w.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

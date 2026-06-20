"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { VenueCmsEditorNav } from "./VenueCmsEditorNav";
import { useVenueCmsEditor } from "./VenueCmsEditorContext";

export function VenueCmsEditorShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { venueId, title, shellLoading, loadError } = useVenueCmsEditor();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      <header className="border-b border-slate-200 px-4 sm:px-6 py-4">
        <div className="mx-auto max-w-5xl w-full">
          <Link href="/venues" className="text-brand text-sm">
            {t("admin.venueCms.editor.backVenues")}
          </Link>
          <h1 className="text-xl font-bold mt-4 mb-1">{title}</h1>
          {!shellLoading ? (
            <p className="text-xs text-slate-500 font-mono">{venueId}</p>
          ) : null}
        </div>
      </header>

      <VenueCmsEditorNav />

      <main className="mx-auto max-w-5xl w-full px-4 py-5 sm:p-6 md:py-8">
        {shellLoading ? (
          <p className="text-slate-600">{t("admin.venueCms.editor.loading")}</p>
        ) : null}
        {loadError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm mb-6">
            {loadError}{" "}
            <Link href="/venues" className="text-brand font-medium hover:underline">
              {t("admin.venueCms.editor.back")}
            </Link>
          </div>
        ) : null}
        {!shellLoading && !loadError ? children : null}
      </main>
    </div>
  );
}

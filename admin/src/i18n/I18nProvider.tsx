"use client";

import { useEffect, useState, type ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import adminI18n, { ensureAdminI18n } from "./client";

export function I18nProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(() => adminI18n.isInitialized);

  useEffect(() => {
    void ensureAdminI18n().then(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen bg-brand-lighter flex items-center justify-center">
        <p className="text-sm font-medium text-slate-600">…</p>
      </div>
    );
  }

  return <I18nextProvider i18n={adminI18n}>{children}</I18nextProvider>;
}

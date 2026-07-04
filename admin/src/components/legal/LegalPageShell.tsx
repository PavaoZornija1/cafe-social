import Link from "next/link";
import type { ReactNode } from "react";
import { legalConfig } from "@/lib/legalConfig";

export function LegalPageShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const { companyName, appName } = legalConfig();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/" className="text-sm font-semibold text-slate-900 hover:text-brand">
            {appName}
          </Link>
          <nav className="flex gap-4 text-sm font-medium text-slate-600">
            <Link href="/privacy" className="hover:text-brand">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-brand">
              Terms
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">{companyName}</p>
        <article className="legal-doc mt-8 space-y-4 text-[15px] leading-relaxed text-slate-700 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-900 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_a]:text-brand [&_a]:underline-offset-2 hover:[&_a]:underline [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs">
          {children}
        </article>
      </main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap gap-4 px-4 py-6 text-xs text-slate-500 sm:px-6">
          <span>© {new Date().getFullYear()} {companyName}</span>
          <Link href="/privacy" className="hover:text-brand">
            Privacy policy
          </Link>
          <Link href="/terms" className="hover:text-brand">
            Terms of service
          </Link>
        </div>
      </footer>
    </div>
  );
}

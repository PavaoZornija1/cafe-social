import type { ReactNode } from "react";

export { portalClerkAppearance, portalClerkLayout } from "./portalClerkTheme";

type PortalAuthShellProps = {
  title: string;
  subtitle: string;
  footer: string;
  sideTitle: string;
  sideLead: string;
  sidePoints: string[];
  children: ReactNode;
};

export function PortalAuthShell({
  title,
  subtitle,
  footer,
  sideTitle,
  sideLead,
  sidePoints,
  children,
}: PortalAuthShellProps) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,520px)]">
      <aside className="portal-auth-brand relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0a1a35] via-brand to-[#1a4585]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-20 top-16 h-56 w-56 rounded-full bg-white/[0.06] blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -left-10 bottom-20 h-40 w-40 rounded-full bg-white/[0.04] blur-3xl"
          aria-hidden
        />

        <div className="relative flex flex-col gap-8 p-10 xl:p-12">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-sm font-bold text-white shadow-[0_4px_16px_-4px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.2)] ring-1 ring-white/20">
              CS
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Cafe Social</p>
              <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-white/45">
                Partner portal
              </p>
            </div>
          </div>

          <div className="max-w-md space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight text-white xl:text-[2rem] xl:leading-tight">
              {sideTitle}
            </h1>
            <p className="text-sm leading-relaxed text-white/70">{sideLead}</p>
          </div>

          <ul className="max-w-md space-y-3">
            {sidePoints.map((point) => (
              <li key={point} className="flex items-start gap-3 text-sm text-white/75">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15 text-[10px] text-white">
                  ✓
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative px-10 pb-10 text-xs text-white/35 xl:px-12">
          Cafe Social · secure access
        </p>
      </aside>

      <main className="portal-auth-bg flex min-h-screen flex-col items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-[420px]">
          <div className="mb-8 text-center lg:hidden">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-sm font-bold text-brand-foreground shadow-lg shadow-brand/30">
              CS
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-muted">
              Cafe Social
            </p>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90 shadow-portal-card backdrop-blur-md">
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-br from-brand/[0.08] via-brand-lighter/50 to-transparent"
              aria-hidden
            />
            <div className="relative px-6 py-7 sm:px-8 sm:py-8">
              <div className="mb-6 space-y-2 text-center lg:text-left">
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h2>
                <p className="text-sm leading-relaxed text-slate-600">{subtitle}</p>
              </div>
              <div className="portal-clerk">{children}</div>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-brand-muted">{footer}</p>
        </div>
      </main>
    </div>
  );
}

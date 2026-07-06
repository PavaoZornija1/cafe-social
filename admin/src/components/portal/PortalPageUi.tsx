import type { ReactNode } from "react";
import Link from "next/link";

type SvgProps = { className?: string };

function svgProps(className?: string) {
  return {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
}

export function ChevronLeftIcon({ className }: SvgProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export function ExternalLinkIcon({ className }: SvgProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
    </svg>
  );
}

export function PortalPageLayout({
  children,
  maxWidth = "6xl",
}: {
  children: ReactNode;
  maxWidth?: "3xl" | "5xl" | "6xl" | "lg";
}) {
  const widthClass =
    maxWidth === "lg"
      ? "max-w-lg"
      : maxWidth === "3xl"
        ? "max-w-3xl"
        : maxWidth === "5xl"
          ? "max-w-5xl"
          : "max-w-6xl";

  return (
    <div className={`mx-auto w-full ${widthClass} px-4 py-5 sm:px-6 sm:py-6 lg:py-8`}>
      {children}
    </div>
  );
}

export function PortalPageHeader({
  backHref,
  backLabel,
  title,
  lead,
  meta,
  children,
}: {
  backHref?: string;
  backLabel?: string;
  title: string;
  lead?: ReactNode;
  meta?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="relative mb-6 overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-0 shadow-portal-card">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-br from-brand/[0.08] via-brand-lighter/50 to-transparent"
        aria-hidden
      />
      <div className="relative px-5 py-5 sm:px-6 sm:py-6">
        {backHref && backLabel ? (
          <Link
            href={backHref}
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-muted transition-colors hover:text-brand"
          >
            <ChevronLeftIcon className="h-4 w-4" />
            {backLabel}
          </Link>
        ) : null}
        <div className={`space-y-2 ${backHref && backLabel ? "mt-4" : ""}`}>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-[1.65rem]">
            {title}
          </h1>
          {lead ? (
            <div className="max-w-3xl text-sm leading-relaxed text-slate-600">{lead}</div>
          ) : null}
          {meta ? <div className="pt-1">{meta}</div> : null}
        </div>
        {children ? <div className="mt-4">{children}</div> : null}
      </div>
    </div>
  );
}

export function PortalCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200/80 bg-white p-5 shadow-portal-card sm:p-6 ${className}`}
    >
      {children}
    </div>
  );
}

export function PortalAlert({
  tone,
  title,
  children,
  className = "",
  actions,
}: {
  tone: "error" | "warning" | "info" | "success";
  title?: string;
  children?: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  const styles = {
    error: "border-red-200/90 bg-gradient-to-br from-red-50 to-red-50/50 text-red-900",
    warning: "border-amber-200/90 bg-gradient-to-br from-amber-50 to-amber-50/40 text-amber-950",
    info: "border-slate-200/90 bg-gradient-to-br from-slate-50 to-white text-slate-800",
    success: "border-emerald-200/90 bg-gradient-to-br from-emerald-50 to-emerald-50/40 text-emerald-950",
  } as const;

  return (
    <div
      className={`flex flex-wrap items-start justify-between gap-3 rounded-2xl border px-4 py-3.5 text-sm shadow-sm ${styles[tone]} ${className}`}
    >
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? (
          <div className={title ? "mt-1 opacity-90" : undefined}>{children}</div>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function PortalSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-4" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl bg-slate-200/60"
          style={{ height: i === 0 ? "8rem" : "12rem" }}
        />
      ))}
    </div>
  );
}

export function PortalStatCard({
  label,
  value,
  hint,
  className = "",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200/80 bg-white p-4 shadow-portal-card ${className}`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function PortalBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "brand" | "success" | "warning";
}) {
  const styles = {
    neutral: "bg-slate-100 text-slate-700 ring-slate-200/80",
    brand: "bg-brand/10 text-brand ring-brand/20",
    success: "bg-emerald-50 text-emerald-700 ring-emerald-200/80",
    warning: "bg-amber-50 text-amber-800 ring-amber-200/80",
  } as const;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${styles[tone]}`}
    >
      {children}
    </span>
  );
}

export const portalInputClass =
  "w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";

export const portalSelectClass =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";

export const portalButtonPrimaryClass =
  "inline-flex items-center justify-center rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground shadow-md shadow-brand/25 transition-colors hover:bg-brand-hover disabled:opacity-50";

export const portalButtonSecondaryClass =
  "inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-50";

export const portalLabelClass =
  "text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500";

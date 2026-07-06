import type { ReactNode } from "react";
import type { VenueDashboardSectionKey } from "./types";

type SvgProps = {
  className?: string;
};

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

export function VenueSectionIcon({
  section,
  className,
}: {
  section: VenueDashboardSectionKey;
  className?: string;
}) {
  const props = svgProps(className);

  switch (section) {
    case "playbook":
      return (
        <svg {...props}>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          <path d="M8 7h8M8 11h6" />
        </svg>
      );
    case "analytics":
      return (
        <svg {...props}>
          <path d="M3 3v18h18" />
          <path d="M7 16l4-4 3 3 5-6" />
        </svg>
      );
    case "moderation":
      return (
        <svg {...props}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case "team":
      return (
        <svg {...props}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "campaigns":
      return (
        <svg {...props}>
          <path d="M3 11v2a4 4 0 0 0 4 4h12" />
          <path d="M7 15V9a4 4 0 0 1 4-4h6l-3 4 3 4h-6a4 4 0 0 1-4-4z" />
        </svg>
      );
    case "challenges":
      return (
        <svg {...props}>
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
          <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
          <path d="M4 22h16" />
          <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22" />
          <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22" />
          <path d="M18 2H6v7a6 6 0 0 0 12 0V2z" />
        </svg>
      );
    case "perks":
      return (
        <svg {...props}>
          <rect x="3" y="8" width="18" height="4" rx="1" />
          <path d="M12 8v13" />
          <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
          <path d="M7.5 8a2.5 2.5 0 0 1 0-5C9 3 12 8 12 8s3-5 4.5-5a2.5 2.5 0 0 1 0 5H7.5z" />
        </svg>
      );
    case "offers":
      return (
        <svg {...props}>
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
          <circle cx="7" cy="7" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case "receipts":
      return (
        <svg {...props}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
        </svg>
      );
    case "redemptions":
      return (
        <svg {...props}>
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <path d="M22 4 12 14.01l-3-3" />
        </svg>
      );
  }
}

export function ChevronLeftIcon({ className }: SvgProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export function BuildingIcon({ className }: SvgProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M3 21h18" />
      <path d="M6 21V7l6-4 6 4v14" />
      <path d="M10 21v-6h4v6" />
    </svg>
  );
}

export function CreditCardIcon({ className }: SvgProps) {
  return (
    <svg {...svgProps(className)}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
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

const ROLE_STYLES = {
  OWNER: "bg-brand/10 text-brand ring-brand/20",
  MANAGER: "bg-indigo-50 text-indigo-700 ring-indigo-200/80",
  EMPLOYEE: "bg-emerald-50 text-emerald-700 ring-emerald-200/80",
} as const;

export function VenueRoleBadge({
  role,
  label,
}: {
  role: keyof typeof ROLE_STYLES;
  label: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${ROLE_STYLES[role]}`}
    >
      {label}
    </span>
  );
}

export function VenueDashboardCard({
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

export function VenueAlert({
  tone,
  title,
  children,
  className = "",
}: {
  tone: "error" | "warning" | "info";
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const styles = {
    error: "border-red-200/90 bg-gradient-to-br from-red-50 to-red-50/50 text-red-900",
    warning: "border-amber-200/90 bg-gradient-to-br from-amber-50 to-amber-50/40 text-amber-950",
    info: "border-brand/20 bg-gradient-to-br from-brand-lighter/80 to-white text-slate-800",
  } as const;

  return (
    <div className={`rounded-2xl border px-4 py-3.5 text-sm shadow-sm ${styles[tone]} ${className}`}>
      {title ? <p className="font-semibold">{title}</p> : null}
      <div className={title ? "mt-1 opacity-90" : undefined}>{children}</div>
    </div>
  );
}

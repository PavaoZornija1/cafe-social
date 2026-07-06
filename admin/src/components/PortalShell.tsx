"use client";

import { UserButton, useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AdminLanguageSelect } from "@/i18n/AdminLanguageSelect";
import { useInvalidatePartnerContext, usePortalMeQuery } from "@/lib/queries";
import type { PortalMeOrg, PortalMeResponse } from "../lib/portalApi";
import {
  partnerHasManagementAccess,
  partnerNavVenuesActive,
} from "@/lib/partnerRoles";
import { SuperAdminVenuePicker } from "./SuperAdminVenuePicker";
import { TrialContactBar } from "./TrialContactBar";

type NavIconName =
  | "overview"
  | "organizations"
  | "venues"
  | "words"
  | "partner"
  | "locations"
  | "analytics"
  | "subscriptions"
  | "cms";

function NavIcon({ name, className }: { name: NavIconName; className?: string }) {
  const props = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (name) {
    case "overview":
      return (
        <svg {...props}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case "organizations":
      return (
        <svg {...props}>
          <path d="M3 21h18" />
          <path d="M6 21V7l6-4 6 4v14" />
          <path d="M10 21v-6h4v6" />
        </svg>
      );
    case "venues":
      return (
        <svg {...props}>
          <path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      );
    case "words":
      return (
        <svg {...props}>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      );
    case "partner":
      return (
        <svg {...props}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "locations":
      return (
        <svg {...props}>
          <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
          <path d="M9 21V12h6v9" />
        </svg>
      );
    case "analytics":
      return (
        <svg {...props}>
          <path d="M3 3v18h18" />
          <path d="M7 16l4-4 3 3 5-6" />
        </svg>
      );
    case "subscriptions":
      return (
        <svg {...props}>
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20" />
        </svg>
      );
    case "cms":
      return (
        <svg {...props}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
        </svg>
      );
  }
}

function NavLink({
  href,
  active,
  icon,
  children,
  onNavigate,
}: {
  href: string;
  active: boolean;
  icon: NavIconName;
  children: React.ReactNode;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium tracking-tight transition-all duration-200 ${
        active
          ? "bg-white/14 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_4px_16px_-4px_rgba(0,0,0,0.35)]"
          : "text-white/60 hover:bg-white/[0.07] hover:text-white/90"
      }`}
    >
      {active ? (
        <span
          className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-white/90 shadow-[0_0_8px_rgba(255,255,255,0.5)]"
          aria-hidden
        />
      ) : null}
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-200 ${
          active
            ? "bg-white/20 text-white"
            : "bg-white/[0.06] text-white/70 group-hover:bg-white/10 group-hover:text-white"
        }`}
      >
        <NavIcon name={icon} className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0 truncate">{children}</span>
    </Link>
  );
}

function NavSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 mt-5 first:mt-0 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
      {children}
    </p>
  );
}

function NavSectionBlurb({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 px-3 text-[11px] leading-relaxed text-white/45">{children}</p>
  );
}

function bottomNavClass(active: boolean) {
  return `relative flex flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-semibold leading-tight transition-all duration-200 min-w-0 ${
    active ? "text-brand" : "text-slate-400 hover:text-slate-600"
  }`;
}

function partnerHasCmsAccess(me: PortalMeResponse | null): boolean {
  if (!me?.venues?.length) return false;
  return me.venues.some((r) => r.role === "OWNER" || r.role === "MANAGER");
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

type PortalNavProps = {
  pathname: string | null;
  isSa: boolean;
  staffOnly: boolean;
  showManagementNav: boolean;
  showPartnerCmsLink: boolean;
  getToken: () => Promise<string | null>;
  actingVenueId: string | null;
  onPartnerContextChanged: () => void;
  onNavigate?: () => void;
  t: (key: string) => string;
};

function PortalNavLinks({
  pathname,
  isSa,
  staffOnly,
  showManagementNav,
  showPartnerCmsLink,
  getToken,
  actingVenueId,
  onPartnerContextChanged,
  onNavigate,
  t,
}: PortalNavProps) {
  if (isSa) {
    return (
      <>
        <NavSectionLabel>{t("admin.shell.sectionPlatform")}</NavSectionLabel>
        <div className="flex flex-col gap-0.5">
          <NavLink
            href="/platform"
            active={pathname === "/platform" || Boolean(pathname?.startsWith("/platform/"))}
            icon="overview"
            onNavigate={onNavigate}
          >
            {t("admin.shell.overview")}
          </NavLink>
          <NavLink
            href="/organizations"
            active={Boolean(pathname?.startsWith("/organizations"))}
            icon="organizations"
            onNavigate={onNavigate}
          >
            {t("admin.shell.organizations")}
          </NavLink>
          <NavLink
            href="/venues"
            active={
              pathname === "/venues" ||
              (Boolean(pathname?.startsWith("/venues/")) && !pathname?.startsWith("/owner"))
            }
            icon="venues"
            onNavigate={onNavigate}
          >
            {t("admin.shell.venuesCms")}
          </NavLink>
          <NavLink
            href="/words"
            active={Boolean(pathname?.startsWith("/words"))}
            icon="words"
            onNavigate={onNavigate}
          >
            {t("admin.shell.wordDeck")}
          </NavLink>
        </div>
        <NavSectionLabel>{t("admin.shell.sectionPartnerView")}</NavSectionLabel>
        <NavSectionBlurb>{t("admin.shell.partnerViewBlurb")}</NavSectionBlurb>
        <div className="flex flex-col gap-0.5">
          <NavLink
            href="/owner/venues"
            active={Boolean(pathname?.startsWith("/owner"))}
            icon="partner"
            onNavigate={onNavigate}
          >
            {t("admin.shell.partnerApp")}
          </NavLink>
        </div>
        <div className="mt-2 px-1">
          <SuperAdminVenuePicker
            getToken={getToken}
            actingVenueId={actingVenueId}
            onChanged={onPartnerContextChanged}
          />
        </div>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      <NavLink
        href="/owner/venues"
        active={partnerNavVenuesActive(pathname, staffOnly)}
        icon="locations"
        onNavigate={onNavigate}
      >
        {staffOnly ? t("admin.shell.staffLocations") : t("admin.shell.locationsHome")}
      </NavLink>
      {showManagementNav ? (
        <NavLink
          href="/owner/analytics"
          active={Boolean(pathname?.startsWith("/owner/analytics"))}
          icon="analytics"
          onNavigate={onNavigate}
        >
          {t("admin.shell.statistics")}
        </NavLink>
      ) : null}
      {showManagementNav ? (
        <NavLink
          href="/owner/subscriptions"
          active={Boolean(pathname?.startsWith("/owner/subscriptions"))}
          icon="subscriptions"
          onNavigate={onNavigate}
        >
          {t("admin.shell.subscriptions")}
        </NavLink>
      ) : null}
      {showPartnerCmsLink ? (
        <NavLink
          href="/venues"
          active={
            pathname === "/venues" ||
            (Boolean(pathname?.startsWith("/venues/")) && !pathname?.startsWith("/owner"))
          }
          icon="cms"
          onNavigate={onNavigate}
        >
          {t("admin.shell.locationsCms")}
        </NavLink>
      ) : null}
    </div>
  );
}

function PartnerMobileBottomNav({
  pathname,
  staffOnly,
  showManagementNav,
  showPartnerCmsLink,
  t,
}: Pick<
  PortalNavProps,
  "pathname" | "staffOnly" | "showManagementNav" | "showPartnerCmsLink" | "t"
>) {
  const items: { href: string; label: string; icon: NavIconName; active: boolean }[] = [
    {
      href: "/owner/venues",
      label: staffOnly ? t("admin.shell.staffLocations") : t("admin.shell.locationsHome"),
      icon: "locations",
      active: partnerNavVenuesActive(pathname, staffOnly),
    },
  ];

  if (showManagementNav) {
    items.push(
      {
        href: "/owner/analytics",
        label: t("admin.shell.statisticsShort"),
        icon: "analytics",
        active: Boolean(pathname?.startsWith("/owner/analytics")),
      },
      {
        href: "/owner/subscriptions",
        label: t("admin.shell.subscriptionsShort"),
        icon: "subscriptions",
        active: Boolean(pathname?.startsWith("/owner/subscriptions")),
      },
    );
  }

  if (showPartnerCmsLink) {
    items.push({
      href: "/venues",
      label: t("admin.shell.cmsShort"),
      icon: "cms",
      active:
        pathname === "/venues" ||
        (Boolean(pathname?.startsWith("/venues/")) && !pathname?.startsWith("/owner")),
    });
  }

  return (
    <nav
      className="lg:hidden fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 pointer-events-none"
      aria-label={t("admin.shell.mobileNav")}
    >
      <div className="pointer-events-auto mx-auto flex max-w-lg items-stretch gap-0.5 rounded-2xl border border-slate-200/80 bg-white/90 p-1 shadow-[0_8px_32px_-8px_rgb(20_51_104/0.25)] backdrop-blur-xl">
        {items.map((item) => (
          <Link key={item.href} href={item.href} className={bottomNavClass(item.active)}>
            {item.active ? (
              <span
                className="absolute top-1 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-brand"
                aria-hidden
              />
            ) : null}
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
                item.active ? "bg-brand/10 text-brand" : "text-slate-400"
              }`}
            >
              <NavIcon name={item.icon} className="h-[17px] w-[17px]" />
            </span>
            <span className="truncate max-w-full px-0.5 text-center">{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

export default function PortalShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTranslation();
  const { isLoaded, getToken } = useAuth();
  const invalidatePartnerContext = useInvalidatePartnerContext();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const meQ = usePortalMeQuery(getToken, isLoaded, {
    retry: 1,
  });
  const me = meQ.data ?? null;
  const err = meQ.isError
    ? meQ.error instanceof Error
      ? meQ.error.message
      : t("admin.shell.loadProfileError")
    : null;

  const trialOrganizations = useMemo((): PortalMeOrg[] => {
    if (!me?.venues) return [];
    const m = new Map<string, PortalMeOrg>();
    for (const row of me.venues) {
      const o = row.venue.organization;
      if (o) m.set(o.id, o);
    }
    return Array.from(m.values());
  }, [me?.venues]);

  const onboardingPathsWhileIncomplete = useMemo(() => {
    return pathname === "/onboarding" || Boolean(pathname?.startsWith("/owner/accept-invite"));
  }, [pathname]);

  useEffect(() => {
    if (!isLoaded || !me) return;
    if (me.needsPartnerOnboarding && !onboardingPathsWhileIncomplete) {
      router.replace("/onboarding");
    }
  }, [isLoaded, me, onboardingPathsWhileIncomplete, router]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-brand-lighter flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div
            className="h-9 w-9 rounded-xl bg-brand animate-pulse shadow-portal-card"
            aria-hidden
          />
          <p className="text-sm font-medium text-brand-muted">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (meQ.isPending && !meQ.data) {
    return (
      <div className="min-h-screen bg-brand-lighter flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div
            className="h-9 w-9 rounded-xl bg-brand animate-pulse shadow-portal-card"
            aria-hidden
          />
          <p className="text-sm font-medium text-brand-muted">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  const isSa = me?.platformRole === "SUPER_ADMIN";
  const staffOnly = !isSa && Boolean(me?.venues?.length) && !partnerHasManagementAccess(me?.venues);
  const showManagementNav = !isSa && !staffOnly;
  const showPartnerCmsLink = !isSa && partnerHasCmsAccess(me);
  const showPartnerBottomNav = !isSa;

  const isStreamlinedPartnerSetup =
    Boolean(me?.needsPartnerOnboarding) && onboardingPathsWhileIncomplete;

  const navProps: PortalNavProps = {
    pathname,
    isSa,
    staffOnly,
    showManagementNav,
    showPartnerCmsLink,
    getToken,
    actingVenueId: me?.actingPartnerVenueId ?? null,
    onPartnerContextChanged: () => {
      invalidatePartnerContext();
      void meQ.refetch();
    },
    t,
  };

  const brandHome = isSa ? "/platform" : "/owner/venues";

  if (isStreamlinedPartnerSetup) {
    return (
      <div className="min-h-screen text-slate-900 bg-gradient-to-br from-brand-lighter via-[var(--background)] to-white">
        <header className="sticky top-0 z-20 border-b border-slate-200/90 bg-white/90 backdrop-blur-md">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <Link href="/onboarding" className="flex min-w-0 items-center gap-3 group shrink-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-foreground text-xs font-bold tracking-tight shadow-md shadow-brand/30 transition-transform group-hover:scale-[1.02]">
                CS
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-brand leading-tight tracking-tight">
                  {t("admin.shell.brand")}
                </p>
                <p className="text-[11px] text-brand-muted font-medium mt-0.5 tracking-wide hidden sm:block">
                  {t("admin.shell.streamlinedOnboardingLead")}
                </p>
              </div>
            </Link>
            <div className="flex shrink-0 items-center gap-3 sm:gap-4">
              <AdminLanguageSelect variant="compact" />
              <UserButton
                appearance={{
                  elements: {
                    userButtonAvatarBox: "h-9 w-9 rounded-lg ring-2 ring-white shadow-sm",
                  },
                }}
              />
            </div>
          </div>
        </header>
        <main className="mx-auto min-h-[calc(100vh-3.5rem)] min-w-0">
          {err ? (
            <div className="m-4 rounded-2xl border border-red-200/90 bg-red-50/90 text-red-800 text-sm p-4 shadow-sm backdrop-blur-sm">
              {err}
            </div>
          ) : null}
          {children}
        </main>
      </div>
    );
  }

  const sidebarFooter = (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-sm">
      <AdminLanguageSelect variant="sidebar" />
      {me ? (
        <p className="mb-2 truncate text-xs font-medium text-white/80" title={me.email}>
          {me.email}
        </p>
      ) : null}
      {me?.platformRole === "SUPER_ADMIN" ? (
        <p className="mb-2 inline-flex items-center rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/70">
          {t("admin.shell.superAdminBadge")}
        </p>
      ) : null}
      <UserButton
        appearance={{
          elements: {
            userButtonAvatarBox: "h-8 w-8 rounded-lg ring-2 ring-white/20 shadow-sm",
          },
        }}
      />
    </div>
  );

  const sidebarBrand = (
    <Link href={brandHome} className="flex items-center gap-3 group">
      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-sm font-bold tracking-tight text-white shadow-[0_4px_16px_-4px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.2)] ring-1 ring-white/20 transition-transform duration-200 group-hover:scale-[1.03]">
        <span className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        <span className="relative">CS</span>
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold leading-tight tracking-tight text-white">
          {t("admin.shell.brand")}
        </p>
        <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-white/45">
          {isSa ? t("admin.shell.platformAdmin") : t("admin.shell.partnerPortal")}
        </p>
      </div>
    </Link>
  );

  return (
    <div className="min-h-screen text-slate-900">
      {/* Desktop sidebar */}
      <aside className="portal-sidebar hidden lg:flex fixed top-0 left-0 z-10 h-screen w-[17.5rem] flex-col overflow-hidden border-r border-white/[0.08]">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0a1a35] via-brand to-[#1a4585]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-16 top-0 h-48 w-48 rounded-full bg-white/[0.04] blur-3xl"
          aria-hidden
        />
        <div className="relative flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5">
          <div className="pb-1">{sidebarBrand}</div>
          <nav className="flex flex-col">
            <PortalNavLinks {...navProps} />
          </nav>
          <div className="mt-auto pt-4">{sidebarFooter}</div>
        </div>
      </aside>

      {/* Mobile drawer (super admin + overflow settings) */}
      {mobileNavOpen ? (
        <div className="lg:hidden fixed inset-0 z-40">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
            aria-label={t("admin.shell.closeMenu")}
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="portal-sidebar absolute top-0 left-0 bottom-0 flex w-[min(100vw-3rem,18rem)] flex-col overflow-hidden border-r border-white/[0.08] shadow-[4px_0_32px_-8px_rgba(0,0,0,0.4)]">
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a1a35] via-brand to-[#1a4585]" aria-hidden />
            <div className="relative flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3.5">
              <p className="text-sm font-semibold text-white">{t("admin.shell.menuTitle")}</p>
              <button
                type="button"
                className="rounded-lg p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                aria-label={t("admin.shell.closeMenu")}
                onClick={() => setMobileNavOpen(false)}
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="relative flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
              <nav className="flex flex-col">
                <PortalNavLinks {...navProps} onNavigate={() => setMobileNavOpen(false)} />
              </nav>
              <div className="mt-auto pt-2">{sidebarFooter}</div>
            </div>
          </aside>
        </div>
      ) : null}

      <div className="flex min-h-screen flex-col lg:ml-[17.5rem]">
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-20 flex items-center gap-2 border-b border-slate-200/80 bg-white/80 px-3 py-2.5 shadow-sm backdrop-blur-xl sm:px-4">
          {isSa ? (
            <button
              type="button"
              className="shrink-0 rounded-xl p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-brand"
              aria-label={t("admin.shell.openMenu")}
              aria-expanded={mobileNavOpen}
              onClick={() => setMobileNavOpen(true)}
            >
              <MenuIcon className="h-5 w-5" />
            </button>
          ) : (
            <div className="w-9 shrink-0" aria-hidden />
          )}
          <Link href={brandHome} className="flex min-w-0 flex-1 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand text-[10px] font-bold text-brand-foreground shadow-md shadow-brand/25">
              CS
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight text-brand">
                {t("admin.shell.brand")}
              </p>
              <p className="truncate text-[10px] font-medium text-brand-muted">
                {isSa ? t("admin.shell.platformAdmin") : t("admin.shell.partnerPortal")}
              </p>
            </div>
          </Link>
          <AdminLanguageSelect variant="compact" />
          <UserButton
            appearance={{
              elements: {
                userButtonAvatarBox: "h-8 w-8 rounded-lg ring-2 ring-white shadow-sm",
              },
            }}
          />
        </header>

        <main
          className={`min-h-0 min-w-0 flex-1 overflow-auto bg-gradient-to-br from-brand-lighter via-[var(--background)] to-white ${showPartnerBottomNav ? "pb-[calc(5.5rem+env(safe-area-inset-bottom))]" : ""}`}
        >
          {me && !me.needsPartnerOnboarding && me.platformRole !== "SUPER_ADMIN" ? (
            <TrialContactBar organizations={trialOrganizations} />
          ) : null}
          {err ? (
            <div className="m-4 lg:m-5 rounded-2xl border border-red-200/90 bg-red-50/90 text-red-800 text-sm p-4 shadow-sm backdrop-blur-sm">
              {err}
            </div>
          ) : null}
          {children}
        </main>
      </div>

      {showPartnerBottomNav ? (
        <PartnerMobileBottomNav
          pathname={pathname}
          staffOnly={staffOnly}
          showManagementNav={showManagementNav}
          showPartnerCmsLink={showPartnerCmsLink}
          t={t}
        />
      ) : null}
    </div>
  );
}

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

function navClass(active: boolean) {
  return `group flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium tracking-tight transition-all duration-200 ${active
    ? "bg-brand text-brand-foreground shadow-md shadow-brand/25"
    : "text-slate-600 hover:bg-brand-light/80 hover:text-brand border border-transparent"
    }`;
}

function bottomNavClass(active: boolean) {
  return `flex flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2.5 text-[10px] font-semibold leading-tight transition-colors min-w-0 ${active
    ? "text-brand"
    : "text-slate-500 hover:text-brand"
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

function linkClick(onNavigate?: () => void) {
  return onNavigate ? { onClick: onNavigate } : {};
}

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
  const click = linkClick(onNavigate);

  if (isSa) {
    return (
      <>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1 mb-1">
          {t("admin.shell.sectionPlatform")}
        </p>
        <Link
          href="/platform"
          className={navClass(pathname === "/platform" || Boolean(pathname?.startsWith("/platform/")))}
          {...click}
        >
          {t("admin.shell.overview")}
        </Link>
        <Link
          href="/organizations"
          className={navClass(Boolean(pathname?.startsWith("/organizations")))}
          {...click}
        >
          {t("admin.shell.organizations")}
        </Link>
        <Link
          href="/venues"
          className={navClass(
            pathname === "/venues" ||
              (Boolean(pathname?.startsWith("/venues/")) && !pathname?.startsWith("/owner")),
          )}
          {...click}
        >
          {t("admin.shell.venuesCms")}
        </Link>
        <Link href="/words" className={navClass(Boolean(pathname?.startsWith("/words")))} {...click}>
          {t("admin.shell.wordDeck")}
        </Link>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1 mt-4 mb-1">
          {t("admin.shell.sectionPartnerView")}
        </p>
        <p className="text-[11px] text-slate-500 px-1 leading-snug mb-1">
          {t("admin.shell.partnerViewBlurb")}
        </p>
        <Link
          href="/owner/venues"
          className={navClass(Boolean(pathname?.startsWith("/owner")))}
          {...click}
        >
          {t("admin.shell.partnerApp")}
        </Link>
        <SuperAdminVenuePicker
          getToken={getToken}
          actingVenueId={actingVenueId}
          onChanged={onPartnerContextChanged}
        />
      </>
    );
  }

  return (
    <>
      <Link
        href="/owner/venues"
        className={navClass(partnerNavVenuesActive(pathname, staffOnly))}
        {...click}
      >
        {staffOnly ? t("admin.shell.staffLocations") : t("admin.shell.locationsHome")}
      </Link>
      {showManagementNav ? (
        <Link
          href="/owner/analytics"
          className={navClass(Boolean(pathname?.startsWith("/owner/analytics")))}
          {...click}
        >
          {t("admin.shell.statistics")}
        </Link>
      ) : null}
      {showManagementNav ? (
        <Link
          href="/owner/subscriptions"
          className={navClass(Boolean(pathname?.startsWith("/owner/subscriptions")))}
          {...click}
        >
          {t("admin.shell.subscriptions")}
        </Link>
      ) : null}
      {showPartnerCmsLink ? (
        <Link
          href="/venues"
          className={navClass(
            pathname === "/venues" ||
              (Boolean(pathname?.startsWith("/venues/")) && !pathname?.startsWith("/owner")),
          )}
          {...click}
        >
          {t("admin.shell.locationsCms")}
        </Link>
      ) : null}
    </>
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
  const items: { href: string; label: string; active: boolean }[] = [
    {
      href: "/owner/venues",
      label: staffOnly ? t("admin.shell.staffLocations") : t("admin.shell.locationsHome"),
      active: partnerNavVenuesActive(pathname, staffOnly),
    },
  ];

  if (showManagementNav) {
    items.push(
      {
        href: "/owner/analytics",
        label: t("admin.shell.statisticsShort"),
        active: Boolean(pathname?.startsWith("/owner/analytics")),
      },
      {
        href: "/owner/subscriptions",
        label: t("admin.shell.subscriptionsShort"),
        active: Boolean(pathname?.startsWith("/owner/subscriptions")),
      },
    );
  }

  if (showPartnerCmsLink) {
    items.push({
      href: "/venues",
      label: t("admin.shell.cmsShort"),
      active:
        pathname === "/venues" ||
        (Boolean(pathname?.startsWith("/venues/")) && !pathname?.startsWith("/owner")),
    });
  }

  return (
    <nav
      className="lg:hidden fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/90 bg-white/95 backdrop-blur-md shadow-[0_-4px_24px_-8px_rgb(20_51_104/0.12)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label={t("admin.shell.mobileNav")}
    >
      <div className="flex max-w-lg mx-auto">
        {items.map((item) => (
          <Link key={item.href} href={item.href} className={bottomNavClass(item.active)}>
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
    <div className="rounded-xl border border-slate-200/90 bg-brand-lighter/80 px-3 py-3 shadow-sm">
      <AdminLanguageSelect />
      {me ? (
        <p className="mb-2 truncate text-xs font-medium text-slate-800" title={me.email}>
          {me.email}
        </p>
      ) : null}
      {me?.platformRole === "SUPER_ADMIN" ? (
        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand mb-2">
          {t("admin.shell.superAdminBadge")}
        </p>
      ) : null}
      <UserButton
        appearance={{
          elements: {
            userButtonAvatarBox: "h-8 w-8 rounded-lg ring-2 ring-white shadow-sm",
          },
        }}
      />
    </div>
  );

  return (
    <div className="min-h-screen text-slate-900">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed top-0 left-0 z-10 h-screen w-64 flex-col overflow-hidden border-r border-slate-200/90 bg-white shadow-portal-nav">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-brand/[0.07] to-transparent"
          aria-hidden
        />
        <div className="relative flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-5">
          <div>
            <Link href={brandHome} className="flex items-center gap-3 group">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-foreground text-sm font-bold tracking-tight shadow-md shadow-brand/30 transition-transform group-hover:scale-[1.02]">
                CS
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-brand leading-tight tracking-tight">
                  {t("admin.shell.brand")}
                </p>
                <p className="text-[11px] text-brand-muted font-medium mt-0.5 tracking-wide uppercase">
                  {isSa ? t("admin.shell.platformAdmin") : t("admin.shell.partnerPortal")}
                </p>
              </div>
            </Link>
          </div>
          <nav className="flex flex-col gap-1">
            <PortalNavLinks {...navProps} />
          </nav>
          <div className="mt-auto pt-4 space-y-3">{sidebarFooter}</div>
        </div>
      </aside>

      {/* Mobile drawer (super admin + overflow settings) */}
      {mobileNavOpen ? (
        <div className="lg:hidden fixed inset-0 z-40">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
            aria-label={t("admin.shell.closeMenu")}
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="absolute top-0 left-0 bottom-0 flex w-[min(100vw-3rem,18rem)] flex-col overflow-hidden border-r border-slate-200/90 bg-white shadow-portal-nav">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">{t("admin.shell.menuTitle")}</p>
              <button
                type="button"
                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
                aria-label={t("admin.shell.closeMenu")}
                onClick={() => setMobileNavOpen(false)}
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
              <nav className="flex flex-col gap-1">
                <PortalNavLinks {...navProps} onNavigate={() => setMobileNavOpen(false)} />
              </nav>
              <div className="mt-auto pt-2">{sidebarFooter}</div>
            </div>
          </aside>
        </div>
      ) : null}

      <div className="flex min-h-screen flex-col lg:ml-64">
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-20 flex items-center gap-2 border-b border-slate-200/90 bg-white/95 backdrop-blur-md px-3 py-2.5 sm:px-4">
          {isSa ? (
            <button
              type="button"
              className="shrink-0 rounded-lg p-2 text-slate-700 hover:bg-slate-100"
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
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-foreground text-[10px] font-bold shadow-sm">
              CS
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-brand leading-tight">
                {t("admin.shell.brand")}
              </p>
              <p className="truncate text-[10px] text-brand-muted font-medium">
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
          className={`min-h-0 min-w-0 flex-1 overflow-auto bg-gradient-to-br from-brand-lighter via-[var(--background)] to-white ${showPartnerBottomNav ? "pb-[calc(4.25rem+env(safe-area-inset-bottom))]" : ""}`}
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

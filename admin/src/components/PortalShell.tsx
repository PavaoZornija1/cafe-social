"use client";

import { UserButton, useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { AdminLanguageSelect } from "@/i18n/AdminLanguageSelect";
import { useInvalidatePartnerContext, usePortalMeQuery } from "@/lib/queries";
import type { PortalMeOrg, PortalMeResponse } from "../lib/portalApi";
import { TrialContactBar } from "./TrialContactBar";
import { SuperAdminVenuePicker } from "./SuperAdminVenuePicker";

function navClass(active: boolean) {
  return `group flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium tracking-tight transition-all duration-200 ${active
    ? "bg-brand text-brand-foreground shadow-md shadow-brand/25"
    : "text-slate-600 hover:bg-brand-light/80 hover:text-brand border border-transparent"
    }`;
}

function partnerHasCmsAccess(me: PortalMeResponse | null): boolean {
  if (!me?.venues?.length) return false;
  return me.venues.some((r) => r.role === "OWNER" || r.role === "MANAGER");
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

  useEffect(() => {
    if (!isLoaded || !me) return;
    if (me.needsPartnerOnboarding && pathname !== "/onboarding") {
      router.replace("/onboarding");
    }
  }, [isLoaded, me, pathname, router]);

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
  const showPartnerCmsLink = !isSa && partnerHasCmsAccess(me);

  return (
    <div className="min-h-screen text-slate-900">
      <aside className="fixed top-0 left-0 z-10 flex h-screen w-64 flex-col overflow-hidden border-r border-slate-200/90 bg-white shadow-portal-nav">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-brand/[0.07] to-transparent"
          aria-hidden
        />
        <div className="relative flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-5">
          <div>
            <Link
              href={isSa ? "/platform" : "/owner/venues"}
              className="flex items-center gap-3 group"
            >
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
            {isSa ? (
              <>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1 mb-1">
                  {t("admin.shell.sectionPlatform")}
                </p>
                <Link
                  href="/platform"
                  className={navClass(pathname === "/platform" || pathname?.startsWith("/platform/"))}
                >
                  {t("admin.shell.overview")}
                </Link>
                <Link
                  href="/organizations"
                  className={navClass(pathname?.startsWith("/organizations") ?? false)}
                >
                  {t("admin.shell.organizations")}
                </Link>
                <Link
                  href="/venues"
                  className={navClass(
                    pathname === "/venues" ||
                    (!!pathname?.startsWith("/venues/") && !pathname?.startsWith("/owner")),
                  )}
                >
                  {t("admin.shell.venuesCms")}
                </Link>
                <Link href="/words" className={navClass(pathname?.startsWith("/words") ?? false)}>
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
                  className={navClass(pathname?.startsWith("/owner") ?? false)}
                >
                  {t("admin.shell.partnerApp")}
                </Link>
                <SuperAdminVenuePicker
                  getToken={getToken}
                  actingVenueId={me?.actingPartnerVenueId ?? null}
                  onChanged={() => {
                    invalidatePartnerContext();
                    void meQ.refetch();
                  }}
                />
              </>
            ) : (
              <>
                <Link
                  href="/owner/venues"
                  className={navClass(pathname?.startsWith("/owner/venues") ?? false)}
                >
                  {t("admin.shell.venuesAndDashboard")}
                </Link>
                {showPartnerCmsLink ? (
                  <Link
                    href="/venues"
                    className={navClass(
                      pathname === "/venues" ||
                      (!!pathname?.startsWith("/venues/") &&
                        !pathname?.startsWith("/owner")),
                    )}
                  >
                    {t("admin.shell.locationsCms")}
                  </Link>
                ) : null}
              </>
            )}
          </nav>

          <div className="mt-auto pt-4 space-y-3">
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
          </div>
        </div>
      </aside>

      <main className="ml-64 min-h-screen min-w-0 overflow-auto bg-gradient-to-br from-brand-lighter via-[var(--background)] to-white">
        {me && !me.needsPartnerOnboarding && me.platformRole !== "SUPER_ADMIN" ? (
          <TrialContactBar organizations={trialOrganizations} />
        ) : null}
        {err ? (
          <div className="m-5 rounded-2xl border border-red-200/90 bg-red-50/90 text-red-800 text-sm p-4 shadow-sm backdrop-blur-sm">
            {err}
          </div>
        ) : null}
        {children}
      </main>
    </div>
  );
}

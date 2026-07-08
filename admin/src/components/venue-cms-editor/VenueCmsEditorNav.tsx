"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { VenueSectionIcon } from "@/components/owner-venue-dashboard/venueDashboardUi";
import type { VenueDashboardSectionKey } from "@/components/owner-venue-dashboard/types";
import type { VenueCmsSectionKey } from "./types";
import { venueCmsSectionPath } from "./utils";
import { useVenueCmsEditor } from "./VenueCmsEditorContext";

type NavItem = {
  key: VenueCmsSectionKey;
  labelKey: string;
  icon: VenueDashboardSectionKey | "settings";
  /** Direct staff upsert is a super-admin tool; partners manage staff via the Team invite flow. */
  superAdminOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { key: "settings", labelKey: "admin.venueCms.sectionNav.settings", icon: "settings" },
  { key: "nudges", labelKey: "admin.venueCms.sectionNav.nudges", icon: "campaigns" },
  { key: "offers", labelKey: "admin.venueCms.sectionNav.offers", icon: "offers" },
  { key: "perks", labelKey: "admin.venueCms.sectionNav.perks", icon: "perks" },
  { key: "challenges", labelKey: "admin.venueCms.sectionNav.challenges", icon: "challenges" },
  { key: "staff", labelKey: "admin.venueCms.sectionNav.staff", icon: "team", superAdminOnly: true },
];

function CmsNavIcon({ section }: { section: NavItem["icon"] }) {
  if (section === "settings") {
    return (
      <svg
        className="h-3.5 w-3.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>
    );
  }
  return <VenueSectionIcon section={section} className="h-3.5 w-3.5" />;
}

export function VenueCmsEditorNav() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { venueId, shellLoading, isSuperAdmin } = useVenueCmsEditor();

  const items = useMemo(
    () => NAV_ITEMS.filter((item) => !item.superAdminOnly || isSuperAdmin),
    [isSuperAdmin],
  );

  if (shellLoading) return null;

  return (
    <nav aria-label={t("admin.venueCms.sectionNav.ariaLabel")} className="sticky top-0 z-20 -mx-1 mb-6 pt-1">
      <div className="overflow-x-auto pb-1 scrollbar-thin">
        <ul className="inline-flex min-w-max gap-1 rounded-2xl border border-slate-200/80 bg-white/90 p-1.5 shadow-sm backdrop-blur-md">
          {items.map((item) => {
            const href = venueCmsSectionPath(venueId, item.key);
            const isActive =
              item.key === "settings"
                ? pathname === href || pathname === `${href}/`
                : pathname === href || pathname.startsWith(`${href}/`);

            return (
              <li key={item.key} className="shrink-0">
                <Link
                  href={href}
                  className={`group relative flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all duration-200 whitespace-nowrap ${
                    isActive
                      ? "bg-brand text-brand-foreground shadow-md shadow-brand/25"
                      : "text-slate-600 hover:bg-brand-lighter/70 hover:text-brand"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
                      isActive
                        ? "bg-white/20 text-brand-foreground"
                        : "bg-slate-100 text-slate-500 group-hover:bg-brand-light/80 group-hover:text-brand"
                    }`}
                  >
                    <CmsNavIcon section={item.icon} />
                  </span>
                  {t(item.labelKey)}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

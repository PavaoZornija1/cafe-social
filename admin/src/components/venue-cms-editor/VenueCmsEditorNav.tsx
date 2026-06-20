"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import type { VenueCmsSectionKey } from "./types";
import { venueCmsSectionPath } from "./utils";
import { useVenueCmsEditor } from "./VenueCmsEditorContext";

type NavItem = {
  key: VenueCmsSectionKey;
  labelKey: string;
};

const NAV_ITEMS: NavItem[] = [
  { key: "settings", labelKey: "admin.venueCms.sectionNav.settings" },
  { key: "nudges", labelKey: "admin.venueCms.sectionNav.nudges" },
  { key: "offers", labelKey: "admin.venueCms.sectionNav.offers" },
  { key: "perks", labelKey: "admin.venueCms.sectionNav.perks" },
  { key: "challenges", labelKey: "admin.venueCms.sectionNav.challenges" },
  { key: "staff", labelKey: "admin.venueCms.sectionNav.staff" },
];

export function VenueCmsEditorNav() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { venueId, shellLoading } = useVenueCmsEditor();

  if (shellLoading) return null;

  return (
    <nav
      aria-label="Venue CMS sections"
      className="sticky top-0 z-20 border-b border-slate-200/80 bg-slate-50/95 backdrop-blur px-4 sm:px-6 py-2"
    >
      <ul className="mx-auto flex max-w-5xl gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin">
        {NAV_ITEMS.map((item) => {
          const href = venueCmsSectionPath(venueId, item.key);
          const isActive =
            item.key === "settings"
              ? pathname === href || pathname === `${href}/`
              : pathname === href || pathname.startsWith(`${href}/`);

          return (
            <li key={item.key} className="shrink-0">
              <Link
                href={href}
                className={`inline-block rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? "border-brand/50 bg-brand-light/80 text-brand"
                    : "border-slate-200 bg-white text-slate-700 hover:border-brand/40 hover:text-brand"
                }`}
              >
                {t(item.labelKey)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

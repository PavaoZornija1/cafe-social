"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { isReceiptSubmissionsEnabled } from "@/lib/receiptSubmissionsFeature";
import type { VenueDashboardSectionKey } from "./types";
import { venueDashboardSectionPath } from "./utils";
import { useOwnerVenueDashboard } from "./OwnerVenueDashboardContext";
import { VenueSectionIcon } from "./venueDashboardUi";

type NavItem = {
  key: VenueDashboardSectionKey;
  labelKey: string;
  ownerOnly?: boolean;
  analyticsOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { key: "playbook", labelKey: "admin.partnerVenueDetail.sectionNav.playbook", analyticsOnly: true },
  { key: "analytics", labelKey: "admin.partnerVenueDetail.sectionNav.analytics", analyticsOnly: true },
  { key: "moderation", labelKey: "admin.partnerVenueDetail.sectionNav.moderation", analyticsOnly: true },
  { key: "team", labelKey: "admin.partnerVenueDetail.sectionNav.team", ownerOnly: true },
  { key: "campaigns", labelKey: "admin.partnerVenueDetail.sectionNav.campaigns", analyticsOnly: true },
  { key: "challenges", labelKey: "admin.partnerVenueDetail.sectionNav.challenges", analyticsOnly: true },
  { key: "perks", labelKey: "admin.partnerVenueDetail.sectionNav.perks", analyticsOnly: true },
  { key: "offers", labelKey: "admin.partnerVenueDetail.sectionNav.offers", analyticsOnly: true },
  { key: "receipts", labelKey: "admin.partnerVenueDetail.sectionNav.receipts", analyticsOnly: true },
  { key: "redemptions", labelKey: "admin.partnerVenueDetail.sectionNav.redemptions" },
];

export function OwnerVenueDashboardNav() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { venueId, metaRow, canAnalytics, isOwner } = useOwnerVenueDashboard();

  const items = useMemo(() => {
    if (!metaRow) return [];
    const receiptsEnabled = isReceiptSubmissionsEnabled();
    return NAV_ITEMS.filter((item) => {
      if (item.key === "receipts" && !receiptsEnabled) return false;
      if (item.ownerOnly && !isOwner) return false;
      if (item.analyticsOnly && !canAnalytics) return false;
      return true;
    });
  }, [metaRow, canAnalytics, isOwner]);

  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Venue dashboard sections"
      className="sticky top-0 z-20 -mx-1 mb-6 pt-1"
    >
      <div className="overflow-x-auto pb-1 scrollbar-thin">
        <ul className="inline-flex min-w-max gap-1 rounded-2xl border border-slate-200/80 bg-white/90 p-1.5 shadow-sm backdrop-blur-md">
          {items.map((item) => {
            const href = venueDashboardSectionPath(venueId, item.key);
            const isActive =
              item.key === "playbook"
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
                    <VenueSectionIcon section={item.key} className="h-3.5 w-3.5" />
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

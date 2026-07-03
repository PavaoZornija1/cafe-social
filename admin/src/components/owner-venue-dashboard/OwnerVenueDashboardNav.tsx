"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { isReceiptSubmissionsEnabled } from "@/lib/receiptSubmissionsFeature";
import type { VenueDashboardSectionKey } from "./types";
import { venueDashboardSectionPath } from "./utils";
import { useOwnerVenueDashboard } from "./OwnerVenueDashboardContext";

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
      className="sticky top-0 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 mb-2 bg-slate-50/95 backdrop-blur border-b border-slate-200/80"
    >
      <ul className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin">
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

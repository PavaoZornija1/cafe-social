"use client";

import { useTranslation } from "react-i18next";
import type { PartnerReadOnlyNotice } from "@/lib/partnerReadOnlyMessages";

function noticeKey(notice: PartnerReadOnlyNotice): string {
  return notice.kind === "key" ? notice.key : notice.text;
}

export function PartnerReadOnlyBanner({ notice }: { notice: PartnerReadOnlyNotice }) {
  const { t } = useTranslation();
  const body =
    notice.kind === "key" ? t(notice.key) : notice.text;

  return (
    <div className="rounded-2xl border border-amber-300/90 bg-amber-50/95 text-amber-950 px-4 py-3 text-sm shadow-sm">
      <p className="font-semibold">{t("admin.partnerReadOnly.viewOnlyTitle")}</p>
      <p className="mt-1 text-amber-950/90">{body}</p>
    </div>
  );
}

export { noticeKey };

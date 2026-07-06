"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  PortalAlert,
  PortalPageHeader,
  PortalPageLayout,
  PortalSkeleton,
} from "@/components/portal/PortalPageUi";
import { VenueCmsEditorNav } from "./VenueCmsEditorNav";
import { useVenueCmsEditor } from "./VenueCmsEditorContext";

export function VenueCmsEditorShell({
  children,
}: {
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const { venueId, title, shellLoading, loadError } = useVenueCmsEditor();

  return (
    <PortalPageLayout maxWidth="5xl">
      <PortalPageHeader
        backHref="/venues"
        backLabel={t("admin.venueCms.editor.backVenues")}
        title={title}
        meta={
          !shellLoading ? (
            <p className="font-mono text-xs text-slate-500">{venueId}</p>
          ) : null
        }
      />

      {shellLoading ? <PortalSkeleton rows={2} /> : null}

      {loadError ? (
        <PortalAlert tone="error" className="mb-5">
          {loadError}{" "}
          <Link href="/venues" className="font-medium text-brand hover:text-brand-hover">
            {t("admin.venueCms.editor.back")}
          </Link>
        </PortalAlert>
      ) : null}

      {!shellLoading && !loadError ? (
        <>
          <VenueCmsEditorNav />
          <div className="min-w-0 space-y-6 pb-8">{children}</div>
        </>
      ) : null}
    </PortalPageLayout>
  );
}

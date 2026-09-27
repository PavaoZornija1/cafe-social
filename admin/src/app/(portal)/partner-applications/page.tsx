"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  PortalCard,
  PortalPageHeader,
  PortalPageLayout,
  PortalSkeleton,
  portalInputClass,
  portalSelectClass,
} from "@/components/portal/PortalPageUi";
import { useAdminPartnerApplicationsQuery, usePortalMeQuery } from "@/lib/queries";

const PAGE_SIZE = 25;

export default function PartnerApplicationsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isLoaded, getToken } = useAuth();
  const meQ = usePortalMeQuery(getToken, isLoaded);
  const [status, setStatus] = useState<"" | "PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isLoaded || meQ.isPending) return;
    if (meQ.data?.platformRole !== "SUPER_ADMIN") {
      router.replace("/owner/venues");
    }
  }, [isLoaded, meQ.isPending, meQ.data?.platformRole, router]);

  const listQ = useAdminPartnerApplicationsQuery(getToken, isLoaded && meQ.data?.platformRole === "SUPER_ADMIN", {
    status: status || undefined,
    page,
    limit: PAGE_SIZE,
    search: search.trim() || undefined,
  });

  if (!isLoaded || meQ.isPending || meQ.data?.platformRole !== "SUPER_ADMIN") {
    return (
      <PortalPageLayout>
        <PortalSkeleton rows={4} />
      </PortalPageLayout>
    );
  }

  const total = listQ.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <PortalPageLayout>
      <PortalPageHeader
        title={t("admin.partnerApplications.title")}
        lead={t("admin.partnerApplications.lead")}
      />

      <PortalCard className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <select
            className={portalSelectClass}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as typeof status);
              setPage(1);
            }}
          >
            <option value="PENDING">{t("admin.partnerApplications.statusPending")}</option>
            <option value="APPROVED">{t("admin.partnerApplications.statusApproved")}</option>
            <option value="REJECTED">{t("admin.partnerApplications.statusRejected")}</option>
            <option value="">{t("admin.partnerApplications.statusAll")}</option>
          </select>
          <input
            className={`${portalInputClass} min-w-[200px] flex-1`}
            placeholder={t("admin.partnerApplications.searchPlaceholder")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        {listQ.isError ? (
          <p className="text-sm text-red-700">{(listQ.error as Error).message}</p>
        ) : listQ.isPending ? (
          <PortalSkeleton rows={5} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-600">
                  <th className="py-2 pr-4 font-medium">{t("admin.partnerApplications.colVenue")}</th>
                  <th className="py-2 pr-4 font-medium">{t("admin.partnerApplications.colContact")}</th>
                  <th className="py-2 pr-4 font-medium">{t("admin.partnerApplications.colLocation")}</th>
                  <th className="py-2 pr-4 font-medium">{t("admin.partnerApplications.colStatus")}</th>
                  <th className="py-2 font-medium">{t("admin.partnerApplications.colSubmitted")}</th>
                </tr>
              </thead>
              <tbody>
                {(listQ.data?.items ?? []).map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                    <td className="py-3 pr-4">
                      <Link
                        href={`/partner-applications/${row.id}`}
                        className="font-medium text-brand hover:underline"
                      >
                        {row.venueName}
                      </Link>
                    </td>
                    <td className="py-3 pr-4">
                      <div>{row.applicantName}</div>
                      <div className="text-xs text-slate-500">{row.applicantEmail}</div>
                    </td>
                    <td className="py-3 pr-4 text-slate-600">
                      {row.city}, {row.country}
                    </td>
                    <td className="py-3 pr-4">{row.status}</td>
                    <td className="py-3 text-slate-600">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {listQ.data?.items.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">
                {t("admin.partnerApplications.empty")}
              </p>
            ) : null}
          </div>
        )}

        {totalPages > 1 ? (
          <div className="flex items-center justify-between pt-2 text-sm">
            <button
              type="button"
              disabled={page <= 1}
              className="text-brand disabled:opacity-40"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              {t("admin.partnerApplications.prevPage")}
            </button>
            <span className="text-slate-600">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              className="text-brand disabled:opacity-40"
              onClick={() => setPage((p) => p + 1)}
            >
              {t("admin.partnerApplications.nextPage")}
            </button>
          </div>
        ) : null}
      </PortalCard>
    </PortalPageLayout>
  );
}

"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { portalFetch } from "@/lib/portalApi";
import { queryKeys } from "@/lib/queries/keys";
import {
  PortalAlert,
  PortalCard,
  PortalPageHeader,
  PortalPageLayout,
  PortalSkeleton,
} from "@/components/portal/PortalPageUi";

type Report = {
  id: string;
  reason: string;
  note: string | null;
  createdAt: string;
  reporter: { username: string };
  reportedPlayer: { username: string };
};

export default function PlayerReportsPage() {
  const { getToken, isLoaded } = useAuth();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const reports = useQuery({
    queryKey: queryKeys.admin.playerReports,
    queryFn: () => portalFetch<Report[]>(getToken, "/admin/player-reports"),
    enabled: isLoaded,
  });
  const resolve = useMutation({
    mutationFn: ({
      id,
      resetUsername,
    }: {
      id: string;
      resetUsername: boolean;
    }) =>
      portalFetch(getToken, `/admin/player-reports/${id}/resolve`, {
        method: "POST",
        body: JSON.stringify({
          resetUsername,
          note: notes[id]?.trim() || undefined,
        }),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.admin.playerReports }),
  });
  return (
    <PortalPageLayout>
      <PortalPageHeader
        title={t("admin.playerReports.title")}
        lead={t("admin.playerReports.lead")}
      />
      {reports.isLoading ? <PortalSkeleton rows={3} /> : null}
      {reports.isError || resolve.isError ? (
        <PortalAlert tone="error">
          {String((reports.error ?? resolve.error)?.message)}
        </PortalAlert>
      ) : null}
      {reports.data?.length === 0 ? (
        <p>{t("admin.playerReports.empty")}</p>
      ) : null}
      <div className="space-y-4">
        {reports.data?.map((report) => (
          <PortalCard key={report.id}>
            <h2 className="font-semibold">{report.reportedPlayer.username}</h2>
            <p className="text-sm text-slate-500">
              {report.reporter.username} ·{" "}
              {new Date(report.createdAt).toLocaleString()}
            </p>
            <p className="mt-3 whitespace-pre-wrap break-words">
              {report.reason}
            </p>
            {report.note ? (
              <p className="mt-2 whitespace-pre-wrap break-words">
                {report.note}
              </p>
            ) : null}
            <label className="mt-4 block text-sm">
              {t("admin.playerReports.note")}
              <textarea
                className="mt-1 block w-full rounded border p-2"
                maxLength={500}
                value={notes[report.id] ?? ""}
                onChange={(e) =>
                  setNotes({ ...notes, [report.id]: e.target.value })
                }
              />
            </label>
            <div className="mt-3 flex flex-wrap gap-4">
              <button
                className="rounded border px-3 py-2"
                disabled={resolve.isPending}
                onClick={() =>
                  resolve.mutate({ id: report.id, resetUsername: false })
                }
              >
                {t("admin.playerReports.dismiss")}
              </button>
              <button
                className="rounded border px-3 py-2 text-red-700"
                disabled={resolve.isPending}
                onClick={() => {
                  if (
                    window.confirm(
                      t("admin.playerReports.resetConfirm", {
                        username: report.reportedPlayer.username,
                      }),
                    )
                  )
                    resolve.mutate({ id: report.id, resetUsername: true });
                }}
              >
                {t("admin.playerReports.reset")}
              </button>
            </div>
          </PortalCard>
        ))}
      </div>
    </PortalPageLayout>
  );
}

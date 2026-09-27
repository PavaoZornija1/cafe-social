"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { GeofencePolygonGeoJson } from "@/components/VenueGeofenceMap";
import { ConfirmModal } from "@/components/ConfirmModal";
import {
  PortalAlert,
  PortalCard,
  PortalPageHeader,
  PortalPageLayout,
  PortalSkeleton,
  portalButtonPrimaryClass,
  portalButtonSecondaryClass,
  portalInputClass,
  portalLabelClass,
} from "@/components/portal/PortalPageUi";
import {
  useAdminApprovePartnerApplicationMutation,
  useAdminPartnerApplicationQuery,
  useAdminRejectPartnerApplicationMutation,
  usePortalMeQuery,
} from "@/lib/queries";

const VenueGeofenceMap = dynamic(() => import("@/components/VenueGeofenceMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[min(420px,55vh)] w-full rounded-xl border border-slate-200 bg-slate-100 animate-pulse" />
  ),
});

const DEFAULT_PIN = { lat: 46.0569, lng: 14.5058 };

export default function PartnerApplicationDetailPage() {
  const { t } = useTranslation();
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : undefined;
  const router = useRouter();
  const { isLoaded, getToken } = useAuth();
  const meQ = usePortalMeQuery(getToken, isLoaded);

  const [geoPin, setGeoPin] = useState(DEFAULT_PIN);
  const [geoPolygon, setGeoPolygon] = useState<GeofencePolygonGeoJson | null>(null);
  const [organizationName, setOrganizationName] = useState("");
  const [venueNameOverride, setVenueNameOverride] = useState("");
  const [locationKind, setLocationKind] = useState<"SINGLE_LOCATION" | "MULTI_LOCATION">(
    "SINGLE_LOCATION",
  );
  const [analyticsTimeZone, setAnalyticsTimeZone] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [actionErr, setActionErr] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || meQ.isPending) return;
    if (meQ.data?.platformRole !== "SUPER_ADMIN") {
      router.replace("/owner/venues");
    }
  }, [isLoaded, meQ.isPending, meQ.data?.platformRole, router]);

  const detailQ = useAdminPartnerApplicationQuery(
    getToken,
    isLoaded && meQ.data?.platformRole === "SUPER_ADMIN",
    id,
  );

  const app = detailQ.data;

  useEffect(() => {
    if (!app) return;
    setVenueNameOverride(app.venueName);
    setOrganizationName(app.organizationName ?? app.venueName);
    if (app.locationKind) setLocationKind(app.locationKind);
    if (app.analyticsTimeZone) setAnalyticsTimeZone(app.analyticsTimeZone);
    if (app.latitude != null && app.longitude != null) {
      setGeoPin({ lat: app.latitude, lng: app.longitude });
    }
    if (app.geofencePolygon && app.geofencePolygon.type === "Polygon") {
      setGeoPolygon(app.geofencePolygon as GeofencePolygonGeoJson);
    }
  }, [app]);

  const approveMut = useAdminApprovePartnerApplicationMutation(getToken, id);
  const rejectMut = useAdminRejectPartnerApplicationMutation(getToken, id);

  const onPinChange = useCallback((p: { lat: number; lng: number }) => {
    setGeoPin(p);
  }, []);

  const onPolygonChange = useCallback((g: GeofencePolygonGeoJson | null) => {
    setGeoPolygon(g);
  }, []);

  async function handleApprove() {
    if (!geoPolygon) {
      setActionErr(t("admin.partnerApplications.errorNoPolygon"));
      return;
    }
    setActionErr(null);
    try {
      await approveMut.mutateAsync({
        latitude: geoPin.lat,
        longitude: geoPin.lng,
        geofencePolygon: geoPolygon,
        organizationName: organizationName.trim() || undefined,
        venueName: venueNameOverride.trim() || undefined,
        locationKind,
        ...(analyticsTimeZone.trim() && { analyticsTimeZone: analyticsTimeZone.trim() }),
      });
      router.push("/partner-applications");
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : t("admin.partnerApplications.errorGeneric"));
    }
  }

  async function handleReject() {
    setActionErr(null);
    try {
      await rejectMut.mutateAsync(rejectReason.trim() || undefined);
      setRejectOpen(false);
      router.push("/partner-applications");
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : t("admin.partnerApplications.errorGeneric"));
    }
  }

  if (!isLoaded || meQ.isPending || meQ.data?.platformRole !== "SUPER_ADMIN") {
    return (
      <PortalPageLayout>
        <PortalSkeleton rows={4} />
      </PortalPageLayout>
    );
  }

  if (detailQ.isPending) {
    return (
      <PortalPageLayout>
        <PortalSkeleton rows={6} />
      </PortalPageLayout>
    );
  }

  if (!app) {
    return (
      <PortalPageLayout>
        <PortalAlert tone="error">{t("admin.partnerApplications.notFound")}</PortalAlert>
      </PortalPageLayout>
    );
  }

  const isPending = app.status === "PENDING";

  return (
    <PortalPageLayout>
      <PortalPageHeader title={app.venueName} lead={t("admin.partnerApplications.detailLead")}>
        <Link href="/partner-applications" className={portalButtonSecondaryClass}>
          {t("admin.partnerApplications.backToList")}
        </Link>
      </PortalPageHeader>

      {actionErr ? <PortalAlert tone="error">{actionErr}</PortalAlert> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <PortalCard className="space-y-3 text-sm">
          <h2 className="font-semibold text-slate-900">{t("admin.partnerApplications.sectionContact")}</h2>
          <p>
            <span className="text-slate-500">{t("admin.partnerApplications.fieldName")}: </span>
            {app.applicantName}
          </p>
          <p>
            <span className="text-slate-500">{t("admin.partnerApplications.fieldEmail")}: </span>
            {app.applicantEmail}
          </p>
          {app.applicantPhone ? (
            <p>
              <span className="text-slate-500">{t("admin.partnerApplications.fieldPhone")}: </span>
              {app.applicantPhone}
            </p>
          ) : null}
          <p className="pt-2">
            <span className="text-slate-500">{t("admin.partnerApplications.fieldAddress")}: </span>
            {app.address}, {app.city}, {app.country}
          </p>
          <p>
            <span className="text-slate-500">{t("admin.partnerApplications.fieldStatus")}: </span>
            {app.status}
          </p>
          {app.rejectionReason ? (
            <p className="text-amber-900">{app.rejectionReason}</p>
          ) : null}
          {app.createdVenueId ? (
            <p>
              <Link href={`/venues/${app.createdVenueId}`} className="text-brand hover:underline">
                {t("admin.partnerApplications.openVenueCms")}
              </Link>
            </p>
          ) : null}
        </PortalCard>

        {isPending ? (
          <PortalCard className="space-y-4">
            <h2 className="font-semibold text-slate-900">{t("admin.partnerApplications.sectionProvision")}</h2>
            <label className="block">
              <span className={portalLabelClass}>{t("admin.partnerApplications.fieldVenueName")}</span>
              <input
                className={`${portalInputClass} mt-1 w-full`}
                value={venueNameOverride}
                onChange={(e) => setVenueNameOverride(e.target.value)}
              />
            </label>
            <label className="block">
              <span className={portalLabelClass}>{t("admin.partnerApplications.fieldOrgName")}</span>
              <input
                className={`${portalInputClass} mt-1 w-full`}
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
              />
            </label>
            <label className="block">
              <span className={portalLabelClass}>{t("admin.partnerApplications.fieldLocationKind")}</span>
              <select
                className={`${portalInputClass} mt-1 w-full`}
                value={locationKind}
                onChange={(e) =>
                  setLocationKind(e.target.value as "SINGLE_LOCATION" | "MULTI_LOCATION")
                }
              >
                <option value="SINGLE_LOCATION">{t("admin.partnerApplications.singleLocation")}</option>
                <option value="MULTI_LOCATION">{t("admin.partnerApplications.multiLocation")}</option>
              </select>
            </label>
            <label className="block">
              <span className={portalLabelClass}>{t("admin.partnerApplications.fieldTimezone")}</span>
              <input
                className={`${portalInputClass} mt-1 w-full`}
                placeholder="Europe/Zagreb"
                value={analyticsTimeZone}
                onChange={(e) => setAnalyticsTimeZone(e.target.value)}
              />
            </label>
          </PortalCard>
        ) : null}
      </div>

      {isPending ? (
        <PortalCard className="mt-6 space-y-4">
          <h2 className="font-semibold text-slate-900">{t("admin.partnerApplications.sectionGeofence")}</h2>
          <p className="text-sm text-slate-600">{t("admin.partnerApplications.geofenceHint")}</p>
          <VenueGeofenceMap
            pin={geoPin}
            onPinChange={onPinChange}
            onPolygonChange={onPolygonChange}
            initialPolygon={geoPolygon}
            searchCountryBias={app.country.length === 2 ? app.country : undefined}
            hideInstructions={false}
          />
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              className={portalButtonPrimaryClass}
              disabled={!geoPolygon || approveMut.isPending}
              onClick={() => void handleApprove()}
            >
              {approveMut.isPending
                ? t("admin.partnerApplications.approving")
                : t("admin.partnerApplications.approve")}
            </button>
            <button
              type="button"
              className={portalButtonSecondaryClass}
              disabled={rejectMut.isPending}
              onClick={() => setRejectOpen(true)}
            >
              {t("admin.partnerApplications.reject")}
            </button>
          </div>
        </PortalCard>
      ) : null}

      <ConfirmModal
        open={rejectOpen}
        title={t("admin.partnerApplications.rejectTitle")}
        description={
          <>
            <p>{t("admin.partnerApplications.rejectDescription")}</p>
            <label className="mt-4 block text-left">
              <span className={portalLabelClass}>{t("admin.partnerApplications.rejectReason")}</span>
              <textarea
                className={`${portalInputClass} mt-1 w-full min-h-[80px]`}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </label>
          </>
        }
        confirmLabel={t("admin.partnerApplications.rejectConfirm")}
        cancelLabel={t("common.cancel")}
        variant="danger"
        onClose={() => setRejectOpen(false)}
        onConfirm={() => handleReject()}
      />
    </PortalPageLayout>
  );
}

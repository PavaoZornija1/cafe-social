"use client";

import { type LeafletEvent } from "leaflet";
import { L } from "./leaflet-geoman-client";
import { useCallback, useEffect, useRef } from "react";
import { Trans, useTranslation } from "react-i18next";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";

export type GeofencePolygonGeoJson = { type: "Polygon"; coordinates: number[][][] };

export const ARRIVAL_RADIUS_PRESETS = [50, 100, 200] as const;
export const ARRIVAL_RADIUS_MIN = 25;
export const ARRIVAL_RADIUS_MAX = 500;

export type VenueGeofenceMapProps = {
  pin: { lat: number; lng: number };
  onPinChange: (p: { lat: number; lng: number }) => void;
  onPolygonChange: (g: GeofencePolygonGeoJson | null) => void;
  /** When provided, the map draws this polygon for editing (e.g. venue CMS). */
  initialPolygon?: GeofencePolygonGeoJson | null;
  /** Parent provides its own heading / copy above the map. */
  hideInstructions?: boolean;
  className?: string;
  /** Super-admin only: marketing arrival ring centered on pin. */
  arrivalRadiusMeters?: number;
  onArrivalRadiusChange?: (m: number) => void;
  proximityAlertsEnabled?: boolean;
  onProximityAlertsEnabledChange?: (enabled: boolean) => void;
};

function FixLeafletIcons() {
  useEffect(() => {
    const proto = L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown };
    delete proto._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
      iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
      shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    });
  }, []);
  return null;
}

function GeomanController({ onPolygonChange }: { onPolygonChange: (g: GeofencePolygonGeoJson | null) => void }) {
  const map = useMap();
  const onPolygonChangeRef = useRef(onPolygonChange);
  onPolygonChangeRef.current = onPolygonChange;

  useEffect(() => {
    const m = map as L.Map & {
      pm: {
        addControls: (opts: Record<string, unknown>) => void;
        removeControls: () => void;
      };
    };

    m.pm.addControls({
      position: "topleft",
      drawMarker: false,
      drawCircle: false,
      drawCircleMarker: false,
      drawPolyline: false,
      drawRectangle: false,
      drawText: false,
      drawPolygon: true,
      editMode: true,
      dragMode: false,
      cutPolygon: false,
      removalMode: true,
      rotateMode: false,
    });

    const extractPolygon = (layer: L.Layer): GeofencePolygonGeoJson | null => {
      if (!(layer instanceof L.Polygon)) return null;
      const gj = layer.toGeoJSON();
      if (gj.type === "Feature" && gj.geometry?.type === "Polygon") {
        return {
          type: "Polygon",
          coordinates: gj.geometry.coordinates as number[][][],
        };
      }
      return null;
    };

    const onCreate = (e: { layer: L.Layer }) => {
      const layer = e.layer;
      map.eachLayer((ly) => {
        if (ly instanceof L.Polygon && ly !== layer) {
          map.removeLayer(ly);
        }
      });
      const poly = extractPolygon(layer);
      onPolygonChangeRef.current(poly);
    };

    const onUpdate = (e: { layer: L.Layer }) => {
      const poly = extractPolygon(e.layer);
      onPolygonChangeRef.current(poly);
    };

    const onRemove = () => {
      onPolygonChangeRef.current(null);
    };

    map.on("pm:create", onCreate);
    map.on("pm:update", onUpdate);
    map.on("pm:remove", onRemove);

    return () => {
      map.off("pm:create", onCreate);
      map.off("pm:update", onUpdate);
      map.off("pm:remove", onRemove);
      try {
        m.pm.removeControls();
      } catch {
        /* ignore */
      }
    };
  }, [map]);

  return null;
}

/** Draws an existing GeoJSON polygon once (first paint snapshot) so Geoman can edit it. */
function SeedPolygonLayer({
  initialPolygon,
}: {
  initialPolygon: GeofencePolygonGeoJson | null | undefined;
}) {
  const map = useMap();
  const seededKeyRef = useRef(
    initialPolygon?.type === "Polygon" && Array.isArray(initialPolygon.coordinates)
      ? JSON.stringify(initialPolygon.coordinates)
      : "",
  );

  useEffect(() => {
    const seededKey = seededKeyRef.current;
    if (!seededKey) return;
    const coords = JSON.parse(seededKey) as number[][][];
    const ring = coords[0];
    if (!ring?.length) return;
    const latLngs = ring.map(([lng, lat]) => L.latLng(lat, lng));
    if (latLngs.length < 3) return;

    const poly = L.polygon(latLngs);
    poly.addTo(map);
    const withPm = poly as unknown as { pm?: { enable: () => void } };
    queueMicrotask(() => withPm.pm?.enable?.());

    try {
      map.fitBounds(poly.getBounds(), { padding: [40, 40], maxZoom: 18 });
    } catch {
      /* ignore invalid bounds */
    }

    return () => {
      map.removeLayer(poly);
    };
  }, [map]);

  return null;
}

function ArrivalCircleLayer({
  pin,
  radiusMeters,
}: {
  pin: { lat: number; lng: number };
  radiusMeters: number;
}) {
  const map = useMap();

  useEffect(() => {
    const circle = L.circle([pin.lat, pin.lng], {
      radius: radiusMeters,
      color: "#d97706",
      weight: 2,
      fillColor: "#fbbf24",
      fillOpacity: 0.12,
      interactive: false,
    });
    circle.addTo(map);
    return () => {
      map.removeLayer(circle);
    };
  }, [map, pin.lat, pin.lng, radiusMeters]);

  return null;
}

function clampArrivalRadiusMeters(n: number): number {
  if (!Number.isFinite(n)) return 100;
  return Math.round(Math.min(ARRIVAL_RADIUS_MAX, Math.max(ARRIVAL_RADIUS_MIN, n)));
}

function MapInstructions() {
  const { t } = useTranslation();
  const steps: { n: number; key: string }[] = [
    { n: 1, key: "admin.venueCms.geofence.instruction1" },
    { n: 2, key: "admin.venueCms.geofence.instruction2" },
    { n: 3, key: "admin.venueCms.geofence.instruction3" },
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 sm:px-4 sm:py-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {t("admin.venueCms.geofence.mapTitle")}
      </p>
      <ul className="mt-3 space-y-3">
        {steps.map(({ n, key }) => (
          <li key={n} className="flex gap-3 text-sm leading-snug text-slate-700">
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700 ring-1 ring-slate-200/80"
              aria-hidden
            >
              {n}
            </span>
            <span className="min-w-0 pt-0.5">
              <Trans
                i18nKey={key}
                components={{ bold: <strong className="font-semibold text-slate-900" /> }}
              />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function VenueGeofenceMap({
  pin,
  onPinChange,
  onPolygonChange,
  initialPolygon,
  hideInstructions = false,
  className = "",
  arrivalRadiusMeters = 100,
  onArrivalRadiusChange,
  proximityAlertsEnabled = true,
  onProximityAlertsEnabledChange,
}: VenueGeofenceMapProps) {
  const { t } = useTranslation();
  const onDragEnd = useCallback(
    (e: LeafletEvent) => {
      const m = e.target as L.Marker;
      const { lat, lng } = m.getLatLng();
      onPinChange({ lat, lng });
    },
    [onPinChange],
  );

  const showArrivalControls = Boolean(onArrivalRadiusChange);
  const radius = clampArrivalRadiusMeters(arrivalRadiusMeters);
  const presetActive = (ARRIVAL_RADIUS_PRESETS as readonly number[]).includes(radius);

  return (
    <div className={`space-y-3 ${className}`.trim()}>
      {hideInstructions ? null : <MapInstructions />}
      {showArrivalControls ? (
        <div className="rounded-xl border border-amber-200/90 bg-amber-50/80 px-3 py-3 sm:px-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-900/80">
                {t("admin.venueCms.geofence.arrivalTitle")}
              </p>
              <p className="mt-1 text-xs leading-snug text-amber-950/80">
                {t("admin.venueCms.geofence.arrivalLead")}
              </p>
            </div>
            {onProximityAlertsEnabledChange ? (
              <label className="flex items-center gap-2 text-sm font-medium text-amber-950">
                <input
                  type="checkbox"
                  checked={proximityAlertsEnabled}
                  onChange={(e) => onProximityAlertsEnabledChange(e.target.checked)}
                  className="rounded border-amber-300 text-amber-700 focus:ring-amber-500"
                />
                {t("admin.venueCms.geofence.enabled")}
              </label>
            ) : null}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {ARRIVAL_RADIUS_PRESETS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onArrivalRadiusChange?.(m)}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  radius === m
                    ? "bg-amber-600 text-white shadow-sm"
                    : "bg-white text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100"
                }`}
              >
                {m} m
              </button>
            ))}
            <label className="flex items-center gap-2 text-sm text-amber-950">
              <span className="font-medium">{t("admin.venueCms.geofence.custom")}</span>
              <input
                type="number"
                min={ARRIVAL_RADIUS_MIN}
                max={ARRIVAL_RADIUS_MAX}
                step={5}
                value={presetActive ? "" : radius}
                placeholder={presetActive ? String(radius) : undefined}
                onChange={(e) => {
                  const raw = e.target.value.trim();
                  if (!raw) return;
                  const n = Number.parseInt(raw, 10);
                  if (Number.isFinite(n)) onArrivalRadiusChange?.(clampArrivalRadiusMeters(n));
                }}
                className="w-20 rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
              <span className="text-xs text-amber-900/70">{t("admin.venueCms.geofence.metersUnit")}</span>
            </label>
            <span className="self-center text-xs font-medium text-amber-900/70">
              {t("admin.venueCms.geofence.metersFromPin", { radius })}
            </span>
          </div>
        </div>
      ) : null}
      <div className="h-[min(400px,50vh)] min-h-[260px] w-full rounded-xl border border-slate-200 overflow-hidden bg-slate-100 shadow-inner ring-1 ring-black/[0.04]">
        <MapContainer
          center={[pin.lat, pin.lng]}
          zoom={18}
          className="z-0 h-full w-full [&_.leaflet-container]:z-0 [&_.leaflet-container]:h-full [&_.leaflet-control]:text-sm"
          scrollWheelZoom
        >
          <FixLeafletIcons />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker
            position={[pin.lat, pin.lng]}
            draggable
            eventHandlers={{ dragend: onDragEnd }}
          />
          <GeomanController onPolygonChange={onPolygonChange} />
          <SeedPolygonLayer initialPolygon={initialPolygon ?? null} />
          {showArrivalControls && proximityAlertsEnabled ? (
            <ArrivalCircleLayer pin={pin} radiusMeters={radius} />
          ) : null}
        </MapContainer>
      </div>
    </div>
  );
}

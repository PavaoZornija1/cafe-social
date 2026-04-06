"use client";

import { type LeafletEvent } from "leaflet";
import { L } from "./leaflet-geoman-client";
import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";

export type GeofencePolygonGeoJson = { type: "Polygon"; coordinates: number[][][] };

export type VenueGeofenceMapProps = {
  pin: { lat: number; lng: number };
  onPinChange: (p: { lat: number; lng: number }) => void;
  onPolygonChange: (g: GeofencePolygonGeoJson | null) => void;
  /** When provided, the map draws this polygon for editing (e.g. venue CMS). */
  initialPolygon?: GeofencePolygonGeoJson | null;
  /** Parent provides its own heading / copy above the map. */
  hideInstructions?: boolean;
  className?: string;
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

function MapInstructionsBold({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-slate-900">{children}</strong>;
}

function MapInstructions() {
  const steps: { n: number; text: ReactNode }[] = [
    {
      n: 1,
      text: (
        <>
          Drag the blue <MapInstructionsBold>pin</MapInstructionsBold> to your venue entrance or main reference point.
        </>
      ),
    },
    {
      n: 2,
      text: (
        <>
          In the toolbar (top-left), open <MapInstructionsBold>Draw polygon</MapInstructionsBold>. Click each corner of the
          play area; finish by clicking the first point again.
        </>
      ),
    },
    {
      n: 3,
      text: (
        <>
          The pin must sit <MapInstructionsBold>inside</MapInstructionsBold> the polygon. Adjust with the edit tools, or remove with the
          trash icon and draw again.
        </>
      ),
    },
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 sm:px-4 sm:py-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Map &amp; geofence</p>
      <ul className="mt-3 space-y-3">
        {steps.map(({ n, text }) => (
          <li key={n} className="flex gap-3 text-sm leading-snug text-slate-700">
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700 ring-1 ring-slate-200/80"
              aria-hidden
            >
              {n}
            </span>
            <span className="min-w-0 pt-0.5">{text}</span>
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
}: VenueGeofenceMapProps) {
  const onDragEnd = useCallback(
    (e: LeafletEvent) => {
      const m = e.target as L.Marker;
      const { lat, lng } = m.getLatLng();
      onPinChange({ lat, lng });
    },
    [onPinChange],
  );

  return (
    <div className={`space-y-3 ${className}`.trim()}>
      {hideInstructions ? null : <MapInstructions />}
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
        </MapContainer>
      </div>
    </div>
  );
}

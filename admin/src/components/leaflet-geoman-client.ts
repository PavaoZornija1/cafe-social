/**
 * Geoman's bundle expects global `L` when the module evaluates.
 * Static `import "@geoman-io/leaflet-geoman-free"` before Leaflet can run causes `L is not defined`.
 */
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";

if (typeof window !== "undefined") {
  (window as unknown as { L: typeof L }).L = L;
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- load only after window.L is set
  require("@geoman-io/leaflet-geoman-free");
}

export { L };

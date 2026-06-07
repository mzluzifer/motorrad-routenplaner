// Baut eine GPX-Datei aus Track-Geometrie und Wegpunkten.
import type { LngLat } from "../types.js";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface GpxWaypoint {
  lng: number;
  lat: number;
  name: string;
}

/**
 * Erzeugt GPX 1.1 mit einem Track (die Route) und optionalen Wegpunkten
 * (Start/Ziel/Zwischenziele, ausgewählte Restaurants ...).
 */
export function buildGpx(
  track: LngLat[],
  waypoints: GpxWaypoint[] = [],
  name = "Motorrad-Route",
): string {
  const wpts = waypoints
    .map(
      (w) =>
        `  <wpt lat="${w.lat}" lon="${w.lng}"><name>${escapeXml(w.name)}</name></wpt>`,
    )
    .join("\n");

  const trkpts = track
    .map(([lng, lat]) => `      <trkpt lat="${lat}" lon="${lng}"></trkpt>`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Motorrad-Routenplaner" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${escapeXml(name)}</name></metadata>
${wpts}
  <trk>
    <name>${escapeXml(name)}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>
`;
}

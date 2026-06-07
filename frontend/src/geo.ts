// Kleine Geo-Helfer (ohne externe Lib) für die „kluge" POI-Einfügung.
import type { LngLat } from "./types";

const R = 6371000; // Erdradius in Metern
const rad = (d: number) => (d * Math.PI) / 180;

/** Distanz zweier Punkte in Metern (Haversine). */
export function distanceM(a: LngLat, b: LngLat): number {
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Projiziert `pt` auf die Polylinie `line` und liefert die kumulierte Distanz
 * (in Metern) bis zum nächstgelegenen Punkt auf der Linie. Lokale äquirektangulare
 * Näherung – für die Streckenlängen hier völlig ausreichend.
 */
export function projectDistanceAlong(line: LngLat[], pt: LngLat): number {
  if (line.length < 2) return 0;
  const lat0 = rad(pt[1]);
  const mx = (lng: number) => rad(lng) * Math.cos(lat0) * R;
  const my = (lat: number) => rad(lat) * R;
  const px = mx(pt[0]);
  const py = my(pt[1]);

  let cum = 0; // kumulierte Distanz bis Segmentanfang
  let best = Infinity;
  let bestDist = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const ax = mx(line[i][0]);
    const ay = my(line[i][1]);
    const bx = mx(line[i + 1][0]);
    const by = my(line[i + 1][1]);
    const dx = bx - ax;
    const dy = by - ay;
    const segLen = Math.hypot(dx, dy);
    let t = segLen === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / (segLen * segLen);
    t = Math.max(0, Math.min(1, t));
    const projx = ax + t * dx;
    const projy = ay + t * dy;
    const d2 = (px - projx) ** 2 + (py - projy) ** 2;
    if (d2 < best) {
      best = d2;
      bestDist = cum + t * segLen;
    }
    cum += segLen;
  }
  return bestDist;
}

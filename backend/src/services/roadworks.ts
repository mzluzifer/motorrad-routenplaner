// Aggregiert Baustellen aus Autobahn-GmbH-API und OSM (Overpass) für eine Box.
import type { LngLat, Roadwork } from "../types.js";
import { getAutobahnRoadworks } from "./autobahn.js";
import { findOsmRoadworks } from "./overpass.js";

/** Bounding-Box [minLng, minLat, maxLng, maxLat] aus einer Punktliste, mit Rand. */
export function bboxOf(points: LngLat[], padDeg = 0.05): [number, number, number, number] {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const [lng, lat] of points) {
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
  }
  return [minLng - padDeg, minLat - padDeg, maxLng + padDeg, maxLat + padDeg];
}

/**
 * Liefert Baustellen in der Box. OSM-Abfrage ist optional (kann lahm/lückenhaft
 * sein); schlägt sie fehl, werden trotzdem die Autobahn-Daten geliefert.
 */
export async function getRoadworks(
  bbox: [number, number, number, number],
  includeOsm = true,
): Promise<Roadwork[]> {
  const tasks: Promise<Roadwork[]>[] = [getAutobahnRoadworks(bbox)];
  if (includeOsm) {
    tasks.push(findOsmRoadworks(bbox).catch(() => [] as Roadwork[]));
  }
  const results = await Promise.all(tasks);
  return results.flat();
}

// Overpass-API-Abfragen für POIs (Restaurants/Imbisse) und OSM-Baustellen.
import * as turf from "@turf/turf";
import { config, userAgent } from "../config.js";
import type { LngLat, Poi, Roadwork } from "../types.js";

async function overpass(query: string): Promise<any> {
  const res = await fetch(config.overpassUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": userAgent,
    },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) {
    throw new Error(`Overpass fehlgeschlagen (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

/** Mittelpunkt eines Overpass-Elements (node oder way/relation mit center). */
function elementCenter(el: any): { lat: number; lng: number } | null {
  if (typeof el.lat === "number" && typeof el.lon === "number") {
    return { lat: el.lat, lng: el.lon };
  }
  if (el.center) return { lat: el.center.lat, lng: el.center.lon };
  return null;
}

/**
 * Findet Restaurants/Imbisse/Cafés innerhalb von `bufferM` Metern um die Route.
 * Es wird die Bounding-Box der Route abgefragt und danach exakt nach Distanz
 * zur Linie gefiltert.
 */
export async function findPois(
  routeLine: LngLat[],
  bufferM = 500,
): Promise<Poi[]> {
  if (routeLine.length < 2) return [];

  const line = turf.lineString(routeLine);
  // Bounding-Box der Route, leicht erweitert.
  const bbox = turf.bbox(turf.buffer(line, bufferM, { units: "meters" })!);
  const [minLng, minLat, maxLng, maxLat] = bbox;

  const query = `
    [out:json][timeout:25];
    (
      node["amenity"~"^(restaurant|fast_food|cafe)$"](${minLat},${minLng},${maxLat},${maxLng});
      way["amenity"~"^(restaurant|fast_food|cafe)$"](${minLat},${minLng},${maxLat},${maxLng});
    );
    out center tags;
  `;

  const data = await overpass(query);
  const pois: Poi[] = [];

  for (const el of data.elements ?? []) {
    const center = elementCenter(el);
    if (!center) continue;
    const pt = turf.point([center.lng, center.lat]);
    const distance = turf.pointToLineDistance(pt, line, { units: "meters" });
    if (distance > bufferM) continue;

    const tags = el.tags ?? {};
    pois.push({
      id: `${el.type}/${el.id}`,
      lat: center.lat,
      lng: center.lng,
      name: tags.name ?? "(ohne Namen)",
      kind: tags.amenity,
      cuisine: tags.cuisine,
      distance: Math.round(distance),
    });
  }

  // Nächstgelegene zuerst.
  pois.sort((a, b) => a.distance - b.distance);
  return pois;
}

/**
 * OSM-Baustellen in einer Bounding-Box: highway=construction sowie Ways mit
 * construction:* / temporären Sperrungen. Datenlage ist lückenhaft.
 */
export async function findOsmRoadworks(
  bbox: [number, number, number, number], // [minLng, minLat, maxLng, maxLat]
): Promise<Roadwork[]> {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const query = `
    [out:json][timeout:25];
    (
      way["highway"="construction"](${minLat},${minLng},${maxLat},${maxLng});
      node["highway"="construction"](${minLat},${minLng},${maxLat},${maxLng});
    );
    out center tags;
  `;
  const data = await overpass(query);
  const out: Roadwork[] = [];
  for (const el of data.elements ?? []) {
    const center = elementCenter(el);
    if (!center) continue;
    const tags = el.tags ?? {};
    out.push({
      id: `osm/${el.type}/${el.id}`,
      lat: center.lat,
      lng: center.lng,
      title: tags.name ?? "Baustelle (OSM)",
      description: tags.construction ? `Im Bau: ${tags.construction}` : "highway=construction",
      source: "osm",
      radius: 150,
    });
  }
  return out;
}

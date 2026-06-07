// Overpass-API-Abfragen für POIs (Restaurants/Imbisse) und OSM-Baustellen.
import * as turf from "@turf/turf";
import { config, userAgent } from "../config.js";
import type { LngLat, Poi, Roadwork } from "../types.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Overpass-Abfrage mit Backoff-Retry. Die öffentlichen Instanzen liefern bei
 * Last häufig 429/504 – ein kurzer Wiederholungsversuch ist meist erfolgreich.
 */
async function overpass(query: string, attempt = 0): Promise<any> {
  let res: Response;
  try {
    res = await fetch(config.overpassUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": userAgent,
      },
      body: `data=${encodeURIComponent(query)}`,
    });
  } catch (err) {
    if (attempt < 2) {
      await sleep(1500 * (attempt + 1));
      return overpass(query, attempt + 1);
    }
    throw err;
  }
  // Bei Überlastung kurz warten und erneut versuchen.
  if ((res.status === 429 || res.status === 504) && attempt < 2) {
    await sleep(1500 * (attempt + 1));
    return overpass(query, attempt + 1);
  }
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

export type PoiCategory = "food" | "fuel" | "all";

const AMENITY_RE: Record<PoiCategory, string> = {
  food: "restaurant|fast_food|cafe",
  fuel: "fuel",
  all: "restaurant|fast_food|cafe|fuel",
};

/**
 * OSM-Qualität für Essen (0–5) aus der Tag-Vollständigkeit abgeleitet.
 * Das ist KEINE Nutzerbewertung – offene Daten haben keine Google-Sterne.
 * Gut gepflegte Einträge (Öffnungszeiten, Website, Küche …) gelten als
 * verlässlicher/„verifiziert" und bekommen einen höheren Wert.
 */
function foodQuality(tags: Record<string, string>): {
  quality: number;
  verified: boolean;
} {
  const has = (...keys: string[]) =>
    keys.some((k) => tags[k] != null && tags[k] !== "");
  const signals = [
    has("cuisine"),
    has("opening_hours"),
    has("website", "contact:website", "url"),
    has("phone", "contact:phone"),
    has("addr:housenumber"),
    has("brand", "operator"),
    has("wheelchair", "outdoor_seating", "takeaway", "delivery"),
  ].filter(Boolean).length;
  const capped = Math.min(signals, 5);
  const quality = Math.round((3.0 + (capped / 5) * 2.0) * 10) / 10; // 3.0–5.0
  const verified = !!tags.name && signals >= 2;
  return { quality, verified };
}

/**
 * Findet POIs (Essen: restaurant/fast_food/cafe, oder Tankstellen: amenity=fuel)
 * innerhalb von `bufferM` Metern um die Route. Es wird die Bounding-Box abgefragt
 * und danach exakt nach Distanz zur Linie gefiltert.
 */
export async function findPois(
  routeLine: LngLat[],
  opts: { bufferM?: number; category?: PoiCategory } = {},
): Promise<Poi[]> {
  if (routeLine.length < 2) return [];
  const bufferM = opts.bufferM ?? 500;
  const category = opts.category ?? "food";

  const line = turf.lineString(routeLine);
  // Bounding-Box der Route, leicht erweitert.
  const bbox = turf.bbox(turf.buffer(line, bufferM, { units: "meters" })!);
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const re = AMENITY_RE[category];

  const query = `
    [out:json][timeout:25];
    (
      node["amenity"~"^(${re})$"](${minLat},${minLng},${maxLat},${maxLng});
      way["amenity"~"^(${re})$"](${minLat},${minLng},${maxLat},${maxLng});
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

    const tags = (el.tags ?? {}) as Record<string, string>;
    const isFuel = tags.amenity === "fuel";

    if (isFuel) {
      // Nur reale, benannte Tankstellen (Marke oder Name vorhanden).
      const name = tags.name ?? tags.brand;
      if (!name) continue;
      pois.push({
        id: `${el.type}/${el.id}`,
        lat: center.lat,
        lng: center.lng,
        name,
        kind: "fuel",
        category: "fuel",
        brand: tags.brand,
        distance: Math.round(distance),
        verified: true,
      });
    } else {
      const { quality, verified } = foodQuality(tags);
      pois.push({
        id: `${el.type}/${el.id}`,
        lat: center.lat,
        lng: center.lng,
        name: tags.name ?? "(ohne Namen)",
        kind: tags.amenity,
        category: "food",
        cuisine: tags.cuisine,
        brand: tags.brand,
        distance: Math.round(distance),
        quality,
        verified,
      });
    }
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

// Echtzeit-Autobahn-Baustellen über die offene API der Autobahn GmbH.
// API: https://verkehr.autobahn.de/  (kostenlos, ohne Key)
//   GET /o/autobahn                       -> { roads: ["A1","A2", ...] }
//   GET /o/autobahn/{road}/services/roadworks -> { roadworks: [ ... ] }
import { config, userAgent } from "../config.js";
import type { Roadwork } from "../types.js";

interface CachedRoadworks {
  fetchedAt: number;
  data: Roadwork[];
}

const TTL_MS = 15 * 60 * 1000; // 15 Minuten
let cache: CachedRoadworks | null = null;

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, { headers: { "User-Agent": userAgent } });
  if (!res.ok) throw new Error(`Autobahn API ${url} -> ${res.status}`);
  return res.json();
}

/** Begrenzte Parallelität, um die API nicht zu überlasten. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      try {
        results[idx] = await fn(items[idx]);
      } catch {
        // Einzelne fehlgeschlagene Straße ignorieren.
        results[idx] = undefined as unknown as R;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function fetchAllRoadworks(): Promise<Roadwork[]> {
  const roadsResp = await fetchJson(`${config.autobahnUrl}`);
  const roads: string[] = roadsResp.roads ?? [];

  const perRoad = await mapLimit(roads, 8, async (road) => {
    const resp = await fetchJson(`${config.autobahnUrl}/${encodeURIComponent(road)}/services/roadworks`);
    const items: Roadwork[] = [];
    for (const rw of resp.roadworks ?? []) {
      const lat = Number(rw.coordinate?.lat);
      const lng = Number(rw.coordinate?.long);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      items.push({
        id: `autobahn/${rw.identifier ?? `${road}-${lat}-${lng}`}`,
        lat,
        lng,
        title: rw.title ?? `Baustelle ${road}`,
        description: Array.isArray(rw.description) ? rw.description.join(" ") : rw.subtitle,
        source: "autobahn",
        radius: 300,
      });
    }
    return items;
  });

  return perRoad.filter(Boolean).flat();
}

/** Alle Autobahn-Baustellen (gecacht), optional auf eine Bounding-Box gefiltert. */
export async function getAutobahnRoadworks(
  bbox?: [number, number, number, number], // [minLng, minLat, maxLng, maxLat]
): Promise<Roadwork[]> {
  if (!cache || Date.now() - cache.fetchedAt > TTL_MS) {
    cache = { fetchedAt: Date.now(), data: await fetchAllRoadworks() };
  }
  let data = cache.data;
  if (bbox) {
    const [minLng, minLat, maxLng, maxLat] = bbox;
    data = data.filter(
      (r) => r.lng >= minLng && r.lng <= maxLng && r.lat >= minLat && r.lat <= maxLat,
    );
  }
  return data;
}

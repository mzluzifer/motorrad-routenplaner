// Kapselt die Kommunikation mit dem BRouter-Routing-Server.
//
// Ablauf:
//  1. Beim ersten Routing eines Profils wird die .brf-Datei zum BRouter-Server
//     hochgeladen (POST /profile) -> liefert eine custom-Profil-ID zurück.
//     Das funktioniert sowohl beim selbst gehosteten Server als auch bei der
//     öffentlichen Instanz (bikerouter.de), ohne dass man Dateien mounten muss.
//  2. Das eigentliche Routing ist ein GET mit lonlats, profile, nogos, format.
//
// Doku BRouter HTTP-API: https://github.com/abrensch/brouter/blob/master/docs/users/server.md

import { config } from "../config.js";
import { profileText } from "../resources.js";
import type { LngLat, NoGo, ProfileName } from "../types.js";

const profileFiles: Record<ProfileName, string> = {
  fast: "moto-fast.brf",
  curvy: "moto-curvy.brf",
};

// Cache: Profilname -> hochgeladene custom-Profil-ID.
const uploadedProfiles = new Map<ProfileName, string>();

async function ensureProfileUploaded(profile: ProfileName): Promise<string> {
  const cached = uploadedProfiles.get(profile);
  if (cached) return cached;

  const text = await profileText(profileFiles[profile]);

  const res = await fetch(`${config.brouterUrl}/profile`, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: text,
  });
  if (!res.ok) {
    throw new Error(`BRouter Profil-Upload fehlgeschlagen (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { profileid?: string; error?: string };
  if (!data.profileid) {
    throw new Error(`BRouter lieferte keine profileid: ${JSON.stringify(data)}`);
  }
  uploadedProfiles.set(profile, data.profileid);
  return data.profileid;
}

/** Baut den nogos-Parameter: "lng,lat,radius|lng,lat,radius". */
function formatNogos(nogos: NoGo[] = []): string {
  return nogos.map((n) => `${n.lng},${n.lat},${Math.round(n.radius)}`).join("|");
}

/** Baut den lonlats-Parameter: "lng,lat|lng,lat|...". */
function formatPoints(points: LngLat[]): string {
  return points.map(([lng, lat]) => `${lng},${lat}`).join("|");
}

export interface BRouterResult {
  /** GeoJSON FeatureCollection von BRouter (enthält LineString + Eigenschaften). */
  geojson: any;
  /** Gesamtdistanz in Metern. */
  distanceM: number;
  /** Geschätzte Fahrzeit in Sekunden. */
  durationS: number;
}

/** Ein einzelner BRouter-Abruf für eine Punktfolge mit genau einem Profil. */
async function routeOnce(
  points: LngLat[],
  profile: ProfileName,
  nogos: NoGo[],
): Promise<{ coords: LngLat[]; distanceM: number; durationS: number }> {
  const profileId = await ensureProfileUploaded(profile);

  const params = new URLSearchParams({
    lonlats: formatPoints(points),
    profile: profileId,
    alternativeidx: "0",
    format: "geojson",
  });
  const nogoStr = formatNogos(nogos);
  if (nogoStr) params.set("nogos", nogoStr);

  const url = `${config.brouterUrl}?${params.toString()}`;
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`BRouter Routing fehlgeschlagen (${res.status}): ${text}`);
  }

  let geojson: any;
  try {
    geojson = JSON.parse(text);
  } catch {
    // BRouter gibt Fehler manchmal als Klartext zurück.
    throw new Error(`BRouter Antwort kein JSON: ${text.slice(0, 300)}`);
  }

  const feat = geojson?.features?.[0];
  const props = feat?.properties ?? {};
  // Höhenwerte (3. Koordinate) verwerfen – Karte/GPX brauchen nur lng,lat.
  const coords: LngLat[] = (feat?.geometry?.coordinates ?? []).map(
    (c: number[]) => [c[0], c[1]] as LngLat,
  );
  return {
    coords,
    distanceM: Number(props["track-length"] ?? 0),
    durationS: Number(props["total-time"] ?? 0),
  };
}

/**
 * Routet über die Wegpunkte. `profiles` legt je Abschnitt (points[i] -> points[i+1])
 * das Profil fest. Aufeinanderfolgende Abschnitte mit gleichem Profil werden zu einer
 * einzigen BRouter-Anfrage gebündelt; das Ergebnis wird zu einem Track zusammengefügt.
 */
export async function route(
  points: LngLat[],
  profiles: ProfileName[],
  nogos: NoGo[] = [],
): Promise<BRouterResult> {
  if (points.length < 2) {
    throw new Error("Mindestens zwei Punkte nötig.");
  }

  const segCount = points.length - 1;
  const profs: ProfileName[] = [];
  for (let i = 0; i < segCount; i++) {
    profs.push(profiles[i] ?? profiles[0] ?? "curvy");
  }

  // Aufeinanderfolgende Abschnitte gleichen Profils bündeln.
  const groups: { profile: ProfileName; pts: LngLat[] }[] = [];
  for (let i = 0; i < segCount; i++) {
    const last = groups[groups.length - 1];
    if (last && last.profile === profs[i]) {
      last.pts.push(points[i + 1]);
    } else {
      groups.push({ profile: profs[i], pts: [points[i], points[i + 1]] });
    }
  }

  const merged: LngLat[] = [];
  let distanceM = 0;
  let durationS = 0;
  for (const g of groups) {
    const r = await routeOnce(g.pts, g.profile, nogos);
    // Am Übergang den doppelten Punkt weglassen.
    if (merged.length === 0) merged.push(...r.coords);
    else merged.push(...r.coords.slice(1));
    distanceM += r.distanceM;
    durationS += r.durationS;
  }

  const geojson = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {
          "track-length": String(Math.round(distanceM)),
          "total-time": String(Math.round(durationS)),
        },
        geometry: { type: "LineString", coordinates: merged },
      },
    ],
  };

  return { geojson, distanceM, durationS };
}

/** Erzwingt Neu-Upload (z.B. nach Profiländerung im Dev-Betrieb). */
export function resetProfileCache(): void {
  uploadedProfiles.clear();
}

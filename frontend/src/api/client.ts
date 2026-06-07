// Dünner Client für das Backend (alle Aufrufe gehen über den Vite-Proxy /api).
import type {
  GeocodeResult,
  LngLat,
  NoGo,
  Poi,
  ProfileName,
  Roadwork,
  RouteResult,
  WeatherResult,
} from "../types";

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? `Fehler ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function fetchRoute(
  points: LngLat[],
  profiles: ProfileName[],
  nogos: NoGo[],
): Promise<RouteResult> {
  return post<RouteResult>("/api/route", { points, profiles, nogos });
}

export function fetchRoadworks(
  points: LngLat[],
  includeOsm: boolean,
): Promise<Roadwork[]> {
  return post<Roadwork[]>("/api/roadworks", { points, includeOsm });
}

export function fetchPois(
  line: LngLat[],
  category: "food" | "fuel" = "food",
  bufferM = 500,
): Promise<Poi[]> {
  return post<Poi[]>("/api/pois", { line, category, bufferM });
}

/** Wetter entlang der Route (Tageswerte) für ein Datum (YYYY-MM-DD, leer = heute). */
export function fetchWeather(
  line: LngLat[],
  date?: string,
  samples = 5,
): Promise<WeatherResult> {
  return post<WeatherResult>("/api/weather", { line, date, samples });
}

export async function geocode(q: string): Promise<GeocodeResult[]> {
  const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error("Adresssuche fehlgeschlagen");
  return res.json();
}

/** Koordinate -> Adresse (für „aktueller Standort"). */
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<GeocodeResult | null> {
  const res = await fetch(`/api/reverse?lat=${lat}&lng=${lng}`);
  if (!res.ok) return null;
  return res.json();
}

/** GPX herunterladen (Track + Wegpunkte). */
export async function downloadGpx(
  track: LngLat[],
  waypoints: { lng: number; lat: number; name: string }[],
  name = "Motorrad-Route",
): Promise<void> {
  const res = await fetch("/api/gpx", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ track, waypoints, name }),
  });
  if (!res.ok) throw new Error("GPX-Export fehlgeschlagen");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "route.gpx";
  a.click();
  URL.revokeObjectURL(url);
}

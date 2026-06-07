// Adresssuche über Nominatim (OSM).
import { config, userAgent } from "../config.js";

export interface GeocodeResult {
  label: string;
  lat: number;
  lng: number;
}

export async function geocode(query: string, limit = 5): Promise<GeocodeResult[]> {
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: String(limit),
    addressdetails: "0",
  });
  const res = await fetch(`${config.nominatimUrl}/search?${params.toString()}`, {
    headers: { "User-Agent": userAgent },
  });
  if (!res.ok) throw new Error(`Nominatim fehlgeschlagen (${res.status})`);
  const data = (await res.json()) as any[];
  return data.map((d) => ({
    label: d.display_name,
    lat: Number(d.lat),
    lng: Number(d.lon),
  }));
}

/** Rückwärts-Geocoding: Koordinate -> Adresse (für „aktueller Standort"). */
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<GeocodeResult | null> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: "jsonv2",
  });
  const res = await fetch(`${config.nominatimUrl}/reverse?${params.toString()}`, {
    headers: { "User-Agent": userAgent },
  });
  if (!res.ok) return null;
  const d = (await res.json()) as any;
  if (!d || !d.display_name) return null;
  return { label: d.display_name, lat: Number(d.lat), lng: Number(d.lon) };
}

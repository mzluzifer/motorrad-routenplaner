// Wetter entlang der Route über Open-Meteo (frei, kein API-Key).
// - Zukunft/heute: Forecast-API (bis ~16 Tage)
// - Vergangenheit: Archive-API (historische Reanalyse)
// Mehrere Punkte werden in EINER Anfrage abgefragt (komma-separierte Koordinaten).
import * as turf from "@turf/turf";
import type { LngLat, WeatherPoint } from "../types.js";

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";

const DAILY =
  "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Gleichmäßig über die Streckenlänge verteilte Stützpunkte (inkl. Start/Ziel). */
function sampleAlong(
  line: LngLat[],
  count: number,
): { lng: number; lat: number; atM: number }[] {
  const ls = turf.lineString(line);
  const totalKm = turf.length(ls, { units: "kilometers" });
  const n = Math.max(2, count);
  const pts: { lng: number; lat: number; atM: number }[] = [];
  for (let i = 0; i < n; i++) {
    const frac = i / (n - 1);
    const p = turf.along(ls, totalKm * frac, { units: "kilometers" });
    const [lng, lat] = p.geometry.coordinates;
    pts.push({ lng, lat, atM: Math.round(totalKm * frac * 1000) });
  }
  return pts;
}

/**
 * Tageswetter (für `date`, Format YYYY-MM-DD; Standard: heute) an mehreren
 * Punkten entlang der Route. Liefert je Punkt Wettercode, Temperaturen,
 * Niederschlag und Wind.
 */
export async function weatherAlong(
  line: LngLat[],
  date?: string,
  samples = 5,
): Promise<{ date: string; points: WeatherPoint[] }> {
  if (line.length < 2) return { date: date ?? todayISO(), points: [] };
  const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayISO();

  const pts = sampleAlong(line, samples);
  const lats = pts.map((p) => p.lat.toFixed(4)).join(",");
  const lngs = pts.map((p) => p.lng.toFixed(4)).join(",");

  // Endpunkt nach Datum wählen: Vergangenheit -> Archiv, sonst Forecast.
  const isPast = day < todayISO();
  const base = isPast ? ARCHIVE_URL : FORECAST_URL;
  const url =
    `${base}?latitude=${lats}&longitude=${lngs}` +
    `&daily=${DAILY}&timezone=auto&start_date=${day}&end_date=${day}`;

  const res = await fetch(url, { headers: { "User-Agent": "MotorradRoutenplaner/0.3" } });
  if (!res.ok) {
    throw new Error(`Wetterdienst fehlgeschlagen (${res.status})`);
  }
  const data = await res.json();
  // Bei mehreren Koordinaten liefert Open-Meteo ein Array, sonst ein Objekt.
  const arr: any[] = Array.isArray(data) ? data : [data];

  const points: WeatherPoint[] = pts.map((p, i) => {
    const d = arr[i]?.daily ?? {};
    const val = (k: string) => (Array.isArray(d[k]) ? d[k][0] : undefined);
    return {
      lng: p.lng,
      lat: p.lat,
      atM: p.atM,
      weatherCode: Number(val("weather_code") ?? -1),
      tempMax: num(val("temperature_2m_max")),
      tempMin: num(val("temperature_2m_min")),
      precipMm: num(val("precipitation_sum")),
      windMaxKmh: num(val("wind_speed_10m_max")),
    };
  });

  return { date: day, points };
}

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

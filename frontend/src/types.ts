export type LngLat = [number, number];
export type ProfileName = "fast" | "curvy" | "autobahn";

export interface Waypoint {
  id: string;
  lng: number;
  lat: number;
  label: string;
  /** Profil für den Abschnitt von diesem Wegpunkt zum nächsten. */
  profile?: ProfileName;
}

export interface NoGo {
  lng: number;
  lat: number;
  radius: number;
}

export interface Roadwork {
  id: string;
  lat: number;
  lng: number;
  title: string;
  description?: string;
  source: "autobahn" | "osm";
  radius: number;
}

export interface Poi {
  id: string;
  lat: number;
  lng: number;
  name: string;
  kind: string; // restaurant | fast_food | cafe | fuel
  category: "food" | "fuel";
  cuisine?: string;
  brand?: string;
  distance: number;
  /** OSM-Qualität 0–5 (nur Essen, aus Tag-Vollständigkeit; keine echten Sterne). */
  quality?: number;
  verified: boolean;
}

export interface RouteLeg {
  distanceM: number;
  durationS: number;
}

export interface ElevationSample {
  /** Kumulierte Distanz ab Start in Metern. */
  d: number;
  /** Höhe in Metern. */
  e: number;
}

export interface RouteFeaturePoint {
  lng: number;
  lat: number;
  kind: "toll" | "ferry";
  lengthM: number;
  atM: number;
  label?: string;
}

export interface RouteResult {
  geojson: GeoJSON.FeatureCollection;
  distanceM: number;
  durationS: number;
  /** Distanz/Fahrzeit je Abschnitt (Wegpunkt i -> i+1). */
  legs?: RouteLeg[];
  /** Höhenprofil (kumulierte Distanz + Höhe). */
  elevation?: ElevationSample[];
  /** Maut-/Fährstellen entlang der Route. */
  features?: RouteFeaturePoint[];
  /** Alternative Routen (nur am Hauptergebnis gesetzt). */
  alternatives?: RouteResult[];
}

export interface WeatherPoint {
  lng: number;
  lat: number;
  atM: number;
  weatherCode: number;
  tempMax: number | null;
  tempMin: number | null;
  precipMm: number | null;
  windMaxKmh: number | null;
}

export interface WeatherResult {
  date: string;
  points: WeatherPoint[];
}

export interface GeocodeResult {
  label: string;
  lat: number;
  lng: number;
}

export interface VersionInfo {
  current: string;
  latest: string | null;
  updateAvailable: boolean;
  releaseUrl: string;
  repoUrl: string;
}

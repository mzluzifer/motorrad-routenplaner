export type LngLat = [number, number];
export type ProfileName = "fast" | "curvy";

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
  kind: string;
  cuisine?: string;
  distance: number;
}

export interface RouteResult {
  geojson: GeoJSON.FeatureCollection;
  distanceM: number;
  durationS: number;
}

export interface GeocodeResult {
  label: string;
  lat: number;
  lng: number;
}

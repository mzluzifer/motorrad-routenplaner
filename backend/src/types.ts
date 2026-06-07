// Gemeinsame Typen für das Backend.

/** Ein geografischer Punkt [Längengrad, Breitengrad] (GeoJSON-Reihenfolge). */
export type LngLat = [number, number];

/** Routenprofil. */
export type ProfileName = "fast" | "curvy";

/** Eine zu meidende Zone (Baustelle), die als BRouter-nogo dient. */
export interface NoGo {
  lng: number;
  lat: number;
  /** Radius in Metern. */
  radius: number;
}

/** Anfrage an /route. */
export interface RouteRequest {
  /** Geordnete Wegpunkte: Start, optionale Zwischenziele, Ziel. */
  points: LngLat[];
  /** Einheitliches Profil (Fallback, falls keine Abschnittsprofile gesetzt sind). */
  profile?: ProfileName;
  /** Profil je Abschnitt (Länge = points.length - 1). Hat Vorrang vor `profile`. */
  profiles?: ProfileName[];
  /** Aktive Baustellen-Sperrzonen (nur die vom Nutzer aktiv gelassenen). */
  nogos?: NoGo[];
}

/** Eine normalisierte Baustelle. */
export interface Roadwork {
  id: string;
  lat: number;
  lng: number;
  title: string;
  description?: string;
  source: "autobahn" | "osm";
  /** Vorgeschlagener Sperrradius in Metern. */
  radius: number;
}

/** Ein POI (Restaurant/Imbiss) entlang der Strecke. */
export interface Poi {
  id: string;
  lat: number;
  lng: number;
  name: string;
  kind: string; // restaurant | fast_food | cafe
  cuisine?: string;
  /** Distanz zur Route in Metern. */
  distance: number;
}

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

// Unterstützte Sprachen. Reihenfolge = Anzeige im Umschalter.
export type Lang = "de" | "en" | "es";

export const LANGS: { id: Lang; label: string; flag: string }[] = [
  { id: "de", label: "Deutsch", flag: "🇩🇪" },
  { id: "en", label: "English", flag: "🇬🇧" },
  { id: "es", label: "Español", flag: "🇪🇸" },
];

type Dict = Record<string, string>;

// Deutsch ist die Referenz (Fallback für fehlende Schlüssel).
const de: Dict = {
  "app.title": "🏍️ Motorrad-Routenplaner",
  "app.titlePlain": "Motorrad-Routenplaner",

  "topbar.updateTitle": "Neueres Release auf GitHub verfügbar",
  "topbar.updateAvailable": "⬆ Update verfügbar: {v}",
  "topbar.upToDate": "✓ aktuell",
  "topbar.latestRelease": "Neuestes Release: {v}",
  "topbar.repoTitle": "Projekt auf GitHub öffnen",
  "topbar.repo": "⭐ Repository",
  "topbar.langTitle": "Sprache wechseln",

  "donate.title": "Projekt unterstützen",
  "donate.button": "❤ Mit PayPal spenden",
  "donate.qrAlt": "PayPal-Spenden-QR-Code",
  "donate.qrHint": "QR-Code scannen zum Spenden",

  "wp.title": "Wegpunkte",
  "wp.locating": "📍 Standort wird ermittelt …",
  "wp.useLocation": "📍 Aktueller Standort als Start",
  "wp.empty":
    "Noch keine Punkte – Standort nutzen, unten eingeben oder in die Karte klicken.",
  "wp.addressPlaceholder": "Adresse/Ort …",
  "wp.moveUp": "nach oben",
  "wp.moveDown": "nach unten",
  "wp.remove": "entfernen",
  "wp.addPlaceholder": "Wegpunkt hinzufügen …",
  "wp.roundTrip": "Rundtour (zurück zum Start)",
  "wp.clearAll": "Alle löschen",
  "wp.tip": "Tipp: in die Karte klicken setzt einen weiteren Punkt.",

  "profile.title": "Routenprofil (Vorgabe)",
  "profile.fast": "Schnell",
  "profile.fast.title": "Schnell (zügige Straßen)",
  "profile.curvy": "Kurvig",
  "profile.curvy.title": "Kurvig (Ortschaften meiden)",
  "profile.autobahn": "Autobahn",
  "profile.autobahn.title": "Autobahn bevorzugen (am schnellsten)",
  "profile.note":
    "Setzt das Profil für alle Abschnitte. Einzelne Abschnitte lassen sich oben pro Teilstrecke auf ⚡/🌀/🛣️ umstellen. Kurvig bevorzugt Landstraßen und meidet Städte & Dörfer; Autobahn ist am schnellsten.",

  "rw.title": "Baustellen",
  "rw.avoidOn": "meiden an",
  "rw.avoidOff": "meiden aus",
  "rw.avoid": "Baustellen meiden",
  "rw.includeOsm": "Auch OSM-Baustellen (Land-/Nebenstraßen)",
  "rw.none": "Keine Baustellen im Routenbereich gefunden.",
  "rw.avoidThis": "diese Baustelle meiden",
  "rw.hint": "Häkchen entfernen, um einzelne Baustellen doch zu befahren.",

  "food.title": "Einkehr (Restaurants/Imbisse)",
  "food.search": "Entlang der Strecke suchen",
  "food.minQualityLabel": "Mindest-Qualität",
  "food.matches": "{n} von {total} Treffern (verifiziert & ≥ Schwelle)",
  "food.noneAboveThreshold":
    "Keine Treffer über der Schwelle – Mindest-Qualität senken.",
  "food.qualityNote":
    "„Qualität“ = Vollständigkeit der OSM-Daten (Öffnungszeiten, Website, Küche …), keine echten Nutzer-/Google-Sterne – offene Daten haben keine Bewertungen.",
  "poi.distanceToRoute": "{distance} m zur Route",
  "poi.qualityTitle": "OSM-Qualität {val}/5",

  "fuel.title": "Tankstellen",
  "fuel.search": "Tankstellen entlang der Strecke",
  "fuel.note":
    "Reale Tankstellen aus OpenStreetMap (Marke/Name). Auswahl fügt sie als Zwischenziel ein.",
  "fuel.station": "Tankstelle",

  "weather.title": "Wetter entlang der Strecke",
  "weather.dateTitle": "Datum (leer = heute)",
  "weather.fetch": "Wetter abrufen",
  "weather.start": "Start",
  "weather.dest": "Ziel",
  "weather.at": "bei {dist}",
  "weather.note":
    "Tageswetter (Open-Meteo) an mehreren Punkten der Strecke – für heute oder ein gewähltes Datum (Vergangenheit & Prognose bis ~16 Tage).",

  "tf.title": "Maut & Fähren",
  "tf.none": "Keine Maut oder Fähren auf der Route erkannt.",
  "tf.planFirst": "Route planen, um Maut/Fähren zu sehen.",
  "tf.ferry": "Fähre",
  "tf.ferryMeta": "bei {at} · {len} Überfahrt",
  "tf.toll": "Maut",
  "tf.tollMeta": "bei {at} · {len} mautpflichtig",
  "tf.length": "Länge {len}",

  "sb.distance": "Distanz",
  "sb.duration": "Fahrzeit (ca.)",
  "sb.variantsTitle": "Streckenvariante wählen",
  "sb.route": "Route",
  "sb.variant": "Var. {i}",
  "sb.calculating": "Berechne Route …",
  "sb.elevTitle": "Höhenprofil",
  "sb.placeWaypoints": "Wegpunkte setzen, um eine Route zu planen.",
  "sb.exportGpx": "⬇ GPX exportieren",

  "map.avoided": "wird gemieden",
  "map.driven": "wird befahren",
  "map.clickAdd": "klicken zum Hinzufügen",
  "map.clickRemove": "klicken zum Entfernen",

  "geo.unsupported": "Standortbestimmung wird vom Browser nicht unterstützt.",
  "geo.myLocation": "📍 Mein Standort",
  "geo.unavailable": "Standort nicht verfügbar: {msg}",
  "geo.pointLabel": "Punkt ({lat}, {lng})",
  "geo.searchTitle": "Adresse suchen",

  "common.searching": "Suche …",
  "common.loading": "Lädt …",
  "common.error": "Fehler: {msg}",
};

const en: Dict = {
  "app.title": "🏍️ Motorcycle Route Planner",
  "app.titlePlain": "Motorcycle Route Planner",

  "topbar.updateTitle": "Newer release available on GitHub",
  "topbar.updateAvailable": "⬆ Update available: {v}",
  "topbar.upToDate": "✓ up to date",
  "topbar.latestRelease": "Latest release: {v}",
  "topbar.repoTitle": "Open project on GitHub",
  "topbar.repo": "⭐ Repository",
  "topbar.langTitle": "Change language",

  "donate.title": "Support this project",
  "donate.button": "❤ Donate via PayPal",
  "donate.qrAlt": "PayPal donation QR code",
  "donate.qrHint": "Scan the QR code to donate",

  "wp.title": "Waypoints",
  "wp.locating": "📍 Locating …",
  "wp.useLocation": "📍 Current location as start",
  "wp.empty":
    "No points yet – use your location, type below, or click on the map.",
  "wp.addressPlaceholder": "Address/place …",
  "wp.moveUp": "move up",
  "wp.moveDown": "move down",
  "wp.remove": "remove",
  "wp.addPlaceholder": "Add waypoint …",
  "wp.roundTrip": "Round trip (back to start)",
  "wp.clearAll": "Clear all",
  "wp.tip": "Tip: click on the map to add another point.",

  "profile.title": "Route profile (default)",
  "profile.fast": "Fast",
  "profile.fast.title": "Fast (quick roads)",
  "profile.curvy": "Curvy",
  "profile.curvy.title": "Curvy (avoid towns)",
  "profile.autobahn": "Motorway",
  "profile.autobahn.title": "Prefer motorways (fastest)",
  "profile.note":
    "Sets the profile for all segments. You can switch individual segments to ⚡/🌀/🛣️ above. Curvy prefers country roads and avoids towns & villages; motorway is fastest.",

  "rw.title": "Roadworks",
  "rw.avoidOn": "avoid on",
  "rw.avoidOff": "avoid off",
  "rw.avoid": "Avoid roadworks",
  "rw.includeOsm": "Also OSM roadworks (minor roads)",
  "rw.none": "No roadworks found near the route.",
  "rw.avoidThis": "avoid this roadwork",
  "rw.hint": "Uncheck to drive through individual roadworks anyway.",

  "food.title": "Food stops (restaurants/snacks)",
  "food.search": "Search along the route",
  "food.minQualityLabel": "Min. quality",
  "food.matches": "{n} of {total} matches (verified & ≥ threshold)",
  "food.noneAboveThreshold":
    "No matches above the threshold – lower the minimum quality.",
  "food.qualityNote":
    "“Quality” = completeness of the OSM data (opening hours, website, cuisine …), not real user/Google stars – open data has no ratings.",
  "poi.distanceToRoute": "{distance} m to route",
  "poi.qualityTitle": "OSM quality {val}/5",

  "fuel.title": "Fuel stations",
  "fuel.search": "Fuel stations along the route",
  "fuel.note":
    "Real fuel stations from OpenStreetMap (brand/name). Selecting adds them as a stopover.",
  "fuel.station": "Fuel station",

  "weather.title": "Weather along the route",
  "weather.dateTitle": "Date (empty = today)",
  "weather.fetch": "Get weather",
  "weather.start": "Start",
  "weather.dest": "Destination",
  "weather.at": "at {dist}",
  "weather.note":
    "Daily weather (Open-Meteo) at several points along the route – for today or a chosen date (past & forecast up to ~16 days).",

  "tf.title": "Tolls & ferries",
  "tf.none": "No tolls or ferries detected on the route.",
  "tf.planFirst": "Plan a route to see tolls/ferries.",
  "tf.ferry": "Ferry",
  "tf.ferryMeta": "at {at} · {len} crossing",
  "tf.toll": "Toll",
  "tf.tollMeta": "at {at} · {len} tolled",
  "tf.length": "Length {len}",

  "sb.distance": "Distance",
  "sb.duration": "Travel time (approx.)",
  "sb.variantsTitle": "Choose route variant",
  "sb.route": "Route",
  "sb.variant": "Var. {i}",
  "sb.calculating": "Calculating route …",
  "sb.elevTitle": "Elevation profile",
  "sb.placeWaypoints": "Place waypoints to plan a route.",
  "sb.exportGpx": "⬇ Export GPX",

  "map.avoided": "avoided",
  "map.driven": "included",
  "map.clickAdd": "click to add",
  "map.clickRemove": "click to remove",

  "geo.unsupported": "Geolocation is not supported by the browser.",
  "geo.myLocation": "📍 My location",
  "geo.unavailable": "Location unavailable: {msg}",
  "geo.pointLabel": "Point ({lat}, {lng})",
  "geo.searchTitle": "Search address",

  "common.searching": "Searching …",
  "common.loading": "Loading …",
  "common.error": "Error: {msg}",
};

const es: Dict = {
  "app.title": "🏍️ Planificador de Rutas en Moto",
  "app.titlePlain": "Planificador de Rutas en Moto",

  "topbar.updateTitle": "Nueva versión disponible en GitHub",
  "topbar.updateAvailable": "⬆ Actualización disponible: {v}",
  "topbar.upToDate": "✓ actualizado",
  "topbar.latestRelease": "Última versión: {v}",
  "topbar.repoTitle": "Abrir proyecto en GitHub",
  "topbar.repo": "⭐ Repositorio",
  "topbar.langTitle": "Cambiar idioma",

  "donate.title": "Apoyar este proyecto",
  "donate.button": "❤ Donar con PayPal",
  "donate.qrAlt": "Código QR de donación de PayPal",
  "donate.qrHint": "Escanea el código QR para donar",

  "wp.title": "Puntos de ruta",
  "wp.locating": "📍 Localizando …",
  "wp.useLocation": "📍 Ubicación actual como inicio",
  "wp.empty":
    "Aún no hay puntos: usa tu ubicación, escribe abajo o haz clic en el mapa.",
  "wp.addressPlaceholder": "Dirección/lugar …",
  "wp.moveUp": "subir",
  "wp.moveDown": "bajar",
  "wp.remove": "eliminar",
  "wp.addPlaceholder": "Añadir punto …",
  "wp.roundTrip": "Ida y vuelta (regreso al inicio)",
  "wp.clearAll": "Borrar todo",
  "wp.tip": "Consejo: haz clic en el mapa para añadir otro punto.",

  "profile.title": "Perfil de ruta (predeterminado)",
  "profile.fast": "Rápido",
  "profile.fast.title": "Rápido (carreteras ágiles)",
  "profile.curvy": "Con curvas",
  "profile.curvy.title": "Con curvas (evitar pueblos)",
  "profile.autobahn": "Autopista",
  "profile.autobahn.title": "Preferir autopistas (lo más rápido)",
  "profile.note":
    "Establece el perfil para todos los tramos. Puedes cambiar tramos individuales a ⚡/🌀/🛣️ arriba. «Con curvas» prefiere carreteras secundarias y evita ciudades y pueblos; la autopista es lo más rápido.",

  "rw.title": "Obras",
  "rw.avoidOn": "evitar activado",
  "rw.avoidOff": "evitar desactivado",
  "rw.avoid": "Evitar obras",
  "rw.includeOsm": "También obras de OSM (carreteras secundarias)",
  "rw.none": "No se encontraron obras cerca de la ruta.",
  "rw.avoidThis": "evitar esta obra",
  "rw.hint": "Desmarca para pasar por obras concretas de todos modos.",

  "food.title": "Paradas para comer (restaurantes/snacks)",
  "food.search": "Buscar a lo largo de la ruta",
  "food.minQualityLabel": "Calidad mínima",
  "food.matches": "{n} de {total} resultados (verificados y ≥ umbral)",
  "food.noneAboveThreshold":
    "Sin resultados por encima del umbral: baja la calidad mínima.",
  "food.qualityNote":
    "«Calidad» = integridad de los datos de OSM (horarios, web, cocina …), no estrellas reales de usuarios/Google: los datos abiertos no tienen valoraciones.",
  "poi.distanceToRoute": "{distance} m a la ruta",
  "poi.qualityTitle": "Calidad OSM {val}/5",

  "fuel.title": "Gasolineras",
  "fuel.search": "Gasolineras a lo largo de la ruta",
  "fuel.note":
    "Gasolineras reales de OpenStreetMap (marca/nombre). Al seleccionarlas se añaden como parada.",
  "fuel.station": "Gasolinera",

  "weather.title": "Tiempo a lo largo de la ruta",
  "weather.dateTitle": "Fecha (vacío = hoy)",
  "weather.fetch": "Consultar tiempo",
  "weather.start": "Inicio",
  "weather.dest": "Destino",
  "weather.at": "en {dist}",
  "weather.note":
    "Tiempo diario (Open-Meteo) en varios puntos de la ruta: para hoy o una fecha elegida (pasado y pronóstico hasta ~16 días).",

  "tf.title": "Peajes y ferris",
  "tf.none": "No se detectaron peajes ni ferris en la ruta.",
  "tf.planFirst": "Planifica una ruta para ver peajes/ferris.",
  "tf.ferry": "Ferri",
  "tf.ferryMeta": "en {at} · {len} de travesía",
  "tf.toll": "Peaje",
  "tf.tollMeta": "en {at} · {len} de peaje",
  "tf.length": "Longitud {len}",

  "sb.distance": "Distancia",
  "sb.duration": "Tiempo (aprox.)",
  "sb.variantsTitle": "Elegir variante de ruta",
  "sb.route": "Ruta",
  "sb.variant": "Var. {i}",
  "sb.calculating": "Calculando ruta …",
  "sb.elevTitle": "Perfil de altitud",
  "sb.placeWaypoints": "Coloca puntos para planificar una ruta.",
  "sb.exportGpx": "⬇ Exportar GPX",

  "map.avoided": "evitada",
  "map.driven": "incluida",
  "map.clickAdd": "clic para añadir",
  "map.clickRemove": "clic para eliminar",

  "geo.unsupported": "El navegador no admite la geolocalización.",
  "geo.myLocation": "📍 Mi ubicación",
  "geo.unavailable": "Ubicación no disponible: {msg}",
  "geo.pointLabel": "Punto ({lat}, {lng})",
  "geo.searchTitle": "Buscar dirección",

  "common.searching": "Buscando …",
  "common.loading": "Cargando …",
  "common.error": "Error: {msg}",
};

const DICTS: Record<Lang, Dict> = { de, en, es };

export type Params = Record<string, string | number | null | undefined>;

/** Übersetzt einen Schlüssel; {platzhalter} werden aus `params` ersetzt. */
export function translate(lang: Lang, key: string, params?: Params): string {
  let s = DICTS[lang][key] ?? de[key] ?? key;
  if (params) {
    for (const k of Object.keys(params)) {
      s = s.replaceAll(`{${k}}`, String(params[k]));
    }
  }
  return s;
}

function detectLang(): Lang {
  const stored = localStorage.getItem("lang");
  if (stored === "de" || stored === "en" || stored === "es") return stored;
  const nav = (navigator.language || "de").slice(0, 2).toLowerCase();
  return nav === "es" ? "es" : nav === "en" ? "en" : "de";
}

interface I18nValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, params?: Params) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(detectLang);

  useEffect(() => {
    localStorage.setItem("lang", lang);
    document.documentElement.lang = lang;
    document.title = translate(lang, "app.titlePlain");
  }, [lang]);

  const t = (key: string, params?: Params) => translate(lang, key, params);

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

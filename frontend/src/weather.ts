// WMO-Wettercode -> Emoji + mehrsprachige Kurzbeschreibung.
// Referenz: https://open-meteo.com/en/docs (WMO Weather interpretation codes)
import type { Lang } from "./i18n";

const ICONS: Record<number, string> = {
  0: "☀️", 1: "🌤️", 2: "⛅", 3: "☁️",
  45: "🌫️", 48: "🌫️",
  51: "🌦️", 53: "🌦️", 55: "🌦️", 56: "🌧️", 57: "🌧️",
  61: "🌦️", 63: "🌧️", 65: "🌧️", 66: "🌧️", 67: "🌧️",
  71: "🌨️", 73: "🌨️", 75: "❄️", 77: "🌨️",
  80: "🌦️", 81: "🌧️", 82: "⛈️", 85: "🌨️", 86: "❄️",
  95: "⛈️", 96: "⛈️", 99: "⛈️",
};

const TEXTS: Record<Lang, Record<number, string>> = {
  de: {
    0: "Klar", 1: "Überwiegend klar", 2: "Teils bewölkt", 3: "Bewölkt",
    45: "Nebel", 48: "Reifnebel",
    51: "Leichter Niesel", 53: "Niesel", 55: "Starker Niesel",
    56: "Gefrierender Niesel", 57: "Gefrierender Niesel",
    61: "Leichter Regen", 63: "Regen", 65: "Starker Regen",
    66: "Gefrierender Regen", 67: "Gefrierender Regen",
    71: "Leichter Schnee", 73: "Schnee", 75: "Starker Schnee", 77: "Schneegriesel",
    80: "Leichte Schauer", 81: "Schauer", 82: "Heftige Schauer",
    85: "Schneeschauer", 86: "Schneeschauer",
    95: "Gewitter", 96: "Gewitter mit Hagel", 99: "Gewitter mit Hagel",
  },
  en: {
    0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Cloudy",
    45: "Fog", 48: "Rime fog",
    51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
    56: "Freezing drizzle", 57: "Freezing drizzle",
    61: "Light rain", 63: "Rain", 65: "Heavy rain",
    66: "Freezing rain", 67: "Freezing rain",
    71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains",
    80: "Light showers", 81: "Showers", 82: "Violent showers",
    85: "Snow showers", 86: "Snow showers",
    95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Thunderstorm with hail",
  },
  es: {
    0: "Despejado", 1: "Mayormente despejado", 2: "Parcialmente nublado", 3: "Nublado",
    45: "Niebla", 48: "Niebla con escarcha",
    51: "Llovizna ligera", 53: "Llovizna", 55: "Llovizna intensa",
    56: "Llovizna helada", 57: "Llovizna helada",
    61: "Lluvia ligera", 63: "Lluvia", 65: "Lluvia intensa",
    66: "Lluvia helada", 67: "Lluvia helada",
    71: "Nieve ligera", 73: "Nieve", 75: "Nieve intensa", 77: "Granos de nieve",
    80: "Chubascos ligeros", 81: "Chubascos", 82: "Chubascos fuertes",
    85: "Chubascos de nieve", 86: "Chubascos de nieve",
    95: "Tormenta", 96: "Tormenta con granizo", 99: "Tormenta con granizo",
  },
};

const UNKNOWN: Record<Lang, string> = {
  de: "unbekannt",
  en: "unknown",
  es: "desconocido",
};

export function weatherIcon(code: number): string {
  return ICONS[code] ?? "❔";
}

export function weatherText(code: number, lang: Lang): string {
  return TEXTS[lang][code] ?? UNKNOWN[lang];
}

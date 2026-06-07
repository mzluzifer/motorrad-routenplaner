// WMO-Wettercode -> Emoji + deutsche Kurzbeschreibung.
// Referenz: https://open-meteo.com/en/docs (WMO Weather interpretation codes)

const TABLE: Record<number, { icon: string; text: string }> = {
  0: { icon: "☀️", text: "Klar" },
  1: { icon: "🌤️", text: "Überwiegend klar" },
  2: { icon: "⛅", text: "Teils bewölkt" },
  3: { icon: "☁️", text: "Bewölkt" },
  45: { icon: "🌫️", text: "Nebel" },
  48: { icon: "🌫️", text: "Reifnebel" },
  51: { icon: "🌦️", text: "Leichter Niesel" },
  53: { icon: "🌦️", text: "Niesel" },
  55: { icon: "🌦️", text: "Starker Niesel" },
  56: { icon: "🌧️", text: "Gefrierender Niesel" },
  57: { icon: "🌧️", text: "Gefrierender Niesel" },
  61: { icon: "🌦️", text: "Leichter Regen" },
  63: { icon: "🌧️", text: "Regen" },
  65: { icon: "🌧️", text: "Starker Regen" },
  66: { icon: "🌧️", text: "Gefrierender Regen" },
  67: { icon: "🌧️", text: "Gefrierender Regen" },
  71: { icon: "🌨️", text: "Leichter Schnee" },
  73: { icon: "🌨️", text: "Schnee" },
  75: { icon: "❄️", text: "Starker Schnee" },
  77: { icon: "🌨️", text: "Schneegriesel" },
  80: { icon: "🌦️", text: "Leichte Schauer" },
  81: { icon: "🌧️", text: "Schauer" },
  82: { icon: "⛈️", text: "Heftige Schauer" },
  85: { icon: "🌨️", text: "Schneeschauer" },
  86: { icon: "❄️", text: "Schneeschauer" },
  95: { icon: "⛈️", text: "Gewitter" },
  96: { icon: "⛈️", text: "Gewitter mit Hagel" },
  99: { icon: "⛈️", text: "Gewitter mit Hagel" },
};

export function weatherIcon(code: number): string {
  return TABLE[code]?.icon ?? "❔";
}

export function weatherText(code: number): string {
  return TABLE[code]?.text ?? "unbekannt";
}

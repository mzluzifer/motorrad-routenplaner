import { useState } from "react";
import GeoInput from "./GeoInput";
import { fmtDistance, fmtDuration } from "../format";
import type {
  Poi,
  ProfileName,
  Roadwork,
  RouteResult,
  Waypoint,
} from "../types";

interface Props {
  waypoints: Waypoint[];
  profile: ProfileName;
  setProfile: (p: ProfileName) => void;
  setSegmentProfile: (id: string, p: ProfileName) => void;
  roundTrip: boolean;
  setRoundTrip: (b: boolean) => void;
  locating: boolean;
  onUseMyLocation: () => void;
  onUpdateWaypoint: (id: string, lng: number, lat: number, label: string) => void;
  avoidConstruction: boolean;
  setAvoidConstruction: (b: boolean) => void;
  includeOsm: boolean;
  setIncludeOsm: (b: boolean) => void;
  roadworks: Roadwork[];
  disabledRoadworks: Set<string>;
  toggleRoadwork: (id: string) => void;
  route: RouteResult | null;
  // Essen (bereits nach Qualität gefiltert) + Gesamtzahl gefundener Treffer
  pois: Poi[];
  foodTotal: number;
  minQuality: number;
  setMinQuality: (q: number) => void;
  selectedPois: Set<string>;
  poiLoading: boolean;
  poiError: string | null;
  onSearchPois: () => void;
  // Tankstellen
  fuelPois: Poi[];
  fuelLoading: boolean;
  fuelError: string | null;
  onSearchFuel: () => void;
  onTogglePoi: (poi: Poi) => void;
  onAddWaypoint: (lng: number, lat: number, label?: string) => void;
  onRemoveWaypoint: (id: string) => void;
  onMoveWaypoint: (id: string, dir: -1 | 1) => void;
  onClearWaypoints: () => void;
}

const letter = (i: number) => String.fromCharCode(65 + i);

/** Die wählbaren Profile mit Symbol/Beschriftung (für Vorgabe + Abschnitt). */
const PROFILES: { id: ProfileName; icon: string; label: string; title: string }[] = [
  { id: "fast", icon: "⚡", label: "Schnell", title: "Schnell (zügige Straßen)" },
  { id: "curvy", icon: "🌀", label: "Kurvig", title: "Kurvig (Ortschaften meiden)" },
  { id: "autobahn", icon: "🛣️", label: "Autobahn", title: "Autobahn bevorzugen (am schnellsten)" },
];

/** OSM-Qualität als Sterne (0–5) darstellen. */
function stars(q: number): string {
  const full = Math.round(q);
  return "★".repeat(full) + "☆".repeat(5 - full);
}

export default function Sidebar(p: Props) {
  // Baustellen-Karte einklappbar (spart Platz bei vielen Einträgen).
  const [roadworksOpen, setRoadworksOpen] = useState(false);
  return (
    <aside className="sidebar">
      <h1>🏍️ Routenplaner</h1>

      {/* Wegpunkte mit Eingabefeldern + Abschnittsprofilen */}
      <div className="card">
        <h2>Wegpunkte</h2>
        <button
          className="ghost loc-btn"
          onClick={p.onUseMyLocation}
          disabled={p.locating}
        >
          {p.locating ? "📍 Standort wird ermittelt …" : "📍 Aktueller Standort als Start"}
        </button>

        {p.waypoints.length === 0 && (
          <p className="muted">
            Noch keine Punkte – Standort nutzen, unten eingeben oder in die Karte klicken.
          </p>
        )}

        <ul className="wp-list">
          {p.waypoints.map((w, i) => {
            const isLast = i === p.waypoints.length - 1;
            // Ein Abschnitt folgt, wenn ein nächster Wegpunkt existiert
            // oder (bei Rundtour) der Rückweg zum Start.
            const hasSegment =
              !isLast || (p.roundTrip && p.waypoints.length >= 2);
            const toLetter = isLast ? "A" : letter(i + 1);
            const segProfile = w.profile ?? p.profile;
            return (
              <li key={w.id}>
                <div className="wp-item">
                  <span className="wp-badge">{letter(i)}</span>
                  <GeoInput
                    value={w.label}
                    placeholder="Adresse/Ort …"
                    onPick={(r) =>
                      p.onUpdateWaypoint(w.id, r.lng, r.lat, r.label.split(",")[0])
                    }
                  />
                  <button
                    className="x"
                    title="nach oben"
                    onClick={() => p.onMoveWaypoint(w.id, -1)}
                    disabled={i === 0}
                  >
                    ▲
                  </button>
                  <button
                    className="x"
                    title="nach unten"
                    onClick={() => p.onMoveWaypoint(w.id, 1)}
                    disabled={isLast}
                  >
                    ▼
                  </button>
                  <button
                    className="x"
                    title="entfernen"
                    onClick={() => p.onRemoveWaypoint(w.id)}
                  >
                    ✕
                  </button>
                </div>
                {hasSegment && (
                  <div className="seg-connector">
                    <div className="seg-head">
                      <span className="seg-leg">
                        {letter(i)}→{toLetter}
                      </span>
                      {(() => {
                        const leg = p.route?.legs?.[i];
                        return leg ? (
                          <span className="seg-stats">
                            {fmtDistance(leg.distanceM)} · {fmtDuration(leg.durationS)}
                          </span>
                        ) : null;
                      })()}
                    </div>
                    <div className="seg seg-mini">
                      {PROFILES.map((pr) => (
                        <button
                          key={pr.id}
                          className={segProfile === pr.id ? "active" : ""}
                          title={pr.title}
                          onClick={() => p.setSegmentProfile(w.id, pr.id)}
                        >
                          {pr.icon}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {/* Neuen Wegpunkt per Eingabe hinzufügen */}
        <div className="wp-add">
          <GeoInput
            value=""
            placeholder="Wegpunkt hinzufügen …"
            clearOnPick
            onPick={(r) => p.onAddWaypoint(r.lng, r.lat, r.label.split(",")[0])}
          />
        </div>

        <label className="toggle" style={{ marginTop: 12 }}>
          <input
            type="checkbox"
            checked={p.roundTrip}
            onChange={(e) => p.setRoundTrip(e.target.checked)}
          />
          Rundtour (zurück zum Start)
        </label>
        {p.waypoints.length > 0 && (
          <button className="ghost" style={{ marginTop: 8 }} onClick={p.onClearWaypoints}>
            Alle löschen
          </button>
        )}
        <p className="muted" style={{ marginTop: 8 }}>
          Tipp: in die Karte klicken setzt einen weiteren Punkt.
        </p>
      </div>

      {/* Profil (Vorgabe für alle Abschnitte) */}
      <div className="card">
        <h2>Routenprofil (Vorgabe)</h2>
        <div className="seg">
          {PROFILES.map((pr) => (
            <button
              key={pr.id}
              className={p.profile === pr.id ? "active" : ""}
              title={pr.title}
              onClick={() => p.setProfile(pr.id)}
            >
              {pr.icon} {pr.label}
            </button>
          ))}
        </div>
        <p className="muted">
          Setzt das Profil für <b>alle</b> Abschnitte. Einzelne Abschnitte lassen sich
          oben pro Teilstrecke auf ⚡/🌀/🛣️ umstellen. Kurvig bevorzugt Landstraßen und
          meidet Städte &amp; Dörfer; Autobahn ist am schnellsten.
        </p>
      </div>

      {/* Baustellen (einklappbar) */}
      <div className="card">
        <button
          className="card-toggle"
          onClick={() => setRoadworksOpen((o) => !o)}
          aria-expanded={roadworksOpen}
        >
          <span className="card-toggle-caret">{roadworksOpen ? "▾" : "▸"}</span>
          <span className="card-toggle-title">Baustellen</span>
          <span className="card-toggle-meta">
            {p.avoidConstruction ? "meiden an" : "meiden aus"}
            {p.roadworks.length > 0 ? ` · ${p.roadworks.length}` : ""}
          </span>
        </button>
        {roadworksOpen && (
          <div className="card-body">
            <label className="toggle">
              <input
                type="checkbox"
                checked={p.avoidConstruction}
                onChange={(e) => p.setAvoidConstruction(e.target.checked)}
              />
              Baustellen meiden
            </label>
            <label className="toggle" style={{ marginTop: 6 }}>
              <input
                type="checkbox"
                checked={p.includeOsm}
                onChange={(e) => p.setIncludeOsm(e.target.checked)}
              />
              Auch OSM-Baustellen (Land-/Nebenstraßen)
            </label>
            {p.roadworks.length === 0 ? (
              <p className="muted">Keine Baustellen im Routenbereich gefunden.</p>
            ) : (
              <ul className="list">
                {p.roadworks.map((rw) => {
                  const active = p.avoidConstruction && !p.disabledRoadworks.has(rw.id);
                  return (
                    <li key={rw.id}>
                      <input
                        type="checkbox"
                        checked={active}
                        disabled={!p.avoidConstruction}
                        onChange={() => p.toggleRoadwork(rw.id)}
                        title="diese Baustelle meiden"
                      />
                      <span style={{ flex: 1 }}>
                        {rw.title}
                        <br />
                        <span className="muted">{rw.source.toUpperCase()}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="muted">Häkchen entfernen, um einzelne Baustellen doch zu befahren.</p>
          </div>
        )}
      </div>

      {/* Restaurants/Imbisse */}
      <div className="card">
        <h2>Einkehr (Restaurants/Imbisse)</h2>
        <button
          className="primary"
          onClick={p.onSearchPois}
          disabled={!p.route || p.poiLoading}
        >
          {p.poiLoading ? "Suche …" : "Entlang der Strecke suchen"}
        </button>
        {p.poiError && <p className="error">Fehler: {p.poiError}</p>}

        {p.foodTotal > 0 && (
          <div className="quality-row">
            <label className="muted">
              Mindest-Qualität: <b>{stars(p.minQuality)}</b> ({p.minQuality.toFixed(1)})
            </label>
            <input
              type="range"
              min={3}
              max={5}
              step={0.5}
              value={p.minQuality}
              onChange={(e) => p.setMinQuality(Number(e.target.value))}
            />
            <span className="muted">
              {p.pois.length} von {p.foodTotal} Treffern (verifiziert &amp; ≥ Schwelle)
            </span>
          </div>
        )}

        {p.pois.length > 0 && (
          <ul className="list">
            {p.pois.map((poi) => (
              <li key={poi.id}>
                <input
                  type="checkbox"
                  checked={p.selectedPois.has(poi.id)}
                  onChange={() => p.onTogglePoi(poi)}
                />
                <span style={{ flex: 1 }}>
                  {poi.name}
                  {poi.quality != null && (
                    <span className="qstars" title={`OSM-Qualität ${poi.quality.toFixed(1)}/5`}>
                      {" "}
                      {stars(poi.quality)}
                    </span>
                  )}
                  <br />
                  <span className="muted">
                    {poi.kind}
                    {poi.cuisine ? ` · ${poi.cuisine}` : ""} · {poi.distance} m
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
        {p.foodTotal > 0 && p.pois.length === 0 && (
          <p className="muted">
            Keine Treffer über der Schwelle – Mindest-Qualität senken.
          </p>
        )}
        <p className="muted">
          „Qualität" = Vollständigkeit der OSM-Daten (Öffnungszeiten, Website, Küche …),
          keine echten Nutzer-/Google-Sterne – offene Daten haben keine Bewertungen.
        </p>
      </div>

      {/* Tankstellen */}
      <div className="card">
        <h2>Tankstellen</h2>
        <button
          className="primary"
          onClick={p.onSearchFuel}
          disabled={!p.route || p.fuelLoading}
        >
          {p.fuelLoading ? "Suche …" : "Tankstellen entlang der Strecke"}
        </button>
        {p.fuelError && <p className="error">Fehler: {p.fuelError}</p>}
        {p.fuelPois.length > 0 ? (
          <ul className="list">
            {p.fuelPois.map((poi) => (
              <li key={poi.id}>
                <input
                  type="checkbox"
                  checked={p.selectedPois.has(poi.id)}
                  onChange={() => p.onTogglePoi(poi)}
                />
                <span style={{ flex: 1 }}>
                  ⛽ {poi.name}
                  <br />
                  <span className="muted">
                    {poi.brand ? `${poi.brand} · ` : ""}
                    {poi.distance} m zur Route
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">
            Reale Tankstellen aus OpenStreetMap (Marke/Name). Auswahl fügt sie als
            Zwischenziel ein.
          </p>
        )}
      </div>
    </aside>
  );
}

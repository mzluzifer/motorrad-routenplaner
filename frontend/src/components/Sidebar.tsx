import { useState } from "react";
import GeoInput from "./GeoInput";
import { fmtDistance, fmtDuration } from "../format";
import { weatherIcon, weatherText } from "../weather";
import { useI18n } from "../i18n";
import type {
  Poi,
  ProfileName,
  Roadwork,
  RouteResult,
  Waypoint,
  WeatherPoint,
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
  // Wetter
  weatherDate: string;
  setWeatherDate: (d: string) => void;
  weather: WeatherPoint[];
  weatherLoading: boolean;
  weatherError: string | null;
  onSearchWeather: () => void;
  onTogglePoi: (poi: Poi) => void;
  onAddWaypoint: (lng: number, lat: number, label?: string) => void;
  onRemoveWaypoint: (id: string) => void;
  onMoveWaypoint: (id: string, dir: -1 | 1) => void;
  onClearWaypoints: () => void;
}

const letter = (i: number) => String.fromCharCode(65 + i);

/** Die wählbaren Profile mit Symbol; Beschriftung/Titel kommen aus der i18n. */
const PROFILES: { id: ProfileName; icon: string; labelKey: string; titleKey: string }[] = [
  { id: "fast", icon: "⚡", labelKey: "profile.fast", titleKey: "profile.fast.title" },
  { id: "curvy", icon: "🌀", labelKey: "profile.curvy", titleKey: "profile.curvy.title" },
  { id: "autobahn", icon: "🛣️", labelKey: "profile.autobahn", titleKey: "profile.autobahn.title" },
];

/** OSM-Qualität als Sterne (0–5) darstellen. */
function stars(q: number): string {
  const full = Math.round(q);
  return "★".repeat(full) + "☆".repeat(5 - full);
}

export default function Sidebar(p: Props) {
  const { t, lang } = useI18n();
  // Baustellen-Karte einklappbar (spart Platz bei vielen Einträgen).
  const [roadworksOpen, setRoadworksOpen] = useState(false);
  return (
    <aside className="sidebar">
      {/* Wegpunkte mit Eingabefeldern + Abschnittsprofilen */}
      <div className="card">
        <h2>{t("wp.title")}</h2>
        <button
          className="ghost loc-btn"
          onClick={p.onUseMyLocation}
          disabled={p.locating}
        >
          {p.locating ? t("wp.locating") : t("wp.useLocation")}
        </button>

        {p.waypoints.length === 0 && <p className="muted">{t("wp.empty")}</p>}

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
                    placeholder={t("wp.addressPlaceholder")}
                    onPick={(r) =>
                      p.onUpdateWaypoint(w.id, r.lng, r.lat, r.label.split(",")[0])
                    }
                  />
                  <button
                    className="x"
                    title={t("wp.moveUp")}
                    onClick={() => p.onMoveWaypoint(w.id, -1)}
                    disabled={i === 0}
                  >
                    ▲
                  </button>
                  <button
                    className="x"
                    title={t("wp.moveDown")}
                    onClick={() => p.onMoveWaypoint(w.id, 1)}
                    disabled={isLast}
                  >
                    ▼
                  </button>
                  <button
                    className="x"
                    title={t("wp.remove")}
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
                          title={t(pr.titleKey)}
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
            placeholder={t("wp.addPlaceholder")}
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
          {t("wp.roundTrip")}
        </label>
        {p.waypoints.length > 0 && (
          <button className="ghost" style={{ marginTop: 8 }} onClick={p.onClearWaypoints}>
            {t("wp.clearAll")}
          </button>
        )}
        <p className="muted" style={{ marginTop: 8 }}>
          {t("wp.tip")}
        </p>
      </div>

      {/* Profil (Vorgabe für alle Abschnitte) */}
      <div className="card">
        <h2>{t("profile.title")}</h2>
        <div className="seg">
          {PROFILES.map((pr) => (
            <button
              key={pr.id}
              className={p.profile === pr.id ? "active" : ""}
              title={t(pr.titleKey)}
              onClick={() => p.setProfile(pr.id)}
            >
              {pr.icon} {t(pr.labelKey)}
            </button>
          ))}
        </div>
        <p className="muted">{t("profile.note")}</p>
      </div>

      {/* Baustellen (einklappbar) */}
      <div className="card">
        <button
          className="card-toggle"
          onClick={() => setRoadworksOpen((o) => !o)}
          aria-expanded={roadworksOpen}
        >
          <span className="card-toggle-caret">{roadworksOpen ? "▾" : "▸"}</span>
          <span className="card-toggle-title">{t("rw.title")}</span>
          <span className="card-toggle-meta">
            {p.avoidConstruction ? t("rw.avoidOn") : t("rw.avoidOff")}
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
              {t("rw.avoid")}
            </label>
            <label className="toggle" style={{ marginTop: 6 }}>
              <input
                type="checkbox"
                checked={p.includeOsm}
                onChange={(e) => p.setIncludeOsm(e.target.checked)}
              />
              {t("rw.includeOsm")}
            </label>
            {p.roadworks.length === 0 ? (
              <p className="muted">{t("rw.none")}</p>
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
                        title={t("rw.avoidThis")}
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
            <p className="muted">{t("rw.hint")}</p>
          </div>
        )}
      </div>

      {/* Restaurants/Imbisse */}
      <div className="card">
        <h2>{t("food.title")}</h2>
        <button
          className="primary"
          onClick={p.onSearchPois}
          disabled={!p.route || p.poiLoading}
        >
          {p.poiLoading ? t("common.searching") : t("food.search")}
        </button>
        {p.poiError && <p className="error">{t("common.error", { msg: p.poiError })}</p>}

        {p.foodTotal > 0 && (
          <div className="quality-row">
            <label className="muted">
              {t("food.minQualityLabel")}: <b>{stars(p.minQuality)}</b> ({p.minQuality.toFixed(1)})
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
              {t("food.matches", { n: p.pois.length, total: p.foodTotal })}
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
                    <span
                      className="qstars"
                      title={t("poi.qualityTitle", { val: poi.quality.toFixed(1) })}
                    >
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
          <p className="muted">{t("food.noneAboveThreshold")}</p>
        )}
        <p className="muted">{t("food.qualityNote")}</p>
      </div>

      {/* Tankstellen */}
      <div className="card">
        <h2>{t("fuel.title")}</h2>
        <button
          className="primary"
          onClick={p.onSearchFuel}
          disabled={!p.route || p.fuelLoading}
        >
          {p.fuelLoading ? t("common.searching") : t("fuel.search")}
        </button>
        {p.fuelError && <p className="error">{t("common.error", { msg: p.fuelError })}</p>}
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
                    {t("poi.distanceToRoute", { distance: poi.distance })}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">{t("fuel.note")}</p>
        )}
      </div>

      {/* Wetter entlang der Strecke */}
      <div className="card">
        <h2>{t("weather.title")}</h2>
        <div className="weather-controls">
          <input
            type="date"
            value={p.weatherDate}
            onChange={(e) => p.setWeatherDate(e.target.value)}
            title={t("weather.dateTitle")}
          />
          <button
            className="primary"
            onClick={p.onSearchWeather}
            disabled={!p.route || p.weatherLoading}
          >
            {p.weatherLoading ? t("common.loading") : t("weather.fetch")}
          </button>
        </div>
        {p.weatherError && <p className="error">{t("common.error", { msg: p.weatherError })}</p>}
        {p.weather.length > 0 ? (
          <ul className="list weather-list">
            {p.weather.map((w, i) => {
              const pos =
                i === 0
                  ? t("weather.start")
                  : i === p.weather.length - 1
                    ? t("weather.dest")
                    : t("weather.at", { dist: fmtDistance(w.atM) });
              return (
                <li key={i}>
                  <span className="w-icon" title={weatherText(w.weatherCode, lang)}>
                    {weatherIcon(w.weatherCode)}
                  </span>
                  <span style={{ flex: 1 }}>
                    <b>{pos}</b> · {weatherText(w.weatherCode, lang)}
                    <br />
                    <span className="muted">
                      {w.tempMin != null && w.tempMax != null
                        ? `${Math.round(w.tempMin)}–${Math.round(w.tempMax)} °C`
                        : "– °C"}
                      {w.precipMm != null ? ` · ☔ ${w.precipMm.toFixed(1)} mm` : ""}
                      {w.windMaxKmh != null ? ` · 💨 ${Math.round(w.windMaxKmh)} km/h` : ""}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="muted">{t("weather.note")}</p>
        )}
      </div>

      {/* Maut & Fähren */}
      {(() => {
        const feats = p.route?.features ?? [];
        const ferries = feats.filter((f) => f.kind === "ferry");
        const tolls = feats.filter((f) => f.kind === "toll");
        return (
          <div className="card">
            <h2>{t("tf.title")}</h2>
            {feats.length === 0 ? (
              <p className="muted">
                {p.route ? t("tf.none") : t("tf.planFirst")}
              </p>
            ) : (
              <ul className="list">
                {ferries.map((f, i) => (
                  <li key={`fy${i}`}>
                    <span className="w-icon">⛴️</span>
                    <span style={{ flex: 1 }}>
                      {t("tf.ferry")}
                      <br />
                      <span className="muted">
                        {t("tf.ferryMeta", {
                          at: fmtDistance(f.atM),
                          len: fmtDistance(f.lengthM),
                        })}
                      </span>
                    </span>
                  </li>
                ))}
                {tolls.map((f, i) => (
                  <li key={`tl${i}`}>
                    <span className="w-icon">💶</span>
                    <span style={{ flex: 1 }}>
                      {t("tf.toll")}
                      <br />
                      <span className="muted">
                        {t("tf.tollMeta", {
                          at: fmtDistance(f.atM),
                          len: fmtDistance(f.lengthM),
                        })}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })()}
    </aside>
  );
}
